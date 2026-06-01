import { copyFile, mkdir, stat, unlink, writeFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import {
  getSchoolDatabaseFilePath,
  schoolDatabaseDir,
  schoolDatabaseFileName,
} from "@/lib/school/database-config";
import { parseSchoolWorkbook } from "@/lib/school/excel-import";
import { replaceSchoolDatabaseInSupabase } from "@/lib/school/supabase-import";
import { writeGoDatabaseUploadStatus } from "@/lib/go/upload-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!isUploadedFile(file)) {
    return NextResponse.json({ error: "Please choose an .xlsx file." }, { status: 400 });
  }

  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return NextResponse.json({ error: "Only .xlsx files are supported." }, { status: 400 });
  }

  const targetPath = getSchoolDatabaseFilePath();
  const uploadId = `${Date.now()}-school`;
  const tempDir = `${schoolDatabaseDir}/.uploads`;
  const tempPath = `${tempDir}/${uploadId}.xlsx`;

  try {
    await mkdir(tempDir, { recursive: true });
    await mkdir(`${schoolDatabaseDir}/backups`, { recursive: true });
    await writeFile(tempPath, Buffer.from(await file.arrayBuffer()));

    const parsed = await parseSchoolWorkbook(tempPath);

    if (parsed.importedRows.length === 0) {
      return NextResponse.json(
        { error: "Parser did not find any importable school rows in this file." },
        { status: 422 },
      );
    }

    const existingFile = await stat(targetPath).catch(() => null);

    if (existingFile) {
      const backupStamp = new Date().toISOString().replace(/[:.]/g, "-");
      await copyFile(targetPath, `${schoolDatabaseDir}/backups/${backupStamp}-${schoolDatabaseFileName}`);
    }

    const supabaseImport = await replaceSchoolDatabaseInSupabase(parsed.importedRows);

    await copyFile(tempPath, targetPath);
    await writeGoDatabaseUploadStatus(
      {
        source: "school",
        uploadedAt: new Date().toISOString(),
        originalFileName: file.name,
        importableRows: parsed.importedRows.length,
        skippedRows: parsed.skippedRows.length,
        supabaseImportedRows: supabaseImport.importedRows,
        supabaseStrategy: supabaseImport.strategy,
      },
      schoolDatabaseDir,
    );

    return NextResponse.json({
      ok: true,
      source: "school",
      fileName: schoolDatabaseFileName,
      importableRows: parsed.importedRows.length,
      skippedRows: parsed.skippedRows.length,
      supabaseImportedRows: supabaseImport.importedRows,
      supabaseStrategy: supabaseImport.strategy,
    });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 422 });
  } finally {
    await unlink(tempPath).catch(() => undefined);
  }
}

function isUploadedFile(value: FormDataEntryValue | null): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    "arrayBuffer" in value &&
    "name" in value &&
    typeof value.name === "string"
  );
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    return String(error.message);
  }

  return "Upload failed.";
}
