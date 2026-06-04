do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tournaments'
      and column_name = 'title_th'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tournaments'
      and column_name = 'title'
  ) then
    alter table public.tournaments rename column title_th to title;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tournaments'
      and column_name = 'title'
  ) then
    alter table public.tournaments add column title text;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'tournaments'
        and column_name = 'title_th'
    ) then
      execute 'update public.tournaments set title = title_th where title is null';
    elsif exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'tournaments'
        and column_name = 'title_en'
    ) then
      execute 'update public.tournaments set title = coalesce(title_en, ''Untitled tournament'') where title is null';
    end if;
  end if;
end $$;

update public.tournaments
set title = coalesce(nullif(title, ''), 'Untitled tournament')
where title is null or title = '';

alter table public.tournaments
  alter column title set not null;

alter table public.tournaments
  add column if not exists google_maps_url text,
  add column if not exists event_date date;

update public.tournaments
set event_date = event_starts_at::date
where event_date is null
  and event_starts_at is not null;

alter table public.divisions
  alter column min_power_level drop not null,
  alter column max_power_level drop not null,
  alter column min_age drop not null,
  alter column max_age drop not null;

alter table public.divisions
  alter column time_slot_label type text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tournament-banners',
  'tournament-banners',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "tournament_banners_public_read" on storage.objects;
create policy "tournament_banners_public_read"
  on storage.objects
  for select
  using (bucket_id = 'tournament-banners');
