import { NextResponse } from "next/server";
import { forgotPasswordSchema } from "@/lib/auth/schemas";
import { createSupabaseServerComponentClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const parsed = forgotPasswordSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "อีเมลไม่ถูกต้อง" }, { status: 400 });
  }

  const origin = request.headers.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3000";
  const redirectTo = `${origin}/auth/callback?next=/reset-password`;
  const supabase = await createSupabaseServerComponentClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
