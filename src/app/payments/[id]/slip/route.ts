import { type NextRequest, NextResponse } from "next/server";
import { submitPaymentSlip } from "@/lib/registrations/payment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const formData = await request.formData();
    const result = await submitPaymentSlip({
      paymentOrderId: id,
      slipFile: formData.get("slip"),
    });

    return NextResponse.json({
      ok: true,
      result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: getPaymentSlipErrorMessage(error),
      },
      { status: 400 },
    );
  }
}

function getPaymentSlipErrorMessage(error: unknown) {
  if (error instanceof Error) {
    const lowerMessage = error.message.toLowerCase();

    if (lowerMessage.includes("log in")) {
      return "กรุณาเข้าสู่ระบบก่อนอัปโหลดสลิป";
    }

    if (lowerMessage.includes("not found")) {
      return "ไม่พบรายการชำระเงินนี้";
    }

    if (lowerMessage.includes("cannot update")) {
      return "บัญชีนี้ไม่มีสิทธิ์อัปโหลดสลิปให้รายการนี้";
    }

    if (lowerMessage.includes("not pending payment")) {
      return "รายการนี้ไม่ได้อยู่ในสถานะรอชำระเงิน";
    }

    if (lowerMessage.includes("expired")) {
      return "รายการชำระเงินนี้หมดเวลาแล้ว";
    }

    if (lowerMessage.includes("jpg") || lowerMessage.includes("png")) {
      return "สลิปต้องเป็นไฟล์ JPG หรือ PNG เท่านั้น";
    }

    if (lowerMessage.includes("10mb")) {
      return "สลิปต้องมีขนาดไม่เกิน 10MB";
    }

    return error.message;
  }

  return "อัปโหลดสลิปไม่สำเร็จ";
}
