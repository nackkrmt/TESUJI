import path from "node:path";
import { parseGoPlayerWorkbook, type GoPlayerSource } from "../src/lib/go/excel-import";

const databaseDir = process.env.GO_DATABASE_DIR ?? "D:\\Programming\\Database";

const files: Array<{ source: GoPlayerSource; fileName: string }> = [
  { source: "dan", fileName: "DAN_Database.xlsx" },
  { source: "kyu", fileName: "KYU_Database.xlsx" },
  { source: "award", fileName: "AWARD_Database.xlsx" },
];

async function main() {
  for (const file of files) {
    const filePath = path.join(databaseDir, file.fileName);
    const result = await parseGoPlayerWorkbook(filePath, file.source);
    const skipReasons = result.skippedRows.reduce<Record<string, number>>((summary, row) => {
      summary[row.reason] = (summary[row.reason] ?? 0) + 1;
      return summary;
    }, {});

    console.log(`${file.fileName}`);
    console.log(`  source: ${result.source}`);
    console.log(`  importable rows: ${result.importedRows.length}`);
    console.log(`  skipped rows: ${result.skippedRows.length}`);

    if (Object.keys(skipReasons).length > 0) {
      console.log("  skip reasons:");
      for (const [reason, count] of Object.entries(skipReasons)) {
        console.log(`    ${reason}: ${count}`);
      }
    }

    const samples = result.importedRows.slice(0, 3);
    if (samples.length > 0) {
      console.log("  samples:");
      for (const sample of samples) {
        console.log(
          `    ${sample.first_name_th} ${sample.last_name_th} -> ${sample.rank} (${sample.power_level}) [${sample.source}]`,
        );
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
