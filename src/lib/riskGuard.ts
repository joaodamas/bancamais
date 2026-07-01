import type { AppState, Bet, RiskSettings } from "./types";
import { monitoredBankroll } from "./ledger";
import { betProfit, money } from "./metrics";
import { resolveUnitValue } from "./unit";

export interface RiskAlert {
  level: "info" | "warning" | "danger";
  title: string;
  detail: string;
  metric?: string;
}

export interface HardStopStatus {
  blocked: boolean;
  reason?: string;
  type?: "daily" | "weekly" | "monthly";
  limitPercent: number;
  currentPercent: number;
  limitAmount: number;
  currentAmount: number;
}

export interface BetRiskCheck {
  canPlace: boolean;
  hardStop: HardStopStatus | null;
  warnings: RiskAlert[];
}

function getSettledBetsInWindow(bets: Bet[], hours: number): Bet[] {
  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  return bets.filter(
    (b) => b.status !== "pending" && new Date(b.placedAt).getTime() >= cutoff,
  );
}

/**
 * Prejuízo LÍQUIDO da janela: soma dos resultados (ganhos abatem perdas) e
 * devolve o quanto está no vermelho (0 se a janela está no lucro).
 * Usar perda líquida — e não a soma das perdas brutas — evita bloquear o
 * apostador num dia/semana/mês em que ele está, no saldo, positivo.
 */
function lossInWindow(bets: Bet[]): number {
  const net = bets.reduce((sum, b) => sum + betProfit(b), 0);
  return net < 0 ? -net : 0;
}

/** Pausa responsável ativa: devolve o ISO até quando está pausado, ou null. */
export function isBettingPaused(state: AppState, now: number = Date.now()): string | null {
  const until = state.riskSettings.pausedUntil;
  if (!until) return null;
  const ts = Date.parse(until);
  if (Number.isNaN(ts) || ts <= now) return null;
  return until;
}

export function checkHardStop(state: AppState): HardStopStatus | null {
  const rs = state.riskSettings;
  if (!rs.hardStopEnabled) return null;

  const balance = monitoredBankroll(state);
  if (balance <= 0) return null;

  const settled = state.bets.filter((b) => b.status !== "pending" && b.status !== "void");

  // Daily check — últimas 24h
  const daily = getSettledBetsInWindow(settled, 24);
  const dailyLoss = lossInWindow(daily);
  const dailyLimit = balance * (rs.dailyLossLimitPercent / 100);
  if (dailyLoss >= dailyLimit) {
    return {
      blocked: true,
      reason: `Limite diário atingido: ${money.format(dailyLoss)} de prejuízo líquido hoje (limite ${money.format(dailyLimit)}).`,
      type: "daily",
      limitPercent: rs.dailyLossLimitPercent,
      currentPercent: (dailyLoss / balance) * 100,
      limitAmount: dailyLimit,
      currentAmount: dailyLoss,
    };
  }

  // Weekly check — últimas 168h
  const weekly = getSettledBetsInWindow(settled, 168);
  const weeklyLoss = lossInWindow(weekly);
  const weeklyLimit = balance * (rs.weeklyLossLimitPercent / 100);
  if (weeklyLoss >= weeklyLimit) {
    return {
      blocked: true,
      reason: `Limite semanal atingido: ${money.format(weeklyLoss)} de prejuízo líquido na semana (limite ${money.format(weeklyLimit)}).`,
      type: "weekly",
      limitPercent: rs.weeklyLossLimitPercent,
      currentPercent: (weeklyLoss / balance) * 100,
      limitAmount: weeklyLimit,
      currentAmount: weeklyLoss,
    };
  }

  // Monthly drawdown — últimas 720h
  const monthly = getSettledBetsInWindow(settled, 720);
  const monthlyLoss = lossInWindow(monthly);
  const monthlyLimit = balance * (rs.monthlyDrawdownPercent / 100);
  if (monthlyLoss >= monthlyLimit) {
    return {
      blocked: true,
      reason: `Limite mensal atingido: ${money.format(monthlyLoss)} de prejuízo líquido no mês (limite ${money.format(monthlyLimit)}).`,
      type: "monthly",
      limitPercent: rs.monthlyDrawdownPercent,
      currentPercent: (monthlyLoss / balance) * 100,
      limitAmount: monthlyLimit,
      currentAmount: monthlyLoss,
    };
  }

  return null;
}

