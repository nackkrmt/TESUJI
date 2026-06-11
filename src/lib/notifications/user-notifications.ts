import { z } from "zod";
import { createSupabaseServerComponentClient } from "@/lib/supabase/server";

export type UserNotification = {
  body: string;
  deliveredAt: string;
  id: string;
  linkUrl: string | null;
  notificationId: string;
  readAt: string | null;
  title: string;
};

export type MarkUserNotificationReadResult = {
  id: string;
  notificationId: string;
  readAt: string;
};

type UserNotificationSupabaseClient = Awaited<ReturnType<typeof createSupabaseServerComponentClient>>;

type UserNotificationRow = {
  delivered_at: string;
  id: string;
  notification: NotificationRelation | NotificationRelation[] | null;
  notification_id: string;
  read_at: string | null;
};

type NotificationRelation = {
  body: string;
  id: string;
  link_url: string | null;
  title: string;
};

type MarkReadRow = {
  id: string;
  notification_id: string;
  read_at: string | null;
};

const listInputSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  unreadOnly: z.boolean().optional().default(false),
});

const markReadInputSchema = z.object({
  notificationId: z.string().uuid(),
});

export async function getMyNotifications(input: {
  client?: UserNotificationSupabaseClient;
  limit?: number;
  unreadOnly?: boolean;
} = {}): Promise<UserNotification[]> {
  const parsed = listInputSchema.parse(input);
  const supabase = input.client ?? await createSupabaseServerComponentClient();
  let query = supabase
    .from("manual_notification_recipients")
    .select(
      "id,notification_id,delivered_at,read_at,notification:manual_notifications(id,title,body,link_url)",
    )
    .order("delivered_at", { ascending: false })
    .limit(parsed.limit);

  if (parsed.unreadOnly) {
    query = query.is("read_at", null);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return ((data ?? []) as unknown as UserNotificationRow[])
    .map(mapUserNotification)
    .filter((notification): notification is UserNotification => Boolean(notification));
}

export async function getMyUnreadNotificationCount(input: {
  client?: UserNotificationSupabaseClient;
} = {}): Promise<number> {
  const supabase = input.client ?? await createSupabaseServerComponentClient();
  const { count, error } = await supabase
    .from("manual_notification_recipients")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

export async function markMyNotificationRead(input: {
  client?: UserNotificationSupabaseClient;
  notificationId: string;
}): Promise<MarkUserNotificationReadResult> {
  const parsed = markReadInputSchema.parse(input);
  const supabase = input.client ?? await createSupabaseServerComponentClient();
  const { data, error } = await supabase
    .from("manual_notification_recipients")
    .update({ read_at: new Date().toISOString() })
    .eq("notification_id", parsed.notificationId)
    .select("id,notification_id,read_at")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Notification not found.");
  }

  const row = data as MarkReadRow;

  if (!row.read_at) {
    throw new Error("Notification read state was not updated.");
  }

  return {
    id: row.id,
    notificationId: row.notification_id,
    readAt: row.read_at,
  };
}

function mapUserNotification(row: UserNotificationRow): UserNotification | null {
  const notification = firstRelation(row.notification);

  if (!notification) {
    return null;
  }

  return {
    body: notification.body,
    deliveredAt: row.delivered_at,
    id: row.id,
    linkUrl: notification.link_url,
    notificationId: row.notification_id,
    readAt: row.read_at,
    title: notification.title,
  };
}

function firstRelation<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}
