import ExcelJS from "exceljs";
import { normalizeThaiName } from "./normalize-thai";
import { parseAwardRankFromRankInCategory } from "./award";
import { parseDanRank, parseKyuRank, parseNumberLike } from "./ranks";

export type GoPlayerSource = "dan" | "kyu" | "award";

export type GoPlayerImportRow = {
  source: GoPlayerSource;
  seq: string | null;
  prefix_th: string | null;
  first_name_th: string;
  last_name_th: string;
  first_name_th_normalized: string;
  last_name_th_normalized: string;
  rank: string;
  power_level: number;
  rating: number | null;
  year_promoted: number | null;
  diamond: string | null;
  category: string | null;
  rank_in_category: string | null;
  rank_award: number | null;
  event_name: string | null;
  event_date: string | null;
  raw_data: Record<string, unknown>;
};

export type SkippedImportRow = {
  source: GoPlayerSource;
  rowNumber: number;
  reason: string;
  raw: Record<string, unknown>;
};

export type ParsedGoPlayerWorkbook = {
  source: GoPlayerSource;
  importedRows: GoPlayerImportRow[];
  skippedRows: SkippedImportRow[];
};

type RawSheetRow = Record<string, unknown>;
export type GoPlayerWorkbookInput = string | ArrayBuffer;

const requiredColumns: Record<GoPlayerSource, string[]> = {
  dan: ["seq", "prefix", "firstname", "lastname", "year", "rank", "diamond", "gat"],
  kyu: ["seq", "prefix", "firstname", "lastname", "rank", "date"],
  award: [
    "seq",
    "prefix",
    "firstname",
    "lastname",
    "phone",
    "category",
    "rank_in_category",
    "rank_award",
    "event_name",
    "date",
    "organizer",
  ],
};

export async function validateGoPlayerWorkbookHeaders(
  input: GoPlayerWorkbookInput,
  source: GoPlayerSource,
): Promise<string[]> {
  const { headers } = await readFirstWorksheet(input);
  const headerSet = new Set(headers);

  return requiredColumns[source].filter((column) => !headerSet.has(column));
}

export async function parseGoPlayerWorkbook(
  input: GoPlayerWorkbookInput,
  source: GoPlayerSource,
): Promise<ParsedGoPlayerWorkbook> {
  const missingColumns = await validateGoPlayerWorkbookHeaders(input, source);

  if (missingColumns.length > 0) {
    throw new Error(`${source.toUpperCase()} missing columns: ${missingColumns.join(", ")}`);
  }

  const { rows: rawRows } = await readFirstWorksheet(input);

  if (source === "dan") {
    return parseDanRows(rawRows);
  }

  if (source === "kyu") {
    return parseKyuRows(rawRows);
  }

  return parseAwardRows(rawRows);
}

