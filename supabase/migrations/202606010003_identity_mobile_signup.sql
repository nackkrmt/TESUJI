create extension if not exists pgcrypto;

create table if not exists public.accounts (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  phone text not null,
  active_role text not null default 'player' check (active_role in ('player', 'coach', 'referee', 'admin')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

create table if not exists public.account_roles (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  role text not null check (role in ('player', 'coach', 'referee', 'admin')),
  status text not null default 'active' check (status in ('active', 'suspended', 'revoked')),
  granted_by uuid references public.accounts(id),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique(account_id, role)
);

create table if not exists public.role_requests (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  requested_role text not null check (requested_role in ('coach')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  reason text,
  reviewed_by uuid references public.accounts(id),
  reviewed_at timestamptz,
  admin_note text,
  created_at timestamptz not null default now(),
  unique(account_id, requested_role)
);

create table if not exists public.player_profiles (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  title_th text not null,
  title_en text not null,
  first_name_th text not null,
  middle_name_th text,
  last_name_th text not null,
  first_name_en text not null,
  middle_name_en text,
  last_name_en text not null,
  gender text not null check (gender in ('male', 'female', 'unspecified')),
  date_of_birth date not null,
  identity_document_type text not null check (identity_document_type in ('national_id', 'passport')),
  identity_document_hash text unique not null,
  nationality text not null default 'Thai',
  institute_name text,
  phone text not null,
  rank text not null,
  rank_status text not null default 'pending' check (rank_status in ('verified', 'pending')),
  power_level integer not null,
  rating numeric,
  matched_go_player_id uuid references public.go_player_database(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(account_id)
);

create index if not exists idx_account_roles_account_status
  on public.account_roles(account_id, role, status);

create index if not exists idx_role_requests_status
  on public.role_requests(status, requested_role);

create index if not exists idx_player_profiles_account
  on public.player_profiles(account_id);

create index if not exists idx_player_profiles_rank_status
  on public.player_profiles(rank_status);

create or replace function public.current_account_has_role(p_role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.account_roles ar
    where ar.account_id = auth.uid()
      and ar.role = p_role
      and ar.status = 'active'
  );
$$;

revoke all on function public.current_account_has_role(text) from public;
grant execute on function public.current_account_has_role(text) to authenticated;

alter table public.accounts enable row level security;
alter table public.account_roles enable row level security;
alter table public.role_requests enable row level security;
alter table public.player_profiles enable row level security;

drop policy if exists "accounts_select_own_or_admin" on public.accounts;
create policy "accounts_select_own_or_admin"
  on public.accounts
  for select
  using (id = auth.uid() or public.current_account_has_role('admin'));

drop policy if exists "accounts_update_own_contact" on public.accounts;
create policy "accounts_update_own_contact"
  on public.accounts
  for update
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "account_roles_select_own_or_admin" on public.account_roles;
create policy "account_roles_select_own_or_admin"
  on public.account_roles
  for select
  using (account_id = auth.uid() or public.current_account_has_role('admin'));

drop policy if exists "role_requests_select_own_or_admin" on public.role_requests;
create policy "role_requests_select_own_or_admin"
  on public.role_requests
  for select
  using (account_id = auth.uid() or public.current_account_has_role('admin'));

drop policy if exists "role_requests_insert_own" on public.role_requests;
create policy "role_requests_insert_own"
  on public.role_requests
  for insert
  with check (account_id = auth.uid());

drop policy if exists "player_profiles_select_own_or_admin" on public.player_profiles;
create policy "player_profiles_select_own_or_admin"
  on public.player_profiles
  for select
  using (account_id = auth.uid() or public.current_account_has_role('admin'));

drop policy if exists "player_profiles_update_own" on public.player_profiles;
create policy "player_profiles_update_own"
  on public.player_profiles
  for update
  using (account_id = auth.uid())
  with check (account_id = auth.uid());

grant select, update on public.accounts to authenticated;
grant select on public.account_roles to authenticated;
grant select, insert on public.role_requests to authenticated;
grant select, update on public.player_profiles to authenticated;

create or replace function public.complete_account_signup(
  p_account_id uuid,
  p_email text,
  p_phone text,
  p_signup_role text,
  p_title_th text,
  p_title_en text,
  p_first_name_th text,
  p_middle_name_th text,
  p_last_name_th text,
  p_first_name_en text,
  p_middle_name_en text,
  p_last_name_en text,
  p_gender text,
  p_date_of_birth date,
  p_identity_document_type text,
  p_identity_document_hash text,
  p_nationality text,
  p_institute_name text,
  p_rank text,
  p_rank_status text,
  p_power_level integer,
  p_rating numeric,
  p_matched_go_player_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_role_request_id uuid;
begin
  if p_signup_role not in ('player', 'coach') then
    raise exception 'Invalid signup role: %', p_signup_role;
  end if;

  if p_rank_status not in ('verified', 'pending') then
    raise exception 'Invalid rank status: %', p_rank_status;
  end if;

  insert into public.accounts (
    id,
    email,
    phone,
    active_role
  )
  values (
    p_account_id,
    lower(trim(p_email)),
    trim(p_phone),
    'player'
  );

  insert into public.account_roles (
    account_id,
    role,
    status
  )
  values (
    p_account_id,
    'player',
    'active'
  )
  on conflict (account_id, role) do update
  set status = 'active',
      revoked_at = null,
      granted_at = now();

  insert into public.player_profiles (
    account_id,
    title_th,
    title_en,
    first_name_th,
    middle_name_th,
    last_name_th,
    first_name_en,
    middle_name_en,
    last_name_en,
    gender,
    date_of_birth,
    identity_document_type,
    identity_document_hash,
    nationality,
    institute_name,
    phone,
    rank,
    rank_status,
    power_level,
    rating,
    matched_go_player_id
  )
  values (
    p_account_id,
    trim(p_title_th),
    trim(p_title_en),
    trim(p_first_name_th),
    nullif(trim(coalesce(p_middle_name_th, '')), ''),
    trim(p_last_name_th),
    trim(p_first_name_en),
    nullif(trim(coalesce(p_middle_name_en, '')), ''),
    trim(p_last_name_en),
    p_gender,
    p_date_of_birth,
    p_identity_document_type,
    p_identity_document_hash,
    nullif(trim(coalesce(p_nationality, '')), ''),
    nullif(trim(coalesce(p_institute_name, '')), ''),
    trim(p_phone),
    p_rank,
    p_rank_status,
    p_power_level,
    p_rating,
    p_matched_go_player_id
  )
  returning id into v_profile_id;

  if p_signup_role = 'coach' then
    insert into public.role_requests (
      account_id,
      requested_role,
      status,
      reason
    )
    values (
      p_account_id,
      'coach',
      'pending',
      'สมัครเป็น Coach ในขั้นตอนสมัครสมาชิก'
    )
    on conflict (account_id, requested_role) do update
    set status = 'pending',
        reason = excluded.reason,
        reviewed_by = null,
        reviewed_at = null,
        admin_note = null,
        created_at = now()
    returning id into v_role_request_id;
  end if;

  return jsonb_build_object(
    'account_id', p_account_id,
    'player_profile_id', v_profile_id,
    'coach_request_id', v_role_request_id
  );
end;
$$;

revoke all on function public.complete_account_signup(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  date,
  text,
  text,
  text,
  text,
  text,
  text,
  integer,
  numeric,
  uuid
) from public;

revoke all on function public.complete_account_signup(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  date,
  text,
  text,
  text,
  text,
  text,
  text,
  integer,
  numeric,
  uuid
) from anon;

revoke all on function public.complete_account_signup(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  date,
  text,
  text,
  text,
  text,
  text,
  text,
  integer,
  numeric,
  uuid
) from authenticated;

grant execute on function public.complete_account_signup(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  date,
  text,
  text,
  text,
  text,
  text,
  text,
  integer,
  numeric,
  uuid
) to service_role;

drop function if exists public.search_go_player_database(text, text, text[], integer);

create function public.search_go_player_database(
  p_first_name_th text,
  p_last_name_th text,
  p_sources text[] default array['dan', 'kyu', 'award'],
  p_limit integer default 5
)
returns table (
  id uuid,
  source text,
  first_name_th text,
  last_name_th text,
  rank text,
  power_level integer,
  rating numeric,
  match_type text,
  similarity_score real,
  year_promoted integer,
  diamond text,
  category text,
  rank_in_category text,
  rank_award integer,
  event_name text,
  event_date text,
  raw_data jsonb
)
language sql
stable
as $$
  with input as (
    select
      trim(coalesce(p_first_name_th, '')) as first_name,
      trim(coalesce(p_last_name_th, '')) as last_name,
      public.normalize_thai_name(p_first_name_th) as first_name_norm,
      public.normalize_thai_name(p_last_name_th) as last_name_norm,
      public.normalize_thai_name(p_first_name_th || ' ' || p_last_name_th) as full_name_norm
  ),
  candidates as (
    select
      g.id,
      g.source,
      g.first_name_th,
      g.last_name_th,
      g.rank,
      g.power_level,
      g.rating,
      case
        when g.first_name_th = input.first_name and g.last_name_th = input.last_name then 'exact'
        when g.first_name_th_normalized = input.first_name_norm
          and g.last_name_th_normalized = input.last_name_norm then 'normalized'
        else 'fuzzy'
      end as match_type,
      greatest(
        similarity(g.first_name_th_normalized || ' ' || g.last_name_th_normalized, input.full_name_norm),
        similarity(g.first_name_th || ' ' || g.last_name_th, input.first_name || ' ' || input.last_name)
      ) as similarity_score,
      g.year_promoted,
      g.diamond,
      g.category,
      g.rank_in_category,
      g.rank_award,
      g.event_name,
      g.event_date,
      g.raw_data
    from public.go_player_database g
    cross join input
    where g.source = any(p_sources)
      and (
        (g.first_name_th = input.first_name and g.last_name_th = input.last_name)
        or (
          g.first_name_th_normalized = input.first_name_norm
          and g.last_name_th_normalized = input.last_name_norm
        )
        or similarity(g.first_name_th_normalized || ' ' || g.last_name_th_normalized, input.full_name_norm) > 0.4
      )
  )
  select *
  from candidates
  order by
    case match_type
      when 'exact' then 1
      when 'normalized' then 2
      else 3
    end,
    similarity_score desc,
    power_level desc
  limit greatest(1, p_limit);
$$;
