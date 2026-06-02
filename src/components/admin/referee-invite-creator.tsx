"use client";

import { useActionState } from "react";
import { CheckCircle2, Copy, Loader2, Plus } from "lucide-react";
import { createRefereeInvite, type InviteActionState } from "@/app/admin/roles/actions";

const initialState: InviteActionState = {
  status: "idle",
  message: "Create a one-time code. The raw code is shown only after creation.",
};

export function RefereeInviteCreator() {
  const [state, action, isPending] = useActionState(createRefereeInvite, initialState);

  async function copyCode() {
    if (state.code) {
      await navigator.clipboard.writeText(state.code);
    }
  }

  return (
    <form action={action} className="rounded-lg border border-[#202a49] bg-[#101832] p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#7378ff]">Referee Invite</p>
          <h2 className="mt-1 text-xl font-semibold text-white">Create invite code</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[#8390bd]">{state.message}</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-[150px_auto]">
          <label className="grid gap-2 text-sm text-[#dce3ff]">
            Expires
            <select
              name="expiresInDays"
              className="min-h-11 rounded-md border border-[#27345b] bg-[#0a1128] px-3 text-sm text-white outline-none transition focus-visible:ring-2 focus-visible:ring-[#6c72ff]"
              defaultValue="7"
            >
              <option value="1">1 day</option>
              <option value="7">7 days</option>
              <option value="14">14 days</option>
              <option value="30">30 days</option>
            </select>
          </label>
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md bg-[#6c72ff] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#7c82ff] disabled:cursor-wait disabled:opacity-70"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Plus className="h-4 w-4" aria-hidden />
            )}
            Create
          </button>
        </div>
      </div>

      {state.code ? (
        <div className="mt-5 rounded-md border border-[#073d36] bg-[#071f20] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-semibold text-[#42e0b3]">
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                Ready to share
              </p>
              <p className="mt-2 break-all font-mono text-lg font-semibold tracking-normal text-white">
                {state.code}
              </p>
            </div>
            <button
              type="button"
              onClick={copyCode}
              className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md border border-[#245e55] px-4 py-2 text-sm font-semibold text-[#42e0b3] transition hover:bg-[#0d332f]"
            >
              <Copy className="h-4 w-4" aria-hidden />
              Copy
            </button>
          </div>
        </div>
      ) : null}

      {state.status === "error" ? (
        <div role="alert" className="mt-4 rounded-md border border-[#4a1724] bg-[#2a1020] p-3 text-sm text-[#ffb0bd]">
          {state.message}
        </div>
      ) : null}
    </form>
  );
}
