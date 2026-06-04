import Link from "next/link";
import { ArrowRight, CalendarDays, MapPin, Trophy } from "lucide-react";
import { MobileShell } from "@/components/mobile/mobile-shell";
import { getPublicTournaments, type TournamentRecord } from "@/lib/tournaments/admin";

export const dynamic = "force-dynamic";

export default async function TournamentsPage() {
  const tournaments = await getPublicTournaments();

  return (
    <MobileShell title="รายการแข่งขัน" subtitle="รายการที่เผยแพร่จากฐานข้อมูลจริง">
      <div className="grid gap-4">
        {tournaments.length > 0 ? (
          tournaments.map((tournament) => (
            <Link
              key={tournament.id}
              href={`/tournaments/${tournament.id}`}
              className="rounded-2xl border border-[#27345b] bg-[#101832] p-4 outline-none transition hover:border-[#6c72ff] focus-visible:ring-2 focus-visible:ring-[#6c72ff]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <StatusBadge status={tournament.status} />
                  <h2 className="mt-3 text-xl font-semibold text-white">{tournament.title}</h2>
                </div>
                <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-[#8390bd]" aria-hidden />
              </div>

              <div className="mt-4 grid gap-2 text-sm leading-6 text-[#aab4da]">
                <p className="flex items-start gap-2">
                  <CalendarDays className="mt-1 h-4 w-4 shrink-0 text-[#8c91ff]" aria-hidden />
                  {formatEventDate(tournament)}
                </p>
                <p className="flex items-start gap-2">
                  <MapPin className="mt-1 h-4 w-4 shrink-0 text-[#8c91ff]" aria-hidden />
                  {tournament.venueAddress || tournament.venueName || "ยังไม่ระบุสถานที่"}
                </p>
              </div>
            </Link>
          ))
        ) : (
          <section className="rounded-2xl border border-dashed border-[#27345b] bg-[#101832] p-6 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#17244d] text-[#8c91ff]">
              <Trophy className="h-6 w-6" aria-hidden />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-white">ยังไม่มีรายการที่เผยแพร่</h2>
            <p className="mt-2 text-sm leading-6 text-[#8390bd]">
              เมื่อ Admin เปิดสถานะ tournament เป็น open/closed แล้ว รายการจะแสดงที่นี่จาก Supabase จริง
            </p>
          </section>
        )}
      </div>
    </MobileShell>
  );
}

function StatusBadge({ status }: { status: TournamentRecord["status"] }) {
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
    return "ยังไม่ระบุวันแข่งขัน";
  }

  return `${formatDate(start)} - ${formatDate(end)}`;
}

function formatEventDate(tournament: TournamentRecord) {
  if (tournament.eventDate) {
    return new Intl.DateTimeFormat("th-TH", {
      dateStyle: "medium",
    }).format(new Date(`${tournament.eventDate}T00:00:00.000Z`));
  }

  return formatDateRange(tournament.eventStartsAt, tournament.eventEndsAt);
}
