import type { ReactNode } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  Clock,
  CreditCard,
  ExternalLink,
  ReceiptText,
  Ticket,
  UserRound,
} from "lucide-react";
import {
  MobileShell,
  secondaryButtonClassName,
} from "@/components/mobile/mobile-shell";
import { getCurrentAccount } from "@/lib/auth/current-account";
import {
  getMyRegistrationDetail,
  type MyRegistrationDetail,
  type MyRegistrationStatus,
} from "@/lib/registrations/my-registrations";
import { CancelRegistrationForm } from "./cancel-registration-form";

export const dynamic = "force-dynamic";

export default async function MyRegistrationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const account = await getCurrentAccount();

  if (!account) {
    redirect("/login");
  }

  const { id } = await params;
  const registration = await getMyRegistrationDetail(id);

  if (!registration) {
    notFound();
  }

  return (
    <MobileShell title="Registration Detail" subtitle={registration.tournamentTitle}>
      <div className="grid gap-4">
        <Link
          href="/my-registrations"
          className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-[#8c91ff] transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          กลับรายการสมัคร
        </Link>

        <section className="rounded-2xl border border-[#27345b] bg-[#101832] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[#8390bd]">รายการสมัคร</p>
              <h2 className="mt-1 text-lg font-semibold leading-7 text-white">{registration.divisionName}</h2>
            </div>
            <StatusBadge status={registration.status} />
          </div>

          <div className="mt-4 grid gap-3 text-sm leading-6 text-[#aab4da]">
            <InfoLine
              icon={<UserRound className="h-4 w-4" aria-hidden />}
              label="ผู้เล่น"
              value={`${registration.playerName} · ${registration.playerRank}`}
            />
            <InfoLine
              icon={<CalendarDays className="h-4 w-4" aria-hidden />}
              label="วันแข่งขัน"
              value={formatEventDate(registration.eventDate, registration.eventStartsAt)}
            />
            <InfoLine
              icon={<Ticket className="h-4 w-4" aria-hidden />}
              label="สมัครเมื่อ"
              value={formatDate(registration.createdAt)}
            />
            {registration.waitingListPosition ? (
              <InfoLine
                icon={<Clock className="h-4 w-4" aria-hidden />}
                label="Waiting list"
                value={`#${registration.waitingListPosition.toLocaleString("th-TH")}`}
              />
            ) : null}
          </div>
        </section>

        <section className="rounded-2xl border border-[#27345b] bg-[#101832] p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <ReceiptText className="h-4 w-4 text-[#8c91ff]" aria-hidden />
            ค่าสมัคร
          </div>
          <div className="mt-4 grid gap-2 text-sm leading-6 text-[#aab4da]">
            <SummaryLine label="ยอดค่าสมัคร" value={formatMoney(registration.feeAmount)} />
            <SummaryLine label="ส่วนลด" value={formatMoney(registration.discountAmount)} />
            <SummaryLine label="ยอดสุทธิ" value={formatMoney(registration.finalFeeAmount)} emphasize />
          </div>
        </section>

        <PaymentPanel registration={registration} />

        {registration.cancelledAt ? (
          <section className="rounded-2xl border border-[#4a1724] bg-[#201020] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#ffb0bd]">
              <AlertCircle className="h-4 w-4" aria-hidden />
              รายการนี้ถูกยกเลิกแล้ว
            </div>
            <p className="mt-3 text-sm leading-6 text-[#ffc8d1]">
              ยกเลิกเมื่อ {formatDate(registration.cancelledAt)}
            </p>
            {registration.cancellationReason ? (
              <p className="mt-2 rounded-xl border border-[#5a2030] bg-[#2a101c] p-3 text-sm leading-6 text-[#ffb0bd]">
                {registration.cancellationReason}
              </p>
            ) : null}
          </section>
        ) : registration.canCancel ? (
          <section className="rounded-2xl border border-[#5a2030] bg-[#201020] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#ffb0bd]">
              <AlertCircle className="h-4 w-4" aria-hidden />
              ยกเลิกรายการสมัคร
            </div>
            <p className="mt-3 text-sm leading-6 text-[#ffc8d1]">
              Cancelling returns this slot immediately. If a waiting-list player is next,
              the system promotes them in the same transaction.
            </p>
            <div className="mt-4">
              <CancelRegistrationForm
                paymentOrderId={registration.paymentOrderId}
                registrationId={registration.id}
              />
            </div>
          </section>
        ) : (
          <section className="rounded-2xl border border-[#27345b] bg-[#101832] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <AlertCircle className="h-4 w-4 text-[#ffc66d]" aria-hidden />
              ยกเลิกผ่านระบบไม่ได้
            </div>
            <p className="mt-3 text-sm leading-6 text-[#8390bd]">
              {registration.cancelUnavailableReason ?? "รายการนี้ไม่เข้าเงื่อนไขการยกเลิก"}
            </p>
          </section>
        )}
      </div>
    </MobileShell>
  );
}

function PaymentPanel({ registration }: { registration: MyRegistrationDetail }) {
  if (!registration.paymentOrderId) {
    return (
      <section className="rounded-2xl border border-[#27345b] bg-[#101832] p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <CreditCard className="h-4 w-4 text-[#8c91ff]" aria-hidden />
          การชำระเงิน
        </div>
        <p className="mt-3 text-sm leading-6 text-[#aab4da]">
          {registration.finalFeeAmount === 0 ? "รายการนี้ไม่มีค่าสมัคร" : "ไม่มี payment order สำหรับรายการนี้"}
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-[#27345b] bg-[#101832] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <CreditCard className="h-4 w-4 text-[#8c91ff]" aria-hidden />
            การชำระเงิน
          </div>
          <p className="mt-2 text-xs leading-5 text-[#8390bd]">Payment order {registration.paymentOrderId.slice(0, 8)}</p>
        </div>
        <PaymentStatusBadge status={registration.paymentStatus} />
      </div>

      <div className="mt-4 grid gap-2 text-sm leading-6 text-[#aab4da]">
        <SummaryLine label="ยอดที่ต้องชำระ" value={formatMoney(registration.paymentAmountDue ?? 0)} />
        {registration.paymentExpiresAt ? (
          <SummaryLine label="หมดเวลา" value={formatDate(registration.paymentExpiresAt)} />
        ) : null}
        {registration.paymentStatus === "pending_payment" && registration.paymentTimeRemainingText ? (
          <SummaryLine
            label="เหลือเวลา"
            value={registration.isPaymentExpired ? "หมดเวลาแล้ว" : registration.paymentTimeRemainingText}
          />
        ) : null}
        {registration.paymentPaidAt ? (
          <SummaryLine label="ส่งสลิปเมื่อ" value={formatDate(registration.paymentPaidAt)} />
        ) : null}
      </div>

      <div className="mt-4 grid gap-3">
        <Link href={`/payments/${registration.paymentOrderId}`} className={secondaryButtonClassName}>
          เปิดหน้าชำระเงิน
        </Link>
        {registration.signedSlipUrl ? (
          <a
            href={registration.signedSlipUrl}
            target="_blank"
            rel="noreferrer"
            className={secondaryButtonClassName}
          >
            <ExternalLink className="mr-2 h-4 w-4" aria-hidden />
            เปิดสลิปที่ส่งแล้ว
          </a>
        ) : null}
      </div>
    </section>
  );
}

function InfoLine({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <p className="flex items-start gap-2">
      <span className="mt-1 text-[#8c91ff]">{icon}</span>
      <span>
        <span className="font-semibold text-[#dce3ff]">{label}: </span>
        {value}
      </span>
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

function StatusBadge({ status }: { status: MyRegistrationStatus }) {
  const className =
    status === "pending_payment"
      ? "bg-[#443013] text-[#ffc66d]"
      : status === "pending_verify"
        ? "bg-[#073d36] text-[#42e0b3]"
        : status === "confirmed"
          ? "bg-[#20255d] text-[#8c91ff]"
          : status === "waiting_list"
            ? "bg-[#3b2450] text-[#d7b7ff]"
            : "bg-[#4a1724] text-[#ffb0bd]";

  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}>{formatRegistrationStatus(status)}</span>;
}

function PaymentStatusBadge({ status }: { status: MyRegistrationDetail["paymentStatus"] }) {
  if (!status) {
    return <span className="shrink-0 rounded-full bg-[#27345b] px-2.5 py-1 text-xs font-semibold text-[#aab4da]">-</span>;
  }

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

function formatRegistrationStatus(status: MyRegistrationStatus) {
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

function formatPaymentStatus(status: NonNullable<MyRegistrationDetail["paymentStatus"]>) {
  if (status === "pending_payment") {
    return "รอชำระ";
  }

  if (status === "pending_verify") {
    return "รอตรวจสอบ";
  }

  if (status === "confirmed") {
    return "ยืนยันแล้ว";
  }

  if (status === "expired") {
    return "หมดเวลา";
  }

  if (status === "rejected") {
    return "ไม่ผ่าน";
  }

  return "ยกเลิก";
}

function formatEventDate(eventDate: string | null, eventStartsAt: string | null) {
  const value = eventDate ? `${eventDate}T00:00:00.000Z` : eventStartsAt;

  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
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
