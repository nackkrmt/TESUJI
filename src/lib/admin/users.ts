import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type AdminUserRole = "player" | "coach" | "referee" | "admin";
export type AdminUserRoleStatus = "active" | "suspended" | "revoked";
export type AdminUserRequestStatus = "pending" | "approved" | "rejected" | "cancelled";
export type AdminCoachLinkStatus = "pending" | "approved" | "rejected" | "revoked";

export type AdminUserListInput = {
  limit?: number;
  query?: string | null;
  role?: AdminUserRole | "all" | null;
};

export type AdminUserListResult = {
  limit: number;
  query: string;
  role: AdminUserRole | "all";
  users: AdminUserListRow[];
};

export type AdminUserListRow = {
  id: string;
  email: string;
  phone: string;
  activeRole: AdminUserRole;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  roles: AdminUserRoleRow[];
  pendingRoleRequests: AdminUserRoleRequestRow[];
  profile: AdminUserProfileSummary | null;
  coachLinks: {
    asCoach: AdminCoachLinkCounts;
    asPlayer: AdminCoachLinkCounts;
  };
};

export type AdminUserRoleRow = {
  role: AdminUserRole;
  status: AdminUserRoleStatus;
  grantedAt: string;
  revokedAt: string | null;
};

export type AdminUserRoleRequestRow = {
  requestedRole: "coach";
  status: AdminUserRequestStatus;
  createdAt: string;
  reviewedAt: string | null;
};

export type AdminUserProfileSummary = {
  id: string;
  nameTh: string;
  nameEn: string;
  rank: string;
  rankStatus: "verified" | "pending";
  powerLevel: number;
  instituteName: string | null;
  createdAt: string;
};

export type AdminCoachLinkCounts = Record<AdminCoachLinkStatus, number> & {
  total: number;
};

type AccountRow = {
  id: string;
  email: string;
  phone: string;
  active_role: AdminUserRole;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
};

type RoleRow = {
  account_id: string;
  role: AdminUserRole;
  status: AdminUserRoleStatus;
  granted_at: string;
  revoked_at: string | null;
};

type RoleRequestRow = {
  account_id: string;
  requested_role: "coach";
  status: AdminUserRequestStatus;
  created_at: string;
  reviewed_at: string | null;
};

type ProfileRow = {
  id: string;
  account_id: string;
  first_name_th: string;
  middle_name_th: string | null;
  last_name_th: string;
  first_name_en: string;
  middle_name_en: string | null;
  last_name_en: string;
  rank: string;
  rank_status: "verified" | "pending";
  power_level: number;
  institute_name: string | null;
  created_at: string;
};

type CoachLinkRow = {
  coach_account_id: string;
  player_profile_id: string;
  status: AdminCoachLinkStatus;
};

type AdminSupabaseClient = ReturnType<typeof createSupabaseAdminClient>;

const adminUserRoleSchema = z.enum(["player", "coach", "referee", "admin"]);

const listInputSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  query: z.string().trim().max(120).optional().nullable(),
  role: z.union([adminUserRoleSchema, z.literal("all")]).optional().nullable().default("all"),
});

export async function getAdminUsers(input: AdminUserListInput = {}): Promise<AdminUserListResult> {
  ensureAdminUserReadAllowedForDevMode();

  const parsed = listInputSchema.parse(input);
  const query = parsed.query?.trim() ?? "";
  const role = parsed.role ?? "all";
  const supabase = createSupabaseAdminClient();
  const accountIds = await getFilteredAccountIds(supabase, {
    query,
    role,
  });

  if (accountIds && accountIds.length === 0) {
    return {
      limit: parsed.limit,
      query,
      role,
      users: [],
    };
  }

  const accounts = await fetchAccounts(supabase, {
    accountIds,
    limit: parsed.limit,
  });
  const users = await hydrateUsers(supabase, accounts);

  return {
    limit: parsed.limit,
    query,
    role,
    users,
  };
}

function ensureAdminUserReadAllowedForDevMode() {
  // Dev mode intentionally leaves Admin read pages reachable while Admin tools are built.
  // Future production auth should require the normal Supabase account to have account_roles.admin = active.
}

async function getFilteredAccountIds(
  supabase: AdminSupabaseClient,
  {
    query,
    role,
  }: {
    query: string;
    role: AdminUserRole | "all";
  },
) {
  const [queryIds, roleIds] = await Promise.all([
    query ? fetchSearchAccountIds(supabase, query) : Promise.resolve<string[] | null>(null),
    role === "all" ? Promise.resolve<string[] | null>(null) : fetchAccountIdsByRole(supabase, role),
  ]);

  if (!queryIds && !roleIds) {
    return null;
  }

  if (queryIds && roleIds) {
    const roleIdSet = new Set(roleIds);
    return queryIds.filter((id) => roleIdSet.has(id));
  }

  return queryIds ?? roleIds ?? null;
}

