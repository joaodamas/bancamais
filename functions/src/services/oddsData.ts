import type {
  ClosingOddsResult,
  MarketOddsEvent,
  MarketOddsOutcome,
  SportOddsResult,
} from "../contracts/externalData.js";
import { getCachedValue, setCachedValue } from "./externalCache.js";
import { fetchJson } from "./httpClient.js";

const ODDS_BASE_URL = "https://api.the-odds-api.com/v4";
const ODDS_TTL_MS = 10 * 60 * 1000; // 10 min — odds pré-jogo mudam devagar; protege a cota grátis
const PREFERRED_BOOKMAKER = "pinnacle"; // referência sharp (mercado eficiente) para a closing line
const MATCH_TOLERANCE_MS = 24 * 60 * 60 * 1000; // ±24h: o nome dos times é o sinal forte, não o horário

export interface ClosingOddsBetInput {
  betId: string;
  sport: string;
  league: string;
  eventName: string;
  selection: string;
  eventAt: string;
}

interface OddsApiOutcome {
  name: string;
  price: number;
}

interface OddsApiMarket {
  key: string;
  outcomes?: OddsApiOutcome[];
}

interface OddsApiBookmaker {
  key: string;
  title: string;
  markets?: OddsApiMarket[];
}

interface OddsApiEvent {
  id: string;
  sport_key: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers?: OddsApiBookmaker[];
}

type OutcomeSide = "home" | "away" | "draw";

const STOP_TOKENS = new Set([
  "fc", "cf", "ec", "sc", "afc", "ac", "cd", "ss", "as", "us", "sk", "if",
  "club", "clube", "de", "do", "da", "the",
]);

const DRAW_TOKENS = new Set(["empate", "draw", "x", "tie"]);

/** Reduz "Real Madrid CF" / "Manchester United FC" a um token comparável: "realmadrid" / "manchesterunited". */
export function normalizeName(value: string): string {
  const cleaned = value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ");

  return cleaned
    .split(/\s+/)
    .filter((token) => token.length > 0 && !STOP_TOKENS.has(token))
    .join("");
}

/** Quebra "Time A x Time B" nos separadores usuais. */
export function parseEventTeams(eventName: string): { home: string; away: string } | null {
  const separators = [" x ", " × ", " vs ", " v ", " - "];
  const lower = eventName.toLowerCase();

  for (const sep of separators) {
    const idx = lower.indexOf(sep);
    if (idx > 0) {
      const home = eventName.slice(0, idx).trim();
      const away = eventName.slice(idx + sep.length).trim();
      if (home && away) return { home, away };
    }
  }
  return null;
}

