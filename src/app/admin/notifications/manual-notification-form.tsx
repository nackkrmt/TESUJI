"use client";

import { useActionState, useMemo, useState } from "react";
import {
  BellRing,
  CheckCircle2,
  CircleAlert,
  Loader2,
  Search,
  Send,
  UsersRound,
} from "lucide-react";
import type {
  AdminNotificationAccountOption,
  AdminNotificationTournamentOption,
} from "@/lib/admin/notifications";
import {
  sendManualNotificationAction,
  type ManualNotificationActionState,
} from "./actions";

const initialState: ManualNotificationActionState = {
  message: "",
  status: "idle",
};

type AudienceType = "all_accounts" | "tournament_registrants" | "selected_accounts";

export function ManualNotificationForm({
  accountOptions,
  accountQuery,
  allAccountCount,
  tournaments,
}: {
  accountOptions: AdminNotificationAccountOption[];
  accountQuery: string;
  allAccountCount: number;
  tournaments: AdminNotificationTournamentOption[];
}) {
  const [state, formAction, isPending] = useActionState(sendManualNotificationAction, initialState);
  const [audienceType, setAudienceType] = useState<AudienceType>("all_accounts");
  const [selectedTournamentId, setSelectedTournamentId] = useState(tournaments[0]?.id ?? "");
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(new Set());
  const [pastedAccountIds, setPastedAccountIds] = useState("");
  const selectedTournament = tournaments.find((tournament) => tournament.id === selectedTournamentId);
  const selectedRecipientCount = useMemo(() => {
    if (audienceType === "all_accounts") {
      return allAccountCount;
    }

    if (audienceType === "tournament_registrants") {
      return selectedTournament?.recipientCount ?? 0;
    }

    return new Set([...selectedAccountIds, ...splitAccountIds(pastedAccountIds)]).size;
  }, [
    allAccountCount,
    audienceType,
    pastedAccountIds,
    selectedAccountIds,
    selectedTournament?.recipientCount,
  ]);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-lg border border-[#202a49] bg-[#101832] p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Compose notification</h2>
            <p className="mt-1 text-sm leading-6 text-[#8390bd]">
              Manual sends only. This does not create automatic workflow notifications.
            </p>
          </div>
          <div className="rounded-md border border-[#27345b] bg-[#0a1128] px-3 py-2 text-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#7480aa]">
              Preview recipients
            </p>
            <p className="mt-1 text-2xl font-semibold text-white">
              {selectedRecipientCount.toLocaleString("en-US")}
            </p>
          </div>
        </div>

        <form action={formAction} data-testid="manual-notification-form" className="mt-5 grid gap-5">
          <fieldset className="grid gap-3">
            <legend className="text-sm font-semibold text-[#dce3ff]">Recipient mode</legend>
            <div className="grid gap-3 md:grid-cols-3">
              <AudienceCard
                checked={audienceType === "all_accounts"}
                count={allAccountCount}
                description="Every account row currently in Supabase."
                label="All accounts"
                name="audienceType"
                value="all_accounts"
                onChange={setAudienceType}
              />
              <AudienceCard
                checked={audienceType === "tournament_registrants"}
                count={selectedTournament?.recipientCount ?? 0}
                description="Active tournament registrants plus registered-by accounts."
                label="Tournament"
                name="audienceType"
                value="tournament_registrants"
                onChange={setAudienceType}
              />
              <AudienceCard
                checked={audienceType === "selected_accounts"}
                count={new Set([...selectedAccountIds, ...splitAccountIds(pastedAccountIds)]).size}
                description="Checked search results and pasted account UUIDs."
                label="Selected"
                name="audienceType"
                value="selected_accounts"
                onChange={setAudienceType}
              />
            </div>
          </fieldset>

          <div className="grid gap-4 rounded-md border border-[#27345b] bg-[#0a1128] p-4">
            <label className="grid gap-2 text-sm font-semibold text-[#dce3ff]">
              Tournament recipient source
              <select
                name="tournamentId"
                value={selectedTournamentId}
                onChange={(event) => setSelectedTournamentId(event.target.value)}
                disabled={tournaments.length === 0}
                className="min-h-11 cursor-pointer rounded-md border border-[#27345b] bg-[#101832] px-3 py-2 text-sm text-white outline-none transition duration-200 focus:border-[#6c72ff] focus-visible:ring-2 focus-visible:ring-[#6c72ff]/60 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {tournaments.length > 0 ? (
                  tournaments.map((tournament) => (
                    <option key={tournament.id} value={tournament.id}>
                      {tournament.title} - {tournament.recipientCount.toLocaleString("en-US")} recipients
                    </option>
                  ))
                ) : (
                  <option value="">No tournaments yet</option>
                )}
              </select>
            </label>
            <p className="text-xs leading-5 text-[#8390bd]">
              This selector is used only when recipient mode is Tournament.
            </p>
          </div>

          <div className="grid gap-4 rounded-md border border-[#27345b] bg-[#0a1128] p-4">
            <div>
              <p className="text-sm font-semibold text-[#dce3ff]">Selected account IDs</p>
              <p className="mt-1 text-xs leading-5 text-[#8390bd]">
                Checked accounts and pasted UUIDs are combined and deduped before send.
              </p>
            </div>
            {accountOptions.length > 0 ? (
              <div className="grid gap-2">
                {accountOptions.map((account) => (
                  <label
                    key={account.id}
                    className="flex min-h-16 cursor-pointer items-start gap-3 rounded-md border border-[#27345b] bg-[#101832] p-3 transition duration-200 hover:border-[#6c72ff]"
                  >
                    <input
                      type="checkbox"
                      name="accountIds"
                      value={account.id}
                      checked={selectedAccountIds.has(account.id)}
                      onChange={(event) => {
                        setSelectedAccountIds((current) => {
                          const next = new Set(current);
                          if (event.target.checked) {
                            next.add(account.id);
                          } else {
                            next.delete(account.id);
                          }
                          return next;
                        });
                      }}
                      className="mt-1 h-4 w-4 cursor-pointer accent-[#6c72ff]"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-white">
                        {account.label}
                      </span>
                      <span className="mt-1 block text-xs text-[#8390bd]">
                        {account.activeRole}
                        {account.rank ? ` / ${account.rank}` : ""} / {shortId(account.id)}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-[#27345b] p-4 text-sm text-[#8390bd]">
                No account options for the current search.
              </div>
            )}

            <label className="grid gap-2 text-sm font-semibold text-[#dce3ff]">
              Paste account UUIDs
              <textarea
                name="pastedAccountIds"
                rows={3}
                value={pastedAccountIds}
                onChange={(event) => setPastedAccountIds(event.target.value)}
                placeholder="One or more account IDs, separated by spaces, commas, or new lines."
                className="min-h-24 resize-none rounded-md border border-[#27345b] bg-[#101832] px-3 py-2 text-sm leading-6 text-white outline-none transition duration-200 placeholder:text-[#526087] focus:border-[#6c72ff] focus-visible:ring-2 focus-visible:ring-[#6c72ff]/60"
              />
            </label>
          </div>

          <div className="grid gap-4">
            <label className="grid gap-2 text-sm font-semibold text-[#dce3ff]">
              Title
              <input
                name="title"
                maxLength={120}
                required
                placeholder="Short title shown in the user inbox"
                className="min-h-11 rounded-md border border-[#27345b] bg-[#0a1128] px-3 py-2 text-sm text-white outline-none transition duration-200 placeholder:text-[#526087] focus:border-[#6c72ff] focus-visible:ring-2 focus-visible:ring-[#6c72ff]/60"
              />
            </label>

            <label className="grid gap-2 text-sm font-semibold text-[#dce3ff]">
              Body
              <textarea
                name="body"
                maxLength={2000}
                required
                rows={6}
                placeholder="Message body"
                className="min-h-40 resize-none rounded-md border border-[#27345b] bg-[#0a1128] px-3 py-2 text-sm leading-6 text-white outline-none transition duration-200 placeholder:text-[#526087] focus:border-[#6c72ff] focus-visible:ring-2 focus-visible:ring-[#6c72ff]/60"
              />
            </label>

            <label className="grid gap-2 text-sm font-semibold text-[#dce3ff]">
              Optional link
              <input
                name="linkUrl"
                maxLength={2048}
                placeholder="/my-registrations or https://..."
                className="min-h-11 rounded-md border border-[#27345b] bg-[#0a1128] px-3 py-2 text-sm text-white outline-none transition duration-200 placeholder:text-[#526087] focus:border-[#6c72ff] focus-visible:ring-2 focus-visible:ring-[#6c72ff]/60"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-md bg-[#6c72ff] px-4 py-3 text-sm font-semibold text-white transition duration-200 hover:bg-[#7c82ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8c91ff]/70 disabled:cursor-wait disabled:opacity-60"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Send className="h-4 w-4" aria-hidden />
            )}
            Send notification
          </button>

          {state.message ? (
            <p
              role={state.status === "error" ? "alert" : "status"}
              data-testid="manual-notification-result"
              className={`rounded-md border p-3 text-sm leading-6 ${
                state.status === "error"
                  ? "border-[#5a2030] bg-[#2a101c] text-[#ffb0bd]"
                  : "border-[#1d5a4c] bg-[#09241f] text-[#42e0b3]"
              }`}
            >
              {state.status === "error" ? (
                <CircleAlert className="mr-2 inline h-4 w-4 align-[-2px]" aria-hidden />
              ) : (
                <CheckCircle2 className="mr-2 inline h-4 w-4 align-[-2px]" aria-hidden />
              )}
              {state.message}
              {state.result ? (
                <span className="mt-1 block text-xs opacity-90">
                  Notification {shortId(state.result.notificationId)} / {state.result.audienceType}
                </span>
              ) : null}
            </p>
          ) : null}
        </form>
      </section>

      <aside className="grid content-start gap-5">
        <section className="rounded-lg border border-[#202a49] bg-[#101832] p-5">
          <div className="flex items-center gap-2 text-[#58d8ff]">
            <UsersRound className="h-4 w-4" aria-hidden />
            <h2 className="text-sm font-semibold text-white">Account search</h2>
          </div>
          <form action="/admin/notifications" className="mt-4 grid gap-3">
            <label htmlFor="accountQ" className="text-sm font-semibold text-[#dce3ff]">
              Search accounts
            </label>
            <div className="flex min-h-11 items-center gap-2 rounded-md border border-[#27345b] bg-[#0a1128] px-3 py-2 text-sm text-white transition duration-200 focus-within:border-[#58d8ff] focus-within:ring-2 focus-within:ring-[#58d8ff]/35">
              <Search className="h-4 w-4 shrink-0 text-[#58d8ff]" aria-hidden />
              <input
                id="accountQ"
                name="accountQ"
                defaultValue={accountQuery}
                placeholder="Email, name, phone, rank, or UUID"
                className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-[#7480aa]"
              />
            </div>
            <button
              type="submit"
              className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md border border-[#27345b] px-4 py-2 text-sm font-semibold text-[#dce3ff] transition duration-200 hover:border-[#58d8ff] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58d8ff]/50"
            >
              <Search className="h-4 w-4" aria-hidden />
              Search
            </button>
          </form>
        </section>

        <section className="rounded-lg border border-[#202a49] bg-[#101832] p-5">
          <div className="flex items-center gap-2 text-[#58d8ff]">
            <BellRing className="h-4 w-4" aria-hidden />
            <h2 className="text-sm font-semibold text-white">Send guardrails</h2>
          </div>
          <div className="mt-4 grid gap-3 text-sm leading-6 text-[#aab4da]">
            <p>Recipients are resolved by the database RPC in one transaction.</p>
            <p>Selected account sends ignore pasted IDs that do not exist as real accounts.</p>
            <p>Audience with zero recipients is rejected and no notification row is kept.</p>
          </div>
        </section>
      </aside>
    </div>
  );
}

function AudienceCard({
  checked,
  count,
  description,
  label,
  name,
  onChange,
  value,
}: {
  checked: boolean;
  count: number;
  description: string;
  label: string;
  name: string;
  onChange: (value: AudienceType) => void;
  value: AudienceType;
}) {
  return (
    <label
      className={`grid min-h-36 cursor-pointer gap-3 rounded-md border p-4 transition duration-200 ${
        checked
          ? "border-[#6c72ff] bg-[#17244d]"
          : "border-[#27345b] bg-[#0a1128] hover:border-[#6c72ff]"
      }`}
    >
      <span className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-white">{label}</span>
        <input
          type="radio"
          name={name}
          value={value}
          checked={checked}
          onChange={() => onChange(value)}
          className="h-4 w-4 cursor-pointer accent-[#6c72ff]"
        />
      </span>
      <span className="text-2xl font-semibold text-white">{count.toLocaleString("en-US")}</span>
      <span className="text-xs leading-5 text-[#aab4da]">{description}</span>
    </label>
  );
}

function splitAccountIds(value: string) {
  return value
    .split(/[\s,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function shortId(value: string) {
  return value.slice(0, 8);
}
