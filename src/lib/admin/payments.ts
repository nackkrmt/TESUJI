import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ensureAdminMutationAllowedForDevMode } from "@/lib/tournaments/admin";

const slipsBucket = "slips";

export type AdminPaymentOrderStatus =
  | "pending_payment"
  | "pending_verify"
  | "confirmed"
  | "rejected"
  | "cancelled"
  | "expired";

export type AdminPaymentRegistrationStatus =
  | "pending_payment"
  | "pending_verify"
  | "confirmed"
  | "waiting_list"
  | "cancelled"
  | "expired"
  | "rejected";

export type AdminPaymentReviewAction = "approve" | "reject_send_new" | "reject_cancel";

export type AdminPaymentOrder = {
  id: string;
  status: AdminPaymentOrderStatus;
  currency: "THB";
  totalFeeAmount: number;
  discountAmount: number;
  amountDue: number;
  slipStoragePath: string | null;
  signedSlipUrl: string | null;
  paidAt: string | null;
  submittedAt: string | null;
  expiresAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  account: {
    id: string;
    email: string;
    phone: string;
  };
  tournament: {
    id: string;
    title: string;
    eventDate: string | null;
    eventStartsAt: string | null;
  };
  registrations: AdminPaymentRegistration[];
};

export type AdminPaymentRegistration = {
  id: string;
  divisionId: string;
  divisionName: string;
  playerProfileId: string;
  playerName: string;
  playerRank: string;
  status: AdminPaymentRegistrationStatus;
  feeAmount: number;
  discountAmount: number;
  finalFeeAmount: number;
};

export type ReviewPaymentOrderResult = {
  paymentOrderId: string;
  status: AdminPaymentOrderStatus;
  updatedRegistrations: number;
  waitingListPromotionDeferred: boolean;
  promotedRegistrations: number;
  promotions: WaitingListPromotion[];
};

export type WaitingListPromotion = {
  promoted: boolean;
  divisionId?: string;
  registrationId?: string;
  status?: AdminPaymentRegistrationStatus;
  paymentOrderId?: string | null;
  reason?: string;
};

export type PaymentTimeoutLifecycleResult = {
  expiredPaymentOrders: number;
  expiredRegistrations: number;
  promotedRegistrations: number;
  promotions: WaitingListPromotion[];
};

type PaymentOrderRow = {
  id: string;
  account_id: string;
  tournament_id: string;
  status: AdminPaymentOrderStatus;
  currency: "THB";
  total_fee_amount: number | string;
  discount_amount: number | string;
  amount_due: number | string;
  slip_storage_path: string | null;
  paid_at: string | null;
  submitted_at: string | null;
  expires_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
};

type AccountRow = {
  id: string;
  email: string;
  phone: string;
};

type TournamentRow = {
  id: string;
  title?: string | null;
  title_th?: string | null;
  title_en: string | null;
  event_date?: string | null;
  event_starts_at: string | null;
};

type RegistrationRow = {
  id: string;
  payment_order_id: string;
  division_id: string;
  player_profile_id: string;
  status: AdminPaymentRegistrationStatus;
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
  first_name_th: string;
  last_name_th: string;
  rank: string;
};

type AdminSupabaseClient = ReturnType<typeof createSupabaseAdminClient>;

const reviewPaymentInputSchema = z
  .object({
    action: z.enum(["approve", "reject_send_new", "reject_cancel"]),
    paymentOrderId: z.string().uuid(),
    reason: z.string().trim().max(500, "Reason must be 500 characters or fewer.").optional(),
  })
  .superRefine((value, context) => {
    if (value.action !== "approve" && !value.reason) {
      context.addIssue({
        code: "custom",
        message: "Reason is required for rejection.",
        path: ["reason"],
      });
    }
  });

const reviewPaymentResultSchema = z.object({
  paymentOrderId: z.string().uuid(),
  status: z.enum([
    "pending_payment",
    "pending_verify",
    "confirmed",
    "rejected",
    "cancelled",
    "expired",
  ]),
  updatedRegistrations: z.coerce.number().int().positive(),
  waitingListPromotionDeferred: z.boolean(),
  promotedRegistrations: z.coerce.number().int().nonnegative().default(0),
  promotions: z.array(z.object({
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
  }).passthrough()).default([]),
});

