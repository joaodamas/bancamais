// Cache helper com TTL em localStorage
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
  displayLabel: string;      // "Flamengo x Palmeiras — Brasileirão — 15 Mai 18:30"
}

const API_KEY = import.meta.env.VITE_API_FOOTBALL_KEY as string | undefined;
const BASE_URL = "https://v3.football.api-sports.io";

export async function searchFixtures(query: string): Promise<FixtureSearchResult[]> {
  if (!API_KEY || query.trim().length < 3) return [];

  const cacheKey = `search_${query.toLowerCase().trim()}`;
  const cached = cacheGet<FixtureSearchResult[]>(cacheKey);
  if (cached) return cached;

  // Buscar próximos 14 dias de fixtures
  const today = new Date();
  const in14 = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
  const dateFrom = today.toISOString().slice(0, 10);
  const dateTo = in14.toISOString().slice(0, 10);

  try {
    const res = await fetch(
      `${BASE_URL}/fixtures?search=${encodeURIComponent(query)}&from=${dateFrom}&to=${dateTo}&timezone=America/Sao_Paulo`,
      { headers: { "x-apisports-key": API_KEY } }
    );

    if (!res.ok) return [];
    const json = await res.json() as { response: unknown[] };
    if (!Array.isArray(json.response)) return [];

    const results: FixtureSearchResult[] = json.response
      .slice(0, 8)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((item: any) => {
        const f = item.fixture;
        const teams = item.teams;
        const league = item.league;
        const goals = item.goals;

        const fixture: Fixture = {
          id: f.id,
          date: f.date,
          homeTeam: teams.home.name,
          awayTeam: teams.away.name,
          homeLogo: teams.home.logo,
          awayLogo: teams.away.logo,
          league: league.name,
          leagueLogo: league.logo,
          country: league.country,
          status: f.status.short,
          homeGoals: goals.home,
          awayGoals: goals.away,
        };

        const d = new Date(f.date);
        const dateLabel = d.toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        });
        const displayLabel = `${teams.home.name} x ${teams.away.name} — ${league.name} — ${dateLabel}`;

        return { fixture, displayLabel };
      });

    cacheSet(cacheKey, results, TTL.fixtures);
    return results;
  } catch {
    return [];
  }
}

export async function getFixtureResult(
  fixtureId: number
): Promise<{ homeGoals: number; awayGoals: number; status: string } | null> {
  if (!API_KEY) return null;

  const cacheKey = `result_${fixtureId}`;
  const cached = cacheGet<{ homeGoals: number; awayGoals: number; status: string }>(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(`${BASE_URL}/fixtures?id=${fixtureId}`, {
      headers: { "x-apisports-key": API_KEY },
    });
    if (!res.ok) return null;

    const json = await res.json() as { response: unknown[] };
    if (!Array.isArray(json.response) || json.response.length === 0) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const item = json.response[0] as any;
    const result = {
      homeGoals: item.goals.home ?? 0,
      awayGoals: item.goals.away ?? 0,
      status: item.fixture.status.short,
    };

    // Só cachear se o jogo terminou
    if (result.status === "FT" || result.status === "PEN" || result.status === "AET") {
      cacheSet(cacheKey, result, TTL.results);
    }

    return result;
  } catch {
    return null;
  }
}

export function isSportsApiConfigured(): boolean {
  return Boolean(import.meta.env.VITE_API_FOOTBALL_KEY);
}
