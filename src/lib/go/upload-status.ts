import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { databaseDir } from "./database-config";
import type { GoPlayerSource } from "./excel-import";

export type DatabaseUploadSource = GoPlayerSource | "school";

export type GoDatabaseUploadStatus = {
  source: DatabaseUploadSource;
  uploadedAt: string;
  originalFileName: string;
  importableRows: number;
  skippedRows: number;
  supabaseImportedRows: number;
  syncedProfiles?: number;
  supabaseStrategy: string;
};

type UploadStatusFile = Partial<Record<DatabaseUploadSource, GoDatabaseUploadStatus>>;

const statusFileName = ".tesuji-upload-status.json";

export async function readGoDatabaseUploadStatuses(
  baseDir = databaseDir,
): Promise<UploadStatusFile> {
  try {
    const statusFilePath = `${baseDir}/${statusFileName}`;
    const raw = await readFile(statusFilePath, "utf8");
    return JSON.parse(raw) as UploadStatusFile;
  } catch {
    return {};
  }
}

export async function writeGoDatabaseUploadStatus(
  status: GoDatabaseUploadStatus,
  baseDir = databaseDir,
): Promise<void> {
  const statusFilePath = `${baseDir}/${statusFileName}`;
  const statuses = await readGoDatabaseUploadStatuses(baseDir);

  statuses[status.source] = status;

  await mkdir(baseDir, { recursive: true });
  await writeFile(`${statusFilePath}.tmp`, JSON.stringify(statuses, null, 2), "utf8");
  await rename(`${statusFilePath}.tmp`, statusFilePath);
}