export function riskAlertsExtended(state: AppState): RiskAlert[] {
  const balance = monitoredBankroll(state);
  if (balance <= 0) return [];

  const rs: RiskSettings = state.riskSettings;
  const unit = resolveUnitValue(rs, balance);
  const maxStake = unit * rs.maxStakeUnits;
  const maxExposure = balance * (rs.maxOpenExposurePercent / 100);

  const pending = state.bets.filter((b) => b.status === "pending");
  const openExposure = pending.reduce((s, b) => s + b.stake, 0);

  const settled = state.bets.filter((b) => b.status !== "pending" && b.status !== "void");
  const sorted = [...state.bets].sort((a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime());
  const recentLosses = sorted.slice(0, rs.lossStreakLimit + 1).filter((b) => b.status === "lost").length;

  const alerts: RiskAlert[] = [];

  // Sequência negativa
  if (recentLosses >= rs.lossStreakLimit) {
    alerts.push({
      level: "danger",
      title: "Sequência negativa",
      detail: `${recentLosses} perdas consecutivas detectadas. Pause, revise o contexto e volte com disciplina.`,
      metric: `${recentLosses} perdas`,
    });
  }

  // Overbetting
  const largestPending = pending.sort((a, b) => b.stake - a.stake)[0];
  if (largestPending && largestPending.stake > maxStake) {
    alerts.push({
      level: "warning",
      title: "Stake acima do limite",
      detail: `"${largestPending.eventName}" tem stake de ${money.format(largestPending.stake)}, acima de ${rs.maxStakeUnits}u (${money.format(maxStake)}).`,
      metric: money.format(largestPending.stake),
    });
  }

  // Exposição alta
  if (openExposure > maxExposure) {
    alerts.push({
      level: "warning",
      title: "Exposição aberta elevada",
      detail: `${money.format(openExposure)} em risco (${((openExposure / balance) * 100).toFixed(1)}% da banca). Limite: ${rs.maxOpenExposurePercent}%.`,
      metric: `${((openExposure / balance) * 100).toFixed(1)}%`,
    });
  }

  // Hard stops parciais (alertas antes de bloquear)
  if (rs.hardStopEnabled) {
    const daily = getSettledBetsInWindow(settled, 24);
    const dailyLoss = lossInWindow(daily);
    const dailyLimit = balance * (rs.dailyLossLimitPercent / 100);
    const dailyPct = dailyLimit > 0 ? dailyLoss / dailyLimit : 0;

    if (dailyPct >= 0.7 && dailyPct < 1) {
      alerts.push({
        level: "warning",
        title: "Limite diário próximo",
        detail: `${money.format(dailyLoss)} de prejuízo líquido hoje (${(dailyPct * 100).toFixed(0)}% do limite de ${money.format(dailyLimit)}).`,
        metric: `${(dailyPct * 100).toFixed(0)}%`,
      });
    }

    const weekly = getSettledBetsInWindow(settled, 168);
    const weeklyLoss = lossInWindow(weekly);
    const weeklyLimit = balance * (rs.weeklyLossLimitPercent / 100);
    const weeklyPct = weeklyLimit > 0 ? weeklyLoss / weeklyLimit : 0;

    if (weeklyPct >= 0.7 && weeklyPct < 1) {
      alerts.push({
        level: "info",
        title: "Limite semanal próximo",
        detail: `${money.format(weeklyLoss)} de prejuízo líquido na semana (${(weeklyPct * 100).toFixed(0)}% do limite de ${money.format(weeklyLimit)}).`,
        metric: `${(weeklyPct * 100).toFixed(0)}%`,
      });
    }
  }

  return alerts;
}

export function checkBetRisk(state: AppState, stake: number, bookmakerId: string): BetRiskCheck {
  const hardStop = checkHardStop(state);
  if (hardStop) {
    return { canPlace: false, hardStop, warnings: [] };
  }

  const balance = monitoredBankroll(state);
  const rs = state.riskSettings;
  const unit = resolveUnitValue(rs, balance);
  const maxStake = unit * rs.maxStakeUnits;
  const warnings: RiskAlert[] = [];

  if (stake > maxStake && maxStake > 0) {
    warnings.push({
      level: "warning",
      title: "Stake acima do limite",
      detail: `${money.format(stake)} excede ${rs.maxStakeUnits}u (${money.format(maxStake)}).`,
    });
  }

  const openExposure = state.bets
    .filter((b) => b.status === "pending")
    .reduce((s, b) => s + b.stake, 0);
  const maxExposure = balance * (rs.maxOpenExposurePercent / 100);
  if (openExposure + stake > maxExposure && maxExposure > 0) {
    warnings.push({
      level: "warning",
      title: "Exposição total ultrapassaria o limite",
      detail: `Com esta aposta, a exposição total seria ${money.format(openExposure + stake)} (limite: ${money.format(maxExposure)}).`,
    });
  }

  const sorted = [...state.bets].sort((a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime());
  const recentLosses = sorted.slice(0, rs.lossStreakLimit).filter((b) => b.status === "lost").length;
  if (recentLosses >= rs.lossStreakLimit) {
    warnings.push({
      level: "danger",
      title: "Sequência negativa ativa",
      detail: `${recentLosses} perdas consecutivas. Avalie a entrada com cuidado.`,
    });
  }

  return { canPlace: true, hardStop: null, warnings };
}

export function getHardStopProgress(state: AppState): Array<{
  type: "daily" | "weekly" | "monthly";
  label: string;
  limitPercent: number;
  currentPercent: number;
  currentAmount: number;
  limitAmount: number;
  triggered: boolean;
}> {
  const rs = state.riskSettings;
  if (!rs.hardStopEnabled) return [];

  const balance = monitoredBankroll(state);
  if (balance <= 0) return [];

  const settled = state.bets.filter((b) => b.status !== "pending" && b.status !== "void");

  const windows: Array<{ type: "daily" | "weekly" | "monthly"; label: string; hours: number; limitPct: number }> = [
    { type: "daily", label: "Hoje", hours: 24, limitPct: rs.dailyLossLimitPercent },
    { type: "weekly", label: "Esta semana", hours: 168, limitPct: rs.weeklyLossLimitPercent },
    { type: "monthly", label: "Este mês", hours: 720, limitPct: rs.monthlyDrawdownPercent },
  ];

  return windows.map(({ type, label, hours, limitPct }) => {
    const bets = getSettledBetsInWindow(settled, hours);
    const loss = lossInWindow(bets);
    const limitAmount = balance * (limitPct / 100);
    const currentPct = limitAmount > 0 ? (loss / limitAmount) * 100 : 0;
    return {
      type,
      label,
      limitPercent: limitPct,
      currentPercent: Math.min(currentPct, 100),
      currentAmount: loss,
      limitAmount,
      triggered: loss >= limitAmount,
    };
  });
}
