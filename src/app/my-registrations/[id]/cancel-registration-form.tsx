"use client";

import { useActionState } from "react";
import { Loader2, XCircle } from "lucide-react";
import {
  FieldLabel,
  primaryButtonClassName,
} from "@/components/mobile/mobile-shell";
import {
  cancelRegistrationAction,
  type CancelRegistrationActionState,
} from "./actions";

const initialState: CancelRegistrationActionState = {
  status: "idle",
  message: "",
};

export function CancelRegistrationForm({
  paymentOrderId,
  registrationId,
}: {
  paymentOrderId: string | null;
  registrationId: string;
}) {
  const [state, formAction, isPending] = useActionState(cancelRegistrationAction, initialState);

  return (
    <form action={formAction} className="grid gap-3">
      <input type="hidden" name="registrationId" value={registrationId} readOnly />
      {paymentOrderId ? <input type="hidden" name="paymentOrderId" value={paymentOrderId} readOnly /> : null}

      <label className="grid gap-2">
        <FieldLabel>เหตุผลในการยกเลิก</FieldLabel>
        <textarea
          name="reason"
          required
          maxLength={500}
          rows={4}
          disabled={isPending || state.status === "success"}
          className="min-h-28 w-full resize-none rounded-md border border-[#27345b] bg-[#101832] px-3 py-2 text-sm leading-6 text-white outline-none transition duration-200 placeholder:text-[#526087] focus:border-[#6c72ff] focus-visible:ring-2 focus-visible:ring-[#6c72ff]/60 disabled:cursor-wait disabled:opacity-60"
          placeholder="เช่น ติดธุระวันแข่งขัน"
        />
      </label>

      {state.message ? (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={`rounded-xl border p-3 text-sm leading-6 ${
            state.status === "error"
              ? "border-[#5a2030] bg-[#2a101c] text-[#ffb0bd]"
              : "border-[#1d5a4c] bg-[#09241f] text-[#42e0b3]"
          }`}
        >
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending || state.status === "success"}
        className={`${primaryButtonClassName} bg-[#b8324f] hover:bg-[#cf3f5f] focus-visible:ring-[#ff6f8d]`}
      >
        {isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <XCircle className="mr-2 h-4 w-4" aria-hidden />
        )}
        ยืนยันยกเลิกรายการ
      </button>
    </form>
  );
}
