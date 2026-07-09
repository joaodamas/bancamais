import type { AppState } from "./types";
import { groupProfitBySport, groupProfitByBookmaker, groupProfitByStrategy, clvPercent, betProfit, isRiskedBet } from "./metrics";
import { buildLedgerTimeline, deriveBookmakerBalances, monitoredBankroll } from "./ledger";

export interface TimeSeriesPoint {
  label: string;
  axisLabel: string;
  tooltipLabel: string;
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
  key: string;
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
  const events = buildLedgerTimeline(state);

  // Parte do 0: o saldo inicial vem das transações de depósito,
  // não do startingBalance (que não entra no ledger de bookmakers).
  // O running sem clamp garante que o ponto final == calculateLedgerTotalBalance()
  // (a soma do ledger). Clampar em 0 a cada evento descolava a curva do Saldo real.
  let balance = 0;
  const points: TimeSeriesPoint[] = [
    { label: "Início", axisLabel: "Início", tooltipLabel: "Início da série", balance, date: "" },
  ];

  const validEvents = events
    .map((event) => ({ event, parsed: new Date(event.date) }))
    .filter(({ parsed }) => !Number.isNaN(parsed.getTime()));
  const uniqueDays = new Set(validEvents.map(({ parsed }) => parsed.toISOString().slice(0, 10)));
  const intradayView = uniqueDays.size <= 1;

  for (const event of events) {
    balance = Number((balance + event.amount).toFixed(2));
    const d = new Date(event.date);
    const axisLabel = intradayView
      ? d.toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : d.toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "short",
        });
    const tooltipLabel = d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    points.push({ label: axisLabel, axisLabel, tooltipLabel, balance, date: event.date });
  }

  return points.length > 1 ? points : [];
}

export interface DailyProfitPoint {
  date: string;
  axisLabel: string;
  tooltipLabel: string;
  profit: number;
  cumulative: number;
}

/**
 * Chave de dia no fuso LOCAL do usuário (YYYY-MM-DD). Base única de data para
 * as agregações temporais — evita o descasamento em que o diário usava a data
 * UTC (slice do ISO) e o mensal usava o mês local: uma aposta de 23h caía em
 * dias/meses diferentes entre as telas.
 */
export function localDayKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Lucro por data (apostas liquidadas) + acumulado — histórico desde a 1ª aposta.
 *  Distinto da curva da banca: isola o desempenho das apostas (sem depósitos/saques). */
export function buildDailyProfitSeries(state: AppState): DailyProfitPoint[] {
  const byDay = new Map<string, number>();
  for (const bet of state.bets) {
    if (bet.status === "pending") continue;
    const day = localDayKey(bet.eventAt || bet.placedAt || "");
    if (!day) continue;
    byDay.set(day, (byDay.get(day) ?? 0) + betProfit(bet));
  }

  let cumulative = 0;
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, profit]) => {
      cumulative += profit;
      const d = new Date(`${day}T12:00:00`);
      const axisLabel = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
      const tooltipLabel = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
      return {
        date: day,
        axisLabel,
        tooltipLabel,
        profit: Number(profit.toFixed(2)),
        cumulative: Number(cumulative.toFixed(2)),
      };
    });
}

export interface DrawdownPoint {
  axisLabel: string;
  tooltipLabel: string;
  /** Fração underwater (≤ 0): quanto a banca está abaixo do pico realizado. */
  drawdown: number;
}

export interface RealizedDrawdown {
  series: DrawdownPoint[];
  worstAbs: number;
  worstPct: number;
}

/**
 * Drawdown sobre o LUCRO REALIZADO (apostas liquidadas), não sobre o caixa.
 * A curva de caixa cai toda vez que um stake sai da conta (dinheiro EM JOGO,
 * não perdido) — o que gerava um "-100% do pico" fantasma quando muita banca
 * estava apostada. Aqui o vale só acontece com resultado liquidado no vermelho,
 * como no Relatório. % é sobre o capital no topo da curva (banca + lucro no pico).
 */
export function buildRealizedDrawdown(state: AppState): RealizedDrawdown {
  const settled = state.bets
    .filter((bet) => bet.status !== "pending")
    .slice()
    .sort((a, b) => (a.eventAt || a.placedAt).localeCompare(b.eventAt || b.placedAt));

  const base = monitoredBankroll(state);
  let peak = 0;
  let running = 0;
  let worstAbs = 0;
  let worstPct = 0;
  const series: DrawdownPoint[] = [];

  for (const bet of settled) {
    running = Number((running + betProfit(bet)).toFixed(2));
    if (running > peak) peak = running;
    const dd = peak - running;
    const capitalAtPeak = base + peak;
    const ddPct = capitalAtPeak > 0 ? -(dd / capitalAtPeak) : 0;
    if (dd > worstAbs) {
      worstAbs = dd;
      worstPct = ddPct;
    }
    const d = new Date(bet.eventAt || bet.placedAt);
    const valid = !Number.isNaN(d.getTime());
    series.push({
      axisLabel: valid ? d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "",
      tooltipLabel: valid ? d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "",
      drawdown: ddPct,
    });
  }

  return { series, worstAbs, worstPct };
}

export function buildSportProfitData(state: AppState): SportProfitPoint[] {
  return groupProfitBySport(state)
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 8);
}

export function buildMonthlyData(state: AppState): MonthlyPoint[] {
  const map = new Map<string, { profit: number; staked: number; bets: number; riskedProfit: number; riskedStake: number }>();

  for (const bet of state.bets) {
    if (bet.status === "pending") continue;
    const dayKey = localDayKey(bet.eventAt || bet.placedAt || "");
    if (!dayKey) continue;
    const key = dayKey.slice(0, 7); // YYYY-MM, mesmo fuso local do diário
    const existing = map.get(key) ?? { profit: 0, staked: 0, bets: 0, riskedProfit: 0, riskedStake: 0 };
    // Yield real: só apostas arriscadas entram no turnover e no numerador —
    // freebet (payout sem stake próprio) e void (status settled) ficam de fora,
    // igual à metodologia de calculateMetrics/buildSegment.
    const risked = isRiskedBet(bet);
    map.set(key, {
      profit: existing.profit + betProfit(bet),
      staked: existing.staked + bet.stake,
      bets: existing.bets + 1,
      riskedProfit: existing.riskedProfit + (risked ? betProfit(bet) : 0),
      riskedStake: existing.riskedStake + (risked ? bet.stake : 0),
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
        key,
        // Campo mantém o nome `roi` (consumido pela UI), mas é yield real:
        // lucro arriscado / turnover arriscado.
        roi: data.riskedStake > 0 ? data.riskedProfit / data.riskedStake : 0,
        profit: data.profit,
        staked: data.staked,
        bets: data.bets,
      };
    });
}

export function buildBookmakerShareData(state: AppState): BookmakerShare[] {
  const balances = deriveBookmakerBalances(state);
  const total = balances.reduce((sum, b) => sum + Math.max(b.derivedBalance, 0), 0);
  return state.bookmakers
    .map((b) => {
      const ledgerBalance = balances.find((entry) => entry.bookmakerId === b.id)?.derivedBalance ?? b.balance;
      return {
        name: b.name,
        value: total > 0 ? Math.round((ledgerBalance / total) * 100) : 0,
        balance: ledgerBalance,
      };
    })
    .filter((b) => b.balance > 0)
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
