import type { AppState, BookmakerAccount, Transaction, TransactionType } from "./types";

export interface LedgerEntry {
  transaction: Transaction;
  runningBalance: number;
  isVoided: boolean;
}

export interface LedgerBookBalance {
  bookmakerId: string;
  savedBalance: number;
  derivedBalance: number;
  delta: number;
  hasTransactionHistory: boolean;
}

export interface LedgerTimelineEvent {
  date: string;
  label: string;
  amount: number;
}

/**
 * Conjunto de chaves dos lançamentos de transferência POSITIVOS (entrada),
 * para detectar o "espelho" em O(1) em vez de varrer todas as transações a cada
 * chamada (que era O(n²) no agregado). Chave = origem|destino|valorAbsoluto.
 */
function buildMirrorKeySet(transactions: Transaction[]): Set<string> {
  const keys = new Set<string>();
  for (const t of transactions) {
    if (t.type === "transfer" && t.amount > 0 && t.targetBookmakerId) {
      keys.add(`${t.bookmakerId}|${t.targetBookmakerId}|${Math.abs(t.amount)}`);
    }
  }
  return keys;
}

/** Chave para procurar o espelho de uma transação (direção invertida). */
function mirrorLookupKey(transaction: Transaction): string {
  return `${transaction.targetBookmakerId}|${transaction.bookmakerId}|${Math.abs(transaction.amount)}`;
}

function hasMirrorTransfer(
  transaction: Transaction,
  transactions: Transaction[],
  mirrorKeys?: Set<string>,
): boolean {
  if (mirrorKeys) return mirrorKeys.has(mirrorLookupKey(transaction));
  return transactions.some((candidate) => (
    candidate.id !== transaction.id &&
    candidate.type === "transfer" &&
    candidate.bookmakerId === transaction.targetBookmakerId &&
    candidate.targetBookmakerId === transaction.bookmakerId &&
    Math.abs(candidate.amount) === Math.abs(transaction.amount) &&
    candidate.amount > 0
  ));
}

export function transactionImpactForBookmaker(
  transaction: Transaction,
  bookmakerId: string,
  transactions: Transaction[],
  mirrorKeys?: Set<string>,
): number {
  if (transaction.bookmakerId === bookmakerId) {
    return transaction.amount;
  }

  if (
    transaction.type === "transfer" &&
    transaction.amount < 0 &&
    transaction.targetBookmakerId === bookmakerId &&
    !hasMirrorTransfer(transaction, transactions, mirrorKeys)
  ) {
    return Math.abs(transaction.amount);
  }

  return 0;
}

export function deriveBookmakerBalances(state: AppState): LedgerBookBalance[] {
  const mirrorKeys = buildMirrorKeySet(state.transactions);
  return state.bookmakers.map((book) => {
    const relatedTransactions = state.transactions.filter((transaction) => (
      transaction.bookmakerId === book.id || transaction.targetBookmakerId === book.id
    ));
    const rawDerived = relatedTransactions.length > 0
      ? Number(relatedTransactions.reduce((sum, transaction) => (
        sum + transactionImpactForBookmaker(transaction, book.id, state.transactions, mirrorKeys)
      ), 0).toFixed(2))
      : book.balance;
    const derivedBalance = rawDerived === 0 ? 0 : rawDerived;

    return {
      bookmakerId: book.id,
      savedBalance: book.balance,
      derivedBalance,
      delta: Number((book.balance - derivedBalance).toFixed(2)),
      hasTransactionHistory: relatedTransactions.length > 0,
    };
  });
}

export function calculateLedgerTotalBalance(state: AppState): number {
  const balances = deriveBookmakerBalances(state);
  if (balances.length === 0) return state.startingBalance;
  return balances.reduce((sum, balance) => sum + balance.derivedBalance, 0);
}

/**
 * Banca de referência para métricas e limites de risco: usa o saldo do ledger
 * quando há saldo, senão cai para o `startingBalance` declarado. Evita que ROI,
 * alertas e hard stop fiquem inertes só porque o ledger das casas ainda está em 0.
 */
export function monitoredBankroll(state: AppState): number {
  const ledgerBalance = calculateLedgerTotalBalance(state);
  return ledgerBalance > 0 ? ledgerBalance : state.startingBalance;
}

/**
 * Capital de referência ESTÁVEL para ROI (retorno sobre capital): total
 * depositado — soma das transações `deposit` (que já incluem o saldo inicial
 * das casas). Não flutua com lucro/perda nem com saques, ao contrário da banca
 * atual. Fallbacks: startingBalance declarado e, por fim, a banca monitorada.
 */
export function bankrollBase(state: AppState): number {
  const deposits = state.transactions
    .filter((t) => t.type === "deposit")
    .reduce((sum, t) => sum + t.amount, 0);
  if (deposits > 0) return deposits;
  if (state.startingBalance > 0) return state.startingBalance;
  return monitoredBankroll(state);
}

