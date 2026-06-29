import type { AppState, Bet } from "./types";
import { betProfit, isLossResult } from "./metrics";

export interface TiltSignal {
  type: "rapid_sequence" | "stake_escalation" | "live_chasing" | "loss_chasing" | "revenge_betting";
  description: string;
  weight: number;
}

export type TiltLevel = "none" | "low" | "medium" | "high" | "critical";

export interface TiltAnalysis {
  score: number;
  level: TiltLevel;
  signals: TiltSignal[];
  recommendation: string;
  recentLossAmount: number;
  recentBetsCount: number;
}

function getRecentBets(bets: Bet[], hours: number): Bet[] {
  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  return bets.filter((b) => new Date(b.placedAt).getTime() >= cutoff);
}

function stakeAverage(bets: Bet[]): number {
  if (bets.length === 0) return 0;
  return bets.reduce((s, b) => s + b.stake, 0) / bets.length;
}

export function detectTilt(state: AppState): TiltAnalysis {
  const allBets = [...state.bets].sort(
    (a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime(),
  );

  if (allBets.length < 3) {
    return {
      score: 0,
      level: "none",
      signals: [],
      recommendation: "Volume insuficiente para análise de comportamento.",
      recentLossAmount: 0,
      recentBetsCount: 0,
    };
  }

  const signals: TiltSignal[] = [];
  const last6h = getRecentBets(allBets, 6);
  const last24h = getRecentBets(allBets, 24);
  const last7days = getRecentBets(allBets, 168);
  const historicalBets = allBets.slice(10); // apostas mais antigas como baseline

  const recentLoss = last24h
    .filter((b) => isLossResult(b))
    .reduce((s, b) => s + Math.abs(betProfit(b)), 0);

  // Sinal 1: Apostas em sequência rápida após perdas
  const last2h = getRecentBets(allBets, 2);
  const recentLossesShort = last2h.filter((b) => isLossResult(b)).length;
  if (last2h.length >= 4 && recentLossesShort >= 2) {
    signals.push({
      type: "rapid_sequence",
      description: `${last2h.length} apostas nas últimas 2h, ${recentLossesShort} perdidas.`,
      weight: 30,
    });
  } else if (last6h.length >= 5) {
    signals.push({
      type: "rapid_sequence",
      description: `${last6h.length} apostas nas últimas 6h — ritmo acima do normal.`,
      weight: 15,
    });
  }

  // Sinal 2: Escalada de stake após perdas
  const baselineStake = stakeAverage(historicalBets);
  const recentStake = stakeAverage(last24h.slice(0, 5));
  if (baselineStake > 0 && recentStake > baselineStake * 1.8) {
    signals.push({
      type: "stake_escalation",
      description: `Stake médio recente (${recentStake.toFixed(0)}) é ${((recentStake / baselineStake) * 100 - 100).toFixed(0)}% acima da média histórica.`,
      weight: 35,
    });
  } else if (baselineStake > 0 && recentStake > baselineStake * 1.4) {
    signals.push({
      type: "stake_escalation",
      description: `Stake médio recente elevado (+${((recentStake / baselineStake) * 100 - 100).toFixed(0)}% vs histórico).`,
      weight: 15,
    });
  }

  // Sinal 3: Chasing live após perdas pre-live
  const preLiveLosses24h = last24h.filter((b) => b.mode === "prelive" && isLossResult(b)).length;
  const liveAfterLoss = last24h.filter((b, i) => {
    if (b.mode !== "live") return false;
    const prevBets = last24h.slice(i + 1, i + 4);
    return prevBets.some((pb) => isLossResult(pb));
  }).length;

  if (preLiveLosses24h >= 2 && liveAfterLoss >= 1) {
    signals.push({
      type: "live_chasing",
      description: `${liveAfterLoss} aposta(s) live registrada(s) após ${preLiveLosses24h} perdas pre-live em 24h.`,
      weight: 25,
    });
  }

  // Sinal 4: Loss chasing — apostas consecutivas imediatas após perdas
  const consecutiveLossChain = (() => {
    let chain = 0;
    for (const bet of allBets.slice(0, 8)) {
      if (isLossResult(bet)) chain++;
      else if (bet.status === "pending") continue;
      else break;
    }
    return chain;
  })();

  if (consecutiveLossChain >= 4) {
    signals.push({
      type: "loss_chasing",
      description: `${consecutiveLossChain} perdas consecutivas nas apostas mais recentes.`,
      weight: 40,
    });
  } else if (consecutiveLossChain >= 3) {
    signals.push({
      type: "loss_chasing",
      description: `${consecutiveLossChain} perdas consecutivas nas últimas apostas.`,
      weight: 20,
    });
  }

  // Sinal 5: Revenge betting — apostas em eventos diferentes imediatamente após perda
  const revengeWindow = last6h.filter((b) => b.status !== "pending");
  if (revengeWindow.length >= 3) {
    const uniqueEvents = new Set(revengeWindow.map((b) => b.eventName)).size;
    if (uniqueEvents === revengeWindow.length && revengeWindow[0] !== undefined && isLossResult(revengeWindow[0])) {
      signals.push({
        type: "revenge_betting",
        description: `${revengeWindow.length} apostas em eventos distintos em 6h, iniciando com perda.`,
        weight: 20,
      });
    }
  }

  const score = Math.min(100, signals.reduce((s, sig) => s + sig.weight, 0));

  const level: TiltLevel =
    score === 0 ? "none" :
    score < 20 ? "low" :
    score < 45 ? "medium" :
    score < 70 ? "high" : "critical";

  const recommendations: Record<TiltLevel, string> = {
    none: "Comportamento dentro do padrão esperado. Continue com disciplina.",
    low: "Sinais leves detectados. Revise as últimas entradas antes de prosseguir.",
    medium: "Padrão de comportamento alterado. Recomenda-se uma pausa de pelo menos 1h.",
    high: "Risco de tilt elevado. Pause agora, revise o dia e volte amanhã.",
    critical: "Tilt provável detectado. Interrompa todas as operações pelo restante do dia.",
  };

  return {
    score,
    level,
    signals,
    recommendation: recommendations[level],
    recentLossAmount: recentLoss,
    recentBetsCount: last24h.length,
  };
}

export function tiltLevelColor(level: TiltLevel): string {
  const map: Record<TiltLevel, string> = {
    none: "var(--positive)",
    low: "var(--info)",
    medium: "var(--warning)",
    high: "var(--negative)",
    critical: "var(--negative)",
  };
  return map[level];
}

export function tiltLevelLabel(level: TiltLevel): string {
  const map: Record<TiltLevel, string> = {
    none: "Normal",
    low: "Atenção leve",
    medium: "Moderado",
    high: "Alto",
    critical: "Crítico",
  };
  return map[level];
}
