alter table public.payment_orders
  add column if not exists expired_at timestamptz;

alter table public.registrations
  add column if not exists expired_at timestamptz;

create index if not exists idx_registrations_waiting_list_fifo
  on public.registrations(division_id, waiting_list_position, created_at, id)
  where status = 'waiting_list';

create or replace function public.compact_waiting_list_positions(
  p_division_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated_count integer := 0;
begin
  if p_division_id is null then
    raise exception 'Division is required';
  end if;

  with ordered as (
    select
      r.id,
      row_number() over (
        order by r.waiting_list_position nulls last, r.created_at, r.id
      )::integer as next_position
    from public.registrations r
    where r.division_id = p_division_id
      and r.status = 'waiting_list'
  )
  update public.registrations r
    set waiting_list_position = ordered.next_position
    from ordered
    where r.id = ordered.id
      and r.waiting_list_position is distinct from ordered.next_position;

  get diagnostics v_updated_count = row_count;

  return v_updated_count;
end;
$$;

create or replace function public.promote_waiting_list_for_division(
  p_division_id uuid,
  p_payment_expires_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_division public.divisions%rowtype;
  v_tournament public.tournaments%rowtype;
  v_waiting public.registrations%rowtype;
  v_reserved_count integer := 0;
  v_payment_order_id uuid;
  v_now timestamptz := now();
  v_next_status text;
  v_old_waiting_position integer;
begin
  if p_division_id is null then
    raise exception 'Division is required';
  end if;

  select *
    into v_division
    from public.divisions
    where id = p_division_id
    for update;

  if not found then
    raise exception 'Division not found';
  end if;

  select *
    into v_tournament
    from public.tournaments
    where id = v_division.tournament_id;

  if not found then
    raise exception 'Tournament not found';
  end if;

  if v_division.status <> 'active' or v_tournament.status in ('draft', 'cancelled', 'completed') then
    perform public.compact_waiting_list_positions(v_division.id);

    return jsonb_build_object(
      'promoted', false,
      'divisionId', v_division.id,
      'reason', 'Division or tournament is not promotable'
    );
  end if;

  select count(*)
    into v_reserved_count
    from public.registrations r
    where r.division_id = v_division.id
      and r.status in ('pending_payment', 'pending_verify', 'confirmed');

  if v_division.max_players is not null and v_reserved_count >= v_division.max_players then
    perform public.compact_waiting_list_positions(v_division.id);

    return jsonb_build_object(
      'promoted', false,
      'divisionId', v_division.id,
      'reservedRegistrationCount', v_reserved_count,
      'reason', 'Division is full'
    );
  end if;

  select *
    into v_waiting
    from public.registrations r
    where r.division_id = v_division.id
      and r.status = 'waiting_list'
    order by r.waiting_list_position nulls last, r.created_at, r.id
    limit 1
    for update;

  if not found then
    return jsonb_build_object(
      'promoted', false,
      'divisionId', v_division.id,
      'reservedRegistrationCount', v_reserved_count,
      'reason', 'No waiting-list registration'
    );
  end if;

  v_old_waiting_position := v_waiting.waiting_list_position;

  if v_waiting.final_fee_amount <= 0 then
    v_next_status := 'confirmed';

    update public.registrations
      set
        status = v_next_status,
        payment_order_id = null,
        waiting_list_position = null,
        confirmed_at = coalesce(confirmed_at, v_now),
        expired_at = null
      where id = v_waiting.id;
  else
    v_next_status := 'pending_payment';

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
      v_waiting.registered_by_account_id,
      v_waiting.tournament_id,
      'pending_payment',
      v_waiting.fee_amount,
      v_waiting.discount_amount,
      v_tournament.promptpay_id,
      v_tournament.promptpay_name,
      coalesce(p_payment_expires_at, v_now + interval '24 hours')
    )
    returning id into v_payment_order_id;

    update public.registrations
      set
        status = v_next_status,
        payment_order_id = v_payment_order_id,
        waiting_list_position = null,
        expired_at = null
      where id = v_waiting.id;
  end if;

  perform public.compact_waiting_list_positions(v_division.id);

  return jsonb_build_object(
    'promoted', true,
    'divisionId', v_division.id,
    'registrationId', v_waiting.id,
    'status', v_next_status,
    'paymentOrderId', v_payment_order_id,
    'previousWaitingListPosition', v_old_waiting_position,
    'reservedRegistrationCountBeforePromotion', v_reserved_count
  );
end;
$$;

create or replace function public.expire_pending_payment_orders(
  p_limit integer default 100,
  p_payment_expires_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.payment_orders%rowtype;
  v_now timestamptz := now();
  v_limit integer := greatest(coalesce(p_limit, 100), 1);
  v_division_ids uuid[];
  v_division_id uuid;
  v_expired_order_count integer := 0;
  v_expired_registration_count integer := 0;
  v_registration_count integer := 0;
  v_promotions jsonb := '[]'::jsonb;
  v_promotion jsonb;
begin
  for v_order in
    select *
    from public.payment_orders po
    where po.status = 'pending_payment'
      and po.expires_at is not null
      and po.expires_at <= v_now
    order by po.expires_at, po.created_at
    limit v_limit
    for update skip locked
  loop
    select array_agg(distinct r.division_id)
      into v_division_ids
      from public.registrations r
      where r.payment_order_id = v_order.id
        and r.status = 'pending_payment';

    update public.registrations
      set
        status = 'expired',
        expired_at = v_now
      where payment_order_id = v_order.id
        and status = 'pending_payment';

    get diagnostics v_registration_count = row_count;
    v_expired_registration_count := v_expired_registration_count + v_registration_count;

    update public.payment_orders
      set
        status = 'expired',
        expired_at = v_now
      where id = v_order.id;

    v_expired_order_count := v_expired_order_count + 1;

    foreach v_division_id in array coalesce(v_division_ids, array[]::uuid[])
    loop
      v_promotion := public.promote_waiting_list_for_division(v_division_id, p_payment_expires_at);
      v_promotions := v_promotions || jsonb_build_array(v_promotion);
    end loop;
  end loop;

  return jsonb_build_object(
    'expiredPaymentOrders', v_expired_order_count,
    'expiredRegistrations', v_expired_registration_count,
    'promotedRegistrations', (
      select count(*)::integer
      from jsonb_array_elements(v_promotions) as promotion(value)
      where coalesce((promotion.value ->> 'promoted')::boolean, false)
    ),
    'promotions', v_promotions
  );
end;
$$;

create or replace function public.cancel_registration(
  p_actor_account_id uuid,
  p_registration_id uuid,
  p_cancellation_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  v_registration public.registrations%rowtype;
  v_tournament public.tournaments%rowtype;
  v_payment_order public.payment_orders%rowtype;
  v_reason text := nullif(btrim(p_cancellation_reason), '');
  v_now timestamptz := now();
  v_is_admin boolean;
  v_is_coach boolean;
  v_allowed boolean;
  v_active_payment_registration_count integer := 0;
  v_new_total_fee numeric(10,2);
  v_new_discount numeric(10,2);
  v_payment_order_status text;
  v_promotion jsonb := null;
begin
  if p_actor_account_id is null then
    raise exception 'Actor account is required';
  end if;

  if p_registration_id is null then
    raise exception 'Registration is required';
  end if;

  if v_reason is null then
    raise exception 'Cancellation reason is required';
  end if;

  if char_length(v_reason) > 500 then
    raise exception 'Cancellation reason is too long';
  end if;

  select *
    into v_registration
    from public.registrations
    where id = p_registration_id
    for update;

  if not found then
    raise exception 'Registration not found';
  end if;

  if v_registration.status in ('cancelled', 'expired', 'rejected') then
    raise exception 'Registration is already inactive';
  end if;

  if v_registration.status = 'pending_verify' then
    raise exception 'Cannot cancel while payment is under verification';
  end if;

  select *
    into v_tournament
    from public.tournaments
    where id = v_registration.tournament_id;

  if not found then
    raise exception 'Tournament not found';
  end if;

  if coalesce(v_tournament.event_date, v_tournament.event_starts_at::date) is not null
    and (v_now at time zone 'Asia/Bangkok')::date >= coalesce(v_tournament.event_date, v_tournament.event_starts_at::date) then
    raise exception 'Cannot cancel on or after event date';
  end if;

  select exists (
    select 1
    from public.account_roles ar
    where ar.account_id = p_actor_account_id
      and ar.role = 'admin'
      and ar.status = 'active'
  )
    into v_is_admin;

  select exists (
    select 1
    from public.account_roles ar
    where ar.account_id = p_actor_account_id
      and ar.role = 'coach'
      and ar.status = 'active'
  )
    into v_is_coach;

  v_allowed := v_is_admin
    or v_registration.registered_by_account_id = p_actor_account_id
    or exists (
      select 1
      from public.player_profiles pp
      where pp.id = v_registration.player_profile_id
        and pp.account_id = p_actor_account_id
    )
    or (
      v_is_coach
      and exists (
        select 1
        from public.coach_player_links cpl
        where cpl.coach_account_id = p_actor_account_id
          and cpl.player_profile_id = v_registration.player_profile_id
          and cpl.status = 'approved'
      )
    );

  if not v_allowed then
    raise exception 'Cannot cancel this registration';
  end if;

  if v_registration.payment_order_id is not null then
    select *
      into v_payment_order
      from public.payment_orders
      where id = v_registration.payment_order_id
      for update;
  end if;

  update public.registrations
    set
      status = 'cancelled',
      cancelled_by = p_actor_account_id,
      cancelled_at = v_now,
      cancellation_reason = v_reason,
      waiting_list_position = null
    where id = v_registration.id;

  if v_registration.status = 'waiting_list' then
    perform public.compact_waiting_list_positions(v_registration.division_id);
  else
    v_promotion := public.promote_waiting_list_for_division(v_registration.division_id);
  end if;

  if v_registration.payment_order_id is not null then
    select count(*)
      into v_active_payment_registration_count
      from public.registrations r
      where r.payment_order_id = v_registration.payment_order_id
        and r.status not in ('cancelled', 'expired', 'rejected');

    if v_payment_order.status = 'pending_payment' then
      if v_active_payment_registration_count = 0 then
        update public.payment_orders
          set
            status = 'cancelled',
            cancelled_at = v_now
          where id = v_payment_order.id
          returning * into v_payment_order;
      else
        v_new_total_fee := greatest(v_payment_order.total_fee_amount - v_registration.fee_amount, 0);
        v_new_discount := least(greatest(v_payment_order.discount_amount - v_registration.discount_amount, 0), v_new_total_fee);

        update public.payment_orders
          set
            total_fee_amount = v_new_total_fee,
            discount_amount = v_new_discount
          where id = v_payment_order.id
          returning * into v_payment_order;
      end if;
    end if;

    v_payment_order_status := v_payment_order.status;
  end if;

  return jsonb_build_object(
    'registrationId', v_registration.id,
    'status', 'cancelled',
    'paymentOrderId', v_registration.payment_order_id,
    'paymentOrderStatus', v_payment_order_status,
    'remainingPaymentRegistrations', v_active_payment_registration_count,
    'waitingListPromotionDeferred', false,
    'waitingListPromotion', v_promotion
  );
end;
$$;

create or replace function public.reject_payment_order_cancel(
  p_payment_order_id uuid,
  p_rejection_reason text,
  p_admin_account_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.payment_orders%rowtype;
  v_reason text := nullif(btrim(p_rejection_reason), '');
  v_registration_count integer;
  v_now timestamptz := now();
  v_division_ids uuid[];
  v_division_id uuid;
  v_promotions jsonb := '[]'::jsonb;
  v_promotion jsonb;
begin
  if p_payment_order_id is null then
    raise exception 'Payment order is required';
  end if;

  if v_reason is null then
    raise exception 'Rejection reason is required';
  end if;

  if char_length(v_reason) > 500 then
    raise exception 'Rejection reason is too long';
  end if;

  if p_admin_account_id is not null and not exists (
    select 1
    from public.account_roles ar
    where ar.account_id = p_admin_account_id
      and ar.role = 'admin'
      and ar.status = 'active'
  ) then
    raise exception 'Admin account is not active';
  end if;

  select *
    into v_order
    from public.payment_orders
    where id = p_payment_order_id
    for update;

  if not found then
    raise exception 'Payment order not found';
  end if;

  if v_order.status <> 'pending_verify' then
    raise exception 'Payment order is not pending verification';
  end if;

  select array_agg(distinct r.division_id)
    into v_division_ids
    from public.registrations r
    where r.payment_order_id = v_order.id
      and r.status in ('pending_verify', 'pending_payment');

  update public.registrations
    set
      status = 'cancelled',
      cancelled_by = p_admin_account_id,
      cancelled_at = v_now,
      cancellation_reason = v_reason
    where payment_order_id = v_order.id
      and status in ('pending_verify', 'pending_payment');

  get diagnostics v_registration_count = row_count;

  if v_registration_count = 0 then
    raise exception 'Payment order has no cancellable registrations';
  end if;

  foreach v_division_id in array coalesce(v_division_ids, array[]::uuid[])
  loop
    v_promotion := public.promote_waiting_list_for_division(v_division_id);
    v_promotions := v_promotions || jsonb_build_array(v_promotion);
  end loop;

  update public.payment_orders
    set
      status = 'cancelled',
      verified_by = null,
      verified_at = null,
      rejected_by = p_admin_account_id,
      rejected_at = v_now,
      rejection_reason = v_reason,
      cancelled_at = v_now
    where id = v_order.id
    returning * into v_order;

  return jsonb_build_object(
    'paymentOrderId', v_order.id,
    'status', v_order.status,
    'updatedRegistrations', v_registration_count,
    'waitingListPromotionDeferred', false,
    'promotedRegistrations', (
      select count(*)::integer
      from jsonb_array_elements(v_promotions) as promotion(value)
      where coalesce((promotion.value ->> 'promoted')::boolean, false)
    ),
    'promotions', v_promotions
  );
end;
$$;

revoke execute on function public.compact_waiting_list_positions(uuid) from public;
revoke execute on function public.compact_waiting_list_positions(uuid) from anon;
revoke execute on function public.compact_waiting_list_positions(uuid) from authenticated;
grant execute on function public.compact_waiting_list_positions(uuid) to service_role;

revoke execute on function public.promote_waiting_list_for_division(uuid, timestamptz) from public;
revoke execute on function public.promote_waiting_list_for_division(uuid, timestamptz) from anon;
revoke execute on function public.promote_waiting_list_for_division(uuid, timestamptz) from authenticated;
grant execute on function public.promote_waiting_list_for_division(uuid, timestamptz) to service_role;

revoke execute on function public.expire_pending_payment_orders(integer, timestamptz) from public;
revoke execute on function public.expire_pending_payment_orders(integer, timestamptz) from anon;
revoke execute on function public.expire_pending_payment_orders(integer, timestamptz) from authenticated;
grant execute on function public.expire_pending_payment_orders(integer, timestamptz) to service_role;

revoke execute on function public.cancel_registration(uuid, uuid, text) from public;
revoke execute on function public.cancel_registration(uuid, uuid, text) from anon;
revoke execute on function public.cancel_registration(uuid, uuid, text) from authenticated;
grant execute on function public.cancel_registration(uuid, uuid, text) to service_role;

revoke execute on function public.reject_payment_order_cancel(uuid, text, uuid) from public;
revoke execute on function public.reject_payment_order_cancel(uuid, text, uuid) from anon;
revoke execute on function public.reject_payment_order_cancel(uuid, text, uuid) from authenticated;
grant execute on function public.reject_payment_order_cancel(uuid, text, uuid) to service_role;