function namesClose(a: string, b: string): boolean {
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

/** Liga a seleção da aposta (texto livre) ao lado do mercado h2h. Só moneyline; outros mercados → null. */
export function selectionToOutcome(selection: string, home: string, away: string): OutcomeSide | null {
  const s = normalizeName(selection);
  if (!s) return null;
  if (DRAW_TOKENS.has(s)) return "draw";

  const h = normalizeName(home);
  const a = normalizeName(away);
  if (namesClose(s, h)) return "home";
  if (namesClose(s, a)) return "away";
  return null;
}

const SOCCER_LEAGUE_KEYS: Record<string, string> = {
  premierleague: "soccer_epl",
  epl: "soccer_epl",
  laliga: "soccer_spain_la_liga",
  laligasantander: "soccer_spain_la_liga",
  laligaeasports: "soccer_spain_la_liga",
  bundesliga: "soccer_germany_bundesliga",
  ligue1: "soccer_france_ligue_one",
  brasileirao: "soccer_brazil_campeonato",
  campeonatobrasileiro: "soccer_brazil_campeonato",
  championsleague: "soccer_uefa_champs_league",
  uefachampionsleague: "soccer_uefa_champs_league",
  ligadoscampeoes: "soccer_uefa_champs_league",
  europaleague: "soccer_uefa_europa_league",
  primeiraliga: "soccer_portugal_primeira_liga",
  eredivisie: "soccer_netherlands_eredivisie",
  mls: "soccer_usa_mls",
  primeradivision: "soccer_argentina_primera_division",
};

/**
 * Esporte/liga → chave(s) do The Odds API. Pode devolver 2 candidatas em casos ambíguos
 * (ex.: "Serie A" = Itália ou Brasil); o guard de team-match descarta a errada sem CLV falso.
 */
export function mapToOddsApiSportKeys(sport: string, league: string): string[] {
  const s = normalizeName(sport);
  const l = normalizeName(league);

  if (s.includes("basket") || l.includes("nba")) {
    if (l.includes("euroleague")) return ["basketball_euroleague"];
    return ["basketball_nba"];
  }
  if (s.includes("americanfootball") || l.includes("nfl")) return ["americanfootball_nfl"];
  if (s.includes("baseball") || l.includes("mlb")) return ["baseball_mlb"];
  if (s.includes("hockey") || l.includes("nhl")) return ["icehockey_nhl"];
  if (s.includes("mma") || s.includes("ufc") || l.includes("ufc") || l.includes("mma")) {
    return ["mma_mixed_martial_arts"];
  }

  const direct = SOCCER_LEAGUE_KEYS[l];
  if (direct) return [direct];
  if (l.includes("seriea")) return ["soccer_italy_serie_a", "soccer_brazil_campeonato"];

  for (const [alias, key] of Object.entries(SOCCER_LEAGUE_KEYS)) {
    if (alias.length >= 4 && l.includes(alias)) return [key];
  }
  return [];
}

/** Acha o evento cujos times batem (em qualquer ordem) e cujo horário está dentro da tolerância. */
export function matchEvent(
  events: OddsApiEvent[],
  home: string,
  away: string,
  commenceTimeIso: string,
  toleranceMs: number = MATCH_TOLERANCE_MS,
): OddsApiEvent | null {
  const h = normalizeName(home);
  const a = normalizeName(away);
  const target = Date.parse(commenceTimeIso);
  let best: { event: OddsApiEvent; diff: number } | null = null;

  for (const event of events) {
    const eh = normalizeName(event.home_team);
    const ea = normalizeName(event.away_team);
    const teamsMatch =
      (namesClose(h, eh) && namesClose(a, ea)) ||
      (namesClose(h, ea) && namesClose(a, eh));
    if (!teamsMatch) continue;

    const eventTime = Date.parse(event.commence_time);
    const comparable = !Number.isNaN(target) && !Number.isNaN(eventTime);
    const diff = comparable ? Math.abs(eventTime - target) : 0;
    if (comparable && diff > toleranceMs) continue;

    if (!best || diff < best.diff) best = { event, diff };
  }

  return best?.event ?? null;
}

/** Extrai o preço do lado escolhido: prefere Pinnacle; senão, a mediana das casas (consenso). */
export function pickClosingPrice(
  event: OddsApiEvent,
  side: OutcomeSide,
  preferred: string = PREFERRED_BOOKMAKER,
): { price: number; bookmaker: string } | null {
  const targetName =
    side === "home" ? event.home_team : side === "away" ? event.away_team : "Draw";
  const target = normalizeName(targetName);
  const candidates: Array<{ price: number; bookmaker: string }> = [];

  for (const book of event.bookmakers ?? []) {
    const h2h = book.markets?.find((market) => market.key === "h2h");
    if (!h2h?.outcomes) continue;
    const outcome = h2h.outcomes.find((item) => normalizeName(item.name) === target);
    if (outcome && typeof outcome.price === "number" && outcome.price > 1) {
      candidates.push({ price: outcome.price, bookmaker: book.key });
    }
  }

  if (candidates.length === 0) return null;

  const pinnacle = candidates.find((candidate) => candidate.bookmaker === preferred);
  if (pinnacle) return pinnacle;

  const sorted = [...candidates].sort((x, y) => x.price - y.price);
  const median = sorted[Math.floor(sorted.length / 2)];
  return { price: median.price, bookmaker: "consensus" };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

async function fetchSportOdds(apiKey: string, sportKey: string): Promise<OddsApiEvent[]> {
  const cacheKey = `odds:${sportKey}`;
  const cached = getCachedValue<OddsApiEvent[]>(cacheKey);
  if (cached) return cached;

  const events = await fetchJson<OddsApiEvent[]>(`${ODDS_BASE_URL}/sports/${sportKey}/odds`, {
    searchParams: {
      apiKey,
      regions: "eu", // região que inclui a Pinnacle; 1 região × 1 mercado = 1 crédito
      markets: "h2h",
      oddsFormat: "decimal",
    },
    timeoutMs: 8000,
  });

  const safe = Array.isArray(events) ? events : [];
  setCachedValue(cacheKey, safe, ODDS_TTL_MS);
  return safe;
}

/**
 * Resolve a closing line de várias apostas. Agrupa por sport_key e usa cache → gasta ~1 crédito
 * por esporte distinto, não por aposta. Devolve só as que casaram (as demais seguem manuais).
 */
export async function fetchClosingOddsForBets(
  apiKey: string,
  bets: ClosingOddsBetInput[],
): Promise<ClosingOddsResult[]> {
  const results: ClosingOddsResult[] = [];
  const sportCache = new Map<string, OddsApiEvent[]>();

  for (const bet of bets) {
    const teams = parseEventTeams(bet.eventName);
    if (!teams) continue;

    const side = selectionToOutcome(bet.selection, teams.home, teams.away);
    if (!side) continue;

    const keys = mapToOddsApiSportKeys(bet.sport, bet.league);
    if (keys.length === 0) continue;

    for (const key of keys) {
      let events = sportCache.get(key);
      if (!events) {
        try {
          events = await fetchSportOdds(apiKey, key);
        } catch {
          events = [];
        }
        sportCache.set(key, events);
      }

      const event = matchEvent(events, teams.home, teams.away, bet.eventAt);
      if (!event) continue;

      const price = pickClosingPrice(event, side);
      if (!price) continue;

      results.push({
        betId: bet.betId,
        closingOdds: round2(price.price),
        bookmaker: price.bookmaker,
      });
      break;
    }
  }

  return results;
}

/** Melhor preço de um lado entre todas as casas + referência Pinnacle, para line shopping. */
function collectBestPrice(
  event: OddsApiEvent,
  outcomeName: string,
): { best: number; bestBook: string; pinnacle: number | null } | null {
  const target = normalizeName(outcomeName);
  let best = 0;
  let bestBook = "";
  let pinnacle: number | null = null;

  for (const book of event.bookmakers ?? []) {
    const h2h = book.markets?.find((market) => market.key === "h2h");
    const outcome = h2h?.outcomes?.find((item) => normalizeName(item.name) === target);
    if (!outcome || typeof outcome.price !== "number" || outcome.price <= 1) continue;

    if (outcome.price > best) {
      best = outcome.price;
      bestBook = book.title || book.key;
    }
    if (book.key === PREFERRED_BOOKMAKER) pinnacle = outcome.price;
  }

  return best > 0 ? { best, bestBook, pinnacle } : null;
}

function transformMarketEvent(event: OddsApiEvent): MarketOddsEvent | null {
  const sides: Array<{ side: "home" | "away" | "draw"; name: string }> = [
    { side: "home", name: event.home_team },
    { side: "draw", name: "Draw" },
    { side: "away", name: event.away_team },
  ];

  const collected: Array<{
    side: "home" | "away" | "draw";
    name: string;
    best: number;
    bestBook: string;
    pinnacle: number | null;
  }> = [];
  for (const { side, name } of sides) {
    const price = collectBestPrice(event, name);
    if (!price) continue;
    collected.push({ side, name, best: price.best, bestBook: price.bestBook, pinnacle: price.pinnacle });
  }

  if (collected.length === 0) return null;

  // Margem (overround) da Pinnacle p/ derivar a odd "justa" sem vig.
  // Só assim "valor" tem sentido: melhor preço entre N casas quase sempre supera
  // o preço bruto de UMA casa — o teto real é a linha sem vig.
  const pinnacles = collected
    .map((entry) => entry.pinnacle)
    .filter((price): price is number => price != null && price > 1);
  const hasFullPinnacle = pinnacles.length === collected.length && pinnacles.length >= 2;
  const overround = hasFullPinnacle ? pinnacles.reduce((sum, price) => sum + 1 / price, 0) : null;

  const outcomes: MarketOddsOutcome[] = collected.map((entry) => {
    const fairOdds =
      overround != null && entry.pinnacle != null && entry.pinnacle > 1
        ? round2(entry.pinnacle * overround)
        : null;
    return {
      side: entry.side,
      name: entry.side === "draw" ? "Empate" : entry.name,
      best: round2(entry.best),
      bestBook: entry.bestBook,
      pinnacle: entry.pinnacle != null ? round2(entry.pinnacle) : null,
      fairOdds,
      impliedProb: entry.best > 1 ? Math.round((1 / entry.best) * 1000) / 1000 : 0,
    };
  });

  return {
    id: event.id,
    commenceTime: event.commence_time,
    homeTeam: event.home_team,
    awayTeam: event.away_team,
    outcomes,
  };
}

async function fetchSportOddsRaw(
  apiKey: string,
  sportKey: string,
): Promise<{ events: OddsApiEvent[]; remaining: number | null }> {
  const url = new URL(`${ODDS_BASE_URL}/sports/${sportKey}/odds`);
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("regions", "eu");
  url.searchParams.set("markets", "h2h");
  url.searchParams.set("oddsFormat", "decimal");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Odds upstream failed with status ${response.status}.`);
    }
    const remainingHeader = response.headers.get("x-requests-remaining");
    const remaining = remainingHeader != null ? Number(remainingHeader) : null;
    const events = (await response.json()) as OddsApiEvent[];
    return {
      events: Array.isArray(events) ? events : [],
      remaining: remaining != null && Number.isFinite(remaining) ? remaining : null,
    };
  } finally {
    clearTimeout(timeout);
  }
}

/** Lista os jogos futuros de um esporte com line shopping (melhor preço + Pinnacle + prob implícita). */
export async function listSportOdds(apiKey: string, sportKey: string): Promise<SportOddsResult> {
  const cacheKey = `oddsmarket:${sportKey}`;
  const cached = getCachedValue<SportOddsResult>(cacheKey);
  if (cached) return cached;

  const { events, remaining } = await fetchSportOddsRaw(apiKey, sportKey);
  const now = Date.now();

  const result: SportOddsResult = {
    requestsRemaining: remaining,
    events: events
      .filter((event) => Date.parse(event.commence_time) > now)
      .sort((a, b) => Date.parse(a.commence_time) - Date.parse(b.commence_time))
      .slice(0, 40)
      .map(transformMarketEvent)
      .filter((event): event is MarketOddsEvent => event !== null),
  };

  setCachedValue(cacheKey, result, ODDS_TTL_MS);
  return result;
}
