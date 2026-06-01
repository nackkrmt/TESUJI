import { AlertTriangle, CheckCircle2, Clock3, FileSpreadsheet } from "lucide-react";
import { DatabaseUploadForm } from "@/components/admin/database-upload-form";
import { SchoolDatabaseUploadForm } from "@/components/admin/school-database-upload-form";
import { getGoDatabaseSummaries } from "@/lib/go/database-summary";
import { getSchoolDatabaseSummary } from "@/lib/school/database-summary";

export const dynamic = "force-dynamic";

export default async function AdminDatabasePage() {
  const [summaries, schoolSummary] = await Promise.all([
    getGoDatabaseSummaries(),
    getSchoolDatabaseSummary(),
  ]);

  return (
    <div className="flex w-full flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <header>
        <p className="text-sm font-semibold text-[#7378ff]">Database</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal text-white">
          อัปโหลดฐานข้อมูลผู้เล่น
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#8390bd]">
          ใช้สำหรับอัปโหลดไฟล์ DAN, KYU และ AWARD เข้าโฟลเดอร์ฐานข้อมูลจริง ระบบจะอ่านไฟล์ด้วย parser เดียวกับ import script ก่อนแทนที่ไฟล์เดิม
        </p>
      </header>

      <section className="grid gap-5">
        {summaries.map((summary) => (
          <article key={summary.source} className="rounded-lg border border-[#202a49] bg-[#101832]">
            <div className="grid gap-5 border-b border-[#202a49] p-5 xl:grid-cols-[1fr_420px]">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-md bg-[#17244d] text-[#7378ff]">
                    <FileSpreadsheet className="h-5 w-5" aria-hidden />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white">{summary.label}</h2>
                    <p className="mt-1 break-all text-xs text-[#7480aa]">{summary.filePath}</p>
                  </div>
                  <span
                    className={`ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                      summary.error ? "bg-[#4a1724] text-[#ff8fa3]" : "bg-[#073d36] text-[#42e0b3]"
                    }`}
                  >
                    {summary.error ? (
                      <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                    )}
                    {summary.error ? "อ่านไฟล์ไม่สำเร็จ" : "อ่านไฟล์สำเร็จ"}
                  </span>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <StatusBlock
                    label="อัปโหลดผ่านหน้า Admin ล่าสุด"
                    value={
                      summary.latestUpload
                        ? formatDateTime(summary.latestUpload.uploadedAt)
                        : "ยังไม่เคยอัปโหลด"
                    }
                    detail={summary.latestUpload?.originalFileName ?? "ไม่มีประวัติ upload"}
                  />
                  <StatusBlock
                    label="Supabase ล่าสุด"
                    value={
                      summary.latestUpload
                        ? `${(
                            summary.latestUpload.supabaseImportedRows ??
                            summary.latestUpload.importableRows
                          ).toLocaleString("th-TH")} rows`
                        : "ยังไม่เคย import"
                    }
                    detail="แทนข้อมูล source เดิมบน cloud"
                  />
                  <StatusBlock
                    label="ไฟล์ต้นทางแก้ไขล่าสุด"
                    value={formatDateTime(summary.lastModifiedAt)}
                    detail={formatBytes(summary.fileSizeBytes)}
                  />
                </div>
              </div>

              <DatabaseUploadForm source={summary.source} label={summary.label} />
            </div>

            <div className="grid gap-5 p-5 xl:grid-cols-[280px_1fr_1fr]">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <CountPanel label="พร้อม import" value={summary.importableRows} tone="green" />
                <CountPanel label="skip" value={summary.skippedRows} tone="amber" />
              </div>

              <div>
                <h3 className="text-sm font-semibold text-[#dce3ff]">ตัวอย่างข้อมูล</h3>
                {summary.samples.length === 0 ? (
                  <EmptyPanel text="ยังไม่มี row ที่อ่านได้" />
                ) : (
                  <div className="mt-3 overflow-hidden rounded-md border border-[#27345b]">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-[#0a1128] text-xs text-[#8390bd]">
                        <tr>
                          <th className="px-3 py-2 font-semibold">ชื่อ</th>
                          <th className="px-3 py-2 font-semibold">Rank</th>
                          <th className="px-3 py-2 font-semibold">Power</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#202a49] text-[#dce3ff]">
                        {summary.samples.map((sample) => (
                          <tr key={`${summary.source}-${sample.name}-${sample.rank}`}>
                            <td className="px-3 py-2">{sample.name}</td>
                            <td className="px-3 py-2 font-semibold text-white">{sample.rank}</td>
                            <td className="px-3 py-2">{sample.powerLevel}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-sm font-semibold text-[#dce3ff]">เหตุผลที่ skip</h3>
                {summary.skipReasons.length === 0 ? (
                  <EmptyPanel text="ไม่มี row ที่ถูก skip" />
                ) : (
                  <div className="mt-3 grid gap-2">
                    {summary.skipReasons.map((reason) => (
                      <div
                        key={`${summary.source}-${reason.reason}`}
                        className="flex items-center justify-between gap-4 rounded-md border border-[#27345b] bg-[#0a1128] px-3 py-2 text-sm"
                      >
                        <span className="text-[#aab4da]">{reason.reason}</span>
                        <span className="font-semibold text-white">
                          {reason.count.toLocaleString("th-TH")}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </article>
        ))}

        <article className="rounded-lg border border-[#202a49] bg-[#101832]">
          <div className="grid gap-5 border-b border-[#202a49] p-5 xl:grid-cols-[1fr_420px]">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-md bg-[#17244d] text-[#7378ff]">
                  <FileSpreadsheet className="h-5 w-5" aria-hidden />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">{schoolSummary.label}</h2>
                  <p className="mt-1 break-all text-xs text-[#7480aa]">{schoolSummary.filePath}</p>
                </div>
                <span
                  className={`ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                    schoolSummary.error ? "bg-[#4a1724] text-[#ff8fa3]" : "bg-[#073d36] text-[#42e0b3]"
                  }`}
                >
                  {schoolSummary.error ? (
                    <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                  )}
                  {schoolSummary.error ? "อ่านไฟล์ไม่สำเร็จ" : "อ่านไฟล์สำเร็จ"}
                </span>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <StatusBlock
                  label="อัปโหลดผ่านหน้า Admin ล่าสุด"
                  value={
                    schoolSummary.latestUpload
                      ? formatDateTime(schoolSummary.latestUpload.uploadedAt)
                      : "ยังไม่เคยอัปโหลด"
                  }
                  detail={schoolSummary.latestUpload?.originalFileName ?? "ไม่มีประวัติ upload"}
                />
                <StatusBlock
                  label="Supabase ล่าสุด"
                  value={
                    schoolSummary.latestUpload
                      ? `${(
                          schoolSummary.latestUpload.supabaseImportedRows ??
                          schoolSummary.latestUpload.importableRows
                        ).toLocaleString("th-TH")} schools`
                      : "ยังไม่เคย import"
                  }
                  detail="แทนข้อมูล school เดิมบน cloud"
                />
                <StatusBlock
                  label="ไฟล์ต้นทางแก้ไขล่าสุด"
                  value={formatDateTime(schoolSummary.lastModifiedAt)}
                  detail={formatBytes(schoolSummary.fileSizeBytes)}
                />
              </div>
            </div>

            <SchoolDatabaseUploadForm />
          </div>

          <div className="grid gap-5 p-5 xl:grid-cols-[280px_1fr_1fr]">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <CountPanel label="พร้อม import" value={schoolSummary.importableRows} tone="green" />
              <CountPanel label="skip" value={schoolSummary.skippedRows} tone="amber" />
            </div>

            <div>
              <h3 className="text-sm font-semibold text-[#dce3ff]">ตัวอย่างข้อมูล</h3>
              {schoolSummary.samples.length === 0 ? (
                <EmptyPanel text="ยังไม่มี row ที่อ่านได้" />
              ) : (
                <div className="mt-3 overflow-hidden rounded-md border border-[#27345b]">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[#0a1128] text-xs text-[#8390bd]">
                      <tr>
                        <th className="px-3 py-2 font-semibold">สถาบัน</th>
                        <th className="px-3 py-2 font-semibold">Keywords</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#202a49] text-[#dce3ff]">
                      {schoolSummary.samples.map((sample) => (
                        <tr key={`${schoolSummary.source}-${sample.name}`}>
                          <td className="px-3 py-2 font-semibold text-white">{sample.name}</td>
                          <td className="px-3 py-2">{sample.keywords.join(", ") || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold text-[#dce3ff]">เหตุผลที่ skip</h3>
              {schoolSummary.skipReasons.length === 0 ? (
                <EmptyPanel text="ไม่มี row ที่ถูก skip" />
              ) : (
                <div className="mt-3 grid gap-2">
                  {schoolSummary.skipReasons.map((reason) => (
                    <div
                      key={`${schoolSummary.source}-${reason.reason}`}
                      className="flex items-center justify-between gap-4 rounded-md border border-[#27345b] bg-[#0a1128] px-3 py-2 text-sm"
                    >
                      <span className="text-[#aab4da]">{reason.reason}</span>
                      <span className="font-semibold text-white">
                        {reason.count.toLocaleString("th-TH")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}

function StatusBlock({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-md border border-[#27345b] bg-[#0a1128] p-4">
      <div className="flex items-center gap-2 text-xs font-semibold text-[#8390bd]">
        <Clock3 className="h-3.5 w-3.5" aria-hidden />
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
      <p className="mt-4 text-3xl font-semibold text-white">{value.toLocaleString("th-TH")}</p>
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

function formatBytes(value: number | null): string {
  if (!value) {
    return "ไม่มีขนาดไฟล์";
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
