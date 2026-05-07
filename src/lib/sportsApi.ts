import { getFunctions, httpsCallable } from "firebase/functions";
import { firebaseApp } from "./firebase";

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

function cacheGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(`sports_cache_${key}`);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (Date.now() > entry.expiresAt) {
      localStorage.removeItem(`sports_cache_${key}`);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

function cacheSet<T>(key: string, data: T, ttlMs: number): void {
  try {
    const entry: CacheEntry<T> = { data, expiresAt: Date.now() + ttlMs };
    localStorage.setItem(`sports_cache_${key}`, JSON.stringify(entry));
  } catch {
    // localStorage cheio — ignorar silenciosamente
  }
}

const TTL = {
  fixtures: 24 * 60 * 60 * 1000,    // 24h — fixtures do dia não mudam muito
  results:  60 * 60 * 1000,           // 1h — resultados mudam durante o jogo
  teams:    7 * 24 * 60 * 60 * 1000, // 7 dias — dados de times são estáticos
};

export interface Fixture {
  id: number;
  date: string;              // ISO datetime
  homeTeam: string;
  awayTeam: string;
  homeLogo: string;
  awayLogo: string;
  league: string;
  leagueLogo: string;
  country: string;
  status: "NS" | "FT" | "HT" | "1H" | "2H" | "ET" | "PEN" | "PST" | "CANC" | "ABD" | string;
  homeGoals: number | null;
  awayGoals: number | null;
}

export interface FixtureSearchResult {
  fixture: Fixture;
  displayLabel: string;
}

const functions = getFunctions(firebaseApp, "southamerica-east1");
const searchSportsFixturesCallable = httpsCallable<
  { query: string; limit?: number },
  FixtureSearchResult[]
>(functions, "searchSportsFixturesCallable");
const getSportsFixtureResultCallable = httpsCallable<
  { fixtureId: number },
  { homeGoals: number; awayGoals: number; status: string } | null
>(functions, "getSportsFixtureResultCallable");

export async function searchFixtures(query: string): Promise<FixtureSearchResult[]> {
  if (query.trim().length < 3) return [];

  const cacheKey = `search_${query.toLowerCase().trim()}`;
  const cached = cacheGet<FixtureSearchResult[]>(cacheKey);
  if (cached) return cached;

  try {
    const response = await searchSportsFixturesCallable({
      query: query.trim(),
      limit: 8,
    });
    const results = Array.isArray(response.data) ? response.data : [];
    cacheSet(cacheKey, results, TTL.fixtures);
    return results;
  } catch {
    return [];
  }
}

export async function getFixtureResult(
  fixtureId: number
): Promise<{ homeGoals: number; awayGoals: number; status: string } | null> {
  const cacheKey = `result_${fixtureId}`;
  const cached = cacheGet<{ homeGoals: number; awayGoals: number; status: string }>(cacheKey);
  if (cached) return cached;

  try {
    const response = await getSportsFixtureResultCallable({
      fixtureId,
    });
    const result = response.data;
    if (!result) return null;

    if (result.status === "FT" || result.status === "PEN" || result.status === "AET") {
      cacheSet(cacheKey, result, TTL.results);
    }

    return result;
  } catch {
    return null;
  }
}

export function isSportsApiConfigured(): boolean {
  // Only enable fixture search when the project ID is set, implying Firebase Functions are deployed.
  return Boolean(import.meta.env.VITE_FIREBASE_PROJECT_ID);
}
