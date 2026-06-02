"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { generateRefereeInviteCode, hashRefereeInviteCode } from "@/lib/auth/referee-invites";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type InviteActionState = {
  status: "idle" | "success" | "error";
  message: string;
  code?: string;
};

const reviewSchema = z.object({
  requestId: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
  adminNote: z.string().trim().optional(),
});

const inviteSchema = z.object({
  expiresInDays: z.coerce.number().int().min(1).max(30),
});

export async function reviewCoachRequest(formData: FormData) {
  const parsed = reviewSchema.safeParse({
    requestId: formData.get("requestId"),
    decision: formData.get("decision"),
    adminNote: formData.get("adminNote"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid coach review payload");
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.rpc("review_coach_request", {
    p_request_id: parsed.data.requestId,
    p_decision: parsed.data.decision,
    p_admin_note: parsed.data.adminNote ?? null,
    p_reviewed_by: null,
  });

  if (error) {
    throw error;
  }

  revalidatePath("/admin/roles");
  revalidatePath("/admin");
}

export async function createRefereeInvite(
  _previousState: InviteActionState,
  formData: FormData,
): Promise<InviteActionState> {
  const parsed = inviteSchema.safeParse({
    expiresInDays: formData.get("expiresInDays"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid invite expiry",
    };
  }

  const code = generateRefereeInviteCode();
  const expiresAt = new Date(Date.now() + parsed.data.expiresInDays * 24 * 60 * 60 * 1000);
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.rpc("create_referee_invite", {
    p_code_hash: hashRefereeInviteCode(code),
    p_expires_at: expiresAt.toISOString(),
    p_created_by: null,
  });

  if (error) {
    return {
      status: "error",
      message: error.message,
    };
  }

  revalidatePath("/admin/roles");

  return {
    status: "success",
    message: `Invite created. Expires ${expiresAt.toLocaleDateString("th-TH")}.`,
    code,
  };
}
