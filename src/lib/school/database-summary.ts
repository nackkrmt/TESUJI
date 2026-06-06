import {
  getLatestDatabaseImportRun,
  type DatabaseImportRun,
  type DatabaseImportSkipReason,
} from "@/lib/database/import-runs";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { schoolDatabaseFileName, schoolDatabaseLabel } from "./database-config";

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;

export type SchoolDatabaseSummary = {
  source: "school";
  label: string;
  fileName: string;
  latestUpload: DatabaseImportRun | null;
  supabaseRows: number;
  importableRows: number;
  skippedRows: number;
  skipReasons: DatabaseImportSkipReason[];
  samples: Array<{
    name: string;
    keywords: string[];
  }>;
  error?: string;
};

type SchoolSampleRow = {
  name: string;
  keywords: string[] | null;
};

export async function getSchoolDatabaseSummary(): Promise<SchoolDatabaseSummary> {
  const supabase = createSupabaseAdminClient();
  const baseSummary = {
    source: "school" as const,
    label: schoolDatabaseLabel,
    fileName: schoolDatabaseFileName,
  };

  try {
    const [latestUpload, rowCount, samples] = await Promise.all([
      getLatestDatabaseImportRun("school"),
      getSchoolRowCount(supabase),
      getSchoolSamples(supabase),
    ]);

    return {
      ...baseSummary,
      latestUpload,
      supabaseRows: rowCount,
      importableRows: latestUpload?.importableRows ?? 0,
      skippedRows: latestUpload?.skippedRows ?? 0,
      skipReasons: latestUpload?.skipReasons ?? [],
      samples,
    };
  } catch (error) {
    return {
      ...baseSummary,
      latestUpload: null,
      supabaseRows: 0,
      importableRows: 0,
      skippedRows: 0,
      skipReasons: [],
      samples: [],
      error: error instanceof Error ? error.message : "Unable to read Supabase data.",
    };
  }
}

async function getSchoolRowCount(supabase: SupabaseAdminClient): Promise<number> {
  const { count, error } = await supabase
    .from("school_database")
    .select("id", { count: "exact", head: true });

  if (error) {
    throw error;
  }

  return count ?? 0;
}

async function getSchoolSamples(supabase: SupabaseAdminClient) {
  const { data, error } = await supabase
    .from("school_database")
    .select("name,keywords")
    .order("uploaded_at", { ascending: false })
    .order("name", { ascending: true })
    .limit(4);

  if (error) {
    throw error;
  }

  return ((data ?? []) as SchoolSampleRow[]).map((row) => ({
    name: row.name,
    keywords: row.keywords ?? [],
  }));
}
