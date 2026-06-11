import type { ReactNode } from "react";
import Link from "next/link";
import {
  CalendarDays,
  Download,
  ExternalLink,
  Filter,
  Layers,
  ListFilter,
  Trophy,
  UsersRound,
} from "lucide-react";
import {
  getAdminRegistrationList,
  type AdminRegistrationListRow,
  type AdminRegistrationStatus,
} from "@/lib/admin/registrations";
import {
  getAdminTournamentDetail,
  getAdminTournaments,
  type DivisionRecord,
  type TournamentDetail,
  type TournamentRecord,
} from "@/lib/tournaments/admin";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

const registrationStatuses = [
  "pending_payment",
  "pending_verify",
  "confirmed",
  "waiting_list",
  "cancelled",
  "expired",
  "rejected",
] as const satisfies AdminRegistrationStatus[];

const registrationStatusSet = new Set<AdminRegistrationStatus>(registrationStatuses);

export default async function AdminRegistrationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const result = await getRegistrationsPageState(params);

  return (
    <div className="flex w-full flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#48b8ff]">Registration Lists</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-white">
            Tournament registrations
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#8390bd]">
            Review real registration rows by tournament, division, and status. CSV exports use the
            same staff-safe S6.4 service and exclude identity hashes and private slip fields.
          </p>
        </div>

        {result.selectedTournament ? (
          <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[560px]">
            <Metric
              label="Shown rows"
              value={result.registrations.length.toLocaleString("en-US")}
              icon={<UsersRound className="h-4 w-4" aria-hidden />}
            />
            <Metric
              label="Divisions"
              value={result.divisions.length.toLocaleString("en-US")}
              icon={<Layers className="h-4 w-4" aria-hidden />}
            />
            <Metric
              compact
              label="Event"
              value={formatEventDate(result.selectedTournament)}
              icon={<CalendarDays className="h-4 w-4" aria-hidden />}
            />
          </div>
        ) : null}
      </header>

      {result.error ? (
        <MigrationPending message={result.error} />
      ) : result.tournaments.length === 0 ? (
        <NoTournamentsEmptyState />
      ) : result.selectedTournament ? (
        <>
          <Toolbar
            divisions={result.divisions}
            selectedDivisionId={result.selectedDivisionId}
            selectedStatuses={result.selectedStatuses}
            selectedTournament={result.selectedTournament}
            tournaments={result.tournaments}
          />

          {result.divisions.length === 0 ? (
            <NoDivisionsEmptyState tournament={result.selectedTournament} />
          ) : (
            <>
              <FilterPanel
                divisions={result.divisions}
                registrations={result.registrations}
                selectedDivisionId={result.selectedDivisionId}
                selectedStatuses={result.selectedStatuses}
                selectedTournamentId={result.selectedTournament.id}
              />

              {result.registrations.length > 0 ? (
                <RegistrationTable registrations={result.registrations} />
              ) : (
                <NoRegistrationsEmptyState
                  selectedDivisionId={result.selectedDivisionId}
                  selectedStatuses={result.selectedStatuses}
                />
              )}
            </>
          )}
        </>
      ) : null}
    </div>
  );
}

