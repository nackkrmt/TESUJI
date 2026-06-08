import { Buffer } from "node:buffer";
import { z } from "zod";
import { getCurrentAccount, type CurrentAccount } from "@/lib/auth/current-account";
import {
  createPromptPayPayload,
  createPromptPayQrDataUrl,
} from "@/lib/payments/promptpay";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const slipsBucket = "slips";
const maxSlipBytes = 10 * 1024 * 1024;
const allowedSlipTypes = new Set(["image/jpeg", "image/png"]);
const uuidSchema = z.string().uuid();

export type PaymentOrderStatus =
  | "pending_payment"
  | "pending_verify"
  | "confirmed"
  | "rejected"
  | "cancelled"
  | "expired";

export type PaymentRegistrationStatus =
  | "pending_payment"
  | "pending_verify"
  | "confirmed"
  | "waiting_list"
  | "cancelled"
  | "expired"
  | "rejected";

export type PaymentOrderDetail = {
  id: string;
  status: PaymentOrderStatus;
  currency: "THB";
  totalFeeAmount: number;
  discountAmount: number;
  amountDue: number;
  promptpayId: string | null;
  promptpayName: string | null;
  slipUrl: string | null;
  slipStoragePath: string | null;
  signedSlipUrl: string | null;
  paidAt: string | null;
  submittedAt: string | null;
  expiresAt: string | null;
  isExpired: boolean;
  timeRemainingText: string | null;
  createdAt: string;
  updatedAt: string;
  tournament: {
    id: string;
    title: string;
    eventDate: string | null;
    eventStartsAt: string | null;
  };
  registrations: PaymentRegistrationDetail[];
  promptpayPayload: string | null;
  promptpayQrDataUrl: string | null;
  promptpayError: string | null;
};

export type PaymentRegistrationDetail = {
  id: string;
  divisionId: string;
  divisionName: string;
  playerProfileId: string;
  playerName: string;
  rank: string;
  status: PaymentRegistrationStatus;
  feeAmount: number;
  discountAmount: number;
  finalFeeAmount: number;
};

