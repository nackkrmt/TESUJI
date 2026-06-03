import { Database, Gauge, ShieldCheck, Trophy, type LucideIcon } from "lucide-react";

export type AdminNavItem = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

export const adminNavItems: AdminNavItem[] = [
  {
    href: "/admin",
    label: "Dashboard",
    description: "ภาพรวมระบบทั้งหมด",
    icon: Gauge,
  },
  {
    href: "/admin/database",
    label: "Database",
    description: "อัปโหลด DAN / KYU / AWARD / SCHOOL",
    icon: Database,
  },
  {
    href: "/admin/tournaments",
    label: "Tournaments",
    description: "Tournament / divisions / promo codes",
    icon: Trophy,
  },
  {
    href: "/admin/roles",
    label: "Roles",
    description: "Coach approval / Referee invites",
    icon: ShieldCheck,
  },
];
