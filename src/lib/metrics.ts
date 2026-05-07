import type { AppState, Bet, DashboardMetrics } from "./types";
import { calculateLedgerTotalBalance } from "./ledger";

export const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export const percent = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function betProfit(bet: Bet): number {
  if (bet.status === "pending") return 0;
  if (bet.status === "void") return 0;
  return (bet.payout ?? 0) - bet.stake;
}

export function potentialReturn(bet: Bet): number {
  return bet.stake * bet.odds;
}

export function clvPercent(bet: Bet): number | null {
  if (!bet.closingOdds) return null;
  return (bet.odds - bet.closingOdds) / bet.closingOdds;
}

export function calculateMetrics(state: AppState): DashboardMetrics {
  const totalBalance = calculateLedgerTotalBalance(state);
  const pending = state.bets.filter((bet) => bet.status === "pending");
  const settled = state.bets.filter((bet) => bet.status !== "pending" && bet.status !== "void");
  const stakedSettled = settled.reduce((sum, bet) => sum + bet.stake, 0);
  const stakedAll = state.bets.reduce((sum, bet) => sum + bet.stake, 0);
  const profit = settled.reduce((sum, bet) => sum + betProfit(bet), 0);
  const wins = settled.filter((bet) => bet.status === "won" || bet.status === "cashout").length;
  const clvs = state.bets.map(clvPercent).filter((value): value is number => value !== null);

  return {
    totalBalance,
    openExposure: pending.reduce((sum, bet) => sum + bet.stake, 0),
    profit,
    roi: stakedSettled > 0 ? profit / stakedSettled : 0,
    yield: stakedAll > 0 ? profit / stakedAll : 0,
    hitRate: settled.length > 0 ? wins / settled.length : 0,
    averageOdds: state.bets.length > 0 ? state.bets.reduce((sum, bet) => sum + bet.odds, 0) / state.bets.length : 0,
    clvAverage: clvs.length > 0 ? clvs.reduce((sum, value) => sum + value, 0) / clvs.length : 0,
    pendingCount: pending.length,
    settledCount: settled.length,
  };
}

export function groupProfitByBookmaker(state: AppState): Array<{ id: string; name: string; profit: number; bets: number }> {
  return state.bookmakers.map((book) => {
    const bets = state.bets.filter((bet) => bet.bookmakerId === book.id);
    return {
      id: book.id,
      name: book.name,
      profit: bets.reduce((sum, bet) => sum + betProfit(bet), 0),
      bets: bets.length,
    };
  });
}

export function groupProfitBySport(state: AppState): Array<{ sport: string; stake: number; profit: number; bets: number }> {
  const groups = new Map<string, { sport: string; stake: number; profit: number; bets: number }>();
  state.bets.forEach((bet) => {
    const current = groups.get(bet.sport) ?? { sport: bet.sport, stake: 0, profit: 0, bets: 0 };
    current.stake += bet.stake;
    current.profit += betProfit(bet);
    current.bets += 1;
    groups.set(bet.sport, current);
  });

  return [...groups.values()].sort((a, b) => b.stake - a.stake);
}

export function groupProfitByStrategy(state: AppState) {
  return state.strategies.map((strategy) => {
    const bets = state.bets.filter((bet) => bet.strategyId === strategy.id);
    const settled = bets.filter((bet) => bet.status !== "pending" && bet.status !== "void");
    const stake = bets.reduce((sum, bet) => sum + bet.stake, 0);
    const settledStake = settled.reduce((sum, bet) => sum + bet.stake, 0);
    const profit = bets.reduce((sum, bet) => sum + betProfit(bet), 0);
    const wins = settled.filter((bet) => bet.status === "won" || bet.status === "cashout").length;
    const clvs = bets.map(clvPercent).filter((value): value is number => value !== null);

    return {
      ...strategy,
      bets: bets.length,
      stake,
      profit,
      roi: settledStake > 0 ? profit / settledStake : 0,
      hitRate: settled.length > 0 ? wins / settled.length : 0,
      clvAverage: clvs.length > 0 ? clvs.reduce((sum, value) => sum + value, 0) / clvs.length : 0,
    };
  });
}

export function riskAlerts(state: AppState) {
  const metrics = calculateMetrics(state);
  const lastBets = [...state.bets].sort((a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime());
  const recentLosses = lastBets.slice(0, 3).filter((bet) => bet.status === "lost").length;
  const largestPending = state.bets.filter((bet) => bet.status === "pending").sort((a, b) => b.stake - a.stake)[0];
  const unit = metrics.totalBalance * (state.riskSettings.unitPercent / 100);
  const maxStake = unit * state.riskSettings.maxStakeUnits;
  const maxExposure = metrics.totalBalance * (state.riskSettings.maxOpenExposurePercent / 100);
  const alerts: Array<{ level: "warning" | "danger"; title: string; detail: string }> = [];

  if (recentLosses >= state.riskSettings.lossStreakLimit) {
    alerts.push({
      level: "danger",
      title: "Sequencia negativa",
      detail: `${recentLosses} perdas nas ultimas 3 apostas registradas. Considere reduzir ritmo antes de novas entradas.`,
    });
  }

  if (largestPending && largestPending.stake > maxStake) {
    alerts.push({
      level: "warning",
      title: "Stake acima da unidade",
      detail: `${largestPending.eventName} tem stake de ${money.format(largestPending.stake)}, acima de ${state.riskSettings.maxStakeUnits}u pela regra atual.`,
    });
  }

  if (metrics.openExposure > maxExposure) {
    alerts.push({
      level: "warning",
      title: "Exposicao aberta elevada",
      detail: `${money.format(metrics.openExposure)} em apostas pendentes, acima de ${state.riskSettings.maxOpenExposurePercent}% da banca total.`,
    });
  }

  return alerts;
}

/**
 * Computes whether a cooldown is currently active.
 * A danger-level loss streak triggers a 24-hour cooldown anchored
 * to the most recent settled bet in the streak.
 * Returns null when no cooldown applies.
 */
export function computeCooldown(state: AppState): { active: boolean; until: Date | null; reason: string } {
  const alerts = riskAlerts(state);
  const hasDanger = alerts.some((alert) => alert.level === "danger");

  if (!hasDanger) return { active: false, until: null, reason: "" };

  const lastBets = [...state.bets]
    .filter((bet) => bet.status === "lost")
    .sort((a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime());

  const triggerBet = lastBets[0];
  if (!triggerBet) return { active: false, until: null, reason: "" };

  // Use stored cooldownUntil if set and still in the future, otherwise compute from last bet
  const storedUntil = state.cooldownUntil ? new Date(state.cooldownUntil) : null;
  const computedUntil = new Date(new Date(triggerBet.placedAt).getTime() + 24 * 60 * 60 * 1000);
  const until = storedUntil && storedUntil > computedUntil ? storedUntil : computedUntil;
  const now = new Date();

  if (until <= now) return { active: false, until, reason: "" };

  const dangerAlert = alerts.find((alert) => alert.level === "danger");
  return {
    active: true,
    until,
    reason: dangerAlert?.detail ?? "Limite de risco atingido.",
  };
}
