import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { MobileShell } from "@/components/mobile/mobile-shell";
import { getCurrentAccount } from "@/lib/auth/current-account";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const account = await getCurrentAccount();

  if (account) {
    redirect("/");
  }

  return (
    <MobileShell title="เข้าสู่ระบบ" subtitle="ใช้บัญชี TESUJI ของคุณเพื่อสมัครแข่งและดูโปรไฟล์นักกีฬา">
      <LoginForm />
    </MobileShell>
  );
}
