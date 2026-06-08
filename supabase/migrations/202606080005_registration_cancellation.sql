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
      cancellation_reason = v_reason
    where id = v_registration.id;

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
    'waitingListPromotionDeferred', true
  );
end;
$$;

revoke execute on function public.cancel_registration(uuid, uuid, text) from public;
revoke execute on function public.cancel_registration(uuid, uuid, text) from anon;
revoke execute on function public.cancel_registration(uuid, uuid, text) from authenticated;
grant execute on function public.cancel_registration(uuid, uuid, text) to service_role;
