import type { ReactNode } from "react";
import { AdminMobileNav, AdminSidebar } from "@/components/admin/admin-sidebar";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#060a1a] text-white">
      <div className="mx-auto min-h-screen w-full max-w-[1800px] lg:grid lg:grid-cols-[300px_1fr]">
        <div className="hidden lg:block">
          <AdminSidebar />
        </div>
        <div className="min-w-0 bg-[#080d20]">
          <AdminMobileNav />
          <main className="min-h-screen min-w-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
