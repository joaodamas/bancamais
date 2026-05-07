import { initialState } from "./mockData";
import type { AppState, Bet } from "./types";

const key = "bancamais.demo.state";

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
