import { getCurrentAccount } from "@/lib/auth/current-account";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  getPublicTournamentDetail,
  type DivisionRecord,
  type TournamentDetail,
} from "@/lib/tournaments/admin";

export type RegistrationPlayerOption = {
  profileId: string;
  accountId: string;
  label: string;
  detail: string;
  rank: string;
  rankStatus: "verified" | "pending";
  powerLevel: number;
  isSelf: boolean;
};

export type DivisionEligibility = {
  eligible: boolean;
  reasons: string[];
};

export type RegistrationDivisionOption = DivisionRecord & {
  reservedRegistrationCount: number;
  confirmedRegistrationCount: number;
  waitingListCount: number;
  availableSlots: number | null;
  eligibilityByProfileId: Record<string, DivisionEligibility>;
};

export type RegistrationPageData = {
  tournament: TournamentDetail;
  isRegistrationOpen: boolean;
  players: RegistrationPlayerOption[];
  divisions: RegistrationDivisionOption[];
  authState: "guest" | "missing_profile" | "ready";
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
  power_level: number;
  date_of_birth: string;
  institute_name: string | null;
};

type CoachLinkRow = {
  player_profile_id: string;
};

type SummaryRow = {
  division_id: string;
  reserved_registration_count: number | null;
  confirmed_registration_count: number | null;
  waiting_list_count: number | null;
  available_slots: number | null;
};

type RegistrationRow = {
  player_profile_id: string;
  division_id: string;
  status: string;
};

const inactiveRegistrationStatuses = new Set(["cancelled", "expired", "rejected"]);

export async function getRegistrationPageData(
  tournamentId: string,
): Promise<RegistrationPageData | null> {
  const [tournament, account] = await Promise.all([
    getPublicTournamentDetail(tournamentId),
    getCurrentAccount(),
  ]);

  if (!tournament) {
    return null;
  }

  const supabase = createSupabaseAdminClient();
  const summaries = await getDivisionSummaries(
    tournament.divisions.map((division) => division.id),
  );
  const isRegistrationOpen = getIsRegistrationOpen(tournament);

  if (!account) {
    return {
      tournament,
      isRegistrationOpen,
      players: [],
      divisions: tournament.divisions.map((division) =>
        toRegistrationDivision(division, summaries.get(division.id), [], tournament, []),
      ),
      authState: "guest",
    };
  }

  if (!account.profile) {
    return {
      tournament,
      isRegistrationOpen,
      players: [],
      divisions: tournament.divisions.map((division) =>
        toRegistrationDivision(division, summaries.get(division.id), [], tournament, []),
      ),
      authState: "missing_profile",
    };
  }

  const profileIds = await getRegisterableProfileIds(supabase, account.userId, account.profile.id, account.roles);
  const [profiles, activeRegistrations] = await Promise.all([
    getProfiles(supabase, profileIds),
    getActiveRegistrations(supabase, tournament.id, profileIds),
  ]);
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const players = profileIds
    .map((profileId) => profileById.get(profileId))
    .filter((profile): profile is ProfileRow => Boolean(profile))
    .map((profile) => toPlayerOption(profile, profile.id === account.profile?.id));

  return {
    tournament,
    isRegistrationOpen,
    players,
    divisions: tournament.divisions.map((division) =>
      toRegistrationDivision(division, summaries.get(division.id), profiles, tournament, activeRegistrations),
    ),
    authState: "ready",
  };
}

async function getRegisterableProfileIds(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  accountId: string,
  ownProfileId: string,
  roles: Array<{ role: string; status: string }>,
) {
  const profileIds = [ownProfileId];
  const isActiveCoach = roles.some((role) => role.role === "coach" && role.status === "active");

  if (!isActiveCoach) {
    return profileIds;
  }

  const { data, error } = await supabase
    .from("coach_player_links")
    .select("player_profile_id")
    .eq("coach_account_id", accountId)
    .eq("status", "approved")
    .order("requested_at", { ascending: false });

  if (error) {
    throw error;
  }

  for (const link of (data ?? []) as CoachLinkRow[]) {
    if (!profileIds.includes(link.player_profile_id)) {
      profileIds.push(link.player_profile_id);
    }
  }

  return profileIds;
}

