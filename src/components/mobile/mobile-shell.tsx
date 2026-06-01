import type { ReactNode } from "react";

export function MobileShell({
  children,
  title,
  subtitle,
}: {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}) {
  return (
    <main className="min-h-screen bg-[#060a1a] px-4 py-5 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-40px)] w-full max-w-[430px] flex-col overflow-hidden rounded-[28px] border border-[#202a49] bg-[#080d20] shadow-2xl shadow-black/30">
        <header className="border-b border-[#202a49] px-5 pb-5 pt-6">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 grid-cols-2 gap-1 rounded-lg bg-[#101936] p-1">
              <span className="rounded-[3px] bg-[#6c72ff]" />
              <span className="rounded-[3px] bg-[#48b8ff]" />
              <span className="rounded-[3px] bg-[#48b8ff]" />
              <span className="rounded-[3px] bg-[#6c72ff]" />
            </span>
            <div>
              <p className="text-sm font-semibold text-white">TESUJI</p>
              <p className="text-xs text-[#7480aa]">Go tournament account</p>
            </div>
          </div>
          {title ? <h1 className="mt-6 text-2xl font-semibold tracking-normal">{title}</h1> : null}
          {subtitle ? <p className="mt-2 text-sm leading-6 text-[#8390bd]">{subtitle}</p> : null}
        </header>
        <div className="flex flex-1 flex-col px-5 py-5">{children}</div>
      </div>
    </main>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="text-xs font-semibold text-[#aab4da]">{children}</label>;
}

export const inputClassName =
  "min-h-12 w-full rounded-md border border-[#27345b] bg-[#101832] px-3 py-2 text-sm text-white outline-none transition duration-200 placeholder:text-[#526087] focus:border-[#6c72ff] focus-visible:ring-2 focus-visible:ring-[#6c72ff]/60";

export const selectClassName =
  "min-h-12 w-full cursor-pointer rounded-md border border-[#27345b] bg-[#101832] px-3 py-2 text-sm text-white outline-none transition duration-200 focus:border-[#6c72ff] focus-visible:ring-2 focus-visible:ring-[#6c72ff]/60";

export const primaryButtonClassName =
  "inline-flex min-h-12 w-full cursor-pointer items-center justify-center rounded-md bg-[#6c72ff] px-4 py-3 text-sm font-semibold text-white outline-none transition duration-200 hover:bg-[#7c82ff] focus-visible:ring-2 focus-visible:ring-[#6c72ff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#080d20] active:scale-[0.99] disabled:cursor-wait disabled:opacity-60";

export const secondaryButtonClassName =
  "inline-flex min-h-12 w-full cursor-pointer items-center justify-center rounded-md border border-[#27345b] bg-[#101832] px-4 py-3 text-sm font-semibold text-[#dce3ff] outline-none transition duration-200 hover:border-[#6c72ff] hover:text-white focus-visible:ring-2 focus-visible:ring-[#6c72ff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#080d20] active:scale-[0.99] disabled:cursor-wait disabled:opacity-60";
