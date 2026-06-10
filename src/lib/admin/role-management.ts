import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ensureAdminMutationAllowedForDevMode } from "@/lib/tournaments/admin";

export type CoachRequestRow = {
  id: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  requestedRole: string;
  createdAt: string;
  reviewedAt: string | null;
  adminNote: string | null;
  account: {
    id: string;
    email: string;
    phone: string;
  } | null;
  profile: {
    nameTh: string;
    nameEn: string;
    rank: string;
    rankStatus: "verified" | "pending";
    instituteName: string | null;
  } | null;
};

export type RefereeInviteRow = {
  id: string;
  status: RefereeInviteStatus;
  displayStatus: RefereeInviteDisplayStatus;
  expiresAt: string;
  createdAt: string;
  redeemedAt: string | null;
  revokedAt: string | null;
  redeemedAccount: {
    email: string;
  } | null;
  revokedAccount: {
    email: string;
  } | null;
};

export type RefereeInviteStatus = "unused" | "redeemed" | "expired" | "revoked";

export type RefereeInviteDisplayStatus = "active" | "redeemed" | "expired" | "revoked";

export type RefereeInviteCounts = {
  active: number;
  redeemed: number;
  expired: number;
  revoked: number;
};

export type RevokeRefereeInviteResult = {
  inviteId: string;
  status: "revoked";
  revokedAt: string | null;
};

type RoleRequestRecord = {
  id: string;
  status: CoachRequestRow["status"];
  requested_role: string;
  created_at: string;
  reviewed_at: string | null;
  admin_note: string | null;
  accounts:
    | {
        id: string;
        email: string;
        phone: string;
      }
    | Array<{
    id: string;
    email: string;
    phone: string;
      }>
    | null;
};

type ProfileRecord = {
  account_id: string;
  first_name_th: string;
  last_name_th: string;
  first_name_en: string;
  last_name_en: string;
  rank: string;
  rank_status: "verified" | "pending";
  institute_name: string | null;
};

type InviteRecord = {
  id: string;
  status: RefereeInviteStatus;
  expires_at: string;
  created_at: string;
  redeemed_at: string | null;
  revoked_at: string | null;
  redeemed_account:
    | {
        email: string;
      }
    | Array<{
        email: string;
      }>
    | null;
  revoked_account:
    | {
        email: string;
      }
    | Array<{
        email: string;
      }>
    | null;
};

type InviteCountRecord = {
  status: RefereeInviteStatus;
  expires_at: string;
};

const revokeInviteInputSchema = z.object({
  inviteId: z.string().uuid(),
});

const revokeInviteResultSchema = z.object({
  inviteId: z.string().uuid(),
  status: z.literal("revoked"),
  revokedAt: z.string().nullable(),
});

export async function getCoachRequests() {
  const supabase = createSupabaseAdminClient();
  const { data: requests, error: requestError } = await supabase
    .from("role_requests")
    .select("id,status,requested_role,created_at,reviewed_at,admin_note,accounts:account_id(id,email,phone)")
    .eq("requested_role", "coach")
    .order("created_at", { ascending: false });

  if (requestError) {
    throw requestError;
  }

  const requestRows = (requests ?? []) as unknown as RoleRequestRecord[];
  const accountIds = requestRows
    .map((request) => firstRelation(request.accounts)?.id)
    .filter((id): id is string => Boolean(id));

  const { data: profiles, error: profileError } = accountIds.length
    ? await supabase
        .from("player_profiles")
        .select(
          "account_id,first_name_th,last_name_th,first_name_en,last_name_en,rank,rank_status,institute_name",
        )
        .in("account_id", accountIds)
    : { data: [], error: null };

  if (profileError) {
    throw profileError;
  }

  const profileByAccountId = new Map(
    ((profiles ?? []) as ProfileRecord[]).map((profile) => [profile.account_id, profile]),
  );

  return requestRows.map<CoachRequestRow>((request) => {
    const account = firstRelation(request.accounts);
    const accountId = account?.id;
    const profile = accountId ? profileByAccountId.get(accountId) : null;

    return {
      id: request.id,
      status: request.status,
      requestedRole: request.requested_role,
      createdAt: request.created_at,
      reviewedAt: request.reviewed_at,
      adminNote: request.admin_note,
      account,
      profile: profile
        ? {
            nameTh: `${profile.first_name_th} ${profile.last_name_th}`,
            nameEn: `${profile.first_name_en} ${profile.last_name_en}`,
            rank: profile.rank,
            rankStatus: profile.rank_status,
            instituteName: profile.institute_name,
          }
        : null,
    };
  });
}

export async function getRefereeInvites() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("referee_invite_codes")
    .select(
      "id,status,expires_at,created_at,redeemed_at,revoked_at,redeemed_account:redeemed_by(email),revoked_account:revoked_by(email)",
    )
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    throw error;
  }

  return ((data ?? []) as unknown as InviteRecord[]).map<RefereeInviteRow>((invite) => ({
    id: invite.id,
    status: invite.status,
    displayStatus: getRefereeInviteDisplayStatus(invite),
    expiresAt: invite.expires_at,
    createdAt: invite.created_at,
    redeemedAt: invite.redeemed_at,
    revokedAt: invite.revoked_at,
    redeemedAccount: firstRelation(invite.redeemed_account),
    revokedAccount: firstRelation(invite.revoked_account),
  }));
}

export async function getRefereeInviteCounts(): Promise<RefereeInviteCounts> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("referee_invite_codes")
    .select("status,expires_at");

  if (error) {
    throw error;
  }

  return ((data ?? []) as InviteCountRecord[]).reduce<RefereeInviteCounts>(
    (counts, invite) => {
      counts[getRefereeInviteDisplayStatus(invite)] += 1;
      return counts;
    },
    {
      active: 0,
      redeemed: 0,
      expired: 0,
      revoked: 0,
    },
  );
}

export async function revokeRefereeInvite(input: {
  inviteId: string;
}): Promise<RevokeRefereeInviteResult> {
  ensureAdminMutationAllowedForDevMode();

  const parsed = revokeInviteInputSchema.parse(input);
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("revoke_referee_invite", {
    p_admin_account_id: getAdminActorAccountIdForDevMode(),
    p_invite_id: parsed.inviteId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return revokeInviteResultSchema.parse(data);
}

function getAdminActorAccountIdForDevMode() {
  // Dev mode intentionally leaves Admin routes unprotected. Future production auth should
  // return the logged-in account id after checking account_roles.admin = active.
  return null;
}

function getRefereeInviteDisplayStatus(invite: {
  status: RefereeInviteStatus;
  expires_at: string;
}): RefereeInviteDisplayStatus {
  if (invite.status === "unused") {
    return new Date(invite.expires_at).getTime() <= Date.now() ? "expired" : "active";
  }

  return invite.status;
}

function firstRelation<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}
