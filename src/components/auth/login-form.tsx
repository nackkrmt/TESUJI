"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertCircle, Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import {
  FieldLabel,
  inputClassName,
  primaryButtonClassName,
} from "@/components/mobile/mobile-shell";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setMessage(null);
    startTransition(async () => {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, remember }),
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        setMessage(result.error ?? "เข้าสู่ระบบไม่สำเร็จ");
        return;
      }

      router.push("/");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-1 flex-col">
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

        <div className="grid gap-2">
          <FieldLabel>รหัสผ่าน</FieldLabel>
          <div className="relative">
            <input
              className={`${inputClassName} pr-12`}
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
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

        <div className="flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-[#dce3ff]">
            <input
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
              className="h-4 w-4 rounded border-[#27345b] accent-[#6c72ff]"
            />
            จดจำฉัน
          </label>
          <Link href="/forgot-password" className="text-sm font-semibold text-[#8c91ff] hover:underline">
            ลืมรหัสผ่าน
          </Link>
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
              กำลังเข้าสู่ระบบ...
            </>
          ) : (
            <>
              <LogIn className="mr-2 h-4 w-4" aria-hidden />
              เข้าสู่ระบบ
            </>
          )}
        </button>
      </form>

      <div className="mt-auto pt-8 text-center text-sm text-[#8390bd]">
        ยังไม่มีบัญชี?{" "}
        <Link href="/register" className="font-semibold text-[#8c91ff] hover:underline">
          สมัครสมาชิก
        </Link>
      </div>
    </div>
  );
}
