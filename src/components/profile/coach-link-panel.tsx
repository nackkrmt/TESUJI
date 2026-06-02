"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, Loader2, Search, UserPlus, UsersRound } from "lucide-react";
import {
  requestCoachPlayerLink,
  searchCoachPlayers,
  type CoachPlayerSearchResult,
  type CoachPlayerSearchState,
  type ProfileActionResult,
} from "@/app/profile/actions";
import { inputClassName, primaryButtonClassName, secondaryButtonClassName } from "@/components/mobile/mobile-shell";
import type { CoachPlayerLinkView, CoachLinkStatus } from "@/lib/coach/links";

const initialSearchState: CoachPlayerSearchState = {
  status: "idle",
  message: "ค้นหาด้วย Player ID, email แบบตรงตัว, หรือชื่อ-นามสกุล",
  results: [],
};

export function CoachLinkPanel({
  isActiveCoach,
  hasPendingCoachRequest,
  coachLinks,
}: {
  isActiveCoach: boolean;
  hasPendingCoachRequest: boolean;
  coachLinks: CoachPlayerLinkView[];
}) {
  const approvedLinks = coachLinks.filter((link) => link.status === "approved");
  const otherLinks = coachLinks.filter((link) => link.status !== "approved");

  if (!isActiveCoach) {
    return (
      <section className="rounded-md border border-[#27345b] bg-[#101832] p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <UsersRound className="h-4 w-4 text-[#8c91ff]" aria-hidden />
          Coach Links
        </div>
        <p className="mt-3 text-sm leading-6 text-[#8390bd]">
          {hasPendingCoachRequest
            ? "สิทธิ์ Coach ยังรอ Admin อนุมัติ หลังอนุมัติแล้วจึงจะค้นหาและส่งคำขอ link Player ได้"
            : "บัญชีนี้ยังไม่มีสิทธิ์ Coach active จึงยังส่งคำขอ link Player ไม่ได้"}
        </p>
      </section>
    );
  }

  return (
    <section className="grid gap-4">
      <CoachSearchForm />

      <div className="rounded-md border border-[#27345b] bg-[#101832] p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <CheckCircle2 className="h-4 w-4 text-[#42e0b3]" aria-hidden />
          Linked players
        </div>
        {approvedLinks.length > 0 ? (
          <div className="mt-4 grid gap-3">
            {approvedLinks.map((link) => (
              <LinkedPlayerCard key={link.id} link={link} />
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm leading-6 text-[#8390bd]">
            ยังไม่มี Player ที่อนุมัติ link แล้ว
          </p>
        )}
      </div>

      {otherLinks.length > 0 ? (
        <div className="rounded-md border border-[#27345b] bg-[#101832] p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Clock className="h-4 w-4 text-[#ffc66d]" aria-hidden />
            Link requests
          </div>
          <div className="mt-4 grid gap-3">
            {otherLinks.map((link) => (
              <LinkedPlayerCard key={link.id} link={link} />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function CoachSearchForm() {
  const router = useRouter();
  const [state, formAction, isSearching] = useActionState(searchCoachPlayers, initialSearchState);
  const [actionResult, setActionResult] = useState<ProfileActionResult | null>(null);
  const [pendingProfileId, setPendingProfileId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function sendRequest(playerProfileId: string) {
    setPendingProfileId(playerProfileId);
    setActionResult(null);
    startTransition(async () => {
      const result = await requestCoachPlayerLink(playerProfileId);
      setActionResult(result);
      setPendingProfileId(null);

      if (result.status === "success") {
        router.refresh();
      }
    });
  }

  return (
    <div className="rounded-md border border-[#27345b] bg-[#101832] p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-white">
        <Search className="h-4 w-4 text-[#8c91ff]" aria-hidden />
        Find player
      </div>
      <form action={formAction} className="mt-4 grid gap-3">
        <label className="grid gap-2 text-xs font-semibold text-[#aab4da]">
          Player ID / email / name
          <input
            name="query"
            className={inputClassName}
            placeholder="เช่น ชื่อ นามสกุล หรือ player id"
            autoComplete="off"
          />
        </label>
        <button type="submit" disabled={isSearching} className={primaryButtonClassName}>
          {isSearching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
          Search
        </button>
      </form>

      <p
        role={state.status === "error" ? "alert" : "status"}
        className={`mt-3 text-sm leading-6 ${
          state.status === "error"
            ? "text-[#ffb0bd]"
            : state.status === "success"
              ? "text-[#42e0b3]"
              : "text-[#8390bd]"
        }`}
      >
        {state.message}
      </p>

      {actionResult ? (
        <p
          role={actionResult.status === "error" ? "alert" : "status"}
          className={`mt-2 text-sm leading-6 ${
            actionResult.status === "error" ? "text-[#ffb0bd]" : "text-[#42e0b3]"
          }`}
        >
          {actionResult.message}
        </p>
      ) : null}

      {state.results.length > 0 ? (
        <div className="mt-4 grid gap-3">
          {state.results.map((result) => (
            <SearchResultCard
              key={result.playerProfileId}
              result={result}
              isPending={isPending && pendingProfileId === result.playerProfileId}
              onRequest={() => sendRequest(result.playerProfileId)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SearchResultCard({
  result,
  isPending,
  onRequest,
}: {
  result: CoachPlayerSearchResult;
  isPending: boolean;
  onRequest: () => void;
}) {
  const alreadyLinked =
    result.existingLinkStatus === "approved" || result.existingLinkStatus === "pending";

  return (
    <article className="rounded-md border border-[#27345b] bg-[#0a1128] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-white">{result.nameTh}</p>
          <p className="mt-1 truncate text-sm text-[#8390bd]">{result.nameEn}</p>
          <p className="mt-2 text-sm text-[#dce3ff]">
            {result.rank} · {result.rankStatus}
          </p>
          <p className="mt-1 truncate text-xs text-[#7480aa]">
            {result.instituteName || "ไม่ระบุสถาบัน"}
          </p>
        </div>
        {result.existingLinkStatus ? <StatusBadge status={result.existingLinkStatus} /> : null}
      </div>
      <button
        type="button"
        onClick={onRequest}
        disabled={isPending || alreadyLinked}
        className={`${secondaryButtonClassName} mt-4`}
      >
        {isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <UserPlus className="mr-2 h-4 w-4" aria-hidden />
        )}
        {alreadyLinked ? "Request exists" : "Send link request"}
      </button>
    </article>
  );
}

function LinkedPlayerCard({ link }: { link: CoachPlayerLinkView }) {
  return (
    <article className="rounded-md border border-[#27345b] bg-[#0a1128] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-white">{link.player?.nameTh ?? "Unknown player"}</p>
          <p className="mt-1 truncate text-sm text-[#8390bd]">{link.player?.nameEn}</p>
          <p className="mt-2 text-sm text-[#dce3ff]">
            {link.player?.rank ?? "-"} · {link.player?.rankStatus ?? "-"}
          </p>
          <p className="mt-1 truncate text-xs text-[#7480aa]">
            {link.player?.instituteName || "ไม่ระบุสถาบัน"}
          </p>
        </div>
        <StatusBadge status={link.status} />
      </div>
    </article>
  );
}

function StatusBadge({ status }: { status: CoachLinkStatus }) {
  const tone =
    status === "approved"
      ? "bg-[#073d36] text-[#42e0b3]"
      : status === "pending"
        ? "bg-[#443013] text-[#ffc66d]"
        : "bg-[#4a1724] text-[#ff8fa3]";

  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>
      {status}
    </span>
  );
}
