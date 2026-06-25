import type { AppState, Bet, Transaction, BookmakerAccount, Strategy } from "./types";

// Banca-exemplo determinística para o modo demonstração (experimentar sem conta).
// Gera apostas + transações coerentes com o ledger: cada aposta cria um stake e,
// quando liquidada, um payout (ganha) ou refund (anulada). O saldo final da curva
// fecha com calculateLedgerTotalBalance().

function daysAgo(n: number, hour = 15): string {
  const d = new Date();
  d.setHours(hour, 30, 0, 0);
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

const BOOK_365 = "demo-book-365";
const BOOK_BETANO = "demo-book-betano";
const STRAT_OVER = "demo-strat-over";
const STRAT_HANDICAP = "demo-strat-handicap";

interface Spec {
  day: number;
  sport: string;
  league: string;
  event: string;
  market: string;
  selection: string;
  book: string;
  strategy: string;
  stake: number;
  odds: number;
  closing: number;
  result: "won" | "lost" | "void" | "pending";
}

// Arco realista: alta inicial, sequência de reds (drawdown), recuperação.
const SPECS: Spec[] = [
  { day: 29, sport: "Futebol", league: "Brasileirão", event: "Flamengo x Palmeiras", market: "Over 2.5", selection: "Mais de 2.5", book: BOOK_365, strategy: STRAT_OVER, stake: 50, odds: 1.95, closing: 1.85, result: "won" },
  { day: 28, sport: "Futebol", league: "Premier League", event: "Arsenal x Chelsea", market: "Resultado", selection: "Arsenal", book: BOOK_BETANO, strategy: STRAT_HANDICAP, stake: 25, odds: 2.10, closing: 2.05, result: "won" },
  { day: 27, sport: "Basquete", league: "NBA", event: "Lakers x Celtics", market: "Handicap", selection: "Lakers -4.5", book: BOOK_365, strategy: STRAT_HANDICAP, stake: 50, odds: 1.90, closing: 1.95, result: "lost" },
  { day: 25, sport: "Futebol", league: "La Liga", event: "Real Madrid x Sevilla", market: "Ambas marcam", selection: "Sim", book: BOOK_BETANO, strategy: STRAT_OVER, stake: 25, odds: 1.80, closing: 1.72, result: "won" },
  { day: 24, sport: "Tênis", league: "ATP", event: "Alcaraz x Sinner", market: "Vencedor", selection: "Alcaraz", book: BOOK_365, strategy: STRAT_HANDICAP, stake: 75, odds: 1.70, closing: 1.78, result: "lost" },
  { day: 23, sport: "Futebol", league: "Champions", event: "Bayern x PSG", market: "Over 1.5", selection: "Mais de 1.5", book: BOOK_365, strategy: STRAT_OVER, stake: 50, odds: 1.50, closing: 1.45, result: "won" },
  { day: 22, sport: "Futebol", league: "Serie A", event: "Inter x Juventus", market: "Under 2.5", selection: "Menos de 2.5", book: BOOK_BETANO, strategy: STRAT_OVER, stake: 50, odds: 2.05, closing: 2.20, result: "lost" },
  { day: 21, sport: "Futebol", league: "Brasileirão", event: "São Paulo x Corinthians", market: "Resultado", selection: "São Paulo", book: BOOK_365, strategy: STRAT_HANDICAP, stake: 50, odds: 2.30, closing: 2.40, result: "lost" },
  { day: 20, sport: "Basquete", league: "NBA", event: "Warriors x Suns", market: "Total pontos", selection: "Over 225.5", book: BOOK_BETANO, strategy: STRAT_OVER, stake: 50, odds: 1.90, closing: 2.00, result: "lost" },
  { day: 19, sport: "Futebol", league: "Premier League", event: "Liverpool x City", market: "Over 3.5", selection: "Mais de 3.5", book: BOOK_365, strategy: STRAT_OVER, stake: 50, odds: 2.50, closing: 2.30, result: "won" },
  { day: 18, sport: "Tênis", league: "WTA", event: "Swiatek x Gauff", market: "Vencedor", selection: "Swiatek", book: BOOK_BETANO, strategy: STRAT_HANDICAP, stake: 25, odds: 1.60, closing: 1.55, result: "won" },
  { day: 17, sport: "Futebol", league: "La Liga", event: "Barcelona x Atlético", market: "Ambas marcam", selection: "Sim", book: BOOK_365, strategy: STRAT_OVER, stake: 50, odds: 1.75, closing: 1.70, result: "won" },
  { day: 15, sport: "Futebol", league: "Brasileirão", event: "Grêmio x Internacional", market: "Resultado", selection: "Empate", book: BOOK_BETANO, strategy: STRAT_HANDICAP, stake: 25, odds: 3.20, closing: 3.10, result: "void" },
  { day: 14, sport: "Futebol", league: "Champions", event: "Real Madrid x City", market: "Over 2.5", selection: "Mais de 2.5", book: BOOK_365, strategy: STRAT_OVER, stake: 75, odds: 1.85, closing: 1.78, result: "won" },
  { day: 13, sport: "Basquete", league: "NBA", event: "Bucks x Heat", market: "Handicap", selection: "Bucks -6.5", book: BOOK_BETANO, strategy: STRAT_HANDICAP, stake: 50, odds: 1.90, closing: 1.92, result: "lost" },
  { day: 12, sport: "Futebol", league: "Premier League", event: "Tottenham x United", market: "Over 2.5", selection: "Mais de 2.5", book: BOOK_365, strategy: STRAT_OVER, stake: 50, odds: 1.95, closing: 1.88, result: "won" },
  { day: 10, sport: "Futebol", league: "Serie A", event: "Napoli x Roma", market: "Resultado", selection: "Napoli", book: BOOK_365, strategy: STRAT_HANDICAP, stake: 50, odds: 2.00, closing: 1.90, result: "won" },
  { day: 9, sport: "Tênis", league: "ATP", event: "Djokovic x Medvedev", market: "Vencedor", selection: "Djokovic", book: BOOK_BETANO, strategy: STRAT_HANDICAP, stake: 50, odds: 1.65, closing: 1.70, result: "lost" },
  { day: 8, sport: "Futebol", league: "La Liga", event: "Sevilla x Betis", market: "Under 3.5", selection: "Menos de 3.5", book: BOOK_365, strategy: STRAT_OVER, stake: 50, odds: 1.55, closing: 1.50, result: "won" },
  { day: 7, sport: "Futebol", league: "Brasileirão", event: "Palmeiras x Santos", market: "Over 1.5", selection: "Mais de 1.5", book: BOOK_BETANO, strategy: STRAT_OVER, stake: 50, odds: 1.45, closing: 1.42, result: "won" },
  { day: 5, sport: "Basquete", league: "NBA", event: "Nuggets x Clippers", market: "Total pontos", selection: "Under 220.5", book: BOOK_365, strategy: STRAT_OVER, stake: 50, odds: 1.90, closing: 1.85, result: "won" },
  { day: 4, sport: "Futebol", league: "Champions", event: "Arsenal x Bayern", market: "Ambas marcam", selection: "Sim", book: BOOK_BETANO, strategy: STRAT_OVER, stake: 50, odds: 1.70, closing: 1.80, result: "lost" },
  { day: 3, sport: "Futebol", league: "Premier League", event: "City x Newcastle", market: "Resultado", selection: "City", book: BOOK_365, strategy: STRAT_HANDICAP, stake: 75, odds: 1.50, closing: 1.45, result: "won" },
  { day: 2, sport: "Tênis", league: "ATP", event: "Sinner x Zverev", market: "Vencedor", selection: "Sinner", book: BOOK_365, strategy: STRAT_HANDICAP, stake: 50, odds: 1.75, closing: 1.68, result: "won" },
  // Pendentes
  { day: 1, sport: "Futebol", league: "Brasileirão", event: "Flamengo x Botafogo", market: "Over 2.5", selection: "Mais de 2.5", book: BOOK_365, strategy: STRAT_OVER, stake: 50, odds: 1.90, closing: 0, result: "pending" },
  { day: 0, sport: "Futebol", league: "La Liga", event: "Real Madrid x Barcelona", market: "Resultado", selection: "Real Madrid", book: BOOK_BETANO, strategy: STRAT_HANDICAP, stake: 75, odds: 2.20, closing: 0, result: "pending" },
];

export function buildDemoState(): AppState {
  const bookmakers: BookmakerAccount[] = [
    { id: BOOK_365, name: "Bet365", balance: 0, status: "manual", lastSyncLabel: "manual" },
    { id: BOOK_BETANO, name: "Betano", balance: 0, status: "manual", lastSyncLabel: "manual" },
  ];

  const strategies: Strategy[] = [
    { id: STRAT_OVER, name: "Over/Under FT", description: "Gols pré-live, odds 1.45–2.50", status: "active" },
    { id: STRAT_HANDICAP, name: "Resultado & Handicap", description: "Favoritos e handicap asiático", status: "active" },
  ];

  // Depósitos iniciais (base da banca)
  const transactions: Transaction[] = [
    { id: "demo-tx-dep-365", date: daysAgo(30, 9), type: "deposit", bookmakerId: BOOK_365, description: "Depósito inicial", amount: 500 },
    { id: "demo-tx-dep-betano", date: daysAgo(30, 9), type: "deposit", bookmakerId: BOOK_BETANO, description: "Depósito inicial", amount: 300 },
  ];

  const bets: Bet[] = [];
  let seq = 0;

  for (const s of SPECS) {
    const betId = `demo-bet-${++seq}`;
    const placedAt = daysAgo(s.day, 12);
    const eventAt = daysAgo(s.day, 16);
    const payout = s.result === "won" ? Number((s.stake * s.odds).toFixed(2)) : undefined;

    const bet: Bet = {
      id: betId,
      placedAt,
      eventAt,
      sport: s.sport,
      league: s.league,
      eventName: s.event,
      market: s.market,
      selection: s.selection,
      bookmakerId: s.book,
      strategyId: s.strategy,
      tags: [],
      stake: s.stake,
      odds: s.odds,
      status: s.result,
      mode: "prelive",
      source: "manual",
      ...(payout != null ? { payout } : {}),
      ...(s.closing > 1 ? { closingOdds: s.closing } : {}),
    };
    bets.push(bet);

    // Stake sai da casa quando a aposta é registrada
    transactions.push({
      id: `${betId}-stake`,
      date: placedAt,
      type: "bet_stake",
      bookmakerId: s.book,
      description: `Stake - ${s.event}`,
      amount: -s.stake,
      referenceType: "bet",
      referenceId: betId,
    });

    if (s.result === "won" && payout != null) {
      transactions.push({
        id: `${betId}-payout`,
        date: eventAt,
        type: "bet_payout",
        bookmakerId: s.book,
        description: `Retorno - ${s.event}`,
        amount: payout,
        referenceType: "bet",
        referenceId: betId,
      });
    }

    if (s.result === "void") {
      transactions.push({
        id: `${betId}-refund`,
        date: eventAt,
        type: "bet_refund",
        bookmakerId: s.book,
        description: `Void - ${s.event}`,
        amount: s.stake,
        referenceType: "bet",
        referenceId: betId,
      });
    }
  }

  return {
    bankrollName: "Banca Demo",
    currency: "BRL",
    startingBalance: 800,
    lastModifiedAt: new Date().toISOString(),
    riskSettings: {
      unitMode: "fixed",
      unitFixed: 25,
      unitPercent: 2,
      maxStakeUnits: 3,
      maxOpenExposurePercent: 15,
      lossStreakLimit: 3,
      hardStopEnabled: true,
      dailyLossLimitPercent: 10,
      weeklyLossLimitPercent: 20,
      monthlyDrawdownPercent: 30,
    },
    bookmakers,
    strategies,
    bets: bets.reverse(),
    transactions,
    betTemplates: [],
    reportSnapshots: [],
  };
}
