export const schoolDatabaseDir = (
  process.env.SCHOOL_DATABASE_DIR ??
  process.env.GO_DATABASE_DIR ??
  "D:/Programming/Database"
).replace(/[\\/]$/, "");

export const schoolDatabaseFileName = "SCHOOL_Database.xlsx";
export const schoolDatabaseLabel = "SCHOOL";

export function getSchoolDatabaseFilePath(): string {
  return `${schoolDatabaseDir}/${schoolDatabaseFileName}`;
}
