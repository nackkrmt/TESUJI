import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerComponentClient } from "@/lib/supabase/server";

export type TournamentStatus =
  | "draft"
  | "open"
  | "closed"
  | "in_progress"
  | "completed"
  | "cancelled";

export type DivisionStatus = "active" | "closed" | "cancelled";
export type PromoDiscountType = "free" | "percentage" | "fixed";

export type TournamentRecord = {
  id: string;
  titleTh: string;
  titleEn: string | null;
  description: string | null;
  venueName: string | null;
  venueAddress: string | null;
  registrationOpensAt: string | null;
  registrationClosesAt: string | null;
  eventStartsAt: string | null;
  eventEndsAt: string | null;
  status: TournamentStatus;
  promptpayId: string | null;
  promptpayName: string | null;
  bannerUrl: string | null;
  bannerAlt: string | null;
  publishedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DivisionRecord = {
  id: string;
  tournamentId: string;
  name: string;
  description: string | null;
  feeAmount: number;
  maxPlayers: number | null;
  minPowerLevel: number | null;
  maxPowerLevel: number | null;
  minAge: number | null;
  maxAge: number | null;
  timeSlotLabel: string | null;
  startsAt: string | null;
  endsAt: string | null;
  pairingMethod: string;
  status: DivisionStatus;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type PromoCodeRecord = {
  id: string;
  tournamentId: string;
  code: string;
  codeNormalized: string;
  description: string | null;
  discountType: PromoDiscountType;
  discountValue: number;
  usageLimit: number | null;
  usedCount: number;
  startsAt: string | null;
  endsAt: string | null;
  divisionIds: string[] | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TournamentDetail = TournamentRecord & {
  divisions: DivisionRecord[];
  promoCodes: PromoCodeRecord[];
};

export type TournamentInput = {
  titleTh: string;
  titleEn: string | null;
  description: string | null;
  venueName: string | null;
  venueAddress: string | null;
  registrationOpensAt: string | null;
  registrationClosesAt: string | null;
  eventStartsAt: string | null;
  eventEndsAt: string | null;
  promptpayId: string | null;
  promptpayName: string | null;
  bannerUrl: string | null;
  bannerAlt: string | null;
};

export type DivisionInput = {
  name: string;
  description: string | null;
  feeAmount: number;
  maxPlayers: number | null;
  minPowerLevel: number | null;
  maxPowerLevel: number | null;
  minAge: number | null;
  maxAge: number | null;
  timeSlotLabel: string | null;
  startsAt: string | null;
  endsAt: string | null;
  pairingMethod: string;
  status: DivisionStatus;
  sortOrder: number;
};

export type PromoCodeInput = {
  code: string;
  description: string | null;
  discountType: PromoDiscountType;
  discountValue: number;
  usageLimit: number | null;
  startsAt: string | null;
  endsAt: string | null;
  divisionIds: string[] | null;
  isActive: boolean;
};

type TournamentRow = {
  id: string;
  title_th: string;
  title_en: string | null;
  description: string | null;
  venue_name: string | null;
  venue_address: string | null;
  registration_opens_at: string | null;
  registration_closes_at: string | null;
  event_starts_at: string | null;
  event_ends_at: string | null;
  status: TournamentStatus;
  promptpay_id: string | null;
  promptpay_name: string | null;
  banner_url: string | null;
  banner_alt: string | null;
  published_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
};

type DivisionRow = {
  id: string;
  tournament_id: string;
  name: string;
  description: string | null;
  fee_amount: number | string;
  max_players: number | null;
  min_power_level: number | null;
  max_power_level: number | null;
  min_age: number | null;
  max_age: number | null;
  time_slot_label: string | null;
  starts_at: string | null;
  ends_at: string | null;
  pairing_method: string;
  status: DivisionStatus;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type PromoCodeRow = {
  id: string;
  tournament_id: string;
  code: string;
  code_normalized: string;
  description: string | null;
  discount_type: PromoDiscountType;
  discount_value: number | string;
  usage_limit: number | null;
  used_count: number;
  starts_at: string | null;
  ends_at: string | null;
  division_ids: string[] | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export async function getAdminTournaments() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("tournaments")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return ((data ?? []) as TournamentRow[]).map(mapTournament);
}

export async function getAdminTournamentDetail(id: string): Promise<TournamentDetail | null> {
  const supabase = createSupabaseAdminClient();
  const [{ data: tournament, error: tournamentError }, { data: divisions, error: divisionsError }, { data: promoCodes, error: promoError }] =
    await Promise.all([
      supabase.from("tournaments").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("divisions")
        .select("*")
        .eq("tournament_id", id)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase
        .from("promo_codes")
        .select("*")
        .eq("tournament_id", id)
        .order("created_at", { ascending: false }),
    ]);

  if (tournamentError) {
    throw tournamentError;
  }

  if (divisionsError) {
    throw divisionsError;
  }

  if (promoError) {
    throw promoError;
  }

  if (!tournament) {
    return null;
  }

  return {
    ...mapTournament(tournament as TournamentRow),
    divisions: ((divisions ?? []) as DivisionRow[]).map(mapDivision),
    promoCodes: ((promoCodes ?? []) as PromoCodeRow[]).map(mapPromoCode),
  };
}

export async function getPublicTournaments() {
  const supabase = await createSupabaseServerComponentClient();
  const { data, error } = await supabase
    .from("tournaments")
    .select("*")
    .neq("status", "draft")
    .order("event_starts_at", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return ((data ?? []) as TournamentRow[]).map(mapTournament);
}

export async function getPublicTournamentDetail(id: string): Promise<TournamentDetail | null> {
  const supabase = await createSupabaseServerComponentClient();
  const { data: tournament, error: tournamentError } = await supabase
    .from("tournaments")
    .select("*")
    .eq("id", id)
    .neq("status", "draft")
    .maybeSingle();

  if (tournamentError) {
    throw tournamentError;
  }

  if (!tournament) {
    return null;
  }

  const { data: divisions, error: divisionsError } = await supabase
    .from("divisions")
    .select("*")
    .eq("tournament_id", id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (divisionsError) {
    throw divisionsError;
  }

  return {
    ...mapTournament(tournament as TournamentRow),
    divisions: ((divisions ?? []) as DivisionRow[]).map(mapDivision),
    promoCodes: [],
  };
}

export async function createTournament(input: TournamentInput) {
  ensureAdminMutationAllowedForDevMode();

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("tournaments")
    .insert(toTournamentMutation(input))
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return (data as { id: string }).id;
}

export async function updateTournament(id: string, input: TournamentInput) {
  ensureAdminMutationAllowedForDevMode();

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("tournaments")
    .update(toTournamentMutation(input))
    .eq("id", id);

  if (error) {
    throw error;
  }
}

export async function setTournamentStatus(id: string, status: TournamentStatus) {
  ensureAdminMutationAllowedForDevMode();

  const supabase = createSupabaseAdminClient();

  if (status === "open") {
    const { count, error: countError } = await supabase
      .from("divisions")
      .select("id", { count: "exact", head: true })
      .eq("tournament_id", id)
      .eq("status", "active");

    if (countError) {
      throw countError;
    }

    if (!count) {
      throw new Error("Add at least one active division before opening registration.");
    }
  }

  const nextValues: {
    status: TournamentStatus;
    published_at?: string | null;
    cancelled_at?: string | null;
  } = { status };

  if (status === "open") {
    nextValues.published_at = new Date().toISOString();
    nextValues.cancelled_at = null;
  }

  if (status === "cancelled") {
    nextValues.cancelled_at = new Date().toISOString();
  }

  const { error } = await supabase.from("tournaments").update(nextValues).eq("id", id);

  if (error) {
    throw error;
  }
}

export async function deleteDraftTournament(id: string) {
  ensureAdminMutationAllowedForDevMode();

  const supabase = createSupabaseAdminClient();
  const { data, error: statusError } = await supabase
    .from("tournaments")
    .select("status")
    .eq("id", id)
    .maybeSingle();

  if (statusError) {
    throw statusError;
  }

  if (!data) {
    throw new Error("Tournament not found.");
  }

  if ((data as { status: TournamentStatus }).status !== "draft") {
    throw new Error("Only draft tournaments can be deleted.");
  }

  const { error } = await supabase.from("tournaments").delete().eq("id", id);

  if (error) {
    throw error;
  }
}

export async function upsertDivision(
  tournamentId: string,
  input: DivisionInput,
  divisionId?: string,
) {
  ensureAdminMutationAllowedForDevMode();

  const supabase = createSupabaseAdminClient();
  const mutation = {
    name: input.name,
    description: input.description,
    fee_amount: input.feeAmount,
    max_players: input.maxPlayers,
    min_power_level: input.minPowerLevel,
    max_power_level: input.maxPowerLevel,
    min_age: input.minAge,
    max_age: input.maxAge,
    time_slot_label: input.timeSlotLabel,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    pairing_method: input.pairingMethod,
    status: input.status,
    sort_order: input.sortOrder,
  };

  const query = divisionId
    ? supabase
        .from("divisions")
        .update(mutation)
        .eq("id", divisionId)
        .eq("tournament_id", tournamentId)
        .select("id")
        .single()
    : supabase
        .from("divisions")
        .insert({ ...mutation, tournament_id: tournamentId })
        .select("id")
        .single();

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data as { id: string }).id;
}

export async function upsertPromoCode(
  tournamentId: string,
  input: PromoCodeInput,
  promoCodeId?: string,
) {
  ensureAdminMutationAllowedForDevMode();

  const supabase = createSupabaseAdminClient();
  const mutation = {
    code: input.code,
    description: input.description,
    discount_type: input.discountType,
    discount_value: input.discountValue,
    usage_limit: input.usageLimit,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    division_ids: input.divisionIds,
    is_active: input.isActive,
  };

  const query = promoCodeId
    ? supabase
        .from("promo_codes")
        .update(mutation)
        .eq("id", promoCodeId)
        .eq("tournament_id", tournamentId)
        .select("id")
        .single()
    : supabase
        .from("promo_codes")
        .insert({ ...mutation, tournament_id: tournamentId })
        .select("id")
        .single();

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data as { id: string }).id;
}

export function ensureAdminMutationAllowedForDevMode() {
  // Dev mode intentionally keeps /admin routes and server actions open while functions are built.
  // TODO(prod-auth): require the normal Supabase Auth user to have account_roles.admin = active.
}

function toTournamentMutation(input: TournamentInput) {
  return {
    title_th: input.titleTh,
    title_en: input.titleEn,
    description: input.description,
    venue_name: input.venueName,
    venue_address: input.venueAddress,
    registration_opens_at: input.registrationOpensAt,
    registration_closes_at: input.registrationClosesAt,
    event_starts_at: input.eventStartsAt,
    event_ends_at: input.eventEndsAt,
    promptpay_id: input.promptpayId,
    promptpay_name: input.promptpayName,
    banner_url: input.bannerUrl,
    banner_alt: input.bannerAlt,
  };
}

function mapTournament(row: TournamentRow): TournamentRecord {
  return {
    id: row.id,
    titleTh: row.title_th,
    titleEn: row.title_en,
    description: row.description,
    venueName: row.venue_name,
    venueAddress: row.venue_address,
    registrationOpensAt: row.registration_opens_at,
    registrationClosesAt: row.registration_closes_at,
    eventStartsAt: row.event_starts_at,
    eventEndsAt: row.event_ends_at,
    status: row.status,
    promptpayId: row.promptpay_id,
    promptpayName: row.promptpay_name,
    bannerUrl: row.banner_url,
    bannerAlt: row.banner_alt,
    publishedAt: row.published_at,
    cancelledAt: row.cancelled_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDivision(row: DivisionRow): DivisionRecord {
  return {
    id: row.id,
    tournamentId: row.tournament_id,
    name: row.name,
    description: row.description,
    feeAmount: Number(row.fee_amount),
    maxPlayers: row.max_players,
    minPowerLevel: row.min_power_level,
    maxPowerLevel: row.max_power_level,
    minAge: row.min_age,
    maxAge: row.max_age,
    timeSlotLabel: row.time_slot_label,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    pairingMethod: row.pairing_method,
    status: row.status,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPromoCode(row: PromoCodeRow): PromoCodeRecord {
  return {
    id: row.id,
    tournamentId: row.tournament_id,
    code: row.code,
    codeNormalized: row.code_normalized,
    description: row.description,
    discountType: row.discount_type,
    discountValue: Number(row.discount_value),
    usageLimit: row.usage_limit,
    usedCount: row.used_count,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    divisionIds: row.division_ids,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
