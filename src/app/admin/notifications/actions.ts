"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  sendManualNotification,
  type ManualNotificationAudience,
  type SendManualNotificationResult,
} from "@/lib/admin/notifications";

export type ManualNotificationActionState = {
  message: string;
  result?: SendManualNotificationResult;
  status: "idle" | "success" | "error";
};

const manualNotificationFormSchema = z
  .object({
    accountIds: z.array(z.string().uuid()).max(500, "Use 500 selected accounts or fewer."),
    audienceType: z.enum(["all_accounts", "tournament_registrants", "selected_accounts"]),
    body: z.string().trim().min(1, "Body is required.").max(2000, "Body is too long."),
    linkUrl: z
      .string()
      .trim()
      .max(2048, "Link is too long.")
      .optional()
      .refine((value) => !value || value.startsWith("/") || /^https?:\/\//i.test(value), {
        message: "Link must be a relative URL or HTTP(S) URL.",
      }),
    title: z.string().trim().min(1, "Title is required.").max(120, "Title is too long."),
    tournamentId: z.string().uuid().optional(),
  })
  .superRefine((value, context) => {
    if (value.audienceType === "tournament_registrants" && !value.tournamentId) {
      context.addIssue({
        code: "custom",
        message: "Choose a tournament.",
        path: ["tournamentId"],
      });
    }

    if (value.audienceType === "selected_accounts" && value.accountIds.length === 0) {
      context.addIssue({
        code: "custom",
        message: "Choose or paste at least one account ID.",
        path: ["accountIds"],
      });
    }
  });

export async function sendManualNotificationAction(
  _previousState: ManualNotificationActionState,
  formData: FormData,
): Promise<ManualNotificationActionState> {
  const parsed = manualNotificationFormSchema.safeParse({
    accountIds: parseAccountIds(formData),
    audienceType: formData.get("audienceType"),
    body: formData.get("body"),
    linkUrl: cleanOptionalText(formData.get("linkUrl")),
    title: formData.get("title"),
    tournamentId: cleanOptionalText(formData.get("tournamentId")),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Notification data is invalid.",
    };
  }

  try {
    const result = await sendManualNotification({
      audience: toAudience(parsed.data),
      body: parsed.data.body,
      linkUrl: parsed.data.linkUrl,
      title: parsed.data.title,
    });

    revalidatePath("/admin");
    revalidatePath("/admin/notifications");
    revalidatePath("/");
    revalidatePath("/profile");
    revalidatePath("/notifications");

    return {
      status: "success",
      message: `Notification sent to ${result.recipientCount.toLocaleString("en-US")} recipient${
        result.recipientCount === 1 ? "" : "s"
      }.`,
      result,
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Notification send failed.",
    };
  }
}

function toAudience(value: z.infer<typeof manualNotificationFormSchema>): ManualNotificationAudience {
  if (value.audienceType === "all_accounts") {
    return { type: "all_accounts" };
  }

  if (value.audienceType === "tournament_registrants") {
    return {
      tournamentId: value.tournamentId ?? "",
      type: "tournament_registrants",
    };
  }

  return {
    accountIds: value.accountIds,
    type: "selected_accounts",
  };
}

function parseAccountIds(formData: FormData) {
  const selectedIds = formData
    .getAll("accountIds")
    .filter((value): value is string => typeof value === "string");
  const pastedIds = splitAccountIds(cleanOptionalText(formData.get("pastedAccountIds")) ?? "");

  return unique([...selectedIds, ...pastedIds]);
}

function splitAccountIds(value: string) {
  return value
    .split(/[\s,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function cleanOptionalText(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return undefined;
  }

  const cleaned = value.trim();
  return cleaned.length > 0 ? cleaned : undefined;
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}
