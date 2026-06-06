import type { CurrentAccount } from "@/lib/auth/current-account";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AdminSupabaseClient = ReturnType<typeof createSupabaseAdminClient>;

export type CoachLinkStatus = "pending" | "approved" | "rejected" | "revoked";

export type CoachLinkPerson = {
  accountId: string;
  profileId: string | null;
  email: string;
  nameTh: string;
  nameEn: string;
  rank: string | null;
  rankStatus: "verified" | "pending" | null;
  instituteName: string | null;
};

export type CoachPlayerLinkView = {
  id: string;
  status: CoachLinkStatus;
  requestedAt: string;
  respondedAt: string | null;
  revokedAt: string | null;
  coach: CoachLinkPerson | null;
  player: CoachLinkPerson | null;
};

export type CoachLinkDashboard = {
  incomingLinks: CoachPlayerLinkView[];
  coachLinks: CoachPlayerLinkView[];
};

type LinkRow = {
  id: string;
  coach_account_id: string;
  player_profile_id: string;
  status: CoachLinkStatus;
  requested_at: string;
  responded_at: string | null;
  revoked_at: string | null;
};

type AccountRow = {
  id: string;
  email: string;
};

type ProfileRow = {
  id: string;
  account_id: string;
  first_name_th: string;
  last_name_th: string;
  first_name_en: string;
  last_name_en: string;
  rank: string;
  rank_status: "verified" | "pending";
  institute_name: string | null;
};

export async function getCoachLinkDashboard(
  account: CurrentAccount,
): Promise<CoachLinkDashboard> {
  if (!account.profile) {
    return {
      incomingLinks: [],
      coachLinks: [],
    };
  }

  const supabase = createSupabaseAdminClient();
  const isActiveCoach = account.roles.some(
    (role) => role.role === "coach" && role.status === "active",
  );

  const [{ data: incomingLinks, error: incomingError }, { data: coachLinks, error: coachError }] =
    await Promise.all([
      supabase
        .from("coach_player_links")
        .select("id,coach_account_id,player_profile_id,status,requested_at,responded_at,revoked_at")
        .eq("player_profile_id", account.profile.id)
        .order("requested_at", { ascending: false }),
      isActiveCoach
        ? supabase
            .from("coach_player_links")
            .select("id,coach_account_id,player_profile_id,status,requested_at,responded_at,revoked_at")
            .eq("coach_account_id", account.userId)
            .order("requested_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);

  if (incomingError) {
    throw incomingError;
  }

  if (coachError) {
    throw coachError;
  }

  const links = [
    ...((incomingLinks ?? []) as LinkRow[]),
    ...((coachLinks ?? []) as LinkRow[]),
  ];
  const accountIds = Array.from(new Set(links.map((link) => link.coach_account_id)));
  const profileIds = Array.from(new Set(links.map((link) => link.player_profile_id)));
  const playerProfileAccountIds = await getProfileAccountIds(supabase, profileIds);
  const allAccountIds = Array.from(new Set([...accountIds, ...playerProfileAccountIds]));
  const [accountsById, profilesByAccountId, profilesById] = await Promise.all([
    getAccountsById(supabase, allAccountIds),
    getProfilesByAccountId(supabase, allAccountIds),
    getProfilesById(supabase, profileIds),
  ]);

  return {
    incomingLinks: ((incomingLinks ?? []) as LinkRow[]).map((link) =>
      mapLink(link, accountsById, profilesByAccountId, profilesById),
    ),
    coachLinks: ((coachLinks ?? []) as LinkRow[]).map((link) =>
      mapLink(link, accountsById, profilesByAccountId, profilesById),
    ),
  };
}

async function getProfileAccountIds(supabase: AdminSupabaseClient, profileIds: string[]) {
  if (profileIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("player_profiles")
    .select("account_id")
    .in("id", profileIds);

  if (error) {
    throw error;
  }

  return ((data ?? []) as Array<{ account_id: string }>).map((profile) => profile.account_id);
}

async function getAccountsById(supabase: AdminSupabaseClient, accountIds: string[]) {
  if (accountIds.length === 0) {
    return new Map<string, AccountRow>();
  }

  const { data, error } = await supabase
    .from("accounts")
    .select("id,email")
    .in("id", accountIds);

  if (error) {
    throw error;
  }

  return new Map(((data ?? []) as AccountRow[]).map((account) => [account.id, account]));
}

async function getProfilesByAccountId(supabase: AdminSupabaseClient, accountIds: string[]) {
  if (accountIds.length === 0) {
    return new Map<string, ProfileRow>();
  }

  const { data, error } = await supabase
    .from("player_profiles")
    .select(
      "id,account_id,first_name_th,last_name_th,first_name_en,last_name_en,rank,rank_status,institute_name",
    )
    .in("account_id", accountIds);

  if (error) {
    throw error;
  }

  return new Map(((data ?? []) as ProfileRow[]).map((profile) => [profile.account_id, profile]));
}

async function getProfilesById(supabase: AdminSupabaseClient, profileIds: string[]) {
  if (profileIds.length === 0) {
    return new Map<string, ProfileRow>();
  }

  const { data, error } = await supabase
    .from("player_profiles")
    .select(
      "id,account_id,first_name_th,last_name_th,first_name_en,last_name_en,rank,rank_status,institute_name",
    )
    .in("id", profileIds);

  if (error) {
    throw error;
  }

  return new Map(((data ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]));
}

function mapLink(
  link: LinkRow,
  accountsById: Map<string, AccountRow>,
  profilesByAccountId: Map<string, ProfileRow>,
  profilesById: Map<string, ProfileRow>,
): CoachPlayerLinkView {
  const playerProfile = profilesById.get(link.player_profile_id) ?? null;
  const playerAccount = playerProfile ? accountsById.get(playerProfile.account_id) ?? null : null;

  return {
    id: link.id,
    status: link.status,
    requestedAt: link.requested_at,
    respondedAt: link.responded_at,
    revokedAt: link.revoked_at,
    coach: toPerson(
      accountsById.get(link.coach_account_id) ?? null,
      profilesByAccountId.get(link.coach_account_id) ?? null,
    ),
    player: toPerson(playerAccount, playerProfile),
  };
}

function toPerson(account: AccountRow | null, profile: ProfileRow | null): CoachLinkPerson | null {
  if (!account && !profile) {
    return null;
  }

  return {
    accountId: account?.id ?? profile?.account_id ?? "",
    profileId: profile?.id ?? null,
    email: account?.email ?? "",
    nameTh: profile ? `${profile.first_name_th} ${profile.last_name_th}` : "Unknown",
    nameEn: profile ? `${profile.first_name_en} ${profile.last_name_en}` : "",
    rank: profile?.rank ?? null,
    rankStatus: profile?.rank_status ?? null,
    instituteName: profile?.institute_name ?? null,
  };
}
