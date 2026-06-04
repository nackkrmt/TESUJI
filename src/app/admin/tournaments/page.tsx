import Link from "next/link";
import { ArrowRight, Plus, Trophy } from "lucide-react";
import { getAdminTournaments, type TournamentRecord } from "@/lib/tournaments/admin";

export const dynamic = "force-dynamic";

export default async function AdminTournamentsPage() {
  const result = await getTournamentPageState();

  return (
    <div className="flex w-full flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#7378ff]">Tournament CRUD</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-white">
            จัดการรายการแข่งขัน
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#8390bd]">
            อ่านและเขียนข้อมูล tournament จริงจาก Supabase โดยยังไม่เปิด admin route guard ใน dev mode
          </p>
        </div>
        <Link
          href="/admin/tournaments/new"
          className="inline-flex w-fit items-center justify-center gap-2 rounded-md bg-[#6c72ff] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#7c82ff]"
        >
          <Plus className="h-4 w-4" aria-hidden />
          New tournament
        </Link>
      </header>

      {result.error ? (
        <section className="rounded-lg border border-[#443013] bg-[#1c160b] p-6">
          <p className="text-sm font-semibold text-[#ffc66d]">Migration pending</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Tournament tables are not on Supabase yet</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#d8c39a]">
            {result.error} Apply `202606040001_tournament_admin.sql` with `npx.cmd supabase db push --linked`,
            then reload this page to use real Tournament CRUD.
          </p>
        </section>
      ) : result.tournaments.length > 0 ? (
        <section className="grid gap-4">
          {result.tournaments.map((tournament) => (
            <TournamentAdminCard key={tournament.id} tournament={tournament} />
          ))}
        </section>
      ) : (
        <section className="rounded-lg border border-dashed border-[#27345b] bg-[#101832] p-8 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#17244d] text-[#8c91ff]">
            <Trophy className="h-6 w-6" aria-hidden />
          </div>
          <h2 className="mt-4 text-xl font-semibold text-white">ยังไม่มี tournament</h2>
          <p className="mt-2 text-sm leading-6 text-[#8390bd]">
            สร้าง draft แรกก่อน แล้วค่อยเพิ่ม divisions และ promo codes
          </p>
        </section>
      )}
    </div>
  );
}

async function getTournamentPageState() {
  try {
    return {
      error: null,
      tournaments: await getAdminTournaments(),
    };
  } catch (error) {
    if (isSupabaseErrorCode(error, "PGRST205")) {
      return {
        error: "Remote Supabase cannot find public.tournaments yet.",
        tournaments: [],
      };
    }

    throw error;
  }
}

function isSupabaseErrorCode(error: unknown, code: string) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === code
  );
}

function TournamentAdminCard({ tournament }: { tournament: TournamentRecord }) {
  return (
    <article className="rounded-lg border border-[#202a49] bg-[#101832] p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={tournament.status} />
            <span className="text-xs text-[#7480aa]">Updated {formatDate(tournament.updatedAt)}</span>
          </div>
          <h2 className="mt-3 text-2xl font-semibold text-white">{tournament.title}</h2>
          <div className="mt-4 grid gap-2 text-sm text-[#aab4da] md:grid-cols-2">
            <p>สมัคร: {formatDateRange(tournament.registrationOpensAt, tournament.registrationClosesAt)}</p>
            <p>แข่ง: {formatEventDate(tournament)}</p>
            <p>สถานที่: {tournament.venueAddress || tournament.venueName || "-"}</p>
            <p>PromptPay: {tournament.promptpayName || tournament.promptpayId || "-"}</p>
          </div>
        </div>
        <Link
          href={`/admin/tournaments/${tournament.id}`}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md border border-[#27345b] px-4 py-2 text-sm font-semibold text-[#dce3ff] transition hover:border-[#6c72ff] hover:text-white"
        >
          Manage
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </article>
  );
}

function StatusBadge({ status }: { status: TournamentRecord["status"] }) {
  const className =
    status === "open"
      ? "bg-[#073d36] text-[#42e0b3]"
      : status === "draft"
        ? "bg-[#20255d] text-[#8c91ff]"
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
    return "-";
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
