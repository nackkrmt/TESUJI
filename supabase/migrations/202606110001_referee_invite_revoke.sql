alter table public.referee_invite_codes
  add column if not exists revoked_by uuid references public.accounts(id) on delete set null;

create index if not exists idx_referee_invite_codes_revoked_by
  on public.referee_invite_codes(revoked_by)
  where revoked_by is not null;

create or replace function public.revoke_referee_invite(
  p_invite_id uuid,
  p_admin_account_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.referee_invite_codes%rowtype;
  v_now timestamptz := now();
begin
  if p_invite_id is null then
    raise exception 'Invite id is required';
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
    into v_invite
    from public.referee_invite_codes
    where id = p_invite_id
    for update;

  if not found then
    raise exception 'Invite code not found';
  end if;

  if v_invite.status = 'redeemed' then
    raise exception 'Redeemed invite cannot be revoked';
  end if;

  if v_invite.status = 'revoked' then
    return jsonb_build_object(
      'inviteId', v_invite.id,
      'status', v_invite.status,
      'revokedAt', v_invite.revoked_at
    );
  end if;

  if v_invite.status = 'expired' or (v_invite.status = 'unused' and v_invite.expires_at <= v_now) then
    update public.referee_invite_codes
      set status = 'expired'
      where id = v_invite.id
      returning * into v_invite;

    raise exception 'Expired invite cannot be revoked';
  end if;

  if v_invite.status <> 'unused' then
    raise exception 'Invite code is already %', v_invite.status;
  end if;

  update public.referee_invite_codes
    set status = 'revoked',
        revoked_at = v_now,
        revoked_by = p_admin_account_id
    where id = v_invite.id
    returning * into v_invite;

  return jsonb_build_object(
    'inviteId', v_invite.id,
    'status', v_invite.status,
    'revokedAt', v_invite.revoked_at
  );
end;
$$;

revoke execute on function public.revoke_referee_invite(uuid, uuid) from public;
revoke execute on function public.revoke_referee_invite(uuid, uuid) from anon;
revoke execute on function public.revoke_referee_invite(uuid, uuid) from authenticated;
grant execute on function public.revoke_referee_invite(uuid, uuid) to service_role;

grant execute on function public.review_coach_request(uuid, text, text, uuid) to service_role;
grant execute on function public.create_referee_invite(text, timestamptz, uuid) to service_role;
grant execute on function public.redeem_referee_invite(uuid, text) to service_role;
