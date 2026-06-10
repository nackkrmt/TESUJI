"use client";

import { useActionState, useMemo, useState } from "react";
import { BadgeCheck, CheckCircle2, CircleAlert, Loader2, Save } from "lucide-react";
import { selfDeclaredRankOptions } from "@/lib/auth/rank-options";
import { rankToPowerLevel } from "@/lib/go/ranks";
import { approveRankAction, type RankApprovalActionState } from "./actions";

const initialState: RankApprovalActionState = {
  status: "idle",
  message: "",
};

export function RankApprovalControls({
  currentRank,
  playerProfileId,
}: {
  currentRank: string;
  playerProfileId: string;
}) {
  const [state, formAction, isPending] = useActionState(approveRankAction, initialState);
  const [selectedRank, setSelectedRank] = useState(currentRank);
  const isComplete = state.status === "success";
  const rankOptions = useMemo(() => {
    if ((selfDeclaredRankOptions as readonly string[]).includes(currentRank)) {
      return selfDeclaredRankOptions;
    }

    return [currentRank, ...selfDeclaredRankOptions] as readonly string[];
  }, [currentRank]);
  const selectedPowerLevel = rankToPowerLevel(selectedRank);

  return (
    <div className="grid gap-3">
      <form action={formAction}>
        <input type="hidden" name="playerProfileId" value={playerProfileId} readOnly />
        <input type="hidden" name="action" value="approve_as_is" readOnly />
        <button
          type="submit"
          disabled={isPending || isComplete}
          className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-[#22c55e] px-4 py-2 text-sm font-semibold text-[#02120a] transition duration-200 hover:bg-[#35d978] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#42e0b3]/70 disabled:cursor-wait disabled:opacity-60"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <CheckCircle2 className="h-4 w-4" aria-hidden />
          )}
          Approve as-is
        </button>
      </form>

      <form action={formAction} className="grid gap-3 rounded-md border border-[#27345b] bg-[#0a1128] p-4">
        <input type="hidden" name="playerProfileId" value={playerProfileId} readOnly />
        <input type="hidden" name="action" value="edit_rank" readOnly />
        <label className="grid gap-2 text-sm font-semibold text-[#dce3ff]">
          Final rank
          <select
            name="finalRank"
            value={selectedRank}
            onChange={(event) => setSelectedRank(event.target.value)}
            disabled={isPending || isComplete}
            className="min-h-11 cursor-pointer rounded-md border border-[#27345b] bg-[#101832] px-3 py-2 text-sm text-white outline-none transition duration-200 focus:border-[#6c72ff] focus-visible:ring-2 focus-visible:ring-[#6c72ff]/60 disabled:cursor-wait disabled:opacity-60"
          >
            {rankOptions.map((rank) => (
              <option key={rank} value={rank}>
                {rank}
              </option>
            ))}
          </select>
        </label>

        <p className="w-fit rounded-full border border-[#27345b] bg-[#101832] px-2.5 py-1 text-xs font-semibold text-[#aab4da]">
          Power {selectedPowerLevel ?? "-"}
        </p>

        <label className="grid gap-2 text-sm font-semibold text-[#dce3ff]">
          Review note
          <textarea
            name="note"
            maxLength={500}
            rows={3}
            disabled={isPending || isComplete}
            placeholder="Optional note for the rank audit trail."
            className="min-h-24 w-full resize-none rounded-md border border-[#27345b] bg-[#101832] px-3 py-2 text-sm leading-6 text-white outline-none transition duration-200 placeholder:text-[#526087] focus:border-[#6c72ff] focus-visible:ring-2 focus-visible:ring-[#6c72ff]/60 disabled:cursor-wait disabled:opacity-60"
          />
        </label>

        <button
          type="submit"
          disabled={isPending || isComplete}
          className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-[#27345b] px-4 py-2 text-sm font-semibold text-[#dce3ff] transition duration-200 hover:border-[#8c91ff] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8c91ff]/60 disabled:cursor-wait disabled:opacity-60"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Save className="h-4 w-4" aria-hidden />
          )}
          Save edited rank
        </button>
      </form>

      {state.message ? (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={`rounded-md border p-3 text-sm leading-6 ${
            state.status === "error"
              ? "border-[#5a2030] bg-[#2a101c] text-[#ffb0bd]"
              : "border-[#1d5a4c] bg-[#09241f] text-[#42e0b3]"
          }`}
        >
          {state.status === "error" ? (
            <CircleAlert className="mr-2 inline h-4 w-4 align-[-2px]" aria-hidden />
          ) : (
            <BadgeCheck className="mr-2 inline h-4 w-4 align-[-2px]" aria-hidden />
          )}
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
