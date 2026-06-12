import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  BellRing,
  CheckCircle2,
  ExternalLink,
  Inbox,
  Link2,
} from "lucide-react";
import { MobileShell } from "@/components/mobile/mobile-shell";
import { getCurrentAccount } from "@/lib/auth/current-account";
import {
  getMyNotifications,
  getMyUnreadNotificationCount,
  type UserNotification,
} from "@/lib/notifications/user-notifications";
import { MarkNotificationReadButton } from "./mark-notification-read-button";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const account = await getCurrentAccount();

  if (!account) {
    redirect("/login");
  }

  const [notifications, unreadCount] = await Promise.all([
    getMyNotifications({ limit: 50 }),
    getMyUnreadNotificationCount(),
  ]);

  return (
    <MobileShell title="Notifications" subtitle="Messages sent by TESUJI Admin">
      <div className="grid gap-4">
        <Link
          href="/"
          className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-[#8c91ff] transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back home
        </Link>

        <section className="rounded-2xl border border-[#27345b] bg-[#101832] p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <BellRing className="h-4 w-4 text-[#8c91ff]" aria-hidden />
            Inbox summary
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <InfoBlock label="Unread" value={unreadCount.toLocaleString("en-US")} />
            <InfoBlock label="Shown" value={notifications.length.toLocaleString("en-US")} />
          </div>
        </section>

        {notifications.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-[#27345b] bg-[#101832] p-5">
            <div className="grid h-11 w-11 place-items-center rounded-full bg-[#17244d] text-[#8c91ff]">
              <Inbox className="h-5 w-5" aria-hidden />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-white">No notifications yet</h2>
            <p className="mt-2 text-sm leading-6 text-[#8390bd]">
              Admin messages about tournaments, registrations, or account follow-up will appear
              here.
            </p>
          </section>
        ) : (
          <section className="grid gap-3" data-testid="user-notification-list">
            {notifications.map((notification) => (
              <NotificationCard key={notification.id} notification={notification} />
            ))}
          </section>
        )}
      </div>
    </MobileShell>
  );
}

function NotificationCard({ notification }: { notification: UserNotification }) {
  const isUnread = !notification.readAt;

  return (
    <article
      data-testid="user-notification-card"
      data-notification-read={notification.readAt ? "true" : "false"}
      className={`grid gap-3 rounded-2xl border p-4 ${
        isUnread
          ? "border-[#6c72ff] bg-[#111a35] shadow-[inset_3px_0_0_#6c72ff]"
          : "border-[#27345b] bg-[#101832]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="min-w-0 break-words text-base font-semibold leading-6 text-white">
              {notification.title}
            </h2>
          </div>
          <p className="mt-1 text-xs text-[#7480aa]">{formatDate(notification.deliveredAt)}</p>
        </div>
        <StatusBadge unread={isUnread} />
      </div>

      <p className="whitespace-pre-line text-sm leading-6 text-[#dce3ff]">{notification.body}</p>

      <div className="flex flex-col gap-2 border-t border-[#27345b] pt-3">
        {notification.linkUrl ? <NotificationLink href={notification.linkUrl} /> : null}
        {isUnread ? (
          <MarkNotificationReadButton notificationId={notification.notificationId} />
        ) : (
          <p className="inline-flex items-center gap-2 text-xs font-semibold text-[#42e0b3]">
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            Read {notification.readAt ? formatDate(notification.readAt) : ""}
          </p>
        )}
      </div>
    </article>
  );
}

function NotificationLink({ href }: { href: string }) {
  const content = (
    <>
      <Link2 className="h-4 w-4" aria-hidden />
      Open link
      <ExternalLink className="h-4 w-4" aria-hidden />
    </>
  );
  const className =
    "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md bg-[#6c72ff] px-3 py-2 text-sm font-semibold text-white transition duration-200 hover:bg-[#7c82ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8c91ff]/70";

  if (/^https?:\/\//i.test(href)) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        {content}
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      {content}
    </Link>
  );
}

function StatusBadge({ unread }: { unread: boolean }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
        unread ? "bg-[#20255d] text-[#8c91ff]" : "bg-[#073d36] text-[#42e0b3]"
      }`}
    >
      {unread ? "unread" : "read"}
    </span>
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(new Date(value));
}
