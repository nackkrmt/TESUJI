import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, LockKeyhole, Ticket, UserRound } from "lucide-react";
import {
  MobileShell,
  primaryButtonClassName,
  secondaryButtonClassName,
} from "@/components/mobile/mobile-shell";
import { getRegistrationPageData } from "@/lib/registrations/options";
import { RegistrationForm } from "./registration-form";

export const dynamic = "force-dynamic";

export default async function TournamentRegisterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getRegistrationPageData(id);

  if (!data) {
    notFound();
  }

  return (
    <MobileShell title="สมัครแข่งขัน" subtitle={data.tournament.title}>
      <div className="grid gap-4">
        <Link
          href={`/tournaments/${data.tournament.id}`}
          className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-[#8c91ff] transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          กลับรายละเอียดรายการ
        </Link>

        {!data.isRegistrationOpen ? (
          <StatePanel
            icon={<Ticket className="h-5 w-5" aria-hidden />}
            title="ยังไม่เปิดรับสมัคร"
            message={getClosedMessage(data.tournament.registrationOpensAt, data.tournament.registrationClosesAt)}
          />
        ) : data.authState === "guest" ? (
          <GuestPanel tournamentId={data.tournament.id} />
        ) : data.authState === "missing_profile" ? (
          <StatePanel
            icon={<UserRound className="h-5 w-5" aria-hidden />}
            title="ยังไม่มี Player Profile"
            message="บัญชีนี้ยังไม่มีข้อมูลผู้เล่นสำหรับสมัครแข่งขัน"
          >
            <Link href="/profile" className={primaryButtonClassName}>
              เปิดโปรไฟล์
            </Link>
          </StatePanel>
        ) : data.players.length === 0 ? (
          <StatePanel
            icon={<UserRound className="h-5 w-5" aria-hidden />}
            title="ยังไม่มีผู้เล่นที่สมัครได้"
            message="บัญชีนี้ยังไม่มีโปรไฟล์ผู้เล่นหรือผู้เล่นที่ Coach link approved"
          />
        ) : data.divisions.length === 0 ? (
          <StatePanel
            icon={<Ticket className="h-5 w-5" aria-hidden />}
            title="ยังไม่มีรุ่นแข่งขัน"
            message="รายการนี้ยังไม่มีรุ่นที่เปิดให้สมัคร"
          />
        ) : (
          <RegistrationForm
            tournamentId={data.tournament.id}
            players={data.players}
            divisions={data.divisions}
          />
        )}
      </div>
    </MobileShell>
  );
}

function GuestPanel({ tournamentId }: { tournamentId: string }) {
  return (
    <StatePanel
      icon={<LockKeyhole className="h-5 w-5" aria-hidden />}
      title="เข้าสู่ระบบก่อนสมัคร"
      message="ใช้บัญชี TESUJI เพื่อสมัครให้ตัวเอง หรือสมัครให้ผู้เล่นที่ link กับ Coach แล้ว"
    >
      <div className="grid gap-3">
        <Link href="/login" className={primaryButtonClassName}>
          เข้าสู่ระบบ
        </Link>
        <Link href="/register" className={secondaryButtonClassName}>
          สร้างบัญชีใหม่
        </Link>
        <Link
          href={`/tournaments/${tournamentId}`}
          className="text-center text-sm font-semibold text-[#8c91ff] transition hover:text-white"
        >
          ดูรายละเอียดรายการ
        </Link>
      </div>
    </StatePanel>
  );
}

function StatePanel({
  children,
  icon,
  title,
  message,
}: {
  children?: ReactNode;
  icon: ReactNode;
  title: string;
  message: string;
}) {
  return (
    <section className="rounded-2xl border border-[#27345b] bg-[#101832] p-5">
      <div className="grid h-11 w-11 place-items-center rounded-full bg-[#17244d] text-[#8c91ff]">
        {icon}
      </div>
      <h2 className="mt-4 text-lg font-semibold text-white">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-[#8390bd]">{message}</p>
      {children ? <div className="mt-5">{children}</div> : null}
    </section>
  );
}

function getClosedMessage(opensAt: string | null, closesAt: string | null) {
  const now = Date.now();

  if (opensAt && now < new Date(opensAt).getTime()) {
    return `เปิดรับสมัคร ${formatDate(opensAt)}`;
  }

  if (closesAt && now > new Date(closesAt).getTime()) {
    return `ปิดรับสมัครแล้วเมื่อ ${formatDate(closesAt)}`;
  }

  return "สถานะรายการหรือรุ่นแข่งขันยังไม่พร้อมรับสมัคร";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
