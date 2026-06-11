import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type AdminRegistrationStatus =
  | "pending_payment"
  | "pending_verify"
  | "confirmed"
  | "waiting_list"
  | "cancelled"
  | "expired"
  | "rejected";

export type AdminRegistrationSource = "self" | "coach" | "admin";

export type AdminRegistrationListInput = {
  divisionId?: string | null;
  statuses?: AdminRegistrationStatus[];
  tournamentId: string;
};

export type AdminRegistrationListResult = {
  division: {
    id: string;
    name: string;
  } | null;
  registrations: AdminRegistrationListRow[];
  tournament: {
    id: string;
    title: string;
    eventDate: string | null;
    eventStartsAt: string | null;
  };
};

export type AdminRegistrationListRow = {
  id: string;
  orderNumber: number;
  tournamentId: string;
  tournamentTitle: string;
  divisionId: string;
  divisionName: string;
  status: AdminRegistrationStatus;
  source: AdminRegistrationSource;
  registeredAt: string;
  waitingListPosition: number | null;
  player: {
    id: string;
    accountId: string;
    nameTh: string;
    nameEn: string;
    rank: string;
    powerLevel: number;
    instituteName: string | null;
  };
  registeredBy: {
    accountId: string;
    email: string;
    phone: string;
    activeRole: "player" | "coach" | "referee" | "admin";
    sourceRole: "player" | "coach" | "admin" | "unknown";
    roles: Array<{
      role: "player" | "coach" | "referee" | "admin";
      status: "active" | "suspended" | "revoked";
    }>;
    nameTh: string | null;
    nameEn: string | null;
  };
};

export type AdminRegistrationCsvExport = {
  content: string;
  contentType: "text/csv; charset=utf-8";
  filename: string;
  rowCount: number;
};

type TournamentRow = {
  id: string;
  title?: string | null;
  title_th?: string | null;
  title_en: string | null;
  event_date?: string | null;
  event_starts_at: string | null;
};

type DivisionRow = {
  id: string;
  tournament_id: string;
  name: string;
  sort_order: number;
  created_at: string;
};

type RegistrationRow = {
  id: string;
  tournament_id: string;
  division_id: string;
  player_profile_id: string;
  registered_by_account_id: string;
  status: AdminRegistrationStatus;
  source: AdminRegistrationSource;
  waiting_list_position: number | null;
  created_at: string;
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
  power_level: number;
  institute_name: string | null;
};

type AccountRow = {
  id: string;
  email: string;
  phone: string;
  active_role: "player" | "coach" | "referee" | "admin";
};

type RoleRow = {
  account_id: string;
  role: "player" | "coach" | "referee" | "admin";
  status: "active" | "suspended" | "revoked";
};

type AdminSupabaseClient = ReturnType<typeof createSupabaseAdminClient>;

const statusSchema = z.enum([
  "pending_payment",
  "pending_verify",
  "confirmed",
  "waiting_list",
  "cancelled",
  "expired",
  "rejected",
]);

const listInputSchema = z.object({
  divisionId: z.string().uuid().nullable().optional(),
  statuses: z.array(statusSchema).optional(),
  tournamentId: z.string().uuid(),
});

const csvHeaders = [
  "Order No",
  "Tournament",
  "Division",
  "Player Name TH",
  "Player Name EN",
  "Rank",
  "Power Level",
  "Institute",
  "Status",
  "Registered At",
  "Source",
  "Registered By Email",
  "Registered By Name TH",
  "Registered By Name EN",
  "Registered By Role",
  "Registered By Roles",
  "Waiting List Position",
] as const;

