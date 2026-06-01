"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { adminNavItems } from "@/lib/admin/navigation";

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full min-h-screen w-full flex-col border-r border-[#202a49] bg-[#080d20] text-[#aab4da]">
      <div className="px-6 pb-6 pt-8">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="flex min-w-0 items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 grid-cols-2 gap-1 rounded-lg bg-[#101936] p-1">
              <span className="rounded-[3px] bg-[#6c72ff]" />
              <span className="rounded-[3px] bg-[#48b8ff]" />
              <span className="rounded-[3px] bg-[#48b8ff]" />
              <span className="rounded-[3px] bg-[#6c72ff]" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-lg font-semibold text-white">TESUJI</span>
              <span className="block truncate text-xs text-[#7480aa]">Admin console</span>
            </span>
          </Link>
        </div>

        <div className="mt-8 flex items-center gap-3 rounded-md border border-[#202a49] bg-[#111832] px-4 py-3 text-sm text-[#7480aa]">
          <Search className="h-4 w-4 shrink-0" aria-hidden />
          <span>Admin tools</span>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-2 overflow-y-auto px-4">
        {adminNavItems.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/admin" ? pathname === item.href : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group relative flex items-center gap-3 rounded-md px-4 py-3 transition ${
                active
                  ? "bg-[#27335c] text-white shadow-[inset_3px_0_0_#6c72ff]"
                  : "text-[#aab4da] hover:bg-[#111a35] hover:text-white"
              }`}
            >
              <Icon
                className={`h-5 w-5 shrink-0 ${active ? "text-[#7378ff]" : "text-[#8390bd]"}`}
                aria-hidden
              />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{item.label}</span>
                <span className="mt-0.5 block truncate text-xs text-current/65">
                  {item.description}
                </span>
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-6 border-t border-[#202a49] p-5">
        <div className="flex items-center gap-3 rounded-md bg-[#0d1530] p-3">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-[#6c72ff] text-sm font-semibold text-white">
            A
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">Admin</p>
            <p className="truncate text-xs text-[#7480aa]">Owner access</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

export function AdminMobileNav() {
  const pathname = usePathname();

  return (
    <div className="border-b border-[#202a49] bg-[#080d20] px-4 py-3 lg:hidden">
      <div className="mb-3 flex items-center justify-between">
        <Link href="/admin" className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm bg-[#6c72ff]" />
          <span className="text-sm font-semibold text-white">TESUJI Admin</span>
        </Link>
      </div>
      <nav className="flex gap-2 overflow-x-auto">
        {adminNavItems.map((item) => {
          const active =
            item.href === "/admin" ? pathname === item.href : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`shrink-0 rounded-md px-3 py-2 text-sm font-medium ${
                active ? "bg-[#27335c] text-white" : "bg-[#111832] text-[#aab4da]"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
