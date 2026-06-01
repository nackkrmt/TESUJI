import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut, ShieldCheck } from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";
import { MobileShell } from "@/components/mobile/mobile-shell";
import { getCurrentAccount } from "@/lib/auth/current-account";

export const dynamic = "force-dynamic";

export default async function Home() {
  const account = await getCurrentAccount();

  if (!account) {
    redirect("/login");
  }

  return (
    <MobileShell title="My Profile" subtitle="โปรไฟล์นักกีฬาของคุณในระบบ TESUJI">
      <div className="grid gap-4">
        <section className="rounded-md border border-[#27345b] bg-[#101832] p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-[#8390bd]">Player Profile</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">
                {account.profile?.nameTh ?? "ยังไม่มีโปรไฟล์"}
              </h2>
              <p className="mt-1 text-sm text-[#8390bd]">{account.profile?.nameEn}</p>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
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

          <p className="mt-4 text-sm text-[#8390bd]">
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
                className="flex items-center justify-between rounded-md border border-[#27345b] bg-[#0a1128] px-3 py-2 text-sm"
              >
                <span className="capitalize text-[#dce3ff]">{role.role}</span>
                <span className="text-[#8390bd]">{role.status}</span>
              </div>
            ))}
          </div>
        </section>

        <Link
          href="/admin"
          className="inline-flex min-h-12 items-center justify-center rounded-md border border-[#27345b] bg-[#101832] px-4 py-3 text-sm font-semibold text-[#dce3ff] transition hover:border-[#6c72ff] hover:text-white"
        >
          เปิด Admin Dashboard
        </Link>

        <LogoutButton>
          <LogOut className="mr-2 h-4 w-4" aria-hidden />
          ออกจากระบบ
        </LogoutButton>
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
