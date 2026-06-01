import type { RankParseResult } from "./ranks";

const awardRankInCategoryToKyu = new Map<string, number>([
  ["9x9", 12],
  ["13x13", 12],
]);

export function normalizeAwardRankInCategory(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }

  const normalized = String(value).trim().replace(/\s+/g, " ");
  return normalized || null;
}

export function parseAwardRankFromRankInCategory(
  rankInCategory: unknown,
): RankParseResult | null {
  const normalized = normalizeAwardRankInCategory(rankInCategory);

  if (!normalized) {
    return null;
  }

  const kyu = awardRankInCategoryToKyu.get(normalized) ?? parseKyuFromRankInCategory(normalized);

  if (!kyu) {
    return null;
  }

  return {
    rank: `${kyu} Kyu`,
    powerLevel: 17 - kyu,
  };
}

export function getAwardRankInCategoryMap(): ReadonlyMap<string, number> {
  return awardRankInCategoryToKyu;
}

function parseKyuFromRankInCategory(value: string): number | null {
  const range = value.match(/^(\d+)\s*-\s*(\d+)(?:\s*Kyu)?$/i);

  if (range) {
    return awardKyuFromBestKyu(Math.min(Number(range[1]), Number(range[2])));
  }

  const single = value.match(/^(\d+)\s*Kyu$/i);

  if (single) {
    return awardKyuFromBestKyu(Number(single[1]));
  }

  return null;
}

function awardKyuFromBestKyu(bestKyu: number): number {
  return Math.min(15, Math.max(1, bestKyu - 1));
}