async function fetchAccounts(
  supabase: AdminSupabaseClient,
  {
    accountIds,
    limit,
  }: {
    accountIds: string[] | null;
    limit: number;
  },
) {
  let request = supabase
    .from("accounts")
    .select("id,email,phone,active_role,is_active,created_at,last_login_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (accountIds) {
    request = request.in("id", accountIds);
  }

  const { data, error } = await request;

  if (error) {
    throw error;
  }

  return (data ?? []) as AccountRow[];
}

async function fetchSearchAccountIds(supabase: AdminSupabaseClient, rawQuery: string) {
  const query = rawQuery.trim();
  const pattern = `%${query}%`;
  const accountIdSet = new Set<string>();
  const accountRequests = [
    supabase.from("accounts").select("id").ilike("email", pattern).limit(100),
    supabase.from("accounts").select("id").ilike("phone", pattern).limit(100),
  ];
  const profileFields: Array<keyof Pick<
    ProfileRow,
    | "first_name_th"
    | "middle_name_th"
    | "last_name_th"
    | "first_name_en"
    | "middle_name_en"
    | "last_name_en"
    | "institute_name"
    | "rank"
  >> = [
    "first_name_th",
    "middle_name_th",
    "last_name_th",
    "first_name_en",
    "middle_name_en",
    "last_name_en",
    "institute_name",
    "rank",
  ];
  const profileRequests = profileFields.map((field) =>
    supabase.from("player_profiles").select("account_id").ilike(field, pattern).limit(100),
  );

  if (isUuid(query)) {
    accountRequests.push(supabase.from("accounts").select("id").eq("id", query).limit(1));
    profileRequests.push(supabase.from("player_profiles").select("account_id").eq("id", query).limit(1));
  }

  const results = await Promise.all([...accountRequests, ...profileRequests]);

  for (const result of results) {
    if (result.error) {
      throw result.error;
    }

    for (const row of result.data ?? []) {
      if ("id" in row && typeof row.id === "string") {
        accountIdSet.add(row.id);
      }

      if ("account_id" in row && typeof row.account_id === "string") {
        accountIdSet.add(row.account_id);
      }
    }
  }

  return [...accountIdSet];
}

async function fetchAccountIdsByRole(supabase: AdminSupabaseClient, role: AdminUserRole) {
  const { data, error } = await supabase
    .from("account_roles")
    .select("account_id")
    .eq("role", role)
    .limit(500);

  if (error) {
    throw error;
  }

  return unique(((data ?? []) as Array<{ account_id: string }>).map((row) => row.account_id));
}

async function hydrateUsers(supabase: AdminSupabaseClient, accounts: AccountRow[]) {
  const accountIds = accounts.map((account) => account.id);

  if (accountIds.length === 0) {
    return [];
  }

  const [roles, roleRequests, profiles] = await Promise.all([
    fetchRoles(supabase, accountIds),
    fetchRoleRequests(supabase, accountIds),
    fetchProfiles(supabase, accountIds),
  ]);
  const profileIds = [...profiles.values()].map((profile) => profile.id);
  const profileAccountById = new Map([...profiles.values()].map((profile) => [profile.id, profile.account_id]));
  const [coachLinks, playerLinks] = await Promise.all([
    fetchCoachLinksByCoachAccountIds(supabase, accountIds),
    fetchCoachLinksByPlayerProfileIds(supabase, profileIds),
  ]);
  const coachCountsByAccount = groupCoachLinksByAccount(coachLinks, "coach");
  const playerCountsByAccount = groupPlayerLinksByAccount(playerLinks, profileAccountById);

  return accounts.map<AdminUserListRow>((account) => {
    const profile = profiles.get(account.id) ?? null;

    return {
      id: account.id,
      email: account.email,
      phone: account.phone,
      activeRole: account.active_role,
      isActive: account.is_active,
      createdAt: account.created_at,
      lastLoginAt: account.last_login_at,
      roles: roles.get(account.id) ?? [],
      pendingRoleRequests: roleRequests.get(account.id) ?? [],
      profile: profile ? mapProfile(profile) : null,
      coachLinks: {
        asCoach: coachCountsByAccount.get(account.id) ?? emptyCoachLinkCounts(),
        asPlayer: playerCountsByAccount.get(account.id) ?? emptyCoachLinkCounts(),
      },
    };
  });
}

