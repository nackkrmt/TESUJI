import QRCode from "qrcode";
import type { CurrentAccount } from "@/lib/auth/current-account";

export type DigitalIdQrPayload = {
  type: "TESUJI_PLAYER_ID";
  version: 1;
  profileId: string;
  nameTh: string;
  nameEn: string;
  rank: string;
  rankStatus: "verified" | "pending";
  instituteName: string | null;
  activeRole: string;
  activeRoles: string[];
  issuedAt: string;
};

export async function createDigitalIdQrDataUrl(account: CurrentAccount) {
  if (!account.profile) {
    return null;
  }

  const payload: DigitalIdQrPayload = {
    type: "TESUJI_PLAYER_ID",
    version: 1,
    profileId: account.profile.id,
    nameTh: account.profile.nameTh,
    nameEn: account.profile.nameEn,
    rank: account.profile.rank,
    rankStatus: account.profile.rankStatus,
    instituteName: account.profile.instituteName,
    activeRole: account.activeRole,
    activeRoles: account.roles
      .filter((role) => role.status === "active")
      .map((role) => role.role),
    issuedAt: new Date().toISOString(),
  };

  return QRCode.toDataURL(JSON.stringify(payload), {
    color: {
      dark: "#080d20",
      light: "#ffffff",
    },
    errorCorrectionLevel: "M",
    margin: 1,
    width: 320,
  });
}
