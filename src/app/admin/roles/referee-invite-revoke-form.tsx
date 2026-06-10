"use client";

import { useActionState } from "react";
import { Ban, Loader2 } from "lucide-react";
import {
  revokeRefereeInviteAction,
  type RevokeInviteActionState,
} from "./actions";

const initialState: RevokeInviteActionState = {
  status: "idle",
  message: "",
};

export function RefereeInviteRevokeForm({ inviteId }: { inviteId: string }) {
  const [state, action, isPending] = useActionState(revokeRefereeInviteAction, initialState);

  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="inviteId" value={inviteId} />
      <button
        type="submit"
        disabled={isPending}
        className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-[#4a1724] px-3 py-2 text-sm font-semibold text-[#ffb0bd] transition duration-200 hover:bg-[#2a1020] disabled:cursor-wait disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff8fa3]/60"
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Ban className="h-4 w-4" aria-hidden />
        )}
        Revoke
      </button>
      {state.message ? (
        <p
          role={state.status === "error" ? "alert" : undefined}
          className={`text-xs leading-5 ${
            state.status === "error" ? "text-[#ffb0bd]" : "text-[#42e0b3]"
          }`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