type PaymentOrderRow = {
  id: string;
  account_id: string;
  tournament_id: string;
  status: PaymentOrderStatus;
  currency: "THB";
  total_fee_amount: number | string;
  discount_amount: number | string;
  amount_due: number | string;
  promptpay_id: string | null;
  promptpay_name: string | null;
  slip_url: string | null;
  slip_storage_path: string | null;
  paid_at: string | null;
  submitted_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

type TournamentRow = {
  id: string;
  title?: string | null;
  title_th?: string | null;
  title_en: string | null;
  event_date?: string | null;
  event_starts_at: string | null;
  promptpay_id: string | null;
  promptpay_name: string | null;
};

type RegistrationRow = {
  id: string;
  division_id: string;
  player_profile_id: string;
  registered_by_account_id: string;
  status: PaymentRegistrationStatus;
  fee_amount: number | string;
  discount_amount: number | string;
  final_fee_amount: number | string;
};

type DivisionRow = {
  id: string;
  name: string;
};

type ProfileRow = {
  id: string;
  account_id: string;
  first_name_th: string;
  last_name_th: string;
  rank: string;
};

type SubmitPaymentSlipInput = {
  paymentOrderId: string;
  slipFile: FormDataEntryValue | null;
};

type SubmitPaymentSlipResult = {
  paymentOrderId: string;
  status: PaymentOrderStatus;
  slipStoragePath: string;
  paidAt: string;
  submittedAt: string;
  updatedRegistrations: number;
};

type AdminSupabaseClient = ReturnType<typeof createSupabaseAdminClient>;

export async function getPaymentOrderDetail(
  paymentOrderId: string,
): Promise<PaymentOrderDetail | null> {
  const parsedId = uuidSchema.safeParse(paymentOrderId);

  if (!parsedId.success) {
    return null;
  }

  const account = await getCurrentAccount();

  if (!account) {
    return null;
  }

  const supabase = createSupabaseAdminClient();
  const order = await fetchPaymentOrder(supabase, parsedId.data);

  if (!order) {
    return null;
  }

  const [tournament, registrations] = await Promise.all([
    fetchTournament(supabase, order.tournament_id),
    fetchPaymentRegistrations(supabase, order.id),
  ]);

  if (!tournament) {
    return null;
  }

  const [divisions, profiles] = await Promise.all([
    fetchDivisions(supabase, registrations.map((registration) => registration.division_id)),
    fetchProfiles(supabase, registrations.map((registration) => registration.player_profile_id)),
  ]);

  const allowed = await canAccessPaymentOrder(supabase, account, order, registrations, profiles);

  if (!allowed) {
    return null;
  }

  const promptpayId = order.promptpay_id ?? tournament.promptpay_id;
  const promptpayName = order.promptpay_name ?? tournament.promptpay_name;
  const expiry = getPaymentExpiryState(order.expires_at);
  const promptpay = await buildPromptPayQr({
    amountDue: Number(order.amount_due),
    promptpayId,
    promptpayName,
    status: order.status,
  });
  const signedSlipUrl = order.slip_storage_path
    ? await createSignedSlipUrl(supabase, order.slip_storage_path)
    : null;

  return {
    id: order.id,
    status: order.status,
    currency: order.currency,
    totalFeeAmount: Number(order.total_fee_amount),
    discountAmount: Number(order.discount_amount),
    amountDue: Number(order.amount_due),
    promptpayId,
    promptpayName,
    slipUrl: order.slip_url,
    slipStoragePath: order.slip_storage_path,
    signedSlipUrl,
    paidAt: order.paid_at,
    submittedAt: order.submitted_at,
    expiresAt: order.expires_at,
    isExpired: expiry.isExpired,
    timeRemainingText: expiry.timeRemainingText,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    tournament: {
      id: tournament.id,
      title: tournament.title ?? tournament.title_th ?? tournament.title_en ?? "Untitled tournament",
      eventDate: tournament.event_date ?? null,
      eventStartsAt: tournament.event_starts_at,
    },
    registrations: registrations.map((registration) =>
      mapRegistration(registration, divisions, profiles),
    ),
    promptpayPayload: promptpay.payload,
    promptpayQrDataUrl: promptpay.qrDataUrl,
    promptpayError: promptpay.error,
  };
}

export async function submitPaymentSlip({
  paymentOrderId,
  slipFile,
}: SubmitPaymentSlipInput): Promise<SubmitPaymentSlipResult> {
  const parsedId = uuidSchema.parse(paymentOrderId);
  const file = validateSlipFile(slipFile);
  const account = await getCurrentAccount();

  if (!account) {
    throw new Error("Please log in before uploading a payment slip.");
  }

  const supabase = createSupabaseAdminClient();
  const order = await fetchPaymentOrder(supabase, parsedId);

  if (!order) {
    throw new Error("Payment order not found.");
  }

  const registrations = await fetchPaymentRegistrations(supabase, order.id);
  const profiles = await fetchProfiles(
    supabase,
    registrations.map((registration) => registration.player_profile_id),
  );
  const allowed = await canAccessPaymentOrder(supabase, account, order, registrations, profiles);

  if (!allowed) {
    throw new Error("Cannot update this payment order.");
  }

  if (order.status !== "pending_payment") {
    throw new Error("Payment order is not pending payment.");
  }

  if (Number(order.amount_due) <= 0) {
    throw new Error("Payment order does not require payment.");
  }

  if (order.expires_at && new Date(order.expires_at).getTime() < Date.now()) {
    throw new Error("Payment order expired.");
  }

  const extension = getSlipExtension(file);
  const storagePath = `${order.tournament_id}/${order.id}/${crypto.randomUUID()}.${extension}`;
  const storageUrl = `storage://${slipsBucket}/${storagePath}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage.from(slipsBucket).upload(storagePath, bytes, {
    contentType: file.type,
    upsert: false,
  });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  try {
    const { data, error } = await supabase.rpc("submit_payment_slip", {
      p_actor_account_id: account.userId,
      p_payment_order_id: order.id,
      p_slip_url: storageUrl,
      p_slip_storage_path: storagePath,
      p_paid_at: new Date().toISOString(),
    });

    if (error) {
      throw error;
    }

    return submitPaymentSlipResultSchema.parse(data);
  } catch (error) {
    await supabase.storage.from(slipsBucket).remove([storagePath]).catch(() => undefined);
    throw error;
  }
}

async function fetchPaymentOrder(
  supabase: AdminSupabaseClient,
  paymentOrderId: string,
) {
  const { data, error } = await supabase
    .from("payment_orders")
    .select("*")
    .eq("id", paymentOrderId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as PaymentOrderRow | null;
}

async function fetchTournament(supabase: AdminSupabaseClient, tournamentId: string) {
  const { data, error } = await supabase
    .from("tournaments")
    .select("id,title,title_en,event_date,event_starts_at,promptpay_id,promptpay_name")
    .eq("id", tournamentId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as TournamentRow | null;
}

async function fetchPaymentRegistrations(
  supabase: AdminSupabaseClient,
  paymentOrderId: string,
) {
  const { data, error } = await supabase
    .from("registrations")
    .select("id,division_id,player_profile_id,registered_by_account_id,status,fee_amount,discount_amount,final_fee_amount")
    .eq("payment_order_id", paymentOrderId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as RegistrationRow[];
}

async function fetchDivisions(supabase: AdminSupabaseClient, divisionIds: string[]) {
  const uniqueIds = [...new Set(divisionIds)];

  if (uniqueIds.length === 0) {
    return new Map<string, DivisionRow>();
  }

  const { data, error } = await supabase
    .from("divisions")
    .select("id,name")
    .in("id", uniqueIds);

  if (error) {
    throw error;
  }

  return new Map(((data ?? []) as DivisionRow[]).map((division) => [division.id, division]));
}

async function fetchProfiles(supabase: AdminSupabaseClient, profileIds: string[]) {
  const uniqueIds = [...new Set(profileIds)];

  if (uniqueIds.length === 0) {
    return new Map<string, ProfileRow>();
  }

  const { data, error } = await supabase
    .from("player_profiles")
    .select("id,account_id,first_name_th,last_name_th,rank")
    .in("id", uniqueIds);

  if (error) {
    throw error;
  }

  return new Map(((data ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]));
}

async function canAccessPaymentOrder(
  supabase: AdminSupabaseClient,
  account: CurrentAccount,
  order: PaymentOrderRow,
  registrations: RegistrationRow[],
  profiles: Map<string, ProfileRow>,
) {
  if (account.roles.some((role) => role.role === "admin" && role.status === "active")) {
    return true;
  }

  if (order.account_id === account.userId) {
    return true;
  }

  if (registrations.some((registration) => registration.registered_by_account_id === account.userId)) {
    return true;
  }

  if ([...profiles.values()].some((profile) => profile.account_id === account.userId)) {
    return true;
  }

  if (!account.roles.some((role) => role.role === "coach" && role.status === "active")) {
    return false;
  }

  const profileIds = [...profiles.keys()];

  if (profileIds.length === 0) {
    return false;
  }

  const { count, error } = await supabase
    .from("coach_player_links")
    .select("id", { count: "exact", head: true })
    .eq("coach_account_id", account.userId)
    .eq("status", "approved")
    .in("player_profile_id", profileIds);

  if (error) {
    throw error;
  }

  return Boolean(count);
}

async function buildPromptPayQr({
  amountDue,
  promptpayId,
  promptpayName,
  status,
}: {
  amountDue: number;
  promptpayId: string | null;
  promptpayName: string | null;
  status: PaymentOrderStatus;
}) {
  if (status !== "pending_payment" || amountDue <= 0) {
    return { error: null, payload: null, qrDataUrl: null };
  }

  if (!promptpayId) {
    return {
      error: "This tournament has no PromptPay ID configured.",
      payload: null,
      qrDataUrl: null,
    };
  }

  try {
    const payload = createPromptPayPayload({
      amount: amountDue,
      merchantName: promptpayName,
      promptpayId,
    });

    return {
      error: null,
      payload,
      qrDataUrl: await createPromptPayQrDataUrl(payload),
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not generate PromptPay QR.",
      payload: null,
      qrDataUrl: null,
    };
  }
}

async function createSignedSlipUrl(supabase: AdminSupabaseClient, storagePath: string) {
  const { data, error } = await supabase.storage
    .from(slipsBucket)
    .createSignedUrl(storagePath, 60 * 10);

  if (error) {
    return null;
  }

  return data.signedUrl;
}

function mapRegistration(
  registration: RegistrationRow,
  divisions: Map<string, DivisionRow>,
  profiles: Map<string, ProfileRow>,
): PaymentRegistrationDetail {
  const profile = profiles.get(registration.player_profile_id);

  return {
    id: registration.id,
    divisionId: registration.division_id,
    divisionName: divisions.get(registration.division_id)?.name ?? registration.division_id,
    playerProfileId: registration.player_profile_id,
    playerName: profile ? `${profile.first_name_th} ${profile.last_name_th}` : registration.player_profile_id,
    rank: profile?.rank ?? "-",
    status: registration.status,
    feeAmount: Number(registration.fee_amount),
    discountAmount: Number(registration.discount_amount),
    finalFeeAmount: Number(registration.final_fee_amount),
  };
}

const submitPaymentSlipResultSchema = z.object({
  paymentOrderId: z.string().uuid(),
  status: z.enum([
    "pending_payment",
    "pending_verify",
    "confirmed",
    "rejected",
    "cancelled",
    "expired",
  ]),
  slipStoragePath: z.string(),
  paidAt: z.string(),
  submittedAt: z.string(),
  updatedRegistrations: z.coerce.number().int().positive(),
});

function validateSlipFile(value: FormDataEntryValue | null) {
  if (!isUploadedFile(value) || value.size === 0) {
    throw new Error("Please choose a payment slip image.");
  }

  if (!allowedSlipTypes.has(value.type)) {
    throw new Error("Payment slip must be a JPG or PNG image.");
  }

  if (value.size > maxSlipBytes) {
    throw new Error("Payment slip must be 10MB or smaller.");
  }

  return value;
}

function isUploadedFile(value: FormDataEntryValue | null): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    "arrayBuffer" in value &&
    "name" in value &&
    "size" in value &&
    typeof value.name === "string" &&
    typeof value.size === "number"
  );
}

function getSlipExtension(file: File) {
  return file.type === "image/png" ? "png" : "jpg";
}

function getPaymentExpiryState(expiresAt: string | null) {
  if (!expiresAt) {
    return {
      isExpired: false,
      timeRemainingText: null,
    };
  }

  const remainingMs = new Date(expiresAt).getTime() - Date.now();

  if (remainingMs <= 0) {
    return {
      isExpired: true,
      timeRemainingText: "0 นาที",
    };
  }

  const totalMinutes = Math.ceil(remainingMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return {
    isExpired: false,
    timeRemainingText:
      hours <= 0
        ? `${minutes.toLocaleString("th-TH")} นาที`
        : `${hours.toLocaleString("th-TH")} ชม. ${minutes.toLocaleString("th-TH")} นาที`,
  };
}
