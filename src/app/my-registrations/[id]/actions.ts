"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { cancelMyRegistration } from "@/lib/registrations/my-registrations";

export type CancelRegistrationActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

const cancelRegistrationFormSchema = z.object({
  registrationId: z.string().uuid(),
  reason: z
    .string()
    .trim()
    .min(1, "Cancellation reason is required.")
    .max(500, "Reason must be 500 characters or fewer."),
  paymentOrderId: z.string().uuid().nullable().optional(),
});

export async function cancelRegistrationAction(
  _previousState: CancelRegistrationActionState,
  formData: FormData,
): Promise<CancelRegistrationActionState> {
  const rawPaymentOrderId = formData.get("paymentOrderId");
  const parsed = cancelRegistrationFormSchema.safeParse({
    registrationId: formData.get("registrationId"),
    reason: formData.get("reason"),
    paymentOrderId: typeof rawPaymentOrderId === "string" && rawPaymentOrderId ? rawPaymentOrderId : null,
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Cancellation data is invalid.",
    };
  }

  try {
    const result = await cancelMyRegistration({
      registrationId: parsed.data.registrationId,
      reason: parsed.data.reason,
    });

    revalidatePath("/my-registrations");
    revalidatePath(`/my-registrations/${parsed.data.registrationId}`);

    if (parsed.data.paymentOrderId) {
      revalidatePath(`/payments/${parsed.data.paymentOrderId}`);
    }

    if (result.waitingListPromotion?.paymentOrderId) {
      revalidatePath(`/payments/${result.waitingListPromotion.paymentOrderId}`);
    }

    return {
      status: "success",
      message: result.waitingListPromotion?.promoted
        ? "Cancelled. The oldest waiting-list registration was promoted."
        : "Cancelled. No waiting-list promotion was needed.",
    };
  } catch (error) {
    return {
      status: "error",
      message: toFriendlyCancelError(error),
    };
  }
}

function toFriendlyCancelError(error: unknown) {
  const message = error instanceof Error ? error.message : "Cancellation failed.";
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("log in")) {
    return "Please log in before cancelling a registration.";
  }

  if (lowerMessage.includes("not found")) {
    return "Registration not found.";
  }

  if (lowerMessage.includes("cannot cancel this registration")) {
    return "This account cannot cancel that registration.";
  }

  if (lowerMessage.includes("under verification")) {
    return "This registration is under payment verification. Please wait for Admin review or contact Admin.";
  }

  if (lowerMessage.includes("event date")) {
    return "Registration cannot be cancelled on or after the event date.";
  }

  if (lowerMessage.includes("inactive")) {
    return "This registration is already inactive.";
  }

  return message;
}
