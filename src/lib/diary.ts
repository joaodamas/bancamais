import type { AppState, Bet } from "./types";
import { betProfit } from "./metrics";

export interface DiaryBet {
  id: string;
  time: string;
  eventName: string;
  market: string;
  selection: string;
  stake: number;
  odds: number;
  status: Bet["status"];
  profit: number;
  settled: boolean;
}

export interface DiaryDay {
  key: string; // YYYY-MM-DD
  label: string;
  profit: number;
  staked: number;
  bets: DiaryBet[];
}

export interface DiaryMonth {
  key: string; // YYYY-MM
  label: string;
  profit: number;
  betCount: number;
  days: DiaryDay[];
}

function dayKey(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Agrupa as apostas por dia (data de registro) dentro de meses, com subtotais de P&L. */
export function buildDiary(state: AppState): DiaryMonth[] {
  const byDay = new Map<string, Bet[]>();
  for (const bet of state.bets) {
    const key = dayKey(bet.placedAt);
    if (!key) continue;
    const list = byDay.get(key) ?? [];
    list.push(bet);
    byDay.set(key, list);
  }

  const days: DiaryDay[] = [...byDay.entries()].map(([key, bets]) => {
    const sorted = [...bets].sort((a, b) => b.placedAt.localeCompare(a.placedAt));
    const date = new Date(`${key}T12:00:00`);
    return {
      key,
      label: date.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "short" }),
      profit: sorted.reduce((sum, bet) => sum + betProfit(bet), 0),
      staked: sorted.reduce((sum, bet) => sum + bet.stake, 0),
      bets: sorted.map((bet) => ({
        id: bet.id,
        time: new Date(bet.placedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        eventName: bet.eventName,
        market: bet.market,
        selection: bet.selection,
        stake: bet.stake,
        odds: bet.odds,
        status: bet.status,
        profit: betProfit(bet),
        settled: bet.status !== "pending" && bet.status !== "void",
      })),
    };
  });

  const byMonth = new Map<string, DiaryDay[]>();
  for (const day of days) {
    const monthKey = day.key.slice(0, 7);
    const list = byMonth.get(monthKey) ?? [];
    list.push(day);
    byMonth.set(monthKey, list);
  }

  const months: DiaryMonth[] = [...byMonth.entries()].map(([key, monthDays]) => {
    const sortedDays = monthDays.sort((a, b) => b.key.localeCompare(a.key));
    const [year, month] = key.split("-");
    const date = new Date(Number(year), Number(month) - 1, 1);
    return {
      key,
      label: date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
      profit: sortedDays.reduce((sum, day) => sum + day.profit, 0),
      betCount: sortedDays.reduce((sum, day) => sum + day.bets.length, 0),
      days: sortedDays,
    };
  });

  return months.sort((a, b) => b.key.localeCompare(a.key));
}
