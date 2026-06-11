import { z } from "zod";
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

function getAdminActorAccountIdForDevMode() {
  // Dev mode intentionally leaves Admin routes unprotected. Future production auth should
  // return the logged-in account id after checking account_roles.admin = active.
  return null;
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}
