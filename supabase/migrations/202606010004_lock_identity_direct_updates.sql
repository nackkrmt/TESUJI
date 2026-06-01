drop policy if exists "accounts_update_own_contact" on public.accounts;
drop policy if exists "player_profiles_update_own" on public.player_profiles;

revoke update on public.accounts from authenticated;
revoke update on public.player_profiles from authenticated;
