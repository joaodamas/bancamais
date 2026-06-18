/**
 * Bets Service — lógica de negócio pura para apostas.
 * Funções sem efeitos colaterais React: recebem estado, retornam novo estado ou objetos.
 * App.tsx usa essas funções e chama setState + toast.
 */
import type { AppState, Bet, Transaction } from "../lib/types";
import { createBetId, createTransactionId } from "../lib/storage";
import { getDerivedBookmakerBalance } from "../lib/ledger";
import { potentialReturn } from "../lib/metrics";
import { parseOcrMetadata, isSuccessfulOcr, getOcrConfidenceScore } from "../lib/ocr";

export type BetBuildResult =
  | { ok: true; bet: Bet; transaction: Transaction }
  | { ok: false; error: string; redirectTo?: "books" };

/** Constrói um novo Bet e sua Transaction de stake a partir do FormData. */
export function buildBetFromForm(
  data: FormData,
  state: AppState,
  slipImagePath?: string,
  slipImageUrl?: string,
): BetBuildResult {
  const bookmakerId = String(data.get("bookmakerId"));
  const stake = Number(data.get("stake"));
  const odds = Number(data.get("odds"));

  const selectedBookmaker = state.bookmakers.find((b) => b.id === bookmakerId);
  if (!selectedBookmaker) {
    return { ok: false, error: "Cadastre uma casa antes de registrar a aposta.", redirectTo: "books" };
  }

  if (!Number.isFinite(stake) || stake <= 0) {
    return { ok: false, error: "Informe uma stake valida." };
  }

  if (!Number.isFinite(odds) || odds < 1.01) {
    return { ok: false, error: "Odd invalida. O valor minimo e 1.01." };
  }

  const availableBalance = getDerivedBookmakerBalance(state, bookmakerId);
  if (stake > availableBalance) {
    return { ok: false, error: `Saldo insuficiente na ${selectedBookmaker.name}.` };
  }

  const ocrMetadata = parseOcrMetadata(data.get("ocrMetadata"));
  const hasSuccessfulOcr = isSuccessfulOcr(ocrMetadata);
  const suggestionId = String(data.get("suggestionId") || "") || undefined;
  const fixtureId = String(data.get("fixtureId") || "") || undefined;
  const estimatedProbability = Number(data.get("estimatedProbability"));
  const estimatedEdge = Number(data.get("estimatedEdge"));
  const suggestionConfidenceScore = Number(data.get("suggestionConfidenceScore"));

  const bet: Bet = {
    id: createBetId(),
    placedAt: new Date().toISOString(),
    eventAt: String(data.get("eventAt")),
    sport: String(data.get("sport")),
    league: String(data.get("league")),
    eventName: String(data.get("eventName")),
    market: String(data.get("market")),
    selection: String(data.get("selection")),
    bookmakerId,
    source: suggestionId ? "ai_suggestion" : hasSuccessfulOcr ? "ocr" : "manual",
    suggestionId,
    fixtureId,
    strategyId: String(data.get("strategyId")) || undefined,
    tags: String(data.get("tags")).split(",").map((t) => t.trim()).filter(Boolean),
    stake,
    odds,
    status: "pending",
    closingOdds: Number(data.get("closingOdds")) || undefined,
    estimatedProbability: Number.isFinite(estimatedProbability) ? estimatedProbability : undefined,
    estimatedEdge: Number.isFinite(estimatedEdge) ? estimatedEdge : undefined,
    confidenceScore: suggestionId
      ? (Number.isFinite(suggestionConfidenceScore) ? suggestionConfidenceScore : undefined)
      : hasSuccessfulOcr
        ? getOcrConfidenceScore(ocrMetadata)
        : undefined,
    mode: String(data.get("mode")) as Bet["mode"],
    slipImagePath,
    slipImageUrl,
    ocrMetadata,
  };

  const transaction: Transaction = {
    id: createTransactionId(),
    date: bet.placedAt,
    type: "bet_stake",
    bookmakerId,
    description: `Stake - ${bet.eventName}`,
    amount: -stake,
    referenceType: "bet",
    referenceId: bet.id,
  };

  return { ok: true, bet, transaction };
}

export type SettlementResult = {
  updatedBets: Bet[];
  newTransaction: Transaction | null;
  payout: number;
};

/** Calcula payout e constrói as entidades de liquidação de uma aposta. */
export function buildSettlement(
  bets: Bet[],
  betId: string,
  status: Bet["status"],
  cashoutAmount?: number,
): SettlementResult | null {
  const bet = bets.find((b) => b.id === betId);
  if (!bet || bet.status !== "pending") return null;

  const payout =
    status === "won"
      ? potentialReturn(bet)
      : status === "cashout"
        ? (cashoutAmount != null && cashoutAmount > 0 ? cashoutAmount : potentialReturn(bet))
        : status === "void"
          ? bet.stake
          : 0;

  const newTransaction: Transaction | null = payout > 0 ? {
    id: createTransactionId(),
    date: new Date().toISOString(),
    type: status === "won" || status === "cashout" ? "bet_payout" : "bet_refund",
    bookmakerId: bet.bookmakerId,
    description:
      status === "won" ? `Retorno - ${bet.eventName}` :
      status === "cashout" ? `Cashout - ${bet.eventName}` :
      `Void - ${bet.eventName}`,
    amount: payout,
    referenceType: "bet",
    referenceId: bet.id,
  } : null;

  const updatedBets = bets.map((b) =>
    b.id === betId ? { ...b, status, payout, settlementSource: "manual" as const } : b,
  );

  return { updatedBets, newTransaction, payout };
}

