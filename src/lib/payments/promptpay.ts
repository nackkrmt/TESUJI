import QRCode from "qrcode";

type PromptPayPayloadInput = {
  amount: number;
  merchantName?: string | null;
  promptpayId: string;
};

const promptPayAid = "A000000677010111";
const thailandCurrencyCode = "764";

export function createPromptPayPayload({
  amount,
  merchantName,
  promptpayId,
}: PromptPayPayloadInput) {
  const normalizedIdentifier = normalizePromptPayIdentifier(promptpayId);
  const merchantAccount = tlv("00", promptPayAid) + tlv(normalizedIdentifier.tag, normalizedIdentifier.value);
  const payloadWithoutCrc = [
    tlv("00", "01"),
    tlv("01", "12"),
    tlv("29", merchantAccount),
    tlv("52", "0000"),
    tlv("53", thailandCurrencyCode),
    tlv("54", formatPromptPayAmount(amount)),
    tlv("58", "TH"),
    tlv("59", sanitizeMerchantName(merchantName)),
    tlv("60", "BANGKOK"),
  ].join("");
  const payloadForChecksum = `${payloadWithoutCrc}6304`;

  return `${payloadForChecksum}${crc16CcittFalse(payloadForChecksum)}`;
}

export async function createPromptPayQrDataUrl(payload: string) {
  return QRCode.toDataURL(payload, {
    color: {
      dark: "#050711",
      light: "#ffffff",
    },
    errorCorrectionLevel: "M",
    margin: 1,
    type: "image/png",
    width: 260,
  });
}

function tlv(tag: string, value: string) {
  if (!/^\d{2}$/.test(tag)) {
    throw new Error("Invalid PromptPay tag.");
  }

  if (value.length > 99) {
    throw new Error("PromptPay QR field is too long.");
  }

  return `${tag}${value.length.toString().padStart(2, "0")}${value}`;
}

function normalizePromptPayIdentifier(value: string) {
  const digits = value.replace(/\D/g, "");

  if (digits.length === 10 && digits.startsWith("0")) {
    return {
      tag: "01",
      value: `0066${digits.slice(1)}`,
    };
  }

  if (digits.length === 11 && digits.startsWith("66")) {
    return {
      tag: "01",
      value: `0066${digits.slice(2)}`,
    };
  }

  if (digits.length === 13 && digits.startsWith("0066")) {
    return {
      tag: "01",
      value: digits,
    };
  }

  if (digits.length === 13) {
    return {
      tag: "02",
      value: digits,
    };
  }

  if (digits.length === 15) {
    return {
      tag: "03",
      value: digits,
    };
  }

  throw new Error("PromptPay ID must be a Thai phone number, 13-digit ID, or 15-digit e-wallet ID.");
}

function formatPromptPayAmount(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("PromptPay amount must be greater than zero.");
  }

  const normalized = (Math.round(amount * 100) / 100).toFixed(2);

  if (normalized.length > 13) {
    throw new Error("PromptPay amount is too large.");
  }

  return normalized;
}

function sanitizeMerchantName(value?: string | null) {
  const normalized = (value ?? "TESUJI")
    .normalize("NFKD")
    .replace(/[^\x20-\x7e]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
    .slice(0, 25);

  return normalized || "TESUJI";
}

function crc16CcittFalse(value: string) {
  let crc = 0xffff;

  for (let index = 0; index < value.length; index += 1) {
    crc ^= value.charCodeAt(index) << 8;

    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) !== 0 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, "0");
}
