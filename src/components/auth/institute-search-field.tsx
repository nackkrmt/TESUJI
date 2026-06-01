"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Search } from "lucide-react";
import { FieldLabel, inputClassName } from "@/components/mobile/mobile-shell";

type SchoolOption = {
  id: string;
  seq: string | null;
  name: string;
  keywords: string[];
  matchType: "exact" | "keyword" | "fuzzy";
  similarityScore: number;
};

type SearchState = "idle" | "loading" | "error";

export function InstituteSearchField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<SchoolOption[]>([]);
  const [searchState, setSearchState] = useState<SearchState>("idle");
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

  useEffect(() => {
    const query = value.trim();

    if (!open || !query) {
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setSearchState("loading");

      try {
        const response = await fetch(`/api/schools/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        const payload = (await response.json()) as {
          results?: SchoolOption[];
          error?: string;
        };

        if (!response.ok) {
          throw new Error(payload.error ?? "ค้นหาไม่สำเร็จ");
        }

        setResults(payload.results ?? []);
        setSearchState("idle");
      } catch {
        if (controller.signal.aborted) {
          return;
        }

        setResults([]);
        setSearchState("error");
      }
    }, 220);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [open, value]);

  function selectSchool(school: SchoolOption) {
    onChange(school.name);
    setOpen(false);
    setResults([]);
  }

  const showPanel = open && value.trim().length > 0;

  return (
    <div ref={containerRef} className="relative grid gap-2">
      <FieldLabel>
        สถาบัน<span className="font-normal text-[#526087]"> ไม่บังคับ</span>
      </FieldLabel>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7480aa]" />
        <input
          className={`${inputClassName} pl-10`}
          value={value}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            const nextValue = event.target.value;
            onChange(nextValue);
            if (!nextValue.trim()) {
              setResults([]);
              setSearchState("idle");
            }
            setOpen(true);
          }}
          placeholder="ค้นหาสถาบัน"
          autoComplete="off"
        />
      </div>

      {showPanel ? (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-md border border-[#27345b] bg-[#0c142d] shadow-xl shadow-black/30">
          {searchState === "loading" ? (
            <div className="flex items-center gap-2 px-3 py-3 text-sm text-[#aab4da]">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              กำลังค้นหา...
            </div>
          ) : searchState === "error" ? (
            <div className="px-3 py-3 text-sm text-[#ffb0bd]">ค้นหาสถาบันไม่สำเร็จ</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-3 text-sm text-[#7480aa]">ไม่พบสถาบัน</div>
          ) : (
            <ul className="max-h-60 overflow-y-auto p-1">
              {results.map((school) => (
                <li key={school.id}>
                  <button
                    type="button"
                    onClick={() => selectSchool(school)}
                    className="flex w-full items-start justify-between gap-3 rounded px-3 py-2 text-left transition hover:bg-[#17244d]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-white">
                        {school.name}
                      </span>
                      {school.keywords.length > 0 ? (
                        <span className="mt-0.5 block truncate text-xs text-[#8390bd]">
                          {school.keywords.join(", ")}
                        </span>
                      ) : null}
                    </span>
                    {school.name === value ? (
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#6c72ff]" aria-hidden />
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