async function readFirstWorksheet(input: GoPlayerWorkbookInput): Promise<{
  headers: string[];
  rows: RawSheetRow[];
}> {
  const workbook = new ExcelJS.Workbook();

  if (typeof input === "string") {
    await workbook.xlsx.readFile(input);
  } else {
    await workbook.xlsx.load(input);
  }

  const worksheet = workbook.worksheets[0];

  if (!worksheet) {
    throw new Error("Workbook has no worksheets.");
  }

  const headerRow = worksheet.getRow(1);
  const headers: string[] = [];

  headerRow.eachCell({ includeEmpty: true }, (cell) => {
    headers.push(String(cellToPrimitive(cell.value) ?? "").trim());
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

function parseDanRows(rawRows: RawSheetRow[]): ParsedGoPlayerWorkbook {
  const parsed: GoPlayerImportRow[] = [];
  const skipped: SkippedImportRow[] = [];

  rawRows.forEach((raw, index) => {
    const base = parseBaseNameFields(raw, "dan", index + 2);

    if ("skip" in base) {
      skipped.push(base.skip);
      return;
    }

    const rank = parseDanRank(raw.rank);

    if (!rank) {
      skipped.push(skipRow("dan", index + 2, "invalid_or_empty_dan_rank", raw));
      return;
    }

    parsed.push({
      ...base.row,
      rank: rank.rank,
      power_level: rank.powerLevel,
      rating: parseNumberLike(raw.gat),
      year_promoted: parseNumberLike(raw.year),
      diamond: toNullableString(raw.diamond),
      category: null,
      rank_in_category: null,
      rank_award: null,
      event_name: null,
      event_date: null,
      raw_data: raw,
    });
  });

  return { source: "dan", importedRows: parsed, skippedRows: skipped };
}

function parseKyuRows(rawRows: RawSheetRow[]): ParsedGoPlayerWorkbook {
  const byName = new Map<string, GoPlayerImportRow>();
  const skipped: SkippedImportRow[] = [];

  rawRows.forEach((raw, index) => {
    const base = parseBaseNameFields(raw, "kyu", index + 2);

    if ("skip" in base) {
      skipped.push(base.skip);
      return;
    }

    const rank = parseKyuRank(raw.rank);

    if (!rank) {
      skipped.push(skipRow("kyu", index + 2, "invalid_or_empty_kyu_rank", raw));
      return;
    }

    const row: GoPlayerImportRow = {
      ...base.row,
      rank: rank.rank,
      power_level: rank.powerLevel,
      rating: null,
      year_promoted: null,
      diamond: null,
      category: null,
      rank_in_category: null,
      rank_award: null,
      event_name: null,
      event_date: toDateString(raw.date),
      raw_data: raw,
    };

    const key = `${row.first_name_th_normalized}|${row.last_name_th_normalized}`;
    const existing = byName.get(key);

    if (!existing || shouldReplaceKyuRow(existing, row)) {
      byName.set(key, row);
    }
  });

  return { source: "kyu", importedRows: [...byName.values()], skippedRows: skipped };
}

function parseAwardRows(rawRows: RawSheetRow[]): ParsedGoPlayerWorkbook {
  const parsed: GoPlayerImportRow[] = [];
  const skipped: SkippedImportRow[] = [];

  rawRows.forEach((raw, index) => {
    const base = parseBaseNameFields(raw, "award", index + 2);

    if ("skip" in base) {
      skipped.push(base.skip);
      return;
    }

    const rankAward = parseNumberLike(raw.rank_award);

    if (!rankAward || ![1, 2, 3].includes(rankAward)) {
      skipped.push(skipRow("award", index + 2, "rank_award_not_1_2_3", raw));
      return;
    }

    const rank = parseAwardRankFromRankInCategory(raw.rank_in_category);

    if (!rank) {
      skipped.push(skipRow("award", index + 2, "unmapped_rank_in_category", raw));
      return;
    }

    parsed.push({
      ...base.row,
      rank: rank.rank,
      power_level: rank.powerLevel,
      rating: null,
      year_promoted: null,
      diamond: null,
      category: toNullableString(raw.category),
      rank_in_category: toNullableString(raw.rank_in_category),
      rank_award: rankAward,
      event_name: toNullableString(raw.event_name),
      event_date: toDateString(raw.date),
      raw_data: {
        ...raw,
        phone: toNullableString(raw.phone),
        organizer: toNullableString(raw.organizer),
      },
    });
  });

  return { source: "award", importedRows: parsed, skippedRows: skipped };
}

function parseBaseNameFields(
  raw: RawSheetRow,
  source: GoPlayerSource,
  rowNumber: number,
):
  | {
      row: Pick<
        GoPlayerImportRow,
        | "source"
        | "seq"
        | "prefix_th"
        | "first_name_th"
        | "last_name_th"
        | "first_name_th_normalized"
        | "last_name_th_normalized"
      >;
    }
  | { skip: SkippedImportRow } {
  const firstName = toNullableString(raw.firstname);
  const lastName = toNullableString(raw.lastname);

  if (!firstName || !lastName) {
    return { skip: skipRow(source, rowNumber, "missing_first_or_last_name", raw) };
  }

  return {
    row: {
      source,
      seq: toNullableString(raw.seq),
      prefix_th: toNullableString(raw.prefix),
      first_name_th: firstName,
      last_name_th: lastName,
      first_name_th_normalized: normalizeThaiName(firstName),
      last_name_th_normalized: normalizeThaiName(lastName),
    },
  };
}

function shouldReplaceKyuRow(existing: GoPlayerImportRow, candidate: GoPlayerImportRow): boolean {
  if (candidate.power_level !== existing.power_level) {
    return candidate.power_level > existing.power_level;
  }

  const existingTime = Date.parse(existing.event_date ?? "");
  const candidateTime = Date.parse(candidate.event_date ?? "");

  if (Number.isNaN(candidateTime)) {
    return false;
  }

  if (Number.isNaN(existingTime)) {
    return true;
  }

  return candidateTime > existingTime;
}

function skipRow(
  source: GoPlayerSource,
  rowNumber: number,
  reason: string,
  raw: RawSheetRow,
): SkippedImportRow {
  return { source, rowNumber, reason, raw };
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

function toDateString(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }

  return toNullableString(value);
}
