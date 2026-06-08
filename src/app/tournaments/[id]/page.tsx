import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, MapPin, Ticket } from "lucide-react";
import { MobileShell, primaryButtonClassName } from "@/components/mobile/mobile-shell";
import { getIsRegistrationOpen } from "@/lib/registrations/options";
import { getPublicTournamentDetail, type DivisionRecord } from "@/lib/tournaments/admin";

export const dynamic = "force-dynamic";

export default async function TournamentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tournament = await getPublicTournamentDetail(id);

  if (!tournament) {
    notFound();
  }

  const canRegister = getIsRegistrationOpen(tournament);

  return (
    <MobileShell title={tournament.title} subtitle="รายละเอียดรายการแข่งขัน">
      <div className="grid gap-4">
        <Link
          href="/tournaments"
          className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-[#8c91ff] transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          กลับรายการแข่งขัน
        </Link>

        {tournament.bannerUrl ? (
          <div className="relative aspect-[16/9] overflow-hidden rounded-2xl border border-[#27345b] bg-[#0a1128]">
            <Image
              src={tournament.bannerUrl}
              alt={tournament.bannerAlt ?? tournament.title}
              fill
              sizes="(max-width: 430px) 100vw, 430px"
              className="object-cover"
            />
          </div>
        ) : null}

        <section className="rounded-2xl border border-[#27345b] bg-[#101832] p-4">
          <div className="flex items-center justify-between gap-3">
            <StatusBadge status={tournament.status} />
            <span className="text-xs text-[#7480aa]">Updated {formatDate(tournament.updatedAt)}</span>
          </div>
          {tournament.description ? (
            <p className="mt-4 text-sm leading-6 text-[#dce3ff]">{tournament.description}</p>
          ) : null}
          <div className="mt-4 grid gap-3 text-sm leading-6 text-[#aab4da]">
            <InfoLine
              icon={<CalendarDays className="h-4 w-4" aria-hidden />}
              label="สมัคร"
              value={formatDateRange(tournament.registrationOpensAt, tournament.registrationClosesAt)}
            />
            <InfoLine
              icon={<CalendarDays className="h-4 w-4" aria-hidden />}
              label="แข่งขัน"
              value={formatEventDate(tournament)}
            />
            <InfoLine
              icon={<MapPin className="h-4 w-4" aria-hidden />}
              label="สถานที่"
              value={tournament.venueAddress || tournament.venueName || "ยังไม่ระบุสถานที่"}
            />
          </div>
          {tournament.googleMapsUrl ? (
            <a
              href={tournament.googleMapsUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-md border border-[#27345b] px-4 py-2 text-sm font-semibold text-[#dce3ff] transition hover:border-[#6c72ff] hover:text-white"
            >
              เปิด Google Maps
            </a>
          ) : null}
        </section>

        <section className="rounded-2xl border border-[#27345b] bg-[#101832] p-4">
          <h2 className="font-semibold text-white">รุ่นแข่งขัน</h2>
          <div className="mt-4 grid gap-3">
            {tournament.divisions.length > 0 ? (
              tournament.divisions.map((division) => (
                <DivisionCard key={division.id} division={division} />
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-[#27345b] bg-[#0a1128] p-4">
                <p className="text-sm font-semibold text-[#dce3ff]">ยังไม่มี division</p>
                <p className="mt-1 text-xs leading-5 text-[#8390bd]">
                  Admin ต้องเพิ่ม division ก่อนเปิดรับสมัคร
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-[#27345b] bg-[#101832] p-4">
          <h2 className="font-semibold text-white">การสมัคร</h2>
          {canRegister ? (
            <Link href={`/tournaments/${tournament.id}/register`} className={`mt-4 ${primaryButtonClassName}`}>
              สมัครแข่งขัน
            </Link>
          ) : (
            <button
              type="button"
              disabled
              className="mt-4 inline-flex min-h-12 w-full cursor-not-allowed items-center justify-center rounded-md bg-[#27345b] px-4 py-3 text-sm font-semibold text-[#aab4da] opacity-80"
            >
              ยังไม่เปิดรับสมัคร
            </button>
          )}
        </section>
      </div>
    </MobileShell>
  );
}

function DivisionCard({ division }: { division: DivisionRecord }) {
  return (
    <article className="rounded-xl border border-[#27345b] bg-[#0a1128] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-white">{division.name}</p>
          {division.description ? (
            <p className="mt-1 text-xs leading-5 text-[#8390bd]">{division.description}</p>
          ) : null}
        </div>
        <span className="shrink-0 rounded-full bg-[#20255d] px-2 py-1 text-xs font-semibold text-[#8c91ff]">
          {division.status}
        </span>
      </div>
      <div className="mt-3 grid gap-2 text-xs leading-5 text-[#aab4da]">
        <InfoLine
          icon={<Ticket className="h-4 w-4" aria-hidden />}
          label="ค่าสมัคร"
          value={division.feeAmount > 0 ? `${division.feeAmount.toLocaleString("th-TH")} บาท` : "ฟรี"}
        />
        <p>
          จำกัดคน: {division.maxPlayers?.toLocaleString("th-TH") ?? "ไม่จำกัด"} · Power{" "}
          {formatNumberRange(division.minPowerLevel, division.maxPowerLevel)}
        </p>
        <p>อายุ {formatNumberRange(division.minAge, division.maxAge)} · {division.timeSlotLabel || "ยังไม่ระบุเวลา"}</p>
      </div>
    </article>
  );
}

function InfoLine({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <p className="flex items-start gap-2">
      <span className="mt-1 text-[#8c91ff]">{icon}</span>
      <span>
        <span className="font-semibold text-[#dce3ff]">{label}: </span>
        {value}
      </span>
    </p>
  );
}

function StatusBadge({ status }: { status: string }) {
  const className =
    status === "open"
      ? "bg-[#073d36] text-[#42e0b3]"
      : status === "cancelled"
        ? "bg-[#4a1724] text-[#ffb0bd]"
        : "bg-[#443013] text-[#ffc66d]";

  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}>{status}</span>;
}

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDateRange(start: string | null, end: string | null) {
  if (!start && !end) {
    return "ยังไม่ระบุ";
  }

  return `${formatDate(start)} - ${formatDate(end)}`;
}

function formatNumberRange(min: number | null, max: number | null) {
  if (min === null && max === null) {
    return "Open";
  }

  return `${min ?? "Open"} - ${max ?? "Open"}`;
}

function formatEventDate(tournament: {
  eventDate: string | null;
  eventStartsAt: string | null;
  eventEndsAt: string | null;
}) {
  if (tournament.eventDate) {
    return new Intl.DateTimeFormat("th-TH", {
      dateStyle: "medium",
    }).format(new Date(`${tournament.eventDate}T00:00:00.000Z`));
  }

  return formatDateRange(tournament.eventStartsAt, tournament.eventEndsAt);
}
