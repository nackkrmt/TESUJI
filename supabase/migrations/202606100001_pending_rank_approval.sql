alter table public.player_profiles
  add column if not exists rank_reviewed_by uuid references public.accounts(id) on delete set null,
  add column if not exists rank_reviewed_at timestamptz,
  add column if not exists rank_review_original_rank text,
  add column if not exists rank_review_final_rank text,
  add column if not exists rank_review_note text;

create index if not exists idx_player_profiles_pending_rank_created
  on public.player_profiles(created_at asc)
  where rank_status = 'pending';

create or replace function public.rank_to_power_level(p_rank text)
returns integer
language plpgsql
immutable
set search_path = public
as $$
declare
  v_rank text := btrim(coalesce(p_rank, ''));
  v_match text[];
  v_number integer;
begin
  if v_rank = '9x9' then
    return 0;
  end if;

  if v_rank = '13x13' then
    return 1;
  end if;

  v_match := regexp_match(v_rank, '^([0-9]+)[[:space:]]*Kyu$', 'i');
  if v_match is not null then
    v_number := v_match[1]::integer;

    if v_number < 1 then
      return null;
    end if;

    if v_number >= 16 then
      v_number := 15;
    end if;

    return 17 - v_number;
  end if;

  v_match := regexp_match(v_rank, '^([0-9]+)[[:space:]]*Dan$', 'i');
  if v_match is not null then
    v_number := v_match[1]::integer;

    if v_number < 1 or v_number > 9 then
      return null;
    end if;

    return 16 + v_number;
  end if;

  return null;
end;
$$;

create or replace function public.approve_player_profile_rank(
  p_player_profile_id uuid,
  p_final_rank text default null,
  p_admin_account_id uuid default null,
  p_admin_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.player_profiles%rowtype;
  v_original_rank text;
  v_original_power_level integer;
  v_final_rank text := nullif(btrim(coalesce(p_final_rank, '')), '');
  v_final_power_level integer;
  v_note text := nullif(btrim(coalesce(p_admin_note, '')), '');
  v_now timestamptz := now();
begin
  if p_player_profile_id is null then
    raise exception 'Player profile is required';
  end if;

  if p_admin_account_id is not null and not exists (
    select 1
    from public.account_roles ar
    where ar.account_id = p_admin_account_id
      and ar.role = 'admin'
      and ar.status = 'active'
  ) then
    raise exception 'Admin account is not active';
  end if;

  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'Rank review note is too long';
  end if;

  select *
    into v_profile
    from public.player_profiles
    where id = p_player_profile_id
    for update;

  if not found then
    raise exception 'Player profile not found';
  end if;

  if v_profile.rank_status <> 'pending' then
    raise exception 'Player profile rank is not pending review';
  end if;

  v_original_rank := v_profile.rank;
  v_original_power_level := v_profile.power_level;
  v_final_rank := coalesce(v_final_rank, btrim(v_original_rank));
  v_final_power_level := public.rank_to_power_level(v_final_rank);

  if v_final_power_level is null then
    raise exception 'Invalid rank: %', v_final_rank;
  end if;

  update public.player_profiles
    set
      rank = v_final_rank,
      power_level = v_final_power_level,
      rank_status = 'verified',
      rank_reviewed_by = p_admin_account_id,
      rank_reviewed_at = v_now,
      rank_review_original_rank = v_original_rank,
      rank_review_final_rank = v_final_rank,
      rank_review_note = v_note
    where id = v_profile.id
    returning * into v_profile;

  return jsonb_build_object(
    'playerProfileId', v_profile.id,
    'accountId', v_profile.account_id,
    'rankStatus', v_profile.rank_status,
    'originalRank', v_original_rank,
    'originalPowerLevel', v_original_power_level,
    'finalRank', v_profile.rank,
    'finalPowerLevel', v_profile.power_level,
    'reviewedBy', v_profile.rank_reviewed_by,
    'reviewedAt', v_profile.rank_reviewed_at,
    'note', v_profile.rank_review_note
  );
end;
$$;

revoke all on function public.rank_to_power_level(text) from public;
revoke all on function public.rank_to_power_level(text) from anon;
revoke all on function public.rank_to_power_level(text) from authenticated;
grant execute on function public.rank_to_power_level(text) to service_role;

revoke all on function public.approve_player_profile_rank(uuid, text, uuid, text) from public;
revoke all on function public.approve_player_profile_rank(uuid, text, uuid, text) from anon;
revoke all on function public.approve_player_profile_rank(uuid, text, uuid, text) from authenticated;
grant execute on function public.approve_player_profile_rank(uuid, text, uuid, text) to service_role;
