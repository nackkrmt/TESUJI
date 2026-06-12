import { z } from "zod";
import { getAdminUsers } from "@/lib/admin/users";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ensureAdminMutationAllowedForDevMode } from "@/lib/tournaments/admin";

export type ManualNotificationAudienceType =
  | "all_accounts"
  | "tournament_registrants"
  | "selected_accounts";

export type ManualNotificationAudience =
  | {
      type: "all_accounts";
    }
  | {
      tournamentId: string;
      type: "tournament_registrants";
    }
  | {
      accountIds: string[];
      type: "selected_accounts";
    };

export type SendManualNotificationInput = {
  audience: ManualNotificationAudience;
  body: string;
  linkUrl?: string | null;
  title: string;
};

export type SendManualNotificationResult = {
  audienceType: ManualNotificationAudienceType;
  createdAt: string;
  createdBy: string | null;
  notificationId: string;
  recipientCount: number;
  tournamentId: string | null;
};

export type AdminNotificationAccountOption = {
  activeRole: string;
  email: string;
  id: string;
  label: string;
  name: string | null;
  rank: string | null;
};

export type AdminNotificationTournamentOption = {
  eventDate: string | null;
  id: string;
  recipientCount: number;
  status: string;
  title: string;
};

export type AdminManualNotificationSummary = {
  audienceType: ManualNotificationAudienceType;
  createdAt: string;
  id: string;
  linkUrl: string | null;
  recipientCount: number;
  readCount: number;
  title: string;
  tournamentId: string | null;
  tournamentTitle: string | null;
  unreadCount: number;
};

export type ManualNotificationAdminState = {
  accountOptions: AdminNotificationAccountOption[];
  accountQuery: string;
  allAccountCount: number;
  recentNotifications: AdminManualNotificationSummary[];
  tournaments: AdminNotificationTournamentOption[];
};

type RegistrationRecipientRow = {
  player_profile_id: string;
  registered_by_account_id: string;
  tournament_id: string;
};

type ProfileAccountRow = {
  account_id: string;
  id: string;
};

type ManualNotificationRow = {
  audience_type: ManualNotificationAudienceType;
  created_at: string;
  id: string;
  link_url: string | null;
  title: string;
  tournament_id: string | null;
};

type ManualNotificationRecipientRow = {
  notification_id: string;
  read_at: string | null;
};

type TournamentSummaryRow = {
  event_date: string | null;
  id: string;
  status: string;
  title: string | null;
  title_en: string | null;
};

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

const linkUrlSchema = optionalTrimmedString(2048).refine(
  (value) => !value || value.startsWith("/") || /^https?:\/\//i.test(value),
  {
    message: "Link must be a relative URL or HTTP(S) URL.",
  },
);

const sendManualNotificationInputSchema = z.object({
  audience: z.discriminatedUnion("type", [
    z.object({
      type: z.literal("all_accounts"),
    }),
    z.object({
      tournamentId: z.string().uuid(),
      type: z.literal("tournament_registrants"),
    }),
    z.object({
      accountIds: z.array(z.string().uuid()).min(1).max(500),
      type: z.literal("selected_accounts"),
    }),
  ]),
  body: z.string().trim().min(1, "Body is required.").max(2000, "Body is too long."),
  linkUrl: linkUrlSchema.optional(),
  title: z.string().trim().min(1, "Title is required.").max(120, "Title is too long."),
});

const sendManualNotificationResultSchema = z.object({
  audienceType: z.enum(["all_accounts", "tournament_registrants", "selected_accounts"]),
  createdAt: z.string(),
  createdBy: z.string().uuid().nullable(),
  notificationId: z.string().uuid(),
  recipientCount: z.coerce.number().int().positive(),
  tournamentId: z.string().uuid().nullable(),
});

export async function sendManualNotification(
  input: SendManualNotificationInput,
): Promise<SendManualNotificationResult> {
  ensureAdminMutationAllowedForDevMode();

  const parsed = sendManualNotificationInputSchema.parse(input);
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("create_manual_notification", {
    p_account_ids:
      parsed.audience.type === "selected_accounts" ? unique(parsed.audience.accountIds) : null,
    p_admin_account_id: getAdminActorAccountIdForDevMode(),
    p_audience_type: parsed.audience.type,
    p_body: parsed.body,
    p_link_url: parsed.linkUrl ?? null,
    p_title: parsed.title,
    p_tournament_id:
      parsed.audience.type === "tournament_registrants" ? parsed.audience.tournamentId : null,
  });

  if (error) {
    throw new Error(error.message);
  }

  return sendManualNotificationResultSchema.parse(data);
}

export async function getManualNotificationAdminState(input: {
  accountQuery?: string | null;
} = {}): Promise<ManualNotificationAdminState> {
  ensureAdminMutationAllowedForDevMode();

  const accountQuery = input.accountQuery?.trim().slice(0, 120) ?? "";
  const supabase = createSupabaseAdminClient();
  const [allAccountCount, tournaments, accountOptions, recentNotifications] = await Promise.all([
    getAllAccountCount(supabase),
    getTournamentOptions(supabase),
    getAccountOptions(accountQuery),
    getRecentManualNotifications(supabase),
  ]);

  return {
    accountOptions,
    accountQuery,
    allAccountCount,
    recentNotifications,
    tournaments,
  };
}