export async function getAdminRegistrationList(
  input: AdminRegistrationListInput,
): Promise<AdminRegistrationListResult> {
  ensureAdminRegistrationReadAllowedForDevMode();

  const parsed = listInputSchema.parse(input);
  const supabase = createSupabaseAdminClient();
  const [tournament, division, registrations] = await Promise.all([
    fetchTournament(supabase, parsed.tournamentId),
    parsed.divisionId ? fetchDivision(supabase, parsed.tournamentId, parsed.divisionId) : Promise.resolve(null),
    fetchRegistrations(supabase, parsed),
  ]);

  if (!tournament) {
    throw new Error("Tournament not found.");
  }

  if (parsed.divisionId && !division) {
    throw new Error("Division not found for tournament.");
  }

  if (registrations.length === 0) {
    return {
      division: division ? { id: division.id, name: division.name } : null,
      registrations: [],
      tournament: mapTournamentSummary(tournament),
    };
  }

  const [divisions, playerProfiles, registeredByAccounts, registeredByProfiles, roles] =
    await Promise.all([
      fetchDivisions(supabase, registrations.map((registration) => registration.division_id)),
      fetchProfiles(supabase, registrations.map((registration) => registration.player_profile_id)),
      fetchAccounts(supabase, registrations.map((registration) => registration.registered_by_account_id)),
      fetchProfilesByAccountIds(
        supabase,
        registrations.map((registration) => registration.registered_by_account_id),
      ),
      fetchRoles(supabase, registrations.map((registration) => registration.registered_by_account_id)),
    ]);

  const sortedRegistrations = [...registrations].sort((left, right) =>
    compareRegistrations(left, right, divisions),
  );

  return {
    division: division ? { id: division.id, name: division.name } : null,
    registrations: sortedRegistrations.map((registration, index) =>
      mapRegistration({
        accounts: registeredByAccounts,
        divisions,
        index,
        playerProfiles,
        registeredByProfiles,
        registration,
        roles,
        tournament,
      }),
    ),
    tournament: mapTournamentSummary(tournament),
  };
}

export async function exportAdminRegistrationCsv(
  input: AdminRegistrationListInput,
): Promise<AdminRegistrationCsvExport> {
  const result = await getAdminRegistrationList(input);
  const rows = result.registrations.map((registration) => [
    registration.orderNumber,
    registration.tournamentTitle,
    registration.divisionName,
    registration.player.nameTh,
    registration.player.nameEn,
    registration.player.rank,
    registration.player.powerLevel,
    registration.player.instituteName ?? "",
    registration.status,
    registration.registeredAt,
    registration.source,
    registration.registeredBy.email,
    registration.registeredBy.nameTh ?? "",
    registration.registeredBy.nameEn ?? "",
    registration.registeredBy.sourceRole,
    registration.registeredBy.roles.map((role) => `${role.role}:${role.status}`).join("; "),
    registration.waitingListPosition ?? "",
  ]);

  return {
    content: `\uFEFF${toCsv([csvHeaders, ...rows])}`,
    contentType: "text/csv; charset=utf-8",
    filename: getCsvFilename(result),
    rowCount: result.registrations.length,
  };
}

function ensureAdminRegistrationReadAllowedForDevMode() {
  // Dev mode intentionally leaves Admin routes/export endpoints reachable while
  // Admin tools are built. Future production auth should require account_roles.admin = active.
}

