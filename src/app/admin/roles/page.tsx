import { Check, Clock, ShieldCheck, UserCheck, X } from "lucide-react";
import { RefereeInviteCreator } from "@/components/admin/referee-invite-creator";
import { getCoachRequests, getRefereeInvites } from "@/lib/admin/role-management";
import { reviewCoachRequest } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminRolesPage() {
  const [coachRequestResult, refereeInviteResult] = await Promise.allSettled([
    getCoachRequests(),
    getRefereeInvites(),
  ]);
  const coachRequests =
    coachRequestResult.status === "fulfilled" ? coachRequestResult.value : [];
  const refereeInvites =
    refereeInviteResult.status === "fulfilled" ? refereeInviteResult.value : [];
  const roleDataError =
    coachRequestResult.status === "rejected"
      ? getErrorMessage(coachRequestResult.reason)
      : refereeInviteResult.status === "rejected"
        ? getErrorMessage(refereeInviteResult.reason)
        : null;
  const pendingCoachRequests = coachRequests.filter((request) => request.status === "pending");

  return (
    <div className="flex w-full flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#7378ff]">Roles</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-white">
            Coach approval และ Referee invites
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#8390bd]">
            จัดการคำขอ Coach ที่สมัครเข้ามาจริง และสร้าง invite code สำหรับ Referee โดย raw code จะแสดงครั้งเดียวหลังสร้าง
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:w-fit">
          <Metric label="Coach pending" value={pendingCoachRequests.length.toLocaleString("th-TH")} />
          <Metric
            label="Unused invites"
            value={refereeInvites.filter((invite) => invite.status === "unused").length.toLocaleString("th-TH")}
          />
        </div>
      </header>

      {roleDataError ? (
        <div role="alert" className="rounded-md border border-[#4a1724] bg-[#2a1020] p-4 text-sm leading-6 text-[#ffb0bd]">
          Role-management data is not fully available yet: {roleDataError}
        </div>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[1.35fr_0.9fr]">
        <div className="rounded-lg border border-[#202a49] bg-[#101832]">
          <div className="border-b border-[#202a49] p-5">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-md bg-[#073d36] text-[#42e0b3]">
                <UserCheck className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Coach approval queue</h2>
                <p className="mt-1 text-sm text-[#8390bd]">Approve grants active coach role; reject keeps player role only.</p>
              </div>
            </div>
          </div>

          {coachRequests.length === 0 ? (
            <EmptyState text="ยังไม่มีคำขอ Coach ในระบบ" />
          ) : (
            <div className="divide-y divide-[#202a49]">
              {coachRequests.map((request) => (
                <article key={request.id} className="grid gap-4 p-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-white">
                          {request.profile?.nameTh ?? request.account?.email ?? "Unknown account"}
                        </h3>
                        <StatusBadge status={request.status} />
                      </div>
                      <p className="mt-1 text-sm text-[#aab4da]">
                        {request.profile?.nameEn ?? "-"} · {request.profile?.rank ?? "-"} ({request.profile?.rankStatus ?? "-"})
                      </p>
                      <p className="mt-1 text-xs leading-5 text-[#7480aa]">
                        {request.account?.email ?? "-"} · {request.account?.phone ?? "-"} · {formatDateTime(request.createdAt)}
                      </p>
                      {request.profile?.instituteName ? (
                        <p className="mt-1 text-xs text-[#8390bd]">{request.profile.instituteName}</p>
                      ) : null}
                    </div>

                    {request.status === "pending" ? (
                      <form action={reviewCoachRequest} className="grid gap-2 sm:grid-cols-2 lg:min-w-[260px]">
                        <input type="hidden" name="requestId" value={request.id} />
                        <input type="hidden" name="adminNote" value="" />
                        <button
                          type="submit"
                          name="decision"
                          value="approved"
                          className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-md bg-[#0f7a65] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#12977c]"
                        >
                          <Check className="h-4 w-4" aria-hidden />
                          Approve
                        </button>
                        <button
                          type="submit"
                          name="decision"
                          value="rejected"
                          className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-[#4a1724] px-3 py-2 text-sm font-semibold text-[#ffb0bd] transition hover:bg-[#2a1020]"
                        >
                          <X className="h-4 w-4" aria-hidden />
                          Reject
                        </button>
                      </form>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="grid content-start gap-5">
          <RefereeInviteCreator />

          <div className="rounded-lg border border-[#202a49] bg-[#101832]">
            <div className="border-b border-[#202a49] p-5">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-md bg-[#20255d] text-[#8c91ff]">
                  <ShieldCheck className="h-5 w-5" aria-hidden />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Recent invites</h2>
                  <p className="mt-1 text-sm text-[#8390bd]">Raw codes are not stored.</p>
                </div>
              </div>
            </div>

            {refereeInvites.length === 0 ? (
              <EmptyState text="ยังไม่มี invite code" />
            ) : (
              <div className="divide-y divide-[#202a49]">
                {refereeInvites.map((invite) => (
                  <div key={invite.id} className="grid gap-2 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <StatusBadge status={invite.status} />
                      <p className="text-xs text-[#7480aa]">{formatDateTime(invite.createdAt)}</p>
                    </div>
                    <p className="text-sm text-[#dce3ff]">Expires {formatDateTime(invite.expiresAt)}</p>
                    {invite.redeemedAccount ? (
                      <p className="text-xs text-[#8390bd]">Redeemed by {invite.redeemedAccount.email}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[#202a49] bg-[#101832] px-4 py-3">
      <p className="text-xs font-semibold text-[#8390bd]">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="grid min-h-32 place-items-center p-6 text-center text-sm text-[#7480aa]">
      {text}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "pending" || status === "unused"
      ? "bg-[#443013] text-[#ffc66d]"
      : status === "approved" || status === "redeemed"
        ? "bg-[#073d36] text-[#42e0b3]"
        : "bg-[#4a1724] text-[#ff8fa3]";

  return (
    <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>
      {status === "pending" || status === "unused" ? <Clock className="h-3.5 w-3.5" aria-hidden /> : null}
      {status}
    </span>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(new Date(value));
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    return String(error.message);
  }

  return "unknown error";
}
