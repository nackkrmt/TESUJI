"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentAccount } from "@/lib/auth/current-account";
import { hashRefereeInviteCode } from "@/lib/auth/referee-invites";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type RedeemInviteState = {
  status: "idle" | "success" | "error";
  message: string;
};

const redeemSchema = z.object({
  code: z.string().trim().min(6, "กรุณากรอก invite code"),
});

export async function redeemRefereeInvite(
  _previousState: RedeemInviteState,
  formData: FormData,
): Promise<RedeemInviteState> {
  const account = await getCurrentAccount();

  if (!account) {
    return {
      status: "error",
      message: "กรุณาเข้าสู่ระบบก่อน redeem invite code",
    };
  }

  const parsed = redeemSchema.safeParse({
    code: formData.get("code"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Invite code ไม่ถูกต้อง",
    };
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.rpc("redeem_referee_invite", {
    p_account_id: account.userId,
    p_code_hash: hashRefereeInviteCode(parsed.data.code),
  });

  if (error) {
    return {
      status: "error",
      message: error.message,
    };
  }

  revalidatePath("/referee/invite");
  revalidatePath("/profile");

  return {
    status: "success",
    message: "เพิ่ม role Referee สำเร็จแล้ว",
  };
}
