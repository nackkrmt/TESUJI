"use client";

import { useActionState } from "react";
import { Clock, Loader2 } from "lucide-react";
import { runPaymentTimeoutAction, type PaymentTimeoutActionState } from "./actions";

const initialState: PaymentTimeoutActionState = {
  status: "idle",
  message: "",
};

export function PaymentTimeoutSweepForm() {
  const [state, formAction, isPending] = useActionState(runPaymentTimeoutAction, initialState);

  return (
    <form action={formAction} className="grid gap-2">
      <button
        type="submit"
        disabled={isPending}
        className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-[#27345b] bg-[#0a1128] px-4 py-2 text-sm font-semibold text-[#dce3ff] transition duration-200 hover:border-[#42e0b3] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#42e0b3]/60 disabled:cursor-wait disabled:opacity-60"
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Clock className="h-4 w-4" aria-hidden />
        )}
        Run timeout sweep
      </button>
      {state.message ? (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={`rounded-md border p-3 text-xs leading-5 ${
            state.status === "error"
              ? "border-[#5a2030] bg-[#2a101c] text-[#ffb0bd]"
              : "border-[#1d5a4c] bg-[#09241f] text-[#42e0b3]"
          }`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
