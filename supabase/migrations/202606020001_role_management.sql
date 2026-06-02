create table if not exists public.referee_invite_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text unique not null,
  status text not null default 'unused' check (status in ('unused', 'redeemed', 'expired', 'revoked')),
  expires_at timestamptz not null,
  created_by uuid references public.accounts(id) on delete set null,
  redeemed_by uuid references public.accounts(id) on delete set null,
  redeemed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_referee_invite_codes_status
  on public.referee_invite_codes(status, expires_at);

alter table public.referee_invite_codes enable row level security;

drop policy if exists "referee_invite_codes_admin_select" on public.referee_invite_codes;
create policy "referee_invite_codes_admin_select"
  on public.referee_invite_codes
  for select
  using (public.current_account_has_role('admin'));

create or replace function public.review_coach_request(
  p_request_id uuid,
  p_decision text,
  p_admin_note text default null,
  p_reviewed_by uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request record;
begin
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Invalid coach request decision';
  end if;

  select *
    into v_request
    from public.role_requests
    where id = p_request_id
      and requested_role = 'coach'
    for update;

  if not found then
    raise exception 'Coach request not found';
  end if;

  if v_request.status <> 'pending' then
    raise exception 'Coach request is already %', v_request.status;
  end if;

  update public.role_requests
    set status = p_decision,
        reviewed_by = p_reviewed_by,
        reviewed_at = now(),
        admin_note = nullif(trim(coalesce(p_admin_note, '')), '')
    where id = p_request_id;

  if p_decision = 'approved' then
    insert into public.account_roles (
      account_id,
      role,
      status,
      granted_by,
      granted_at,
      revoked_at
    )
    values (
      v_request.account_id,
      'coach',
      'active',
      p_reviewed_by,
      now(),
      null
    )
    on conflict (account_id, role)
    do update set
      status = 'active',
      granted_by = excluded.granted_by,
      granted_at = excluded.granted_at,
      revoked_at = null;
  end if;
end;
$$;

create or replace function public.create_referee_invite(
  p_code_hash text,
  p_expires_at timestamptz,
  p_created_by uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite_id uuid;
begin
  if p_expires_at <= now() then
    raise exception 'Invite expiry must be in the future';
  end if;

  insert into public.referee_invite_codes (
    code_hash,
    expires_at,
    created_by
  )
  values (
    p_code_hash,
    p_expires_at,
    p_created_by
  )
  returning id into v_invite_id;

  return v_invite_id;
end;
$$;

create or replace function public.redeem_referee_invite(
  p_account_id uuid,
  p_code_hash text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite record;
begin
  select *
    into v_invite
    from public.referee_invite_codes
    where code_hash = p_code_hash
    for update;

  if not found then
    raise exception 'Invite code not found';
  end if;

  if v_invite.status <> 'unused' then
    raise exception 'Invite code is already %', v_invite.status;
  end if;

  if v_invite.expires_at <= now() then
    update public.referee_invite_codes
      set status = 'expired'
      where id = v_invite.id;
    raise exception 'Invite code has expired';
  end if;

  if not exists (select 1 from public.accounts where id = p_account_id and is_active = true) then
    raise exception 'Account not found';
  end if;

  update public.referee_invite_codes
    set status = 'redeemed',
        redeemed_by = p_account_id,
        redeemed_at = now()
    where id = v_invite.id;

  insert into public.account_roles (
    account_id,
    role,
    status,
    granted_at,
    revoked_at
  )
  values (
    p_account_id,
    'referee',
    'active',
    now(),
    null
  )
  on conflict (account_id, role)
  do update set
    status = 'active',
    granted_at = excluded.granted_at,
    revoked_at = null;
end;
$$;

revoke all on function public.review_coach_request(uuid, text, text, uuid) from public, anon, authenticated;
revoke all on function public.create_referee_invite(text, timestamptz, uuid) from public, anon, authenticated;
revoke all on function public.redeem_referee_invite(uuid, text) from public, anon, authenticated;
