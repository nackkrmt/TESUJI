import { NextResponse } from "next/server";
import { countSkipReasons, tryRecordDatabaseImportRun } from "@/lib/database/import-runs";
import { getGoDatabaseSourceFile } from "@/lib/go/database-config";
import { parseGoPlayerWorkbook, type GoPlayerSource } from "@/lib/go/excel-import";
import { replaceGoPlayerDatabaseSourceInSupabase } from "@/lib/go/supabase-import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const validSources = new Set<GoPlayerSource>(["dan", "kyu", "award"]);
const MAX_EXCEL_BYTES = 10 * 1024 * 1024;

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

  if (file.size > MAX_EXCEL_BYTES) {
    return NextResponse.json(
      { error: "Excel files must be 10MB or smaller." },
      { status: 400 },
    );
  }

  const sourceFile = getGoDatabaseSourceFile(source);

  try {
    const parsed = await parseGoPlayerWorkbook(await file.arrayBuffer(), source);

    if (parsed.importedRows.length === 0) {
      await tryRecordDatabaseImportRun({
        source,
        status: "error",
        originalFileName: file.name,
        importableRows: 0,
        skippedRows: parsed.skippedRows.length,
        supabaseImportedRows: 0,
        skipReasons: countSkipReasons(parsed.skippedRows),
        errorMessage: "Parser did not find any importable rows in this file.",
      });

      return NextResponse.json(
        { error: "Parser did not find any importable rows in this file." },
        { status: 422 },
      );
    }

    const supabaseImport = await replaceGoPlayerDatabaseSourceInSupabase(
      source,
      parsed.importedRows,
    );

    await tryRecordDatabaseImportRun({
      source,
      status: "success",
      originalFileName: file.name,
      importableRows: parsed.importedRows.length,
      skippedRows: parsed.skippedRows.length,
      supabaseImportedRows: supabaseImport.importedRows,
      syncedProfiles: supabaseImport.syncedProfiles,
      supabaseStrategy: supabaseImport.strategy,
      skipReasons: countSkipReasons(parsed.skippedRows),
    });

    return NextResponse.json({
      ok: true,
      source,
      fileName: sourceFile.fileName,
      importableRows: parsed.importedRows.length,
      skippedRows: parsed.skippedRows.length,
      supabaseImportedRows: supabaseImport.importedRows,
      syncedProfiles: supabaseImport.syncedProfiles,
      supabaseStrategy: supabaseImport.strategy,
    });
  } catch (error) {
    await tryRecordDatabaseImportRun({
      source,
      status: "error",
      originalFileName: file.name,
      importableRows: 0,
      skippedRows: 0,
      supabaseImportedRows: 0,
      errorMessage: getErrorMessage(error),
    });

    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 422 },
    );
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
