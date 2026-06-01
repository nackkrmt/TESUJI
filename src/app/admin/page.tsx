import Link from "next/link";
import {
  ArrowRight,
  Database,
  ShieldCheck,
  TicketCheck,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { getGoDatabaseSummaries } from "@/lib/go/database-summary";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const summaries = await getGoDatabaseSummaries();
  const totalImportable = summaries.reduce((sum, item) => sum + item.importableRows, 0);
  const totalSkipped = summaries.reduce((sum, item) => sum + item.skippedRows, 0);
  const readySources = summaries.filter((item) => !item.error && item.importableRows > 0).length;

  return (
    <div className="flex w-full flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#7378ff]">Admin Dashboard</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-white">
            ภาพรวมระบบ TESUJI
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#8390bd]">
            หน้านี้จะเป็นศูนย์รวม widget ของระบบทั้งหมด เมื่อแต่ละระบบพร้อมใช้งานจริงแล้วค่อยเปิดข้อมูลขึ้นมาแสดง
          </p>
        </div>
        <Link
          href="/admin/database"
          className="inline-flex w-fit items-center justify-center gap-2 rounded-md bg-[#6c72ff] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#7c82ff]"
        >
          เปิด Database
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <OverviewWidget
          icon={<Database className="h-5 w-5" />}
          label="Player Database"
          value={`${readySources}/3`}
          detail={`${totalImportable.toLocaleString("th-TH")} importable, ${totalSkipped.toLocaleString("th-TH")} skip`}
          tone="cyan"
        />
        <OverviewWidget
          icon={<TicketCheck className="h-5 w-5" />}
          label="Registrations"
          value="-"
          detail="รอเปิดระบบสมัครแข่งขัน"
          tone="violet"
        />
        <OverviewWidget
          icon={<UsersRound className="h-5 w-5" />}
          label="Coach Requests"
          value="-"
          detail="รอระบบอนุมัติ Coach"
          tone="green"
        />
        <OverviewWidget
          icon={<WalletCards className="h-5 w-5" />}
          label="Payments"
          value="-"
          detail="รอระบบตรวจสลิป"
          tone="amber"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
        <div className="min-h-[420px] rounded-lg border border-[#202a49] bg-[#101832] p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Overview Widgets</h2>
              <p className="mt-1 text-sm text-[#8390bd]">พื้นที่นี้จะเติม widget จริงทีละระบบ</p>
            </div>
            <span className="rounded-full bg-[#151f3e] px-3 py-1 text-xs font-semibold text-[#aab4da]">
              empty
            </span>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {["Tournament", "Player roles", "Referee tools", "Exports"].map((label) => (
              <div
                key={label}
                className="min-h-32 rounded-md border border-dashed border-[#2c3961] bg-[#0c142d] p-4"
              >
                <p className="text-sm font-semibold text-[#dce3ff]">{label}</p>
                <p className="mt-2 text-xs leading-5 text-[#7480aa]">ยังไม่มีข้อมูลจริงให้แสดง</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-[#202a49] bg-[#101832]">
          <div className="border-b border-[#202a49] p-6">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-md bg-[#17244d] text-[#7378ff]">
                <ShieldCheck className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">System Readiness</h2>
                <p className="mt-1 text-sm text-[#8390bd]">ข้อมูลที่ใช้ได้จริงตอนนี้</p>
              </div>
            </div>
          </div>
          <div className="divide-y divide-[#202a49]">
            {summaries.map((summary) => (
              <div key={summary.source} className="flex items-center justify-between gap-4 p-5">
                <div>
                  <p className="font-semibold text-white">{summary.label}</p>
                  <p className="mt-1 text-xs text-[#8390bd]">{summary.fileName}</p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    summary.error ? "bg-[#4a1724] text-[#ff8fa3]" : "bg-[#073d36] text-[#42e0b3]"
                  }`}
                >
                  {summary.error ? "error" : "ready"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function OverviewWidget({
  icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  tone: "cyan" | "violet" | "green" | "amber";
}) {
  const toneClass = {
    cyan: "bg-[#0a3448] text-[#58d8ff]",
    violet: "bg-[#20255d] text-[#8c91ff]",
    green: "bg-[#073d36] text-[#42e0b3]",
    amber: "bg-[#443013] text-[#ffc66d]",
  }[tone];

  return (
    <article className="rounded-lg border border-[#202a49] bg-[#101832] p-5">
      <div className="flex items-center justify-between gap-4">
        <div className={`grid h-10 w-10 place-items-center rounded-md ${toneClass}`}>{icon}</div>
        <span className="text-2xl leading-none text-[#7480aa]">...</span>
      </div>
      <p className="mt-5 text-sm font-semibold text-[#aab4da]">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-xs leading-5 text-[#7480aa]">{detail}</p>
    </article>
  );
}
