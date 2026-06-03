import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut, ShieldCheck, Trophy, UserRound } from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";
import { DigitalIdCard } from "@/components/home/digital-id-card";
import { MobileShell } from "@/components/mobile/mobile-shell";
import { getCurrentAccount } from "@/lib/auth/current-account";
import { getCoachLinkDashboard } from "@/lib/coach/links";
import { createDigitalIdQrDataUrl } from "@/lib/digital-id/qr";

export const dynamic = "force-dynamic";

const roleLabels: Record<string, string> = {
  admin: "ผู้ดูแล",
  coach: "โค้ช",
  player: "นักกีฬา",
  referee: "กรรมการ",
};

export default async function Home() {
  const account = await getCurrentAccount();

  if (!account) {
    redirect("/login");
  }

  const [coachLinks, qrDataUrl] = await Promise.all([
    getCoachLinkDashboard(account),
    createDigitalIdQrDataUrl(account),
  ]);
  const activeRoles = account.roles.filter((role) => role.status === "active");
  const isActiveAdmin = activeRoles.some((role) => role.role === "admin");
  const isActiveCoach = activeRoles.some((role) => role.role === "coach");
  const isActiveReferee = activeRoles.some((role) => role.role === "referee");
  const hasPendingCoachRole = account.roles.some(
    (role) => role.role === "coach" && role.status === "pending",
  );
  const incomingPendingCount = coachLinks.incomingLinks.filter(
    (link) => link.status === "pending",
  ).length;
  const approvedLinkedPlayers = coachLinks.coachLinks.filter(
    (link) => link.status === "approved" && link.player,
  );
  const quickActions = [
    {
      description:
        incomingPendingCount > 0
          ? `มีคำขอ Coach Link รออยู่ ${incomingPendingCount.toLocaleString("th-TH")} รายการ`
          : "ดูข้อมูลโปรไฟล์และจัดการ Coach Link",
      href: "/profile",
      icon: <UserRound className="h-5 w-5" aria-hidden />,
      label: "โปรไฟล์",
    },
    {
      description: isActiveReferee
        ? "บัญชีนี้มีสิทธิ์กรรมการแล้ว"
        : "กรอกรหัสเชิญจาก Admin เพื่อรับสิทธิ์กรรมการ",
      href: "/referee/invite",
      icon: <ShieldCheck className="h-5 w-5" aria-hidden />,
      label: isActiveReferee ? "Referee" : "รหัสกรรมการ",
    },
    isActiveAdmin
      ? {
          description: "เปิดหน้าจัดการหลังบ้าน",
          href: "/admin",
          icon: <ShieldCheck className="h-5 w-5" aria-hidden />,
          label: "Admin",
        }
      : {
          description: hasPendingCoachRole
            ? "Coach role รอ Admin อนุมัติ"
            : activeRoles.map((role) => roleLabels[role.role] ?? role.role).join(", "),
          href: "/profile",
          icon: <ShieldCheck className="h-5 w-5" aria-hidden />,
          label: "บทบาทของฉัน",
        },
    {
      description: isActiveCoach
        ? `${approvedLinkedPlayers.length.toLocaleString("th-TH")} linked players ที่อนุมัติแล้ว`
        : "อนุมัติหรือปฏิเสธคำขอเชื่อมจาก Coach",
      href: "/profile",
      icon: <UserRound className="h-5 w-5" aria-hidden />,
      label: isActiveCoach ? "Linked Players" : "Coach Link",
    },
  ];

  return (
    <MobileShell title="หน้าแรก" subtitle="Digital ID และทางลัดของบัญชี TESUJI">
      <div className="grid gap-4">
        <DigitalIdCard
          activeRole={account.activeRole}
          instituteName={account.profile?.instituteName ?? null}
          nameEn={account.profile?.nameEn ?? null}
          nameTh={account.profile?.nameTh ?? null}
          profileId={account.profile?.id ?? null}
          qrDataUrl={qrDataUrl}
          rank={account.profile?.rank ?? null}
          rankStatus={account.profile?.rankStatus ?? null}
        />

        <section className="rounded-2xl border border-[#27345b] bg-[#101832] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-white">Quick Access</h2>
              <p className="mt-1 text-sm text-[#8390bd]">ทางลัดที่เชื่อมกับ route จริงแล้ว</p>
            </div>
            <span className="rounded-full border border-[#27345b] px-2.5 py-1 text-xs font-semibold text-[#aab4da]">
              2x2
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {quickActions.map((action) => (
              <QuickActionTile
                key={`${action.href}-${action.label}`}
                description={action.description}
                href={action.href}
                icon={action.icon}
                label={action.label}
              />
            ))}
          </div>
        </section>

        {isActiveCoach ? (
          <section className="rounded-2xl border border-[#27345b] bg-[#101832] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-white">Linked Players</h2>
                <p className="mt-1 text-sm text-[#8390bd]">
                  เฉพาะผู้เล่นที่ approve Coach Link แล้ว
                </p>
              </div>
              <span className="rounded-full border border-[#27345b] px-2.5 py-1 text-xs font-semibold text-[#aab4da]">
                {approvedLinkedPlayers.length.toLocaleString("th-TH")}
              </span>
            </div>

            {approvedLinkedPlayers.length > 0 ? (
              <div className="mt-4 grid gap-2">
                {approvedLinkedPlayers.map((link) => (
                  <div
                    key={link.id}
                    className="rounded-xl border border-[#27345b] bg-[#0a1128] p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">
                          {link.player?.nameTh}
                        </p>
                        <p className="mt-1 truncate text-xs text-[#8390bd]">
                          {link.player?.nameEn}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-[#073d36] px-2 py-1 text-xs font-semibold text-[#42e0b3]">
                        approved
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-[#aab4da]">
                      {link.player?.rank ?? "-"} ·{" "}
                      {link.player?.instituteName || "ยังไม่ได้ระบุสถาบัน"}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="ยังไม่มี linked players ที่ approved"
                description="ส่งคำขอจากหน้า Profile และรอให้ Player เจ้าของบัญชีอนุมัติก่อน"
              />
            )}
          </section>
        ) : null}

        <section className="rounded-2xl border border-[#27345b] bg-[#101832] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-white">Tournament Snapshot</h2>
              <p className="mt-1 text-sm text-[#8390bd]">
                อ่านรายการแข่งขันที่เผยแพร่จริงจาก Supabase
              </p>
            </div>
            <Link
              href="/tournaments"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#27345b] bg-[#0a1128] text-[#8c91ff] transition hover:border-[#6c72ff] hover:text-white"
              aria-label="Open tournaments"
            >
              <Trophy className="h-5 w-5" aria-hidden />
            </Link>
          </div>
          <div className="mt-4 grid gap-3">
            <EmptyState
              title="รายการแข่งขัน"
              description="เปิดดูรายการที่ Admin เผยแพร่แล้วได้ที่ /tournaments; draft จะไม่แสดงใน public list"
            />
            <EmptyState
              title="การสมัครที่รอดำเนินการ"
              description="จะเริ่มแสดงเมื่อ registration/payment flow ใช้งานจริงใน Sprint 5"
            />
          </div>
        </section>

        <LogoutButton>
          <LogOut className="mr-2 h-4 w-4" aria-hidden />
          ออกจากระบบ
        </LogoutButton>
      </div>
    </MobileShell>
  );
}

function QuickActionTile({
  description,
  href,
  icon,
  label,
}: {
  description: string;
  href: string;
  icon: ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="group flex min-h-32 flex-col justify-between rounded-xl border border-[#27345b] bg-[#0a1128] p-3 outline-none transition hover:border-[#6c72ff] hover:bg-[#111a34] focus-visible:ring-2 focus-visible:ring-[#6c72ff]"
    >
      <span className="flex items-center justify-between gap-2 text-[#dce3ff]">
        <span className="grid h-9 w-9 place-items-center rounded-lg border border-[#27345b] bg-[#101832] text-[#8c91ff] transition group-hover:border-[#6c72ff] group-hover:text-white">
          {icon}
        </span>
        <span aria-hidden className="text-[#7480aa] transition group-hover:text-white">
          →
        </span>
      </span>
      <span>
        <span className="block text-sm font-semibold text-white">{label}</span>
        <span className="mt-1 line-clamp-2 block text-xs leading-5 text-[#8390bd]">
          {description}
        </span>
      </span>
    </Link>
  );
}

function EmptyState({ description, title }: { description: string; title: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[#27345b] bg-[#0a1128] p-3">
      <p className="text-sm font-semibold text-[#dce3ff]">{title}</p>
      <p className="mt-1 text-xs leading-5 text-[#8390bd]">{description}</p>
    </div>
  );
}
