import { Buffer } from "node:buffer";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerComponentClient } from "@/lib/supabase/server";

const TOURNAMENT_BANNER_BUCKET = "tournament-banners";
const MAX_BANNER_BYTES = 2 * 1024 * 1024;
const ALLOWED_BANNER_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

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
  title: string;
  titleEn: string | null;
  description: string | null;
  venueName: string | null;
  venueAddress: string | null;
  googleMapsUrl: string | null;
  eventDate: string | null;
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
  title: string;
  description: string | null;
  venueAddress: string | null;
  googleMapsUrl: string | null;
  eventDate: string | null;
  registrationOpensAt: string | null;
  registrationClosesAt: string | null;
  promptpayId: string | null;
  promptpayName: string | null;
  bannerUrl: string | null;
  bannerAlt: string | null;
};

export type DivisionInput = {
  id?: string;
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
  title?: string | null;
  title_th?: string | null;
  title_en: string | null;
  description: string | null;
  venue_name: string | null;
  venue_address: string | null;
  google_maps_url?: string | null;
  event_date?: string | null;
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

type AdminSupabaseClient = ReturnType<typeof createSupabaseAdminClient>;

type UploadedBanner = {
  path: string;
  publicUrl: string;
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

export async function createTournamentWithDivisions(
  input: TournamentInput,
  divisions: DivisionInput[],
  bannerFile?: File | null,
) {
  ensureAdminMutationAllowedForDevMode();

  const supabase = createSupabaseAdminClient();
  const tournamentId = crypto.randomUUID();
  let uploadedBanner: UploadedBanner | null = null;

  try {
    uploadedBanner = await maybeUploadTournamentBanner(supabase, tournamentId, bannerFile);
    const finalInput = withUploadedBanner(input, uploadedBanner);
    const { data, error } = await supabase
      .from("tournaments")
      .insert({ id: tournamentId, ...toTournamentMutation(finalInput) })
      .select("id")
      .single();

    if (error) {
      throw error;
    }

    await insertTournamentDivisions(supabase, tournamentId, divisions);

    return (data as { id: string }).id;
  } catch (error) {
    if (uploadedBanner) {
      await supabase.storage.from(TOURNAMENT_BANNER_BUCKET).remove([uploadedBanner.path]);
    }

    await supabase.from("tournaments").delete().eq("id", tournamentId);
    throw error;
  }
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

export async function updateTournamentWithDivisions(
  id: string,
  input: TournamentInput,
  divisions: DivisionInput[],
  bannerFile?: File | null,
) {
  ensureAdminMutationAllowedForDevMode();

  const supabase = createSupabaseAdminClient();
  const uploadedBanner = await maybeUploadTournamentBanner(supabase, id, bannerFile);

  try {
    const { error } = await supabase
      .from("tournaments")
      .update(toTournamentMutation(withUploadedBanner(input, uploadedBanner)))
      .eq("id", id);

    if (error) {
      throw error;
    }

    await replaceTournamentDivisions(supabase, id, divisions);
  } catch (error) {
    if (uploadedBanner) {
      await supabase.storage.from(TOURNAMENT_BANNER_BUCKET).remove([uploadedBanner.path]);
    }

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
  const mutation = toDivisionMutation(input);

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

async function insertTournamentDivisions(
  supabase: AdminSupabaseClient,
  tournamentId: string,
  divisions: DivisionInput[],
) {
  if (divisions.length === 0) {
    return;
  }

  const rows = divisions.map((division, index) => ({
    ...toDivisionMutation({ ...division, sortOrder: index }),
    tournament_id: tournamentId,
  }));
  const { error } = await supabase.from("divisions").insert(rows);

  if (error) {
    throw error;
  }
}

async function replaceTournamentDivisions(
  supabase: AdminSupabaseClient,
  tournamentId: string,
  divisions: DivisionInput[],
) {
  const { data: existingRows, error: existingError } = await supabase
    .from("divisions")
    .select("id")
    .eq("tournament_id", tournamentId);

  if (existingError) {
    throw existingError;
  }

  const existingIds = new Set(((existingRows ?? []) as { id: string }[]).map((row) => row.id));
  const keptIds = new Set<string>();

  for (const [index, division] of divisions.entries()) {
    const mutation = toDivisionMutation({ ...division, sortOrder: index });

    if (division.id && existingIds.has(division.id)) {
      const { error } = await supabase
        .from("divisions")
        .update(mutation)
        .eq("id", division.id)
        .eq("tournament_id", tournamentId);

      if (error) {
        throw error;
      }

      keptIds.add(division.id);
      continue;
    }

    const { data, error } = await supabase
      .from("divisions")
      .insert({ ...mutation, tournament_id: tournamentId })
      .select("id")
      .single();

    if (error) {
      throw error;
    }

    keptIds.add((data as { id: string }).id);
  }

  const staleIds = [...existingIds].filter((id) => !keptIds.has(id));
  if (staleIds.length === 0) {
    return;
  }

  const { error: deleteError } = await supabase
    .from("divisions")
    .delete()
    .eq("tournament_id", tournamentId)
    .in("id", staleIds);

  if (deleteError) {
    throw deleteError;
  }
}

async function maybeUploadTournamentBanner(
  supabase: AdminSupabaseClient,
  tournamentId: string,
  bannerFile?: File | null,
): Promise<UploadedBanner | null> {
  if (!bannerFile || bannerFile.size === 0) {
    return null;
  }

  if (!ALLOWED_BANNER_TYPES.has(bannerFile.type)) {
    throw new Error("Banner image must be JPG, PNG, or WebP.");
  }

  if (bannerFile.size > MAX_BANNER_BYTES) {
    throw new Error("Banner image must be 2MB or smaller.");
  }

  const extension = getBannerExtension(bannerFile);
  const path = `${tournamentId}/${crypto.randomUUID()}.${extension}`;
  const bytes = Buffer.from(await bannerFile.arrayBuffer());
  const { error } = await supabase.storage.from(TOURNAMENT_BANNER_BUCKET).upload(path, bytes, {
    contentType: bannerFile.type,
    upsert: false,
  });

  if (error) {
    throw error;
  }

  const { data } = supabase.storage.from(TOURNAMENT_BANNER_BUCKET).getPublicUrl(path);
  return {
    path,
    publicUrl: data.publicUrl,
  };
}

function withUploadedBanner(input: TournamentInput, uploadedBanner: UploadedBanner | null) {
  if (!uploadedBanner) {
    return input;
  }

  return {
    ...input,
    bannerUrl: uploadedBanner.publicUrl,
    bannerAlt: input.bannerAlt ?? input.title,
  };
}

function getBannerExtension(file: File) {
  if (file.type === "image/png") {
    return "png";
  }

  if (file.type === "image/webp") {
    return "webp";
  }

  return "jpg";
}

function toTournamentMutation(input: TournamentInput) {
  const eventStartsAt = input.eventDate ? new Date(`${input.eventDate}T00:00:00+07:00`).toISOString() : null;

  return {
    title: input.title,
    description: input.description,
    venue_name: null,
    venue_address: input.venueAddress,
    google_maps_url: input.googleMapsUrl,
    event_date: input.eventDate,
    registration_opens_at: input.registrationOpensAt,
    registration_closes_at: input.registrationClosesAt,
    event_starts_at: eventStartsAt,
    event_ends_at: null,
    promptpay_id: input.promptpayId,
    promptpay_name: input.promptpayName,
    banner_url: input.bannerUrl,
    banner_alt: input.bannerAlt,
  };
}

function toDivisionMutation(input: DivisionInput) {
  return {
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
}

function mapTournament(row: TournamentRow): TournamentRecord {
  const title = row.title ?? row.title_th ?? row.title_en ?? "Untitled tournament";

  return {
    id: row.id,
    title,
    titleEn: row.title_en,
    description: row.description,
    venueName: row.venue_name,
    venueAddress: row.venue_address,
    googleMapsUrl: row.google_maps_url ?? null,
    eventDate: row.event_date ?? null,
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
