import { execFile } from "node:child_process";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { databaseDir } from "./database-config";
import type { GoPlayerImportRow, GoPlayerSource } from "./excel-import";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type GoDatabaseSupabaseImportResult = {
  importedRows: number;
  strategy: "supabase-js" | "supabase-cli";
};

const execFileAsync = promisify(execFile);

export async function replaceGoPlayerDatabaseSourceInSupabase(
  source: GoPlayerSource,
  rows: GoPlayerImportRow[],
): Promise<GoDatabaseSupabaseImportResult> {
  const payload = rowsToSupabasePayload(rows);

  try {
    return await replaceWithSupabaseJs(source, payload);
  } catch (error) {
    if (process.env.SUPABASE_IMPORT_STRATEGY === "supabase-js") {
      throw error;
    }

    return replaceWithSupabaseCli(source, payload);
  }
}

function rowsToSupabasePayload(rows: GoPlayerImportRow[]) {
  return rows.map((row) => ({
    seq: row.seq,
    prefix_th: row.prefix_th,
    first_name_th: row.first_name_th,
    last_name_th: row.last_name_th,
    first_name_th_normalized: row.first_name_th_normalized,
    last_name_th_normalized: row.last_name_th_normalized,
    rank: row.rank,
    power_level: row.power_level,
    rating: row.rating,
    year_promoted: row.year_promoted,
    diamond: row.diamond,
    category: row.category,
    rank_in_category: row.rank_in_category,
    rank_award: row.rank_award,
    event_name: row.event_name,
    event_date: row.event_date,
    raw_data: row.raw_data,
  }));
}

async function replaceWithSupabaseJs(
  source: GoPlayerSource,
  payload: ReturnType<typeof rowsToSupabasePayload>,
): Promise<GoDatabaseSupabaseImportResult> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("replace_go_player_database_source", {
    p_source: source,
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
  source: GoPlayerSource,
  payload: ReturnType<typeof rowsToSupabasePayload>,
): Promise<GoDatabaseSupabaseImportResult> {
  const tempDir = `${databaseDir}/.uploads`;
  const uploadId = `${Date.now()}-${source}`;
  const sqlPath = `${tempDir}/${uploadId}.sql`;
  const dollarQuoteTag = `tesuji_${uploadId.replace(/[^a-zA-Z0-9_]/g, "_")}`;
  const sql = [
    "select public.replace_go_player_database_source(",
    `  '${source}',`,
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
    const { stdout, stderr } = await execFileAsync(
      command,
      args,
      {
        cwd: process.cwd(),
        maxBuffer: 30 * 1024 * 1024,
        windowsHide: true,
      },
    );
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
