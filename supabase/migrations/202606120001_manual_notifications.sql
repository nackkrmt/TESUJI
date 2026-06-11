create table if not exists public.manual_notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  link_url text check (
    link_url is null
    or (
      char_length(link_url) <= 2048
      and (
        link_url ~ '^/'
        or link_url ~* '^https?://'
      )
    )
  ),
  audience_type text not null check (
    audience_type in ('all_accounts', 'tournament_registrants', 'selected_accounts')
  ),
  tournament_id uuid references public.tournaments(id) on delete set null,
  created_by uuid references public.accounts(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint manual_notifications_tournament_audience_check check (
    (audience_type = 'tournament_registrants' and tournament_id is not null)
    or (audience_type <> 'tournament_registrants' and tournament_id is null)
  )
);

create table if not exists public.manual_notification_recipients (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.manual_notifications(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  delivered_at timestamptz not null default now(),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique(notification_id, account_id)
);

create index if not exists idx_manual_notifications_created
  on public.manual_notifications(created_at desc);

create index if not exists idx_manual_notifications_tournament
  on public.manual_notifications(tournament_id)
  where tournament_id is not null;

create index if not exists idx_manual_notification_recipients_account_unread
  on public.manual_notification_recipients(account_id, read_at, delivered_at desc);

create index if not exists idx_manual_notification_recipients_notification
  on public.manual_notification_recipients(notification_id);

alter table public.manual_notifications enable row level security;
alter table public.manual_notification_recipients enable row level security;

drop policy if exists "manual_notifications_select_recipient_or_admin" on public.manual_notifications;
create policy "manual_notifications_select_recipient_or_admin"
  on public.manual_notifications
  for select
  to authenticated
  using (
    public.current_account_has_role('admin')
    or exists (
      select 1
      from public.manual_notification_recipients mnr
      where mnr.notification_id = manual_notifications.id
        and mnr.account_id = auth.uid()
    )
  );

drop policy if exists "manual_notification_recipients_select_own_or_admin" on public.manual_notification_recipients;
create policy "manual_notification_recipients_select_own_or_admin"
  on public.manual_notification_recipients
  for select
  to authenticated
  using (
    account_id = auth.uid()
    or public.current_account_has_role('admin')
  );

drop policy if exists "manual_notification_recipients_mark_own_read" on public.manual_notification_recipients;
create policy "manual_notification_recipients_mark_own_read"
  on public.manual_notification_recipients
  for update
  to authenticated
  using (account_id = auth.uid())
  with check (account_id = auth.uid());

create or replace function public.create_manual_notification(
  p_title text,
  p_body text,
  p_audience_type text,
  p_tournament_id uuid default null,
  p_account_ids uuid[] default null,
  p_link_url text default null,
  p_admin_account_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text := btrim(coalesce(p_title, ''));
  v_body text := btrim(coalesce(p_body, ''));
  v_link_url text := nullif(btrim(coalesce(p_link_url, '')), '');
  v_audience_type text := btrim(coalesce(p_audience_type, ''));
  v_notification_id uuid;
  v_recipient_count integer := 0;
  v_selected_count integer := 0;
begin
  if p_admin_account_id is not null and not exists (
    select 1
    from public.account_roles ar
    where ar.account_id = p_admin_account_id
      and ar.role = 'admin'
      and ar.status = 'active'
  ) then
    raise exception 'Admin account is not active';
  end if;

  if v_title = '' then
    raise exception 'Notification title is required';
  end if;

  if char_length(v_title) > 120 then
    raise exception 'Notification title is too long';
  end if;

  if v_body = '' then
    raise exception 'Notification body is required';
  end if;

  if char_length(v_body) > 2000 then
    raise exception 'Notification body is too long';
  end if;

  if v_link_url is not null and (
    char_length(v_link_url) > 2048
    or not (v_link_url ~ '^/' or v_link_url ~* '^https?://')
  ) then
    raise exception 'Notification link must be a relative URL or HTTP(S) URL';
  end if;

  if v_audience_type not in ('all_accounts', 'tournament_registrants', 'selected_accounts') then
    raise exception 'Invalid notification audience';
  end if;

  if v_audience_type = 'tournament_registrants' then
    if p_tournament_id is null then
      raise exception 'Tournament is required for tournament notification audience';
    end if;

    if not exists (select 1 from public.tournaments where id = p_tournament_id) then
      raise exception 'Tournament not found';
    end if;
  elsif p_tournament_id is not null then
    raise exception 'Tournament is only allowed for tournament notification audience';
  end if;

  if v_audience_type = 'selected_accounts' then
    select count(*)
      into v_selected_count
      from (
        select distinct unnest(coalesce(p_account_ids, array[]::uuid[])) as account_id
      ) selected_accounts;

    if v_selected_count = 0 then
      raise exception 'At least one account is required for selected notification audience';
    end if;
  end if;

  insert into public.manual_notifications (
    title,
    body,
    link_url,
    audience_type,
    tournament_id,
    created_by
  )
  values (
    v_title,
    v_body,
    v_link_url,
    v_audience_type,
    case when v_audience_type = 'tournament_registrants' then p_tournament_id else null end,
    p_admin_account_id
  )
  returning id into v_notification_id;

  if v_audience_type = 'all_accounts' then
    insert into public.manual_notification_recipients (
      notification_id,
      account_id
    )
    select v_notification_id, a.id
    from public.accounts a
    on conflict (notification_id, account_id) do nothing;
  elsif v_audience_type = 'tournament_registrants' then
    insert into public.manual_notification_recipients (
      notification_id,
      account_id
    )
    select distinct v_notification_id, recipient_account_id
    from (
      select pp.account_id as recipient_account_id
      from public.registrations r
      join public.player_profiles pp on pp.id = r.player_profile_id
      where r.tournament_id = p_tournament_id
        and r.status not in ('cancelled', 'expired', 'rejected')
      union
      select r.registered_by_account_id as recipient_account_id
      from public.registrations r
      where r.tournament_id = p_tournament_id
        and r.status not in ('cancelled', 'expired', 'rejected')
    ) recipients
    where recipient_account_id is not null
    on conflict (notification_id, account_id) do nothing;
  else
    insert into public.manual_notification_recipients (
      notification_id,
      account_id
    )
    select distinct v_notification_id, a.id
    from unnest(coalesce(p_account_ids, array[]::uuid[])) as selected_account_id
    join public.accounts a on a.id = selected_account_id
    on conflict (notification_id, account_id) do nothing;
  end if;

  get diagnostics v_recipient_count = row_count;

  if v_recipient_count = 0 then
    delete from public.manual_notifications
    where id = v_notification_id;

    raise exception 'Notification audience has no recipients';
  end if;

  return jsonb_build_object(
    'notificationId', v_notification_id,
    'audienceType', v_audience_type,
    'tournamentId', case when v_audience_type = 'tournament_registrants' then p_tournament_id else null end,
    'recipientCount', v_recipient_count,
    'createdBy', p_admin_account_id,
    'createdAt', now()
  );
end;
$$;

grant select on public.manual_notifications to authenticated;
grant select on public.manual_notification_recipients to authenticated;
grant update(read_at) on public.manual_notification_recipients to authenticated;
grant select, insert, update, delete on public.manual_notifications to service_role;
grant select, insert, update, delete on public.manual_notification_recipients to service_role;

revoke execute on function public.create_manual_notification(text, text, text, uuid, uuid[], text, uuid) from public;
revoke execute on function public.create_manual_notification(text, text, text, uuid, uuid[], text, uuid) from anon;
revoke execute on function public.create_manual_notification(text, text, text, uuid, uuid[], text, uuid) from authenticated;
grant execute on function public.create_manual_notification(text, text, text, uuid, uuid[], text, uuid) to service_role;
