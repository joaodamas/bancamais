import type { AppState } from "./types";
import {
  calculateMetrics,
  profitFactor,
  segmentByMarket,
  segmentByLeague,
  segmentByOddsBand,
  segmentByStakeBand,
  segmentByDayOfWeek,
  type SegmentStats,
} from "./metrics";

export interface Insight {
  tone: "positive" | "negative" | "neutral";
  title: string;
  detail: string;
}

const MIN_SAMPLE = 3;

function best(segments: SegmentStats[]): SegmentStats | null {
  const eligible = segments.filter((segment) => segment.bets >= MIN_SAMPLE);
  if (eligible.length === 0) return null;
  return eligible.reduce((acc, segment) => (segment.roi > acc.roi ? segment : acc));
}

function worst(segments: SegmentStats[]): SegmentStats | null {
  const eligible = segments.filter((segment) => segment.bets >= MIN_SAMPLE);
  if (eligible.length === 0) return null;
  return eligible.reduce((acc, segment) => (segment.roi < acc.roi ? segment : acc));
}

function pct(value: number): string {
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
}

/**
 * Transforma os cortes determinísticos em leitura de linguagem simples.
 * Tudo é cálculo puro — nenhum número vem de LLM.
 */
export function buildInsights(state: AppState): Insight[] {
  const insights: Insight[] = [];
  const metrics = calculateMetrics(state);

  if (metrics.settledCount < MIN_SAMPLE) {
    return insights;
  }

  const markets = segmentByMarket(state);
  const bestMarket = best(markets);
  const worstMarket = worst(markets);
  if (bestMarket && bestMarket.roi > 0.05) {
    insights.push({
      tone: "positive",
      title: `Seu forte: ${bestMarket.label}`,
      detail: `ROI ${pct(bestMarket.roi)} em ${bestMarket.bets} apostas — é onde você ganha dinheiro.`,
    });
  }
  if (worstMarket && worstMarket.roi < -0.05 && worstMarket.label !== bestMarket?.label) {
    insights.push({
      tone: "negative",
      title: `Você sangra em ${worstMarket.label}`,
      detail: `ROI ${pct(worstMarket.roi)} em ${worstMarket.bets} apostas — considere cortar ou revisar.`,
    });
  }

  const leagues = segmentByLeague(state);
  const bestLeague = best(leagues);
  if (bestLeague && bestLeague.roi > 0.05) {
    insights.push({
      tone: "positive",
      title: `Melhor campeonato: ${bestLeague.label}`,
      detail: `ROI ${pct(bestLeague.roi)} em ${bestLeague.bets} apostas.`,
    });
  }
  const worstLeague = worst(leagues);
  if (worstLeague && worstLeague.roi < -0.05 && worstLeague.label !== bestLeague?.label) {
    insights.push({
      tone: "negative",
      title: `Cuidado com ${worstLeague.label}`,
      detail: `ROI ${pct(worstLeague.roi)} em ${worstLeague.bets} apostas.`,
    });
  }

  const bestOdds = best(segmentByOddsBand(state));
  if (bestOdds && bestOdds.roi > 0.05) {
    insights.push({
      tone: "positive",
      title: `Ponto doce de cotação: ${bestOdds.label}`,
      detail: `ROI ${pct(bestOdds.roi)} — sua faixa de odd mais rentável.`,
    });
  }

  const bigStake = segmentByStakeBand(state).find((segment) => segment.label.includes("≥ 2×"));
  if (bigStake && bigStake.bets >= MIN_SAMPLE && bigStake.roi < -0.05) {
    insights.push({
      tone: "negative",
      title: "Entradas grandes dão prejuízo",
      detail: `Apostas ≥ 2× a stake média têm ROI ${pct(bigStake.roi)}. Disciplina: reduza o tamanho.`,
    });
  }

  const worstDay = worst(segmentByDayOfWeek(state));
  if (worstDay && worstDay.roi < -0.1) {
    insights.push({
      tone: "negative",
      title: `${worstDay.label} é seu pior dia`,
      detail: `ROI ${pct(worstDay.roi)} nas entradas desse dia. Talvez apostar menos.`,
    });
  }

  if (metrics.clvAverage > 0.01) {
    insights.push({
      tone: "positive",
      title: "Você bate a linha de fechamento",
      detail: `CLV médio ${pct(metrics.clvAverage)} — sinal forte de edge de longo prazo.`,
    });
  } else if (metrics.clvAverage < -0.01) {
    insights.push({
      tone: "negative",
      title: "Você perde valor no fechamento",
      detail: `CLV médio ${pct(metrics.clvAverage)} — o mercado fecha contra você.`,
    });
  }

  const pf = profitFactor(state);
  if (pf != null && pf >= 1.2) {
    insights.push({
      tone: "positive",
      title: `Fator de lucro ${pf.toFixed(2)}`,
      detail: "Seus ganhos superam as perdas com folga.",
    });
  } else if (pf != null && pf < 0.9) {
    insights.push({
      tone: "negative",
      title: `Fator de lucro ${pf.toFixed(2)}`,
      detail: "Você devolve mais do que ganha — revise a seleção.",
    });
  }

  return insights;
}
