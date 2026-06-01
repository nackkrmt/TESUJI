import { stat } from "node:fs/promises";
import { getGoDatabaseFilePath, goDatabaseSourceFiles } from "./database-config";
import { parseGoPlayerWorkbook, type GoPlayerSource } from "./excel-import";
import { readGoDatabaseUploadStatuses, type GoDatabaseUploadStatus } from "./upload-status";

export type GoDatabaseSummary = {
  source: GoPlayerSource;
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
    rank: string;
    powerLevel: number;
  }>;
  error?: string;
};

export async function getGoDatabaseSummaries(): Promise<GoDatabaseSummary[]> {
  const uploadStatuses = await readGoDatabaseUploadStatuses();

  return Promise.all(
    goDatabaseSourceFiles.map(async (sourceFile) => {
      const filePath = getGoDatabaseFilePath(sourceFile.source);
      const fileStat = await stat(filePath).catch(() => null);
      const baseSummary = {
        ...sourceFile,
        filePath,
        fileSizeBytes: fileStat?.size ?? null,
        lastModifiedAt: fileStat?.mtime.toISOString() ?? null,
        latestUpload: uploadStatuses[sourceFile.source] ?? null,
      };

      try {
        const parsed = await parseGoPlayerWorkbook(filePath, sourceFile.source);
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
            name: `${row.first_name_th} ${row.last_name_th}`,
            rank: row.rank,
            powerLevel: row.power_level,
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
    }),
  );
}
