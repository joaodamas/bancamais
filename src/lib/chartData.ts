import type { AppState } from "./types";
import { potentialReturn, groupProfitBySport, groupProfitByBookmaker, groupProfitByStrategy, clvPercent } from "./metrics";

export interface TimeSeriesPoint {
  label: string;
  balance: number;
  date: string;
}

export interface SportProfitPoint {
  sport: string;
  profit: number;
  bets: number;
  stake: number;
}

export interface MonthlyPoint {
  month: string;
  roi: number;
  profit: number;
  staked: number;
  bets: number;
}

export interface BookmakerShare {
  name: string;
  value: number;
  balance: number;
}

export interface ClvPoint {
  label: string;
  clv: number;
  odds: number;
  closingOdds: number;
}

export function buildBankrollTimeSeries(state: AppState): TimeSeriesPoint[] {
  const events: Array<{ date: string; amount: number; label: string }> = [];

  for (const tx of state.transactions) {
    events.push({ date: tx.date, amount: tx.amount, label: tx.description });
  }

  for (const bet of state.bets) {
    if (bet.status === "pending") continue;
    const payout =
      bet.status === "won"
        ? potentialReturn(bet)
        : bet.status === "void"
        ? bet.stake
        : 0;
    const pnl = payout - bet.stake;
    events.push({ date: bet.eventAt, amount: pnl, label: bet.eventName });
  }

  events.sort((a, b) => a.date.localeCompare(b.date));

  let balance = state.startingBalance;
  const points: TimeSeriesPoint[] = [
    { label: "Início", balance, date: "" },
  ];

  for (const event of events) {
    balance = Math.max(0, balance + event.amount);
    const d = new Date(event.date);
    const label = d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
    });
    points.push({ label, balance, date: event.date });
  }

  return points.length > 1 ? points : [];
}

export function buildSportProfitData(state: AppState): SportProfitPoint[] {
  return groupProfitBySport(state)
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 8);
}

export function buildMonthlyData(state: AppState): MonthlyPoint[] {
  const map = new Map<string, { profit: number; staked: number; bets: number }>();

  for (const bet of state.bets) {
    if (bet.status === "pending") continue;
    const d = new Date(bet.eventAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const existing = map.get(key) ?? { profit: 0, staked: 0, bets: 0 };
    const payout =
      bet.status === "won"
        ? potentialReturn(bet)
        : bet.status === "void"
        ? bet.stake
        : 0;
    map.set(key, {
      profit: existing.profit + payout - bet.stake,
      staked: existing.staked + bet.stake,
      bets: existing.bets + 1,
    });
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, data]) => {
      const [year, month] = key.split("-");
      const label = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("pt-BR", {
        month: "short",
        year: "2-digit",
      });
      return {
        month: label,
        roi: data.staked > 0 ? data.profit / data.staked : 0,
        profit: data.profit,
        staked: data.staked,
        bets: data.bets,
      };
    });
}

export function buildBookmakerShareData(state: AppState): BookmakerShare[] {
  const total = state.bookmakers.reduce((sum, b) => sum + Math.max(b.balance, 0), 0);
  return state.bookmakers
    .filter((b) => b.balance > 0)
    .map((b) => ({
      name: b.name,
      value: total > 0 ? Math.round((b.balance / total) * 100) : 0,
      balance: b.balance,
    }))
    .sort((a, b) => b.value - a.value);
}

export function buildClvTimeSeries(state: AppState): ClvPoint[] {
  return state.bets
    .filter(
      (b) => b.closingOdds !== undefined && b.closingOdds > 1 && b.status !== "pending"
    )
    .sort((a, b) => a.placedAt.localeCompare(b.placedAt))
    .map((bet, index) => {
      const clv = clvPercent(bet) ?? 0;
      return {
        label: `#${index + 1}`,
        clv: Math.round(clv * 1000) / 10,
        odds: bet.odds,
        closingOdds: bet.closingOdds!,
      };
    });
}

// Re-export groupProfitByStrategy so consumers don't need an extra import
export { groupProfitBySport, groupProfitByBookmaker, groupProfitByStrategy };