export type BulkSettlementResult = {
  updatedBets: Bet[];
  newTransactions: Transaction[];
  settledCount: number;
};

/**
 * Liquida várias apostas pendentes de uma vez com o mesmo status.
 * Aplica buildSettlement em sequência e acumula o resultado, para que
 * App.tsx faça um único setState + sync em vez de N.
 * Só won/lost/void fazem sentido em bulk — cashout exige valor por aposta.
 */
export function buildBulkSettlement(
  state: AppState,
  betIds: string[],
  status: Extract<Bet["status"], "won" | "lost" | "void">,
): BulkSettlementResult {
  let bets = state.bets;
  const newTransactions: Transaction[] = [];
  let settledCount = 0;

  for (const id of betIds) {
    const result = buildSettlement(bets, id, status);
    if (!result) continue;
    bets = result.updatedBets;
    if (result.newTransaction) newTransactions.push(result.newTransaction);
    settledCount++;
  }

  return { updatedBets: bets, newTransactions, settledCount };
}

export type BetEditResult =
  | { ok: true; updatedBet: Bet; updatedTransactions: Transaction[] }
  | { ok: false; error: string };

/** Atualiza campos de uma aposta pendente e ajusta a transação de stake. */
export function buildBetEdit(data: FormData, state: AppState, betId: string): BetEditResult {
  const existing = state.bets.find((b) => b.id === betId);
  if (!existing || existing.status !== "pending") {
    return { ok: false, error: "Só é possível editar apostas pendentes." };
  }

  const bookmakerId = String(data.get("bookmakerId"));
  const stake = Number(data.get("stake"));
  const odds = Number(data.get("odds"));

  const selectedBookmaker = state.bookmakers.find((b) => b.id === bookmakerId);
  if (!selectedBookmaker) {
    return { ok: false, error: "Casa inválida." };
  }
  if (!Number.isFinite(stake) || stake <= 0) {
    return { ok: false, error: "Informe uma stake válida." };
  }
  if (!Number.isFinite(odds) || odds < 1.01) {
    return { ok: false, error: "Odd inválida. O valor mínimo é 1.01." };
  }

  const available = getDerivedBookmakerBalance(state, bookmakerId);
  const effectiveAvailable =
    bookmakerId === existing.bookmakerId ? available + existing.stake : available;

  if (stake > effectiveAvailable) {
    return { ok: false, error: `Saldo insuficiente na ${selectedBookmaker.name}.` };
  }

  const updatedBet: Bet = {
    ...existing,
    eventAt: String(data.get("eventAt")),
    sport: String(data.get("sport")),
    league: String(data.get("league")),
    eventName: String(data.get("eventName")),
    market: String(data.get("market")),
    selection: String(data.get("selection")),
    bookmakerId,
    strategyId: String(data.get("strategyId")) || undefined,
    tags: String(data.get("tags")).split(",").map((t) => t.trim()).filter(Boolean),
    stake,
    odds,
    closingOdds: Number(data.get("closingOdds")) || undefined,
    mode: String(data.get("mode")) as Bet["mode"],
  };

  const updatedTransactions = state.transactions.map((t) =>
    t.referenceId === betId && t.type === "bet_stake"
      ? { ...t, amount: -stake, bookmakerId, description: `Stake - ${updatedBet.eventName}` }
      : t,
  );

  return { ok: true, updatedBet, updatedTransactions };
}

/** Remove uma aposta e suas transações relacionadas do estado. */
export function buildDeletedBetState(state: AppState, betId: string): AppState {
  return {
    ...state,
    bets: state.bets.filter((b) => b.id !== betId),
    transactions: state.transactions.filter((t) => t.referenceId !== betId),
  };
}

/** Filtra duplicatas e mescla apostas importadas ao estado atual. */
export function mergeImportedBets(state: AppState, incoming: Bet[]): AppState {
  const existingIds = new Set(state.bets.map((b) => b.id));
  const unique = incoming.filter((b) => !existingIds.has(b.id));

  if (unique.length === 0) return state;

  const importTransactions: Transaction[] = unique.flatMap((bet) => {
    const items: Transaction[] = [{
      id: createTransactionId(),
      date: bet.placedAt,
      type: "bet_stake",
      bookmakerId: bet.bookmakerId,
      description: `Stake - ${bet.eventName}`,
      amount: -bet.stake,
      referenceType: "bet",
      referenceId: bet.id,
    }];

    if ((bet.status === "won" || bet.status === "cashout") && bet.payout && bet.payout > 0) {
      items.push({
        id: createTransactionId(),
        date: bet.placedAt,
        type: "bet_payout",
        bookmakerId: bet.bookmakerId,
        description: `Retorno - ${bet.eventName}`,
        amount: bet.payout,
        referenceType: "bet",
        referenceId: bet.id,
      });
    } else if (bet.status === "void") {
      items.push({
        id: createTransactionId(),
        date: bet.placedAt,
        type: "bet_refund",
        bookmakerId: bet.bookmakerId,
        description: `Estorno - ${bet.eventName}`,
        amount: bet.stake,
        referenceType: "bet",
        referenceId: bet.id,
      });
    }
    return items;
  });

  return {
    ...state,
    bets: [...unique, ...state.bets],
    transactions: [...importTransactions, ...state.transactions],
  };
}
