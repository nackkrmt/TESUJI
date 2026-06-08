import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  Clock,
  CreditCard,
  ListChecks,
  Ticket,
} from "lucide-react";
import {
  MobileShell,
  primaryButtonClassName,
} from "@/components/mobile/mobile-shell";
import {
  getMyRegistrations,
  type MyRegistrationSummary,
  type MyRegistrationStatus,
} from "@/lib/registrations/my-registrations";

export const dynamic = "force-dynamic";

export default async function MyRegistrationsPage() {
  const registrations = await getMyRegistrations();

  if (!registrations) {
    redirect("/login");
  }

  const activeRegistrations = registrations.filter((registration) =>
    !["cancelled", "expired", "rejected"].includes(registration.status),
  );
  const inactiveRegistrations = registrations.filter((registration) =>
    ["cancelled", "expired", "rejected"].includes(registration.status),
  );

  return (
    <MobileShell title="My Registrations" subtitle="รายการสมัครแข่งขันของคุณและผู้เล่นที่ Coach link แล้ว">
      <div className="grid gap-4">
        <Link
          href="/"
          className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-[#8c91ff] transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          กลับหน้าหลัก
        </Link>

        <section className="rounded-2xl border border-[#27345b] bg-[#101832] p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <ListChecks className="h-4 w-4 text-[#8c91ff]" aria-hidden />
            สรุปรายการสมัคร
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <InfoBlock label="Active" value={activeRegistrations.length.toLocaleString("th-TH")} />
            <InfoBlock label="History" value={inactiveRegistrations.length.toLocaleString("th-TH")} />
          </div>
        </section>

        {registrations.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-[#27345b] bg-[#101832] p-5">
            <div className="grid h-11 w-11 place-items-center rounded-full bg-[#17244d] text-[#8c91ff]">
              <Ticket className="h-5 w-5" aria-hidden />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-white">ยังไม่มีรายการสมัคร</h2>
            <p className="mt-2 text-sm leading-6 text-[#8390bd]">
              เมื่อสมัครแข่งขันแล้ว รายการจะมาแสดงที่นี่พร้อมสถานะชำระเงินและการยกเลิก
            </p>
            <Link href="/tournaments" className={`mt-5 ${primaryButtonClassName}`}>
              ดูรายการแข่งขัน
            </Link>
          </section>
        ) : (
          <>
            <RegistrationSection title="กำลังดำเนินการ" registrations={activeRegistrations} />
            <RegistrationSection title="ประวัติ" registrations={inactiveRegistrations} />
          </>
        )}
      </div>
    </MobileShell>
  );
}

function RegistrationSection({
  registrations,
  title,
}: {
  registrations: MyRegistrationSummary[];
  title: string;
}) {
  if (registrations.length === 0) {
    return null;
  }

  return (
    <section className="grid gap-3">
      <h2 className="text-sm font-semibold text-[#aab4da]">{title}</h2>
      {registrations.map((registration) => (
        <RegistrationCard key={registration.id} registration={registration} />
      ))}
    </section>
  );
}

function RegistrationCard({ registration }: { registration: MyRegistrationSummary }) {
  return (
    <Link
      href={`/my-registrations/${registration.id}`}
      className="grid gap-3 rounded-2xl border border-[#27345b] bg-[#101832] p-4 transition hover:border-[#6c72ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6c72ff]/60"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold leading-6 text-white">{registration.tournamentTitle}</p>
          <p className="mt-1 text-xs leading-5 text-[#8390bd]">{registration.divisionName}</p>
        </div>
        <StatusBadge status={registration.status} />
      </div>

      <div className="grid gap-2 text-xs leading-5 text-[#aab4da]">
        <InfoLine
          icon={<Ticket className="h-4 w-4" aria-hidden />}
          label="ผู้เล่น"
          value={`${registration.playerName} · ${registration.playerRank}`}
        />
        <InfoLine
          icon={<CalendarDays className="h-4 w-4" aria-hidden />}
          label="แข่ง"
          value={formatEventDate(registration.eventDate, registration.eventStartsAt)}
        />
        <InfoLine
          icon={<CreditCard className="h-4 w-4" aria-hidden />}
          label="ชำระเงิน"
          value={formatPaymentSummary(registration)}
        />
        {registration.waitingListPosition ? (
          <InfoLine
            icon={<Clock className="h-4 w-4" aria-hidden />}
            label="Waiting list"
            value={`#${registration.waitingListPosition.toLocaleString("th-TH")}`}
          />
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-[#27345b] pt-3 text-sm">
        <span className="font-semibold text-white">{formatMoney(registration.finalFeeAmount)}</span>
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#8c91ff]">
          รายละเอียด
          <ChevronRight className="h-4 w-4" aria-hidden />
        </span>
      </div>
    </Link>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#27345b] bg-[#0a1128] p-3">
      <p className="text-xs text-[#7480aa]">{label}</p>
      <p className="mt-1 font-semibold text-white">{value}</p>
    </div>
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
      <span className="mt-0.5 text-[#8c91ff]">{icon}</span>
      <span>
        <span className="font-semibold text-[#dce3ff]">{label}: </span>
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

  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}>
      {formatRegistrationStatus(status)}
    </span>
  );
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

function formatPaymentSummary(registration: MyRegistrationSummary) {
  if (!registration.paymentOrderId) {
    return registration.finalFeeAmount === 0 ? "ไม่ต้องชำระ" : "-";
  }

  if (registration.paymentStatus === "pending_payment") {
    return `รอชำระ ${formatMoney(registration.paymentAmountDue ?? 0)}`;
  }

  if (registration.paymentStatus === "pending_verify") {
    return "รอตรวจสอบสลิป";
  }

  if (registration.paymentStatus === "confirmed") {
    return "ยืนยันแล้ว";
  }

  if (registration.paymentStatus === "expired") {
    return "หมดเวลา";
  }

  if (registration.paymentStatus === "cancelled") {
    return "ยกเลิก";
  }

  return registration.paymentStatus ?? "-";
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

function formatMoney(value: number) {
  if (value === 0) {
    return "ฟรี";
  }

  return `${value.toLocaleString("th-TH", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })} บาท`;
}
