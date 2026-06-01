"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react";
import {
  FieldLabel,
  inputClassName,
  primaryButtonClassName,
} from "@/components/mobile/mobile-shell";

export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setMessage(null);

    if (password !== confirmPassword) {
      setMessage("รหัสผ่านทั้งสองช่องไม่ตรงกัน");
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/auth/update-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        setMessage(result.error ?? "เปลี่ยนรหัสผ่านไม่สำเร็จ");
        return;
      }

      router.push("/");
      router.refresh();
    });
  }

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="grid gap-2">
        <FieldLabel>รหัสผ่านใหม่</FieldLabel>
        <div className="relative">
          <input
            className={`${inputClassName} pr-12`}
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="อย่างน้อย 8 ตัวอักษร"
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
            aria-pressed={showPassword}
            className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-md text-[#8390bd] outline-none transition hover:text-white focus-visible:ring-2 focus-visible:ring-[#6c72ff]"
          >
            {showPassword ? <EyeOff className="h-5 w-5" aria-hidden /> : <Eye className="h-5 w-5" aria-hidden />}
          </button>
        </div>
      </div>

      <div className="grid gap-2">
        <FieldLabel>ยืนยันรหัสผ่านใหม่</FieldLabel>
        <div className="relative">
          <input
            className={`${inputClassName} pr-12`}
            type={showConfirm ? "text" : "password"}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="กรอกซ้ำอีกครั้ง"
          />
          <button
            type="button"
            onClick={() => setShowConfirm((value) => !value)}
            aria-label={showConfirm ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
            aria-pressed={showConfirm}
            className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-md text-[#8390bd] outline-none transition hover:text-white focus-visible:ring-2 focus-visible:ring-[#6c72ff]"
          >
            {showConfirm ? <EyeOff className="h-5 w-5" aria-hidden /> : <Eye className="h-5 w-5" aria-hidden />}
          </button>
        </div>
      </div>

      {message ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-[#4a1724] bg-[#2a1020] p-3 text-sm text-[#ffb0bd]"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{message}</span>
        </div>
      ) : null}

      <button type="submit" disabled={isPending} className={primaryButtonClassName}>
        {isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            กำลังบันทึก...
          </>
        ) : (
          "บันทึกรหัสผ่านใหม่"
        )}
      </button>
    </form>
  );
}
