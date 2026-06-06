import {
  getLatestDatabaseImportRun,
  type DatabaseImportRun,
  type DatabaseImportSkipReason,
} from "@/lib/database/import-runs";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { goDatabaseSourceFiles } from "./database-config";
import type { GoPlayerSource } from "./excel-import";

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;

export type GoDatabaseSummary = {
  source: GoPlayerSource;
  label: string;
  fileName: string;
  latestUpload: DatabaseImportRun | null;
  supabaseRows: number;
  importableRows: number;
  skippedRows: number;
  skipReasons: DatabaseImportSkipReason[];
  samples: Array<{
    name: string;
    rank: string;
    powerLevel: number;
  }>;
  error?: string;
};

type GoPlayerSampleRow = {
  first_name_th: string;
  last_name_th: string;
  rank: string | null;
  power_level: number;
};

export async function getGoDatabaseSummaries(): Promise<GoDatabaseSummary[]> {
  const supabase = createSupabaseAdminClient();

  return Promise.all(
    goDatabaseSourceFiles.map(async (sourceFile) => {
      try {
        const [latestUpload, rowCount, samples] = await Promise.all([
          getLatestDatabaseImportRun(sourceFile.source),
          getGoDatabaseSourceRowCount(supabase, sourceFile.source),
          getGoDatabaseSamples(supabase, sourceFile.source),
        ]);

        return {
          ...sourceFile,
          latestUpload,
          supabaseRows: rowCount,
          importableRows: latestUpload?.importableRows ?? 0,
          skippedRows: latestUpload?.skippedRows ?? 0,
          skipReasons: latestUpload?.skipReasons ?? [],
          samples,
        };
      } catch (error) {
        return {
          ...sourceFile,
          latestUpload: null,
          supabaseRows: 0,
          importableRows: 0,
          skippedRows: 0,
          skipReasons: [],
          samples: [],
          error: error instanceof Error ? error.message : "Unable to read Supabase data.",
        };
      }
    }),
  );
}

async function getGoDatabaseSourceRowCount(
  supabase: SupabaseAdminClient,
  source: GoPlayerSource,
): Promise<number> {
  const { count, error } = await supabase
    .from("go_player_database")
    .select("id", { count: "exact", head: true })
    .eq("source", source);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

async function getGoDatabaseSamples(
  supabase: SupabaseAdminClient,
  source: GoPlayerSource,
) {
  const { data, error } = await supabase
    .from("go_player_database")
    .select("first_name_th,last_name_th,rank,power_level")
    .eq("source", source)
    .order("uploaded_at", { ascending: false })
    .order("power_level", { ascending: false })
    .limit(4);

  if (error) {
    throw error;
  }

  return ((data ?? []) as GoPlayerSampleRow[]).map((row) => ({
    name: `${row.first_name_th} ${row.last_name_th}`,
    rank: row.rank ?? "-",
    powerLevel: row.power_level,
  }));
}
