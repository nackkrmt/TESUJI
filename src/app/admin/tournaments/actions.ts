"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createTournamentWithDivisions,
  deleteDraftTournament,
  setTournamentStatus,
  updateTournamentWithDivisions,
  upsertDivision,
  upsertPromoCode,
  type DivisionInput,
  type DivisionStatus,
  type PromoCodeInput,
  type PromoDiscountType,
  type TournamentInput,
  type TournamentStatus,
} from "@/lib/tournaments/admin";

export type TournamentActionState = {
  status: "idle" | "success" | "error";
  message: string;
  id?: string;
};

const uuidSchema = z.string().uuid();
const statusSchema = z.enum([
  "draft",
  "open",
  "closed",
  "in_progress",
  "completed",
  "cancelled",
]);
const divisionStatusSchema = z.enum(["active", "closed", "cancelled"]);
const discountTypeSchema = z.enum(["free", "percentage", "fixed"]);
const timeSlotLabels = new Set(["เช้า", "บ่าย", "เต็มวัน"]);

export async function createTournamentAction(
  _previousState: TournamentActionState,
  formData: FormData,
): Promise<TournamentActionState> {
  try {
    const id = await createTournamentWithDivisions(
      parseTournamentInput(formData),
      parseDivisionsInput(formData),
      parseBannerFile(formData),
    );
    revalidateTournamentPaths(id);

    return {
      status: "success",
      message: "Tournament draft created with divisions.",
      id,
    };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateTournamentAction(
  _previousState: TournamentActionState,
  formData: FormData,
): Promise<TournamentActionState> {
  try {
    const id = uuidSchema.parse(formData.get("tournamentId"));
    await updateTournamentWithDivisions(
      id,
      parseTournamentInput(formData),
      parseDivisionsInput(formData),
      parseBannerFile(formData),
    );
    revalidateTournamentPaths(id);

    return {
      status: "success",
      message: "Tournament and divisions updated.",
      id,
    };
  } catch (error) {
    return toActionError(error);
  }
}

export async function setTournamentStatusAction(
  _previousState: TournamentActionState,
  formData: FormData,
): Promise<TournamentActionState> {
  try {
    const id = uuidSchema.parse(formData.get("tournamentId"));
    const status = statusSchema.parse(formData.get("status")) as TournamentStatus;
    await setTournamentStatus(id, status);
    revalidateTournamentPaths(id);

    return {
      status: "success",
      message: `Tournament status changed to ${status}.`,
      id,
    };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteDraftTournamentAction(
  _previousState: TournamentActionState,
  formData: FormData,
): Promise<TournamentActionState> {
  try {
    const id = uuidSchema.parse(formData.get("tournamentId"));
    await deleteDraftTournament(id);
    revalidateTournamentPaths(id);

    return {
      status: "success",
      message: "Draft tournament deleted.",
      id,
    };
  } catch (error) {
    return toActionError(error);
  }
}

export async function upsertDivisionAction(
  _previousState: TournamentActionState,
  formData: FormData,
): Promise<TournamentActionState> {
  try {
    const tournamentId = uuidSchema.parse(formData.get("tournamentId"));
    const divisionId = parseOptionalUuid(formData.get("divisionId"));
    const id = await upsertDivision(tournamentId, parseDivisionInput(formData), divisionId);
    revalidateTournamentPaths(tournamentId);

    return {
      status: "success",
      message: divisionId ? "Division updated." : "Division added.",
      id,
    };
  } catch (error) {
    return toActionError(error);
  }
}

export async function upsertPromoCodeAction(
  _previousState: TournamentActionState,
  formData: FormData,
): Promise<TournamentActionState> {
  try {
    const tournamentId = uuidSchema.parse(formData.get("tournamentId"));
    const promoCodeId = parseOptionalUuid(formData.get("promoCodeId"));
    const id = await upsertPromoCode(tournamentId, parsePromoCodeInput(formData), promoCodeId);
    revalidateTournamentPaths(tournamentId);

    return {
      status: "success",
      message: promoCodeId ? "Promo code updated." : "Promo code added.",
      id,
    };
  } catch (error) {
    return toActionError(error);
  }
}

function parseTournamentInput(formData: FormData): TournamentInput {
  const input = {
    title: cleanRequiredText(formData.get("title"), "Event title is required."),
    description: cleanOptionalText(formData.get("description")),
    venueAddress: cleanOptionalText(formData.get("venueAddress")),
    googleMapsUrl: cleanOptionalText(formData.get("googleMapsUrl")),
    eventDate: parseOptionalDateOnly(formData.get("eventDate")),
    registrationOpensAt: parseOptionalDateTime(formData.get("registrationOpensAt")),
    registrationClosesAt: parseOptionalDateTime(formData.get("registrationClosesAt")),
    promptpayId: cleanOptionalText(formData.get("promptpayId")),
    promptpayName: cleanOptionalText(formData.get("promptpayName")),
    bannerUrl: cleanOptionalText(formData.get("existingBannerUrl")),
    bannerAlt: cleanOptionalText(formData.get("bannerAlt")),
  };

  assertWindow(input.registrationOpensAt, input.registrationClosesAt, "Registration close must be after open.");

  if (input.bannerUrl && !isSafeBannerUrl(input.bannerUrl)) {
    throw new Error("Banner URL must start with http://, https://, or /.");
  }

  if (input.googleMapsUrl && !isSafeHttpUrl(input.googleMapsUrl)) {
    throw new Error("Google Maps URL must start with http:// or https://.");
  }

  return input;
}

function parseDivisionsInput(formData: FormData): DivisionInput[] {
  const raw = cleanRequiredText(formData.get("divisionsJson"), "Add at least one division.");
  let payload: unknown;

  try {
    payload = JSON.parse(raw);
  } catch {
    throw new Error("Division data is invalid JSON.");
  }

  if (!Array.isArray(payload) || payload.length === 0) {
    throw new Error("Add at least one division.");
  }

  return payload.map((value, index) => parseDivisionJson(value, index));
}

function parseDivisionJson(value: unknown, index: number): DivisionInput {
  if (typeof value !== "object" || value === null) {
    throw new Error(`Division ${index + 1} is invalid.`);
  }

  const record = value as Record<string, unknown>;
  const timeSlotLabel = cleanOptionalUnknownText(record.timeSlotLabel);

  if (timeSlotLabel && !timeSlotLabels.has(timeSlotLabel)) {
    throw new Error(`Division ${index + 1} has an invalid time slot.`);
  }

  const input = {
    id: parseOptionalUuidFromUnknown(record.id),
    name: cleanRequiredUnknownText(record.name, `Division ${index + 1} name is required.`),
    description: null,
    feeAmount: parseMoneyFromUnknown(record.feeAmount),
    maxPlayers: parseOptionalIntegerFromUnknown(record.maxPlayers),
    minPowerLevel: parseOptionalIntegerFromUnknown(record.minPowerLevel),
    maxPowerLevel: parseOptionalIntegerFromUnknown(record.maxPowerLevel),
    minAge: parseOptionalIntegerFromUnknown(record.minAge),
    maxAge: parseOptionalIntegerFromUnknown(record.maxAge),
    timeSlotLabel: timeSlotLabel ?? "เช้า",
    startsAt: null,
    endsAt: null,
    pairingMethod: "macmahon",
    status: "active" as DivisionStatus,
    sortOrder: index,
  };

  assertNumericWindow(input.minPowerLevel, input.maxPowerLevel, `Division ${index + 1} max power must be at least min power.`);
  assertNumericWindow(input.minAge, input.maxAge, `Division ${index + 1} max age must be at least min age.`);

  return input;
}

function parseDivisionInput(formData: FormData): DivisionInput {
  const input = {
    name: cleanRequiredText(formData.get("name"), "Division name is required."),
    description: cleanOptionalText(formData.get("description")),
    feeAmount: parseMoney(formData.get("feeAmount")),
    maxPlayers: parseOptionalInteger(formData.get("maxPlayers")),
    minPowerLevel: parseOptionalInteger(formData.get("minPowerLevel")),
    maxPowerLevel: parseOptionalInteger(formData.get("maxPowerLevel")),
    minAge: parseOptionalInteger(formData.get("minAge")),
    maxAge: parseOptionalInteger(formData.get("maxAge")),
    timeSlotLabel: cleanOptionalText(formData.get("timeSlotLabel")),
    startsAt: parseOptionalDateTime(formData.get("startsAt")),
    endsAt: parseOptionalDateTime(formData.get("endsAt")),
    pairingMethod: cleanOptionalText(formData.get("pairingMethod")) ?? "macmahon",
    status: divisionStatusSchema.parse(formData.get("status")) as DivisionStatus,
    sortOrder: parseInteger(formData.get("sortOrder"), 0),
  };

  assertNumericWindow(input.minPowerLevel, input.maxPowerLevel, "Max power level must be at least min power level.");
  assertNumericWindow(input.minAge, input.maxAge, "Max age must be at least min age.");
  assertWindow(input.startsAt, input.endsAt, "Division end must be after start.");

  return input;
}

function parsePromoCodeInput(formData: FormData): PromoCodeInput {
  const discountType = discountTypeSchema.parse(formData.get("discountType")) as PromoDiscountType;
  const discountValue = discountType === "free" ? 0 : parseMoney(formData.get("discountValue"));
  const divisionIds = formData
    .getAll("divisionIds")
    .map((value) => uuidSchema.parse(value))
    .filter(Boolean);
  const input = {
    code: cleanRequiredText(formData.get("code"), "Promo code is required.").toUpperCase(),
    description: cleanOptionalText(formData.get("description")),
    discountType,
    discountValue,
    usageLimit: parseOptionalInteger(formData.get("usageLimit")),
    startsAt: parseOptionalDateTime(formData.get("startsAt")),
    endsAt: parseOptionalDateTime(formData.get("endsAt")),
    divisionIds: divisionIds.length > 0 ? divisionIds : null,
    isActive: formData.get("isActive") === "on",
  };

  if (input.discountType === "percentage" && (input.discountValue <= 0 || input.discountValue > 100)) {
    throw new Error("Percentage discount must be between 1 and 100.");
  }

  if (input.discountType === "fixed" && input.discountValue <= 0) {
    throw new Error("Fixed discount must be greater than 0.");
  }

  assertWindow(input.startsAt, input.endsAt, "Promo end must be after start.");

  return input;
}

function cleanRequiredText(value: FormDataEntryValue | null, message: string) {
  const cleaned = cleanOptionalText(value);
  if (!cleaned) {
    throw new Error(message);
  }

  return cleaned;
}

function cleanOptionalText(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value.trim();
  return cleaned.length > 0 ? cleaned : null;
}

function cleanRequiredUnknownText(value: unknown, message: string) {
  const cleaned = cleanOptionalUnknownText(value);
  if (!cleaned) {
    throw new Error(message);
  }

  return cleaned;
}

function cleanOptionalUnknownText(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value.trim();
  return cleaned.length > 0 ? cleaned : null;
}

function parseOptionalDateOnly(value: FormDataEntryValue | null) {
  const cleaned = cleanOptionalText(value);
  if (!cleaned) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    throw new Error(`Invalid date: ${cleaned}`);
  }

  const date = new Date(`${cleaned}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${cleaned}`);
  }

  return cleaned;
}

function parseOptionalDateTime(value: FormDataEntryValue | null) {
  const cleaned = cleanOptionalText(value);
  if (!cleaned) {
    return null;
  }

  const date = new Date(cleaned);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${cleaned}`);
  }

  return date.toISOString();
}

function parseMoney(value: FormDataEntryValue | null) {
  const cleaned = cleanOptionalText(value) ?? "0";
  const amount = Number(cleaned);

  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Amount must be 0 or greater.");
  }

  return Math.round(amount * 100) / 100;
}

function parseMoneyFromUnknown(value: unknown) {
  const cleaned = cleanOptionalUnknownText(value) ?? "0";
  const amount = Number(cleaned);

  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Amount must be 0 or greater.");
  }

  return Math.round(amount * 100) / 100;
}

function parseInteger(value: FormDataEntryValue | null, fallback: number) {
  const cleaned = cleanOptionalText(value);
  if (!cleaned) {
    return fallback;
  }

  const parsed = Number(cleaned);
  if (!Number.isInteger(parsed)) {
    throw new Error("Integer field contains an invalid value.");
  }

  return parsed;
}

function parseOptionalInteger(value: FormDataEntryValue | null) {
  const cleaned = cleanOptionalText(value);
  if (!cleaned) {
    return null;
  }

  const parsed = Number(cleaned);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error("Optional integer fields must be 0 or greater.");
  }

  return parsed;
}

function parseOptionalIntegerFromUnknown(value: unknown) {
  const cleaned = cleanOptionalUnknownText(value);
  if (!cleaned) {
    return null;
  }

  const parsed = Number(cleaned);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error("Optional integer fields must be 0 or greater.");
  }

  return parsed;
}

function parseOptionalUuid(value: FormDataEntryValue | null) {
  const cleaned = cleanOptionalText(value);
  return cleaned ? uuidSchema.parse(cleaned) : undefined;
}

function parseOptionalUuidFromUnknown(value: unknown) {
  const cleaned = cleanOptionalUnknownText(value);
  return cleaned ? uuidSchema.parse(cleaned) : undefined;
}

function parseBannerFile(formData: FormData) {
  const value = formData.get("bannerFile");

  if (typeof File === "undefined" || !(value instanceof File) || value.size === 0) {
    return null;
  }

  return value;
}

function assertWindow(start: string | null, end: string | null, message: string) {
  if (start && end && new Date(end).getTime() < new Date(start).getTime()) {
    throw new Error(message);
  }
}

function assertNumericWindow(min: number | null, max: number | null, message: string) {
  if (min !== null && max !== null && max < min) {
    throw new Error(message);
  }
}

function isSafeBannerUrl(value: string) {
  return value.startsWith("/") || value.startsWith("https://") || value.startsWith("http://");
}

function isSafeHttpUrl(value: string) {
  return value.startsWith("https://") || value.startsWith("http://");
}

function revalidateTournamentPaths(id?: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/tournaments");
  revalidatePath("/tournaments");

  if (id) {
    revalidatePath(`/admin/tournaments/${id}`);
    revalidatePath(`/tournaments/${id}`);
  }
}

function toActionError(error: unknown): TournamentActionState {
  return {
    status: "error",
    message: error instanceof Error ? error.message : "Unexpected tournament action error.",
  };
}
