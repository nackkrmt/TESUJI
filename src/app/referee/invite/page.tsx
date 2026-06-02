import { redirect } from "next/navigation";
import { RefereeInviteForm } from "@/components/referee/referee-invite-form";
import { MobileShell } from "@/components/mobile/mobile-shell";
import { getCurrentAccount } from "@/lib/auth/current-account";

export const dynamic = "force-dynamic";

export default async function RefereeInvitePage() {
  const account = await getCurrentAccount();

  if (!account) {
    redirect("/login");
  }

  const hasRefereeRole = account.roles.some(
    (role) => role.role === "referee" && role.status === "active",
  );

  return (
    <MobileShell title="Referee Invite" subtitle="สำหรับผู้ที่ได้รับ invite code จาก Admin">
      <div className="grid gap-5">
        {hasRefereeRole ? (
          <div className="rounded-md border border-[#073d36] bg-[#071f20] p-4 text-sm leading-6 text-[#42e0b3]">
            บัญชีนี้มี role Referee แล้ว
          </div>
        ) : (
          <RefereeInviteForm />
        )}
      </div>
    </MobileShell>
  );
}
