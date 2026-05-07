import type { AppState, BookmakerAccount, Transaction } from "./types";

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
