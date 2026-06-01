import { stat } from "node:fs/promises";
import {
  getSchoolDatabaseFilePath,
  schoolDatabaseDir,
  schoolDatabaseFileName,
  schoolDatabaseLabel,
} from "./database-config";
import { parseSchoolWorkbook } from "./excel-import";
import { readGoDatabaseUploadStatuses, type GoDatabaseUploadStatus } from "@/lib/go/upload-status";

export type SchoolDatabaseSummary = {
  source: "school";
  label: string;
  fileName: string;
  filePath: string;
  fileSizeBytes: number | null;
  lastModifiedAt: string | null;
  latestUpload: GoDatabaseUploadStatus | null;
  importableRows: number;
  skippedRows: number;
  skipReasons: Array<{ reason: string; count: number }>;
  samples: Array<{
    name: string;
    keywords: string[];
  }>;
  error?: string;
};

export async function getSchoolDatabaseSummary(): Promise<SchoolDatabaseSummary> {
  const filePath = getSchoolDatabaseFilePath();
  const [uploadStatuses, fileStat] = await Promise.all([
    readGoDatabaseUploadStatuses(schoolDatabaseDir),
    stat(filePath).catch(() => null),
  ]);
  const baseSummary = {
    source: "school" as const,
    label: schoolDatabaseLabel,
    fileName: schoolDatabaseFileName,
    filePath,
    fileSizeBytes: fileStat?.size ?? null,
    lastModifiedAt: fileStat?.mtime.toISOString() ?? null,
    latestUpload: uploadStatuses.school ?? null,
  };

  try {
    const parsed = await parseSchoolWorkbook(filePath);
    const skipReasonCounts = parsed.skippedRows.reduce<Record<string, number>>(
      (summary, row) => {
        summary[row.reason] = (summary[row.reason] ?? 0) + 1;
        return summary;
      },
      {},
    );

    return {
      ...baseSummary,
      importableRows: parsed.importedRows.length,
      skippedRows: parsed.skippedRows.length,
      skipReasons: Object.entries(skipReasonCounts).map(([reason, count]) => ({
        reason,
        count,
      })),
      samples: parsed.importedRows.slice(0, 4).map((row) => ({
        name: row.name,
        keywords: row.keywords,
      })),
    };
  } catch (error) {
    return {
      ...baseSummary,
      importableRows: 0,
      skippedRows: 0,
      skipReasons: [],
      samples: [],
      error: error instanceof Error ? error.message : "อ่านไฟล์ไม่ได้",
    };
  }
}
