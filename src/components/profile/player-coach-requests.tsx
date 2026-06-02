"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, X } from "lucide-react";
import { respondCoachPlayerLink, type ProfileActionResult } from "@/app/profile/actions";
import type { CoachPlayerLinkView, CoachLinkStatus } from "@/lib/coach/links";

export function PlayerCoachRequests({ incomingLinks }: { incomingLinks: CoachPlayerLinkView[] }) {
  const router = useRouter();
  const pendingLinks = incomingLinks.filter((link) => link.status === "pending");
  const approvedLinks = incomingLinks.filter((link) => link.status === "approved");
  const [result, setResult] = useState<ProfileActionResult | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function respond(linkId: string, decision: "approved" | "rejected") {
    setPendingAction(`${linkId}:${decision}`);
    setResult(null);

    startTransition(async () => {
      const next = await respondCoachPlayerLink(linkId, decision);
      setResult(next);
      setPendingAction(null);

      if (next.status === "success") {
        router.refresh();
      }
    });
  }

  return (
    <section className="rounded-md border border-[#27345b] bg-[#101832] p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">Coach requests</p>
          <p className="mt-1 text-xs leading-5 text-[#8390bd]">
            Player เป็นคนอนุมัติเองเท่านั้น Coach จึงจะดูแลบัญชีนี้ได้
          </p>
        </div>
        <span className="rounded-full bg-[#151f3e] px-2.5 py-1 text-xs font-semibold text-[#aab4da]">
          {pendingLinks.length.toLocaleString("th-TH")} pending
        </span>
      </div>

      {result ? (
        <p
          role={result.status === "error" ? "alert" : "status"}
          className={`mt-3 text-sm leading-6 ${
            result.status === "error" ? "text-[#ffb0bd]" : "text-[#42e0b3]"
          }`}
        >
          {result.message}
        </p>
      ) : null}

      {pendingLinks.length > 0 ? (
        <div className="mt-4 grid gap-3">
          {pendingLinks.map((link) => (
            <article key={link.id} className="rounded-md border border-[#27345b] bg-[#0a1128] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-white">
                    {link.coach?.nameTh ?? "Unknown coach"}
                  </p>
                  <p className="mt-1 truncate text-sm text-[#8390bd]">{link.coach?.nameEn}</p>
                  <p className="mt-2 truncate text-xs text-[#7480aa]">{link.coach?.email}</p>
                </div>
                <StatusBadge status={link.status} />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => respond(link.id, "approved")}
                  disabled={isPending}
                  className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md bg-[#0f7a65] px-3 py-2 text-sm font-semibold text-white outline-none transition hover:bg-[#12977c] focus-visible:ring-2 focus-visible:ring-[#42e0b3] disabled:cursor-wait disabled:opacity-60"
                >
                  {pendingAction === `${link.id}:approved` ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Check className="h-4 w-4" aria-hidden />
                  )}
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => respond(link.id, "rejected")}
                  disabled={isPending}
                  className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md border border-[#4a1724] px-3 py-2 text-sm font-semibold text-[#ffb0bd] outline-none transition hover:bg-[#2a1020] focus-visible:ring-2 focus-visible:ring-[#ff8fa3] disabled:cursor-wait disabled:opacity-60"
                >
                  {pendingAction === `${link.id}:rejected` ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <X className="h-4 w-4" aria-hidden />
                  )}
                  Reject
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm leading-6 text-[#8390bd]">ยังไม่มีคำขอ Coach Link ที่รออนุมัติ</p>
      )}

      {approvedLinks.length > 0 ? (
        <div className="mt-5 grid gap-3">
          <p className="text-xs font-semibold uppercase tracking-normal text-[#7480aa]">Approved coaches</p>
          {approvedLinks.map((link) => (
            <article key={link.id} className="rounded-md border border-[#27345b] bg-[#0a1128] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-white">{link.coach?.nameTh ?? "Unknown coach"}</p>
                  <p className="mt-1 truncate text-sm text-[#8390bd]">{link.coach?.email}</p>
                </div>
                <StatusBadge status={link.status} />
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
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