export function getDerivedBookmakerBalance(state: AppState, bookmakerId: string): number {
  const match = deriveBookmakerBalances(state).find((entry) => entry.bookmakerId === bookmakerId);
  if (!match) return 0;
  return match.derivedBalance;
}

export function reconcileBookmakerBalances(state: AppState): AppState {
  const derivedBalances = deriveBookmakerBalances(state);
  const balanceMap = new Map(derivedBalances.map((entry) => [entry.bookmakerId, entry.derivedBalance]));

  return {
    ...state,
    bookmakers: state.bookmakers.map((book) => ({
      ...book,
      balance: balanceMap.get(book.id) ?? book.balance,
    })),
  };
}

export function buildLedgerTimeline(state: AppState): LedgerTimelineEvent[] {
  const mirrorKeys = buildMirrorKeySet(state.transactions);
  const events = state.transactions.flatMap((transaction) => {
    if (
      transaction.type === "transfer" &&
      transaction.amount < 0 &&
      transaction.targetBookmakerId &&
      !hasMirrorTransfer(transaction, state.transactions, mirrorKeys)
    ) {
      return [
        {
          date: transaction.date,
          label: `${transaction.description} · saída`,
          amount: transaction.amount,
        },
        {
          date: transaction.date,
          label: `${transaction.description} · entrada`,
          amount: Math.abs(transaction.amount),
        },
      ];
    }

    return [{
      date: transaction.date,
      label: transaction.description,
      amount: transaction.amount,
    }];
  });

  return events.sort((a, b) => a.date.localeCompare(b.date));
}

export function hasLedgerMismatch(bookmaker: BookmakerAccount, balances: LedgerBookBalance[]): boolean {
  const match = balances.find((entry) => entry.bookmakerId === bookmaker.id);
  if (!match || !match.hasTransactionHistory) return false;
  return Math.abs(match.delta) >= 0.01;
}

/**
 * Builds a chronological ledger for a single bookmaker with computed running balance.
 * Voided transactions still appear (marked `isVoided = true`) to preserve the immutable audit trail.
 * Their void_entry counterpart also appears and reverts the balance.
 */
export function computeBookmakerLedger(bookmakerId: string, transactions: Transaction[]): LedgerEntry[] {
  const voidedIds = new Set(
    transactions.filter((t) => t.voidsCancelledId).map((t) => t.voidsCancelledId as string),
  );

  const relevant = transactions
    .filter((t) => t.bookmakerId === bookmakerId || t.targetBookmakerId === bookmakerId)
    .sort((a, b) => a.date.localeCompare(b.date));

  const mirrorKeys = buildMirrorKeySet(transactions);
  let running = 0;
  return relevant.map((t) => {
    const impact = transactionImpactForBookmaker(t, bookmakerId, transactions, mirrorKeys);
    running = Number((running + impact).toFixed(2)) || 0;
    return {
      transaction: t,
      runningBalance: running,
      isVoided: voidedIds.has(t.id),
    };
  });
}

/**
 * Builds a single chronological timeline across the whole bankroll (all houses),
 * with a running consolidated balance that reconciles with `calculateLedgerTotalBalance`.
 * Internal transfers between own houses net to zero on the global balance.
 * Voided transactions remain visible (`isVoided = true`) to preserve the audit trail.
 */
export function computeGlobalLedger(state: AppState): LedgerEntry[] {
  const { transactions, bookmakers } = state;
  const voidedIds = new Set(
    transactions.filter((t) => t.voidsCancelledId).map((t) => t.voidsCancelledId as string),
  );

  const booksWithHistory = new Set(
    bookmakers
      .filter((book) => transactions.some(
        (t) => t.bookmakerId === book.id || t.targetBookmakerId === book.id,
      ))
      .map((book) => book.id),
  );

  const staticBase = bookmakers
    .filter((book) => !booksWithHistory.has(book.id))
    .reduce((sum, book) => sum + book.balance, 0);

  const ordered = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
  const mirrorKeys = buildMirrorKeySet(transactions);

  let running = staticBase;
  return ordered.map((t) => {
    const impact = bookmakers.reduce(
      (sum, book) => sum + transactionImpactForBookmaker(t, book.id, transactions, mirrorKeys),
      0,
    );
    running = Number((running + impact).toFixed(2));
    return {
      transaction: t,
      runningBalance: running,
      isVoided: voidedIds.has(t.id),
    };
  });
}

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  deposit: "Depósito",
  withdrawal: "Saque",
  transfer: "Transferência",
  adjustment: "Ajuste",
  bet_stake: "Stake",
  bet_payout: "Liquidação",
  bet_refund: "Estorno",
  void_entry: "Anulação",
};
