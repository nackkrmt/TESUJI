import { NextResponse } from "next/server";
import { countSkipReasons, tryRecordDatabaseImportRun } from "@/lib/database/import-runs";
import { schoolDatabaseFileName } from "@/lib/school/database-config";
import { parseSchoolWorkbook } from "@/lib/school/excel-import";
import { replaceSchoolDatabaseInSupabase } from "@/lib/school/supabase-import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_EXCEL_BYTES = 10 * 1024 * 1024;

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

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

  try {
    const parsed = await parseSchoolWorkbook(await file.arrayBuffer());

    if (parsed.importedRows.length === 0) {
      await tryRecordDatabaseImportRun({
        source: "school",
        status: "error",
        originalFileName: file.name,
        importableRows: 0,
        skippedRows: parsed.skippedRows.length,
        supabaseImportedRows: 0,
        skipReasons: countSkipReasons(parsed.skippedRows),
        errorMessage: "Parser did not find any importable school rows in this file.",
      });

      return NextResponse.json(
        { error: "Parser did not find any importable school rows in this file." },
        { status: 422 },
      );
    }

    const supabaseImport = await replaceSchoolDatabaseInSupabase(parsed.importedRows);

    await tryRecordDatabaseImportRun({
      source: "school",
      status: "success",
      originalFileName: file.name,
      importableRows: parsed.importedRows.length,
      skippedRows: parsed.skippedRows.length,
      supabaseImportedRows: supabaseImport.importedRows,
      supabaseStrategy: supabaseImport.strategy,
      skipReasons: countSkipReasons(parsed.skippedRows),
    });

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
    await tryRecordDatabaseImportRun({
      source: "school",
      status: "error",
      originalFileName: file.name,
      importableRows: 0,
      skippedRows: 0,
      supabaseImportedRows: 0,
      errorMessage: getErrorMessage(error),
    });

    return NextResponse.json({ error: getErrorMessage(error) }, { status: 422 });
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
