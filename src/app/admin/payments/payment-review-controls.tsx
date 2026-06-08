"use client";

import type { ReactNode } from "react";
import { useActionState } from "react";
import { CheckCircle2, Loader2, RotateCcw, XCircle } from "lucide-react";
import { reviewPaymentAction, type PaymentReviewActionState } from "./actions";

const initialState: PaymentReviewActionState = {
  status: "idle",
  message: "",
};

export function PaymentReviewControls({ paymentOrderId }: { paymentOrderId: string }) {
  const [state, formAction, isPending] = useActionState(reviewPaymentAction, initialState);
  const isComplete = state.status === "success";

  return (
    <div className="grid gap-3">
      <form action={formAction}>
        <input type="hidden" name="paymentOrderId" value={paymentOrderId} readOnly />
        <input type="hidden" name="action" value="approve" readOnly />
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
          Approve payment
        </button>
      </form>

      <div className="grid gap-3 xl:grid-cols-2">
        <ReviewForm
          action="reject_send_new"
          buttonClassName="border-[#5a3f13] bg-[#2a210d] text-[#ffc66d] hover:border-[#ffc66d] hover:text-white focus-visible:ring-[#ffc66d]/60"
          buttonText="Reject, send new"
          icon={<RotateCcw className="h-4 w-4" aria-hidden />}
          isComplete={isComplete}
          isPending={isPending}
          paymentOrderId={paymentOrderId}
          placeholder="Wrong amount, unreadable slip, or transfer name mismatch."
          formAction={formAction}
        />
        <ReviewForm
          action="reject_cancel"
          buttonClassName="border-[#5a2030] bg-[#2a101c] text-[#ffb0bd] hover:border-[#ff6f8d] hover:text-white focus-visible:ring-[#ff6f8d]/60"
          buttonText="Reject, cancel"
          icon={<XCircle className="h-4 w-4" aria-hidden />}
          isComplete={isComplete}
          isPending={isPending}
          paymentOrderId={paymentOrderId}
          placeholder="Fraud, duplicate transfer, or user requested cancellation."
          formAction={formAction}
        />
      </div>

      {state.message ? (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={`rounded-md border p-3 text-sm leading-6 ${
            state.status === "error"
              ? "border-[#5a2030] bg-[#2a101c] text-[#ffb0bd]"
              : "border-[#1d5a4c] bg-[#09241f] text-[#42e0b3]"
          }`}
        >
          {state.message}
        </p>
      ) : null}
    </div>
  );
}

function ReviewForm({
  action,
  buttonClassName,
  buttonText,
  formAction,
  icon,
  isComplete,
  isPending,
  paymentOrderId,
  placeholder,
}: {
  action: "reject_send_new" | "reject_cancel";
  buttonClassName: string;
  buttonText: string;
  formAction: (payload: FormData) => void;
  icon: ReactNode;
  isComplete: boolean;
  isPending: boolean;
  paymentOrderId: string;
  placeholder: string;
}) {
  return (
    <form action={formAction} className="grid gap-2">
      <input type="hidden" name="paymentOrderId" value={paymentOrderId} readOnly />
      <input type="hidden" name="action" value={action} readOnly />
      <label className="grid gap-2">
        <span className="text-xs font-semibold text-[#aab4da]">Reason</span>
        <textarea
          name="reason"
          required
          maxLength={500}
          rows={3}
          disabled={isPending || isComplete}
          placeholder={placeholder}
          className="min-h-24 w-full resize-none rounded-md border border-[#27345b] bg-[#0a1128] px-3 py-2 text-sm leading-6 text-white outline-none transition duration-200 placeholder:text-[#526087] focus:border-[#6c72ff] focus-visible:ring-2 focus-visible:ring-[#6c72ff]/60 disabled:cursor-wait disabled:opacity-60"
        />
      </label>
      <button
        type="submit"
        disabled={isPending || isComplete}
        className={`inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-semibold transition duration-200 focus-visible:outline-none disabled:cursor-wait disabled:opacity-60 ${buttonClassName}`}
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
        {buttonText}
      </button>
    </form>
  );
}
