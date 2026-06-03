"use client";

import Image from "next/image";
import { useEffect, useId, useState } from "react";
import { Maximize2, ShieldCheck, X } from "lucide-react";

const roleLabels: Record<string, string> = {
  admin: "ผู้ดูแล",
  coach: "โค้ช",
  player: "นักกีฬา",
  referee: "กรรมการ",
};

export type DigitalIdCardProps = {
  activeRole: string;
  instituteName: string | null;
  nameEn: string | null;
  nameTh: string | null;
  profileId: string | null;
  qrDataUrl: string | null;
  rank: string | null;
  rankStatus: "verified" | "pending" | null;
};

export function DigitalIdCard({
  activeRole,
  instituteName,
  nameEn,
  nameTh,
  profileId,
  qrDataUrl,
  rank,
  rankStatus,
}: DigitalIdCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const dialogTitleId = useId();
  const safeNameTh = nameTh ?? "ยังไม่มีโปรไฟล์";
  const safeNameEn = nameEn ?? "Player profile required";
  const roleLabel = roleLabels[activeRole] ?? activeRole;
  const isVerified = rankStatus === "verified";

  useEffect(() => {
    if (!isExpanded) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsExpanded(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isExpanded]);

  return (
    <>
      <section className="rounded-[24px] border border-[#30405f] bg-[radial-gradient(circle_at_top_left,#253a6a_0,#111a34_42%,#081024_100%)] p-5 shadow-xl shadow-black/25">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#91a2d8]">
              TESUJI Digital ID
            </p>
            <h2 className="mt-3 truncate text-2xl font-semibold text-white">{safeNameTh}</h2>
            <p className="mt-1 truncate text-sm text-[#aab7df]">{safeNameEn}</p>
          </div>

          <button
            type="button"
            onClick={() => qrDataUrl && setIsExpanded(true)}
            disabled={!qrDataUrl}
            className="group relative grid h-28 w-28 shrink-0 place-items-center rounded-2xl border border-white/20 bg-white p-2 text-[#080d20] shadow-lg shadow-black/30 outline-none transition hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-[#9eb7ff] disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="ขยาย QR Code Digital ID"
          >
            {qrDataUrl ? (
              <>
                <Image
                  src={qrDataUrl}
                  alt="QR Code Digital ID"
                  width={96}
                  height={96}
                  unoptimized
                  priority
                />
                <span className="absolute bottom-1 right-1 rounded-full bg-[#080d20] p-1 text-white opacity-90 transition group-hover:opacity-100">
                  <Maximize2 className="h-3.5 w-3.5" aria-hidden />
                </span>
              </>
            ) : (
              <span className="text-center text-xs font-semibold">QR ยังไม่พร้อม</span>
            )}
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <IdFact label="Rank" value={rank ?? "-"} />
          <IdFact label="Role" value={roleLabel} />
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.06] p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <ShieldCheck className="h-4 w-4 text-[#7df0c7]" aria-hidden />
            {isVerified ? "Rank verified" : "Rank pending review"}
          </div>
          <p className="mt-2 text-sm leading-6 text-[#aab7df]">
            {instituteName || "ยังไม่ได้ระบุสถาบัน"} · Player ID{" "}
            {profileId ? profileId.slice(0, 8).toUpperCase() : "-"}
          </p>
          <p className="mt-2 text-xs leading-5 text-[#8390bd]">
            กด QR เพื่อขยายเต็มหน้าจอ ใช้แสดงตัวตนเบื้องต้นในระบบ TESUJI
          </p>
        </div>
      </section>

      {isExpanded && qrDataUrl ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-[#030712]/90 px-5 py-8 backdrop-blur"
          role="dialog"
          aria-modal="true"
          aria-labelledby={dialogTitleId}
          onClick={() => setIsExpanded(false)}
        >
          <div
            className="w-full max-w-[360px] rounded-[28px] border border-[#30405f] bg-[#080d20] p-5 shadow-2xl shadow-black"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#91a2d8]">
                  TESUJI Digital ID
                </p>
                <h2 id={dialogTitleId} className="mt-2 text-xl font-semibold text-white">
                  {safeNameTh}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="grid h-10 w-10 place-items-center rounded-full border border-[#30405f] bg-[#101832] text-[#dce3ff] outline-none transition hover:border-[#6c72ff] hover:text-white focus-visible:ring-2 focus-visible:ring-[#6c72ff]"
                aria-label="ปิด QR Code"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <div className="mt-5 rounded-3xl bg-white p-4">
              <Image
                src={qrDataUrl}
                alt="QR Code Digital ID ขนาดใหญ่"
                width={320}
                height={320}
                unoptimized
                style={{ height: "auto", width: "100%" }}
              />
            </div>

            <p className="mt-4 text-center text-sm leading-6 text-[#aab7df]">
              {safeNameEn} · {rank ?? "-"} · {roleLabel}
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}

function IdFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3">
      <p className="text-xs text-[#91a2d8]">{label}</p>
      <p className="mt-1 truncate text-base font-semibold text-white">{value}</p>
    </div>
  );
}
