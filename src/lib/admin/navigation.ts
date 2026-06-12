import {
  BadgeCheck,
  BellRing,
  ClipboardList,
  CreditCard,
  Database,
  Gauge,
  ShieldCheck,
  Trophy,
  UserCog,
  type LucideIcon,
} from "lucide-react";

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
    href: "/admin/payments",
    label: "Payments",
    description: "PromptPay slip verification",
    icon: CreditCard,
  },
  {
    href: "/admin/registrations",
    label: "Registrations",
    description: "Lists / CSV exports",
    icon: ClipboardList,
  },
  {
    href: "/admin/ranks",
    label: "Ranks",
    description: "Pending rank approval",
    icon: BadgeCheck,
  },
  {
    href: "/admin/users",
    label: "Users",
    description: "Accounts / profiles / roles",
    icon: UserCog,
  },
  {
    href: "/admin/notifications",
    label: "Notifications",
    description: "Manual sends / user inbox",
    icon: BellRing,
  },
  {
    href: "/admin/roles",
    label: "Roles",
    description: "Coach approval / Referee invites",
    icon: ShieldCheck,
  },
];
