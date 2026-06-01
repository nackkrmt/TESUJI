import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { MobileShell } from "@/components/mobile/mobile-shell";

export default function ForgotPasswordPage() {
  return (
    <MobileShell title="ลืมรหัสผ่าน" subtitle="ระบบจะส่งลิงก์รีเซ็ตรหัสผ่านผ่าน Supabase ไปยังอีเมลของคุณ">
      <ForgotPasswordForm />
    </MobileShell>
  );
}
