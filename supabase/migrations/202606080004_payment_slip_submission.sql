create or replace function public.submit_payment_slip(
  p_actor_account_id uuid,
  p_payment_order_id uuid,
  p_slip_url text,
  p_slip_storage_path text,
  p_paid_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  v_order public.payment_orders%rowtype;
  v_registration_count integer;
  v_is_admin boolean;
  v_is_coach boolean;
  v_allowed boolean;
  v_now timestamptz := now();
begin
  if p_actor_account_id is null then
    raise exception 'Actor account is required';
  end if;

  if p_payment_order_id is null then
    raise exception 'Payment order is required';
  end if;

  if p_slip_storage_path is null or btrim(p_slip_storage_path) = '' then
    raise exception 'Slip storage path is required';
  end if;

  select *
    into v_order
    from public.payment_orders
    where id = p_payment_order_id
    for update;

  if not found then
    raise exception 'Payment order not found';
  end if;

  if v_order.status <> 'pending_payment' then
    raise exception 'Payment order is not pending payment';
  end if;

  if v_order.amount_due <= 0 then
    raise exception 'Payment order does not require payment';
  end if;

  if v_order.expires_at is not null and v_order.expires_at < v_now then
    raise exception 'Payment order expired';
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
    or v_order.account_id = p_actor_account_id
    or exists (
      select 1
      from public.registrations r
      join public.player_profiles pp on pp.id = r.player_profile_id
      where r.payment_order_id = v_order.id
        and (
          r.registered_by_account_id = p_actor_account_id
          or pp.account_id = p_actor_account_id
          or (
            v_is_coach
            and exists (
              select 1
              from public.coach_player_links cpl
              where cpl.coach_account_id = p_actor_account_id
                and cpl.player_profile_id = r.player_profile_id
                and cpl.status = 'approved'
            )
          )
        )
    );

  if not v_allowed then
    raise exception 'Cannot update this payment order';
  end if;

  update public.payment_orders
    set
      status = 'pending_verify',
      slip_url = p_slip_url,
      slip_storage_path = p_slip_storage_path,
      paid_at = coalesce(p_paid_at, v_now),
      submitted_at = v_now,
      rejected_by = null,
      rejected_at = null,
      rejection_reason = null
    where id = v_order.id
    returning * into v_order;

  update public.registrations
    set status = 'pending_verify'
    where payment_order_id = v_order.id
      and status = 'pending_payment';

  get diagnostics v_registration_count = row_count;

  if v_registration_count = 0 then
    raise exception 'Payment order has no pending registrations';
  end if;

  return jsonb_build_object(
    'paymentOrderId', v_order.id,
    'status', v_order.status,
    'slipStoragePath', v_order.slip_storage_path,
    'paidAt', v_order.paid_at,
    'submittedAt', v_order.submitted_at,
    'updatedRegistrations', v_registration_count
  );
end;
$$;

revoke execute on function public.submit_payment_slip(uuid, uuid, text, text, timestamptz) from public;
revoke execute on function public.submit_payment_slip(uuid, uuid, text, text, timestamptz) from anon;
revoke execute on function public.submit_payment_slip(uuid, uuid, text, text, timestamptz) from authenticated;
grant execute on function public.submit_payment_slip(uuid, uuid, text, text, timestamptz) to service_role;
