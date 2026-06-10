"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { selfDeclaredRankOptions } from "@/lib/auth/rank-options";
import { approvePendingRank } from "@/lib/admin/rank-approvals";

export type RankApprovalActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

const rankApprovalFormSchema = z
  .object({
    action: z.enum(["approve_as_is", "edit_rank"]),
    finalRank: z
      .string()
      .trim()
      .optional()
      .refine(
        (rank) => !rank || (selfDeclaredRankOptions as readonly string[]).includes(rank),
        "Choose a valid rank.",
      ),
    note: z.string().trim().max(500, "Note must be 500 characters or fewer.").optional(),
    playerProfileId: z.string().uuid(),
  })
  .superRefine((value, context) => {
    if (value.action === "edit_rank" && !value.finalRank) {
      context.addIssue({
        code: "custom",
        message: "Choose a final rank.",
        path: ["finalRank"],
      });
    }
  });

export async function approveRankAction(
  _previousState: RankApprovalActionState,
  formData: FormData,
): Promise<RankApprovalActionState> {
  const parsed = rankApprovalFormSchema.safeParse({
    action: formData.get("action"),
    finalRank: cleanOptionalText(formData.get("finalRank")),
    note: cleanOptionalText(formData.get("note")),
    playerProfileId: formData.get("playerProfileId"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Rank approval data is invalid.",
    };
  }

  try {
    const result = await approvePendingRank({
      finalRank: parsed.data.action === "edit_rank" ? parsed.data.finalRank : null,
      note: parsed.data.note,
      playerProfileId: parsed.data.playerProfileId,
    });

    revalidatePath("/admin");
    revalidatePath("/admin/ranks");

    return {
      status: "success",
      message: `Rank approved: ${result.originalRank} -> ${result.finalRank} (power ${result.finalPowerLevel}).`,
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Rank approval failed.",
    };
  }
}

function cleanOptionalText(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return undefined;
  }

  const cleaned = value.trim();
  return cleaned.length > 0 ? cleaned : undefined;
}
