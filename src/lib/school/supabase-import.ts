import { execFile } from "node:child_process";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { schoolDatabaseDir } from "./database-config";
import type { SchoolImportRow } from "./excel-import";

export type SchoolDatabaseSupabaseImportResult = {
  importedRows: number;
  strategy: "supabase-js" | "supabase-cli";
};

const execFileAsync = promisify(execFile);

export async function replaceSchoolDatabaseInSupabase(
  rows: SchoolImportRow[],
): Promise<SchoolDatabaseSupabaseImportResult> {
  const payload = rowsToSupabasePayload(rows);

  try {
    return await replaceWithSupabaseJs(payload);
  } catch (error) {
    if (process.env.SUPABASE_IMPORT_STRATEGY === "supabase-js") {
      throw error;
    }

    return replaceWithSupabaseCli(payload);
  }
}

function rowsToSupabasePayload(rows: SchoolImportRow[]) {
  return rows.map((row) => ({
    seq: row.seq,
    name: row.name,
    keywords: row.keywords,
    raw_data: row.raw_data,
  }));
}

async function replaceWithSupabaseJs(
  payload: ReturnType<typeof rowsToSupabasePayload>,
): Promise<SchoolDatabaseSupabaseImportResult> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("replace_school_database", {
    p_rows: payload,
  });

  if (error) {
    throw error;
  }

  return {
    importedRows: typeof data === "number" ? data : payload.length,
    strategy: "supabase-js",
  };
}

async function replaceWithSupabaseCli(
  payload: ReturnType<typeof rowsToSupabasePayload>,
): Promise<SchoolDatabaseSupabaseImportResult> {
  const tempDir = `${schoolDatabaseDir}/.uploads`;
  const uploadId = `${Date.now()}-school`;
  const sqlPath = `${tempDir}/${uploadId}.sql`;
  const dollarQuoteTag = `tesuji_${uploadId.replace(/[^a-zA-Z0-9_]/g, "_")}`;
  const sql = [
    "select public.replace_school_database(",
    `  $${dollarQuoteTag}$${JSON.stringify(payload)}$${dollarQuoteTag}$::jsonb`,
    ") as imported_rows;",
  ].join("\n");

  await mkdir(tempDir, { recursive: true });
  await writeFile(sqlPath, sql, "utf8");

  try {
    const command = process.platform === "win32" ? "cmd.exe" : "npx";
    const cliSqlPath = process.platform === "win32" ? sqlPath.replace(/\//g, "\\") : sqlPath;
    const args =
      process.platform === "win32"
        ? [
            "/d",
            "/s",
            "/c",
            `npx supabase db query --linked --file ${cliSqlPath} --output json`,
          ]
        : ["supabase", "db", "query", "--linked", "--file", cliSqlPath, "--output", "json"];
    const { stdout, stderr } = await execFileAsync(command, args, {
      cwd: process.cwd(),
      maxBuffer: 30 * 1024 * 1024,
      windowsHide: true,
    });
    const importedRows = readImportedRowsFromCliOutput(stdout) ?? payload.length;

    if (stderr.toLowerCase().includes("error")) {
      throw new Error(stderr.trim());
    }

    return {
      importedRows,
      strategy: "supabase-cli",
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Supabase CLI import failed: ${error.message}`);
    }

    throw error;
  } finally {
    await unlink(sqlPath).catch(() => undefined);
  }
}

function readImportedRowsFromCliOutput(output: string): number | null {
  try {
    const parsed = JSON.parse(output) as { rows?: Array<{ imported_rows?: number }> };
    return parsed.rows?.[0]?.imported_rows ?? null;
  } catch {
    return null;
  }
}
