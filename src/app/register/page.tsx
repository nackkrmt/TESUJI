import { redirect } from "next/navigation";
import { RegisterWizard } from "@/components/auth/register-wizard";
import { MobileShell } from "@/components/mobile/mobile-shell";
import { getCurrentAccount } from "@/lib/auth/current-account";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const account = await getCurrentAccount();

  if (account) {
    redirect("/");
  }

  return (
    <MobileShell title="สมัครสมาชิก" subtitle="สร้าง Player Profile ก่อน แล้วค่อยเลือก role ตอนท้าย">
      <RegisterWizard />
    </MobileShell>
  );
}
