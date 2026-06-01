-- PDPA consent for player profiles.
-- Stores whether the user agreed to processing of personal data (incl. national ID)
-- and when. Consent is required to complete signup.

alter table public.player_profiles
  add column if not exists pdpa_consent boolean not null default false,
  add column if not exists pdpa_consent_at timestamptz;

-- Replace complete_account_signup with a version that records PDPA consent.
-- The signature changes (extra p_pdpa_consent arg), so drop the old one first.
drop function if exists public.complete_account_signup(
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
);

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
  p_matched_go_player_id uuid,
  p_pdpa_consent boolean default false
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

  if not p_pdpa_consent then
    raise exception 'PDPA consent required';
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
    matched_go_player_id,
    pdpa_consent,
    pdpa_consent_at
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
    p_matched_go_player_id,
    p_pdpa_consent,
    case when p_pdpa_consent then now() else null end
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
  uuid,
  boolean
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
  uuid,
  boolean
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
  uuid,
  boolean
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
  uuid,
  boolean
) to service_role;
