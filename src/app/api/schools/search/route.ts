import { NextResponse } from "next/server";
import { z } from "zod";
import { searchSchoolDatabase } from "@/lib/school/search";
import { supabase } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

const searchSchema = z.object({
  q: z.string().trim().max(120).default(""),
  limit: z.coerce.number().int().min(1).max(20).default(8),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = searchSchema.safeParse({
    q: url.searchParams.get("q") ?? "",
    limit: url.searchParams.get("limit") ?? "8",
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "คำค้นหาไม่ถูกต้อง" }, { status: 400 });
  }

  if (!parsed.data.q) {
    return NextResponse.json({ results: [] });
  }

  try {
    const results = await searchSchoolDatabase(supabase, parsed.data.q, parsed.data.limit);
    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "ค้นหาสถาบันไม่สำเร็จ" },
      { status: 500 },
    );
  }
}
