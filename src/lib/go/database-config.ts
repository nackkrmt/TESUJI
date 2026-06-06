import type { GoPlayerSource } from "./excel-import";

export type GoDatabaseSourceFile = {
  source: GoPlayerSource;
  label: string;
  fileName: string;
};

export const goDatabaseSourceFiles: GoDatabaseSourceFile[] = [
  { source: "dan", label: "DAN", fileName: "DAN_Database.xlsx" },
  { source: "kyu", label: "KYU", fileName: "KYU_Database.xlsx" },
  { source: "award", label: "AWARD", fileName: "AWARD_Database.xlsx" },
];

export function getGoDatabaseSourceFile(source: GoPlayerSource): GoDatabaseSourceFile {
  const sourceFile = goDatabaseSourceFiles.find((item) => item.source === source);

  if (!sourceFile) {
    throw new Error(`Unknown go database source: ${source}`);
  }

  return sourceFile;
}
