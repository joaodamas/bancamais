import { money, percent } from "./metrics";
import type { AppState, Bet } from "./types";

export type SuggestionFixtureStatus = "monitoring" | "priced" | "ready";
export type SuggestionMarketType =
  | "moneyline"
  | "spread"
  | "totals"
  | "player_prop"
  | "both_to_score";
export type SuggestionPriority = "high" | "medium" | "low";
export type SuggestionLifecycle = "draft" | "queued" | "ready" | "published" | "archived";
export type SuggestionFeedStatus = "online" | "degraded" | "offline";

export interface SuggestionFixture {
  id: string;
  sport: string;
  league: string;
  startsAt: string;
  homeTeam: string;
  awayTeam: string;
  status: SuggestionFixtureStatus;
  coverage: number;
}

export interface SuggestionOddsSnapshot {
  id: string;
  fixtureId: string;
  bookmakerName: string;
  marketType: SuggestionMarketType;
  marketLabel: string;
  selectionLabel: string;
  line?: string;
  decimalOdds: number;
  impliedProbability: number;
  capturedAt: string;
}

export interface SuggestedPlay {
  id: string;
  fixtureId: string;
  title: string;
  marketType: SuggestionMarketType;
  marketLabel: string;
  selectionLabel: string;
  status: SuggestionLifecycle;
  priority: SuggestionPriority;
  confidence: number;
  estimatedProbability: number;
  edge: number;
  minimumOdds: number;
  targetOdds: number;
  stakeUnits: number;
  generatedAt: string;
  rationale: string[];
  linkedBookmakers: string[];
}

export interface SuggestionPerformanceSnapshot {
  trackedSuggestions: number;
  adoptedSuggestions: number;
  settledSuggestions: number;
  winRate: number | null;
  roi: number | null;
  profit: number;
  averageEdge: number | null;
  averageClv: number | null;
}

export interface SuggestionsWorkspace {
  fixtures: SuggestionFixture[];
  odds: SuggestionOddsSnapshot[];
  suggestions: SuggestedPlay[];
  performance: SuggestionPerformanceSnapshot;
  feeds: Array<{ label: string; status: SuggestionFeedStatus; detail: string }>;
  readiness: Array<{ label: string; ready: boolean; detail: string }>;
}

const fallbackBooks = ["Pinnacle", "Bet365", "Betano"];

function createFutureDate(base: Date, dayOffset: number, hour: number, minute = 0) {
  const next = new Date(base);
  next.setDate(next.getDate() + dayOffset);
  next.setHours(hour, minute, 0, 0);
  return next.toISOString();
}

function safePercent(value: number) {
  return Math.max(0, Math.min(1, value));
}

function getBookNames(state: AppState) {
  return state.bookmakers.map((book) => book.name).filter(Boolean);
}

function getSuggestionBets(state: AppState) {
  return state.bets.filter((bet) => bet.source === "ai_suggestion");
}

function getSettledSuggestionProfit(bet: Bet) {
  const payout = bet.payout ?? (bet.status === "won" ? bet.stake * bet.odds : bet.status === "void" ? bet.stake : 0);
  return payout - bet.stake;
}

function buildPerformance(state: AppState): SuggestionPerformanceSnapshot {
  const adoptedSuggestions = getSuggestionBets(state);
  const settledSuggestions = adoptedSuggestions.filter((bet) => bet.status !== "pending");
  const trackedSuggestions = adoptedSuggestions.length;
  const stakeTotal = settledSuggestions.reduce((sum, bet) => sum + bet.stake, 0);
  const profit = settledSuggestions.reduce((sum, bet) => sum + getSettledSuggestionProfit(bet), 0);
  const wins = settledSuggestions.filter((bet) => bet.status === "won" || bet.status === "cashout").length;
  const edges = adoptedSuggestions
    .map((bet) => bet.estimatedEdge)
    .filter((value): value is number => typeof value === "number");
  const clvs = settledSuggestions
    .map((bet) => {
      if (!bet.closingOdds || bet.closingOdds <= 0) return null;
      return (bet.odds - bet.closingOdds) / bet.closingOdds;
    })
    .filter((value): value is number => value !== null);

  return {
    trackedSuggestions,
    adoptedSuggestions: adoptedSuggestions.length,
    settledSuggestions: settledSuggestions.length,
    winRate: settledSuggestions.length > 0 ? wins / settledSuggestions.length : null,
    roi: stakeTotal > 0 ? profit / stakeTotal : null,
    profit,
    averageEdge: edges.length > 0 ? edges.reduce((sum, value) => sum + value, 0) / edges.length : null,
    averageClv: clvs.length > 0 ? clvs.reduce((sum, value) => sum + value, 0) / clvs.length : null,
  };
}

