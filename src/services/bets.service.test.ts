import { describe, it, expect } from "vitest";
import { buildBetFromForm, buildSettlement, buildBulkSettlement, mergeImportedBets } from "./bets.service";
import { emptyState } from "../lib/storage";
import type { AppState, Bet } from "../lib/types";

function makeState(overrides: Partial<AppState> = {}): AppState {
  return {
    ...emptyState(),
    bookmakers: [{ id: "b1", name: "Bet365", balance: 1000, status: "manual", lastSyncLabel: "manual" }],
    ...overrides,
  };
}

function fd(fields: Record<string, string>): FormData {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  return form;
}

const BASE_DATE = new Date().toISOString();

const VALID_FIELDS = {
  bookmakerId: "b1",
  stake: "100",
  odds: "2.0",
  eventName: "Real x City",
  eventAt: BASE_DATE,
  sport: "Futebol",
  league: "UCL",
  market: "Resultado",
  selection: "Real vence",
  mode: "prelive",
  tags: "",
  strategyId: "",
  closingOdds: "",
};

function stateWithBalance(amount = 1000): AppState {
  return makeState({
    transactions: [
      { id: "tx1", date: BASE_DATE, type: "deposit", bookmakerId: "b1", description: "dep", amount },
    ],
  });
}

function makeBet(overrides: Partial<Bet>): Bet {
  return {
    id: `b-${Math.random()}`,
    placedAt: BASE_DATE,
    eventAt: BASE_DATE,
    sport: "Futebol",
    league: "UCL",
    eventName: "Real x City",
    market: "Resultado",
    selection: "Real vence",
    bookmakerId: "b1",
    tags: [],
    stake: 100,
    odds: 2.0,
    status: "pending",
    mode: "prelive",
    ...overrides,
  };
}

// ── buildBetFromForm ──────────────────────────────────────────────────────────

describe("buildBetFromForm — sucesso", () => {
  it("cria bet e transaction de stake para dados válidos", () => {
    const result = buildBetFromForm(fd(VALID_FIELDS), stateWithBalance());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.bet.stake).toBe(100);
    expect(result.bet.odds).toBe(2.0);
    expect(result.bet.status).toBe("pending");
    expect(result.bet.mode).toBe("prelive");
    expect(result.transaction.type).toBe("bet_stake");
    expect(result.transaction.amount).toBe(-100);
    expect(result.transaction.bookmakerId).toBe("b1");
  });

  it("converte tags string para array", () => {
    const result = buildBetFromForm(fd({ ...VALID_FIELDS, tags: "value, ev" }), stateWithBalance());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.bet.tags).toEqual(["value", "ev"]);
  });

  it("define source como manual quando sem OCR nem sugestão", () => {
    const result = buildBetFromForm(fd(VALID_FIELDS), stateWithBalance());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.bet.source).toBe("manual");
  });
});

describe("buildBetFromForm — validações", () => {
  it("rejeita quando bookmaker não existe", () => {
    const result = buildBetFromForm(fd({ ...VALID_FIELDS, bookmakerId: "inexistente" }), makeState());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.redirectTo).toBe("books");
  });

  it("rejeita stake zero", () => {
    const result = buildBetFromForm(fd({ ...VALID_FIELDS, stake: "0" }), stateWithBalance());
    expect(result.ok).toBe(false);
  });

  it("rejeita stake negativa", () => {
    const result = buildBetFromForm(fd({ ...VALID_FIELDS, stake: "-50" }), stateWithBalance());
    expect(result.ok).toBe(false);
  });

  it("rejeita odd abaixo de 1.01", () => {
    const result = buildBetFromForm(fd({ ...VALID_FIELDS, odds: "1.0" }), stateWithBalance());
    expect(result.ok).toBe(false);
  });

  it("rejeita stake maior que saldo disponível", () => {
    const result = buildBetFromForm(fd({ ...VALID_FIELDS, stake: "2000" }), stateWithBalance(1000));
    expect(result.ok).toBe(false);
  });
});

// ── buildSettlement ───────────────────────────────────────────────────────────

describe("buildSettlement — won", () => {
  it("liquida com retorno stake × odds", () => {
    const bet = makeBet({ stake: 100, odds: 2.5 });
    const result = buildSettlement([bet], bet.id, "won");
    expect(result).not.toBeNull();
    expect(result?.payout).toBe(250);
    expect(result?.updatedBets[0].status).toBe("won");
    expect(result?.newTransaction?.type).toBe("bet_payout");
    expect(result?.newTransaction?.amount).toBe(250);
  });
});

describe("buildSettlement — lost", () => {
  it("liquida sem transaction de payout", () => {
    const bet = makeBet({ stake: 100, odds: 2.0 });
    const result = buildSettlement([bet], bet.id, "lost");
    expect(result?.payout).toBe(0);
    expect(result?.newTransaction).toBeNull();
    expect(result?.updatedBets[0].status).toBe("lost");
  });
});

describe("buildSettlement — void", () => {
  it("estorna o stake com bet_refund", () => {
    const bet = makeBet({ stake: 150 });
    const result = buildSettlement([bet], bet.id, "void");
    expect(result?.payout).toBe(150);
    expect(result?.newTransaction?.type).toBe("bet_refund");
    expect(result?.newTransaction?.amount).toBe(150);
  });
});

