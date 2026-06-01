create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create table if not exists public.go_player_database (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('dan', 'kyu', 'award')),
  seq text,
  prefix_th text,
  first_name_th text not null,
  last_name_th text not null,
  first_name_th_normalized text not null,
  last_name_th_normalized text not null,
  rank text,
  power_level integer not null default 0,
  rating integer,
  year_promoted integer,
  diamond text,
  category text,
  rank_in_category text,
  rank_award integer,
  event_name text,
  event_date text,
  raw_data jsonb,
  uploaded_at timestamptz default now()
);

alter table public.go_player_database enable row level security;

drop policy if exists "go_player_database_read_all" on public.go_player_database;

create policy "go_player_database_read_all"
  on public.go_player_database
  for select
  using (true);

create index if not exists idx_go_player_database_source
  on public.go_player_database (source);

create index if not exists idx_go_player_database_first_name_trgm
  on public.go_player_database
  using gin (first_name_th gin_trgm_ops);

create index if not exists idx_go_player_database_last_name_trgm
  on public.go_player_database
  using gin (last_name_th gin_trgm_ops);

create index if not exists idx_go_player_database_first_name_norm
  on public.go_player_database (first_name_th_normalized);

create index if not exists idx_go_player_database_last_name_norm
  on public.go_player_database (last_name_th_normalized);

create or replace function public.normalize_thai_name(input text)
returns text
language sql
immutable
as $$
  select replace(
    translate(
      regexp_replace(trim(coalesce(input, '')), '\s+', ' ', 'g'),
      'ศษณญภฎฏฑใ',
      'สสนยพดตทไ'
    ),
    '์',
    ''
  );
$$;

create or replace function public.search_go_player_database(
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
  rating integer,
  match_type text,
  similarity_score real
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
      ) as similarity_score
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
