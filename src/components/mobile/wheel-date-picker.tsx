"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import {
  inputClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
} from "@/components/mobile/mobile-shell";

const ITEM_HEIGHT = 40;
const VISIBLE_ROWS = 5; // odd, so one row sits in the center band
const PAD = ((VISIBLE_ROWS - 1) / 2) * ITEM_HEIGHT;

const thaiMonths = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];

function pad2(value: number): string {
  return value < 10 ? `0${value}` : `${value}`;
}

// Days in a 1-based month of a given Gregorian year.
function daysInMonth(year: number, month1: number): number {
  return new Date(year, month1, 0).getDate();
}

function parseDate(value: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

function formatDisplay(value: string): string {
  const parsed = parseDate(value);
  if (!parsed) {
    return "";
  }
  return `${pad2(parsed.d)}/${pad2(parsed.m)}/${parsed.y}`;
}

export function WheelDatePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const years = useMemo(() => {
    const list: number[] = [];
    for (let year = currentYear; year >= currentYear - 100; year -= 1) {
      list.push(year);
    }
    return list;
  }, [currentYear]);

  const parsed = parseDate(value);
  const [draftYear, setDraftYear] = useState(parsed?.y ?? currentYear - 20);
  const [draftMonth, setDraftMonth] = useState(parsed?.m ?? 1);
  const [draftDay, setDraftDay] = useState(parsed?.d ?? 1);

  const maxDay = daysInMonth(draftYear, draftMonth);
  const days = useMemo(() => Array.from({ length: maxDay }, (_, index) => index + 1), [maxDay]);
  // Clamp the displayed/selected day without storing it: when month/year shrink the
  // available days (e.g. Feb 30 -> 28) the effective day stays valid, and draftDay is
  // preserved so switching back to a longer month restores the original choice.
  const safeDay = Math.min(draftDay, maxDay);

  function openSheet() {
    const current = parseDate(value);
    setDraftYear(current?.y ?? currentYear - 20);
    setDraftMonth(current?.m ?? 1);
    setDraftDay(current?.d ?? 1);
    setOpen(true);
  }

  function confirm() {
    onChange(`${draftYear}-${pad2(draftMonth)}-${pad2(safeDay)}`);
    setOpen(false);
  }

  const display = formatDisplay(value);

  return (
    <>
      <button
        type="button"
        onClick={openSheet}
        className={`${inputClassName} flex items-center justify-between text-left`}
      >
        <span className={display ? "text-white" : "text-[#526087]"}>
          {display || "วว/ดด/ปปปป"}
        </span>
        <CalendarDays className="h-4 w-4 shrink-0 text-[#7480aa]" aria-hidden />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <button
            type="button"
            aria-label="ปิด"
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpen(false)}
          />
          <div className="relative w-full max-w-[430px] rounded-t-[28px] border border-[#202a49] bg-[#0c142d] p-5 pb-7">
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-[#27345b]" />
            <p className="mb-4 text-center text-sm font-semibold text-white">เลือกวันเกิด</p>

            <div className="relative grid grid-cols-[1fr_1.4fr_1fr] gap-2">
              {/* center selection band */}
              <div
                className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-md border-y border-[#3a4a7d] bg-[#17244d]/40"
                style={{ height: ITEM_HEIGHT }}
              />
              <WheelColumn
                ariaLabel="วัน"
                items={days.map((day) => String(day))}
                selectedIndex={safeDay - 1}
                onSelect={(index) => setDraftDay(days[index])}
              />
              <WheelColumn
                ariaLabel="เดือน"
                items={thaiMonths}
                selectedIndex={draftMonth - 1}
                onSelect={(index) => setDraftMonth(index + 1)}
              />
              <WheelColumn
                ariaLabel="ปี (ค.ศ.)"
                items={years.map((year) => String(year))}
                selectedIndex={years.indexOf(draftYear)}
                onSelect={(index) => setDraftYear(years[index])}
              />
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                className={secondaryButtonClassName}
                onClick={() => setOpen(false)}
              >
                ยกเลิก
              </button>
              <button type="button" className={primaryButtonClassName} onClick={confirm}>
                ยืนยัน
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function WheelColumn({
  items,
  selectedIndex,
  onSelect,
  ariaLabel,
}: {
  items: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  ariaLabel: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncing = useRef(false);

  // Align the wheel to the selected index (initial open + external clamps).
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }
    const target = Math.max(0, selectedIndex) * ITEM_HEIGHT;
    if (Math.abs(element.scrollTop - target) > 1) {
      syncing.current = true;
      element.scrollTop = target;
      window.setTimeout(() => {
        syncing.current = false;
      }, 60);
    }
  }, [selectedIndex, items.length]);

  function handleScroll() {
    if (syncing.current) {
      return;
    }
    if (settleTimer.current) {
      clearTimeout(settleTimer.current);
    }
    settleTimer.current = setTimeout(() => {
      const element = scrollRef.current;
      if (!element) {
        return;
      }
      const index = Math.round(element.scrollTop / ITEM_HEIGHT);
      const clamped = Math.max(0, Math.min(items.length - 1, index));
      if (clamped !== selectedIndex) {
        onSelect(clamped);
      }
    }, 120);
  }

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="relative h-[200px] snap-y snap-mandatory overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div style={{ height: PAD }} />
      {items.map((item, index) => (
        <button
          type="button"
          key={`${ariaLabel}-${item}`}
          onClick={() => {
            onSelect(index);
            scrollRef.current?.scrollTo({ top: index * ITEM_HEIGHT, behavior: "smooth" });
          }}
          className={`flex w-full snap-center items-center justify-center text-sm transition ${
            index === selectedIndex ? "font-semibold text-white" : "text-[#7480aa]"
          }`}
          style={{ height: ITEM_HEIGHT }}
        >
          {item}
        </button>
      ))}
      <div style={{ height: PAD }} />
    </div>
  );
}