function getAdminActorAccountIdForDevMode() {
  // Dev mode intentionally leaves Admin routes unprotected. Future production auth should
  // return the logged-in account id after checking account_roles.admin = active.
  return null;
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

async function getAllAccountCount(supabase: ReturnType<typeof createSupabaseAdminClient>) {
  const { count, error } = await supabase
    .from("accounts")
    .select("id", { count: "exact", head: true });

  if (error) {
    throw error;
  }

  return count ?? 0;
}

async function getTournamentOptions(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
): Promise<AdminNotificationTournamentOption[]> {
  const { data, error } = await supabase
    .from("tournaments")
    .select("id,title,title_en,event_date,status")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as TournamentSummaryRow[];
  const recipientCounts = await getTournamentRecipientCounts(
    supabase,
    rows.map((row) => row.id),
  );

  return rows.map((row) => ({
    eventDate: row.event_date,
    id: row.id,
    recipientCount: recipientCounts.get(row.id)?.size ?? 0,
    status: row.status,
    title: row.title ?? row.title_en ?? "Untitled tournament",
  }));
}

async function getAccountOptions(accountQuery: string): Promise<AdminNotificationAccountOption[]> {
  const users = await getAdminUsers({
    limit: 25,
    query: accountQuery,
    role: "all",
  });

  return users.users.map((user) => {
    const name = user.profile?.nameTh || user.profile?.nameEn || null;

    return {
      activeRole: user.activeRole,
      email: user.email,
      id: user.id,
      label: name ? `${name} (${user.email})` : user.email,
      name,
      rank: user.profile?.rank ?? null,
    };
  });
}

async function getRecentManualNotifications(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
): Promise<AdminManualNotificationSummary[]> {
  const { data, error } = await supabase
    .from("manual_notifications")
    .select("id,title,link_url,audience_type,tournament_id,created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    throw error;
  }

  const notifications = (data ?? []) as ManualNotificationRow[];
  const notificationIds = notifications.map((notification) => notification.id);

  if (notificationIds.length === 0) {
    return [];
  }

  const tournamentIds = unique(
    notifications
      .map((notification) => notification.tournament_id)
      .filter((id): id is string => Boolean(id)),
  );
  const [recipientsResult, tournamentsResult] = await Promise.all([
    supabase
      .from("manual_notification_recipients")
      .select("notification_id,read_at")
      .in("notification_id", notificationIds),
    tournamentIds.length > 0
      ? supabase.from("tournaments").select("id,title,title_en").in("id", tournamentIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (recipientsResult.error) {
    throw recipientsResult.error;
  }

  if (tournamentsResult.error) {
    throw tournamentsResult.error;
  }

  const counts = new Map<string, { read: number; total: number }>();
  for (const recipient of (recipientsResult.data ?? []) as ManualNotificationRecipientRow[]) {
    const current = counts.get(recipient.notification_id) ?? { read: 0, total: 0 };
    current.total += 1;
    if (recipient.read_at) {
      current.read += 1;
    }
    counts.set(recipient.notification_id, current);
  }

  const tournamentTitles = new Map(
    ((tournamentsResult.data ?? []) as TournamentSummaryRow[]).map((tournament) => [
      tournament.id,
      tournament.title ?? tournament.title_en ?? "Untitled tournament",
    ]),
  );

  return notifications.map((notification) => {
    const notificationCounts = counts.get(notification.id) ?? { read: 0, total: 0 };

    return {
      audienceType: notification.audience_type,
      createdAt: notification.created_at,
      id: notification.id,
      linkUrl: notification.link_url,
      readCount: notificationCounts.read,
      recipientCount: notificationCounts.total,
      title: notification.title,
      tournamentId: notification.tournament_id,
      tournamentTitle: notification.tournament_id
        ? tournamentTitles.get(notification.tournament_id) ?? null
        : null,
      unreadCount: notificationCounts.total - notificationCounts.read,
    };
  });
}

async function getTournamentRecipientCounts(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  tournamentIds: string[],
) {
  const counts = new Map<string, Set<string>>();

  if (tournamentIds.length === 0) {
    return counts;
  }

  const { data, error } = await supabase
    .from("registrations")
    .select("tournament_id,player_profile_id,registered_by_account_id")
    .in("tournament_id", tournamentIds)
    .in("status", ["pending_payment", "pending_verify", "confirmed", "waiting_list"]);

  if (error) {
    throw error;
  }

  const registrations = (data ?? []) as RegistrationRecipientRow[];
  const playerProfileIds = unique(registrations.map((registration) => registration.player_profile_id));
  const playerAccountByProfileId = await getPlayerAccountMap(supabase, playerProfileIds);

  for (const registration of registrations) {
    const recipientIds = counts.get(registration.tournament_id) ?? new Set<string>();
    recipientIds.add(registration.registered_by_account_id);

    const playerAccountId = playerAccountByProfileId.get(registration.player_profile_id);
    if (playerAccountId) {
      recipientIds.add(playerAccountId);
    }

    counts.set(registration.tournament_id, recipientIds);
  }

  return counts;
}

async function getPlayerAccountMap(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  playerProfileIds: string[],
) {
  if (playerProfileIds.length === 0) {
    return new Map<string, string>();
  }

  const { data, error } = await supabase
    .from("player_profiles")
    .select("id,account_id")
    .in("id", playerProfileIds);

  if (error) {
    throw error;
  }

  return new Map(((data ?? []) as ProfileAccountRow[]).map((row) => [row.id, row.account_id]));
}
