"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, UploadCloud } from "lucide-react";
import type { GoPlayerSource } from "@/lib/go/excel-import";

type UploadState =
  | { status: "idle"; message: string }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export function DatabaseUploadForm({
  source,
  label,
}: {
  source: GoPlayerSource;
  label: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [state, setState] = useState<UploadState>({
    status: "idle",
    message: "เลือกไฟล์ .xlsx แล้วระบบจะตรวจ schema และ import เข้า Supabase โดยตรง",
  });
  const [isPending, startTransition] = useTransition();

  function uploadSelectedFile() {
    const file = inputRef.current?.files?.[0];

    if (!file) {
      setState({ status: "error", message: "กรุณาเลือกไฟล์ก่อนอัปโหลด" });
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.append("source", source);
      formData.append("file", file);

      const response = await fetch("/admin/database/upload", {
        method: "POST",
        body: formData,
      });
      const result = (await response.json()) as {
        ok?: boolean;
        error?: string;
        importableRows?: number;
        skippedRows?: number;
        supabaseImportedRows?: number;
        syncedProfiles?: number;
      };

      if (!response.ok || !result.ok) {
        setState({
          status: "error",
          message: result.error ?? "อัปโหลดไม่สำเร็จ",
        });
        return;
      }

      setState({
        status: "success",
        message: `เข้า Supabase แล้ว: ${formatNumber(result.supabaseImportedRows ?? 0)} rows, ${formatNumber(result.skippedRows ?? 0)} skip, sync ${formatNumber(result.syncedProfiles ?? 0)} profiles`,
      });
      setFileName("");

      if (inputRef.current) {
        inputRef.current.value = "";
      }

      router.refresh();
    });
  }

  return (
    <div className="rounded-md border border-[#27345b] bg-[#0a1128] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-white">Upload {label}</p>
          <p className="mt-1 text-xs leading-5 text-[#8390bd]">{state.message}</p>
        </div>
        <span
          className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
            state.status === "success"
              ? "bg-[#073d36] text-[#42e0b3]"
              : state.status === "error"
                ? "bg-[#4a1724] text-[#ff8fa3]"
                : "bg-[#151f3e] text-[#aab4da]"
          }`}
        >
          {state.status === "success" ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
          {state.status === "success" ? "ready" : state.status === "error" ? "check file" : "xlsx"}
        </span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
        <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-md border border-dashed border-[#38456e] bg-[#111832] px-4 py-3 text-sm text-[#aab4da] transition hover:border-[#6c72ff] hover:text-white">
          <UploadCloud className="h-5 w-5 shrink-0 text-[#6c72ff]" aria-hidden />
          <span className="truncate">{fileName || "เลือกไฟล์ Excel .xlsx"}</span>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              setFileName(file?.name ?? "");
              setState({
                status: "idle",
                message: file
                  ? `พร้อมอัปโหลด ${file.name} เพื่อ import เข้า Supabase`
                  : "เลือกไฟล์ .xlsx แล้วระบบจะตรวจ schema และ import เข้า Supabase โดยตรง",
              });
            }}
          />
        </label>
        <button
          type="button"
          onClick={uploadSelectedFile}
          disabled={isPending}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-[#6c72ff] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#7c82ff] disabled:cursor-wait disabled:opacity-70"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <UploadCloud className="h-4 w-4" aria-hidden />
          )}
          Upload
        </button>
      </div>
    </div>
  );
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}
