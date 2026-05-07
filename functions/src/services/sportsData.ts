import type {
  FixtureResult,
  FixtureSearchResult,
  FixtureSummary,
} from "../contracts/externalData.js";
import { getCachedValue, setCachedValue } from "./externalCache.js";
import { fetchJson } from "./httpClient.js";

const SPORTS_BASE_URL = "https://v3.football.api-sports.io";
const SEARCH_TTL_MS = 10 * 60 * 1000;
const RESULT_TTL_MS = 60 * 1000;
const FINAL_RESULT_TTL_MS = 60 * 60 * 1000;

interface ApiSportsFixtureEnvelope {
  fixture?: {
    id?: number;
    date?: string;
    status?: {
      short?: string;
    };
  };
  teams?: {
    home?: {
      name?: string;
      logo?: string;
    };
    away?: {
      name?: string;
      logo?: string;
    };
  };
  league?: {
    name?: string;
    logo?: string;
    country?: string;
  };
  goals?: {
    home?: number | null;
    away?: number | null;
  };
}

interface ApiSportsResponse {
  response?: ApiSportsFixtureEnvelope[];
}

function normalizeFixture(item: ApiSportsFixtureEnvelope): FixtureSummary | null {
  const fixtureId = item.fixture?.id;
  const date = item.fixture?.date;
  const homeTeam = item.teams?.home?.name;
  const awayTeam = item.teams?.away?.name;
  const leagueName = item.league?.name;

  if (
    typeof fixtureId !== "number" ||
    typeof date !== "string" ||
    typeof homeTeam !== "string" ||
    typeof awayTeam !== "string" ||
    typeof leagueName !== "string"
  ) {
    return null;
  }

  return {
    id: fixtureId,
    date,
    homeTeam,
    awayTeam,
    homeLogo: item.teams?.home?.logo ?? "",
    awayLogo: item.teams?.away?.logo ?? "",
    league: leagueName,
    leagueLogo: item.league?.logo ?? "",
    country: item.league?.country ?? "",
    status: item.fixture?.status?.short ?? "UNK",
    homeGoals: typeof item.goals?.home === "number" ? item.goals.home : null,
    awayGoals: typeof item.goals?.away === "number" ? item.goals.away : null,
  };
}

function buildDisplayLabel(fixture: FixtureSummary) {
  const date = new Date(fixture.date);
  const dateLabel = Number.isNaN(date.getTime())
    ? fixture.date
    : date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    });

  return `${fixture.homeTeam} x ${fixture.awayTeam} - ${fixture.league} - ${dateLabel}`;
}

export async function searchSportsFixtures(apiKey: string, query: string, limit: number) {
  const normalizedQuery = query.trim().toLowerCase();
  const cacheKey = `sports:search:${normalizedQuery}:${limit}`;
  const cached = getCachedValue<FixtureSearchResult[]>(cacheKey);
  if (cached) return cached;

  const today = new Date();
  const until = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);

  const response = await fetchJson<ApiSportsResponse>(`${SPORTS_BASE_URL}/fixtures`, {
    headers: { "x-apisports-key": apiKey },
    searchParams: {
      search: query,
      from: today.toISOString().slice(0, 10),
      to: until.toISOString().slice(0, 10),
      timezone: "America/Sao_Paulo",
    },
    timeoutMs: 8000,
  });

  const results = (response.response ?? [])
    .map(normalizeFixture)
    .filter((fixture): fixture is FixtureSummary => fixture != null)
    .slice(0, limit)
    .map((fixture) => ({
      fixture,
      displayLabel: buildDisplayLabel(fixture),
    }));

  setCachedValue(cacheKey, results, SEARCH_TTL_MS);
  return results;
}

function isFinalStatus(status: string) {
  return status === "FT" || status === "AET" || status === "PEN";
}

export async function getSportsFixtureResult(apiKey: string, fixtureId: number) {
  const cacheKey = `sports:result:${fixtureId}`;
  const cached = getCachedValue<FixtureResult>(cacheKey);
  if (cached) return cached;

  const response = await fetchJson<ApiSportsResponse>(`${SPORTS_BASE_URL}/fixtures`, {
    headers: { "x-apisports-key": apiKey },
    searchParams: {
      id: String(fixtureId),
    },
    timeoutMs: 8000,
  });

  const fixture = response.response?.map(normalizeFixture).find((item) => item != null);
  if (!fixture) {
    return null;
  }

  const result: FixtureResult = {
    homeGoals: fixture.homeGoals ?? 0,
    awayGoals: fixture.awayGoals ?? 0,
    status: fixture.status,
  };

  setCachedValue(cacheKey, result, isFinalStatus(result.status) ? FINAL_RESULT_TTL_MS : RESULT_TTL_MS);
  return result;
}
