import type { GoPlayerSource } from "@/lib/go/excel-import";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type DatabaseImportSource = GoPlayerSource | "school";
export type DatabaseImportStatus = "success" | "error";

export type DatabaseImportSkipReason = {
  reason: string;
  count: number;
};

export type DatabaseImportRun = {
  id: string;
  source: DatabaseImportSource;
  status: DatabaseImportStatus;
  originalFileName: string;
  importableRows: number;
  skippedRows: number;
  supabaseImportedRows: number;
  syncedProfiles: number | null;
  supabaseStrategy: string | null;
  skipReasons: DatabaseImportSkipReason[];
  errorMessage: string | null;
  uploadedAt: string;
};

type DatabaseImportRunRow = {
  id: string;
  source: DatabaseImportSource;
  status: DatabaseImportStatus;
  original_file_name: string;
  importable_rows: number;
  skipped_rows: number;
  supabase_imported_rows: number;
  synced_profiles: number | null;
  supabase_strategy: string | null;
  skip_reasons: unknown;
  error_message: string | null;
  uploaded_at: string;
};

export type RecordDatabaseImportRunInput = {
  source: DatabaseImportSource;
  status: DatabaseImportStatus;
  originalFileName: string;
  importableRows: number;
  skippedRows: number;
  supabaseImportedRows: number;
  syncedProfiles?: number | null;
  supabaseStrategy?: string | null;
  skipReasons?: DatabaseImportSkipReason[];
  errorMessage?: string | null;
};

export async function recordDatabaseImportRun(
  input: RecordDatabaseImportRunInput,
): Promise<DatabaseImportRun | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("database_import_runs")
    .insert({
      source: input.source,
      status: input.status,
      original_file_name: input.originalFileName,
      importable_rows: input.importableRows,
      skipped_rows: input.skippedRows,
      supabase_imported_rows: input.supabaseImportedRows,
      synced_profiles: input.syncedProfiles ?? null,
      supabase_strategy: input.supabaseStrategy ?? null,
      skip_reasons: input.skipReasons ?? [],
      error_message: input.errorMessage ?? null,
    })
    .select(
      "id,source,status,original_file_name,importable_rows,skipped_rows,supabase_imported_rows,synced_profiles,supabase_strategy,skip_reasons,error_message,uploaded_at",
    )
    .single();

  if (error) {
    throw error;
  }

  return data ? mapDatabaseImportRun(data as DatabaseImportRunRow) : null;
}

export async function tryRecordDatabaseImportRun(
  input: RecordDatabaseImportRunInput,
): Promise<DatabaseImportRun | null> {
  try {
    return await recordDatabaseImportRun(input);
  } catch {
    return null;
  }
}

export async function getLatestDatabaseImportRun(
  source: DatabaseImportSource,
): Promise<DatabaseImportRun | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("database_import_runs")
    .select(
      "id,source,status,original_file_name,importable_rows,skipped_rows,supabase_imported_rows,synced_profiles,supabase_strategy,skip_reasons,error_message,uploaded_at",
    )
    .eq("source", source)
    .order("uploaded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return null;
  }

  return data ? mapDatabaseImportRun(data as DatabaseImportRunRow) : null;
}

export function countSkipReasons(rows: Array<{ reason: string }>): DatabaseImportSkipReason[] {
  const counts = rows.reduce<Record<string, number>>((summary, row) => {
    summary[row.reason] = (summary[row.reason] ?? 0) + 1;
    return summary;
  }, {});

  return Object.entries(counts).map(([reason, count]) => ({ reason, count }));
}

function mapDatabaseImportRun(row: DatabaseImportRunRow): DatabaseImportRun {
  return {
    id: row.id,
    source: row.source,
    status: row.status,
    originalFileName: row.original_file_name,
    importableRows: row.importable_rows,
    skippedRows: row.skipped_rows,
    supabaseImportedRows: row.supabase_imported_rows,
    syncedProfiles: row.synced_profiles,
    supabaseStrategy: row.supabase_strategy,
    skipReasons: parseSkipReasons(row.skip_reasons),
    errorMessage: row.error_message,
    uploadedAt: row.uploaded_at,
  };
}

function parseSkipReasons(value: unknown): DatabaseImportSkipReason[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (
        typeof item !== "object" ||
        item === null ||
        !("reason" in item) ||
        !("count" in item)
      ) {
        return null;
      }

      const reason = String(item.reason);
      const count = Number(item.count);

      if (!reason || !Number.isFinite(count)) {
        return null;
      }

      return { reason, count };
    })
    .filter((item): item is DatabaseImportSkipReason => item !== null);
}
