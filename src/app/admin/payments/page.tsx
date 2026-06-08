import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  AlertCircle,
  Clock,
  CreditCard,
  ExternalLink,
  ReceiptText,
  UserRound,
} from "lucide-react";
import {
  getPendingPaymentOrders,
  type AdminPaymentOrder,
  type AdminPaymentRegistrationStatus,
} from "@/lib/admin/payments";
import { PaymentReviewControls } from "./payment-review-controls";
import { PaymentTimeoutSweepForm } from "./payment-timeout-sweep-form";

export const dynamic = "force-dynamic";

export default async function AdminPaymentsPage() {
  const result = await getPaymentsPageState();

  return (
    <div className="flex w-full flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#42e0b3]">Payment Verify</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-white">
            Admin payment queue
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#8390bd]">
            Review real PromptPay slip submissions from Supabase. Admin routes remain open in dev mode;
            mutations use the shared future auth seam.
          </p>
        </div>

        <div className="grid gap-2 rounded-lg border border-[#202a49] bg-[#101832] p-4 sm:min-w-72">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#7480aa]">Pending verify</p>
          <p className="text-3xl font-semibold text-white">{result.orders.length.toLocaleString("en-US")}</p>
          <p className="text-sm text-[#aab4da]">{formatMoney(getTotalAmountDue(result.orders))} awaiting review</p>
          <div className="mt-2 border-t border-[#202a49] pt-3">
            <PaymentTimeoutSweepForm />
          </div>
        </div>
      </header>

      {result.error ? (
        <section className="rounded-lg border border-[#443013] bg-[#1c160b] p-6">
          <p className="text-sm font-semibold text-[#ffc66d]">Migration pending</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Payment verification RPCs are not ready</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#d8c39a]">
            {result.error} Apply `202606080006_admin_payment_verification.sql` with
            `npx.cmd supabase db push --linked`, then reload this page.
          </p>
        </section>
      ) : result.orders.length > 0 ? (
        <section className="grid gap-5">
          {result.orders.map((order) => (
            <PaymentOrderCard key={order.id} order={order} />
          ))}
        </section>
      ) : (
        <section className="rounded-lg border border-dashed border-[#27345b] bg-[#101832] p-8 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#17244d] text-[#42e0b3]">
            <ReceiptText className="h-6 w-6" aria-hidden />
          </div>
          <h2 className="mt-4 text-xl font-semibold text-white">No payment slips waiting</h2>
          <p className="mt-2 text-sm leading-6 text-[#8390bd]">
            Submitted slips will appear here as soon as a payment order moves to pending_verify.
          </p>
        </section>
      )}
    </div>
  );
}

async function getPaymentsPageState() {
  try {
    return {
      error: null,
      orders: await getPendingPaymentOrders(),
    };
  } catch (error) {
    if (isSupabaseErrorCode(error, "PGRST205") || isSupabaseErrorCode(error, "42883")) {
      return {
        error: error instanceof Error ? error.message : "Remote Supabase cannot read payment queue yet.",
        orders: [],
      };
    }

    throw error;
  }
}

