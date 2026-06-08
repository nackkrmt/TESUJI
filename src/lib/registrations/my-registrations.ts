import { z } from "zod";
import { getCurrentAccount, type CurrentAccount } from "@/lib/auth/current-account";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type MyRegistrationStatus =
  | "pending_payment"
  | "pending_verify"
  | "confirmed"
  | "waiting_list"
  | "cancelled"
  | "expired"
  | "rejected";

export type MyPaymentStatus =
  | "pending_payment"
  | "pending_verify"
  | "confirmed"
  | "rejected"
  | "cancelled"
  | "expired";

export type MyRegistrationSummary = {
  id: string;
  status: MyRegistrationStatus;
  source: "self" | "coach" | "admin";
  tournamentId: string;
  tournamentTitle: string;
  eventDate: string | null;
  eventStartsAt: string | null;
  divisionName: string;
  playerName: string;
  playerRank: string;
  paymentOrderId: string | null;
  paymentStatus: MyPaymentStatus | null;
  paymentAmountDue: number | null;
  waitingListPosition: number | null;
  finalFeeAmount: number;
  createdAt: string;
  canCancel: boolean;
  cancelUnavailableReason: string | null;
};

export type MyRegistrationDetail = MyRegistrationSummary & {
  feeAmount: number;
  discountAmount: number;
  confirmedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  paymentExpiresAt: string | null;
  paymentPaidAt: string | null;
  paymentSubmittedAt: string | null;
  paymentSlipStoragePath: string | null;
  signedSlipUrl: string | null;
  isPaymentExpired: boolean;
  paymentTimeRemainingText: string | null;
  waitingListPromotionDeferred: boolean;
};

export type CancelRegistrationResult = {
  registrationId: string;
  status: "cancelled";
  paymentOrderId: string | null;
  paymentOrderStatus: MyPaymentStatus | null;
  remainingPaymentRegistrations: number;
  waitingListPromotionDeferred: boolean;
  waitingListPromotion: WaitingListPromotion | null;
};

export type WaitingListPromotion = {
  promoted: boolean;
  divisionId?: string;
  registrationId?: string;
  status?: MyRegistrationStatus;
  paymentOrderId?: string | null;
  reason?: string;
};

