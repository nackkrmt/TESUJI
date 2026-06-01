import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { parseGoPlayerWorkbook, type GoPlayerSource } from "../src/lib/go/excel-import";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
const databaseDir = process.env.GO_DATABASE_DIR ?? "D:\\Programming\\Database";

if (!supabaseUrl) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
}

if (!serviceKey) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY");
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
});

const files: Array<{ source: GoPlayerSource; fileName: string }> = [
  { source: "dan", fileName: "DAN_Database.xlsx" },
  { source: "kyu", fileName: "KYU_Database.xlsx" },
  { source: "award", fileName: "AWARD_Database.xlsx" },
];

async function main() {
  for (const file of files) {
    const filePath = path.join(databaseDir, file.fileName);
    const parsed = await parseGoPlayerWorkbook(filePath, file.source);

    console.log(`${file.fileName}`);
    console.log(`  deleting existing ${file.source} rows`);

    const deleteResult = await supabase
      .from("go_player_database")
      .delete()
      .eq("source", file.source);

    if (deleteResult.error) {
      throw deleteResult.error;
    }

    console.log(`  inserting ${parsed.importedRows.length} rows`);

    for (const chunk of chunks(parsed.importedRows, 500)) {
      const insertResult = await supabase.from("go_player_database").insert(chunk);

      if (insertResult.error) {
        throw insertResult.error;
      }
    }

    console.log(`  skipped ${parsed.skippedRows.length} rows`);
  }
}

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }

  return result;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