async function fetchRoles(supabase: AdminSupabaseClient, accountIds: string[]) {
  const { data, error } = await supabase
    .from("account_roles")
    .select("account_id,role,status,granted_at,revoked_at")
    .in("account_id", accountIds)
    .order("role", { ascending: true });

  if (error) {
    throw error;
  }

  const groups = new Map<string, AdminUserRoleRow[]>();
  for (const role of (data ?? []) as RoleRow[]) {
    groups.set(role.account_id, [
      ...(groups.get(role.account_id) ?? []),
      {
        grantedAt: role.granted_at,
        revokedAt: role.revoked_at,
        role: role.role,
        status: role.status,
      },
    ]);
  }

  return groups;
}

async function fetchRoleRequests(supabase: AdminSupabaseClient, accountIds: string[]) {
  const { data, error } = await supabase
    .from("role_requests")
    .select("account_id,requested_role,status,created_at,reviewed_at")
    .in("account_id", accountIds)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const groups = new Map<string, AdminUserRoleRequestRow[]>();
  for (const request of (data ?? []) as RoleRequestRow[]) {
    groups.set(request.account_id, [
      ...(groups.get(request.account_id) ?? []),
      {
        createdAt: request.created_at,
        requestedRole: request.requested_role,
        reviewedAt: request.reviewed_at,
        status: request.status,
      },
    ]);
  }

  return groups;
}

async function fetchProfiles(supabase: AdminSupabaseClient, accountIds: string[]) {
  const { data, error } = await supabase
    .from("player_profiles")
    .select(
      "id,account_id,first_name_th,middle_name_th,last_name_th,first_name_en,middle_name_en,last_name_en,rank,rank_status,power_level,institute_name,created_at",
    )
    .in("account_id", accountIds);

  if (error) {
    throw error;
  }

  return new Map(((data ?? []) as ProfileRow[]).map((profile) => [profile.account_id, profile]));
}

async function fetchCoachLinksByCoachAccountIds(supabase: AdminSupabaseClient, accountIds: string[]) {
  if (accountIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("coach_player_links")
    .select("coach_account_id,player_profile_id,status")
    .in("coach_account_id", accountIds);

  if (error) {
    throw error;
  }

  return (data ?? []) as CoachLinkRow[];
}

async function fetchCoachLinksByPlayerProfileIds(supabase: AdminSupabaseClient, profileIds: string[]) {
  if (profileIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("coach_player_links")
    .select("coach_account_id,player_profile_id,status")
    .in("player_profile_id", profileIds);

  if (error) {
    throw error;
  }

  return (data ?? []) as CoachLinkRow[];
}

function mapProfile(profile: ProfileRow): AdminUserProfileSummary {
  return {
    id: profile.id,
    nameTh: joinName([profile.first_name_th, profile.middle_name_th, profile.last_name_th]),
    nameEn: joinName([profile.first_name_en, profile.middle_name_en, profile.last_name_en]),
    rank: profile.rank,
    rankStatus: profile.rank_status,
    powerLevel: profile.power_level,
    instituteName: profile.institute_name,
    createdAt: profile.created_at,
  };
}

function groupCoachLinksByAccount(links: CoachLinkRow[], key: "coach") {
  const groups = new Map<string, AdminCoachLinkCounts>();

  for (const link of links) {
    const accountId = key === "coach" ? link.coach_account_id : "";
    incrementCoachLinkCount(groups, accountId, link.status);
  }

  return groups;
}

function groupPlayerLinksByAccount(
  links: CoachLinkRow[],
  profileAccountById: Map<string, string>,
) {
  const groups = new Map<string, AdminCoachLinkCounts>();

  for (const link of links) {
    const accountId = profileAccountById.get(link.player_profile_id);

    if (accountId) {
      incrementCoachLinkCount(groups, accountId, link.status);
    }
  }

  return groups;
}

function incrementCoachLinkCount(
  groups: Map<string, AdminCoachLinkCounts>,
  accountId: string,
  status: AdminCoachLinkStatus,
) {
  const counts = groups.get(accountId) ?? emptyCoachLinkCounts();
  counts[status] += 1;
  counts.total += 1;
  groups.set(accountId, counts);
}

function emptyCoachLinkCounts(): AdminCoachLinkCounts {
  return {
    approved: 0,
    pending: 0,
    rejected: 0,
    revoked: 0,
    total: 0,
  };
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function joinName(parts: Array<string | null>) {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(" ");
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}