const paymentTimeoutLifecycleResultSchema = z.object({
  expiredPaymentOrders: z.coerce.number().int().nonnegative(),
  expiredRegistrations: z.coerce.number().int().nonnegative(),
  promotedRegistrations: z.coerce.number().int().nonnegative(),
  promotions: z.array(z.object({
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
  }).passthrough()).default([]),
});

export async function getPendingPaymentOrders(): Promise<AdminPaymentOrder[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("payment_orders")
    .select(
      "id,account_id,tournament_id,status,currency,total_fee_amount,discount_amount,amount_due,slip_storage_path,paid_at,submitted_at,expires_at,rejection_reason,created_at,updated_at",
    )
    .eq("status", "pending_verify")
    .order("submitted_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const orders = (data ?? []) as PaymentOrderRow[];

  if (orders.length === 0) {
    return [];
  }

  const registrations = await fetchRegistrations(
    supabase,
    orders.map((order) => order.id),
  );
  const [accounts, tournaments, divisions, profiles] = await Promise.all([
    fetchAccounts(supabase, orders.map((order) => order.account_id)),
    fetchTournaments(supabase, orders.map((order) => order.tournament_id)),
    fetchDivisions(supabase, registrations.map((registration) => registration.division_id)),
    fetchProfiles(supabase, registrations.map((registration) => registration.player_profile_id)),
  ]);

  const signedSlipUrls = new Map<string, string | null>();
  await Promise.all(
    orders.map(async (order) => {
      signedSlipUrls.set(
        order.id,
        order.slip_storage_path ? await createSignedSlipUrl(supabase, order.slip_storage_path) : null,
      );
    }),
  );

  const registrationsByPaymentOrderId = groupRegistrationsByPaymentOrderId(registrations);

  return orders.map((order) =>
    mapPaymentOrder({
      account: accounts.get(order.account_id),
      order,
      registrations: registrationsByPaymentOrderId.get(order.id) ?? [],
      signedSlipUrl: signedSlipUrls.get(order.id) ?? null,
      tournament: tournaments.get(order.tournament_id),
      divisions,
      profiles,
    }),
  );
}

export async function reviewPaymentOrder(input: {
  action: AdminPaymentReviewAction;
  paymentOrderId: string;
  reason?: string;
}): Promise<ReviewPaymentOrderResult> {
  ensureAdminMutationAllowedForDevMode();

  const parsed = reviewPaymentInputSchema.parse(input);
  const supabase = createSupabaseAdminClient();
  const adminAccountId = getAdminActorAccountIdForDevMode();

  const rpc =
    parsed.action === "approve"
      ? supabase.rpc("approve_payment_order", {
          p_admin_account_id: adminAccountId,
          p_payment_order_id: parsed.paymentOrderId,
        })
      : parsed.action === "reject_send_new"
        ? supabase.rpc("reject_payment_order_send_new", {
            p_admin_account_id: adminAccountId,
            p_payment_order_id: parsed.paymentOrderId,
            p_rejection_reason: parsed.reason ?? "",
          })
        : supabase.rpc("reject_payment_order_cancel", {
            p_admin_account_id: adminAccountId,
            p_payment_order_id: parsed.paymentOrderId,
            p_rejection_reason: parsed.reason ?? "",
          });

  const { data, error } = await rpc;

  if (error) {
    throw new Error(error.message);
  }

  return reviewPaymentResultSchema.parse(data);
}

export async function runPaymentTimeoutLifecycle(input?: {
  limit?: number;
}): Promise<PaymentTimeoutLifecycleResult> {
  ensureAdminMutationAllowedForDevMode();

  const limit = input?.limit && Number.isInteger(input.limit) && input.limit > 0 ? input.limit : 100;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("expire_pending_payment_orders", {
    p_limit: limit,
    p_payment_expires_at: null,
  });

  if (error) {
    throw new Error(error.message);
  }

  return paymentTimeoutLifecycleResultSchema.parse(data);
}

function getAdminActorAccountIdForDevMode() {
  // Dev mode intentionally leaves Admin routes unprotected. Future production auth should
  // return the logged-in account id after checking account_roles.admin = active.
  return null;
}

async function fetchAccounts(supabase: AdminSupabaseClient, accountIds: string[]) {
  const uniqueIds = [...new Set(accountIds)];

  if (uniqueIds.length === 0) {
    return new Map<string, AccountRow>();
  }

  const { data, error } = await supabase
    .from("accounts")
    .select("id,email,phone")
    .in("id", uniqueIds);

  if (error) {
    throw error;
  }

  return new Map(((data ?? []) as AccountRow[]).map((account) => [account.id, account]));
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

async function fetchRegistrations(
  supabase: AdminSupabaseClient,
  paymentOrderIds: string[],
) {
  const uniqueIds = [...new Set(paymentOrderIds)];

  if (uniqueIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("registrations")
    .select(
      "id,payment_order_id,division_id,player_profile_id,status,fee_amount,discount_amount,final_fee_amount",
    )
    .in("payment_order_id", uniqueIds)
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
    .select("id,first_name_th,last_name_th,rank")
    .in("id", uniqueIds);

  if (error) {
    throw error;
  }

  return new Map(((data ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]));
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

function groupRegistrationsByPaymentOrderId(registrations: RegistrationRow[]) {
  const groups = new Map<string, RegistrationRow[]>();

  for (const registration of registrations) {
    const existing = groups.get(registration.payment_order_id) ?? [];
    existing.push(registration);
    groups.set(registration.payment_order_id, existing);
  }

  return groups;
}

function mapPaymentOrder({
  account,
  divisions,
  order,
  profiles,
  registrations,
  signedSlipUrl,
  tournament,
}: {
  account: AccountRow | undefined;
  divisions: Map<string, DivisionRow>;
  order: PaymentOrderRow;
  profiles: Map<string, ProfileRow>;
  registrations: RegistrationRow[];
  signedSlipUrl: string | null;
  tournament: TournamentRow | undefined;
}): AdminPaymentOrder {
  return {
    id: order.id,
    status: order.status,
    currency: order.currency,
    totalFeeAmount: Number(order.total_fee_amount),
    discountAmount: Number(order.discount_amount),
    amountDue: Number(order.amount_due),
    slipStoragePath: order.slip_storage_path,
    signedSlipUrl,
    paidAt: order.paid_at,
    submittedAt: order.submitted_at,
    expiresAt: order.expires_at,
    rejectionReason: order.rejection_reason,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    account: {
      id: order.account_id,
      email: account?.email ?? "Unknown account",
      phone: account?.phone ?? "-",
    },
    tournament: {
      id: order.tournament_id,
      title: getTournamentTitle(tournament),
      eventDate: tournament?.event_date ?? null,
      eventStartsAt: tournament?.event_starts_at ?? null,
    },
    registrations: registrations.map((registration) =>
      mapRegistration(registration, divisions, profiles),
    ),
  };
}

function mapRegistration(
  registration: RegistrationRow,
  divisions: Map<string, DivisionRow>,
  profiles: Map<string, ProfileRow>,
): AdminPaymentRegistration {
  const profile = profiles.get(registration.player_profile_id);

  return {
    id: registration.id,
    divisionId: registration.division_id,
    divisionName: divisions.get(registration.division_id)?.name ?? registration.division_id,
    playerProfileId: registration.player_profile_id,
    playerName: profile ? `${profile.first_name_th} ${profile.last_name_th}` : registration.player_profile_id,
    playerRank: profile?.rank ?? "-",
    status: registration.status,
    feeAmount: Number(registration.fee_amount),
    discountAmount: Number(registration.discount_amount),
    finalFeeAmount: Number(registration.final_fee_amount),
  };
}

function getTournamentTitle(tournament: TournamentRow | undefined) {
  return tournament?.title ?? tournament?.title_th ?? tournament?.title_en ?? "Untitled tournament";
}
