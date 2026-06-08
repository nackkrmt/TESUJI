import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  CreditCard,
  ExternalLink,
  ReceiptText,
} from "lucide-react";
import {
  MobileShell,
  secondaryButtonClassName,
} from "@/components/mobile/mobile-shell";
import { getPaymentOrderDetail, type PaymentOrderDetail } from "@/lib/registrations/payment";
import { PaymentSlipUploadForm } from "./payment-slip-upload-form";

export const dynamic = "force-dynamic";

export default async function PaymentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const paymentOrder = await getPaymentOrderDetail(id);

  if (!paymentOrder) {
    notFound();
  }

  const canUploadSlip =
    paymentOrder.status === "pending_payment" &&
    !paymentOrder.isExpired &&
    paymentOrder.amountDue > 0 &&
    Boolean(paymentOrder.promptpayQrDataUrl);

  return (
    <MobileShell title="ชำระเงิน" subtitle={paymentOrder.tournament.title}>
      <div className="grid gap-4">
        <Link
          href={`/tournaments/${paymentOrder.tournament.id}`}
          className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-[#8c91ff] transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          กลับไปรายการแข่งขัน
        </Link>

        <section className="rounded-2xl border border-[#27345b] bg-[#101832] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[#8390bd]">Payment order</p>
              <p className="mt-1 font-semibold text-white">{shortId(paymentOrder.id)}</p>
            </div>
            <StatusBadge status={paymentOrder.status} />
          </div>

          <div className="mt-4 grid gap-2 text-sm leading-6 text-[#aab4da]">
            <SummaryLine label="ยอดก่อนส่วนลด" value={formatMoney(paymentOrder.totalFeeAmount)} />
            <SummaryLine label="ส่วนลด" value={formatMoney(paymentOrder.discountAmount)} />
            <SummaryLine label="ยอดชำระ" value={formatMoney(paymentOrder.amountDue)} emphasize />
            <SummaryLine
              label="หมดเวลา"
              value={paymentOrder.expiresAt ? formatDate(paymentOrder.expiresAt) : "-"}
            />
          </div>

          {paymentOrder.status === "pending_payment" && paymentOrder.expiresAt ? (
            <p
              className={`mt-4 rounded-xl border p-3 text-sm leading-6 ${
                paymentOrder.isExpired
                  ? "border-[#5a2030] bg-[#2a101c] text-[#ffb0bd]"
                  : "border-[#27345b] bg-[#0a1128] text-[#dce3ff]"
              }`}
            >
              {paymentOrder.isExpired
                ? "รายการนี้หมดเวลาแล้ว"
                : `เหลือเวลาโดยประมาณ ${paymentOrder.timeRemainingText ?? "-"}`}
            </p>
          ) : null}
        </section>

        {paymentOrder.status === "pending_payment" ? (
          <PromptPayPanel paymentOrder={paymentOrder} isExpired={paymentOrder.isExpired} />
        ) : (
          <PaymentStatePanel paymentOrder={paymentOrder} />
        )}

        <section className="rounded-2xl border border-[#27345b] bg-[#101832] p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <ReceiptText className="h-4 w-4 text-[#8c91ff]" aria-hidden />
            รายการสมัครที่ผูกกับการชำระเงิน
          </div>
          <div className="mt-4 grid gap-3">
            {paymentOrder.registrations.map((registration) => (
              <article key={registration.id} className="rounded-xl border border-[#27345b] bg-[#0a1128] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-white">{registration.divisionName}</p>
                    <p className="mt-1 text-xs leading-5 text-[#8390bd]">
                      {registration.playerName} · {registration.rank}
                    </p>
                  </div>
                  <RegistrationStatusBadge status={registration.status} />
                </div>
                <div className="mt-3 grid gap-1 text-xs leading-5 text-[#aab4da]">
                  <SummaryLine label="ค่าสมัคร" value={formatMoney(registration.feeAmount)} />
                  <SummaryLine label="ส่วนลด" value={formatMoney(registration.discountAmount)} />
                  <SummaryLine label="ยอดสุทธิ" value={formatMoney(registration.finalFeeAmount)} />
                </div>
              </article>
            ))}
          </div>
        </section>

        {canUploadSlip ? (
          <section className="rounded-2xl border border-[#27345b] bg-[#101832] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <CreditCard className="h-4 w-4 text-[#8c91ff]" aria-hidden />
              ส่งสลิปชำระเงิน
            </div>
            <div className="mt-4">
              <PaymentSlipUploadForm paymentOrderId={paymentOrder.id} />
            </div>
          </section>
        ) : null}
      </div>
    </MobileShell>
  );
}

function PromptPayPanel({
  isExpired,
  paymentOrder,
}: {
  isExpired: boolean;
  paymentOrder: PaymentOrderDetail;
}) {
  return (
    <section className="rounded-2xl border border-[#27345b] bg-[#101832] p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-white">
        <CreditCard className="h-4 w-4 text-[#8c91ff]" aria-hidden />
        PromptPay QR
      </div>

      {!isExpired && paymentOrder.promptpayQrDataUrl ? (
        <div className="mt-4 grid gap-4">
          <div className="mx-auto rounded-2xl bg-white p-3">
            <Image
              src={paymentOrder.promptpayQrDataUrl}
              alt="PromptPay QR code"
              width={260}
              height={260}
              unoptimized
              className="h-[260px] w-[260px]"
            />
          </div>
          <div className="grid gap-2 text-sm leading-6 text-[#aab4da]">
            <SummaryLine label="ชื่อบัญชี" value={paymentOrder.promptpayName ?? "-"} />
            <SummaryLine label="PromptPay" value={maskPromptPayId(paymentOrder.promptpayId)} />
            <SummaryLine label="ยอดชำระ" value={formatMoney(paymentOrder.amountDue)} emphasize />
          </div>
          <p className="rounded-xl border border-[#27345b] bg-[#0a1128] p-3 text-xs leading-5 text-[#8390bd]">
            กรุณาตรวจชื่อบัญชีและยอดชำระในแอปธนาคารก่อนโอน จากนั้นอัปโหลดสลิปด้านล่าง
          </p>
        </div>
      ) : isExpired ? (
        <div className="mt-4">
          <AlertPanel>รายการนี้หมดเวลาแล้ว จึงไม่สามารถสแกน QR หรือส่งสลิปใหม่ได้</AlertPanel>
        </div>
      ) : (
        <AlertPanel>
          {paymentOrder.promptpayError ?? "ยังสร้าง PromptPay QR สำหรับรายการนี้ไม่ได้"}
        </AlertPanel>
      )}
    </section>
  );
}

function PaymentStatePanel({ paymentOrder }: { paymentOrder: PaymentOrderDetail }) {
  const isPendingVerify = paymentOrder.status === "pending_verify";

  return (
    <section
      className={`rounded-2xl border p-4 ${
        isPendingVerify
          ? "border-[#1d5a4c] bg-[#09241f]"
          : "border-[#27345b] bg-[#101832]"
      }`}
    >
      <div className="flex items-center gap-2 text-sm font-semibold text-white">
        {isPendingVerify ? (
          <Clock className="h-4 w-4 text-[#42e0b3]" aria-hidden />
        ) : (
          <CheckCircle2 className="h-4 w-4 text-[#8c91ff]" aria-hidden />
        )}
        สถานะการชำระเงิน
      </div>
      <p className="mt-3 text-sm leading-6 text-[#aab4da]">{getPaymentStateText(paymentOrder.status)}</p>

      {paymentOrder.paidAt ? (
        <p className="mt-2 text-xs leading-5 text-[#8390bd]">ส่งสลิปเมื่อ {formatDate(paymentOrder.paidAt)}</p>
      ) : null}

      {paymentOrder.signedSlipUrl ? (
        <a
          href={paymentOrder.signedSlipUrl}
          target="_blank"
          rel="noreferrer"
          className={`${secondaryButtonClassName} mt-4`}
        >
          <ExternalLink className="mr-2 h-4 w-4" aria-hidden />
          เปิดสลิปที่ส่งแล้ว
        </a>
      ) : null}
    </section>
  );
}

function AlertPanel({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="flex items-start gap-2 rounded-xl border border-[#5a2030] bg-[#2a101c] p-3 text-sm leading-6 text-[#ffb0bd]">
      <AlertCircle className="mt-1 h-4 w-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

function SummaryLine({
  emphasize,
  label,
  value,
}: {
  emphasize?: boolean;
  label: string;
  value: string;
}) {
  return (
    <p className="flex items-start justify-between gap-3">
      <span>{label}</span>
      <span className={`text-right font-semibold ${emphasize ? "text-[#42e0b3]" : "text-white"}`}>
        {value}
      </span>
    </p>
  );
}

function StatusBadge({ status }: { status: PaymentOrderDetail["status"] }) {
  const className =
    status === "pending_payment"
      ? "bg-[#443013] text-[#ffc66d]"
      : status === "pending_verify"
        ? "bg-[#073d36] text-[#42e0b3]"
        : status === "confirmed"
          ? "bg-[#20255d] text-[#8c91ff]"
          : "bg-[#4a1724] text-[#ffb0bd]";

  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}>{formatPaymentStatus(status)}</span>;
}

function RegistrationStatusBadge({ status }: { status: string }) {
  const className =
    status === "pending_payment"
      ? "bg-[#443013] text-[#ffc66d]"
      : status === "pending_verify"
        ? "bg-[#073d36] text-[#42e0b3]"
        : status === "confirmed"
          ? "bg-[#20255d] text-[#8c91ff]"
          : "bg-[#4a1724] text-[#ffb0bd]";

  return <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${className}`}>{formatRegistrationStatus(status)}</span>;
}

function formatPaymentStatus(status: PaymentOrderDetail["status"]) {
  if (status === "pending_payment") {
    return "รอชำระ";
  }

  if (status === "pending_verify") {
    return "รอตรวจสอบ";
  }

  if (status === "confirmed") {
    return "ยืนยันแล้ว";
  }

  if (status === "rejected") {
    return "ไม่ผ่าน";
  }

  if (status === "expired") {
    return "หมดเวลา";
  }

  return "ยกเลิก";
}

function formatRegistrationStatus(status: string) {
  if (status === "pending_payment") {
    return "รอชำระ";
  }

  if (status === "pending_verify") {
    return "รอตรวจสอบ";
  }

  if (status === "confirmed") {
    return "ยืนยันแล้ว";
  }

  if (status === "waiting_list") {
    return "waiting list";
  }

  if (status === "expired") {
    return "หมดเวลา";
  }

  if (status === "rejected") {
    return "ไม่ผ่าน";
  }

  return "ยกเลิก";
}

function getPaymentStateText(status: PaymentOrderDetail["status"]) {
  if (status === "pending_verify") {
    return "ระบบได้รับสลิปแล้ว รอ Admin ตรวจสอบยอดและยืนยันรายการสมัคร";
  }

  if (status === "confirmed") {
    return "Admin ยืนยันการชำระเงินแล้ว รายการสมัครได้รับการยืนยัน";
  }

  if (status === "rejected") {
    return "สลิปนี้ไม่ผ่านการตรวจสอบ กรุณารอคำแนะนำจาก Admin";
  }

  if (status === "expired") {
    return "รายการชำระเงินหมดเวลาแล้ว";
  }

  return "รายการนี้ถูกยกเลิกแล้ว";
}

function formatMoney(value: number) {
  if (value === 0) {
    return "ฟรี";
  }

  return `${value.toLocaleString("th-TH", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })} บาท`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function maskPromptPayId(value: string | null) {
  if (!value) {
    return "-";
  }

  const digits = value.replace(/\D/g, "");

  if (digits.length <= 4) {
    return value;
  }

  return `${digits.slice(0, 3)}••••${digits.slice(-4)}`;
}

function shortId(value: string) {
  return value.slice(0, 8);
}