describe("buildSettlement — cashout", () => {
  it("usa valor customizado de cashout", () => {
    const bet = makeBet({ stake: 100, odds: 3.0 });
    const result = buildSettlement([bet], bet.id, "cashout", 180);
    expect(result?.payout).toBe(180);
    expect(result?.newTransaction?.type).toBe("bet_payout");
  });

  it("usa retorno potencial quando cashout sem valor", () => {
    const bet = makeBet({ stake: 100, odds: 2.0 });
    const result = buildSettlement([bet], bet.id, "cashout");
    expect(result?.payout).toBe(200);
  });
});

describe("buildSettlement — guardas", () => {
  it("retorna null para aposta já liquidada", () => {
    const bet = makeBet({ status: "won" });
    expect(buildSettlement([bet], bet.id, "lost")).toBeNull();
  });

  it("retorna null para id inexistente", () => {
    expect(buildSettlement([], "id-fake", "won")).toBeNull();
  });
});

// ── buildBulkSettlement ───────────────────────────────────────────────────────

describe("buildBulkSettlement", () => {
  it("liquida várias apostas pendentes como ganhas", () => {
    const b1 = makeBet({ id: "p1", stake: 100, odds: 2.0 });
    const b2 = makeBet({ id: "p2", stake: 50, odds: 3.0 });
    const state = makeState({ bets: [b1, b2] });
    const result = buildBulkSettlement(state, ["p1", "p2"], "won");
    expect(result.settledCount).toBe(2);
    expect(result.updatedBets.every((b) => b.status === "won")).toBe(true);
    expect(result.newTransactions).toHaveLength(2);
    expect(result.newTransactions.map((t) => t.amount).sort()).toEqual([150, 200]);
  });

  it("liquida várias como perdidas sem gerar transações", () => {
    const state = makeState({ bets: [makeBet({ id: "p1" }), makeBet({ id: "p2" })] });
    const result = buildBulkSettlement(state, ["p1", "p2"], "lost");
    expect(result.settledCount).toBe(2);
    expect(result.newTransactions).toHaveLength(0);
    expect(result.updatedBets.every((b) => b.status === "lost")).toBe(true);
  });

  it("ignora ids inexistentes e apostas já liquidadas", () => {
    const pending = makeBet({ id: "p1" });
    const settled = makeBet({ id: "s1", status: "won" });
    const state = makeState({ bets: [pending, settled] });
    const result = buildBulkSettlement(state, ["p1", "s1", "fantasma"], "lost");
    expect(result.settledCount).toBe(1);
    expect(result.updatedBets.find((b) => b.id === "p1")?.status).toBe("lost");
    expect(result.updatedBets.find((b) => b.id === "s1")?.status).toBe("won");
  });

  it("estorna stake para void em bulk", () => {
    const state = makeState({ bets: [makeBet({ id: "p1", stake: 80 }), makeBet({ id: "p2", stake: 120 })] });
    const result = buildBulkSettlement(state, ["p1", "p2"], "void");
    expect(result.newTransactions.every((t) => t.type === "bet_refund")).toBe(true);
    expect(result.newTransactions.map((t) => t.amount).sort((a, b) => a - b)).toEqual([80, 120]);
  });

  it("não altera nada com lista vazia", () => {
    const state = makeState({ bets: [makeBet({ id: "p1" })] });
    const result = buildBulkSettlement(state, [], "won");
    expect(result.settledCount).toBe(0);
    expect(result.updatedBets).toBe(state.bets);
  });
});

// ── mergeImportedBets ─────────────────────────────────────────────────────────

describe("mergeImportedBets", () => {
  it("adiciona bets novas e exclui duplicatas por id", () => {
    const existing = makeBet({ id: "b-exist" });
    const state = makeState({ bets: [existing] });
    const newBet = makeBet({ id: "b-new" });
    const dup = makeBet({ id: "b-exist", status: "won" });
    const result = mergeImportedBets(state, [newBet, dup]);
    expect(result.bets).toHaveLength(2);
    expect(result.bets.find((b) => b.id === "b-exist")?.status).toBe("pending");
  });

  it("cria transaction de stake para cada bet nova", () => {
    const state = makeState();
    const result = mergeImportedBets(state, [makeBet({ id: "b-1", stake: 75 })]);
    const tx = result.transactions.find((t) => t.type === "bet_stake");
    expect(tx?.amount).toBe(-75);
    expect(tx?.referenceId).toBe("b-1");
  });

  it("cria transaction de payout para bet ganha com payout definido", () => {
    const state = makeState();
    const result = mergeImportedBets(state, [makeBet({ id: "b-1", status: "won", stake: 100, payout: 200 })]);
    const pay = result.transactions.find((t) => t.type === "bet_payout");
    expect(pay?.amount).toBe(200);
  });

  it("cria bet_refund para void", () => {
    const state = makeState();
    const result = mergeImportedBets(state, [makeBet({ id: "b-1", status: "void", stake: 50 })]);
    const refund = result.transactions.find((t) => t.type === "bet_refund");
    expect(refund?.amount).toBe(50);
  });

  it("retorna a mesma referência de estado quando todas são duplicatas", () => {
    const existing = makeBet({ id: "b-1" });
    const state = makeState({ bets: [existing] });
    const result = mergeImportedBets(state, [makeBet({ id: "b-1" })]);
    expect(result).toBe(state);
  });
});
