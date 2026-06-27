/**
 * Motor de dissecação de edge — determinístico, sem IA.
 * Quebra a performance liquidada por dimensão (mercado, liga, esporte, modo,
 * tag) e devolve ROI/CLV/hit-rate + tamanho de amostra e nível de confiança.
 * É a base tanto da "Explicação de Edge" quanto do futuro "Radar de sugestões"
 * (que só deve recomendar a partir de segmentos com amostra suficiente).
 */
import type { AppState, Bet } from "./types";
import { betProfit, clvPercent } from "./metrics";

export type EdgeDimension = "market" | "league" | "sport" | "mode" | "tag";

export type EdgeConfidence = "low" | "medium" | "high";

export interface EdgeSegment {
  key: string;
  bets: number;
  staked: number;
  profit: number;
  roi: number;
  hitRate: number;
  clvAvg: number | null;
  confidence: EdgeConfidence;
}

function keysFor(bet: Bet, dimension: EdgeDimension): string[] {
  switch (dimension) {
    case "market": return bet.market ? [bet.market.trim()] : [];
    case "league": return bet.league ? [bet.league.trim()] : [];
    case "sport": return bet.sport ? [bet.sport.trim()] : [];
    case "mode": return [bet.mode === "live" ? "Live" : "Pré-live"];
    case "tag": return (bet.tags ?? []).map((t) => t.trim()).filter(Boolean);
  }
}

/** Confiança pelo tamanho de amostra — apostas exigem volume para significância. */
export function edgeConfidence(sampleSize: number): EdgeConfidence {
  if (sampleSize >= 20) return "high";
  if (sampleSize >= 8) return "medium";
  return "low";
}

/** Segmenta a performance liquidada por uma dimensão, ordenada por lucro. */
export function analyzeEdge(state: AppState, dimension: EdgeDimension, minBets = 1): EdgeSegment[] {
  const settled = state.bets.filter((b) => b.status !== "pending");
  const groups = new Map<string, Bet[]>();

  for (const bet of settled) {
    for (const key of keysFor(bet, dimension)) {
      const list = groups.get(key) ?? [];
      list.push(bet);
      groups.set(key, list);
    }
  }

  const segments: EdgeSegment[] = [];
  for (const [key, bets] of groups) {
    if (bets.length < minBets) continue;
    const staked = bets.reduce((s, b) => s + b.stake, 0);
    const profit = bets.reduce((s, b) => s + betProfit(b), 0);
    const wins = bets.filter((b) => b.status === "won" || b.status === "cashout" || b.status === "half_won").length;
    const clvs = bets.map(clvPercent).filter((v): v is number => v !== null);
    segments.push({
      key,
      bets: bets.length,
      staked,
      profit,
      roi: staked > 0 ? profit / staked : 0,
      hitRate: bets.length > 0 ? wins / bets.length : 0,
      clvAvg: clvs.length > 0 ? clvs.reduce((s, v) => s + v, 0) / clvs.length : null,
      confidence: edgeConfidence(bets.length),
    });
  }

  return segments.sort((a, b) => b.profit - a.profit);
}

/**
 * Melhor e pior segmento por ROI, considerando só amostras minimamente
 * relevantes (>= 3 apostas) — evita destacar ruído de 1 aposta sortuda.
 */
export function edgeHighlights(
  state: AppState,
  dimension: EdgeDimension,
): { best: EdgeSegment | null; worst: EdgeSegment | null } {
  const segs = analyzeEdge(state, dimension, 3);
  if (segs.length === 0) return { best: null, worst: null };
  const byRoi = [...segs].sort((a, b) => b.roi - a.roi);
  const best = byRoi[0].roi > 0 ? byRoi[0] : null;
  const worst = byRoi[byRoi.length - 1].roi < 0 ? byRoi[byRoi.length - 1] : null;
  return { best, worst };
}

/* ── Radar de oportunidades — matriz edge × exposição ─────────────────────── */

export type RadarVerdict = "goldmine" | "drain" | "neutral";

export interface RadarSignal {
  segment: EdgeSegment;
  /** Fatia do capital total liquidado alocada neste segmento (0..1). */
  exposureShare: number;
  verdict: RadarVerdict;
}

// Limiares da matriz (decisões de produto, conservadoras):
const EDGE_GOOD = 0.05;    // ROI >= +5% = edge real
const EDGE_BAD = -0.05;    // ROI <= -5% = prejuízo consistente
const UNDER_EXPOSED = 0.15; // < 15% do capital = sub-alocado
const OVER_EXPOSED = 0.20;  // >= 20% do capital = sobre-alocado

/**
 * Classifica um segmento na matriz:
 * - goldmine: edge positivo com pouca exposição (capital sub-alocado)
 * - drain: prejuízo consistente com muita exposição (dreno de banca)
 * Só classifica com amostra minimamente confiável (>= medium).
 */
export function classifyRadar(segment: EdgeSegment, exposureShare: number): RadarVerdict {
  if (segment.confidence === "low") return "neutral";
  if (segment.roi >= EDGE_GOOD && exposureShare < UNDER_EXPOSED) return "goldmine";
  if (segment.roi <= EDGE_BAD && exposureShare >= OVER_EXPOSED) return "drain";
  return "neutral";
}

/** Cruza cada segmento com sua fatia de exposição e devolve o veredito do radar. */
export function opportunityRadar(state: AppState, dimension: EdgeDimension): RadarSignal[] {
  const segments = analyzeEdge(state, dimension, 1);
  const totalStaked = state.bets
    .filter((b) => b.status !== "pending")
    .reduce((s, b) => s + b.stake, 0);

  return segments.map((segment) => {
    const exposureShare = totalStaked > 0 ? segment.staked / totalStaked : 0;
    return { segment, exposureShare, verdict: classifyRadar(segment, exposureShare) };
  });
}
