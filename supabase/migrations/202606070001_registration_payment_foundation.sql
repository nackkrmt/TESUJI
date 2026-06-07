create table if not exists public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  status text not null default 'pending_payment' check (
    status in ('pending_payment', 'pending_verify', 'confirmed', 'rejected', 'cancelled', 'expired')
  ),
  currency text not null default 'THB' check (currency = 'THB'),
  total_fee_amount numeric(10,2) not null default 0 check (total_fee_amount >= 0),
  discount_amount numeric(10,2) not null default 0 check (discount_amount >= 0),
  amount_due numeric(10,2) generated always as (total_fee_amount - discount_amount) stored,
  promptpay_id text,
  promptpay_name text,
  slip_url text,
  slip_storage_path text,
  paid_at timestamptz,
  submitted_at timestamptz,
  verified_by uuid references public.accounts(id) on delete set null,
  verified_at timestamptz,
  rejected_by uuid references public.accounts(id) on delete set null,
  rejected_at timestamptz,
  rejection_reason text,
  expires_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_orders_discount_not_over_total check (discount_amount <= total_fee_amount)
);

create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  division_id uuid not null references public.divisions(id) on delete cascade,
  player_profile_id uuid not null references public.player_profiles(id) on delete cascade,
  registered_by_account_id uuid not null references public.accounts(id) on delete cascade,
  payment_order_id uuid references public.payment_orders(id) on delete set null,
  status text not null default 'pending_payment' check (
    status in ('pending_payment', 'pending_verify', 'confirmed', 'waiting_list', 'cancelled', 'expired', 'rejected')
  ),
  source text not null default 'self' check (source in ('self', 'coach', 'admin')),
  fee_amount numeric(10,2) not null default 0 check (fee_amount >= 0),
  discount_amount numeric(10,2) not null default 0 check (discount_amount >= 0),
  final_fee_amount numeric(10,2) generated always as (fee_amount - discount_amount) stored,
  waiting_list_position integer check (waiting_list_position is null or waiting_list_position > 0),
  confirmed_at timestamptz,
  cancelled_by uuid references public.accounts(id) on delete set null,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint registrations_discount_not_over_fee check (discount_amount <= fee_amount)
);

