/**
 * Bets Service — lógica de negócio pura para apostas.
 * Funções sem efeitos colaterais React: recebem estado, retornam novo estado ou objetos.
 * App.tsx usa essas funções e chama setState + toast.
 */
import type { AppState, Bet, Transaction } from "../lib/types";
import { createBetId, createTransactionId } from "../lib/storage";
import { getDerivedBookmakerBalance } from "../lib/ledger";
import { parseOcrMetadata, isSuccessfulOcr, getOcrConfidenceScore } from "../lib/ocr";

/**
 * Retorno bruto (payout) de uma aposta liquidada, por status — fonte única.
 * - won: stake × odd
 * - half_won: metade no preço cheio + metade devolvida = stake×odd/2 + stake/2
 * - void: devolve o stake
 * - half_lost: devolve metade do stake
 * - cashout: valor informado (fallback = retorno potencial)
 * - lost: 0
 *
 * Freebet (aposta grátis): o stake não é dinheiro próprio, então só os GANHOS
 * caem na conta — nunca o stake de volta. won → stake×(odd−1); lost/void → 0.
 */
export function settledPayout(
  status: Bet["status"],
  stake: number,
  odds: number,
  cashoutAmount?: number,
  isFreebet = false,
): number {
  if (isFreebet) {
    switch (status) {
      case "won": return stake * (odds - 1);
      case "half_won": return (stake * (odds - 1)) / 2;
      case "cashout": return cashoutAmount != null && cashoutAmount > 0 ? cashoutAmount : stake * (odds - 1);
      default: return 0; // lost, void, half_lost: nada volta
    }
  }
  switch (status) {
    case "won": return stake * odds;
    case "half_won": return (stake * odds) / 2 + stake / 2;
    case "void": return stake;
    case "half_lost": return stake / 2;
    case "cashout": return cashoutAmount != null && cashoutAmount > 0 ? cashoutAmount : stake * odds;
    default: return 0;
  }
}

/** Lançamento de payout é "ganho" (bet_payout) ou "devolução" (bet_refund)? */
function isWinningsPayout(status: Bet["status"]): boolean {
  return status === "won" || status === "half_won" || status === "cashout";
}

const SETTLEMENT_DESCRIPTION: Partial<Record<Bet["status"], string>> = {
  won: "Retorno",
  half_won: "Retorno (meia)",
  cashout: "Cashout",
  void: "Void",
  half_lost: "Estorno (meia)",
};

export type BetBuildResult =
  | { ok: true; bet: Bet; transaction: Transaction; settlementTransaction?: Transaction | null }
  | { ok: false; error: string; redirectTo?: "books" };

