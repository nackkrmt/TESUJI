import { z } from "zod";
import { rankToPowerLevel } from "@/lib/go/ranks";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ensureAdminMutationAllowedForDevMode } from "@/lib/tournaments/admin";

export type PendingRankApproval = {
  id: string;
  accountId: string;
  nameTh: string;
  nameEn: string;
  rank: string;
  rankStatus: "pending";
  powerLevel: number;
  instituteName: string | null;
  createdAt: string;
  account: {
    id: string;
    email: string;
    phone: string;
  } | null;
};

export type RankApprovalResult = {
  playerProfileId: string;
  accountId: string;
  rankStatus: "verified";
  originalRank: string;
  originalPowerLevel: number;
  finalRank: string;
  finalPowerLevel: number;
  reviewedBy: string | null;
  reviewedAt: string;
  note: string | null;
};

type PendingRankApprovalRow = {
  id: string;
  account_id: string;
  first_name_th: string;
  last_name_th: string;
  first_name_en: string;
  last_name_en: string;
  rank: string;
  rank_status: "pending";
  power_level: number;
  institute_name: string | null;
  created_at: string;
};

type AccountRow = {
  id: string;
  email: string;
  phone: string;
};

type AdminSupabaseClient = ReturnType<typeof createSupabaseAdminClient>;

const optionalTrimmedString = (maxLength: number) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => {
      if (typeof value !== "string") {
        return undefined;
      }

      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    })
    .refine((value) => !value || value.length <= maxLength, {
      message: `Must be ${maxLength} characters or fewer.`,
    });

const approveRankInputSchema = z
  .object({
    finalRank: optionalTrimmedString(40),
    note: optionalTrimmedString(500),
    playerProfileId: z.string().uuid(),
  })
  .superRefine((value, context) => {
    if (value.finalRank && rankToPowerLevel(value.finalRank) === null) {
      context.addIssue({
        code: "custom",
        message: "Invalid rank.",
        path: ["finalRank"],
      });
    }
  });

const rankApprovalResultSchema = z.object({
  accountId: z.string().uuid(),
  finalPowerLevel: z.coerce.number().int(),
  finalRank: z.string(),
  note: z.string().nullable(),
  originalPowerLevel: z.coerce.number().int(),
  originalRank: z.string(),
  playerProfileId: z.string().uuid(),
  rankStatus: z.literal("verified"),
  reviewedAt: z.string(),
  reviewedBy: z.string().uuid().nullable(),
});

export async function getPendingRankApprovals(): Promise<PendingRankApproval[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("player_profiles")
    .select(
      "id,account_id,first_name_th,last_name_th,first_name_en,last_name_en,rank,rank_status,power_level,institute_name,created_at",
    )
    .eq("rank_status", "pending")
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  const profiles = (data ?? []) as PendingRankApprovalRow[];
  const accounts = await fetchAccounts(
    supabase,
    profiles.map((profile) => profile.account_id),
  );

  return profiles.map((profile) => mapPendingRankApproval(profile, accounts));
}

export async function getPendingRankApprovalCount(): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const { count, error } = await supabase
    .from("player_profiles")
    .select("id", { count: "exact", head: true })
    .eq("rank_status", "pending");

  if (error) {
    throw error;
  }

  return count ?? 0;
}

export async function approvePendingRank(input: {
  playerProfileId: string;
  finalRank?: string | null;
  note?: string | null;
}): Promise<RankApprovalResult> {
  ensureAdminMutationAllowedForDevMode();

  const parsed = approveRankInputSchema.parse(input);
  const supabase = createSupabaseAdminClient();
  const adminAccountId = getAdminActorAccountIdForDevMode();
  const { data, error } = await supabase.rpc("approve_player_profile_rank", {
    p_admin_account_id: adminAccountId,
    p_admin_note: parsed.note ?? null,
    p_final_rank: parsed.finalRank ?? null,
    p_player_profile_id: parsed.playerProfileId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return rankApprovalResultSchema.parse(data);
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

function mapPendingRankApproval(
  profile: PendingRankApprovalRow,
  accounts: Map<string, AccountRow>,
): PendingRankApproval {
  return {
    id: profile.id,
    accountId: profile.account_id,
    nameTh: `${profile.first_name_th} ${profile.last_name_th}`,
    nameEn: `${profile.first_name_en} ${profile.last_name_en}`,
    rank: profile.rank,
    rankStatus: profile.rank_status,
    powerLevel: profile.power_level,
    instituteName: profile.institute_name,
    createdAt: profile.created_at,
    account: accounts.get(profile.account_id) ?? null,
  };
}