function PaymentOrderCard({ order }: { order: AdminPaymentOrder }) {
  return (
    <article className="rounded-lg border border-[#202a49] bg-[#101832] p-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge label="pending_verify" />
                <span className="text-xs text-[#7480aa]">Order {shortId(order.id)}</span>
                {order.submittedAt ? (
                  <span className="text-xs text-[#7480aa]">Submitted {formatDate(order.submittedAt)}</span>
                ) : null}
              </div>
              <h2 className="mt-3 text-2xl font-semibold text-white">{order.tournament.title}</h2>
              <div className="mt-4 grid gap-2 text-sm leading-6 text-[#aab4da] lg:grid-cols-2">
                <InfoLine icon={<UserRound className="h-4 w-4" aria-hidden />} label="Account" value={order.account.email} />
                <InfoLine icon={<CreditCard className="h-4 w-4" aria-hidden />} label="Phone" value={order.account.phone} />
                <InfoLine icon={<Clock className="h-4 w-4" aria-hidden />} label="Paid at" value={order.paidAt ? formatDate(order.paidAt) : "-"} />
                <InfoLine icon={<ReceiptText className="h-4 w-4" aria-hidden />} label="Due" value={formatMoney(order.amountDue)} />
              </div>
            </div>

            <div className="grid shrink-0 gap-1 rounded-md border border-[#27345b] bg-[#0a1128] p-4 text-right">
              <p className="text-xs font-semibold text-[#8390bd]">Amount due</p>
              <p className="text-2xl font-semibold text-[#42e0b3]">{formatMoney(order.amountDue)}</p>
              <p className="text-xs text-[#7480aa]">
                fee {formatMoney(order.totalFeeAmount)} / discount {formatMoney(order.discountAmount)}
              </p>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto rounded-lg border border-[#27345b]">
            <div className="grid min-w-[680px] grid-cols-[minmax(180px,1.3fr)_minmax(140px,1fr)_120px_120px] bg-[#0a1128] px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#7480aa]">
              <span>Player</span>
              <span>Division</span>
              <span>Status</span>
              <span className="text-right">Net fee</span>
            </div>
            <div className="divide-y divide-[#202a49]">
              {order.registrations.map((registration) => (
                <div
                  key={registration.id}
                  className="grid min-w-[680px] grid-cols-[minmax(180px,1.3fr)_minmax(140px,1fr)_120px_120px] gap-3 px-4 py-3 text-sm text-[#dce3ff]"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-white">{registration.playerName}</p>
                    <p className="mt-1 text-xs text-[#8390bd]">{registration.playerRank}</p>
                  </div>
                  <p className="min-w-0 truncate text-[#aab4da]">{registration.divisionName}</p>
                  <RegistrationStatusBadge status={registration.status} />
                  <p className="text-right font-semibold text-white">{formatMoney(registration.finalFeeAmount)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <PaymentReviewControls paymentOrderId={order.id} />
          </div>
        </div>

        <aside className="grid gap-3 rounded-lg border border-[#27345b] bg-[#0a1128] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">Slip preview</p>
              <p className="mt-1 text-xs text-[#8390bd]">{order.slipStoragePath ?? "No storage path"}</p>
            </div>
            {order.signedSlipUrl ? (
              <Link
                href={order.signedSlipUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md border border-[#27345b] px-3 py-2 text-sm font-semibold text-[#dce3ff] transition duration-200 hover:border-[#42e0b3] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#42e0b3]/60"
              >
                <ExternalLink className="h-4 w-4" aria-hidden />
                Open
              </Link>
            ) : null}
          </div>

          {order.signedSlipUrl ? (
            <div className="relative min-h-[420px] overflow-hidden rounded-lg border border-[#202a49] bg-[#050a18]">
              <Image
                src={order.signedSlipUrl}
                alt={`Payment slip for order ${shortId(order.id)}`}
                fill
                sizes="(min-width: 1280px) 420px, 100vw"
                unoptimized
                className="object-contain"
              />
            </div>
          ) : (
            <div className="grid min-h-[420px] place-items-center rounded-lg border border-dashed border-[#27345b] bg-[#050a18] p-6 text-center">
              <div>
                <AlertCircle className="mx-auto h-8 w-8 text-[#ffc66d]" aria-hidden />
                <p className="mt-3 text-sm font-semibold text-white">Signed URL unavailable</p>
                <p className="mt-2 text-xs leading-5 text-[#8390bd]">The slip may have been removed from Storage.</p>
              </div>
            </div>
          )}
        </aside>
      </div>
    </article>
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
      <span className="mt-1 text-[#42e0b3]">{icon}</span>
      <span className="min-w-0">
        <span className="font-semibold text-[#dce3ff]">{label}: </span>
        <span className="break-words">{value}</span>
      </span>
    </p>
  );
}

function StatusBadge({ label }: { label: string }) {
  return <span className="rounded-full bg-[#073d36] px-2.5 py-1 text-xs font-semibold text-[#42e0b3]">{label}</span>;
}

function RegistrationStatusBadge({ status }: { status: AdminPaymentRegistrationStatus }) {
  const className =
    status === "pending_verify"
      ? "bg-[#073d36] text-[#42e0b3]"
      : status === "confirmed"
        ? "bg-[#20255d] text-[#8c91ff]"
        : status === "pending_payment"
          ? "bg-[#443013] text-[#ffc66d]"
          : "bg-[#4a1724] text-[#ffb0bd]";

  return <span className={`w-fit rounded-full px-2 py-1 text-xs font-semibold ${className}`}>{status}</span>;
}

function getTotalAmountDue(orders: AdminPaymentOrder[]) {
  return orders.reduce((total, order) => total + order.amountDue, 0);
}

function formatMoney(value: number) {
  if (value === 0) {
    return "free";
  }

  return `${value.toLocaleString("th-TH", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })} THB`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function shortId(value: string) {
  return value.slice(0, 8);
}

function isSupabaseErrorCode(error: unknown, code: string) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === code
  );
}
