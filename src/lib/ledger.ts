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

function hasMirrorTransfer(transaction: Transaction, transactions: Transaction[]): boolean {
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
): number {
  if (transaction.bookmakerId === bookmakerId) {
    return transaction.amount;
  }

  if (
    transaction.type === "transfer" &&
    transaction.targetBookmakerId === bookmakerId &&
    !hasMirrorTransfer(transaction, transactions)
  ) {
    return Math.abs(transaction.amount);
  }

  return 0;
}

export function deriveBookmakerBalances(state: AppState): LedgerBookBalance[] {
  return state.bookmakers.map((book) => {
    const relatedTransactions = state.transactions.filter((transaction) => (
      transaction.bookmakerId === book.id || transaction.targetBookmakerId === book.id
    ));
    const derivedBalance = relatedTransactions.length > 0
      ? relatedTransactions.reduce((sum, transaction) => (
        sum + transactionImpactForBookmaker(transaction, book.id, state.transactions)
      ), 0)
      : book.balance;

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
  const events = state.transactions.flatMap((transaction) => {
    if (
      transaction.type === "transfer" &&
      transaction.amount < 0 &&
      transaction.targetBookmakerId &&
      !hasMirrorTransfer(transaction, state.transactions)
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

  let running = 0;
  return relevant.map((t) => {
    const impact = transactionImpactForBookmaker(t, bookmakerId, transactions);
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
