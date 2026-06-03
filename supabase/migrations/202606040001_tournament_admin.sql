create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  title_th text not null,
  title_en text,
  description text,
  venue_name text,
  venue_address text,
  registration_opens_at timestamptz,
  registration_closes_at timestamptz,
  event_starts_at timestamptz,
  event_ends_at timestamptz,
  status text not null default 'draft' check (status in ('draft', 'open', 'closed', 'in_progress', 'completed', 'cancelled')),
  promptpay_id text,
  promptpay_name text,
  banner_url text,
  banner_alt text,
  created_by uuid references public.accounts(id) on delete set null,
  updated_by uuid references public.accounts(id) on delete set null,
  published_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tournaments_registration_window_check check (
    registration_opens_at is null
    or registration_closes_at is null
    or registration_closes_at >= registration_opens_at
  ),
  constraint tournaments_event_window_check check (
    event_starts_at is null
    or event_ends_at is null
    or event_ends_at >= event_starts_at
  )
);

create table if not exists public.divisions (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  name text not null,
  description text,
  fee_amount numeric(10,2) not null default 0 check (fee_amount >= 0),
  max_players integer check (max_players is null or max_players > 0),
  min_power_level integer check (min_power_level is null or min_power_level >= 0),
  max_power_level integer check (max_power_level is null or max_power_level >= 0),
  min_age integer check (min_age is null or min_age >= 0),
  max_age integer check (max_age is null or max_age >= 0),
  time_slot_label text,
  starts_at timestamptz,
  ends_at timestamptz,
  pairing_method text not null default 'macmahon',
  status text not null default 'active' check (status in ('active', 'closed', 'cancelled')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint divisions_power_window_check check (
    min_power_level is null
    or max_power_level is null
    or max_power_level >= min_power_level
  ),
  constraint divisions_age_window_check check (
    min_age is null
    or max_age is null
    or max_age >= min_age
  ),
  constraint divisions_time_window_check check (
    starts_at is null
    or ends_at is null
    or ends_at >= starts_at
  )
);

create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  code text not null,
  code_normalized text generated always as (upper(regexp_replace(code, '\s+', '', 'g'))) stored,
  description text,
  discount_type text not null check (discount_type in ('free', 'percentage', 'fixed')),
  discount_value numeric(10,2) not null default 0 check (discount_value >= 0),
  usage_limit integer check (usage_limit is null or usage_limit > 0),
  used_count integer not null default 0 check (used_count >= 0),
  starts_at timestamptz,
  ends_at timestamptz,
  division_ids uuid[],
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tournament_id, code_normalized),
  constraint promo_codes_discount_check check (
    (discount_type = 'free' and discount_value = 0)
    or (discount_type = 'percentage' and discount_value > 0 and discount_value <= 100)
    or (discount_type = 'fixed' and discount_value > 0)
  ),
  constraint promo_codes_window_check check (
    starts_at is null
    or ends_at is null
    or ends_at >= starts_at
  )
);

create index if not exists idx_tournaments_status_dates
  on public.tournaments(status, registration_opens_at, event_starts_at);

create index if not exists idx_divisions_tournament_sort
  on public.divisions(tournament_id, sort_order, created_at);

create index if not exists idx_promo_codes_tournament_active
  on public.promo_codes(tournament_id, is_active);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_tournaments_updated_at on public.tournaments;
create trigger touch_tournaments_updated_at
  before update on public.tournaments
  for each row
  execute function public.touch_updated_at();

drop trigger if exists touch_divisions_updated_at on public.divisions;
create trigger touch_divisions_updated_at
  before update on public.divisions
  for each row
  execute function public.touch_updated_at();

drop trigger if exists touch_promo_codes_updated_at on public.promo_codes;
create trigger touch_promo_codes_updated_at
  before update on public.promo_codes
  for each row
  execute function public.touch_updated_at();

alter table public.tournaments enable row level security;
alter table public.divisions enable row level security;
alter table public.promo_codes enable row level security;

drop policy if exists "tournaments_public_read_published" on public.tournaments;
create policy "tournaments_public_read_published"
  on public.tournaments
  for select
  using (status <> 'draft');

drop policy if exists "divisions_public_read_published_tournament" on public.divisions;
create policy "divisions_public_read_published_tournament"
  on public.divisions
  for select
  using (
    exists (
      select 1
      from public.tournaments t
      where t.id = divisions.tournament_id
        and t.status <> 'draft'
    )
  );

drop policy if exists "promo_codes_admin_read_future_gate" on public.promo_codes;
create policy "promo_codes_admin_read_future_gate"
  on public.promo_codes
  for select
  using (public.current_account_has_role('admin'));

grant select on public.tournaments to anon, authenticated;
grant select on public.divisions to anon, authenticated;

-- Dev mode writes currently go through trusted server actions using the service role.
-- Future production Admin protection should use normal Supabase Auth plus account_roles.admin = active.
