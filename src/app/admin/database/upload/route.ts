import { copyFile, mkdir, stat, unlink, writeFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { databaseDir, getGoDatabaseFilePath, getGoDatabaseSourceFile } from "@/lib/go/database-config";
import { parseGoPlayerWorkbook, type GoPlayerSource } from "@/lib/go/excel-import";
import { replaceGoPlayerDatabaseSourceInSupabase } from "@/lib/go/supabase-import";
import { writeGoDatabaseUploadStatus } from "@/lib/go/upload-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const validSources = new Set<GoPlayerSource>(["dan", "kyu", "award"]);

export async function POST(request: Request) {
  const formData = await request.formData();
  const source = formData.get("source");
  const file = formData.get("file");

  if (!isGoPlayerSource(source)) {
    return NextResponse.json({ error: "Unknown database source." }, { status: 400 });
  }

  if (!isUploadedFile(file)) {
    return NextResponse.json({ error: "Please choose an .xlsx file." }, { status: 400 });
  }

  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return NextResponse.json({ error: "Only .xlsx files are supported." }, { status: 400 });
  }

  const sourceFile = getGoDatabaseSourceFile(source);
  const targetPath = getGoDatabaseFilePath(source);
  const uploadId = `${Date.now()}-${source}`;
  const tempDir = `${databaseDir}/.uploads`;
  const tempPath = `${tempDir}/${uploadId}.xlsx`;

  try {
    await mkdir(tempDir, { recursive: true });
    await mkdir(`${databaseDir}/backups`, { recursive: true });
    await writeFile(tempPath, Buffer.from(await file.arrayBuffer()));

    const parsed = await parseGoPlayerWorkbook(tempPath, source);

    if (parsed.importedRows.length === 0) {
      return NextResponse.json(
        { error: "Parser did not find any importable rows in this file." },
        { status: 422 },
      );
    }

    const existingFile = await stat(targetPath).catch(() => null);

    if (existingFile) {
      const backupStamp = new Date().toISOString().replace(/[:.]/g, "-");
      await copyFile(targetPath, `${databaseDir}/backups/${backupStamp}-${sourceFile.fileName}`);
    }

    const supabaseImport = await replaceGoPlayerDatabaseSourceInSupabase(
      source,
      parsed.importedRows,
    );

    await copyFile(tempPath, targetPath);
    await writeGoDatabaseUploadStatus({
      source,
      uploadedAt: new Date().toISOString(),
      originalFileName: file.name,
      importableRows: parsed.importedRows.length,
      skippedRows: parsed.skippedRows.length,
      supabaseImportedRows: supabaseImport.importedRows,
      supabaseStrategy: supabaseImport.strategy,
    });

    return NextResponse.json({
      ok: true,
      source,
      fileName: sourceFile.fileName,
      importableRows: parsed.importedRows.length,
      skippedRows: parsed.skippedRows.length,
      supabaseImportedRows: supabaseImport.importedRows,
      supabaseStrategy: supabaseImport.strategy,
    });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 422 },
    );
  } finally {
    await unlink(tempPath).catch(() => undefined);
  }
}

function isGoPlayerSource(value: FormDataEntryValue | null): value is GoPlayerSource {
  return typeof value === "string" && validSources.has(value as GoPlayerSource);
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
