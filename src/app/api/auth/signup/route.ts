import { type NextRequest, NextResponse } from "next/server";
import type { z } from "zod";
import { getSelfDeclaredPowerLevel } from "@/lib/auth/rank-options";
import { hashIdentityDocument } from "@/lib/auth/identity-hash";
import { rankSelectionSchema, signupSchema } from "@/lib/auth/schemas";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type GoPlayerRow = {
  id: string;
  rank: string | null;
  power_level: number;
  rating: number | null;
};

type RankSnapshot = {
  rank: string;
  rankStatus: "verified" | "pending";
  powerLevel: number;
  rating: number | null;
  matchedGoPlayerId: string | null;
};

export async function POST(request: NextRequest) {
  const parsed = signupSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "ข้อมูลสมัครไม่ถูกต้อง" },
      { status: 400 },
    );
  }

  const payload = parsed.data;
  let adminClient: ReturnType<typeof createSupabaseAdminClient>;

  try {
    adminClient = createSupabaseAdminClient();
  } catch {
    return NextResponse.json(
      {
        error:
          "ยังไม่ได้ตั้งค่า SUPABASE_SECRET_KEY หรือ SUPABASE_SERVICE_ROLE_KEY สำหรับสมัครสมาชิกจริง",
      },
      { status: 500 },
    );
  }

  const rankSnapshot = await resolveRankSnapshot(adminClient, payload.rankSelection);
  const identityDocumentHash = hashIdentityDocument(
    payload.profile.identityDocumentType,
    payload.profile.identityDocumentValue,
  );

  const { data: createdUser, error: createUserError } = await adminClient.auth.admin.createUser({
    email: payload.credentials.email,
    password: payload.credentials.password,
    email_confirm: true,
    user_metadata: {
      first_name_th: payload.profile.firstNameTh,
      last_name_th: payload.profile.lastNameTh,
      signup_role: payload.role,
    },
  });

  if (createUserError || !createdUser.user) {
    return NextResponse.json(
      { error: createUserError?.message ?? "สร้างบัญชี Supabase Auth ไม่สำเร็จ" },
      { status: 400 },
    );
  }

  const userId = createdUser.user.id;

  try {
    const { error: rpcError } = await adminClient.rpc("complete_account_signup", {
      p_account_id: userId,
      p_email: payload.credentials.email,
      p_phone: payload.profile.phone,
      p_signup_role: payload.role,
      p_title_th: payload.profile.titleTh,
      p_title_en: payload.profile.titleEn,
      p_first_name_th: payload.profile.firstNameTh,
      p_middle_name_th: payload.profile.middleNameTh,
      p_last_name_th: payload.profile.lastNameTh,
      p_first_name_en: payload.profile.firstNameEn,
      p_middle_name_en: payload.profile.middleNameEn,
      p_last_name_en: payload.profile.lastNameEn,
      p_gender: payload.profile.gender,
      p_date_of_birth: payload.profile.dateOfBirth,
      p_identity_document_type: payload.profile.identityDocumentType,
      p_identity_document_hash: identityDocumentHash,
      p_nationality: payload.profile.nationality,
      p_institute_name: payload.profile.instituteName,
      p_rank: rankSnapshot.rank,
      p_rank_status: rankSnapshot.rankStatus,
      p_power_level: rankSnapshot.powerLevel,
      p_rating: rankSnapshot.rating,
      p_matched_go_player_id: rankSnapshot.matchedGoPlayerId,
      p_pdpa_consent: payload.profile.pdpaConsent,
    });

    if (rpcError) {
      throw rpcError;
    }
  } catch (error) {
    await adminClient.auth.admin.deleteUser(userId).catch(() => undefined);

    return NextResponse.json({ error: getSignupErrorMessage(error) }, { status: 400 });
  }

  const response = NextResponse.json({
    ok: true,
    role: payload.role,
    coachPending: payload.role === "coach",
  });
  const routeClient = createSupabaseRouteHandlerClient({
    request,
    response,
    remember: payload.remember,
  });
  const { error: signInError } = await routeClient.auth.signInWithPassword({
    email: payload.credentials.email,
    password: payload.credentials.password,
  });

  if (signInError) {
    return NextResponse.json(
      {
        error:
          "สร้างบัญชีสำเร็จแล้ว แต่เข้าสู่ระบบอัตโนมัติไม่สำเร็จ กรุณาไปหน้า Login แล้วเข้าสู่ระบบอีกครั้ง",
      },
      { status: 202 },
    );
  }

  return response;
}

async function resolveRankSnapshot(
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
  rankSelection: z.infer<typeof rankSelectionSchema>,
): Promise<RankSnapshot> {
  if (rankSelection.type === "self") {
    const powerLevel = getSelfDeclaredPowerLevel(rankSelection.rank);

    if (powerLevel === null) {
      throw new Error("ระดับฝีมือไม่ถูกต้อง");
    }

    return {
      rank: rankSelection.rank,
      rankStatus: "pending",
      powerLevel,
      rating: null,
      matchedGoPlayerId: null,
    };
  }

  const { data, error } = await adminClient
    .from("go_player_database")
    .select("id,rank,power_level,rating")
    .eq("id", rankSelection.candidateId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const candidate = data as GoPlayerRow | null;

  if (!candidate?.rank) {
    throw new Error("ไม่พบ rank ที่เลือก กรุณาค้นหาอีกครั้ง");
  }

  return {
    rank: candidate.rank,
    rankStatus: "verified",
    powerLevel: candidate.power_level,
    rating: candidate.rating,
    matchedGoPlayerId: candidate.id,
  };
}

function getSignupErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes("player_profiles_identity_document_hash_key")) {
      return "เลขบัตร/Passport นี้ถูกใช้สมัครแล้ว กรุณารีเซ็ตรหัสผ่านหรือติดต่อ Admin";
    }

    if (error.message.includes("accounts_email_key")) {
      return "อีเมลนี้ถูกใช้สมัครแล้ว กรุณาเข้าสู่ระบบหรือรีเซ็ตรหัสผ่าน";
    }

    return error.message;
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    return String(error.message);
  }

  return "สมัครสมาชิกไม่สำเร็จ";
}
