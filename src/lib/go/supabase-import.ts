import { execFile } from "node:child_process";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { databaseDir } from "./database-config";
import type { GoPlayerImportRow, GoPlayerSource } from "./excel-import";
import { normalizeThaiName } from "./normalize-thai";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type GoDatabaseSupabaseImportResult = {
  importedRows: number;
  syncedProfiles: number;
  strategy: "supabase-js" | "supabase-cli";
};

type VerifiedProfileRow = {
  id: string;
  first_name_th: string;
  last_name_th: string;
  rank: string;
  power_level: number;
  rating: number | null;
  matched_go_player_id: string | null;
};

type GoPlayerMatchRow = {
  id: string;
  source: GoPlayerSource;
  first_name_th_normalized: string;
  last_name_th_normalized: string;
  rank: string | null;
  power_level: number;
  rating: number | null;
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
    syncedProfiles: await syncVerifiedProfilesFromGoDatabase(),
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
      syncedProfiles: await syncVerifiedProfilesFromGoDatabase(),
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

export async function syncVerifiedProfilesFromGoDatabase(): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const { data: profiles, error: profilesError } = await supabase
    .from("player_profiles")
    .select("id,first_name_th,last_name_th,rank,power_level,rating,matched_go_player_id")
    .eq("rank_status", "verified");

  if (profilesError) {
    throw profilesError;
  }

  if (!profiles?.length) {
    return 0;
  }

  const { data: goPlayers, error: goPlayersError } = await supabase
    .from("go_player_database")
    .select("id,source,first_name_th_normalized,last_name_th_normalized,rank,power_level,rating")
    .not("rank", "is", null);

  if (goPlayersError) {
    throw goPlayersError;
  }

  if (!goPlayers?.length) {
    return 0;
  }

  const matchesByName = new Map<string, GoPlayerMatchRow[]>();

  for (const row of goPlayers as GoPlayerMatchRow[]) {
    const key = getNormalizedNameKey(row.first_name_th_normalized, row.last_name_th_normalized);
    const matches = matchesByName.get(key);

    if (matches) {
      matches.push(row);
    } else {
      matchesByName.set(key, [row]);
    }
  }

  let syncedProfiles = 0;

  for (const profile of profiles as VerifiedProfileRow[]) {
    const key = getNormalizedNameKey(
      normalizeThaiName(profile.first_name_th),
      normalizeThaiName(profile.last_name_th),
    );
    const bestMatch = chooseBestGoPlayerMatch(matchesByName.get(key) ?? []);

    if (!bestMatch?.rank) {
      continue;
    }

    const shouldUpdate =
      profile.rank !== bestMatch.rank ||
      profile.power_level !== bestMatch.power_level ||
      profile.rating !== bestMatch.rating ||
      profile.matched_go_player_id !== bestMatch.id;

    if (!shouldUpdate) {
      continue;
    }

    const { error } = await supabase
      .from("player_profiles")
      .update({
        rank: bestMatch.rank,
        power_level: bestMatch.power_level,
        rating: bestMatch.rating,
        matched_go_player_id: bestMatch.id,
        rank_status: "verified",
      })
      .eq("id", profile.id);

    if (error) {
      throw error;
    }

    syncedProfiles += 1;
  }

  return syncedProfiles;
}

function getNormalizedNameKey(firstName: string, lastName: string): string {
  return `${firstName}|${lastName}`;
}

function chooseBestGoPlayerMatch(matches: GoPlayerMatchRow[]): GoPlayerMatchRow | null {
  return [...matches].sort(compareGoPlayerMatches)[0] ?? null;
}

function compareGoPlayerMatches(a: GoPlayerMatchRow, b: GoPlayerMatchRow): number {
  const sourcePriority = getSourcePriority(a.source) - getSourcePriority(b.source);

  if (sourcePriority !== 0) {
    return sourcePriority;
  }

  if (a.power_level !== b.power_level) {
    return b.power_level - a.power_level;
  }

  return (b.rating ?? Number.NEGATIVE_INFINITY) - (a.rating ?? Number.NEGATIVE_INFINITY);
}

function getSourcePriority(source: GoPlayerSource): number {
  return source === "dan" ? 1 : 2;
}

function readImportedRowsFromCliOutput(output: string): number | null {
  try {
    const parsed = JSON.parse(output) as { rows?: Array<{ imported_rows?: number }> };
    return parsed.rows?.[0]?.imported_rows ?? null;
  } catch {
    return null;
  }
}
