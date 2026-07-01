import { describe, it, expect } from "vitest";
import {
  deriveBookmakerBalances,
  calculateLedgerTotalBalance,
  buildLedgerTimeline,
} from "./ledger";
import { emptyState } from "./storage";
import type { AppState, BookmakerAccount, Transaction } from "./types";

function makeBookmaker(id: string, balance = 0): BookmakerAccount {
  return { id, name: id, balance, status: "manual", lastSyncLabel: "manual" };
}

function makeTx(overrides: Partial<Transaction>): Transaction {
  return {
    id: `tx-${Math.random()}`,
    date: new Date().toISOString(),
    type: "deposit",
    bookmakerId: "book-1",
    description: "teste",
    amount: 100,
    ...overrides,
  };
}

function makeState(
  bookmakers: BookmakerAccount[],
  transactions: Transaction[],
): AppState {
  return { ...emptyState(), bookmakers, transactions };
}

describe("deriveBookmakerBalances", () => {
  it("usa book.balance quando não há transações", () => {
    const state = makeState([makeBookmaker("book-1", 500)], []);
    const [bal] = deriveBookmakerBalances(state);
    expect(bal.derivedBalance).toBe(500);
    expect(bal.hasTransactionHistory).toBe(false);
  });

  it("calcula saldo correto com depósito e stake", () => {
    const state = makeState(
      [makeBookmaker("book-1", 0)],
      [
        makeTx({ type: "deposit", amount: 400, bookmakerId: "book-1", referenceType: "bookmaker" }),
        makeTx({ type: "bet_stake", amount: -100, bookmakerId: "book-1", referenceType: "bet" }),
      ],
    );
    const [bal] = deriveBookmakerBalances(state);
    expect(bal.derivedBalance).toBe(300);
    expect(bal.hasTransactionHistory).toBe(true);
  });

  it("inclui payout no saldo", () => {
    const state = makeState(
      [makeBookmaker("book-1", 0)],
      [
        makeTx({ type: "deposit", amount: 400, bookmakerId: "book-1" }),
        makeTx({ type: "bet_stake", amount: -100, bookmakerId: "book-1" }),
        makeTx({ type: "bet_payout", amount: 200, bookmakerId: "book-1" }),
      ],
    );
    const [bal] = deriveBookmakerBalances(state);
    expect(bal.derivedBalance).toBe(500); // 400 - 100 + 200
  });

  it("transferência entre casas debita a origem e credita o destino (net global zero)", () => {
    const state = makeState(
      [makeBookmaker("b1"), makeBookmaker("b2")],
      [
        makeTx({ type: "deposit", amount: 75, bookmakerId: "b1" }),
        makeTx({ id: "tf-out", type: "transfer", amount: -50, bookmakerId: "b1", targetBookmakerId: "b2" }),
        makeTx({ id: "tf-in", type: "transfer", amount: 50, bookmakerId: "b2", targetBookmakerId: "b1" }),
      ],
    );
    const balances = deriveBookmakerBalances(state);
    const b1 = balances.find((b) => b.bookmakerId === "b1");
    const b2 = balances.find((b) => b.bookmakerId === "b2");
    expect(b1?.derivedBalance).toBe(25);
    expect(b2?.derivedBalance).toBe(50);
    expect(calculateLedgerTotalBalance(state)).toBe(75);
  });

  it("normaliza zero negativo de resíduo de ponto flutuante para +0", () => {
    const state = makeState(
      [makeBookmaker("b1", 0)],
      [
        makeTx({ type: "deposit", amount: 0.3, bookmakerId: "b1" }),
        makeTx({ type: "withdrawal", amount: -0.1, bookmakerId: "b1" }),
        makeTx({ type: "withdrawal", amount: -0.1, bookmakerId: "b1" }),
        makeTx({ type: "withdrawal", amount: -0.1, bookmakerId: "b1" }),
      ],
    );
    const [bal] = deriveBookmakerBalances(state);
    expect(bal.derivedBalance).toBe(0);
    expect(Object.is(bal.derivedBalance, -0)).toBe(false);
  });

  it("calcula delta entre saldo salvo e derivado", () => {
    const state = makeState(
      [makeBookmaker("book-1", 600)],
      [
        makeTx({ type: "deposit", amount: 400, bookmakerId: "book-1" }),
        makeTx({ type: "bet_stake", amount: -100, bookmakerId: "book-1" }),
      ],
    );
    const [bal] = deriveBookmakerBalances(state);
    expect(bal.savedBalance).toBe(600);
    expect(bal.derivedBalance).toBe(300);
    expect(bal.delta).toBeCloseTo(300);
  });
});

describe("calculateLedgerTotalBalance", () => {
  it("retorna startingBalance quando não há bookmakers", () => {
    const state = { ...emptyState(), startingBalance: 1000 };
    expect(calculateLedgerTotalBalance(state)).toBe(1000);
  });

  it("soma saldo de múltiplos bookmakers", () => {
    const state = makeState(
      [makeBookmaker("b1", 300), makeBookmaker("b2", 200)],
      [],
    );
    expect(calculateLedgerTotalBalance(state)).toBe(500);
  });

  it("usa transações quando disponíveis", () => {
    const state = makeState(
      [makeBookmaker("b1", 0)],
      [
        makeTx({ type: "deposit", amount: 500, bookmakerId: "b1" }),
        makeTx({ type: "withdrawal", amount: -100, bookmakerId: "b1" }),
      ],
    );
    expect(calculateLedgerTotalBalance(state)).toBe(400);
  });
});

describe("buildLedgerTimeline", () => {
  it("ordena eventos por data", () => {
    const d1 = "2026-05-01T10:00:00Z";
    const d2 = "2026-05-02T10:00:00Z";
    const state = makeState(
      [makeBookmaker("b1")],
      [
        makeTx({ id: "tx2", date: d2, amount: 200 }),
        makeTx({ id: "tx1", date: d1, amount: 100 }),
      ],
    );
    const events = buildLedgerTimeline(state);
    expect(events[0].amount).toBe(100);
    expect(events[1].amount).toBe(200);
  });

  it("inclui todas as transações não-transfer normalmente", () => {
    const state = makeState(
      [makeBookmaker("b1")],
      [
        makeTx({ type: "deposit", amount: 400 }),
        makeTx({ type: "bet_stake", amount: -100 }),
        makeTx({ type: "bet_payout", amount: 192 }),
      ],
    );
    const events = buildLedgerTimeline(state);
    expect(events).toHaveLength(3);
  });

  it("transferência com mirror resulta em dois eventos separados com net zero", () => {
    const baseDate = "2026-05-01T10:00:00Z";
    const state = makeState(
      [makeBookmaker("b1"), makeBookmaker("b2")],
      [
        makeTx({
          id: "tf1", type: "transfer", amount: -100,
          bookmakerId: "b1", targetBookmakerId: "b2", date: baseDate,
        }),
        makeTx({
          id: "tf2", type: "transfer", amount: 100,
          bookmakerId: "b2", targetBookmakerId: "b1", date: baseDate,
        }),
      ],
    );
    const events = buildLedgerTimeline(state);
    const net = events.reduce((s, e) => s + e.amount, 0);
    expect(net).toBe(0);
  });
});