async function fetchTournament(supabase: AdminSupabaseClient, tournamentId: string) {
  const { data, error } = await supabase
    .from("tournaments")
    .select("id,title,title_en,event_date,event_starts_at")
    .eq("id", tournamentId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as TournamentRow | null;
}

async function fetchDivision(
  supabase: AdminSupabaseClient,
  tournamentId: string,
  divisionId: string,
) {
  const { data, error } = await supabase
    .from("divisions")
    .select("id,tournament_id,name,sort_order,created_at")
    .eq("id", divisionId)
    .eq("tournament_id", tournamentId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as DivisionRow | null;
}

async function fetchRegistrations(
  supabase: AdminSupabaseClient,
  input: Required<Pick<AdminRegistrationListInput, "tournamentId">> &
    Pick<AdminRegistrationListInput, "divisionId" | "statuses">,
) {
  let query = supabase
    .from("registrations")
    .select(
      "id,tournament_id,division_id,player_profile_id,registered_by_account_id,status,source,waiting_list_position,created_at",
    )
    .eq("tournament_id", input.tournamentId);

  if (input.divisionId) {
    query = query.eq("division_id", input.divisionId);
  }

  if (input.statuses && input.statuses.length > 0) {
    query = query.in("status", input.statuses);
  }

  const { data, error } = await query.order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as RegistrationRow[];
}

async function fetchDivisions(supabase: AdminSupabaseClient, divisionIds: string[]) {
  const uniqueIds = unique(divisionIds);

  if (uniqueIds.length === 0) {
    return new Map<string, DivisionRow>();
  }

  const { data, error } = await supabase
    .from("divisions")
    .select("id,tournament_id,name,sort_order,created_at")
    .in("id", uniqueIds);

  if (error) {
    throw error;
  }

  return new Map(((data ?? []) as DivisionRow[]).map((division) => [division.id, division]));
}

async function fetchProfiles(supabase: AdminSupabaseClient, profileIds: string[]) {
  const uniqueIds = unique(profileIds);

  if (uniqueIds.length === 0) {
    return new Map<string, ProfileRow>();
  }

  const { data, error } = await supabase
    .from("player_profiles")
    .select(
      "id,account_id,first_name_th,middle_name_th,last_name_th,first_name_en,middle_name_en,last_name_en,rank,power_level,institute_name",
    )
    .in("id", uniqueIds);

  if (error) {
    throw error;
  }

  return new Map(((data ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]));
}

async function fetchProfilesByAccountIds(supabase: AdminSupabaseClient, accountIds: string[]) {
  const uniqueIds = unique(accountIds);

  if (uniqueIds.length === 0) {
    return new Map<string, ProfileRow>();
  }

  const { data, error } = await supabase
    .from("player_profiles")
    .select(
      "id,account_id,first_name_th,middle_name_th,last_name_th,first_name_en,middle_name_en,last_name_en,rank,power_level,institute_name",
    )
    .in("account_id", uniqueIds);

  if (error) {
    throw error;
  }

  return new Map(((data ?? []) as ProfileRow[]).map((profile) => [profile.account_id, profile]));
}

async function fetchAccounts(supabase: AdminSupabaseClient, accountIds: string[]) {
  const uniqueIds = unique(accountIds);

  if (uniqueIds.length === 0) {
    return new Map<string, AccountRow>();
  }

  const { data, error } = await supabase
    .from("accounts")
    .select("id,email,phone,active_role")
    .in("id", uniqueIds);

  if (error) {
    throw error;
  }

  return new Map(((data ?? []) as AccountRow[]).map((account) => [account.id, account]));
}

async function fetchRoles(supabase: AdminSupabaseClient, accountIds: string[]) {
  const uniqueIds = unique(accountIds);

  if (uniqueIds.length === 0) {
    return new Map<string, RoleRow[]>();
  }

  const { data, error } = await supabase
    .from("account_roles")
    .select("account_id,role,status")
    .in("account_id", uniqueIds)
    .order("role", { ascending: true });

  if (error) {
    throw error;
  }

  const groups = new Map<string, RoleRow[]>();
  for (const role of (data ?? []) as RoleRow[]) {
    groups.set(role.account_id, [...(groups.get(role.account_id) ?? []), role]);
  }

  return groups;
}

function mapRegistration({
  accounts,
  divisions,
  index,
  playerProfiles,
  registeredByProfiles,
  registration,
  roles,
  tournament,
}: {
  accounts: Map<string, AccountRow>;
  divisions: Map<string, DivisionRow>;
  index: number;
  playerProfiles: Map<string, ProfileRow>;
  registeredByProfiles: Map<string, ProfileRow>;
  registration: RegistrationRow;
  roles: Map<string, RoleRow[]>;
  tournament: TournamentRow;
}): AdminRegistrationListRow {
  const division = divisions.get(registration.division_id);
  const player = playerProfiles.get(registration.player_profile_id);
  const registeredBy = accounts.get(registration.registered_by_account_id);
  const registeredByProfile = registeredByProfiles.get(registration.registered_by_account_id);
  const registeredByRoles = roles.get(registration.registered_by_account_id) ?? [];

  return {
    id: registration.id,
    orderNumber: index + 1,
    tournamentId: registration.tournament_id,
    tournamentTitle: getTournamentTitle(tournament),
    divisionId: registration.division_id,
    divisionName: division?.name ?? registration.division_id,
    status: registration.status,
    source: registration.source,
    registeredAt: registration.created_at,
    waitingListPosition: registration.waiting_list_position,
    player: {
      id: registration.player_profile_id,
      accountId: player?.account_id ?? "",
      nameTh: player ? joinName([player.first_name_th, player.middle_name_th, player.last_name_th]) : "",
      nameEn: player ? joinName([player.first_name_en, player.middle_name_en, player.last_name_en]) : "",
      rank: player?.rank ?? "",
      powerLevel: player?.power_level ?? 0,
      instituteName: player?.institute_name ?? null,
    },
    registeredBy: {
      accountId: registration.registered_by_account_id,
      email: registeredBy?.email ?? "",
      phone: registeredBy?.phone ?? "",
      activeRole: registeredBy?.active_role ?? "player",
      sourceRole: getRegisteredBySourceRole(registration.source, registeredByRoles),
      roles: registeredByRoles,
      nameTh: registeredByProfile
        ? joinName([
            registeredByProfile.first_name_th,
            registeredByProfile.middle_name_th,
            registeredByProfile.last_name_th,
          ])
        : null,
      nameEn: registeredByProfile
        ? joinName([
            registeredByProfile.first_name_en,
            registeredByProfile.middle_name_en,
            registeredByProfile.last_name_en,
          ])
        : null,
    },
  };
}

function compareRegistrations(
  left: RegistrationRow,
  right: RegistrationRow,
  divisions: Map<string, DivisionRow>,
) {
  const leftDivision = divisions.get(left.division_id);
  const rightDivision = divisions.get(right.division_id);
  const divisionOrder = (leftDivision?.sort_order ?? 0) - (rightDivision?.sort_order ?? 0);

  if (divisionOrder !== 0) {
    return divisionOrder;
  }

  const createdOrder = new Date(left.created_at).getTime() - new Date(right.created_at).getTime();

  if (createdOrder !== 0) {
    return createdOrder;
  }

  return left.id.localeCompare(right.id);
}

function mapTournamentSummary(tournament: TournamentRow) {
  return {
    id: tournament.id,
    title: getTournamentTitle(tournament),
    eventDate: tournament.event_date ?? null,
    eventStartsAt: tournament.event_starts_at,
  };
}

function getRegisteredBySourceRole(
  source: AdminRegistrationSource,
  roles: RoleRow[],
): "player" | "coach" | "admin" | "unknown" {
  if (source === "coach" && roles.some((role) => role.role === "coach" && role.status === "active")) {
    return "coach";
  }

  if (source === "admin" && roles.some((role) => role.role === "admin" && role.status === "active")) {
    return "admin";
  }

  if (source === "self" && roles.some((role) => role.role === "player" && role.status === "active")) {
    return "player";
  }

  return "unknown";
}

function getCsvFilename(result: AdminRegistrationListResult) {
  const parts = [
    "tesuji-registrations",
    safeFilenamePart(result.tournament.title),
    result.division ? safeFilenamePart(result.division.name) : "all-divisions",
  ];

  return `${parts.filter(Boolean).join("-")}.csv`;
}

function safeFilenamePart(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function toCsv(rows: ReadonlyArray<ReadonlyArray<unknown>>) {
  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
}

function escapeCsvCell(value: unknown) {
  const text = value == null ? "" : String(value);

  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function joinName(parts: Array<string | null>) {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(" ");
}

function getTournamentTitle(tournament: TournamentRow) {
  return tournament.title ?? tournament.title_th ?? tournament.title_en ?? "Untitled tournament";
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}
