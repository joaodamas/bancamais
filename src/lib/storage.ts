import { initialState } from "./mockData";
import type { AppState, Bet } from "./types";

const key = "bancamais.demo.state";

function userKey(uid: string) { return `bancamais.state.${uid}`; }

export function emptyState(): AppState {
  return {
    bankrollName: "Minha Banca",
    currency: "BRL",
    startingBalance: 0,
    lastModifiedAt: null,
    riskSettings: {
      unitPercent: 1,
      maxStakeUnits: 2,
      maxOpenExposurePercent: 5,
      lossStreakLimit: 3,
      hardStopEnabled: false,
      dailyLossLimitPercent: 10,
      weeklyLossLimitPercent: 20,
      monthlyDrawdownPercent: 30,
    },
    bookmakers: [],
    strategies: [],
    bets: [],
    transactions: [],
  };
}

export function loadStateForUser(uid: string): AppState {
  const raw = localStorage.getItem(userKey(uid));
  if (!raw) return emptyState();
  try { return normalizeState(JSON.parse(raw) as Partial<AppState>); }
  catch { return emptyState(); }
}

export function saveStateForUser(uid: string, state: AppState) {
  localStorage.setItem(userKey(uid), JSON.stringify(state));
}

export function clearStateForUser(uid: string) {
  localStorage.removeItem(userKey(uid));
}

// IDs seed do mockData anterior — apagar automaticamente ao carregar
const SEED_BET_IDS = new Set(["bet-001", "bet-002", "bet-003", "bet-004", "bet-005"]);
const SEED_TX_IDS = new Set(["tx-001", "tx-002"]);
const SEED_BOOK_IDS = new Set(["bet365", "betano", "sportingbet", "kto"]);

export function loadState(): AppState {
  const raw = localStorage.getItem(key);
  if (!raw) return initialState;

  try {
    const parsed = normalizeState(JSON.parse(raw) as Partial<AppState>);

    // Migração: remover dados seed hardcoded do protótipo
    const cleanedBets = parsed.bets.filter(b => !SEED_BET_IDS.has(b.id));
    const cleanedTxs = parsed.transactions.filter(tx => !SEED_TX_IDS.has(tx.id));
    const cleanedBooks = parsed.bookmakers.filter(book => !SEED_BOOK_IDS.has(book.id));

    // Se após limpar não há nada, retorna estado vazio (novo usuário)
    const cleaned: AppState = {
      ...parsed,
      bets: cleanedBets,
      transactions: cleanedTxs,
      bookmakers: cleanedBooks,
      // Resetar saldo inicial se era o valor mock
      startingBalance: parsed.startingBalance === 13264.2 ? 0 : parsed.startingBalance,
      lastModifiedAt: parsed.lastModifiedAt ?? null,
    };

    return cleaned;
  } catch {
    return initialState;
  }
}

export function normalizeState(state: Partial<AppState>): AppState {
  return {
    ...initialState,
    ...state,
    riskSettings: {
      ...initialState.riskSettings,
      ...state.riskSettings,
    },
    lastModifiedAt: state.lastModifiedAt ?? initialState.lastModifiedAt ?? null,
    bookmakers: state.bookmakers ?? initialState.bookmakers,
    strategies: state.strategies ?? initialState.strategies,
    bets: state.bets ?? initialState.bets,
    transactions: state.transactions ?? initialState.transactions,
  };
}

export function isFirstRun(state: AppState): boolean {
  return (
    state.bookmakers.length === 0 &&
    state.bets.length === 0 &&
    state.startingBalance === 0
  );
}

export function saveState(state: AppState) {
  localStorage.setItem(key, JSON.stringify(state));
}

export function resetState() {
  saveState(initialState);
  return initialState;
}

export function createBetId() {
  return `bet-${crypto.randomUUID()}`;
}

export function createTransactionId() {
  return `tx-${crypto.randomUUID()}`;
}

export function createBookmakerId() {
  return `book-${crypto.randomUUID()}`;
}

export function createStrategyId() {
  return `strategy-${crypto.randomUUID()}`;
}

export type NewBetInput = Omit<Bet, "id" | "placedAt" | "status" | "tags" | "mode"> & {
  tags: string;
  mode: Bet["mode"];
};
