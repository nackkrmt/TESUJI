import { DatabaseCard } from "@/components/admin/database-card";
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
          อัปโหลดฐานข้อมูลผู้เล่นและสถาบัน
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#8390bd]">
          ใช้สำหรับอัปโหลดไฟล์ DAN, KYU, AWARD (ผู้เล่น) และ SCHOOL (สถาบัน) เข้าโฟลเดอร์ฐานข้อมูลจริง
          ระบบจะอ่านไฟล์ด้วย parser เดียวกับ import script ก่อนแทนที่ไฟล์เดิมและ import เข้า Supabase
        </p>
      </header>

      <section className="grid gap-5">
        {summaries.map((summary) => (
          <DatabaseCard
            key={summary.source}
            label={summary.label}
            filePath={summary.filePath}
            error={summary.error}
            latestUpload={summary.latestUpload}
            lastModifiedAt={summary.lastModifiedAt}
            fileSizeBytes={summary.fileSizeBytes}
            importableRows={summary.importableRows}
            skippedRows={summary.skippedRows}
            skipReasons={summary.skipReasons}
            supabaseUnit="rows"
            supabaseDetail="แทนข้อมูล source เดิมบน cloud"
            uploadForm={<DatabaseUploadForm source={summary.source} label={summary.label} />}
            hasSamples={summary.samples.length > 0}
            samplesTable={
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
            }
          />
        ))}

        <DatabaseCard
          label={schoolSummary.label}
          filePath={schoolSummary.filePath}
          error={schoolSummary.error}
          latestUpload={schoolSummary.latestUpload}
          lastModifiedAt={schoolSummary.lastModifiedAt}
          fileSizeBytes={schoolSummary.fileSizeBytes}
          importableRows={schoolSummary.importableRows}
          skippedRows={schoolSummary.skippedRows}
          skipReasons={schoolSummary.skipReasons}
          supabaseUnit="schools"
          supabaseDetail="แทนข้อมูล school เดิมบน cloud"
          uploadForm={<SchoolDatabaseUploadForm />}
          hasSamples={schoolSummary.samples.length > 0}
          samplesTable={
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
          }
        />
      </section>
    </div>
  );
}
