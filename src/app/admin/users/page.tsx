import type { ReactNode } from "react";
import Link from "next/link";
import {
  Link2,
  Mail,
  Medal,
  Phone,
  School,
  Search,
  ShieldCheck,
  UserCog,
  UserRound,
  UsersRound,
} from "lucide-react";
import {
  getAdminUsers,
  type AdminCoachLinkCounts,
  type AdminUserListRow,
  type AdminUserRole,
  type AdminUserRoleStatus,
  type AdminUserRequestStatus,
} from "@/lib/admin/users";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

const roleOptions = ["all", "player", "coach", "referee", "admin"] as const;
const roleOptionSet = new Set<string>(roleOptions);

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const result = await getUsersPageState(params);
  const users = result.users;

  return (
    <div className="flex w-full flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#58d8ff]">User Management</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-white">
            Accounts and roles
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#8390bd]">
            Read-only Admin view of real accounts, player profiles, roles, role requests, and Coach Link
            status summaries. Identity document hashes are intentionally not selected or rendered.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[560px]">
          <Metric
            label="Shown users"
            value={users.length.toLocaleString("en-US")}
            icon={<UsersRound className="h-4 w-4" aria-hidden />}
          />
          <Metric
            label="Profiles"
            value={users.filter((user) => user.profile).length.toLocaleString("en-US")}
            icon={<UserRound className="h-4 w-4" aria-hidden />}
          />
          <Metric
            label="Active coaches"
            value={users.filter((user) => hasActiveRole(user, "coach")).length.toLocaleString("en-US")}
            icon={<ShieldCheck className="h-4 w-4" aria-hidden />}
          />
        </div>
      </header>

      {result.error ? (
        <MigrationPending message={result.error} />
      ) : (
        <>
          <UserFilters result={result} />

          {users.length > 0 ? (
            <UserTable users={users} />
          ) : (
            <NoUsersEmptyState query={result.query} role={result.role} />
          )}
        </>
      )}
    </div>
  );
}

async function getUsersPageState(params: SearchParams) {
  const query = getSingleParam(params.q)?.trim() ?? "";
  const role = getRoleParam(params.role);
  const limit = getLimitParam(params.limit);

  try {
    return {
      error: null,
      ...(await getAdminUsers({ limit, query, role })),
    };
  } catch (error) {
    if (
      isSupabaseErrorCode(error, "PGRST205") ||
      isSupabaseErrorCode(error, "42703") ||
      isSupabaseErrorCode(error, "42883")
    ) {
      return {
        error: error instanceof Error ? error.message : "Remote Supabase cannot read users yet.",
        limit,
        query,
        role,
        users: [],
      };
    }

    throw error;
  }
}

