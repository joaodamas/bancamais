import type { AppState, Bet, DashboardMetrics } from "./types";
import { calculateLedgerTotalBalance, monitoredBankroll, bankrollBase } from "./ledger";
import { resolveUnitValue } from "./unit";

/** Abaixo deste nº de apostas liquidadas, ROI/yield são ruído de variância. */
export const MIN_RELIABLE_SAMPLE = 100;

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
  // Freebet: o stake não é dinheiro próprio, então o lucro é só o ganho (payout),
  // sem abater o stake. Perdida devolve payout 0 → lucro 0.
  if (bet.isFreebet) return bet.payout ?? 0;
  return (bet.payout ?? 0) - bet.stake;
}

/** Aposta que arriscou dinheiro próprio (entra no turnover do yield/ROI). */
export function isRiskedBet(bet: Bet): boolean {
  return !bet.isFreebet;
}

export function potentialReturn(bet: Bet): number {
  return bet.stake * bet.odds;
}

/**
 * Resultado de derrota: perdida, meia-perdida, ou cashout que terminou no negativo.
 * Status-based de propósito — won/half_won/void/pending nunca são derrota, mesmo
 * que o payout esteja ausente/inconsistente.
 */
export function isLossResult(bet: Bet): boolean {
  if (bet.status === "lost" || bet.status === "half_lost") return true;
  if (bet.status === "cashout") return betProfit(bet) < 0;
  return false;
}

export function clvPercent(bet: Bet): number | null {
  if (!bet.closingOdds) return null;
  return (bet.odds - bet.closingOdds) / bet.closingOdds;
}