const SETTLEABLE_STATUSES: Bet["status"][] = ["pending", "won", "lost", "cashout", "void"];

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

  const isFreebet = data.get("isFreebet") === "on" || String(data.get("isFreebet")) === "true";

  // Freebet não arrisca dinheiro próprio — não exige (nem debita) saldo da casa.
  if (!isFreebet) {
    const availableBalance = getDerivedBookmakerBalance(state, bookmakerId);
    if (stake > availableBalance) {
      return { ok: false, error: `Saldo insuficiente na ${selectedBookmaker.name}.` };
    }
  }

  const finalSlipPath = slipImagePath ?? (String(data.get("uploadedSlipImagePath") || "") || undefined);
  const finalSlipUrl = slipImageUrl ?? (String(data.get("uploadedSlipImageUrl") || "") || undefined);

  const statusInput = String(data.get("status") || "pending") as Bet["status"];
  const status = SETTLEABLE_STATUSES.includes(statusInput) ? statusInput : "pending";
  const cashoutAmount = Number(data.get("cashoutAmount"));

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
    isFreebet: isFreebet || undefined,
    closingOdds: Number(data.get("closingOdds")) || undefined,
    estimatedProbability: Number.isFinite(estimatedProbability) ? estimatedProbability : undefined,
    estimatedEdge: Number.isFinite(estimatedEdge) ? estimatedEdge : undefined,
    confidenceScore: suggestionId
      ? (Number.isFinite(suggestionConfidenceScore) ? suggestionConfidenceScore : undefined)
      : hasSuccessfulOcr
        ? getOcrConfidenceScore(ocrMetadata)
        : undefined,
    mode: String(data.get("mode")) as Bet["mode"],
    slipImagePath: finalSlipPath,
    slipImageUrl: finalSlipUrl,
    ocrMetadata,
  };

  const transaction: Transaction = {
    id: createTransactionId(),
    date: bet.placedAt,
    type: "bet_stake",
    bookmakerId,
    description: `${isFreebet ? "Freebet" : "Stake"} - ${bet.eventName}`,
    // Freebet não movimenta dinheiro próprio — lançamento fica em 0, só marca a origem.
    amount: isFreebet ? 0 : -stake,
    referenceType: "bet",
    referenceId: bet.id,
  };

  let settlementTransaction: Transaction | null = null;
  if (status !== "pending") {
    const payout = settledPayout(status, stake, odds, Number.isFinite(cashoutAmount) ? cashoutAmount : undefined, isFreebet);

    bet.status = status;
    bet.payout = payout;
    bet.settlementSource = "manual";

    if (payout > 0) {
      settlementTransaction = {
        id: createTransactionId(),
        date: bet.placedAt,
        type: isWinningsPayout(status) ? "bet_payout" : "bet_refund",
        bookmakerId,
        description: `${SETTLEMENT_DESCRIPTION[status] ?? "Retorno"} - ${bet.eventName}`,
        amount: payout,
        referenceType: "bet",
        referenceId: bet.id,
      };
    }
  }

  return { ok: true, bet, transaction, settlementTransaction };
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

  const payout = settledPayout(status, bet.stake, bet.odds, cashoutAmount, bet.isFreebet);

  const newTransaction: Transaction | null = payout > 0 ? {
    id: createTransactionId(),
    date: new Date().toISOString(),
    type: isWinningsPayout(status) ? "bet_payout" : "bet_refund",
    bookmakerId: bet.bookmakerId,
    description: `${SETTLEMENT_DESCRIPTION[status] ?? "Retorno"} - ${bet.eventName}`,
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

/**
 * Atualiza campos de uma aposta e ajusta as transações relacionadas.
 * Funciona para qualquer status: em apostas liquidadas, recalcula o retorno
 * (payout/refund) conforme stake/odd. Cashout mantém o valor recebido.
 */
export function buildBetEdit(data: FormData, state: AppState, betId: string): BetEditResult {
  const existing = state.bets.find((b) => b.id === betId);
  if (!existing) {
    return { ok: false, error: "Aposta não encontrada." };
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

  // Saldo só trava em aposta pendente (dinheiro ainda alocado). Freebet não
  // arrisca dinheiro próprio, então nunca trava. Em apostas liquidadas a edição
  // é correção retroativa — o fluxo de caixa já aconteceu.
  if (existing.status === "pending" && !existing.isFreebet) {
    const available = getDerivedBookmakerBalance(state, bookmakerId);
    const effectiveAvailable =
      bookmakerId === existing.bookmakerId ? available + existing.stake : available;
    if (stake > effectiveAvailable) {
      return { ok: false, error: `Saldo insuficiente na ${selectedBookmaker.name}.` };
    }
  }

  // Recalcula o retorno conforme o status. Cashout é manual: preserva o valor.
  const payout =
    existing.status === "pending" ? undefined :
    existing.status === "cashout" ? existing.payout :
    settledPayout(existing.status, stake, odds, undefined, existing.isFreebet);

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
    payout,
    closingOdds: Number(data.get("closingOdds")) || undefined,
    mode: String(data.get("mode")) as Bet["mode"],
  };

  const updatedTransactions = state.transactions.map((t) => {
    if (t.referenceId !== betId) return t;
    if (t.type === "bet_stake") {
      return {
        ...t,
        amount: existing.isFreebet ? 0 : -stake,
        bookmakerId,
        description: `${existing.isFreebet ? "Freebet" : "Stake"} - ${updatedBet.eventName}`,
      };
    }
    if (t.type === "bet_payout" || t.type === "bet_refund") {
      return {
        ...t,
        amount: payout ?? t.amount,
        bookmakerId,
        description: t.description.replace(/ - .*/, ` - ${updatedBet.eventName}`),
      };
    }
    return t;
  });

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
      description: `${bet.isFreebet ? "Freebet" : "Stake"} - ${bet.eventName}`,
      // Freebet não movimenta dinheiro próprio.
      amount: bet.isFreebet ? 0 : -bet.stake,
      referenceType: "bet",
      referenceId: bet.id,
    }];

    // Retorno de TODO status liquidado — usa o payout informado no CSV quando
    // presente, senão recalcula pela fonte única (settledPayout). Cobre also
    // meia-ganha/meia-perdida, que antes não geravam lançamento e deixavam o
    // saldo da casa subestimado.
    if (bet.status !== "pending") {
      const payout = bet.payout != null && Number.isFinite(bet.payout)
        ? bet.payout
        : settledPayout(bet.status, bet.stake, bet.odds, undefined, bet.isFreebet);
      if (payout > 0) {
        const isWinnings = bet.status === "won" || bet.status === "half_won" || bet.status === "cashout";
        items.push({
          id: createTransactionId(),
          date: bet.placedAt,
          type: isWinnings ? "bet_payout" : "bet_refund",
          bookmakerId: bet.bookmakerId,
          description: `${isWinnings ? "Retorno" : "Estorno"} - ${bet.eventName}`,
          amount: payout,
          referenceType: "bet",
          referenceId: bet.id,
        });
      }
    }
    return items;
  });

  return {
    ...state,
    bets: [...unique, ...state.bets],
    transactions: [...importTransactions, ...state.transactions],
  };
}
