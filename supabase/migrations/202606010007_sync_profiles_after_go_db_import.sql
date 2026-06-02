create or replace function public.sync_verified_player_profiles_from_go_database()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated_count integer;
begin
  with best_matches as (
    select distinct on (p.id)
      p.id as profile_id,
      g.id as go_player_id,
      g.rank,
      g.power_level,
      g.rating
    from public.player_profiles p
    join public.go_player_database g
      on g.first_name_th_normalized = public.normalize_thai_name(p.first_name_th)
      and g.last_name_th_normalized = public.normalize_thai_name(p.last_name_th)
    where p.rank_status = 'verified'
      and g.rank is not null
    order by
      p.id,
      case g.source
        when 'dan' then 1
        else 2
      end,
      g.power_level desc,
      g.rating desc nulls last,
      g.uploaded_at desc,
      g.id
  )
  update public.player_profiles p
  set rank = best_matches.rank,
      power_level = best_matches.power_level,
      rating = best_matches.rating,
      matched_go_player_id = best_matches.go_player_id,
      rank_status = 'verified'
  from best_matches
  where p.id = best_matches.profile_id
    and (
      p.rank is distinct from best_matches.rank
      or p.power_level is distinct from best_matches.power_level
      or p.rating is distinct from best_matches.rating
      or p.matched_go_player_id is distinct from best_matches.go_player_id
      or p.rank_status is distinct from 'verified'
    );

  get diagnostics v_updated_count = row_count;

  return v_updated_count;
end;
$$;

revoke all on function public.sync_verified_player_profiles_from_go_database() from public;
revoke all on function public.sync_verified_player_profiles_from_go_database() from anon;
revoke all on function public.sync_verified_player_profiles_from_go_database() from authenticated;
grant execute on function public.sync_verified_player_profiles_from_go_database() to service_role;

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

  perform public.sync_verified_player_profiles_from_go_database();

  return v_imported_count;
end;
$$;

revoke all on function public.replace_go_player_database_source(text, jsonb) from public;
revoke all on function public.replace_go_player_database_source(text, jsonb) from anon;
revoke all on function public.replace_go_player_database_source(text, jsonb) from authenticated;
grant execute on function public.replace_go_player_database_source(text, jsonb) to service_role;
