"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentAccount } from "@/lib/auth/current-account";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type CoachPlayerSearchResult = {
  playerProfileId: string;
  nameTh: string;
  nameEn: string;
  rank: string;
  rankStatus: "verified" | "pending";
  instituteName: string | null;
  existingLinkId: string | null;
  existingLinkStatus: "pending" | "approved" | "rejected" | "revoked" | null;
};

export type CoachPlayerSearchState = {
  status: "idle" | "success" | "error";
  message: string;
  results: CoachPlayerSearchResult[];
};

export type ProfileActionResult = {
  status: "success" | "error";
  message: string;
};

const initialSearchMessage = "ค้นหาด้วย Player ID, email แบบตรงตัว, หรือชื่อ-นามสกุล";

const searchSchema = z.object({
  query: z.string().trim().min(2, "กรุณากรอกอย่างน้อย 2 ตัวอักษร"),
});

const requestSchema = z.object({
  playerProfileId: z.string().uuid(),
});

const responseSchema = z.object({
  linkId: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
});

type CoachPlayerSearchRow = {
  player_profile_id: string;
  name_th: string;
  name_en: string;
  rank: string;
  rank_status: "verified" | "pending";
  institute_name: string | null;
  existing_link_id: string | null;
  existing_link_status: "pending" | "approved" | "rejected" | "revoked" | null;
};

export async function searchCoachPlayers(
  _previousState: CoachPlayerSearchState,
  formData: FormData,
): Promise<CoachPlayerSearchState> {
  const account = await getCurrentAccount();

  if (!account) {
    return {
      status: "error",
      message: "กรุณาเข้าสู่ระบบก่อนค้นหา Player",
      results: [],
    };
  }

  if (!hasActiveCoachRole(account.roles)) {
    return {
      status: "error",
      message: "Coach role ยังไม่ active จึงยังส่งคำขอ link Player ไม่ได้",
      results: [],
    };
  }

  const parsed = searchSchema.safeParse({
    query: formData.get("query"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? initialSearchMessage,
      results: [],
    };
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("search_player_profiles_for_coach", {
    p_coach_account_id: account.userId,
    p_query: parsed.data.query,
    p_limit: 5,
  });

  if (error) {
    return {
      status: "error",
      message: error.message,
      results: [],
    };
  }

  const results = ((data ?? []) as CoachPlayerSearchRow[]).map((row) => ({
    playerProfileId: row.player_profile_id,
    nameTh: row.name_th,
    nameEn: row.name_en,
    rank: row.rank,
    rankStatus: row.rank_status,
    instituteName: row.institute_name,
    existingLinkId: row.existing_link_id,
    existingLinkStatus: row.existing_link_status,
  }));

  return {
    status: "success",
    message:
      results.length > 0
        ? `พบ ${results.length.toLocaleString("th-TH")} รายการ`
        : "ไม่พบ Player ที่ตรงกับคำค้น",
    results,
  };
}

export async function requestCoachPlayerLink(playerProfileId: string): Promise<ProfileActionResult> {
  const account = await getCurrentAccount();

  if (!account) {
    return {
      status: "error",
      message: "กรุณาเข้าสู่ระบบก่อนส่งคำขอ",
    };
  }

  if (!hasActiveCoachRole(account.roles)) {
    return {
      status: "error",
      message: "Coach role ยังไม่ active จึงยังส่งคำขอ link Player ไม่ได้",
    };
  }

  const parsed = requestSchema.safeParse({ playerProfileId });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Player profile ไม่ถูกต้อง",
    };
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.rpc("request_coach_player_link", {
    p_coach_account_id: account.userId,
    p_player_profile_id: parsed.data.playerProfileId,
  });

  if (error) {
    return {
      status: "error",
      message: error.message,
    };
  }

  revalidatePath("/profile");

  return {
    status: "success",
    message: "ส่งคำขอ link ไปยัง Player แล้ว",
  };
}

export async function respondCoachPlayerLink(
  linkId: string,
  decision: "approved" | "rejected",
): Promise<ProfileActionResult> {
  const account = await getCurrentAccount();

  if (!account) {
    return {
      status: "error",
      message: "กรุณาเข้าสู่ระบบก่อนตอบคำขอ",
    };
  }

  const parsed = responseSchema.safeParse({ linkId, decision });

  if (!parsed.success) {
    return {
      status: "error",
      message: "คำขอ Coach Link ไม่ถูกต้อง",
    };
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.rpc("respond_coach_player_link", {
    p_player_account_id: account.userId,
    p_link_id: parsed.data.linkId,
    p_decision: parsed.data.decision,
  });

  if (error) {
    return {
      status: "error",
      message: error.message,
    };
  }

  revalidatePath("/profile");

  return {
    status: "success",
    message: decision === "approved" ? "อนุมัติ Coach Link แล้ว" : "ปฏิเสธ Coach Link แล้ว",
  };
}

function hasActiveCoachRole(roles: Array<{ role: string; status: string }>) {
  return roles.some((role) => role.role === "coach" && role.status === "active");
}