export function buildSuggestionsWorkspace(state: AppState): SuggestionsWorkspace {
  const now = new Date();
  const bookNames = getBookNames(state);
  const linkedBooks = bookNames.length > 0 ? bookNames.slice(0, 3) : fallbackBooks;

  const fixtures: SuggestionFixture[] = [
    {
      id: "fixture-brasileirao-001",
      sport: "Futebol",
      league: "Brasileirão Série A",
      startsAt: createFutureDate(now, 1, 20, 0),
      homeTeam: "Palmeiras",
      awayTeam: "Flamengo",
      status: "ready",
      coverage: 0.92,
    },
    {
      id: "fixture-nba-002",
      sport: "Basquete",
      league: "NBA",
      startsAt: createFutureDate(now, 1, 21, 30),
      homeTeam: "Boston Celtics",
      awayTeam: "Miami Heat",
      status: "priced",
      coverage: 0.76,
    },
    {
      id: "fixture-ucl-003",
      sport: "Futebol",
      league: "Champions League",
      startsAt: createFutureDate(now, 2, 16, 0),
      homeTeam: "Manchester City",
      awayTeam: "Inter",
      status: "monitoring",
      coverage: 0.48,
    },
  ];

  const odds: SuggestionOddsSnapshot[] = [
    {
      id: "odds-001",
      fixtureId: fixtures[0].id,
      bookmakerName: linkedBooks[0],
      marketType: "moneyline",
      marketLabel: "1x2",
      selectionLabel: "Palmeiras",
      decimalOdds: 2.08,
      impliedProbability: 1 / 2.08,
      capturedAt: createFutureDate(now, 0, now.getHours(), now.getMinutes()),
    },
    {
      id: "odds-002",
      fixtureId: fixtures[1].id,
      bookmakerName: linkedBooks[1] ?? linkedBooks[0],
      marketType: "spread",
      marketLabel: "Spread",
      selectionLabel: "Celtics -4.5",
      line: "-4.5",
      decimalOdds: 1.93,
      impliedProbability: 1 / 1.93,
      capturedAt: createFutureDate(now, 0, now.getHours(), now.getMinutes() - 12),
    },
    {
      id: "odds-003",
      fixtureId: fixtures[2].id,
      bookmakerName: linkedBooks[2] ?? linkedBooks[0],
      marketType: "both_to_score",
      marketLabel: "Ambas marcam",
      selectionLabel: "Sim",
      decimalOdds: 1.84,
      impliedProbability: 1 / 1.84,
      capturedAt: createFutureDate(now, 0, now.getHours(), now.getMinutes() - 22),
    },
  ];

  const suggestions: SuggestedPlay[] = [
    {
      id: "suggestion-001",
      fixtureId: fixtures[0].id,
      title: "Valor no mandante em preço acima de 2.00",
      marketType: "moneyline",
      marketLabel: "1x2",
      selectionLabel: "Palmeiras",
      status: "ready",
      priority: "high",
      confidence: 0.74,
      estimatedProbability: 0.55,
      edge: 0.143,
      minimumOdds: 1.96,
      targetOdds: 2.08,
      stakeUnits: 1.5,
      generatedAt: new Date().toISOString(),
      rationale: [
        "Preço atual ainda acima da linha mínima calibrada.",
        "Convergência entre mando, forma recente e mercado principal.",
      ],
      linkedBookmakers: linkedBooks.slice(0, 2),
    },
    {
      id: "suggestion-002",
      fixtureId: fixtures[1].id,
      title: "Spread com edge moderado antes do fechamento",
      marketType: "spread",
      marketLabel: "Spread",
      selectionLabel: "Celtics -4.5",
      status: "queued",
      priority: "medium",
      confidence: 0.66,
      estimatedProbability: 0.57,
      edge: 0.1,
      minimumOdds: 1.87,
      targetOdds: 1.93,
      stakeUnits: 1,
      generatedAt: new Date().toISOString(),
      rationale: [
        "Linha ainda aberta em mais de uma casa monitorada.",
        "Janela boa para revisar lesões e confirmação de lineup.",
      ],
      linkedBookmakers: linkedBooks.slice(0, 3),
    },
    {
      id: "suggestion-003",
      fixtureId: fixtures[2].id,
      title: "Aguardar nova captura para validar ambas marcam",
      marketType: "both_to_score",
      marketLabel: "Ambas marcam",
      selectionLabel: "Sim",
      status: "draft",
      priority: "low",
      confidence: 0.51,
      estimatedProbability: 0.57,
      edge: 0.049,
      minimumOdds: 1.79,
      targetOdds: 1.84,
      stakeUnits: 0.75,
      generatedAt: new Date().toISOString(),
      rationale: [
        "Modelo ainda pede mais uma rodada de preço antes de publicar.",
      ],
      linkedBookmakers: [linkedBooks[0]],
    },
  ];

  return {
    fixtures,
    odds,
    suggestions,
    performance: buildPerformance(state),
    feeds: [
      {
        label: "Fixtures futuros",
        status: "offline" as const,
        detail: `${fixtures.length} partidas carregadas da API`,
      },
      {
        label: "Edge estimado",
        status: "offline" as const,
        detail: `${suggestions.length} oportunidades analisadas`,
      },
      {
        label: "Publicação IA",
        status: "offline" as const,
        detail: "Sugestões geradas automaticamente",
      },
    ],
    readiness: [
      {
        label: "Casas cadastradas",
        ready: state.bookmakers.length > 0,
        detail: state.bookmakers.length > 0
          ? `${state.bookmakers.length} casa(s) disponivel(is) para mapear odds.`
          : "Nenhuma casa vinculada para reconciliar preco e publicar sugestoes.",
      },
      {
        label: "Estrategias ativas",
        ready: state.strategies.some((strategy) => strategy.status === "active"),
        detail: state.strategies.some((strategy) => strategy.status === "active")
          ? "A sugestao pode apontar roteamento por estrategia."
          : "Cadastre ao menos uma estrategia ativa para roteamento operacional.",
      },
      {
        label: "Historico para calibracao",
        ready: state.bets.length >= 10,
        detail: state.bets.length >= 10
          ? `${state.bets.length} apostas na base para evoluir score e performance.`
          : "A calibracao fica mais confiavel depois dos primeiros 10 registros.",
      },
    ],
  };
}

export function formatSuggestionStatus(status: SuggestionLifecycle) {
  switch (status) {
    case "draft":
      return "Rascunho";
    case "queued":
      return "Em fila";
    case "ready":
      return "Pronta";
    case "published":
      return "Publicada";
    case "archived":
      return "Arquivada";
    default:
      return status;
  }
}

export function formatFixtureStatus(status: SuggestionFixtureStatus) {
  switch (status) {
    case "monitoring":
      return "Monitorando";
    case "priced":
      return "Precificada";
    case "ready":
      return "Pronta";
    default:
      return status;
  }
}

export function formatFeedStatus(status: SuggestionFeedStatus) {
  switch (status) {
    case "online":
      return "Online";
    case "degraded":
      return "Parcial";
    case "offline":
      return "Offline";
    default:
      return status;
  }
}

export function formatCoverage(coverage: number) {
  return percent.format(safePercent(coverage));
}

export function formatProfit(value: number) {
  return money.format(value);
}
