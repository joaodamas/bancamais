import type { MatchResult, WinLossRecord, TeamContext } from "../contracts/externalData.js";
import { getCachedValue, setCachedValue } from "./externalCache.js";
import { fetchJson } from "./httpClient.js";

const SPORTS_BASE_URL = "https://v3.football.api-sports.io";
const CONTEXT_TTL_MS = 30 * 60 * 1000;

// ---- API-Football response shapes ----

interface ApiFixtureTeams {
  home?: { id?: number; name?: string };
  away?: { id?: number; name?: string };
}

interface ApiFixtureGoals {
  home?: number | null;
  away?: number | null;
}

interface ApiFixtureDate {
  date?: string;
}

interface ApiFixtureLeague {
  id?: number;
  season?: number;
}

interface ApiFixtureEnvelope {
  fixture?: ApiFixtureDate & { id?: number };
  teams?: ApiFixtureTeams;
  goals?: ApiFixtureGoals;
  league?: ApiFixtureLeague;
}

interface ApiFixturesResponse {
  response?: ApiFixtureEnvelope[];
}

interface ApiStandingTeam {
  id?: number;
}

interface ApiStandingEntry {
  rank?: number;
  team?: ApiStandingTeam;
}

interface ApiStandingsGroup {
  standings?: ApiStandingEntry[][];
}

interface ApiStandingsResponse {
  response?: ApiStandingsGroup[];
}

// ---- Normalisation helpers ----

function toMatchResult(item: ApiFixtureEnvelope): MatchResult | null {
  const date = item.fixture?.date;
  const homeTeam = item.teams?.home?.name;
  const awayTeam = item.teams?.away?.name;
  const homeGoals = item.goals?.home;
  const awayGoals = item.goals?.away;

  if (
    typeof date !== "string" ||
    typeof homeTeam !== "string" ||
    typeof awayTeam !== "string" ||
    typeof homeGoals !== "number" ||
    typeof awayGoals !== "number"
  ) {
    return null;
  }

  return { date, homeTeam, awayTeam, homeGoals, awayGoals };
}

function emptyRecord(): WinLossRecord {
  return { wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 };
}

function buildRecord(matches: MatchResult[], teamName: string, venueFilter: "home" | "away"): WinLossRecord {
  const rec = emptyRecord();

  for (const m of matches) {
    const isHome = m.homeTeam === teamName;
    const isAway = m.awayTeam === teamName;

    if (venueFilter === "home" && !isHome) continue;
    if (venueFilter === "away" && !isAway) continue;

    const scored = isHome ? m.homeGoals : m.awayGoals;
    const conceded = isHome ? m.awayGoals : m.homeGoals;

    rec.goalsFor += scored;
    rec.goalsAgainst += conceded;

    if (scored > conceded) rec.wins++;
    else if (scored === conceded) rec.draws++;
    else rec.losses++;
  }

  return rec;
}

// ---- API call helpers ----

function buildHeaders(apiKey: string): Record<string, string> {
  return { "x-apisports-key": apiKey };
}

async function fetchFixtureById(apiKey: string, fixtureId: number): Promise<ApiFixtureEnvelope | null> {
  const data = await fetchJson<ApiFixturesResponse>(`${SPORTS_BASE_URL}/fixtures`, {
    headers: buildHeaders(apiKey),
    searchParams: { id: String(fixtureId) },
    timeoutMs: 8000,
  });
  return data.response?.[0] ?? null;
}

async function fetchLast5(apiKey: string, teamId: number): Promise<MatchResult[]> {
  const data = await fetchJson<ApiFixturesResponse>(`${SPORTS_BASE_URL}/fixtures`, {
    headers: buildHeaders(apiKey),
    searchParams: { last: "5", team: String(teamId) },
    timeoutMs: 8000,
  });

  return (data.response ?? [])
    .map(toMatchResult)
    .filter((m): m is MatchResult => m !== null);
}

async function fetchH2H(apiKey: string, homeId: number, awayId: number): Promise<MatchResult[]> {
  const data = await fetchJson<ApiFixturesResponse>(`${SPORTS_BASE_URL}/fixtures/headtohead`, {
    headers: buildHeaders(apiKey),
    searchParams: { h2h: `${homeId}-${awayId}`, last: "5" },
    timeoutMs: 8000,
  });

  return (data.response ?? [])
    .map(toMatchResult)
    .filter((m): m is MatchResult => m !== null);
}

async function fetchPosition(
  apiKey: string,
  leagueId: number,
  season: number,
  teamId: number,
): Promise<number | undefined> {
  try {
    const data = await fetchJson<ApiStandingsResponse>(`${SPORTS_BASE_URL}/standings`, {
      headers: buildHeaders(apiKey),
      searchParams: { league: String(leagueId), season: String(season) },
      timeoutMs: 8000,
    });

    const allGroups = data.response ?? [];
    for (const group of allGroups) {
      for (const table of group.standings ?? []) {
        const entry = table.find((row) => row.team?.id === teamId);
        if (typeof entry?.rank === "number") {
          return entry.rank;
        }
      }
    }
    return undefined;
  } catch {
    return undefined;
  }
}

// ---- Public API ----

export async function getTeamContext(apiKey: string, fixtureId: number): Promise<TeamContext> {
  const cacheKey = `sports:context:${fixtureId}`;
  const cached = getCachedValue<TeamContext>(cacheKey);
  if (cached) return cached;

  const root = await fetchFixtureById(apiKey, fixtureId);
  if (!root) {
    throw new Error(`Fixture ${fixtureId} not found.`);
  }

  const homeId = root.teams?.home?.id;
  const awayId = root.teams?.away?.id;
  const homeName = root.teams?.home?.name;
  const awayName = root.teams?.away?.name;
  const leagueId = root.league?.id;
  const season = root.league?.season;

  if (
    typeof homeId !== "number" ||
    typeof awayId !== "number" ||
    typeof homeName !== "string" ||
    typeof awayName !== "string"
  ) {
    throw new Error(`Fixture ${fixtureId} is missing team information.`);
  }

  const [homeLast5, awayLast5, h2h] = await Promise.all([
    fetchLast5(apiKey, homeId),
    fetchLast5(apiKey, awayId),
    fetchH2H(apiKey, homeId, awayId),
  ]);

  const homePosition =
    typeof leagueId === "number" && typeof season === "number"
      ? await fetchPosition(apiKey, leagueId, season, homeId)
      : undefined;

  const awayPosition =
    typeof leagueId === "number" && typeof season === "number"
      ? await fetchPosition(apiKey, leagueId, season, awayId)
      : undefined;

  const context: TeamContext = {
    homeTeam: {
      name: homeName,
      last5: homeLast5,
      homeRecord: buildRecord(homeLast5, homeName, "home"),
      position: homePosition,
    },
    awayTeam: {
      name: awayName,
      last5: awayLast5,
      homeRecord: buildRecord(awayLast5, awayName, "away"),
      position: awayPosition,
    },
    headToHead: h2h,
  };

  setCachedValue(cacheKey, context, CONTEXT_TTL_MS);
  return context;
}
