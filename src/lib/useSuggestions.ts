import { useState, useEffect, useCallback, useRef } from "react";
import { searchFixtures, estimateEdge } from "./sportsApi";
import type { FixtureSearchResult } from "./sportsApi";
import {
  buildSuggestionsWorkspace,
} from "./suggestions";
import type {
  SuggestionsWorkspace,
  SuggestionFixture,
  SuggestedPlay,
  SuggestionOddsSnapshot,
} from "./suggestions";
import type { AppState } from "./types";

const MODULE_CACHE_TTL_MS = 15 * 60 * 1000;

interface ModuleCache {
  workspace: SuggestionsWorkspace;
  source: "live" | "fallback";
  note: string | null;
  cachedAt: number;
}

let moduleCache: ModuleCache | null = null;

function isCacheValid(): boolean {
  return moduleCache !== null && Date.now() - moduleCache.cachedAt < MODULE_CACHE_TTL_MS;
}

const DEFAULT_QUERIES = [
  "brasileirao",
  "premier league",
  "champions league",
  "nba",
  "serie a",
];

function detectUserSports(state: AppState): string[] {
  const leagues = new Set<string>();
  for (const bet of state.bets) {
    if (bet.league) leagues.add(bet.league.toLowerCase());
  }
  const result = Array.from(leagues).slice(0, 5);
  return result.length >= 2 ? result : DEFAULT_QUERIES;
}

function deduplicateFixtures(results: FixtureSearchResult[]): FixtureSearchResult[] {
  const seen = new Set<number>();
  const unique: FixtureSearchResult[] = [];
  for (const item of results) {
    if (!seen.has(item.fixture.id)) {
      seen.add(item.fixture.id);
      unique.push(item);
    }
  }
  return unique;
}

function toSuggestionFixture(item: FixtureSearchResult, coverage: number): SuggestionFixture {
  return {
    id: String(item.fixture.id),
    sport: item.fixture.country === "World" ? "Futebol" : guessSport(item.fixture.league),
    league: item.fixture.league,
    startsAt: item.fixture.date,
    homeTeam: item.fixture.homeTeam,
    awayTeam: item.fixture.awayTeam,
    status: "priced",
    coverage,
  };
}

function guessSport(league: string): string {
  const lower = league.toLowerCase();
  if (lower.includes("nba") || lower.includes("basketball")) return "Basquete";
  if (lower.includes("nfl") || lower.includes("american football")) return "Futebol Americano";
  if (lower.includes("nhl") || lower.includes("hockey")) return "Hóquei";
  if (lower.includes("tennis")) return "Tênis";
  return "Futebol";
}

interface EdgeMarket {
  market: string;
  selection: string;
  odds: number;
  marketLabel: string;
  selectionLabel: string;
}

function buildMarketsForFixture(fixtureId: string): EdgeMarket[] {
  void fixtureId;
  return [
    { market: "match_winner", selection: "home",  odds: 2.0, marketLabel: "1x2",         selectionLabel: "Mandante" },
    { market: "match_winner", selection: "away",  odds: 2.5, marketLabel: "1x2",         selectionLabel: "Visitante" },
    { market: "both_teams_to_score", selection: "yes", odds: 1.8, marketLabel: "Ambas marcam", selectionLabel: "Sim" },
  ];
}

function marketTypeFromMarket(market: string): SuggestedPlay["marketType"] {
  if (market === "match_winner") return "moneyline";
  if (market === "both_teams_to_score") return "both_to_score";
  if (market === "spread") return "spread";
  if (market === "totals") return "totals";
  return "moneyline";
}