async function getRegistrationsPageState(params: SearchParams) {
  try {
    const tournaments = await getAdminTournaments();
    const requestedTournamentId = getSingleParam(params.tournamentId);
    const selectedTournamentSummary =
      tournaments.find((tournament) => tournament.id === requestedTournamentId) ?? tournaments[0] ?? null;

    if (!selectedTournamentSummary) {
      return {
        divisions: [],
        error: null,
        registrations: [],
        selectedDivisionId: null,
        selectedStatuses: [],
        selectedTournament: null,
        tournaments,
      };
    }

    const selectedTournament = await getAdminTournamentDetail(selectedTournamentSummary.id);

    if (!selectedTournament) {
      return {
        divisions: [],
        error: "Selected tournament was not found.",
        registrations: [],
        selectedDivisionId: null,
        selectedStatuses: [],
        selectedTournament: null,
        tournaments,
      };
    }

    const requestedDivisionId = getSingleParam(params.divisionId);
    const selectedDivisionId =
      requestedDivisionId && selectedTournament.divisions.some((division) => division.id === requestedDivisionId)
        ? requestedDivisionId
        : null;
    const selectedStatuses = getSelectedStatuses(params.status);
    const list = await getAdminRegistrationList({
      divisionId: selectedDivisionId,
      statuses: selectedStatuses.length > 0 ? selectedStatuses : undefined,
      tournamentId: selectedTournament.id,
    });

    return {
      divisions: selectedTournament.divisions,
      error: null,
      registrations: list.registrations,
      selectedDivisionId,
      selectedStatuses,
      selectedTournament,
      tournaments,
    };
  } catch (error) {
    if (
      isSupabaseErrorCode(error, "PGRST205") ||
      isSupabaseErrorCode(error, "42703") ||
      isSupabaseErrorCode(error, "42883")
    ) {
      return {
        divisions: [],
        error: error instanceof Error ? error.message : "Remote Supabase cannot read registrations yet.",
        registrations: [],
        selectedDivisionId: null,
        selectedStatuses: [],
        selectedTournament: null,
        tournaments: [],
      };
    }

    throw error;
  }
}

