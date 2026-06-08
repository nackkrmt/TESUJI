import { z } from "zod";
import { getCurrentAccount } from "@/lib/auth/current-account";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type RegistrationStatus =
  | "pending_payment"
  | "pending_verify"
  | "confirmed"
  | "waiting_list"
  | "cancelled"
  | "expired"
  | "rejected";

export type RegistrationTransactionStatus =
  | "pending_payment"
  | "confirmed"
  | "waiting_list"
  | "mixed";

export type RegistrationTransactionInput = {
  tournamentId?: string | null;
  playerProfileId: string;
  divisionIds: string[];
  promoCode?: string | null;
};

export type RegistrationTransactionRegistration = {
  id: string;
  divisionId: string;
  status: RegistrationStatus;
  feeAmount: number;
  discountAmount: number;
  finalFeeAmount: number;
  waitingListPosition: number | null;
};

export type RegistrationTransactionResult = {
  status: RegistrationTransactionStatus;
  tournamentId: string;
  playerProfileId: string;
  registeredByAccountId: string;
  paymentOrderId: string | null;
  totalFeeAmount: number;
  discountAmount: number;
  amountDue: number;
  promoCodeId: string | null;
  promoCode: string | null;
  promoCodeUsageIds: string[];
  registrations: RegistrationTransactionRegistration[];
};

const registrationTransactionInputSchema = z.object({
  tournamentId: z.string().uuid().nullable().optional(),
  playerProfileId: z.string().uuid(),
  divisionIds: z.array(z.string().uuid()).min(1).max(10),
  promoCode: z
    .string()
    .trim()
    .max(64)
    .nullable()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
});

const registrationStatusSchema = z.enum([
  "pending_payment",
  "pending_verify",
  "confirmed",
  "waiting_list",
  "cancelled",
  "expired",
  "rejected",
]);

const registrationTransactionResultSchema = z.object({
  status: z.enum(["pending_payment", "confirmed", "waiting_list", "mixed"]),
  tournamentId: z.string().uuid(),
  playerProfileId: z.string().uuid(),
  registeredByAccountId: z.string().uuid(),
  paymentOrderId: z.string().uuid().nullable(),
  totalFeeAmount: z.coerce.number().nonnegative(),
  discountAmount: z.coerce.number().nonnegative(),
  amountDue: z.coerce.number().nonnegative(),
  promoCodeId: z.string().uuid().nullable(),
  promoCode: z.string().nullable(),
  promoCodeUsageIds: z.array(z.string().uuid()),
  registrations: z.array(
    z.object({
      id: z.string().uuid(),
      divisionId: z.string().uuid(),
      status: registrationStatusSchema,
      feeAmount: z.coerce.number().nonnegative(),
      discountAmount: z.coerce.number().nonnegative(),
      finalFeeAmount: z.coerce.number().nonnegative(),
      waitingListPosition: z.coerce.number().int().positive().nullable(),
    }),
  ),
});

export async function createRegistrationTransaction(
  input: RegistrationTransactionInput,
): Promise<RegistrationTransactionResult> {
  const account = await getCurrentAccount();

  if (!account) {
    throw new Error("กรุณาเข้าสู่ระบบก่อนสมัครแข่งขัน");
  }

  const parsed = registrationTransactionInputSchema.parse(input);
  const supabase = createSupabaseAdminClient();

  if (parsed.tournamentId) {
    const { count, error: tournamentError } = await supabase
      .from("divisions")
      .select("id", { count: "exact", head: true })
      .eq("tournament_id", parsed.tournamentId)
      .in("id", parsed.divisionIds);

    if (tournamentError) {
      throw new Error(tournamentError.message);
    }

    if (count !== parsed.divisionIds.length) {
      throw new Error("รุ่นที่เลือกไม่ตรงกับรายการแข่งขันนี้");
    }
  }

  const { data, error } = await supabase.rpc("create_registration_transaction", {
    p_actor_account_id: account.userId,
    p_player_profile_id: parsed.playerProfileId,
    p_division_ids: parsed.divisionIds,
    p_payment_expires_at: null,
    p_promo_code: parsed.promoCode,
  });

  if (error) {
    throw new Error(error.message);
  }

  return registrationTransactionResultSchema.parse(data);
}