export function calculateMetrics(state: AppState): DashboardMetrics {
  const totalBalance = calculateLedgerTotalBalance(state);
  const capitalBase = bankrollBase(state);
  const pending = state.bets.filter((bet) => bet.status === "pending");
  const settled = state.bets.filter((bet) => bet.status !== "pending" && bet.status !== "void");
  const profit = settled.reduce((sum, bet) => sum + betProfit(bet), 0);
  const wins = settled.filter((bet) => betProfit(bet) > 0).length;
  // Yield mede edge sobre dinheiro arriscado — freebet fica fora do turnover E
  // do numerador (senão o número infla, bug clássico de bônus no ROI).
  const settledRisked = settled.filter(isRiskedBet);
  const riskedStake = settledRisked.reduce((sum, bet) => sum + bet.stake, 0);
  const riskedProfit = settledRisked.reduce((sum, bet) => sum + betProfit(bet), 0);
  // CLV médio alinhado com buildClvTimeSeries: só apostas liquidadas com odd de
  // fechamento válida (> 1) entram. Nulos continuam de fora (não entram como zero).
  const clvs = state.bets
    .filter((bet) => bet.status !== "pending" && bet.closingOdds !== undefined && bet.closingOdds > 1)
    .map(clvPercent)
    .filter((value): value is number => value !== null);
  // Odd média ponderada pelo stake — a média simples distorce quando os stakes variam.
  const stakeTotal = state.bets.reduce((sum, bet) => sum + bet.stake, 0);
  const oddsStakeWeighted = state.bets.reduce((sum, bet) => sum + bet.odds * bet.stake, 0);

  return {
    totalBalance,
    // Exposição = dinheiro próprio em risco; freebet pendente não é capital próprio.
    openExposure: pending.filter(isRiskedBet).reduce((sum, bet) => sum + bet.stake, 0),
    profit,
    // ROI = retorno sobre o capital (lucro / capital depositado, base estável).
    // Yield = edge (lucro / turnover liquidado).
    roi: capitalBase > 0 ? profit / capitalBase : 0,
    yield: riskedStake > 0 ? riskedProfit / riskedStake : 0,
    hitRate: settled.length > 0 ? wins / settled.length : 0,
    averageOdds: stakeTotal > 0 ? oddsStakeWeighted / stakeTotal : 0,
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
    const risked = settled.filter(isRiskedBet);
    const riskedStake = risked.reduce((sum, bet) => sum + bet.stake, 0);
    const riskedProfit = risked.reduce((sum, bet) => sum + betProfit(bet), 0);
    const profit = bets.reduce((sum, bet) => sum + betProfit(bet), 0);
    const wins = settled.filter((bet) => betProfit(bet) > 0).length;
    const clvs = bets.map(clvPercent).filter((value): value is number => value !== null);

    return {
      ...strategy,
      bets: bets.length,
      stake,
      profit,
      roi: riskedStake > 0 ? riskedProfit / riskedStake : 0,
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
  const bankroll = monitoredBankroll(state);
  const unit = resolveUnitValue(state.riskSettings, bankroll);
  const maxStake = unit * state.riskSettings.maxStakeUnits;
  const maxExposure = bankroll * (state.riskSettings.maxOpenExposurePercent / 100);
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

// ── Cortes analíticos (faixa de cotação / faixa de stake / fator de lucro) ────

export interface SegmentStats {
  label: string;
  bets: number;
  staked: number;
  profit: number;
  roi: number;
  hitRate: number;
}

function settledBets(bets: Bet[]): Bet[] {
  return bets.filter((bet) => bet.status !== "pending" && bet.status !== "void");
}

function isWin(bet: Bet): boolean {
  // Acerto = a aposta deu lucro. Um cashout no prejuízo não é acerto.
  return betProfit(bet) > 0;
}

/** Fator de Lucro = ganhos brutos / perdas brutas. null = sem perdas liquidadas (resultado ∞). */
export function profitFactor(state: AppState): number | null {
  let grossWin = 0;
  let grossLoss = 0;
  for (const bet of settledBets(state.bets)) {
    const profit = betProfit(bet);
    if (profit > 0) grossWin += profit;
    else if (profit < 0) grossLoss += -profit;
  }
  if (grossLoss === 0) return null;
  return grossWin / grossLoss;
}

function buildSegment(label: string, bets: Bet[]): SegmentStats {
  const settled = settledBets(bets);
  const risked = settled.filter(isRiskedBet);
  const riskedStake = risked.reduce((sum, bet) => sum + bet.stake, 0);
  const riskedProfit = risked.reduce((sum, bet) => sum + betProfit(bet), 0);
  const profit = settled.reduce((sum, bet) => sum + betProfit(bet), 0);
  const wins = settled.filter(isWin).length;

  return {
    label,
    bets: bets.length,
    staked: bets.reduce((sum, bet) => sum + bet.stake, 0),
    profit,
    roi: riskedStake > 0 ? riskedProfit / riskedStake : 0,
    hitRate: settled.length > 0 ? wins / settled.length : 0,
  };
}

const ODDS_BANDS: Array<{ label: string; min: number; max: number }> = [
  { label: "1.00–1.50", min: 1, max: 1.5 },
  { label: "1.50–2.00", min: 1.5, max: 2 },
  { label: "2.00–3.00", min: 2, max: 3 },
  { label: "3.00–5.00", min: 3, max: 5 },
  { label: "5.00+", min: 5, max: Infinity },
];

/** Desempenho por faixa de cotação — universal, mostra onde o edge realmente está. */
export function segmentByOddsBand(state: AppState): SegmentStats[] {
  return ODDS_BANDS
    .map((band) => buildSegment(
      band.label,
      state.bets.filter((bet) => bet.odds >= band.min && bet.odds < band.max),
    ))
    .filter((segment) => segment.bets > 0);
}

const STAKE_BANDS: Array<{ label: string; min: number; max: number }> = [
  { label: "< 0,5× média", min: 0, max: 0.5 },
  { label: "0,5–1× média", min: 0.5, max: 1 },
  { label: "1–2× média", min: 1, max: 2 },
  { label: "≥ 2× média", min: 2, max: Infinity },
];

/** Desempenho por tamanho de stake (relativo à média) — revela indisciplina nas entradas grandes. */
export function segmentByStakeBand(state: AppState): SegmentStats[] {
  const stakes = state.bets.map((bet) => bet.stake).filter((value) => value > 0);
  if (stakes.length === 0) return [];

  const average = stakes.reduce((sum, value) => sum + value, 0) / stakes.length;
  if (average <= 0) return [];

  return STAKE_BANDS
    .map((band) => buildSegment(
      band.label,
      state.bets.filter((bet) => {
        const ratio = bet.stake / average;
        return ratio >= band.min && ratio < band.max;
      }),
    ))
    .filter((segment) => segment.bets > 0);
}

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** Desempenho por dia da semana (data da entrada) — revela disciplina/sangria por dia. */
export function segmentByDayOfWeek(state: AppState): SegmentStats[] {
  const byDay = new Map<number, Bet[]>();
  for (const bet of state.bets) {
    const date = new Date(bet.placedAt);
    if (Number.isNaN(date.getTime())) continue;
    const day = date.getDay();
    const list = byDay.get(day) ?? [];
    list.push(bet);
    byDay.set(day, list);
  }

  return WEEKDAY_LABELS
    .map((label, index) => ({ label, bets: byDay.get(index) ?? [] }))
    .filter((entry) => entry.bets.length > 0)
    .map((entry) => buildSegment(entry.label, entry.bets));
}

/** Desempenho por mercado/tipo de aposta — onde o edge se concentra (over/under, 1x2, etc.). */
export function segmentByMarket(state: AppState): SegmentStats[] {
  const byMarket = new Map<string, Bet[]>();
  for (const bet of state.bets) {
    const key = bet.market.trim() || "—";
    const list = byMarket.get(key) ?? [];
    list.push(bet);
    byMarket.set(key, list);
  }

  return [...byMarket.entries()]
    .map(([label, bets]) => buildSegment(label, bets))
    .sort((a, b) => b.staked - a.staked);
}

/** Por liga/campeonato — mostra onde o apostador realmente ganha dinheiro. */
export function segmentByLeague(state: AppState): SegmentStats[] {
  const byLeague = new Map<string, Bet[]>();
  for (const bet of state.bets) {
    const key = bet.league.trim() || "—";
    const list = byLeague.get(key) ?? [];
    list.push(bet);
    byLeague.set(key, list);
  }

  return [...byLeague.entries()]
    .map(([label, bets]) => buildSegment(label, bets))
    .sort((a, b) => b.staked - a.staked);
}

export interface StreakStats {
  longestGreen: number;
  longestRed: number;
  greens: number;
  reds: number;
  avgStake: number;
}

/** Sequências de greens/reds, contagem e stake média — leitura de consistência. */
export function bettingStreaks(state: AppState): StreakStats {
  const settled = settledBets(state.bets)
    .slice()
    .sort((a, b) => a.placedAt.localeCompare(b.placedAt));

  let longestGreen = 0;
  let longestRed = 0;
  let curGreen = 0;
  let curRed = 0;
  let greens = 0;
  let reds = 0;

  for (const bet of settled) {
    const profit = betProfit(bet);
    if (profit > 0) {
      greens += 1;
      curGreen += 1;
      curRed = 0;
      longestGreen = Math.max(longestGreen, curGreen);
    } else if (profit < 0) {
      reds += 1;
      curRed += 1;
      curGreen = 0;
      longestRed = Math.max(longestRed, curRed);
    } else {
      curGreen = 0;
      curRed = 0;
    }
  }

  const totalStake = state.bets.reduce((sum, bet) => sum + bet.stake, 0);
  const avgStake = state.bets.length > 0 ? totalStake / state.bets.length : 0;

  return { longestGreen, longestRed, greens, reds, avgStake };
}

