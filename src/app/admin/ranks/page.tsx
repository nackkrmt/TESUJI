import type { ReactNode } from "react";
import {
  BadgeCheck,
  Clock,
  Mail,
  Medal,
  School,
  UserRound,
} from "lucide-react";
import {
  getPendingRankApprovals,
  type PendingRankApproval,
} from "@/lib/admin/rank-approvals";
import { RankApprovalControls } from "./rank-approval-controls";

export const dynamic = "force-dynamic";

export default async function AdminRanksPage() {
  const result = await getRanksPageState();
  const oldestRequest = result.profiles[0]?.createdAt ?? null;

  return (
    <div className="flex w-full flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#8c91ff]">Rank Approval</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-white">
            Pending rank queue
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#8390bd]">
            Review self-declared player ranks from real Player Profiles. Dev mode keeps Admin routes reachable;
            mutations run through the service-role rank approval RPC.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[420px]">
          <Metric label="Pending ranks" value={result.profiles.length.toLocaleString("en-US")} />
          <Metric label="Oldest request" value={oldestRequest ? formatDate(oldestRequest) : "-"} compact />
        </div>
      </header>

      {result.error ? (
        <section className="rounded-lg border border-[#443013] bg-[#1c160b] p-6">
          <p className="text-sm font-semibold text-[#ffc66d]">Migration pending</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Rank approval RPC is not ready</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#d8c39a]">
            {result.error} Apply `202606100001_pending_rank_approval.sql` with
            `npx.cmd supabase db push --linked`, then reload this page.
          </p>
        </section>
      ) : result.profiles.length > 0 ? (
        <section className="grid gap-5">
          {result.profiles.map((profile) => (
            <RankApprovalCard key={profile.id} profile={profile} />
          ))}
        </section>
      ) : (
        <section className="rounded-lg border border-dashed border-[#27345b] bg-[#101832] p-8 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#20255d] text-[#8c91ff]">
            <BadgeCheck className="h-6 w-6" aria-hidden />
          </div>
          <h2 className="mt-4 text-xl font-semibold text-white">No pending ranks</h2>
          <p className="mt-2 text-sm leading-6 text-[#8390bd]">
            New self-declared ranks will appear here after signup.
          </p>
        </section>
      )}
    </div>
  );
}

async function getRanksPageState() {
  try {
    return {
      error: null,
      profiles: await getPendingRankApprovals(),
    };
  } catch (error) {
    if (
      isSupabaseErrorCode(error, "PGRST205") ||
      isSupabaseErrorCode(error, "42703") ||
      isSupabaseErrorCode(error, "42883")
    ) {
      return {
        error: error instanceof Error ? error.message : "Remote Supabase cannot read rank approvals yet.",
        profiles: [],
      };
    }

    throw error;
  }
}

function RankApprovalCard({ profile }: { profile: PendingRankApproval }) {
  return (
    <article className="rounded-lg border border-[#202a49] bg-[#101832] p-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge />
                <span className="text-xs text-[#7480aa]">Profile {shortId(profile.id)}</span>
                <span className="text-xs text-[#7480aa]">Created {formatDate(profile.createdAt)}</span>
              </div>
              <h2 className="mt-3 text-2xl font-semibold text-white">{profile.nameTh}</h2>
              <p className="mt-1 text-sm text-[#aab4da]">{profile.nameEn}</p>
            </div>

            <div className="grid shrink-0 gap-1 rounded-md border border-[#27345b] bg-[#0a1128] p-4 text-right">
              <p className="text-xs font-semibold text-[#8390bd]">Declared rank</p>
              <p className="text-2xl font-semibold text-[#8c91ff]">{profile.rank}</p>
              <p className="text-xs text-[#7480aa]">power {profile.powerLevel}</p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 text-sm leading-6 text-[#aab4da] md:grid-cols-2">
            <InfoLine
              icon={<Mail className="h-4 w-4" aria-hidden />}
              label="Account"
              value={profile.account?.email ?? "Unknown account"}
            />
            <InfoLine
              icon={<UserRound className="h-4 w-4" aria-hidden />}
              label="Phone"
              value={profile.account?.phone ?? "-"}
            />
            <InfoLine
              icon={<School className="h-4 w-4" aria-hidden />}
              label="Institute"
              value={profile.instituteName ?? "-"}
            />
            <InfoLine
              icon={<Medal className="h-4 w-4" aria-hidden />}
              label="Status"
              value={profile.rankStatus}
            />
          </div>
        </div>

        <aside className="grid content-start gap-3 rounded-lg border border-[#27345b] bg-[#0a1128] p-4">
          <div>
            <p className="text-sm font-semibold text-white">Review</p>
            <p className="mt-1 text-xs leading-5 text-[#8390bd]">
              {profile.rank} currently maps to power {profile.powerLevel}.
            </p>
          </div>
          <RankApprovalControls currentRank={profile.rank} playerProfileId={profile.id} />
        </aside>
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
      <span className="min-w-0">
        <span className="font-semibold text-[#dce3ff]">{label}: </span>
        <span className="break-words">{value}</span>
      </span>
    </p>
  );
}

function Metric({
  compact,
  label,
  value,
}: {
  compact?: boolean;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-[#202a49] bg-[#101832] px-4 py-3">
      <p className="text-xs font-semibold text-[#8390bd]">{label}</p>
      <p className={`${compact ? "text-base" : "text-2xl"} mt-1 font-semibold text-white`}>{value}</p>
    </div>
  );
}

function StatusBadge() {
  return (
    <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#443013] px-2.5 py-1 text-xs font-semibold text-[#ffc66d]">
      <Clock className="h-3.5 w-3.5" aria-hidden />
      pending
    </span>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(new Date(value));
}

function shortId(value: string) {
  return value.slice(0, 8);
}

function isSupabaseErrorCode(error: unknown, code: string) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === code
  );
}
