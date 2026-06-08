create index if not exists idx_payment_orders_pending_verify_submitted
  on public.payment_orders(submitted_at desc, created_at desc)
  where status = 'pending_verify';

create or replace function public.approve_payment_order(
  p_payment_order_id uuid,
  p_admin_account_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.payment_orders%rowtype;
  v_registration_count integer;
  v_now timestamptz := now();
begin
  if p_payment_order_id is null then
    raise exception 'Payment order is required';
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

  update public.registrations
    set
      status = 'confirmed',
      confirmed_at = coalesce(confirmed_at, v_now)
    where payment_order_id = v_order.id
      and status = 'pending_verify';

  get diagnostics v_registration_count = row_count;

  if v_registration_count = 0 then
    raise exception 'Payment order has no registrations pending verification';
  end if;

  update public.payment_orders
    set
      status = 'confirmed',
      verified_by = p_admin_account_id,
      verified_at = v_now,
      rejected_by = null,
      rejected_at = null,
      rejection_reason = null,
      cancelled_at = null
    where id = v_order.id
    returning * into v_order;

  return jsonb_build_object(
    'paymentOrderId', v_order.id,
    'status', v_order.status,
    'updatedRegistrations', v_registration_count,
    'waitingListPromotionDeferred', false
  );
end;
$$;

create or replace function public.reject_payment_order_send_new(
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

  update public.registrations
    set status = 'pending_payment'
    where payment_order_id = v_order.id
      and status = 'pending_verify';

  get diagnostics v_registration_count = row_count;

  if v_registration_count = 0 then
    raise exception 'Payment order has no registrations pending verification';
  end if;

  update public.payment_orders
    set
      status = 'pending_payment',
      slip_url = null,
      slip_storage_path = null,
      paid_at = null,
      submitted_at = null,
      verified_by = null,
      verified_at = null,
      rejected_by = p_admin_account_id,
      rejected_at = v_now,
      rejection_reason = v_reason,
      cancelled_at = null
    where id = v_order.id
    returning * into v_order;

  return jsonb_build_object(
    'paymentOrderId', v_order.id,
    'status', v_order.status,
    'updatedRegistrations', v_registration_count,
    'waitingListPromotionDeferred', false
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
    'waitingListPromotionDeferred', true
  );
end;
$$;

revoke execute on function public.approve_payment_order(uuid, uuid) from public;
revoke execute on function public.approve_payment_order(uuid, uuid) from anon;
revoke execute on function public.approve_payment_order(uuid, uuid) from authenticated;
grant execute on function public.approve_payment_order(uuid, uuid) to service_role;

revoke execute on function public.reject_payment_order_send_new(uuid, text, uuid) from public;
revoke execute on function public.reject_payment_order_send_new(uuid, text, uuid) from anon;
revoke execute on function public.reject_payment_order_send_new(uuid, text, uuid) from authenticated;
grant execute on function public.reject_payment_order_send_new(uuid, text, uuid) to service_role;

revoke execute on function public.reject_payment_order_cancel(uuid, text, uuid) from public;
revoke execute on function public.reject_payment_order_cancel(uuid, text, uuid) from anon;
revoke execute on function public.reject_payment_order_cancel(uuid, text, uuid) from authenticated;
grant execute on function public.reject_payment_order_cancel(uuid, text, uuid) to service_role;
