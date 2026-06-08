"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { reviewPaymentOrder, runPaymentTimeoutLifecycle } from "@/lib/admin/payments";

export type PaymentReviewActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export type PaymentTimeoutActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

const paymentReviewFormSchema = z
  .object({
    action: z.enum(["approve", "reject_send_new", "reject_cancel"]),
    paymentOrderId: z.string().uuid(),
    reason: z.string().trim().max(500, "Reason must be 500 characters or fewer.").optional(),
  })
  .superRefine((value, context) => {
    if (value.action !== "approve" && !value.reason) {
      context.addIssue({
        code: "custom",
        message: "Reason is required for rejection.",
        path: ["reason"],
      });
    }
  });

export async function reviewPaymentAction(
  _previousState: PaymentReviewActionState,
  formData: FormData,
): Promise<PaymentReviewActionState> {
  const parsed = paymentReviewFormSchema.safeParse({
    action: formData.get("action"),
    paymentOrderId: formData.get("paymentOrderId"),
    reason: cleanOptionalText(formData.get("reason")),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Payment review data is invalid.",
    };
  }

  try {
    const result = await reviewPaymentOrder(parsed.data);

    revalidatePath("/admin");
    revalidatePath("/admin/payments");
    revalidatePath(`/payments/${result.paymentOrderId}`);
    revalidatePath("/my-registrations");
    for (const promotion of result.promotions) {
      if (promotion.paymentOrderId) {
        revalidatePath(`/payments/${promotion.paymentOrderId}`);
      }
    }

    return {
      status: "success",
      message: getSuccessMessage(
        parsed.data.action,
        result.updatedRegistrations,
        result.promotedRegistrations,
      ),
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Payment review failed.",
    };
  }
}

export async function runPaymentTimeoutAction(
  _previousState: PaymentTimeoutActionState,
  _formData: FormData,
): Promise<PaymentTimeoutActionState> {
  void _previousState;
  void _formData;

  try {
    const result = await runPaymentTimeoutLifecycle({ limit: 100 });

    revalidatePath("/admin");
    revalidatePath("/admin/payments");
    revalidatePath("/my-registrations");
    for (const promotion of result.promotions) {
      if (promotion.paymentOrderId) {
        revalidatePath(`/payments/${promotion.paymentOrderId}`);
      }
    }

    const expiredOrderText = `${result.expiredPaymentOrders.toLocaleString("en-US")} expired order${
      result.expiredPaymentOrders === 1 ? "" : "s"
    }`;
    const expiredRegistrationText = `${result.expiredRegistrations.toLocaleString("en-US")} registration${
      result.expiredRegistrations === 1 ? "" : "s"
    }`;
    const promotedText = `${result.promotedRegistrations.toLocaleString("en-US")} promotion${
      result.promotedRegistrations === 1 ? "" : "s"
    }`;

    return {
      status: "success",
      message: `Timeout sweep complete: ${expiredOrderText}, ${expiredRegistrationText}, ${promotedText}.`,
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Payment timeout sweep failed.",
    };
  }
}

function cleanOptionalText(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return undefined;
  }

  const cleaned = value.trim();
  return cleaned.length > 0 ? cleaned : undefined;
}

function getSuccessMessage(
  action: "approve" | "reject_send_new" | "reject_cancel",
  count: number,
  promotedCount: number,
) {
  const registrationText = `${count.toLocaleString("en-US")} registration${count === 1 ? "" : "s"}`;
  const promotionText = `${promotedCount.toLocaleString("en-US")} waiting-list promotion${
    promotedCount === 1 ? "" : "s"
  }`;

  if (action === "approve") {
    return `Payment approved. Confirmed ${registrationText}.`;
  }

  if (action === "reject_send_new") {
    return `Payment rejected. Returned ${registrationText} to pending payment.`;
  }

  return `Payment rejected and cancelled. Cancelled ${registrationText}; completed ${promotionText}.`;
}
