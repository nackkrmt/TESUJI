import { NextResponse } from "next/server";
import { z } from "zod";
import { matchGoPlayerRank } from "@/lib/go/rank-matching";
import { supabase } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

const searchSchema = z.object({
  firstNameTh: z.string().trim().min(1),
  lastNameTh: z.string().trim().min(1),
});

export async function POST(request: Request) {
  const parsed = searchSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "กรุณากรอกชื่อและนามสกุลไทย" }, { status: 400 });
  }

  try {
    const result = await matchGoPlayerRank(
      supabase,
      parsed.data.firstNameTh,
      parsed.data.lastNameTh,
    );

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "ค้นหา rank ไม่สำเร็จ" },
      { status: 500 },
    );
  }
}
