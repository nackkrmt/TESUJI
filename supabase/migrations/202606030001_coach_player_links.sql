create table if not exists public.coach_player_links (
  id uuid primary key default gen_random_uuid(),
  coach_account_id uuid not null references public.accounts(id) on delete cascade,
  player_profile_id uuid not null references public.player_profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'revoked')),
  requested_at timestamptz not null default now(),
  responded_at timestamptz,
  revoked_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(coach_account_id, player_profile_id)
);

create index if not exists idx_coach_player_links_coach_status
  on public.coach_player_links(coach_account_id, status);

create index if not exists idx_coach_player_links_player_status
  on public.coach_player_links(player_profile_id, status);

alter table public.coach_player_links enable row level security;

drop policy if exists "coach_player_links_select_related_or_admin" on public.coach_player_links;
create policy "coach_player_links_select_related_or_admin"
  on public.coach_player_links
  for select
  using (
    coach_account_id = auth.uid()
    or exists (
      select 1
      from public.player_profiles pp
      where pp.id = player_profile_id
        and pp.account_id = auth.uid()
    )
    or public.current_account_has_role('admin')
  );

grant select on public.coach_player_links to authenticated;

create or replace function public.search_player_profiles_for_coach(
  p_coach_account_id uuid,
  p_query text,
  p_limit integer default 5
)
returns table (
  player_profile_id uuid,
  account_id uuid,
  name_th text,
  name_en text,
  rank text,
  rank_status text,
  institute_name text,
  existing_link_id uuid,
  existing_link_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_query text := trim(coalesce(p_query, ''));
  v_query_norm text := public.normalize_thai_name(trim(coalesce(p_query, '')));
  v_query_uuid uuid;
begin
  if length(v_query) < 2 then
    raise exception 'Search query must be at least 2 characters';
  end if;

  if not exists (
    select 1
    from public.account_roles ar
    join public.accounts a on a.id = ar.account_id
    where ar.account_id = p_coach_account_id
      and ar.role = 'coach'
      and ar.status = 'active'
      and a.is_active = true
  ) then
    raise exception 'Coach role is not active';
  end if;

  begin
    v_query_uuid := v_query::uuid;
  exception
    when invalid_text_representation then
      v_query_uuid := null;
  end;

  return query
  select
    pp.id as player_profile_id,
    pp.account_id,
    concat_ws(' ', pp.first_name_th, pp.last_name_th) as name_th,
    concat_ws(' ', pp.first_name_en, pp.last_name_en) as name_en,
    pp.rank,
    pp.rank_status,
    pp.institute_name,
    cpl.id as existing_link_id,
    cpl.status as existing_link_status
  from public.player_profiles pp
  join public.accounts a on a.id = pp.account_id
  left join public.coach_player_links cpl
    on cpl.coach_account_id = p_coach_account_id
   and cpl.player_profile_id = pp.id
  where a.is_active = true
    and pp.account_id <> p_coach_account_id
    and (
      pp.id = v_query_uuid
      or lower(a.email) = lower(v_query)
      or public.normalize_thai_name(concat_ws(' ', pp.first_name_th, pp.last_name_th)) like '%' || v_query_norm || '%'
      or lower(concat_ws(' ', pp.first_name_en, pp.last_name_en)) like '%' || lower(v_query) || '%'
    )
  order by
    case
      when pp.id = v_query_uuid then 1
      when lower(a.email) = lower(v_query) then 2
      else 3
    end,
    pp.created_at desc
  limit greatest(1, least(coalesce(p_limit, 5), 10));
end;
$$;

create or replace function public.request_coach_player_link(
  p_coach_account_id uuid,
  p_player_profile_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.coach_player_links%rowtype;
  v_link_id uuid;
begin
  if not exists (
    select 1
    from public.account_roles ar
    join public.accounts a on a.id = ar.account_id
    where ar.account_id = p_coach_account_id
      and ar.role = 'coach'
      and ar.status = 'active'
      and a.is_active = true
  ) then
    raise exception 'Coach role is not active';
  end if;

  if not exists (
    select 1
    from public.player_profiles pp
    join public.accounts a on a.id = pp.account_id
    where pp.id = p_player_profile_id
      and a.is_active = true
  ) then
    raise exception 'Player profile not found';
  end if;

  if exists (
    select 1
    from public.player_profiles pp
    where pp.id = p_player_profile_id
      and pp.account_id = p_coach_account_id
  ) then
    raise exception 'Coach cannot link to their own player profile';
  end if;

  select *
    into v_existing
    from public.coach_player_links
    where coach_account_id = p_coach_account_id
      and player_profile_id = p_player_profile_id
    for update;

  if found then
    if v_existing.status in ('pending', 'approved') then
      return v_existing.id;
    end if;

    update public.coach_player_links
      set status = 'pending',
          requested_at = now(),
          responded_at = null,
          revoked_at = null,
          updated_at = now()
      where id = v_existing.id
      returning id into v_link_id;

    return v_link_id;
  end if;

  insert into public.coach_player_links (
    coach_account_id,
    player_profile_id,
    status
  )
  values (
    p_coach_account_id,
    p_player_profile_id,
    'pending'
  )
  returning id into v_link_id;

  return v_link_id;
end;
$$;

create or replace function public.respond_coach_player_link(
  p_player_account_id uuid,
  p_link_id uuid,
  p_decision text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link record;
begin
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Invalid coach link decision';
  end if;

  select cpl.*
    into v_link
    from public.coach_player_links cpl
    join public.player_profiles pp on pp.id = cpl.player_profile_id
    where cpl.id = p_link_id
      and pp.account_id = p_player_account_id
    for update;

  if not found then
    raise exception 'Coach link request not found';
  end if;

  if v_link.status <> 'pending' then
    raise exception 'Coach link request is already %', v_link.status;
  end if;

  update public.coach_player_links
    set status = p_decision,
        responded_at = now(),
        updated_at = now()
    where id = p_link_id;
end;
$$;

revoke all on function public.search_player_profiles_for_coach(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.request_coach_player_link(uuid, uuid) from public, anon, authenticated;
revoke all on function public.respond_coach_player_link(uuid, uuid, text) from public, anon, authenticated;
