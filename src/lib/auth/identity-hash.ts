import { createHash } from "node:crypto";

export function hashIdentityDocument(type: string, value: string): string {
  const salt = process.env.IDENTITY_HASH_SALT;

  if (!salt) {
    throw new Error("Missing IDENTITY_HASH_SALT");
  }

  const normalized = `${type}:${value.replace(/\s+/g, "").toUpperCase()}`;

  return createHash("sha256")
    .update(`${salt}:${normalized}`)
    .digest("hex");
}