function UserFilters({ result }: { result: Awaited<ReturnType<typeof getUsersPageState>> }) {
  return (
    <section className="rounded-lg border border-[#202a49] bg-[#101832] p-5">
      <form action="/admin/users" className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_200px_130px_auto_auto] lg:items-end">
        <div>
          <label htmlFor="q" className="text-sm font-semibold text-[#dce3ff]">
            Search
          </label>
          <div className="mt-2 flex min-h-11 items-center gap-2 rounded-md border border-[#27345b] bg-[#0a1128] px-3 py-2 text-sm text-white transition duration-200 focus-within:border-[#58d8ff] focus-within:ring-2 focus-within:ring-[#58d8ff]/35">
            <Search className="h-4 w-4 shrink-0 text-[#58d8ff]" aria-hidden />
            <input
              id="q"
              name="q"
              defaultValue={result.query}
              placeholder="Email, phone, name, rank, institute, or UUID"
              className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-[#7480aa]"
            />
          </div>
        </div>

        <div>
          <label htmlFor="role" className="text-sm font-semibold text-[#dce3ff]">
            Role
          </label>
          <select
            id="role"
            name="role"
            defaultValue={result.role}
            className="mt-2 min-h-11 w-full rounded-md border border-[#27345b] bg-[#0a1128] px-3 py-2 text-sm text-white outline-none transition duration-200 focus-visible:border-[#58d8ff] focus-visible:ring-2 focus-visible:ring-[#58d8ff]/35"
          >
            {roleOptions.map((role) => (
              <option key={role} value={role}>
                {role === "all" ? "All roles" : role}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="limit" className="text-sm font-semibold text-[#dce3ff]">
            Limit
          </label>
          <select
            id="limit"
            name="limit"
            defaultValue={String(result.limit)}
            className="mt-2 min-h-11 w-full rounded-md border border-[#27345b] bg-[#0a1128] px-3 py-2 text-sm text-white outline-none transition duration-200 focus-visible:border-[#58d8ff] focus-visible:ring-2 focus-visible:ring-[#58d8ff]/35"
          >
            {[25, 50, 100].map((limit) => (
              <option key={limit} value={limit}>
                {limit}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md bg-[#0d4b66] px-4 py-2 text-sm font-semibold text-white transition duration-200 hover:bg-[#116184] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58d8ff]/60"
        >
          <Search className="h-4 w-4" aria-hidden />
          Search
        </button>

        <Link
          href="/admin/users"
          className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-md border border-[#27345b] px-4 py-2 text-sm font-semibold text-[#dce3ff] transition duration-200 hover:border-[#58d8ff] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58d8ff]/50"
        >
          Reset
        </Link>
      </form>

      <div className="mt-4 grid gap-2 text-sm text-[#aab4da] md:grid-cols-3">
        <InfoLine label="Query" value={result.query || "none"} />
        <InfoLine label="Role scope" value={result.role === "all" ? "All roles" : result.role} />
        <InfoLine label="Result limit" value={result.limit.toLocaleString("en-US")} />
      </div>
    </section>
  );
}

function UserTable({ users }: { users: AdminUserListRow[] }) {
  return (
    <section data-testid="admin-user-table" className="overflow-hidden rounded-lg border border-[#202a49] bg-[#101832]">
      <div className="flex items-center justify-between gap-3 border-b border-[#202a49] px-5 py-4">
        <div>
          <h2 className="text-lg font-semibold text-white">User rows</h2>
          <p className="mt-1 text-sm text-[#8390bd]">
            Contact, profile, role, and Coach Link context for staff review.
          </p>
        </div>
        <span className="rounded-full bg-[#0a3448] px-3 py-1 text-xs font-semibold text-[#58d8ff]">
          read-only
        </span>
      </div>

      <div className="overflow-x-auto">
        <div className="grid min-w-[1260px] grid-cols-[minmax(260px,1.2fr)_minmax(260px,1.3fr)_minmax(220px,1fr)_minmax(190px,0.9fr)_minmax(170px,0.8fr)_160px] bg-[#0a1128] px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#7480aa]">
          <span>Account</span>
          <span>Player profile</span>
          <span>Roles</span>
          <span>Coach links</span>
          <span>Requests</span>
          <span>Created</span>
        </div>
        <div className="divide-y divide-[#202a49]">
          {users.map((user) => (
            <div
              key={user.id}
              data-testid="admin-user-row"
              data-user-email={user.email}
              data-active-role={user.activeRole}
              data-role-list={user.roles.map((role) => `${role.role}:${role.status}`).join(",")}
              className="grid min-w-[1260px] grid-cols-[minmax(260px,1.2fr)_minmax(260px,1.3fr)_minmax(220px,1fr)_minmax(190px,0.9fr)_minmax(170px,0.8fr)_160px] gap-4 px-4 py-4 text-sm text-[#dce3ff] transition duration-200 hover:bg-[#111a35]"
            >
              <AccountCell user={user} />
              <ProfileCell user={user} />
              <RolesCell user={user} />
              <CoachLinksCell user={user} />
              <RoleRequestsCell user={user} />
              <div className="text-[#aab4da]">
                <p>{formatDate(user.createdAt)}</p>
                <p className="mt-1 text-xs text-[#7480aa]">
                  Login {user.lastLoginAt ? formatDate(user.lastLoginAt) : "-"}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function AccountCell({ user }: { user: AdminUserListRow }) {
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill status={user.isActive ? "active" : "inactive"} tone={user.isActive ? "green" : "red"} />
        <StatusPill status={`active role: ${user.activeRole}`} tone="blue" />
      </div>
      <InfoRow icon={<Mail className="h-4 w-4" aria-hidden />} value={user.email} strong />
      <InfoRow icon={<Phone className="h-4 w-4" aria-hidden />} value={user.phone || "-"} />
      <p className="mt-2 text-xs text-[#7480aa]">Account {shortId(user.id)}</p>
    </div>
  );
}

function ProfileCell({ user }: { user: AdminUserListRow }) {
  if (!user.profile) {
    return (
      <div className="grid min-h-20 place-items-center rounded-md border border-dashed border-[#27345b] px-3 py-2 text-center text-xs text-[#7480aa]">
        No player profile
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <p className="truncate font-semibold text-white">{user.profile.nameTh || "-"}</p>
      <p className="mt-1 truncate text-xs text-[#aab4da]">{user.profile.nameEn || "-"}</p>
      <div className="mt-2 grid gap-1 text-xs text-[#8390bd]">
        <InfoRow icon={<Medal className="h-4 w-4" aria-hidden />} value={`${user.profile.rank} / power ${user.profile.powerLevel}`} />
        <InfoRow icon={<School className="h-4 w-4" aria-hidden />} value={user.profile.instituteName ?? "-"} />
      </div>
      <div className="mt-2">
        <StatusPill
          status={user.profile.rankStatus}
          tone={user.profile.rankStatus === "verified" ? "green" : "amber"}
        />
      </div>
    </div>
  );
}

function RolesCell({ user }: { user: AdminUserListRow }) {
  if (user.roles.length === 0) {
    return <p className="text-xs text-[#7480aa]">No roles</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {user.roles.map((role) => (
        <RoleBadge key={`${role.role}-${role.status}`} role={role.role} status={role.status} />
      ))}
    </div>
  );
}

function CoachLinksCell({ user }: { user: AdminUserListRow }) {
  return (
    <div className="grid gap-2 text-xs text-[#aab4da]">
      <CoachLinkLine label="As coach" counts={user.coachLinks.asCoach} />
      <CoachLinkLine label="As player" counts={user.coachLinks.asPlayer} />
    </div>
  );
}

function RoleRequestsCell({ user }: { user: AdminUserListRow }) {
  if (user.pendingRoleRequests.length === 0) {
    return <p className="text-xs text-[#7480aa]">No requests</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {user.pendingRoleRequests.map((request) => (
        <RequestBadge key={`${request.requestedRole}-${request.status}`} status={request.status} />
      ))}
    </div>
  );
}

function CoachLinkLine({
  counts,
  label,
}: {
  counts: AdminCoachLinkCounts;
  label: string;
}) {
  return (
    <div className="rounded-md border border-[#27345b] bg-[#0a1128] px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 font-semibold text-[#dce3ff]">
          <Link2 className="h-3.5 w-3.5 text-[#58d8ff]" aria-hidden />
          {label}
        </span>
        <span className="text-white">{counts.total}</span>
      </div>
      <p className="mt-1 text-[#7480aa]">
        {counts.approved} approved / {counts.pending} pending
      </p>
    </div>
  );
}

function InfoRow({
  icon,
  strong,
  value,
}: {
  icon: ReactNode;
  strong?: boolean;
  value: string;
}) {
  return (
    <p className="mt-2 flex min-w-0 items-start gap-2">
      <span className="mt-0.5 shrink-0 text-[#58d8ff]">{icon}</span>
      <span className={`${strong ? "font-semibold text-white" : "text-[#aab4da]"} min-w-0 break-words`}>
        {value}
      </span>
    </p>
  );
}

function RoleBadge({
  role,
  status,
}: {
  role: AdminUserRole;
  status: AdminUserRoleStatus;
}) {
  const tone = status === "active" ? "green" : status === "suspended" ? "amber" : "red";

  return <StatusPill status={`${role}:${status}`} tone={tone} />;
}

function RequestBadge({ status }: { status: AdminUserRequestStatus }) {
  const tone = status === "pending" ? "amber" : status === "approved" ? "green" : "red";

  return <StatusPill status={`coach:${status}`} tone={tone} />;
}

function StatusPill({
  status,
  tone,
}: {
  status: string;
  tone: "amber" | "blue" | "green" | "red";
}) {
  const className = {
    amber: "bg-[#443013] text-[#ffc66d]",
    blue: "bg-[#20255d] text-[#8c91ff]",
    green: "bg-[#073d36] text-[#42e0b3]",
    red: "bg-[#4a1724] text-[#ffb0bd]",
  }[tone];

  return <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}>{status}</span>;
}

function MigrationPending({ message }: { message: string }) {
  return (
    <section className="rounded-lg border border-[#443013] bg-[#1c160b] p-6">
      <p className="text-sm font-semibold text-[#ffc66d]">User management unavailable</p>
      <h2 className="mt-2 text-xl font-semibold text-white">Account/profile/role data is not ready</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-[#d8c39a]">
        {message} Apply pending Supabase migrations, then reload this page.
      </p>
    </section>
  );
}

function NoUsersEmptyState({
  query,
  role,
}: {
  query: string;
  role: AdminUserRole | "all";
}) {
  return (
    <section className="rounded-lg border border-dashed border-[#27345b] bg-[#101832] p-8 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#0a3448] text-[#58d8ff]">
        <UserCog className="h-6 w-6" aria-hidden />
      </div>
      <h2 className="mt-4 text-xl font-semibold text-white">No users for this view</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#8390bd]">
        Current scope: {query ? `search "${query}"` : "no search"} and {role === "all" ? "all roles" : role}.
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

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <p className="min-w-0">
      <span className="font-semibold text-[#dce3ff]">{label}: </span>
      <span className="break-words">{value}</span>
    </p>
  );
}

function getSingleParam(raw: string | string[] | undefined) {
  return Array.isArray(raw) ? raw[0] : raw;
}

function getRoleParam(raw: string | string[] | undefined): AdminUserRole | "all" {
  const value = getSingleParam(raw) ?? "all";
  return roleOptionSet.has(value) ? (value as AdminUserRole | "all") : "all";
}

function getLimitParam(raw: string | string[] | undefined) {
  const parsed = Number(getSingleParam(raw) ?? 50);

  if ([25, 50, 100].includes(parsed)) {
    return parsed;
  }

  return 50;
}

function hasActiveRole(user: AdminUserListRow, role: AdminUserRole) {
  return user.roles.some((item) => item.role === role && item.status === "active");
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
