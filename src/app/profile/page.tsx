import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, BellRing, ShieldCheck, UserRound } from "lucide-react";
import { CoachLinkPanel } from "@/components/profile/coach-link-panel";
import { PlayerCoachRequests } from "@/components/profile/player-coach-requests";
import { MobileShell } from "@/components/mobile/mobile-shell";
import { getCurrentAccount } from "@/lib/auth/current-account";
import { getCoachLinkDashboard } from "@/lib/coach/links";
import { getMyUnreadNotificationCount } from "@/lib/notifications/user-notifications";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const account = await getCurrentAccount();

  if (!account) {
    redirect("/login");
  }

  const [coachLinks, hasPendingCoachRequest, unreadNotificationCount] = await Promise.all([
    getCoachLinkDashboard(account),
    getHasPendingCoachRequest(account.userId),
    getMyUnreadNotificationCount(),
  ]);
  const isActiveCoach = account.roles.some(
    (role) => role.role === "coach" && role.status === "active",
  );

  return (
    <MobileShell title="Profile" subtitle="Player Profile และ Coach Link ของบัญชีนี้">
      <div className="grid gap-4">
        <Link
          href="/"
          className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-[#8c91ff] transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          กลับหน้าแรก
        </Link>

        <Link
          href="/notifications"
          className="flex min-h-12 items-center justify-between gap-3 rounded-md border border-[#27345b] bg-[#101832] px-4 py-3 text-sm font-semibold text-[#dce3ff] transition hover:border-[#6c72ff] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6c72ff]/60"
        >
          <span className="inline-flex items-center gap-2">
            <BellRing className="h-4 w-4 text-[#8c91ff]" aria-hidden />
            Notifications
          </span>
          <span className="rounded-full bg-[#20255d] px-2.5 py-1 text-xs font-semibold text-[#8c91ff]">
            {unreadNotificationCount.toLocaleString("th-TH")} unread
          </span>
        </Link>

        <section className="rounded-md border border-[#27345b] bg-[#101832] p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <UserRound className="h-4 w-4 text-[#8c91ff]" aria-hidden />
                Player Profile
              </div>
              <h2 className="mt-3 truncate text-2xl font-semibold text-white">
                {account.profile?.nameTh ?? "ยังไม่มีโปรไฟล์"}
              </h2>
              <p className="mt-1 truncate text-sm text-[#8390bd]">{account.profile?.nameEn}</p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                account.profile?.rankStatus === "verified"
                  ? "bg-[#073d36] text-[#42e0b3]"
                  : "bg-[#443013] text-[#ffc66d]"
              }`}
            >
              {account.profile?.rankStatus ?? "pending"}
            </span>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <InfoBlock label="Rank" value={account.profile?.rank ?? "-"} />
            <InfoBlock label="Active role" value={account.activeRole} />
          </div>

          <p className="mt-4 text-sm leading-6 text-[#8390bd]">
            {account.profile?.instituteName || "ยังไม่ได้ระบุสถาบัน"}
          </p>
        </section>

        <section className="rounded-md border border-[#27345b] bg-[#101832] p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <ShieldCheck className="h-4 w-4 text-[#8c91ff]" aria-hidden />
            Roles
          </div>
          <div className="mt-3 grid gap-2">
            {account.roles.map((role) => (
              <div
                key={role.role}
                className="flex items-center justify-between gap-3 rounded-md border border-[#27345b] bg-[#0a1128] px-3 py-2 text-sm"
              >
                <span className="capitalize text-[#dce3ff]">{role.role}</span>
                <span className="text-[#8390bd]">{role.status}</span>
              </div>
            ))}
          </div>
        </section>

        <PlayerCoachRequests incomingLinks={coachLinks.incomingLinks} />

        <CoachLinkPanel
          isActiveCoach={isActiveCoach}
          hasPendingCoachRequest={hasPendingCoachRequest}
          coachLinks={coachLinks.coachLinks}
        />
      </div>
    </MobileShell>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[#27345b] bg-[#0a1128] p-3">
      <p className="text-xs text-[#7480aa]">{label}</p>
      <p className="mt-1 truncate font-semibold text-white">{value}</p>
    </div>
  );
}

async function getHasPendingCoachRequest(accountId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("role_requests")
    .select("id")
    .eq("account_id", accountId)
    .eq("requested_role", "coach")
    .eq("status", "pending")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}
