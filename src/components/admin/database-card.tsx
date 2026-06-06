import type { ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  FileSpreadsheet,
} from "lucide-react";
import type { DatabaseImportRun } from "@/lib/database/import-runs";

type DatabaseCardProps = {
  label: string;
  fileName: string;
  error?: string;
  latestUpload: DatabaseImportRun | null;
  supabaseRows: number;
  importableRows: number;
  skippedRows: number;
  skipReasons: Array<{ reason: string; count: number }>;
  /** Unit shown next to the Supabase row count, e.g. "rows" or "schools". */
  supabaseUnit: string;
  /** Helper text under the Supabase status block. */
  supabaseDetail: string;
  /** Upload form for this source (client component). */
  uploadForm: ReactNode;
  hasSamples: boolean;
  /** The samples table to render when hasSamples is true. */
  samplesTable: ReactNode;
};

export function DatabaseCard({
  label,
  fileName,
  error,
  latestUpload,
  supabaseRows,
  importableRows,
  skippedRows,
  skipReasons,
  supabaseUnit,
  supabaseDetail,
  uploadForm,
  hasSamples,
  samplesTable,
}: DatabaseCardProps) {
  const latestImportFailed = latestUpload?.status === "error";
  const statusFailed = Boolean(error) || latestImportFailed;
  const latestImportDetail = latestUpload
    ? [
        `${formatNumber(latestUpload.importableRows)} พร้อม import`,
        `${formatNumber(latestUpload.skippedRows)} skip`,
        latestUpload.syncedProfiles !== null
          ? `${formatNumber(latestUpload.syncedProfiles)} synced profiles`
          : null,
      ]
        .filter(Boolean)
        .join(", ")
    : "สถานะล่าสุดจะถูกบันทึกใน database_import_runs";

  return (
    <article className="rounded-lg border border-[#202a49] bg-[#101832]">
      <div className="grid gap-5 border-b border-[#202a49] p-5 xl:grid-cols-[1fr_420px]">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-md bg-[#17244d] text-[#7378ff]">
              <FileSpreadsheet className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">{label}</h2>
              <p className="mt-1 text-xs text-[#7480aa]">
                อัปโหลดไฟล์ {fileName} แล้ว import เข้า Supabase โดยตรง
              </p>
            </div>
            <span
              className={`ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                statusFailed ? "bg-[#4a1724] text-[#ff8fa3]" : "bg-[#073d36] text-[#42e0b3]"
              }`}
            >
              {statusFailed ? (
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
              )}
              {statusFailed ? "ต้องตรวจสอบ" : "พร้อมใช้งานจาก Supabase"}
            </span>
          </div>

          {error || latestUpload?.errorMessage ? (
            <p
              role="alert"
              className="mt-4 rounded-md border border-[#4a1724] bg-[#2a1020] p-3 text-sm leading-6 text-[#ffb0bd]"
            >
              {error ?? latestUpload?.errorMessage}
            </p>
          ) : null}

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <StatusBlock
              label="อัปโหลดผ่านหน้า Admin ล่าสุด"
              value={latestUpload ? formatDateTime(latestUpload.uploadedAt) : "ยังไม่เคยอัปโหลด"}
              detail={latestUpload?.originalFileName ?? "ไม่มีประวัติ upload"}
            />
            <StatusBlock
              icon={<Database className="h-3.5 w-3.5" aria-hidden />}
              label="Supabase ปัจจุบัน"
              value={`${formatNumber(supabaseRows)} ${supabaseUnit}`}
              detail={supabaseDetail}
            />
            <StatusBlock
              label="ผล import ล่าสุด"
              value={
                latestUpload
                  ? `${formatNumber(latestUpload.supabaseImportedRows)} imported`
                  : "ยังไม่เคย import"
              }
              detail={latestImportDetail}
            />
          </div>
        </div>

        {uploadForm}
      </div>

      <div className="grid gap-5 p-5 xl:grid-cols-[280px_1fr_1fr]">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <CountPanel label="พร้อม import" value={importableRows} tone="green" />
          <CountPanel label="skip" value={skippedRows} tone="amber" />
        </div>

        <div>
          <h3 className="text-sm font-semibold text-[#dce3ff]">ตัวอย่างข้อมูลจาก Supabase</h3>
          {hasSamples ? samplesTable : <EmptyPanel text="ยังไม่มี row จาก Supabase" />}
        </div>

        <div>
          <h3 className="text-sm font-semibold text-[#dce3ff]">เหตุผลที่ skip จาก import ล่าสุด</h3>
          {skipReasons.length === 0 ? (
            <EmptyPanel text="ไม่มี row ที่ถูก skip" />
          ) : (
            <div className="mt-3 grid gap-2">
              {skipReasons.map((reason) => (
                <div
                  key={reason.reason}
                  className="flex items-center justify-between gap-4 rounded-md border border-[#27345b] bg-[#0a1128] px-3 py-2 text-sm"
                >
                  <span className="text-[#aab4da]">{reason.reason}</span>
                  <span className="font-semibold text-white">{formatNumber(reason.count)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function StatusBlock({
  icon = <Clock3 className="h-3.5 w-3.5" aria-hidden />,
  label,
  value,
  detail,
}: {
  icon?: ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-md border border-[#27345b] bg-[#0a1128] p-4">
      <div className="flex items-center gap-2 text-xs font-semibold text-[#8390bd]">
        {icon}
        {label}
      </div>
      <p className="mt-3 text-sm font-semibold text-white">{value}</p>
      <p className="mt-1 truncate text-xs text-[#7480aa]">{detail}</p>
    </div>
  );
}

function CountPanel({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "green" | "amber";
}) {
  const toneClass =
    tone === "green" ? "bg-[#073d36] text-[#42e0b3]" : "bg-[#443013] text-[#ffc66d]";

  return (
    <div className="rounded-md border border-[#27345b] bg-[#0a1128] p-4">
      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${toneClass}`}>{label}</span>
      <p className="mt-4 text-3xl font-semibold text-white">{formatNumber(value)}</p>
    </div>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return (
    <div className="mt-3 rounded-md border border-dashed border-[#27345b] bg-[#0a1128] p-4 text-sm text-[#7480aa]">
      {text}
    </div>
  );
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "ไม่มีข้อมูล";
  }

  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(new Date(value));
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}
