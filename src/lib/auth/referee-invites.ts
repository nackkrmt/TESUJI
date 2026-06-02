import { createHash, randomBytes } from "node:crypto";

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateRefereeInviteCode() {
  const bytes = randomBytes(10);
  const chars = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]);

  return `REF-${chars.slice(0, 4).join("")}-${chars.slice(4, 8).join("")}-${chars.slice(8, 10).join("")}`;
}

export function hashRefereeInviteCode(code: string) {
  const salt = process.env.IDENTITY_HASH_SALT;

  if (!salt) {
    throw new Error("Missing IDENTITY_HASH_SALT");
  }

  const normalized = normalizeRefereeInviteCode(code);

  return createHash("sha256").update(`${salt}:referee-invite:${normalized}`).digest("hex");
}

export function normalizeRefereeInviteCode(code: string) {
  return code.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}
