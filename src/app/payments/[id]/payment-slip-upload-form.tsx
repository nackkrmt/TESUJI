"use client";

import { type FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UploadCloud } from "lucide-react";
import { primaryButtonClassName } from "@/components/mobile/mobile-shell";

const maxSlipBytes = 10 * 1024 * 1024;
const allowedSlipTypes = new Set(["image/jpeg", "image/png"]);

export function PaymentSlipUploadForm({ paymentOrderId }: { paymentOrderId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setStatus("idle");

    const formData = new FormData(event.currentTarget);
    const slip = formData.get("slip");
    const validationError = validateSlip(slip);

    if (validationError) {
      setStatus("error");
      setMessage(validationError);
      return;
    }

    setIsUploading(true);

    try {
      const response = await fetch(`/payments/${paymentOrderId}/slip`, {
        body: formData,
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "อัปโหลดสลิปไม่สำเร็จ");
      }

      setStatus("success");
      setMessage("ส่งสลิปเรียบร้อยแล้ว รอ Admin ตรวจสอบการชำระเงิน");
      formRef.current?.reset();
      router.refresh();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "อัปโหลดสลิปไม่สำเร็จ");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="grid gap-3">
      <label className="grid gap-2">
        <span className="text-xs font-semibold text-[#aab4da]">อัปโหลดสลิปโอนเงิน</span>
        <input
          type="file"
          name="slip"
          accept="image/jpeg,image/png"
          required
          disabled={isUploading}
          className="min-h-12 w-full cursor-pointer rounded-md border border-[#27345b] bg-[#101832] px-3 py-2 text-sm text-white outline-none transition duration-200 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-[#6c72ff] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white focus:border-[#6c72ff] focus-visible:ring-2 focus-visible:ring-[#6c72ff]/60 disabled:cursor-wait disabled:opacity-60"
        />
      </label>
      <p className="text-xs leading-5 text-[#8390bd]">รองรับ JPG หรือ PNG ขนาดไม่เกิน 10MB</p>

      {message ? (
        <p
          role={status === "error" ? "alert" : "status"}
          className={`rounded-xl border p-3 text-sm leading-6 ${
            status === "error"
              ? "border-[#5a2030] bg-[#2a101c] text-[#ffb0bd]"
              : "border-[#1d5a4c] bg-[#09241f] text-[#42e0b3]"
          }`}
        >
          {message}
        </p>
      ) : null}

      <button type="submit" disabled={isUploading} className={primaryButtonClassName}>
        {isUploading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <UploadCloud className="mr-2 h-4 w-4" aria-hidden />
        )}
        ส่งสลิป
      </button>
    </form>
  );
}

function validateSlip(value: FormDataEntryValue | null) {
  if (!(value instanceof File) || value.size === 0) {
    return "กรุณาเลือกไฟล์สลิป";
  }

  if (!allowedSlipTypes.has(value.type)) {
    return "สลิปต้องเป็นไฟล์ JPG หรือ PNG เท่านั้น";
  }

  if (value.size > maxSlipBytes) {
    return "สลิปต้องมีขนาดไม่เกิน 10MB";
  }

  return "";
}