async function getProfiles(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  profileIds: string[],
) {
  if (profileIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("player_profiles")
    .select(
      "id,account_id,first_name_th,last_name_th,first_name_en,last_name_en,rank,rank_status,power_level,date_of_birth,institute_name",
    )
    .in("id", profileIds);

  if (error) {
    throw error;
  }

  return (data ?? []) as ProfileRow[];
}

async function getActiveRegistrations(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  tournamentId: string,
  profileIds: string[],
) {
  if (profileIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("registrations")
    .select("player_profile_id,division_id,status")
    .eq("tournament_id", tournamentId)
    .in("player_profile_id", profileIds);

  if (error) {
    throw error;
  }

  return ((data ?? []) as RegistrationRow[]).filter(
    (registration) => !inactiveRegistrationStatuses.has(registration.status),
  );
}

async function getDivisionSummaries(divisionIds: string[]) {
  if (divisionIds.length === 0) {
    return new Map<string, SummaryRow>();
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("division_registration_summary")
    .select(
      "division_id,reserved_registration_count,confirmed_registration_count,waiting_list_count,available_slots",
    )
    .in("division_id", divisionIds);

  if (error) {
    throw error;
  }

  return new Map(((data ?? []) as SummaryRow[]).map((summary) => [summary.division_id, summary]));
}

function toRegistrationDivision(
  division: DivisionRecord,
  summary: SummaryRow | undefined,
  profiles: ProfileRow[],
  tournament: TournamentDetail,
  activeRegistrations: RegistrationRow[],
): RegistrationDivisionOption {
  return {
    ...division,
    reservedRegistrationCount: summary?.reserved_registration_count ?? 0,
    confirmedRegistrationCount: summary?.confirmed_registration_count ?? 0,
    waitingListCount: summary?.waiting_list_count ?? 0,
    availableSlots: summary?.available_slots ?? (division.maxPlayers === null ? null : division.maxPlayers),
    eligibilityByProfileId: Object.fromEntries(
      profiles.map((profile) => [
        profile.id,
        getDivisionEligibility(profile, division, tournament, activeRegistrations),
      ]),
    ),
  };
}

function toPlayerOption(profile: ProfileRow, isSelf: boolean): RegistrationPlayerOption {
  const nameTh = `${profile.first_name_th} ${profile.last_name_th}`;
  const nameEn = `${profile.first_name_en} ${profile.last_name_en}`;
  return {
    profileId: profile.id,
    accountId: profile.account_id,
    label: isSelf ? `${nameTh} (ฉัน)` : nameTh,
    detail: `${nameEn} · ${profile.rank}${profile.institute_name ? ` · ${profile.institute_name}` : ""}`,
    rank: profile.rank,
    rankStatus: profile.rank_status,
    powerLevel: profile.power_level,
    isSelf,
  };
}

function getDivisionEligibility(
  profile: ProfileRow,
  division: DivisionRecord,
  tournament: TournamentDetail,
  activeRegistrations: RegistrationRow[],
): DivisionEligibility {
  const reasons: string[] = [];

  if (division.status !== "active") {
    reasons.push("รุ่นนี้ปิดรับสมัคร");
  }

  if (division.minPowerLevel !== null && profile.power_level < division.minPowerLevel) {
    reasons.push(`ต้องมี power อย่างน้อย ${division.minPowerLevel}`);
  }

  if (division.maxPowerLevel !== null && profile.power_level > division.maxPowerLevel) {
    reasons.push(`power ต้องไม่เกิน ${division.maxPowerLevel}`);
  }

  const age = getAgeOnEventDate(profile.date_of_birth, tournament);
  if (division.minAge !== null && age < division.minAge) {
    reasons.push(`อายุยังไม่ถึง ${division.minAge} ปี`);
  }

  if (division.maxAge !== null && age > division.maxAge) {
    reasons.push(`อายุเกิน ${division.maxAge} ปี`);
  }

  const playerRegistrations = activeRegistrations.filter(
    (registration) => registration.player_profile_id === profile.id,
  );

  if (playerRegistrations.some((registration) => registration.division_id === division.id)) {
    reasons.push("สมัครรุ่นนี้ไว้แล้ว");
  }

  const existingDivisionById = new Map(tournament.divisions.map((item) => [item.id, item]));
  const conflict = playerRegistrations
    .map((registration) => existingDivisionById.get(registration.division_id))
    .find((existingDivision) =>
      existingDivision ? registrationTimeSlotsConflict(existingDivision, division) : false,
    );

  if (conflict && conflict.id !== division.id) {
    reasons.push(`เวลาชนกับ ${conflict.name}`);
  }

  return {
    eligible: reasons.length === 0,
    reasons,
  };
}

export function getIsRegistrationOpen(tournament: {
  status: string;
  registrationOpensAt: string | null;
  registrationClosesAt: string | null;
  divisions: Array<{ status: string }>;
}) {
  const now = Date.now();
  const opensAt = tournament.registrationOpensAt
    ? new Date(tournament.registrationOpensAt).getTime()
    : null;
  const closesAt = tournament.registrationClosesAt
    ? new Date(tournament.registrationClosesAt).getTime()
    : null;

  return (
    tournament.status === "open" &&
    tournament.divisions.some((division) => division.status === "active") &&
    (opensAt === null || now >= opensAt) &&
    (closesAt === null || now <= closesAt)
  );
}

function getAgeOnEventDate(dateOfBirth: string, tournament: TournamentDetail) {
  const eventDate = tournament.eventDate ?? tournament.eventStartsAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
  const birthDate = new Date(`${dateOfBirth}T00:00:00.000Z`);
  const targetDate = new Date(`${eventDate}T00:00:00.000Z`);
  let age = targetDate.getUTCFullYear() - birthDate.getUTCFullYear();
  const monthDiff = targetDate.getUTCMonth() - birthDate.getUTCMonth();

  if (monthDiff < 0 || (monthDiff === 0 && targetDate.getUTCDate() < birthDate.getUTCDate())) {
    age -= 1;
  }

  return age;
}

function registrationTimeSlotsConflict(left: DivisionRecord, right: DivisionRecord) {
  if (left.startsAt && left.endsAt && right.startsAt && right.endsAt) {
    return new Date(left.startsAt).getTime() < new Date(right.endsAt).getTime()
      && new Date(right.startsAt).getTime() < new Date(left.endsAt).getTime();
  }

  const leftLabel = normalizeTimeSlot(left.timeSlotLabel);
  const rightLabel = normalizeTimeSlot(right.timeSlotLabel);

  if (!leftLabel || !rightLabel) {
    return false;
  }

  return leftLabel === "full_day" || rightLabel === "full_day" || leftLabel === rightLabel;
}

function normalizeTimeSlot(label: string | null) {
  const normalized = label?.trim().toLowerCase();

  if (!normalized) {
    return "";
  }

  if (["full_day", "full day", "allday", "all_day", "เต็มวัน"].includes(normalized)) {
    return "full_day";
  }

  return normalized;
}
