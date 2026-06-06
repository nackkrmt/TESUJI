import type { GoPlayerImportRow, GoPlayerSource } from "./excel-import";
import { normalizeThaiName } from "./normalize-thai";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type GoDatabaseSupabaseImportResult = {
  importedRows: number;
  syncedProfiles: number;
  strategy: "supabase-js";
};

type VerifiedProfileRow = {
  id: string;
  first_name_th: string;
  last_name_th: string;
  rank: string;
  power_level: number;
  rating: number | null;
  matched_go_player_id: string | null;
};

type GoPlayerMatchRow = {
  id: string;
  source: GoPlayerSource;
  first_name_th_normalized: string;
  last_name_th_normalized: string;
  rank: string | null;
  power_level: number;
  rating: number | null;
};

type VerifiedProfileUpdate = {
  profileId: string;
  rank: string;
  powerLevel: number;
  rating: number | null;
  matchedGoPlayerId: string;
};

const PROFILE_SYNC_BATCH_SIZE = 10;

export async function replaceGoPlayerDatabaseSourceInSupabase(
  source: GoPlayerSource,
  rows: GoPlayerImportRow[],
): Promise<GoDatabaseSupabaseImportResult> {
  const payload = rowsToSupabasePayload(rows);
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("replace_go_player_database_source", {
    p_source: source,
    p_rows: payload,
  });

  if (error) {
    throw error;
  }

  return {
    importedRows: typeof data === "number" ? data : payload.length,
    syncedProfiles: await syncVerifiedProfilesFromGoDatabase(),
    strategy: "supabase-js",
  };
}

function rowsToSupabasePayload(rows: GoPlayerImportRow[]) {
  return rows.map((row) => ({
    seq: row.seq,
    prefix_th: row.prefix_th,
    first_name_th: row.first_name_th,
    last_name_th: row.last_name_th,
    first_name_th_normalized: row.first_name_th_normalized,
    last_name_th_normalized: row.last_name_th_normalized,
    rank: row.rank,
    power_level: row.power_level,
    rating: row.rating,
    year_promoted: row.year_promoted,
    diamond: row.diamond,
    category: row.category,
    rank_in_category: row.rank_in_category,
    rank_award: row.rank_award,
    event_name: row.event_name,
    event_date: row.event_date,
    raw_data: row.raw_data,
  }));
}

export async function syncVerifiedProfilesFromGoDatabase(): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const { data: profiles, error: profilesError } = await supabase
    .from("player_profiles")
    .select("id,first_name_th,last_name_th,rank,power_level,rating,matched_go_player_id")
    .eq("rank_status", "verified");

  if (profilesError) {
    throw profilesError;
  }

  if (!profiles?.length) {
    return 0;
  }

  const { data: goPlayers, error: goPlayersError } = await supabase
    .from("go_player_database")
    .select("id,source,first_name_th_normalized,last_name_th_normalized,rank,power_level,rating")
    .not("rank", "is", null);

  if (goPlayersError) {
    throw goPlayersError;
  }

  if (!goPlayers?.length) {
    return 0;
  }

  const matchesByName = new Map<string, GoPlayerMatchRow[]>();

  for (const row of goPlayers as GoPlayerMatchRow[]) {
    const key = getNormalizedNameKey(row.first_name_th_normalized, row.last_name_th_normalized);
    const matches = matchesByName.get(key);

    if (matches) {
      matches.push(row);
    } else {
      matchesByName.set(key, [row]);
    }
  }

  const updates: VerifiedProfileUpdate[] = [];

  for (const profile of profiles as VerifiedProfileRow[]) {
    const key = getNormalizedNameKey(
      normalizeThaiName(profile.first_name_th),
      normalizeThaiName(profile.last_name_th),
    );
    const bestMatch = chooseBestGoPlayerMatch(matchesByName.get(key) ?? []);

    if (!bestMatch?.rank) {
      continue;
    }

    const shouldUpdate =
      profile.rank !== bestMatch.rank ||
      profile.power_level !== bestMatch.power_level ||
      profile.rating !== bestMatch.rating ||
      profile.matched_go_player_id !== bestMatch.id;

    if (!shouldUpdate) {
      continue;
    }

    updates.push({
      profileId: profile.id,
      rank: bestMatch.rank,
      powerLevel: bestMatch.power_level,
      rating: bestMatch.rating,
      matchedGoPlayerId: bestMatch.id,
    });
  }

  for (let index = 0; index < updates.length; index += PROFILE_SYNC_BATCH_SIZE) {
    const batch = updates.slice(index, index + PROFILE_SYNC_BATCH_SIZE);
    const results = await Promise.all(
      batch.map((update) =>
        supabase
          .from("player_profiles")
          .update({
            rank: update.rank,
            power_level: update.powerLevel,
            rating: update.rating,
            matched_go_player_id: update.matchedGoPlayerId,
            rank_status: "verified",
          })
          .eq("id", update.profileId),
      ),
    );
    const error = results.find((result) => result.error)?.error;

    if (error) {
      throw error;
    }
  }

  return updates.length;
}

function getNormalizedNameKey(firstName: string, lastName: string): string {
  return `${firstName}|${lastName}`;
}

function chooseBestGoPlayerMatch(matches: GoPlayerMatchRow[]): GoPlayerMatchRow | null {
  return [...matches].sort(compareGoPlayerMatches)[0] ?? null;
}

function compareGoPlayerMatches(a: GoPlayerMatchRow, b: GoPlayerMatchRow): number {
  const sourcePriority = getSourcePriority(a.source) - getSourcePriority(b.source);

  if (sourcePriority !== 0) {
    return sourcePriority;
  }

  if (a.power_level !== b.power_level) {
    return b.power_level - a.power_level;
  }

  return (b.rating ?? Number.NEGATIVE_INFINITY) - (a.rating ?? Number.NEGATIVE_INFINITY);
}

function getSourcePriority(source: GoPlayerSource): number {
  return source === "dan" ? 1 : 2;
}
