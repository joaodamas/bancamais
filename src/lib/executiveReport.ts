/**
 * Relatório executivo mensal — "carta ao investidor".
 * Síntese DETERMINÍSTICA: os números vêm sempre do ledger + edgeAnalysis +
 * tiltDetection, nunca de um LLM (que poderia alucinar valores financeiros).
 * Uma camada de LLM pode reescrever este rascunho depois, mas os fatos são fixos.
 */
import type { AppState } from "./types";
import { betProfit, clvPercent, money, percent } from "./metrics";
import { analyzeEdge, type EdgeSegment } from "./edgeAnalysis";
import { detectTilt } from "./tiltDetection";

export interface ExecutivePerformance {
  settledCount: number;
  staked: number;
  profit: number;
  yield: number;
  hitRate: number;
  clvAverage: number | null;
}

export interface ExecutiveReport {
  monthKey: string;
  periodLabel: string;
  generatedAt: string;
  performance: ExecutivePerformance;
  topEdges: EdgeSegment[];
  behaviorAlert: string | null;
  summary: string;
  verdict: "lucro" | "prejuizo" | "neutro";
  hasData: boolean;
}

function monthKeyOf(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Meses (mais recentes primeiro) com apostas liquidadas. */
export function availableReportMonths(state: AppState): string[] {
  const set = new Set<string>();
  for (const b of state.bets) {
    if (b.status === "pending") continue;
    const k = monthKeyOf(b.eventAt);
    if (k) set.add(k);
  }
  return [...set].sort().reverse();
}

export function buildExecutiveReport(state: AppState, month?: string): ExecutiveReport {
  const months = availableReportMonths(state);
  const key = month ?? months[0] ?? monthKeyOf(new Date().toISOString());
  const [year, monthNum] = key.split("-").map(Number);
  const periodLabel = capitalize(
    new Date(year, (monthNum ?? 1) - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
  );

  const monthBets = state.bets.filter((b) => b.status !== "pending" && monthKeyOf(b.eventAt) === key);

  const staked = monthBets.reduce((s, b) => s + b.stake, 0);
  const profit = monthBets.reduce((s, b) => s + betProfit(b), 0);
  const wins = monthBets.filter((b) => b.status === "won" || b.status === "cashout").length;
  const clvs = monthBets.map(clvPercent).filter((v): v is number => v !== null);

  const performance: ExecutivePerformance = {
    settledCount: monthBets.length,
    staked,
    profit,
    yield: staked > 0 ? profit / staked : 0,
    hitRate: monthBets.length > 0 ? wins / monthBets.length : 0,
    clvAverage: clvs.length > 0 ? clvs.reduce((s, v) => s + v, 0) / clvs.length : null,
  };

  // Top 3 mercados lucrativos do mês
  const topEdges = analyzeEdge({ ...state, bets: monthBets }, "market", 1)
    .filter((s) => s.profit > 0)
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 3);

  // Alerta comportamental (tilt é recente — entra como ressalva diplomática)
  const tilt = detectTilt(state);
  const behaviorAlert =
    tilt.signals.length > 0 && tilt.level !== "none" && tilt.level !== "low"
      ? `${tilt.signals[0].description} Vale revisar o controle de stake e o espaçamento entre entradas após perdas.`
      : null;

  const verdict: ExecutiveReport["verdict"] = profit > 0 ? "lucro" : profit < 0 ? "prejuizo" : "neutro";

  const summary =
    monthBets.length === 0
      ? `Nenhuma aposta liquidada em ${periodLabel}.`
      : `Em ${periodLabel}, foram ${monthBets.length} aposta${monthBets.length > 1 ? "s" : ""} liquidada${monthBets.length > 1 ? "s" : ""}, ` +
        `movimentando ${money.format(staked)} e fechando com ${profit >= 0 ? "lucro" : "prejuízo"} de ${money.format(profit)} ` +
        `(${percent.format(performance.yield)} de yield, ${percent.format(performance.hitRate)} de acerto).`;

  return {
    monthKey: key,
    periodLabel,
    generatedAt: new Date().toISOString(),
    performance,
    topEdges,
    behaviorAlert,
    summary,
    verdict,
    hasData: monthBets.length > 0,
  };
}