type RegistrationRow = {
  id: string;
  tournament_id: string;
  division_id: string;
  player_profile_id: string;
  registered_by_account_id: string;
  payment_order_id: string | null;
  status: MyRegistrationStatus;
  source: "self" | "coach" | "admin";
  fee_amount: number | string;
  discount_amount: number | string;
  final_fee_amount: number | string;
  waiting_list_position: number | null;
  confirmed_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
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

type PaymentOrderRow = {
  id: string;
  status: MyPaymentStatus;
  amount_due: number | string;
  expires_at: string | null;
  paid_at: string | null;
  submitted_at: string | null;
  slip_storage_path: string | null;
};

type CoachLinkRow = {
  player_profile_id: string;
};

type AdminSupabaseClient = ReturnType<typeof createSupabaseAdminClient>;

const slipsBucket = "slips";
const uuidSchema = z.string().uuid();
const cancelRegistrationInputSchema = z.object({
  registrationId: z.string().uuid(),
  reason: z.string().trim().min(1, "กรุณาระบุเหตุผลในการยกเลิก").max(500, "เหตุผลต้องไม่เกิน 500 ตัวอักษร"),
});
const cancelRegistrationResultSchema = z.object({
  registrationId: z.string().uuid(),
  status: z.literal("cancelled"),
  paymentOrderId: z.string().uuid().nullable(),
  paymentOrderStatus: z
    .enum(["pending_payment", "pending_verify", "confirmed", "rejected", "cancelled", "expired"])
    .nullable(),
  remainingPaymentRegistrations: z.coerce.number().int().nonnegative(),
  waitingListPromotionDeferred: z.boolean().default(false),
  waitingListPromotion: z
    .object({
      promoted: z.boolean(),
      divisionId: z.string().uuid().optional(),
      registrationId: z.string().uuid().optional(),
      status: z
        .enum([
          "pending_payment",
          "pending_verify",
          "confirmed",
          "waiting_list",
          "cancelled",
          "expired",
          "rejected",
        ])
        .optional(),
      paymentOrderId: z.string().uuid().nullable().optional(),
      reason: z.string().optional(),
    })
    .passthrough()
    .nullable()
    .optional()
    .default(null),
});

export async function getMyRegistrations(): Promise<MyRegistrationSummary[] | null> {
  const account = await getCurrentAccount();

  if (!account) {
    return null;
  }

  const supabase = createSupabaseAdminClient();
  const profileIds = await getAccessibleProfileIds(supabase, account);
  const registrations = await fetchRegistrationsForProfiles(supabase, profileIds);

  return buildRegistrationSummaries(supabase, registrations);
}

export async function getMyRegistrationDetail(
  registrationId: string,
): Promise<MyRegistrationDetail | null> {
  const parsedId = uuidSchema.safeParse(registrationId);

  if (!parsedId.success) {
    return null;
  }

  const account = await getCurrentAccount();

  if (!account) {
    return null;
  }

  const supabase = createSupabaseAdminClient();
  const registration = await fetchRegistrationById(supabase, parsedId.data);

  if (!registration) {
    return null;
  }

  const allowed = await canAccessRegistration(supabase, account, registration);

  if (!allowed) {
    return null;
  }

  const [summary] = await buildRegistrationSummaries(supabase, [registration]);

  if (!summary) {
    return null;
  }

  const payment = registration.payment_order_id
    ? await fetchPaymentOrders(supabase, [registration.payment_order_id])
    : new Map<string, PaymentOrderRow>();
  const paymentOrder = registration.payment_order_id ? payment.get(registration.payment_order_id) ?? null : null;
  const paymentExpiry = getPaymentExpiryState(paymentOrder?.expires_at ?? null);
  const signedSlipUrl = paymentOrder?.slip_storage_path
    ? await createSignedSlipUrl(supabase, paymentOrder.slip_storage_path)
    : null;

  return {
    ...summary,
    feeAmount: Number(registration.fee_amount),
    discountAmount: Number(registration.discount_amount),
    confirmedAt: registration.confirmed_at,
    cancelledAt: registration.cancelled_at,
    cancellationReason: registration.cancellation_reason,
    paymentExpiresAt: paymentOrder?.expires_at ?? null,
    paymentPaidAt: paymentOrder?.paid_at ?? null,
    paymentSubmittedAt: paymentOrder?.submitted_at ?? null,
    paymentSlipStoragePath: paymentOrder?.slip_storage_path ?? null,
    signedSlipUrl,
    isPaymentExpired: paymentExpiry.isExpired,
    paymentTimeRemainingText: paymentExpiry.timeRemainingText,
    waitingListPromotionDeferred: false,
  };
}

export async function cancelMyRegistration(input: {
  registrationId: string;
  reason: string;
}): Promise<CancelRegistrationResult> {
  const parsed = cancelRegistrationInputSchema.parse(input);
  const account = await getCurrentAccount();

  if (!account) {
    throw new Error("กรุณาเข้าสู่ระบบก่อนยกเลิกรายการสมัคร");
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("cancel_registration", {
    p_actor_account_id: account.userId,
    p_registration_id: parsed.registrationId,
    p_cancellation_reason: parsed.reason,
  });

  if (error) {
    throw new Error(error.message);
  }

  return cancelRegistrationResultSchema.parse(data);
}

async function fetchRegistrationsForProfiles(
  supabase: AdminSupabaseClient,
  profileIds: string[],
) {
  if (profileIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("registrations")
    .select(
      "id,tournament_id,division_id,player_profile_id,registered_by_account_id,payment_order_id,status,source,fee_amount,discount_amount,final_fee_amount,waiting_list_position,confirmed_at,cancelled_at,cancellation_reason,created_at,updated_at",
    )
    .in("player_profile_id", profileIds)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as RegistrationRow[];
}

async function fetchRegistrationById(supabase: AdminSupabaseClient, registrationId: string) {
  const { data, error } = await supabase
    .from("registrations")
    .select(
      "id,tournament_id,division_id,player_profile_id,registered_by_account_id,payment_order_id,status,source,fee_amount,discount_amount,final_fee_amount,waiting_list_position,confirmed_at,cancelled_at,cancellation_reason,created_at,updated_at",
    )
    .eq("id", registrationId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as RegistrationRow | null;
}

async function buildRegistrationSummaries(
  supabase: AdminSupabaseClient,
  registrations: RegistrationRow[],
) {
  if (registrations.length === 0) {
    return [];
  }

  const [tournaments, divisions, profiles, paymentOrders] = await Promise.all([
    fetchTournaments(supabase, registrations.map((registration) => registration.tournament_id)),
    fetchDivisions(supabase, registrations.map((registration) => registration.division_id)),
    fetchProfiles(supabase, registrations.map((registration) => registration.player_profile_id)),
    fetchPaymentOrders(
      supabase,
      registrations
        .map((registration) => registration.payment_order_id)
        .filter((paymentOrderId): paymentOrderId is string => Boolean(paymentOrderId)),
    ),
  ]);

  return registrations.map((registration) => {
    const tournament = tournaments.get(registration.tournament_id);
    const division = divisions.get(registration.division_id);
    const profile = profiles.get(registration.player_profile_id);
    const paymentOrder = registration.payment_order_id
      ? paymentOrders.get(registration.payment_order_id) ?? null
      : null;
    const cancelState = getCancelState(registration, tournament);

    return {
      id: registration.id,
      status: registration.status,
      source: registration.source,
      tournamentId: registration.tournament_id,
      tournamentTitle: getTournamentTitle(tournament),
      eventDate: tournament?.event_date ?? null,
      eventStartsAt: tournament?.event_starts_at ?? null,
      divisionName: division?.name ?? registration.division_id,
      playerName: profile ? `${profile.first_name_th} ${profile.last_name_th}` : registration.player_profile_id,
      playerRank: profile?.rank ?? "-",
      paymentOrderId: registration.payment_order_id,
      paymentStatus: paymentOrder?.status ?? null,
      paymentAmountDue: paymentOrder ? Number(paymentOrder.amount_due) : null,
      waitingListPosition: registration.waiting_list_position,
      finalFeeAmount: Number(registration.final_fee_amount),
      createdAt: registration.created_at,
      canCancel: cancelState.canCancel,
      cancelUnavailableReason: cancelState.reason,
    };
  });
}

async function getAccessibleProfileIds(
  supabase: AdminSupabaseClient,
  account: CurrentAccount,
) {
  const profileIds = account.profile ? [account.profile.id] : [];
  const isActiveCoach = account.roles.some((role) => role.role === "coach" && role.status === "active");

  if (!isActiveCoach) {
    return profileIds;
  }

  const { data, error } = await supabase
    .from("coach_player_links")
    .select("player_profile_id")
    .eq("coach_account_id", account.userId)
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

async function canAccessRegistration(
  supabase: AdminSupabaseClient,
  account: CurrentAccount,
  registration: RegistrationRow,
) {
  if (account.roles.some((role) => role.role === "admin" && role.status === "active")) {
    return true;
  }

  if (registration.registered_by_account_id === account.userId) {
    return true;
  }

  if (account.profile?.id === registration.player_profile_id) {
    return true;
  }

  if (!account.roles.some((role) => role.role === "coach" && role.status === "active")) {
    return false;
  }

  const { count, error } = await supabase
    .from("coach_player_links")
    .select("id", { count: "exact", head: true })
    .eq("coach_account_id", account.userId)
    .eq("player_profile_id", registration.player_profile_id)
    .eq("status", "approved");

  if (error) {
    throw error;
  }

  return Boolean(count);
}

async function fetchTournaments(supabase: AdminSupabaseClient, tournamentIds: string[]) {
  const uniqueIds = [...new Set(tournamentIds)];

  if (uniqueIds.length === 0) {
    return new Map<string, TournamentRow>();
  }

  const { data, error } = await supabase
    .from("tournaments")
    .select("id,title,title_en,event_date,event_starts_at")
    .in("id", uniqueIds);

  if (error) {
    throw error;
  }

  return new Map(((data ?? []) as TournamentRow[]).map((tournament) => [tournament.id, tournament]));
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

async function fetchPaymentOrders(supabase: AdminSupabaseClient, paymentOrderIds: string[]) {
  const uniqueIds = [...new Set(paymentOrderIds)];

  if (uniqueIds.length === 0) {
    return new Map<string, PaymentOrderRow>();
  }

  const { data, error } = await supabase
    .from("payment_orders")
    .select("id,status,amount_due,expires_at,paid_at,submitted_at,slip_storage_path")
    .in("id", uniqueIds);

  if (error) {
    throw error;
  }

  return new Map(((data ?? []) as PaymentOrderRow[]).map((paymentOrder) => [paymentOrder.id, paymentOrder]));
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

function getTournamentTitle(tournament: TournamentRow | undefined) {
  return tournament?.title ?? tournament?.title_th ?? tournament?.title_en ?? "Untitled tournament";
}

function getCancelState(registration: RegistrationRow, tournament: TournamentRow | undefined) {
  if (registration.status === "cancelled") {
    return { canCancel: false, reason: "รายการนี้ถูกยกเลิกแล้ว" };
  }

  if (registration.status === "expired") {
    return { canCancel: false, reason: "รายการนี้หมดเวลาแล้ว" };
  }

  if (registration.status === "rejected") {
    return { canCancel: false, reason: "รายการนี้ไม่ผ่านการตรวจสอบ" };
  }

  if (registration.status === "pending_verify") {
    return { canCancel: false, reason: "ส่งสลิปแล้ว กรุณารอ Admin ตรวจสอบหรือแจ้ง Admin เพื่อยกเลิก" };
  }

  if (isOnOrAfterEventDate(tournament)) {
    return { canCancel: false, reason: "เลยวันแข่งขันแล้ว ไม่สามารถยกเลิกผ่านระบบได้" };
  }

  return { canCancel: true, reason: null };
}

function isOnOrAfterEventDate(tournament: TournamentRow | undefined) {
  const eventDate = tournament?.event_date ?? tournament?.event_starts_at?.slice(0, 10) ?? null;

  if (!eventDate) {
    return false;
  }

  const formatter = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Bangkok",
    year: "numeric",
  });
  const todayBangkok = formatter.format(new Date());

  return todayBangkok >= eventDate;
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
