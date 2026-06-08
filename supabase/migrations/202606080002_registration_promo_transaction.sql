drop function if exists public.create_registration_transaction(
  uuid,
  uuid,
  uuid[],
  timestamptz
);

create or replace function public.create_registration_transaction(
  p_actor_account_id uuid,
  p_player_profile_id uuid,
  p_division_ids uuid[],
  p_payment_expires_at timestamptz default null,
  p_promo_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_input_count integer;
  v_unique_count integer;
  v_found_count integer;
  v_tournament_count integer;
  v_tournament public.tournaments%rowtype;
  v_player record;
  v_source text;
  v_event_date date;
  v_player_age integer;
  v_conflict record;
  v_division record;
  v_reserved_count integer;
  v_waiting_position integer;
  v_total_fee_amount numeric(10,2) := 0;
  v_discount_amount numeric(10,2) := 0;
  v_amount_due numeric(10,2) := 0;
  v_discountable_total numeric(10,2) := 0;
  v_promo_code_input text := nullif(trim(coalesce(p_promo_code, '')), '');
  v_promo_code_normalized text;
  v_promo public.promo_codes%rowtype;
  v_has_promo boolean := false;
  v_promo_discount_total numeric(10,2) := 0;
  v_remaining_discount numeric(10,2) := 0;
  v_row_discount numeric(10,2) := 0;
  v_discount_rows integer := 0;
  v_discount_index integer := 0;
  v_usage_increment integer := 0;
  v_usage_id uuid;
  v_usage_ids uuid[] := array[]::uuid[];
  v_payment_order_id uuid;
  v_registration_id uuid;
  v_registration_status text;
  v_registration_results jsonb := '[]'::jsonb;
  v_overall_status text;
  v_plan record;
begin
  if p_actor_account_id is null then
    raise exception 'Actor account is required';
  end if;

  if p_player_profile_id is null then
    raise exception 'Player profile is required';
  end if;

  select count(*), count(distinct division_id)
    into v_input_count, v_unique_count
    from unnest(coalesce(p_division_ids, array[]::uuid[])) as input(division_id);

  if v_input_count = 0 then
    raise exception 'Select at least one division';
  end if;

  if v_input_count <> v_unique_count then
    raise exception 'Duplicate division selection';
  end if;

  if not exists (
    select 1
    from public.accounts a
    where a.id = p_actor_account_id
      and a.is_active = true
  ) then
    raise exception 'Actor account is not active';
  end if;

  select
    pp.id,
    pp.account_id,
    pp.power_level,
    pp.date_of_birth,
    a.is_active
    into v_player
    from public.player_profiles pp
    join public.accounts a on a.id = pp.account_id
    where pp.id = p_player_profile_id;

  if not found or v_player.is_active is distinct from true then
    raise exception 'Player profile not found';
  end if;

  if v_player.account_id = p_actor_account_id then
    if not exists (
      select 1
      from public.account_roles ar
      where ar.account_id = p_actor_account_id
        and ar.role = 'player'
        and ar.status = 'active'
    ) then
      raise exception 'Player role is not active';
    end if;

    v_source := 'self';
  elsif exists (
    select 1
    from public.account_roles ar
    join public.coach_player_links cpl
      on cpl.coach_account_id = ar.account_id
     and cpl.player_profile_id = p_player_profile_id
     and cpl.status = 'approved'
    where ar.account_id = p_actor_account_id
      and ar.role = 'coach'
      and ar.status = 'active'
  ) then
    v_source := 'coach';
  else
    raise exception 'Actor cannot register this player';
  end if;

  perform d.id
    from public.divisions d
    where d.id = any(p_division_ids)
    order by d.id
    for update;

  select count(*), count(distinct d.tournament_id)
    into v_found_count, v_tournament_count
    from public.divisions d
    where d.id = any(p_division_ids);

  if v_found_count <> v_input_count then
    raise exception 'One or more divisions were not found';
  end if;

  if v_tournament_count <> 1 then
    raise exception 'All selected divisions must belong to one tournament';
  end if;

  select t.*
    into v_tournament
    from public.tournaments t
    where t.id = (
      select d.tournament_id
      from public.divisions d
      where d.id = any(p_division_ids)
      limit 1
    )
    for update;

  if not found then
    raise exception 'Tournament not found';
  end if;

  if v_tournament.status <> 'open' then
    raise exception 'Tournament is not open for registration';
  end if;

  if v_tournament.registration_opens_at is not null
    and v_now < v_tournament.registration_opens_at
  then
    raise exception 'Registration has not opened yet';
  end if;

  if v_tournament.registration_closes_at is not null
    and v_now > v_tournament.registration_closes_at
  then
    raise exception 'Registration is already closed';
  end if;

  if exists (
    select 1
    from public.registrations r
    where r.player_profile_id = p_player_profile_id
      and r.division_id = any(p_division_ids)
      and r.status not in ('cancelled', 'expired', 'rejected')
  ) then
    raise exception 'Player already has an active registration for a selected division';
  end if;

  v_event_date := coalesce(v_tournament.event_date, v_tournament.event_starts_at::date, current_date);
  v_player_age := extract(year from age(v_event_date, v_player.date_of_birth))::integer;

  for v_division in
    select d.*
    from public.divisions d
    where d.id = any(p_division_ids)
    order by array_position(p_division_ids, d.id)
  loop
    if v_division.status <> 'active' then
      raise exception 'Division "%" is not active', v_division.name;
    end if;

    if v_division.min_power_level is not null
      and v_player.power_level < v_division.min_power_level
    then
      raise exception 'Player power level is below the division minimum';
    end if;

    if v_division.max_power_level is not null
      and v_player.power_level > v_division.max_power_level
    then
      raise exception 'Player power level is above the division maximum';
    end if;

    if v_division.min_age is not null and v_player_age < v_division.min_age then
      raise exception 'Player is below the division minimum age';
    end if;

    if v_division.max_age is not null and v_player_age > v_division.max_age then
      raise exception 'Player is above the division maximum age';
    end if;
  end loop;

  select
    left_division.name as existing_division_name,
    right_division.name as new_division_name
    into v_conflict
    from unnest(p_division_ids) with ordinality as left_input(division_id, sort_order)
    join public.divisions left_division on left_division.id = left_input.division_id
    join unnest(p_division_ids) with ordinality as right_input(division_id, sort_order)
      on right_input.sort_order > left_input.sort_order
    join public.divisions right_division on right_division.id = right_input.division_id
    where public.registration_time_slots_conflict(
      left_division.time_slot_label,
      left_division.starts_at,
      left_division.ends_at,
      right_division.time_slot_label,
      right_division.starts_at,
      right_division.ends_at
    )
    limit 1;

  if found then
    raise exception 'Selected divisions have a time-slot conflict: % and %',
      v_conflict.existing_division_name,
      v_conflict.new_division_name;
  end if;

  select
    existing_division.name as existing_division_name,
    new_division.name as new_division_name
    into v_conflict
    from public.registrations r
    join public.divisions existing_division on existing_division.id = r.division_id
    join public.divisions new_division on new_division.id = any(p_division_ids)
    where r.player_profile_id = p_player_profile_id
      and r.tournament_id = v_tournament.id
      and r.status not in ('cancelled', 'expired', 'rejected')
      and public.registration_time_slots_conflict(
        existing_division.time_slot_label,
        existing_division.starts_at,
        existing_division.ends_at,
        new_division.time_slot_label,
        new_division.starts_at,
        new_division.ends_at
      )
    limit 1;

  if found then
    raise exception 'Player already has a time-slot conflict: % and %',
      v_conflict.existing_division_name,
      v_conflict.new_division_name;
  end if;

  drop table if exists pg_temp.registration_transaction_plan;
  create temporary table pg_temp.registration_transaction_plan (
    sort_order integer not null,
    division_id uuid primary key,
    division_name text not null,
    fee_amount numeric(10,2) not null,
    discount_amount numeric(10,2) not null default 0,
    status text not null,
    waiting_list_position integer
  ) on commit drop;

  for v_division in
    select d.*
    from public.divisions d
    where d.id = any(p_division_ids)
    order by array_position(p_division_ids, d.id)
  loop
    select count(*)
      into v_reserved_count
      from public.registrations r
      where r.division_id = v_division.id
        and r.status in ('pending_payment', 'pending_verify', 'confirmed');

    v_waiting_position := null;

    if v_division.max_players is not null and v_reserved_count >= v_division.max_players then
      select coalesce(max(r.waiting_list_position), 0) + 1
        into v_waiting_position
        from public.registrations r
        where r.division_id = v_division.id
          and r.status = 'waiting_list';

      v_registration_status := 'waiting_list';
    elsif v_division.fee_amount = 0 then
      v_registration_status := 'confirmed';
    else
      v_registration_status := 'pending_payment';
    end if;

    insert into pg_temp.registration_transaction_plan (
      sort_order,
      division_id,
      division_name,
      fee_amount,
      status,
      waiting_list_position
    )
    values (
      array_position(p_division_ids, v_division.id),
      v_division.id,
      v_division.name,
      v_division.fee_amount,
      v_registration_status,
      v_waiting_position
    );
  end loop;

  select coalesce(sum(plan.fee_amount), 0)
    into v_total_fee_amount
    from pg_temp.registration_transaction_plan plan
    where plan.status <> 'waiting_list';

  if v_promo_code_input is not null then
    v_promo_code_normalized := upper(regexp_replace(v_promo_code_input, '\s+', '', 'g'));

    select promo.*
      into v_promo
      from public.promo_codes promo
      where promo.tournament_id = v_tournament.id
        and promo.code_normalized = v_promo_code_normalized
      for update;

    if not found then
      raise exception 'Promo code is invalid';
    end if;

    if v_promo.is_active is distinct from true then
      raise exception 'Promo code is not active';
    end if;

    if v_promo.starts_at is not null and v_now < v_promo.starts_at then
      raise exception 'Promo code has not started';
    end if;

    if v_promo.ends_at is not null and v_now > v_promo.ends_at then
      raise exception 'Promo code is expired';
    end if;

    if exists (
      select 1
      from public.promo_code_usages usage
      where usage.promo_code_id = v_promo.id
        and usage.tournament_id = v_tournament.id
        and usage.account_id = p_actor_account_id
    ) then
      raise exception 'Promo code was already used by this account for this tournament';
    end if;

    select coalesce(sum(plan.fee_amount), 0), count(*)
      into v_discountable_total, v_discount_rows
      from pg_temp.registration_transaction_plan plan
      where plan.status <> 'waiting_list'
        and plan.fee_amount > 0;

    if v_discountable_total <= 0 or v_discount_rows = 0 then
      raise exception 'Promo code does not apply to any payable registration';
    end if;

    if v_promo.division_ids is not null and exists (
      select 1
      from pg_temp.registration_transaction_plan plan
      where plan.status <> 'waiting_list'
        and plan.fee_amount > 0
        and not (plan.division_id = any(v_promo.division_ids))
    ) then
      raise exception 'Promo code does not apply to a selected division';
    end if;

    v_promo_discount_total := case v_promo.discount_type
      when 'free' then v_discountable_total
      when 'percentage' then round(v_discountable_total * v_promo.discount_value / 100, 2)
      when 'fixed' then least(v_promo.discount_value, v_discountable_total)
      else 0
    end;
    v_remaining_discount := v_promo_discount_total;
    v_discount_index := 0;

    for v_plan in
      select *
      from pg_temp.registration_transaction_plan plan
      where plan.status <> 'waiting_list'
        and plan.fee_amount > 0
      order by plan.sort_order
    loop
      v_discount_index := v_discount_index + 1;

      if v_discount_index = v_discount_rows then
        v_row_discount := least(v_plan.fee_amount, greatest(v_remaining_discount, 0));
      elsif v_promo.discount_type = 'free' then
        v_row_discount := v_plan.fee_amount;
      elsif v_promo.discount_type = 'percentage' then
        v_row_discount := least(
          v_plan.fee_amount,
          round(v_plan.fee_amount * v_promo.discount_value / 100, 2)
        );
      else
        v_row_discount := least(v_plan.fee_amount, v_remaining_discount);
      end if;

      update pg_temp.registration_transaction_plan plan
        set discount_amount = v_row_discount
        where plan.division_id = v_plan.division_id;

      v_remaining_discount := v_remaining_discount - v_row_discount;
    end loop;

    select count(*), coalesce(sum(plan.discount_amount), 0)
      into v_usage_increment, v_discount_amount
      from pg_temp.registration_transaction_plan plan
      where plan.discount_amount > 0;

    if v_usage_increment = 0 or v_discount_amount <= 0 then
      raise exception 'Promo code did not produce a discount';
    end if;

    update public.promo_codes promo
      set used_count = promo.used_count + v_usage_increment
      where promo.id = v_promo.id
        and (
          promo.usage_limit is null
          or promo.used_count + v_usage_increment <= promo.usage_limit
        )
      returning promo.* into v_promo;

    if not found then
      raise exception 'Promo code usage limit exceeded';
    end if;

    v_has_promo := true;
  end if;

  select coalesce(sum(plan.discount_amount), 0)
    into v_discount_amount
    from pg_temp.registration_transaction_plan plan
    where plan.status <> 'waiting_list';

  v_amount_due := v_total_fee_amount - v_discount_amount;

  if v_amount_due > 0 then
    insert into public.payment_orders (
      account_id,
      tournament_id,
      status,
      total_fee_amount,
      discount_amount,
      promptpay_id,
      promptpay_name,
      expires_at
    )
    values (
      p_actor_account_id,
      v_tournament.id,
      'pending_payment',
      v_total_fee_amount,
      v_discount_amount,
      v_tournament.promptpay_id,
      v_tournament.promptpay_name,
      coalesce(p_payment_expires_at, v_now + interval '24 hours')
    )
    returning id into v_payment_order_id;
  end if;

  for v_plan in
    select *
    from pg_temp.registration_transaction_plan plan
    order by plan.sort_order
  loop
    if v_plan.status = 'waiting_list' then
      v_registration_status := 'waiting_list';
    elsif v_plan.fee_amount - v_plan.discount_amount = 0 then
      v_registration_status := 'confirmed';
    else
      v_registration_status := 'pending_payment';
    end if;

    insert into public.registrations (
      tournament_id,
      division_id,
      player_profile_id,
      registered_by_account_id,
      payment_order_id,
      status,
      source,
      fee_amount,
      discount_amount,
      waiting_list_position,
      confirmed_at
    )
    values (
      v_tournament.id,
      v_plan.division_id,
      p_player_profile_id,
      p_actor_account_id,
      case when v_registration_status = 'pending_payment' then v_payment_order_id else null end,
      v_registration_status,
      v_source,
      v_plan.fee_amount,
      v_plan.discount_amount,
      v_plan.waiting_list_position,
      case when v_registration_status = 'confirmed' then v_now else null end
    )
    returning id into v_registration_id;

    if v_has_promo and v_plan.discount_amount > 0 then
      insert into public.promo_code_usages (
        promo_code_id,
        tournament_id,
        division_id,
        registration_id,
        payment_order_id,
        account_id,
        player_profile_id,
        code,
        discount_type,
        discount_value,
        discount_amount
      )
      values (
        v_promo.id,
        v_tournament.id,
        v_plan.division_id,
        v_registration_id,
        v_payment_order_id,
        p_actor_account_id,
        p_player_profile_id,
        v_promo.code,
        v_promo.discount_type,
        v_promo.discount_value,
        v_plan.discount_amount
      )
      returning id into v_usage_id;

      v_usage_ids := array_append(v_usage_ids, v_usage_id);
    end if;

    v_registration_results := v_registration_results || jsonb_build_array(
      jsonb_build_object(
        'id', v_registration_id,
        'divisionId', v_plan.division_id,
        'status', v_registration_status,
        'feeAmount', v_plan.fee_amount,
        'discountAmount', v_plan.discount_amount,
        'finalFeeAmount', v_plan.fee_amount - v_plan.discount_amount,
        'waitingListPosition', v_plan.waiting_list_position
      )
    );
  end loop;

  if exists (
    select 1
    from jsonb_to_recordset(v_registration_results) as result(status text)
    where result.status = 'pending_payment'
  ) then
    v_overall_status := 'pending_payment';
  elsif exists (
    select 1
    from jsonb_to_recordset(v_registration_results) as result(status text)
    where result.status = 'waiting_list'
  ) and exists (
    select 1
    from jsonb_to_recordset(v_registration_results) as result(status text)
    where result.status = 'confirmed'
  ) then
    v_overall_status := 'mixed';
  elsif exists (
    select 1
    from jsonb_to_recordset(v_registration_results) as result(status text)
    where result.status = 'waiting_list'
  ) then
    v_overall_status := 'waiting_list';
  else
    v_overall_status := 'confirmed';
  end if;

  return jsonb_build_object(
    'status', v_overall_status,
    'tournamentId', v_tournament.id,
    'playerProfileId', p_player_profile_id,
    'registeredByAccountId', p_actor_account_id,
    'paymentOrderId', v_payment_order_id,
    'totalFeeAmount', v_total_fee_amount,
    'discountAmount', v_discount_amount,
    'amountDue', v_amount_due,
    'promoCodeId', case when v_has_promo then v_promo.id else null end,
    'promoCode', case when v_has_promo then v_promo.code else null end,
    'promoCodeUsageIds', to_jsonb(v_usage_ids),
    'registrations', v_registration_results
  );
end;
$$;

revoke all on function public.create_registration_transaction(
  uuid,
  uuid,
  uuid[],
  timestamptz,
  text
) from public, anon, authenticated;

grant execute on function public.create_registration_transaction(
  uuid,
  uuid,
  uuid[],
  timestamptz,
  text
) to service_role;