async function fetchSuggestionsWorkspace(state: AppState): Promise<SuggestionsWorkspace> {
  const queries = detectUserSports(state);

  const searchResults = await Promise.allSettled(
    queries.map((q) => searchFixtures(q))
  );

  const allFixtures: FixtureSearchResult[] = [];
  for (const result of searchResults) {
    if (result.status === "fulfilled") {
      allFixtures.push(...result.value);
    }
  }

  const unique = deduplicateFixtures(allFixtures).slice(0, 6);

  if (unique.length === 0) {
    throw new Error("Nenhuma partida encontrada via API");
  }

  const now = new Date().toISOString();
  const bookNames = state.bookmakers.map((b) => b.name).filter(Boolean);
  const fallbackBooks = ["Pinnacle", "Bet365", "Betano"];
  const linkedBooks = bookNames.length > 0 ? bookNames.slice(0, 3) : fallbackBooks;

  const suggestionFixtures: SuggestionFixture[] = unique.map((item, idx) =>
    toSuggestionFixture(item, Math.max(0.5, 0.95 - idx * 0.08))
  );

  // For each fixture, estimate edge for 3 markets in parallel
  type EdgeJob = {
    fixtureId: string;
    fixtureNumericId: number;
    market: EdgeMarket;
  };

  const jobs: EdgeJob[] = [];
  for (const item of unique) {
    const markets = buildMarketsForFixture(String(item.fixture.id));
    for (const m of markets) {
      jobs.push({ fixtureId: String(item.fixture.id), fixtureNumericId: item.fixture.id, market: m });
    }
  }

  const edgeResults = await Promise.allSettled(
    jobs.map((job) =>
      estimateEdge(job.fixtureNumericId, job.market.market, job.market.selection, job.market.odds)
    )
  );

  const suggestions: SuggestedPlay[] = [];
  const odds: SuggestionOddsSnapshot[] = [];

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    const result = edgeResults[i];
    if (result.status !== "fulfilled" || !result.value) continue;

    const estimate = result.value;

    // Build odds snapshot regardless of edge
    odds.push({
      id: `odds-${job.fixtureId}-${job.market.market}-${job.market.selection}`,
      fixtureId: job.fixtureId,
      bookmakerName: linkedBooks[suggestions.length % linkedBooks.length],
      marketType: marketTypeFromMarket(job.market.market),
      marketLabel: job.market.marketLabel,
      selectionLabel: job.market.selectionLabel,
      decimalOdds: job.market.odds,
      impliedProbability: estimate.impliedProbability,
      capturedAt: now,
    });

    // Only surface plays with meaningful edge
    if (estimate.edge <= 0.03) continue;

    const fixture = suggestionFixtures.find((f) => f.id === job.fixtureId);
    if (!fixture) continue;

    const confidence = estimate.confidence === "high" ? 0.8 : estimate.confidence === "medium" ? 0.65 : 0.5;
    const minimumOdds = parseFloat((job.market.odds * 0.96).toFixed(2));

    suggestions.push({
      id: `suggestion-${job.fixtureId}-${job.market.market}-${job.market.selection}`,
      fixtureId: job.fixtureId,
      title: `${job.market.selectionLabel} — ${fixture.homeTeam} x ${fixture.awayTeam}`,
      marketType: marketTypeFromMarket(job.market.market),
      marketLabel: job.market.marketLabel,
      selectionLabel: job.market.selectionLabel,
      status: "queued",
      priority: estimate.edge >= 0.1 ? "high" : estimate.edge >= 0.06 ? "medium" : "low",
      confidence,
      estimatedProbability: estimate.estimatedProbability,
      edge: estimate.edge,
      minimumOdds,
      targetOdds: job.market.odds,
      stakeUnits: estimate.edge >= 0.1 ? 1.5 : 1.0,
      generatedAt: now,
      rationale: [estimate.reasoning],
      linkedBookmakers: linkedBooks.slice(0, 2),
    });
  }

  // Sort by edge descending; mark top as "ready"
  suggestions.sort((a, b) => b.edge - a.edge);
  for (let i = 0; i < suggestions.length; i++) {
    suggestions[i] = { ...suggestions[i], status: i === 0 ? "ready" : "queued" };
  }

  return {
    fixtures: suggestionFixtures,
    odds,
    suggestions,
    performance: buildPerformanceFromState(state),
    feeds: [
      {
        label: "Fixtures futuros",
        status: "online",
        detail: `${suggestionFixtures.length} partidas carregadas da API`,
      },
      {
        label: "Edge estimado",
        status: suggestions.length > 0 ? "online" : "degraded",
        detail: `${suggestions.length} oportunidades analisadas`,
      },
      {
        label: "Publicação IA",
        status: "online",
        detail: "Sugestões geradas automaticamente",
      },
    ],
    readiness: [
      {
        label: "Casas cadastradas",
        ready: state.bookmakers.length > 0,
        detail: state.bookmakers.length > 0
          ? `${state.bookmakers.length} casa(s) disponível(is) para mapear odds.`
          : "Nenhuma casa vinculada para reconciliar preço e publicar sugestões.",
      },
      {
        label: "Estratégias ativas",
        ready: state.strategies.some((s) => s.status === "active"),
        detail: state.strategies.some((s) => s.status === "active")
          ? "A sugestão pode apontar roteamento por estratégia."
          : "Cadastre ao menos uma estratégia ativa para roteamento operacional.",
      },
      {
        label: "Histórico para calibração",
        ready: state.bets.length >= 10,
        detail: state.bets.length >= 10
          ? `${state.bets.length} apostas na base para evoluir score e performance.`
          : "A calibração fica mais confiável depois dos primeiros 10 registros.",
      },
    ],
  };
}

