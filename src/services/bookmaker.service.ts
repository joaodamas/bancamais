/**
 * Bookmaker Service — lógica de negócio para casas de apostas e transações.
 */
import type { AppState, BookmakerAccount, Transaction, TransactionType } from "../lib/types";
import { createBookmakerId, createTransactionId } from "../lib/storage";
import { getDerivedBookmakerBalance } from "../lib/ledger";

export type BookmakerBuildResult =
  | { ok: true; bookmaker: BookmakerAccount; transaction: Transaction | null }
  | { ok: false; error: string };

/** Constrói um novo BookmakerAccount e sua Transaction de depósito inicial. */
export function buildBookmaker(name: string, balance: number): BookmakerBuildResult {
  if (!name.trim()) {
    return { ok: false, error: "Informe o nome da casa." };
  }

  const bookmaker: BookmakerAccount = {
    id: createBookmakerId(),
    name: name.trim(),
    balance,
    status: "manual",
    lastSyncLabel: "manual",
  };

  const transaction: Transaction | null = balance > 0 ? {
    id: createTransactionId(),
    date: new Date().toISOString(),
    type: "deposit",
    bookmakerId: bookmaker.id,
    description: `Saldo inicial - ${name.trim()}`,
    amount: balance,
    referenceType: "bookmaker",
    referenceId: bookmaker.id,
  } : null;

  return { ok: true, bookmaker, transaction };
}

export type TransactionBuildResult =
  | { ok: true; transactions: Transaction[] }
  | { ok: false; error: string };

/** Constrói transações manuais (depósito, saque, transferência, ajuste). */
export function buildManualTransaction(
  data: FormData,
  state: AppState,
): TransactionBuildResult {
  const type = String(data.get("type")) as TransactionType;
  const bookmakerId = String(data.get("bookmakerId"));
  const targetBookmakerId = String(data.get("targetBookmakerId") || "") || undefined;
  const rawAmount = Number(data.get("amount"));
  const description = String(data.get("description") || type);

  const sourceBookmaker = state.bookmakers.find((b) => b.id === bookmakerId);
  if (!sourceBookmaker) {
    return { ok: false, error: "Selecione uma casa de origem valida." };
  }

  if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
    return { ok: false, error: "Informe um valor valido." };
  }

  if (type === "transfer") {
    if (!targetBookmakerId) {
      return { ok: false, error: "Selecione uma casa de destino valida." };
    }
    if (targetBookmakerId === bookmakerId) {
      return { ok: false, error: "Origem e destino precisam ser diferentes." };
    }
    const target = state.bookmakers.find((b) => b.id === targetBookmakerId);
    if (!target) {
      return { ok: false, error: "Casa de destino nao encontrada." };
    }
  }

  if (type === "withdrawal" || type === "transfer") {
    const available = getDerivedBookmakerBalance(state, bookmakerId);
    if (rawAmount > available) {
      return { ok: false, error: `Saldo insuficiente na ${sourceBookmaker.name}.` };
    }
  }

  const signedAmount = type === "withdrawal" || type === "transfer" ? -rawAmount : rawAmount;
  const baseDate = new Date().toISOString();

  const transactions: Transaction[] = type === "transfer"
    ? [
      {
        id: createTransactionId(),
        date: baseDate,
        type,
        bookmakerId,
        targetBookmakerId,
        description,
        amount: signedAmount,
        referenceType: "manual",
      },
      {
        id: createTransactionId(),
        date: baseDate,
        type,
        bookmakerId: targetBookmakerId!,
        targetBookmakerId: bookmakerId,
        description,
        amount: rawAmount,
        referenceType: "manual",
      },
    ]
    : [{
      id: createTransactionId(),
      date: baseDate,
      type,
      bookmakerId,
      targetBookmakerId: undefined,
      description,
      amount: signedAmount,
      referenceType: "manual",
    }];

  return { ok: true, transactions };
}

export type VoidResult =
  | { ok: true; updatedTransactions: Transaction[]; voidEntry: Transaction }
  | { ok: false; error: string };

/** Cria lançamento de anulação para uma transação manual. */
export function buildVoidEntry(
  transactionId: string,
  bookmakerId: string,
  reason: string,
  state: AppState,
): VoidResult {
  const original = state.transactions.find((t) => t.id === transactionId);
  if (!original) return { ok: false, error: "Transação não encontrada." };
  if (original.voidedById) return { ok: false, error: "Esta transação já foi anulada." };
  if (original.type === "void_entry") return { ok: false, error: "Não é possível anular uma anulação." };
  if (original.referenceType === "bet") {
    return { ok: false, error: "Lançamentos de apostas são imutáveis — eles refletem eventos já ocorridos." };
  }

  const voidId = createTransactionId();
  const voidEntry: Transaction = {
    id: voidId,
    date: new Date().toISOString(),
    type: "void_entry",
    bookmakerId,
    description: reason.trim() || `Anulação de ${original.description}`,
    amount: -original.amount,
    referenceType: "manual",
    voidsCancelledId: transactionId,
  };

  const updatedTransactions = state.transactions.map((t) =>
    t.id === transactionId ? { ...t, voidedById: voidId } : t,
  );

  return { ok: true, updatedTransactions, voidEntry };
}
