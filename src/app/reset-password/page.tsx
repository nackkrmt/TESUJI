import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { MobileShell } from "@/components/mobile/mobile-shell";

export const dynamic = "force-dynamic";

export default function ResetPasswordPage() {
  return (
    <MobileShell title="ตั้งรหัสผ่านใหม่" subtitle="กรอกรหัสผ่านใหม่หลังจากเปิดลิงก์ในอีเมล">
      <ResetPasswordForm />
    </MobileShell>
  );
}
