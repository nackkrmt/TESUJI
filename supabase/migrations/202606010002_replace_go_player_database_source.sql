alter table public.go_player_database
  alter column rating type numeric using rating::numeric;

create or replace function public.replace_go_player_database_source(
  p_source text,
  p_rows jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_imported_count integer;
begin
  if p_source not in ('dan', 'kyu', 'award') then
    raise exception 'Invalid source: %', p_source;
  end if;

  if jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception 'Rows payload must be a JSON array';
  end if;

  delete from public.go_player_database
  where source = p_source;

  insert into public.go_player_database (
    source,
    seq,
    prefix_th,
    first_name_th,
    last_name_th,
    first_name_th_normalized,
    last_name_th_normalized,
    rank,
    power_level,
    rating,
    year_promoted,
    diamond,
    category,
    rank_in_category,
    rank_award,
    event_name,
    event_date,
    raw_data,
    uploaded_at
  )
  select
    p_source,
    row_data.seq,
    row_data.prefix_th,
    row_data.first_name_th,
    row_data.last_name_th,
    row_data.first_name_th_normalized,
    row_data.last_name_th_normalized,
    row_data.rank,
    row_data.power_level,
    row_data.rating,
    row_data.year_promoted,
    row_data.diamond,
    row_data.category,
    row_data.rank_in_category,
    row_data.rank_award,
    row_data.event_name,
    row_data.event_date,
    row_data.raw_data,
    now()
  from jsonb_to_recordset(p_rows) as row_data (
    seq text,
    prefix_th text,
    first_name_th text,
    last_name_th text,
    first_name_th_normalized text,
    last_name_th_normalized text,
    rank text,
    power_level integer,
    rating numeric,
    year_promoted integer,
    diamond text,
    category text,
    rank_in_category text,
    rank_award integer,
    event_name text,
    event_date text,
    raw_data jsonb
  )
  where row_data.first_name_th is not null
    and row_data.last_name_th is not null
    and row_data.first_name_th_normalized is not null
    and row_data.last_name_th_normalized is not null;

  get diagnostics v_imported_count = row_count;

  return v_imported_count;
end;
$$;

revoke all on function public.replace_go_player_database_source(text, jsonb) from public;
revoke all on function public.replace_go_player_database_source(text, jsonb) from anon;
revoke all on function public.replace_go_player_database_source(text, jsonb) from authenticated;
grant execute on function public.replace_go_player_database_source(text, jsonb) to service_role;