function Toolbar({
  divisions,
  selectedDivisionId,
  selectedStatuses,
  selectedTournament,
  tournaments,
}: {
  divisions: DivisionRecord[];
  selectedDivisionId: string | null;
  selectedStatuses: AdminRegistrationStatus[];
  selectedTournament: TournamentDetail;
  tournaments: TournamentRecord[];
}) {
  const exportHref = buildRegistrationExportHref({
    divisionId: selectedDivisionId,
    statuses: selectedStatuses,
    tournamentId: selectedTournament.id,
  });

  return (
    <section className="rounded-lg border border-[#202a49] bg-[#101832] p-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
        <form action="/admin/registrations" className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
          <div>
            <label htmlFor="tournamentId" className="text-sm font-semibold text-[#dce3ff]">
              Tournament
            </label>
            <select
              id="tournamentId"
              name="tournamentId"
              defaultValue={selectedTournament.id}
              className="mt-2 min-h-11 w-full rounded-md border border-[#27345b] bg-[#0a1128] px-3 py-2 text-sm text-white outline-none transition duration-200 focus-visible:border-[#48b8ff] focus-visible:ring-2 focus-visible:ring-[#48b8ff]/40"
            >
              {tournaments.map((tournament) => (
                <option key={tournament.id} value={tournament.id}>
                  {tournament.title}
                </option>
              ))}
            </select>
            {selectedStatuses.map((status) => (
              <input key={status} type="hidden" name="status" value={status} />
            ))}
          </div>
          <button
            type="submit"
            className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md bg-[#6c72ff] px-4 py-2 text-sm font-semibold text-white transition duration-200 hover:bg-[#7c82ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8c91ff]/70 md:self-end"
          >
            <ListFilter className="h-4 w-4" aria-hidden />
            Open list
          </button>
        </form>

        <div className="flex flex-wrap gap-2 xl:justify-end">
          <Link
            href={`/admin/tournaments/${selectedTournament.id}`}
            className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md border border-[#27345b] px-4 py-2 text-sm font-semibold text-[#dce3ff] transition duration-200 hover:border-[#48b8ff] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#48b8ff]/50"
          >
            Manage tournament
            <ExternalLink className="h-4 w-4" aria-hidden />
          </Link>
          <Link
            href={exportHref}
            data-testid="registration-export-link"
            className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md bg-[#0d4b66] px-4 py-2 text-sm font-semibold text-white transition duration-200 hover:bg-[#116184] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#48b8ff]/60"
          >
            <Download className="h-4 w-4" aria-hidden />
            Download CSV
          </Link>
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-sm text-[#aab4da] lg:grid-cols-3">
        <InfoLine label="Selected" value={selectedTournament.title} />
        <InfoLine label="Division scope" value={getDivisionScopeLabel(divisions, selectedDivisionId)} />
        <InfoLine label="Status scope" value={getStatusScopeLabel(selectedStatuses)} />
      </div>
    </section>
  );
}

function FilterPanel({
  divisions,
  registrations,
  selectedDivisionId,
  selectedStatuses,
  selectedTournamentId,
}: {
  divisions: DivisionRecord[];
  registrations: AdminRegistrationListRow[];
  selectedDivisionId: string | null;
  selectedStatuses: AdminRegistrationStatus[];
  selectedTournamentId: string;
}) {
  const statusCounts = getStatusCounts(registrations);

  return (
    <section className="grid gap-4 rounded-lg border border-[#202a49] bg-[#101832] p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-[#48b8ff]" aria-hidden />
        <h2 className="text-lg font-semibold text-white">Filters</h2>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#7480aa]">Division</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <FilterLink
            active={!selectedDivisionId}
            href={buildRegistrationsHref({
              statuses: selectedStatuses,
              tournamentId: selectedTournamentId,
            })}
            label="All divisions"
          />
          {divisions.map((division) => (
            <FilterLink
              key={division.id}
              active={selectedDivisionId === division.id}
              href={buildRegistrationsHref({
                divisionId: division.id,
                statuses: selectedStatuses,
                tournamentId: selectedTournamentId,
              })}
              label={division.name}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#7480aa]">Status</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <FilterLink
            active={selectedStatuses.length === 0}
            href={buildRegistrationsHref({
              divisionId: selectedDivisionId,
              tournamentId: selectedTournamentId,
            })}
            label="All statuses"
          />
          {registrationStatuses.map((status) => (
            <FilterLink
              key={status}
              active={selectedStatuses.length === 1 && selectedStatuses[0] === status}
              href={buildRegistrationsHref({
                divisionId: selectedDivisionId,
                statuses: [status],
                tournamentId: selectedTournamentId,
              })}
              label={`${status} (${statusCounts.get(status) ?? 0})`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function RegistrationTable({ registrations }: { registrations: AdminRegistrationListRow[] }) {
  return (
    <section data-testid="registration-table" className="overflow-hidden rounded-lg border border-[#202a49] bg-[#101832]">
      <div className="flex items-center justify-between gap-3 border-b border-[#202a49] px-5 py-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Registration rows</h2>
          <p className="mt-1 text-sm text-[#8390bd]">
            Staff-safe view for tournament operations and check-in preparation.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="grid min-w-[1120px] grid-cols-[72px_minmax(220px,1.6fr)_minmax(150px,1fr)_150px_110px_minmax(220px,1.2fr)_120px_170px] bg-[#0a1128] px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#7480aa]">
          <span>No.</span>
          <span>Player</span>
          <span>Division</span>
          <span>Status</span>
          <span>Source</span>
          <span>Registered by</span>
          <span>Rank</span>
          <span>Registered at</span>
        </div>
        <div className="divide-y divide-[#202a49]">
          {registrations.map((registration) => (
            <div
              key={registration.id}
              data-testid="registration-row"
              data-registration-status={registration.status}
              data-registration-source={registration.source}
              data-division-name={registration.divisionName}
              className="grid min-w-[1120px] grid-cols-[72px_minmax(220px,1.6fr)_minmax(150px,1fr)_150px_110px_minmax(220px,1.2fr)_120px_170px] gap-3 px-4 py-4 text-sm text-[#dce3ff] transition duration-200 hover:bg-[#111a35]"
            >
              <span className="font-semibold text-[#8390bd]">{registration.orderNumber}</span>
              <div className="min-w-0">
                <p className="truncate font-semibold text-white">{registration.player.nameTh || "-"}</p>
                <p className="mt-1 truncate text-xs text-[#aab4da]">{registration.player.nameEn || "-"}</p>
                <p className="mt-1 truncate text-xs text-[#7480aa]">
                  {registration.player.instituteName ?? "No institute"}
                </p>
              </div>
              <p className="min-w-0 truncate text-[#aab4da]">{registration.divisionName}</p>
              <RegistrationStatusBadge registration={registration} />
              <p className="text-[#aab4da]">{getSourceLabel(registration.source)}</p>
              <div className="min-w-0">
                <p className="truncate font-semibold text-white">{registration.registeredBy.email || "-"}</p>
                <p className="mt-1 truncate text-xs text-[#8390bd]">
                  {registration.registeredBy.nameTh ?? registration.registeredBy.nameEn ?? "No profile name"}
                </p>
                <p className="mt-1 text-xs text-[#7480aa]">{registration.registeredBy.sourceRole}</p>
              </div>
              <div>
                <p className="font-semibold text-white">{registration.player.rank || "-"}</p>
                <p className="mt-1 text-xs text-[#8390bd]">power {registration.player.powerLevel}</p>
              </div>
              <p className="text-[#aab4da]">{formatDate(registration.registeredAt)}</p>
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
      <p className="text-sm font-semibold text-[#ffc66d]">Registration list unavailable</p>
      <h2 className="mt-2 text-xl font-semibold text-white">Registration tables or service fields are not ready</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-[#d8c39a]">
        {message} Apply pending Supabase migrations, then reload this page.
      </p>
    </section>
  );
}

function NoTournamentsEmptyState() {
  return (
    <section className="rounded-lg border border-dashed border-[#27345b] bg-[#101832] p-8 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#17244d] text-[#8c91ff]">
        <Trophy className="h-6 w-6" aria-hidden />
      </div>
      <h2 className="mt-4 text-xl font-semibold text-white">No tournaments yet</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#8390bd]">
        Create a tournament and divisions first. Registration lists appear here as soon as real
        registration rows exist.
      </p>
      <Link
        href="/admin/tournaments/new"
        className="mt-5 inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md bg-[#6c72ff] px-4 py-2 text-sm font-semibold text-white transition duration-200 hover:bg-[#7c82ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8c91ff]/70"
      >
        New tournament
        <ExternalLink className="h-4 w-4" aria-hidden />
      </Link>
    </section>
  );
}

function NoDivisionsEmptyState({ tournament }: { tournament: TournamentDetail }) {
  return (
    <section className="rounded-lg border border-dashed border-[#27345b] bg-[#101832] p-8 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#17244d] text-[#48b8ff]">
        <Layers className="h-6 w-6" aria-hidden />
      </div>
      <h2 className="mt-4 text-xl font-semibold text-white">No divisions in this tournament</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#8390bd]">
        Add at least one division before registrations can be grouped or exported for staff.
      </p>
      <Link
        href={`/admin/tournaments/${tournament.id}`}
        className="mt-5 inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md border border-[#27345b] px-4 py-2 text-sm font-semibold text-[#dce3ff] transition duration-200 hover:border-[#48b8ff] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#48b8ff]/50"
      >
        Manage tournament
        <ExternalLink className="h-4 w-4" aria-hidden />
      </Link>
    </section>
  );
}

function NoRegistrationsEmptyState({
  selectedDivisionId,
  selectedStatuses,
}: {
  selectedDivisionId: string | null;
  selectedStatuses: AdminRegistrationStatus[];
}) {
  return (
    <section className="rounded-lg border border-dashed border-[#27345b] bg-[#101832] p-8 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#17244d] text-[#48b8ff]">
        <UsersRound className="h-6 w-6" aria-hidden />
      </div>
      <h2 className="mt-4 text-xl font-semibold text-white">No registrations for this view</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#8390bd]">
        Current scope: {selectedDivisionId ? "one division" : "all divisions"} and{" "}
        {selectedStatuses.length > 0 ? selectedStatuses.join(", ") : "all statuses"}.
      </p>
    </section>
  );
}

function FilterLink({
  active,
  href,
  label,
}: {
  active: boolean;
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex min-h-11 cursor-pointer items-center justify-center rounded-md px-3 py-2 text-sm font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#48b8ff]/50 ${
        active
          ? "bg-[#27335c] text-white shadow-[inset_0_-2px_0_#48b8ff]"
          : "border border-[#27345b] bg-[#0a1128] text-[#aab4da] hover:border-[#48b8ff] hover:text-white"
      }`}
    >
      {label}
    </Link>
  );
}

function RegistrationStatusBadge({ registration }: { registration: AdminRegistrationListRow }) {
  const className = getStatusClassName(registration.status);

  return (
    <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}>
      {registration.status}
      {registration.waitingListPosition ? ` #${registration.waitingListPosition}` : ""}
    </span>
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

function Metric({
  compact,
  icon,
  label,
  value,
}: {
  compact?: boolean;
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-[#202a49] bg-[#101832] px-4 py-3">
      <div className="flex items-center gap-2 text-[#48b8ff]">
        {icon}
        <p className="text-xs font-semibold text-[#8390bd]">{label}</p>
      </div>
      <p className={`${compact ? "text-base" : "text-2xl"} mt-1 font-semibold text-white`}>{value}</p>
    </div>
  );
}

function buildRegistrationsHref({
  divisionId,
  statuses,
  tournamentId,
}: {
  divisionId?: string | null;
  statuses?: AdminRegistrationStatus[];
  tournamentId: string;
}) {
  const params = new URLSearchParams({ tournamentId });

  if (divisionId) {
    params.set("divisionId", divisionId);
  }

  for (const status of statuses ?? []) {
    params.append("status", status);
  }

  return `/admin/registrations?${params.toString()}`;
}

function buildRegistrationExportHref({
  divisionId,
  statuses,
  tournamentId,
}: {
  divisionId?: string | null;
  statuses?: AdminRegistrationStatus[];
  tournamentId: string;
}) {
  const params = new URLSearchParams({ tournamentId });

  if (divisionId) {
    params.set("divisionId", divisionId);
  }

  for (const status of statuses ?? []) {
    params.append("status", status);
  }

  return `/admin/registrations/export.csv?${params.toString()}`;
}

function getSelectedStatuses(raw: string | string[] | undefined) {
  const values = Array.isArray(raw) ? raw : raw ? [raw] : [];

  return values
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(isRegistrationStatus);
}

function getSingleParam(raw: string | string[] | undefined) {
  return Array.isArray(raw) ? raw[0] : raw;
}

function isRegistrationStatus(value: string): value is AdminRegistrationStatus {
  return registrationStatusSet.has(value as AdminRegistrationStatus);
}

function getStatusCounts(registrations: AdminRegistrationListRow[]) {
  const counts = new Map<AdminRegistrationStatus, number>();

  for (const status of registrationStatuses) {
    counts.set(status, 0);
  }

  for (const registration of registrations) {
    counts.set(registration.status, (counts.get(registration.status) ?? 0) + 1);
  }

  return counts;
}

function getDivisionScopeLabel(divisions: DivisionRecord[], selectedDivisionId: string | null) {
  if (!selectedDivisionId) {
    return "All divisions";
  }

  return divisions.find((division) => division.id === selectedDivisionId)?.name ?? "Selected division";
}

function getStatusScopeLabel(statuses: AdminRegistrationStatus[]) {
  return statuses.length > 0 ? statuses.join(", ") : "All statuses";
}

function getSourceLabel(source: AdminRegistrationListRow["source"]) {
  if (source === "coach") {
    return "Coach";
  }

  if (source === "admin") {
    return "Admin";
  }

  return "Self";
}

function getStatusClassName(status: AdminRegistrationStatus) {
  if (status === "confirmed") {
    return "bg-[#073d36] text-[#42e0b3]";
  }

  if (status === "pending_verify") {
    return "bg-[#073d36] text-[#42e0b3]";
  }

  if (status === "pending_payment") {
    return "bg-[#443013] text-[#ffc66d]";
  }

  if (status === "waiting_list") {
    return "bg-[#20255d] text-[#8c91ff]";
  }

  if (status === "expired") {
    return "bg-[#27345b] text-[#aab4da]";
  }

  return "bg-[#4a1724] text-[#ffb0bd]";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(new Date(value));
}

function formatEventDate(tournament: TournamentRecord) {
  if (tournament.eventDate) {
    return new Intl.DateTimeFormat("th-TH", {
      dateStyle: "medium",
      timeZone: "Asia/Bangkok",
    }).format(new Date(`${tournament.eventDate}T00:00:00+07:00`));
  }

  if (tournament.eventStartsAt) {
    return formatDate(tournament.eventStartsAt);
  }

  return "-";
}

function isSupabaseErrorCode(error: unknown, code: string) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === code
  );
}
