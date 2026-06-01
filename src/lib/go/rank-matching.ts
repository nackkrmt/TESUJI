import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeThaiName } from "./normalize-thai";

export type GoPlayerCandidate = {
  id: string;
  source: "dan" | "kyu" | "award";
  firstNameTh: string;
  lastNameTh: string;
  rank: string;
  powerLevel: number;
  rating: number | null;
  matchType: "exact" | "normalized" | "fuzzy";
  similarityScore: number;
  yearPromoted: number | null;
  diamond: string | null;
  category: string | null;
  rankInCategory: string | null;
  rankAward: number | null;
  eventName: string | null;
  eventDate: string | null;
  evidence: string[];
};

export type RankMatchResult =
  | {
      status: "matched";
      candidate: GoPlayerCandidate;
      candidates: GoPlayerCandidate[];
    }
  | {
      status: "multiple";
      candidates: GoPlayerCandidate[];
    }
  | {
      status: "not_found";
      candidates: [];
    };

type RpcCandidate = {
  id: string;
  source: "dan" | "kyu" | "award";
  first_name_th: string;
  last_name_th: string;
  rank: string;
  power_level: number;
  rating: number | null;
  match_type: "exact" | "normalized" | "fuzzy";
  similarity_score: number;
  year_promoted: number | null;
  diamond: string | null;
  category: string | null;
  rank_in_category: string | null;
  rank_award: number | null;
  event_name: string | null;
  event_date: string | null;
  raw_data: Record<string, unknown> | null;
};

export async function matchGoPlayerRank(
  supabase: SupabaseClient,
  firstNameTh: string,
  lastNameTh: string,
): Promise<RankMatchResult> {
  const danCandidates = await searchCandidates(supabase, firstNameTh, lastNameTh, ["dan"]);

  if (danCandidates.length > 0) {
    return toMatchResult(danCandidates);
  }

  const kyuAwardCandidates = await searchCandidates(supabase, firstNameTh, lastNameTh, [
    "kyu",
    "award",
  ]);
  const strongestCandidates = keepStrongestCandidatePerPerson(kyuAwardCandidates);

  return toMatchResult(strongestCandidates);
}

async function searchCandidates(
  supabase: SupabaseClient,
  firstNameTh: string,
  lastNameTh: string,
  sources: Array<"dan" | "kyu" | "award">,
): Promise<GoPlayerCandidate[]> {
  const { data, error } = await supabase.rpc("search_go_player_database", {
    p_first_name_th: firstNameTh,
    p_last_name_th: lastNameTh,
    p_sources: sources,
    p_limit: 10,
  });

  if (error) {
    throw error;
  }

  return ((data ?? []) as RpcCandidate[]).map(toGoPlayerCandidate);
}

function toGoPlayerCandidate(candidate: RpcCandidate): GoPlayerCandidate {
  return {
    id: candidate.id,
    source: candidate.source,
    firstNameTh: candidate.first_name_th,
    lastNameTh: candidate.last_name_th,
    rank: candidate.rank,
    powerLevel: candidate.power_level,
    rating: candidate.rating,
    matchType: candidate.match_type,
    similarityScore: candidate.similarity_score,
    yearPromoted: candidate.year_promoted,
    diamond: candidate.diamond,
    category: candidate.category,
    rankInCategory: candidate.rank_in_category,
    rankAward: candidate.rank_award,
    eventName: candidate.event_name,
    eventDate: candidate.event_date,
    evidence: buildEvidence(candidate),
  };
}

function buildEvidence(candidate: RpcCandidate): string[] {
  if (candidate.source === "dan") {
    return [
      candidate.year_promoted ? `สอบผ่านปี ${candidate.year_promoted}` : null,
      candidate.rating ? `rating ${candidate.rating}` : null,
      candidate.diamond ? `diamond ${candidate.diamond}` : null,
    ].filter(Boolean) as string[];
  }

  if (candidate.source === "kyu") {
    return [
      candidate.event_date ? `สอบผ่านวันที่ ${formatEvidenceDate(candidate.event_date)}` : null,
    ].filter(Boolean) as string[];
  }

  return [
    candidate.rank_award ? `ได้อันดับ ${candidate.rank_award}` : null,
    candidate.category ? `รุ่น ${candidate.category}` : null,
    candidate.rank_in_category ? `กลุ่ม ${candidate.rank_in_category}` : null,
    candidate.event_name ? `งาน ${candidate.event_name}` : null,
    candidate.event_date ? `วันที่ ${formatEvidenceDate(candidate.event_date)}` : null,
  ].filter(Boolean) as string[];
}

function formatEvidenceDate(value: string): string {
  const parsed = Date.parse(value);

  if (Number.isNaN(parsed)) {
    return value;
  }

  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeZone: "Asia/Bangkok",
  }).format(new Date(parsed));
}

function keepStrongestCandidatePerPerson(candidates: GoPlayerCandidate[]): GoPlayerCandidate[] {
  const byName = new Map<string, GoPlayerCandidate>();

  for (const candidate of candidates) {
    const key = `${normalizeThaiName(candidate.firstNameTh)}|${normalizeThaiName(candidate.lastNameTh)}`;
    const existing = byName.get(key);

    if (!existing || shouldReplaceCandidate(existing, candidate)) {
      byName.set(key, candidate);
    }
  }

  return [...byName.values()]
    .sort(compareCandidates)
    .slice(0, 5);
}

function toMatchResult(candidates: GoPlayerCandidate[]): RankMatchResult {
  const topCandidates = candidates.sort(compareCandidates).slice(0, 5);

  if (topCandidates.length === 0) {
    return { status: "not_found", candidates: [] };
  }

  if (topCandidates.length === 1) {
    return {
      status: "matched",
      candidate: topCandidates[0],
      candidates: topCandidates,
    };
  }

  return {
    status: "multiple",
    candidates: topCandidates,
  };
}

function shouldReplaceCandidate(
  existing: GoPlayerCandidate,
  candidate: GoPlayerCandidate,
): boolean {
  if (candidate.powerLevel !== existing.powerLevel) {
    return candidate.powerLevel > existing.powerLevel;
  }

  return compareCandidates(candidate, existing) < 0;
}

function compareCandidates(a: GoPlayerCandidate, b: GoPlayerCandidate): number {
  const matchTypeRank = { exact: 0, normalized: 1, fuzzy: 2 };
  const matchTypeDiff = matchTypeRank[a.matchType] - matchTypeRank[b.matchType];

  if (matchTypeDiff !== 0) {
    return matchTypeDiff;
  }

  if (b.similarityScore !== a.similarityScore) {
    return b.similarityScore - a.similarityScore;
  }

  return b.powerLevel - a.powerLevel;
}
