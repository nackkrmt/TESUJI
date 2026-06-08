"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createRegistrationTransaction,
  type RegistrationTransactionResult,
} from "@/lib/registrations/transaction";

export type RegistrationActionState = {
  status: "idle" | "success" | "error";
  message: string;
  result: RegistrationTransactionResult | null;
};

const registrationFormSchema = z.object({
  tournamentId: z.string().uuid(),
  playerProfileId: z.string().uuid(),
  divisionIds: z.array(z.string().uuid()).min(1, "กรุณาเลือกรุ่นอย่างน้อย 1 รุ่น").max(10),
  promoCode: z
    .string()
    .trim()
    .max(64, "Promo code ยาวเกินไป")
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
});

export async function submitTournamentRegistration(
  _previousState: RegistrationActionState,
  formData: FormData,
): Promise<RegistrationActionState> {
  const parsed = registrationFormSchema.safeParse({
    tournamentId: formData.get("tournamentId"),
    playerProfileId: formData.get("playerProfileId"),
    divisionIds: formData
      .getAll("divisionIds")
      .filter((value): value is string => typeof value === "string"),
    promoCode: formData.get("promoCode"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "ข้อมูลสมัครไม่ถูกต้อง",
      result: null,
    };
  }

  try {
    const result = await createRegistrationTransaction({
      tournamentId: parsed.data.tournamentId,
      playerProfileId: parsed.data.playerProfileId,
      divisionIds: parsed.data.divisionIds,
      promoCode: parsed.data.promoCode,
    });

    revalidatePath("/tournaments");
    revalidatePath(`/tournaments/${parsed.data.tournamentId}`);
    revalidatePath(`/tournaments/${parsed.data.tournamentId}/register`);

    return {
      status: "success",
      message: getSuccessMessage(result),
      result,
    };
  } catch (error) {
    return {
      status: "error",
      message: toFriendlyRegistrationError(error),
      result: null,
    };
  }
}

function getSuccessMessage(result: RegistrationTransactionResult) {
  if (result.status === "pending_payment") {
    return "สมัครสำเร็จและสร้างรายการชำระเงินแล้ว";
  }

  if (result.status === "waiting_list") {
    return "สมัครเข้าคิว waiting list แล้ว";
  }

  if (result.status === "mixed") {
    return "สมัครสำเร็จ บางรุ่นรอชำระเงินหรืออยู่ใน waiting list";
  }

  return "สมัครสำเร็จและยืนยันรายการแล้ว";
}

function toFriendlyRegistrationError(error: unknown) {
  const message = error instanceof Error ? error.message : "สมัครไม่สำเร็จ";
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("log in") || message.includes("เข้าสู่ระบบ")) {
    return "กรุณาเข้าสู่ระบบก่อนสมัครแข่งขัน";
  }

  if (lowerMessage.includes("not open") || lowerMessage.includes("not opened")) {
    return "รายการนี้ยังไม่เปิดรับสมัคร";
  }

  if (lowerMessage.includes("already closed")) {
    return "รายการนี้ปิดรับสมัครแล้ว";
  }

  if (lowerMessage.includes("already has an active registration")) {
    return "ผู้เล่นคนนี้สมัครรุ่นที่เลือกไว้แล้ว";
  }

  if (lowerMessage.includes("time-slot conflict")) {
    return "รุ่นที่เลือกมีเวลาชนกัน";
  }

  if (lowerMessage.includes("below the division minimum")) {
    return "ผู้เล่นยังไม่เข้าเงื่อนไขขั้นต่ำของรุ่นนี้";
  }

  if (lowerMessage.includes("above the division maximum")) {
    return "ผู้เล่นเกินเงื่อนไขสูงสุดของรุ่นนี้";
  }

  if (lowerMessage.includes("promo code")) {
    return "Promo code นี้ใช้ไม่ได้กับรายการที่เลือก";
  }

  if (lowerMessage.includes("cannot register this player")) {
    return "บัญชีนี้ไม่มีสิทธิ์สมัครให้ผู้เล่นคนนี้";
  }

  return message;
}