// Extracted from suggestions.ts to avoid circular dependency
function buildPerformanceFromState(state: AppState) {
  const adoptedBets = state.bets.filter((b) => b.source === "ai_suggestion");
  const settledBets = adoptedBets.filter((b) => b.status !== "pending");
  const stakeTotal = settledBets.reduce((sum, b) => sum + b.stake, 0);
  const profit = settledBets.reduce((sum, b) => {
    const payout = b.payout ?? (b.status === "won" ? b.stake * b.odds : b.status === "void" ? b.stake : 0);
    return sum + payout - b.stake;
  }, 0);
  const wins = settledBets.filter((b) => b.status === "won" || b.status === "cashout").length;
  const edges = adoptedBets
    .map((b) => b.estimatedEdge)
    .filter((v): v is number => typeof v === "number");
  const clvs = settledBets
    .map((b) => {
      if (!b.closingOdds || b.closingOdds <= 0) return null;
      return (b.odds - b.closingOdds) / b.closingOdds;
    })
    .filter((v): v is number => v !== null);

  return {
    trackedSuggestions: adoptedBets.length,
    adoptedSuggestions: adoptedBets.length,
    settledSuggestions: settledBets.length,
    winRate: settledBets.length > 0 ? wins / settledBets.length : null,
    roi: stakeTotal > 0 ? profit / stakeTotal : null,
    profit,
    averageEdge: edges.length > 0 ? edges.reduce((s, v) => s + v, 0) / edges.length : null,
    averageClv: clvs.length > 0 ? clvs.reduce((s, v) => s + v, 0) / clvs.length : null,
  };
}

export function useSuggestions(state: AppState): {
  workspace: SuggestionsWorkspace;
  loading: boolean;
  error: string | null;
  source: "live" | "fallback";
  usingCache: boolean;
  note: string | null;
  lastUpdatedAt: number | null;
  refresh: () => void;
} {
  const [workspace, setWorkspace] = useState<SuggestionsWorkspace>(() =>
    isCacheValid() ? moduleCache!.workspace : buildSuggestionsWorkspace(state)
  );
  const [loading, setLoading] = useState<boolean>(!isCacheValid());
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<"live" | "fallback">(() => (isCacheValid() ? moduleCache!.source : "fallback"));
  const [usingCache, setUsingCache] = useState<boolean>(() => isCacheValid());
  const [note, setNote] = useState<string | null>(() =>
    isCacheValid() ? moduleCache!.note : "Demonstracao local carregada ate que a coleta externa seja atualizada."
  );
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(() => (isCacheValid() ? moduleCache!.cachedAt : null));
  const fetchCountRef = useRef(0);

  const fetch = useCallback(
    async (force: boolean) => {
      if (!force && isCacheValid()) {
        setWorkspace(moduleCache!.workspace);
        setLoading(false);
        setError(null);
        setSource(moduleCache!.source);
        setUsingCache(true);
        setNote(moduleCache!.note);
        setLastUpdatedAt(moduleCache!.cachedAt);
        return;
      }

      const fetchId = ++fetchCountRef.current;
      setLoading(true);
      setError(null);

      try {
        const result = await fetchSuggestionsWorkspace(state);
        if (fetchId !== fetchCountRef.current) return; // stale fetch
        const cachedAt = Date.now();
        moduleCache = {
          workspace: result,
          source: "live",
          note: "Sugestoes calculadas a partir dos providers externos configurados.",
          cachedAt,
        };
        setWorkspace(result);
        setError(null);
        setSource("live");
        setUsingCache(false);
        setNote("Sugestoes calculadas a partir dos providers externos configurados.");
        setLastUpdatedAt(cachedAt);
      } catch {
        if (fetchId !== fetchCountRef.current) return;
        const fallback = buildSuggestionsWorkspace(state);
        const cachedAt = Date.now();
        moduleCache = {
          workspace: fallback,
          source: "fallback",
          note: "Fallback local ativo. Esta superficie continua util para UX e operacao, mas os jogos e sugestoes nao vieram do backend ao vivo.",
          cachedAt,
        };
        setWorkspace(fallback);
        setError("Usando dados de demonstração — API temporariamente indisponível");
        setSource("fallback");
        setUsingCache(false);
        setNote("Fallback local ativo. Esta superficie continua util para UX e operacao, mas os jogos e sugestoes nao vieram do backend ao vivo.");
        setLastUpdatedAt(cachedAt);
      } finally {
        if (fetchId === fetchCountRef.current) setLoading(false);
      }
    },
    // state is intentionally omitted to avoid re-fetching on every keystroke;
    // user must press Atualizar for a fresh fetch with new state
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    void fetch(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = useCallback(() => {
    moduleCache = null;
    void fetch(true);
  }, [fetch]);

  return { workspace, loading, error, source, usingCache, note, lastUpdatedAt, refresh };
}
