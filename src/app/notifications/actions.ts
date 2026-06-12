"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { markMyNotificationRead } from "@/lib/notifications/user-notifications";

export type MarkNotificationReadState = {
  message: string;
  status: "idle" | "success" | "error";
};

const markReadSchema = z.object({
  notificationId: z.string().uuid(),
});

export async function markNotificationReadAction(
  _previousState: MarkNotificationReadState,
  formData: FormData,
): Promise<MarkNotificationReadState> {
  const parsed = markReadSchema.safeParse({
    notificationId: formData.get("notificationId"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Notification id is invalid.",
    };
  }

  try {
    await markMyNotificationRead({ notificationId: parsed.data.notificationId });

    revalidatePath("/");
    revalidatePath("/profile");
    revalidatePath("/notifications");

    return {
      status: "success",
      message: "Marked as read.",
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Mark read failed.",
    };
  }
}
