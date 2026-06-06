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

  delete from public.school_database where true;

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