create table if not exists public.promo_code_usages (
  id uuid primary key default gen_random_uuid(),
  promo_code_id uuid not null references public.promo_codes(id) on delete cascade,
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  division_id uuid not null references public.divisions(id) on delete cascade,
  registration_id uuid not null references public.registrations(id) on delete cascade,
  payment_order_id uuid references public.payment_orders(id) on delete set null,
  account_id uuid not null references public.accounts(id) on delete cascade,
  player_profile_id uuid not null references public.player_profiles(id) on delete cascade,
  code text not null,
  code_normalized text generated always as (upper(regexp_replace(code, '\s+', '', 'g'))) stored,
  discount_type text not null check (discount_type in ('free', 'percentage', 'fixed')),
  discount_value numeric(10,2) not null default 0 check (discount_value >= 0),
  discount_amount numeric(10,2) not null default 0 check (discount_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(registration_id),
  constraint promo_code_usages_discount_check check (
    (discount_type = 'free' and discount_value = 0)
    or (discount_type = 'percentage' and discount_value > 0 and discount_value <= 100)
    or (discount_type = 'fixed' and discount_value > 0)
  )
);

create index if not exists idx_payment_orders_account_status
  on public.payment_orders(account_id, status, created_at desc);

create index if not exists idx_payment_orders_tournament_status
  on public.payment_orders(tournament_id, status, created_at desc);

create index if not exists idx_payment_orders_pending_expiry
  on public.payment_orders(expires_at)
  where status = 'pending_payment';

create index if not exists idx_registrations_tournament_division
  on public.registrations(tournament_id, division_id, status);

create index if not exists idx_registrations_player_status
  on public.registrations(player_profile_id, status, created_at desc);

create index if not exists idx_registrations_registered_by
  on public.registrations(registered_by_account_id, created_at desc);

create index if not exists idx_registrations_payment_order
  on public.registrations(payment_order_id)
  where payment_order_id is not null;

create unique index if not exists idx_registrations_one_active_attempt_per_division
  on public.registrations(division_id, player_profile_id)
  where status not in ('cancelled', 'expired', 'rejected');

create index if not exists idx_promo_code_usages_promo_code
  on public.promo_code_usages(promo_code_id, created_at desc);

create index if not exists idx_promo_code_usages_payment_order
  on public.promo_code_usages(payment_order_id)
  where payment_order_id is not null;

create index if not exists idx_promo_code_usages_account
  on public.promo_code_usages(account_id, created_at desc);

drop trigger if exists touch_payment_orders_updated_at on public.payment_orders;
create trigger touch_payment_orders_updated_at
  before update on public.payment_orders
  for each row
  execute function public.touch_updated_at();

drop trigger if exists touch_registrations_updated_at on public.registrations;
create trigger touch_registrations_updated_at
  before update on public.registrations
  for each row
  execute function public.touch_updated_at();

drop trigger if exists touch_promo_code_usages_updated_at on public.promo_code_usages;
create trigger touch_promo_code_usages_updated_at
  before update on public.promo_code_usages
  for each row
  execute function public.touch_updated_at();

alter table public.payment_orders enable row level security;
alter table public.registrations enable row level security;
alter table public.promo_code_usages enable row level security;

drop policy if exists "payment_orders_select_related_or_admin" on public.payment_orders;
create policy "payment_orders_select_related_or_admin"
  on public.payment_orders
  for select
  to authenticated
  using (
    account_id = auth.uid()
    or public.current_account_has_role('admin')
    or exists (
      select 1
      from public.registrations r
      join public.player_profiles pp on pp.id = r.player_profile_id
      where r.payment_order_id = payment_orders.id
        and (
          r.registered_by_account_id = auth.uid()
          or pp.account_id = auth.uid()
          or (
            public.current_account_has_role('coach')
            and exists (
              select 1
              from public.coach_player_links cpl
              where cpl.coach_account_id = auth.uid()
                and cpl.player_profile_id = r.player_profile_id
                and cpl.status = 'approved'
            )
          )
        )
    )
  );

drop policy if exists "registrations_select_related_or_admin" on public.registrations;
create policy "registrations_select_related_or_admin"
  on public.registrations
  for select
  to authenticated
  using (
    registered_by_account_id = auth.uid()
    or public.current_account_has_role('admin')
    or exists (
      select 1
      from public.player_profiles pp
      where pp.id = registrations.player_profile_id
        and pp.account_id = auth.uid()
    )
    or (
      public.current_account_has_role('coach')
      and exists (
        select 1
        from public.coach_player_links cpl
        where cpl.coach_account_id = auth.uid()
          and cpl.player_profile_id = registrations.player_profile_id
          and cpl.status = 'approved'
      )
    )
  );

drop policy if exists "promo_code_usages_select_related_or_admin" on public.promo_code_usages;
create policy "promo_code_usages_select_related_or_admin"
  on public.promo_code_usages
  for select
  to authenticated
  using (
    account_id = auth.uid()
    or public.current_account_has_role('admin')
    or exists (
      select 1
      from public.registrations r
      join public.player_profiles pp on pp.id = r.player_profile_id
      where r.id = promo_code_usages.registration_id
        and (
          r.registered_by_account_id = auth.uid()
          or pp.account_id = auth.uid()
          or (
            public.current_account_has_role('coach')
            and exists (
              select 1
              from public.coach_player_links cpl
              where cpl.coach_account_id = auth.uid()
                and cpl.player_profile_id = r.player_profile_id
                and cpl.status = 'approved'
            )
          )
        )
    )
  );

create or replace view public.division_registration_summary as
select
  d.id as division_id,
  d.tournament_id,
  (count(r.id) filter (
    where r.status in ('pending_payment', 'pending_verify', 'confirmed')
  ))::integer as reserved_registration_count,
  (count(r.id) filter (where r.status = 'confirmed'))::integer as confirmed_registration_count,
  (count(r.id) filter (where r.status = 'waiting_list'))::integer as waiting_list_count,
  case
    when d.max_players is null then null
    else greatest(
      d.max_players - (count(r.id) filter (
        where r.status in ('pending_payment', 'pending_verify', 'confirmed')
      ))::integer,
      0
    )
  end as available_slots
from public.divisions d
join public.tournaments t on t.id = d.tournament_id
left join public.registrations r
  on r.division_id = d.id
 and r.status not in ('cancelled', 'expired', 'rejected')
where t.status <> 'draft'
group by d.id, d.tournament_id, d.max_players;

comment on view public.division_registration_summary is
  'Public-safe aggregate registration counts for published tournaments.';

grant select on public.payment_orders to authenticated;
grant select on public.registrations to authenticated;
grant select on public.promo_code_usages to authenticated;
grant select, insert, update, delete on public.payment_orders to service_role;
grant select, insert, update, delete on public.registrations to service_role;
grant select, insert, update, delete on public.promo_code_usages to service_role;
grant select on public.division_registration_summary to anon, authenticated, service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'slips',
  'slips',
  false,
  10485760,
  array['image/jpeg', 'image/png']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "slips_select_related_or_admin" on storage.objects;
create policy "slips_select_related_or_admin"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'slips'
    and (
      owner = auth.uid()
      or public.current_account_has_role('admin')
      or exists (
        select 1
        from public.payment_orders po
        where po.slip_storage_path = storage.objects.name
          and (
            po.account_id = auth.uid()
            or exists (
              select 1
              from public.registrations r
              join public.player_profiles pp on pp.id = r.player_profile_id
              where r.payment_order_id = po.id
                and (
                  r.registered_by_account_id = auth.uid()
                  or pp.account_id = auth.uid()
                  or (
                    public.current_account_has_role('coach')
                    and exists (
                      select 1
                      from public.coach_player_links cpl
                      where cpl.coach_account_id = auth.uid()
                        and cpl.player_profile_id = r.player_profile_id
                        and cpl.status = 'approved'
                    )
                  )
                )
            )
          )
      )
    )
  );

drop policy if exists "slips_insert_own_or_admin" on storage.objects;
create policy "slips_insert_own_or_admin"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'slips'
    and (owner = auth.uid() or public.current_account_has_role('admin'))
  );

drop policy if exists "slips_update_own_or_admin" on storage.objects;
create policy "slips_update_own_or_admin"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'slips'
    and (owner = auth.uid() or public.current_account_has_role('admin'))
  )
  with check (
    bucket_id = 'slips'
    and (owner = auth.uid() or public.current_account_has_role('admin'))
  );

drop policy if exists "slips_delete_own_or_admin" on storage.objects;
create policy "slips_delete_own_or_admin"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'slips'
    and (owner = auth.uid() or public.current_account_has_role('admin'))
  );
