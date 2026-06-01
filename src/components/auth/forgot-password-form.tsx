"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import {
  FieldLabel,
  inputClassName,
  primaryButtonClassName,
} from "@/components/mobile/mobile-shell";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setMessage(null);
    setIsSuccess(false);
    startTransition(async () => {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        setMessage(result.error ?? "ส่งอีเมลไม่สำเร็จ");
        return;
      }

      setIsSuccess(true);
      setMessage("ส่งลิงก์รีเซ็ตรหัสผ่านแล้ว กรุณาเช็กอีเมล");
    });
  }

  return (
    <div className="grid gap-4">
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="grid gap-2">
          <FieldLabel>อีเมล</FieldLabel>
          <input
            className={inputClassName}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
        </div>

        {message ? (
          <div
            role={isSuccess ? "status" : "alert"}
            className={`flex items-start gap-2 rounded-md border p-3 text-sm ${
              isSuccess
                ? "border-[#073d36] bg-[#071f20] text-[#42e0b3]"
                : "border-[#4a1724] bg-[#2a1020] text-[#ffb0bd]"
            }`}
          >
            {isSuccess ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            ) : (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            )}
            <span>{message}</span>
          </div>
        ) : null}

        <button type="submit" disabled={isPending} className={primaryButtonClassName}>
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              กำลังส่ง...
            </>
          ) : (
            "ส่งลิงก์รีเซ็ต"
          )}
        </button>
      </form>

      <Link href="/login" className="text-center text-sm font-semibold text-[#8c91ff] hover:underline">
        กลับไป Login
      </Link>
    </div>
  );
}
