import type { SupabaseClient } from "@supabase/supabase-js";

export type SchoolSearchResult = {
  id: string;
  seq: string | null;
  name: string;
  keywords: string[];
  matchType: "exact" | "keyword" | "fuzzy";
  similarityScore: number;
};

type RpcSchoolSearchResult = {
  id: string;
  seq: string | null;
  name: string;
  keywords: string[] | null;
  match_type: "exact" | "keyword" | "fuzzy";
  similarity_score: number;
};

export async function searchSchoolDatabase(
  supabase: SupabaseClient,
  query: string,
  limit = 8,
): Promise<SchoolSearchResult[]> {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return [];
  }

  const { data, error } = await supabase.rpc("search_school_database", {
    p_query: trimmedQuery,
    p_limit: limit,
  });

  if (error) {
    throw error;
  }

  return ((data ?? []) as RpcSchoolSearchResult[]).map((row) => ({
    id: row.id,
    seq: row.seq,
    name: row.name,
    keywords: row.keywords ?? [],
    matchType: row.match_type,
    similarityScore: row.similarity_score,
  }));
}
