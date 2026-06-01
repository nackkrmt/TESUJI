export type RankParseResult = {
  rank: string;
  powerLevel: number;
};

export function parseNumberLike(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) {
      return null;
    }

    const parsed = Number(trimmed.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function parseDanRank(value: unknown): RankParseResult | null {
  const dan = parseNumberLike(value);

  if (!dan || !Number.isInteger(dan) || dan < 1 || dan > 9) {
    return null;
  }

  return {
    rank: `${dan} Dan`,
    powerLevel: 16 + dan,
  };
}

export function parseKyuRank(value: unknown): RankParseResult | null {
  const rawKyu = parseNumberLike(value);

  if (!rawKyu || !Number.isInteger(rawKyu) || rawKyu < 1) {
    return null;
  }

  const kyu = rawKyu >= 16 ? 15 : rawKyu;

  return {
    rank: `${kyu} Kyu`,
    powerLevel: 17 - kyu,
  };
}

export function rankToPowerLevel(rank: string): number | null {
  const trimmed = rank.trim();
  const kyu = trimmed.match(/^(\d+)\s*Kyu$/i);

  if (kyu) {
    return parseKyuRank(kyu[1])?.powerLevel ?? null;
  }

  const dan = trimmed.match(/^(\d+)\s*Dan$/i);

  if (dan) {
    return parseDanRank(dan[1])?.powerLevel ?? null;
  }

  if (trimmed === "9x9") {
    return 0;
  }

  if (trimmed === "13x13") {
    return 1;
  }

  return null;
}

