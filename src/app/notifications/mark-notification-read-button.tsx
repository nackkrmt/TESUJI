"use client";

import { useActionState } from "react";
import { CheckCheck, CircleAlert, Loader2 } from "lucide-react";
import {
  markNotificationReadAction,
  type MarkNotificationReadState,
} from "./actions";

const initialState: MarkNotificationReadState = {
  message: "",
  status: "idle",
};

export function MarkNotificationReadButton({
  notificationId,
}: {
  notificationId: string;
}) {
  const [state, formAction, isPending] = useActionState(markNotificationReadAction, initialState);

  return (
    <form action={formAction} className="grid gap-2">
      <input type="hidden" name="notificationId" value={notificationId} readOnly />
      <button
        type="submit"
        disabled={isPending || state.status === "success"}
        className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md border border-[#27345b] bg-[#0a1128] px-3 py-2 text-sm font-semibold text-[#dce3ff] transition duration-200 hover:border-[#8c91ff] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8c91ff]/60 disabled:cursor-wait disabled:opacity-60"
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <CheckCheck className="h-4 w-4" aria-hidden />
        )}
        Mark read
      </button>
      {state.message ? (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={`text-xs leading-5 ${
            state.status === "error" ? "text-[#ffb0bd]" : "text-[#42e0b3]"
          }`}
        >
          {state.status === "error" ? (
            <CircleAlert className="mr-1 inline h-3.5 w-3.5 align-[-2px]" aria-hidden />
          ) : null}
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
