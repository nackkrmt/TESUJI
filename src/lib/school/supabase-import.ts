import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SchoolImportRow } from "./excel-import";

export type SchoolDatabaseSupabaseImportResult = {
  importedRows: number;
  strategy: "supabase-js";
};

export async function replaceSchoolDatabaseInSupabase(
  rows: SchoolImportRow[],
): Promise<SchoolDatabaseSupabaseImportResult> {
  const payload = rowsToSupabasePayload(rows);
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

function rowsToSupabasePayload(rows: SchoolImportRow[]) {
  return rows.map((row) => ({
    seq: row.seq,
    name: row.name,
    keywords: row.keywords,
    raw_data: row.raw_data,
  }));
}
