"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { inputClassName } from "@/components/mobile/mobile-shell";

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "เลือก",
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = normalizedQuery
    ? options.filter((option) => option.toLowerCase().includes(normalizedQuery))
    : options;

  function select(option: string) {
    onChange(option);
    setQuery("");
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="grid gap-2">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`${inputClassName} flex items-center justify-between text-left`}
      >
        <span className={value ? "text-white" : "text-[#526087]"}>{value || placeholder}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-[#7480aa]" aria-hidden />
      </button>

      {open ? (
        <div className="rounded-md border border-[#27345b] bg-[#0c142d] p-2">
          <div className="flex items-center gap-2 rounded-md border border-[#27345b] bg-[#101832] px-2">
            <Search className="h-4 w-4 shrink-0 text-[#7480aa]" aria-hidden />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ค้นหา..."
              className="min-h-10 w-full bg-transparent text-sm text-white outline-none placeholder:text-[#526087]"
            />
          </div>
          <ul className="mt-2 max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-[#7480aa]">ไม่พบรายการ</li>
            ) : (
              filtered.map((option) => (
                <li key={option}>
                  <button
                    type="button"
                    onClick={() => select(option)}
                    className={`flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm transition hover:bg-[#17244d] ${
                      option === value ? "text-white" : "text-[#aab4da]"
                    }`}
                  >
                    {option}
                    {option === value ? (
                      <Check className="h-4 w-4 shrink-0 text-[#6c72ff]" aria-hidden />
                    ) : null}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
