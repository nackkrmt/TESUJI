import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  ShieldCheck,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { getPendingPaymentOrderCount } from "@/lib/admin/payments";
import { getPendingRankApprovalCount } from "@/lib/admin/rank-approvals";
import {
  getCoachRequests,
  getRefereeInviteCounts,
  type RefereeInviteCounts,
} from "@/lib/admin/role-management";
import { getGoDatabaseSummaries } from "@/lib/go/database-summary";
import { getAdminTournaments } from "@/lib/tournaments/admin";

export const dynamic = "force-dynamic";

type CountState = {
  value: number;
  error: string | null;
};

type RefereeInviteCountState = {
  active: CountState;
  redeemed: CountState;
  expired: CountState;
  revoked: CountState;
};

export default async function AdminDashboardPage() {
  const [summaries, coachRequests, tournamentResult, queueCounts] = await Promise.all([
    getGoDatabaseSummaries(),
    getCoachRequests(),
    getTournamentDashboardState(),
    getAdminQueueCounts(),
  ]);
  const tournaments = tournamentResult.tournaments;
  const totalImportable = summaries.reduce((sum, item) => sum + item.importableRows, 0);
  const totalSkipped = summaries.reduce((sum, item) => sum + item.skippedRows, 0);
  const readySources = summaries.filter((item) => !item.error && item.importableRows > 0).length;
  const pendingCoachRequests = coachRequests.filter((request) => request.status === "pending").length;
  const openTournaments = tournaments.filter((tournament) => tournament.status === "open").length;
  const draftTournaments = tournaments.filter((tournament) => tournament.status === "draft").length;

  return (
    <div className="flex w-full flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#7378ff]">Admin Dashboard</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-white">
            TESUJI operations
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#8390bd]">
            Live Admin queues for payment verification, rank review, Coach approval, and
            Referee invite follow-up.
          </p>
        </div>
        <Link
          href="/admin/payments"
          className="inline-flex w-fit items-center justify-center gap-2 rounded-md bg-[#6c72ff] px-4 py-3 text-sm font-semibold text-white transition duration-200 hover:bg-[#7c82ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8c91ff]/60"
        >
          Open ops queue
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <OverviewWidget
          icon={<WalletCards className="h-5 w-5" />}
          label="Payment Verify"
          value={formatCount(queueCounts.pendingPayments)}
          detail={queueCounts.pendingPayments.error ?? "pending_verify slip queue"}
          tone="amber"
        />
        <OverviewWidget
          icon={<BadgeCheck className="h-5 w-5" />}
          label="Rank Review"
          value={formatCount(queueCounts.pendingRanks)}
          detail={queueCounts.pendingRanks.error ?? "pending self-declared ranks"}
          tone="violet"
        />
        <OverviewWidget
          icon={<UsersRound className="h-5 w-5" />}
          label="Coach Requests"
          value={pendingCoachRequests.toLocaleString("th-TH")}
          detail="pending coach approval"
          tone="green"
        />
        <OverviewWidget
          icon={<ShieldCheck className="h-5 w-5" />}
          label="Referee Invites"
          value={formatCount(queueCounts.refereeInvites.active)}
          detail={`${formatCount(queueCounts.refereeInvites.redeemed)} redeemed, ${formatCount(
            queueCounts.refereeInvites.revoked,
          )} revoked`}
          tone="cyan"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
        <div className="min-h-[420px] rounded-lg border border-[#202a49] bg-[#101832] p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Operation Queues</h2>
              <p className="mt-1 text-sm text-[#8390bd]">
                Real queues that need review or follow-up.
              </p>
            </div>
            <span className="rounded-full bg-[#151f3e] px-3 py-1 text-xs font-semibold text-[#aab4da]">
              live
            </span>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <OverviewLink
              href="/admin/payments"
              title="Payment verification"
              description={`${formatCount(queueCounts.pendingPayments)} payment order(s) waiting for slip review`}
            />
            <OverviewLink
              href="/admin/ranks"
              title="Pending ranks"
              description={`${formatCount(queueCounts.pendingRanks)} player profile(s) waiting for rank review`}
            />
            <OverviewLink
              href="/admin/roles"
              title="Coach requests"
              description={`${pendingCoachRequests.toLocaleString("th-TH")} pending coach approval`}
            />
            <OverviewLink
              href="/admin/roles"
              title="Referee tools"
              description={`${formatCount(queueCounts.refereeInvites.active)} active invite(s), ${formatCount(
                queueCounts.refereeInvites.expired,
              )} expired`}
            />
            <OverviewLink
              href="/admin/tournaments"
              title="Tournaments"
              description={
                tournamentResult.error ??
                `${openTournaments.toLocaleString("th-TH")} open, ${draftTournaments.toLocaleString("th-TH")} draft`
              }
            />
            <OverviewLink
              href="/admin/database"
              title="Player database"
              description={`${readySources}/3 sources ready with ${totalImportable.toLocaleString(
                "th-TH",
              )} importable rows`}
            />
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
                <p className="mt-1 text-sm text-[#8390bd]">Current real data sources.</p>
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
            <div className="flex items-center justify-between gap-4 p-5">
              <div>
                <p className="font-semibold text-white">Tournaments</p>
                <p className="mt-1 text-xs text-[#8390bd]">
                  {tournamentResult.error ?? `${tournaments.length.toLocaleString("th-TH")} total`}
                </p>
              </div>
              <span className="rounded-full bg-[#20255d] px-2.5 py-1 text-xs font-semibold text-[#8c91ff]">
                {tournamentResult.error ? "check" : "ready"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 p-5">
              <div>
                <p className="font-semibold text-white">Skipped import rows</p>
                <p className="mt-1 text-xs text-[#8390bd]">DAN / KYU / AWARD parser audit</p>
              </div>
              <span className="rounded-full bg-[#0a3448] px-2.5 py-1 text-xs font-semibold text-[#58d8ff]">
                {totalSkipped.toLocaleString("th-TH")}
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

async function getAdminQueueCounts() {
  const [pendingPayments, pendingRanks, refereeInvites] = await Promise.allSettled([
    getPendingPaymentOrderCount(),
    getPendingRankApprovalCount(),
    getRefereeInviteCounts(),
  ]);

  return {
    pendingPayments: countFromSettled(pendingPayments, "Payment queue unavailable"),
    pendingRanks: countFromSettled(pendingRanks, "Rank queue unavailable"),
    refereeInvites: refereeCountsFromSettled(refereeInvites),
  };
}

async function getTournamentDashboardState() {
  try {
    return {
      error: null,
      tournaments: await getAdminTournaments(),
    };
  } catch (error) {
    return {
      error: getDashboardError(error, "Tournament summary unavailable"),
      tournaments: [],
    };
  }
}

function countFromSettled(
  result: PromiseSettledResult<number>,
  fallbackMessage: string,
): CountState {
  if (result.status === "fulfilled") {
    return {
      error: null,
      value: result.value,
    };
  }

  return {
    error: getDashboardError(result.reason, fallbackMessage),
    value: 0,
  };
}

function refereeCountsFromSettled(
  result: PromiseSettledResult<RefereeInviteCounts>,
): RefereeInviteCountState {
  if (result.status === "fulfilled") {
    return {
      active: { error: null, value: result.value.active },
      redeemed: { error: null, value: result.value.redeemed },
      expired: { error: null, value: result.value.expired },
      revoked: { error: null, value: result.value.revoked },
    };
  }

  const error = getDashboardError(result.reason, "Referee invite counts unavailable");

  return {
    active: { error, value: 0 },
    redeemed: { error, value: 0 },
    expired: { error, value: 0 },
    revoked: { error, value: 0 },
  };
}

function getDashboardError(error: unknown, fallbackMessage: string) {
  if (isSupabaseErrorCode(error, "PGRST205") || isSupabaseErrorCode(error, "42703")) {
    return "Migration pending";
  }

  if (isSupabaseErrorCode(error, "42883")) {
    return "RPC migration pending";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallbackMessage;
}

function formatCount(count: CountState) {
  return count.error ? "-" : count.value.toLocaleString("th-TH");
}

function isSupabaseErrorCode(error: unknown, code: string) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === code
  );
}

function OverviewWidget({
  icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: ReactNode;
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

function OverviewLink({
  description,
  href,
  title,
}: {
  description: string;
  href: string;
  title: string;
}) {
  return (
    <Link
      href={href}
      className="group min-h-32 rounded-md border border-dashed border-[#2c3961] bg-[#0c142d] p-4 transition duration-200 hover:border-[#6c72ff] hover:bg-[#111a34] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8c91ff]/60"
    >
      <p className="text-sm font-semibold text-[#dce3ff]">{title}</p>
      <p className="mt-2 text-xs leading-5 text-[#7480aa] transition duration-200 group-hover:text-[#aab4da]">
        {description}
      </p>
    </Link>
  );
}
