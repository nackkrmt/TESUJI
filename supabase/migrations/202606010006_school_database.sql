create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create table if not exists public.school_database (
  id uuid primary key default gen_random_uuid(),
  seq text,
  name text not null,
  name_normalized text not null,
  keywords text[] not null default '{}'::text[],
  search_text text not null,
  search_text_normalized text not null,
  raw_data jsonb,
  uploaded_at timestamptz default now()
);

alter table public.school_database enable row level security;

drop policy if exists "school_database_read_all" on public.school_database;

create policy "school_database_read_all"
  on public.school_database
  for select
  using (true);

grant select on public.school_database to anon, authenticated, service_role;

create index if not exists idx_school_database_name_trgm
  on public.school_database
  using gin (name gin_trgm_ops);

create index if not exists idx_school_database_name_normalized
  on public.school_database (name_normalized);

create index if not exists idx_school_database_search_text_normalized_trgm
  on public.school_database
  using gin (search_text_normalized gin_trgm_ops);

create or replace function public.replace_school_database(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_imported_count integer;
begin
  if jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception 'Rows payload must be a JSON array';
  end if;

  delete from public.school_database;

  with input_rows as (
    select
      row_data.seq,
      nullif(trim(row_data.name), '') as name,
      coalesce(
        (
          select array_agg(deduped.keyword order by deduped.first_seen)
          from (
            select keyword, min(ord) as first_seen
            from (
              select nullif(trim(value), '') as keyword, ord
              from jsonb_array_elements_text(
                case
                  when jsonb_typeof(row_data.keywords) = 'array' then row_data.keywords
                  else '[]'::jsonb
                end
              ) with ordinality as keyword_values(value, ord)
            ) cleaned
            where keyword is not null
            group by keyword
          ) deduped
        ),
        '{}'::text[]
      ) as keywords,
      coalesce(row_data.raw_data, '{}'::jsonb) as raw_data
    from jsonb_to_recordset(p_rows) as row_data (
      seq text,
      name text,
      keywords jsonb,
      raw_data jsonb
    )
  ),
  prepared_rows as (
    select
      seq,
      name,
      lower(public.normalize_thai_name(name)) as name_normalized,
      keywords,
      trim(concat_ws(' ', name, array_to_string(keywords, ' '))) as search_text,
      lower(public.normalize_thai_name(trim(concat_ws(' ', name, array_to_string(keywords, ' '))))) as search_text_normalized,
      raw_data
    from input_rows
    where name is not null
  )
  insert into public.school_database (
    seq,
    name,
    name_normalized,
    keywords,
    search_text,
    search_text_normalized,
    raw_data,
    uploaded_at
  )
  select
    seq,
    name,
    name_normalized,
    keywords,
    search_text,
    search_text_normalized,
    raw_data,
    now()
  from prepared_rows;

  get diagnostics v_imported_count = row_count;

  return v_imported_count;
end;
$$;

revoke all on function public.replace_school_database(jsonb) from public;
revoke all on function public.replace_school_database(jsonb) from anon;
revoke all on function public.replace_school_database(jsonb) from authenticated;
grant execute on function public.replace_school_database(jsonb) to service_role;

create or replace function public.search_school_database(
  p_query text,
  p_limit integer default 8
)
returns table (
  id uuid,
  seq text,
  name text,
  keywords text[],
  match_type text,
  similarity_score real
)
language sql
stable
as $$
  with input as (
    select
      trim(coalesce(p_query, '')) as query,
      lower(public.normalize_thai_name(trim(coalesce(p_query, '')))) as query_normalized
  ),
  candidates as (
    select
      s.id,
      s.seq,
      s.name,
      s.keywords,
      case
        when lower(s.name) = lower(input.query)
          or s.name_normalized = input.query_normalized then 'exact'
        when lower(s.search_text) like '%' || lower(input.query) || '%'
          or s.search_text_normalized like '%' || input.query_normalized || '%' then 'keyword'
        else 'fuzzy'
      end as match_type,
      greatest(
        similarity(lower(s.name), lower(input.query)),
        similarity(s.name_normalized, input.query_normalized),
        similarity(s.search_text_normalized, input.query_normalized)
      ) as similarity_score
    from public.school_database s
    cross join input
    where input.query <> ''
      and (
        lower(s.search_text) like '%' || lower(input.query) || '%'
        or s.search_text_normalized like '%' || input.query_normalized || '%'
        or similarity(s.search_text_normalized, input.query_normalized) > 0.3
      )
  )
  select *
  from candidates
  order by
    case match_type
      when 'exact' then 1
      when 'keyword' then 2
      else 3
    end,
    similarity_score desc,
    name asc
  limit greatest(1, least(coalesce(p_limit, 8), 20));
$$;

grant execute on function public.search_school_database(text, integer) to anon, authenticated, service_role;
