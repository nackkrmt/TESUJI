"use client";

import { useActionState } from "react";
import { CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import { redeemRefereeInvite, type RedeemInviteState } from "@/app/referee/invite/actions";
import { inputClassName, primaryButtonClassName } from "@/components/mobile/mobile-shell";

const initialState: RedeemInviteState = {
  status: "idle",
  message: "กรอก invite code ที่ได้รับจาก Admin",
};

export function RefereeInviteForm() {
  const [state, action, isPending] = useActionState(redeemRefereeInvite, initialState);

  return (
    <form action={action} className="grid gap-4">
      <div className="rounded-md border border-[#27345b] bg-[#101832] p-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-[#17244d] text-[#8c91ff]">
            <KeyRound className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h2 className="font-semibold text-white">Referee invite</h2>
            <p className="mt-1 text-xs leading-5 text-[#8390bd]">{state.message}</p>
          </div>
        </div>
      </div>

      <label className="grid gap-2 text-sm font-semibold text-[#dce3ff]">
        Invite code
        <input
          name="code"
          className={inputClassName}
          placeholder="REF-XXXX-XXXX-XX"
          autoCapitalize="characters"
          autoComplete="off"
        />
      </label>

      {state.status === "success" ? (
        <div role="status" className="flex items-start gap-2 rounded-md border border-[#073d36] bg-[#071f20] p-3 text-sm text-[#42e0b3]">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{state.message}</span>
        </div>
      ) : null}

      {state.status === "error" ? (
        <div role="alert" className="rounded-md border border-[#4a1724] bg-[#2a1020] p-3 text-sm text-[#ffb0bd]">
          {state.message}
        </div>
      ) : null}

      <button type="submit" disabled={isPending} className={primaryButtonClassName}>
        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
        Redeem invite
      </button>
    </form>
  );
}
