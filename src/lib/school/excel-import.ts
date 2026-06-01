import ExcelJS from "exceljs";
import { normalizeThaiName } from "@/lib/go/normalize-thai";

export type SchoolImportRow = {
  seq: string | null;
  name: string;
  name_normalized: string;
  keywords: string[];
  search_text: string;
  search_text_normalized: string;
  raw_data: Record<string, unknown>;
};

export type SkippedSchoolImportRow = {
  rowNumber: number;
  reason: string;
  raw: Record<string, unknown>;
};

export type ParsedSchoolWorkbook = {
  importedRows: SchoolImportRow[];
  skippedRows: SkippedSchoolImportRow[];
};

type RawSheetRow = Record<string, unknown>;

const requiredColumns = ["seq", "name", "keywords"];

export async function validateSchoolWorkbookHeaders(filePath: string): Promise<string[]> {
  const { headers } = await readFirstWorksheet(filePath);
  const headerSet = new Set(headers);

  return requiredColumns.filter((column) => !headerSet.has(column));
}

export async function parseSchoolWorkbook(filePath: string): Promise<ParsedSchoolWorkbook> {
  const missingColumns = await validateSchoolWorkbookHeaders(filePath);

  if (missingColumns.length > 0) {
    throw new Error(`SCHOOL missing columns: ${missingColumns.join(", ")}`);
  }

  const { rows: rawRows } = await readFirstWorksheet(filePath);
  const byName = new Map<string, SchoolImportRow>();
  const skippedRows: SkippedSchoolImportRow[] = [];

  rawRows.forEach((raw, index) => {
    const rowNumber = index + 2;
    const name = toNullableString(raw.name);

    if (!name) {
      skippedRows.push(skipRow(rowNumber, "missing_school_name", raw));
      return;
    }

    const row = toSchoolImportRow(raw, name);
    const existing = byName.get(row.name_normalized);

    if (existing) {
      existing.keywords = mergeKeywords(existing.keywords, row.keywords);
      existing.search_text = buildSearchText(existing.name, existing.keywords);
      existing.search_text_normalized = normalizeSchoolSearchText(existing.search_text);
      existing.raw_data = {
        ...existing.raw_data,
        merged_duplicate_rows: [
          ...readMergedDuplicateRows(existing.raw_data),
          { rowNumber, raw },
        ],
      };
      skippedRows.push(skipRow(rowNumber, "duplicate_school_name_merged", raw));
      return;
    }

    byName.set(row.name_normalized, row);
  });

  return {
    importedRows: [...byName.values()],
    skippedRows,
  };
}

async function readFirstWorksheet(filePath: string): Promise<{
  headers: string[];
  rows: RawSheetRow[];
}> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const worksheet = workbook.worksheets[0];

  if (!worksheet) {
    throw new Error(`Workbook has no worksheets: ${filePath}`);
  }

  const headerRow = worksheet.getRow(1);
  const headers: string[] = [];

  headerRow.eachCell({ includeEmpty: true }, (cell) => {
    headers.push(String(cellToPrimitive(cell.value) ?? "").trim().toLowerCase());
  });

  const rows: RawSheetRow[] = [];

  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const raw: RawSheetRow = {};

    headers.forEach((header, index) => {
      if (!header) {
        return;
      }

      raw[header] = cellToPrimitive(row.getCell(index + 1).value);
    });

    if (Object.values(raw).some((value) => value !== null && String(value).trim() !== "")) {
      rows.push(raw);
    }
  }

  return {
    headers: headers.filter(Boolean),
    rows,
  };
}

function toSchoolImportRow(raw: RawSheetRow, name: string): SchoolImportRow {
  const keywords = splitKeywords(raw.keywords);
  const searchText = buildSearchText(name, keywords);

  return {
    seq: toNullableString(raw.seq),
    name,
    name_normalized: normalizeSchoolSearchText(name),
    keywords,
    search_text: searchText,
    search_text_normalized: normalizeSchoolSearchText(searchText),
    raw_data: raw,
  };
}

function cellToPrimitive(value: ExcelJS.CellValue): unknown {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date || typeof value === "string" || typeof value === "number") {
    return value;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "object" && "result" in value) {
    return cellToPrimitive(value.result as ExcelJS.CellValue);
  }

  if (typeof value === "object" && "error" in value) {
    return null;
  }

  if (typeof value === "object" && "text" in value) {
    return value.text;
  }

  if (typeof value === "object" && "richText" in value) {
    return value.richText.map((part) => part.text).join("");
  }

  return null;
}

function splitKeywords(value: unknown): string[] {
  const raw = toNullableString(value);

  if (!raw) {
    return [];
  }

  return mergeKeywords(raw.split(/[|\n;,]+/).map((item) => item.trim()).filter(Boolean));
}

function mergeKeywords(...groups: string[][]): string[] {
  const byNormalized = new Map<string, string>();

  for (const keyword of groups.flat()) {
    const normalized = normalizeSchoolSearchText(keyword);

    if (normalized && !byNormalized.has(normalized)) {
      byNormalized.set(normalized, keyword);
    }
  }

  return [...byNormalized.values()];
}

function buildSearchText(name: string, keywords: string[]): string {
  return [name, ...keywords].join(" ").trim();
}

function normalizeSchoolSearchText(value: string): string {
  return normalizeThaiName(value).toLowerCase();
}

function readMergedDuplicateRows(rawData: Record<string, unknown>): unknown[] {
  const existing = rawData.merged_duplicate_rows;
  return Array.isArray(existing) ? existing : [];
}

function skipRow(
  rowNumber: number,
  reason: string,
  raw: RawSheetRow,
): SkippedSchoolImportRow {
  return { rowNumber, reason, raw };
}

function toNullableString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim();

  if (!normalized || normalized === "#VALUE!" || normalized === "[object Object]") {
    return null;
  }

  return normalized;
}
