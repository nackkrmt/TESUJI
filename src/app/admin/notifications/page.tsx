import type { ReactNode } from "react";
import {
  BellRing,
  Link2,
  Send,
  UsersRound,
} from "lucide-react";
import {
  getManualNotificationAdminState,
  type AdminManualNotificationSummary,
} from "@/lib/admin/notifications";
import { ManualNotificationForm } from "./manual-notification-form";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function AdminNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const result = await getNotificationsPageState(params);

  return (
    <div className="flex w-full flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#58d8ff]">Manual Notifications</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-white">
            Send account notifications
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#8390bd]">
            Compose Admin-authored messages on the real S6.7 notification service. Sends are manual
            only and recipient rows are created by the database transaction.
          </p>
        </div>

        {!result.error ? (
          <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[560px]">
            <Metric
              label="Accounts"
              value={result.state.allAccountCount.toLocaleString("en-US")}
              icon={<UsersRound className="h-4 w-4" aria-hidden />}
            />
            <Metric
              label="Tournaments"
              value={result.state.tournaments.length.toLocaleString("en-US")}
              icon={<BellRing className="h-4 w-4" aria-hidden />}
            />
            <Metric
              label="Recent sends"
              value={result.state.recentNotifications.length.toLocaleString("en-US")}
              icon={<Send className="h-4 w-4" aria-hidden />}
            />
          </div>
        ) : null}
      </header>

      {result.error ? (
        <MigrationPending message={result.error} />
      ) : (
        <>
          <ManualNotificationForm
            accountOptions={result.state.accountOptions}
            accountQuery={result.state.accountQuery}
            allAccountCount={result.state.allAccountCount}
            tournaments={result.state.tournaments}
          />

          <RecentNotifications notifications={result.state.recentNotifications} />
        </>
      )}
    </div>
  );
}

async function getNotificationsPageState(params: SearchParams) {
  const accountQuery = getSingleParam(params.accountQ)?.trim() ?? "";

  try {
    return {
      error: null,
      state: await getManualNotificationAdminState({ accountQuery }),
    };
  } catch (error) {
    if (
      isSupabaseErrorCode(error, "PGRST205") ||
      isSupabaseErrorCode(error, "42703") ||
      isSupabaseErrorCode(error, "42883")
    ) {
      return {
        error: error instanceof Error ? error.message : "Notification tables or RPC are not ready.",
        state: {
          accountOptions: [],
          accountQuery,
          allAccountCount: 0,
          recentNotifications: [],
          tournaments: [],
        },
      };
    }

    throw error;
  }
}

function RecentNotifications({
  notifications,
}: {
  notifications: AdminManualNotificationSummary[];
}) {
  if (notifications.length === 0) {
    return (
      <section className="rounded-lg border border-dashed border-[#27345b] bg-[#101832] p-8 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#0a3448] text-[#58d8ff]">
          <BellRing className="h-6 w-6" aria-hidden />
        </div>
        <h2 className="mt-4 text-xl font-semibold text-white">No manual notifications yet</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#8390bd]">
          Once Admin sends a notification, recent sends and read totals appear here.
        </p>
      </section>
    );
  }

  return (
    <section
      data-testid="manual-notification-recent"
      className="overflow-hidden rounded-lg border border-[#202a49] bg-[#101832]"
    >
      <div className="flex items-center justify-between gap-3 border-b border-[#202a49] px-5 py-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Recent sends</h2>
          <p className="mt-1 text-sm text-[#8390bd]">
            Delivery and read counts from manual notification recipient rows.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="grid min-w-[980px] grid-cols-[minmax(260px,1.5fr)_180px_150px_150px_180px] bg-[#0a1128] px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#7480aa]">
          <span>Notification</span>
          <span>Audience</span>
          <span>Recipients</span>
          <span>Read</span>
          <span>Created</span>
        </div>
        <div className="divide-y divide-[#202a49]">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              data-testid="manual-notification-row"
              className="grid min-w-[980px] grid-cols-[minmax(260px,1.5fr)_180px_150px_150px_180px] gap-4 px-4 py-4 text-sm text-[#dce3ff] transition duration-200 hover:bg-[#111a35]"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold text-white">{notification.title}</p>
                <p className="mt-1 text-xs text-[#7480aa]">ID {shortId(notification.id)}</p>
                {notification.linkUrl ? (
                  <p className="mt-2 flex min-w-0 items-center gap-2 text-xs text-[#aab4da]">
                    <Link2 className="h-3.5 w-3.5 shrink-0 text-[#58d8ff]" aria-hidden />
                    <span className="truncate">{notification.linkUrl}</span>
                  </p>
                ) : null}
              </div>
              <div>
                <StatusPill label={formatAudience(notification)} tone="blue" />
                {notification.tournamentTitle ? (
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#8390bd]">
                    {notification.tournamentTitle}
                  </p>
                ) : null}
              </div>
              <p className="font-semibold text-white">
                {notification.recipientCount.toLocaleString("en-US")}
              </p>
              <div>
                <p className="font-semibold text-white">
                  {notification.readCount.toLocaleString("en-US")}
                </p>
                <p className="mt-1 text-xs text-[#7480aa]">
                  {notification.unreadCount.toLocaleString("en-US")} unread
                </p>
              </div>
              <p className="text-[#aab4da]">{formatDate(notification.createdAt)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function MigrationPending({ message }: { message: string }) {
  return (
    <section className="rounded-lg border border-[#443013] bg-[#1c160b] p-6">
      <p className="text-sm font-semibold text-[#ffc66d]">Notifications unavailable</p>
      <h2 className="mt-2 text-xl font-semibold text-white">
        Manual notification tables or RPC are not ready
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-[#d8c39a]">
        {message} Apply pending Supabase migrations, then reload this page.
      </p>
    </section>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-[#202a49] bg-[#101832] px-4 py-3">
      <div className="flex items-center gap-2 text-[#58d8ff]">
        {icon}
        <p className="text-xs font-semibold text-[#8390bd]">{label}</p>
      </div>
      <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: "blue" | "green";
}) {
  const className = {
    blue: "bg-[#20255d] text-[#8c91ff]",
    green: "bg-[#073d36] text-[#42e0b3]",
  }[tone];

  return <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}>{label}</span>;
}

function formatAudience(notification: AdminManualNotificationSummary) {
  if (notification.audienceType === "all_accounts") {
    return "All accounts";
  }

  if (notification.audienceType === "tournament_registrants") {
    return "Tournament";
  }

  return "Selected";
}

function getSingleParam(raw: string | string[] | undefined) {
  return Array.isArray(raw) ? raw[0] : raw;
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
