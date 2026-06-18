/**
 * View-models para a tela de Apostas.
 * Transforma Bet[] cru em linhas prontas para renderizar — sem subtítulos
 * redundantes, com delta de tempo e agrupamento temporal — para que a UI
 * apenas exiba, sem lógica de apresentação espalhada no JSX.
 */
import type { AppState, Bet } from "./types";
import { potentialReturn, betProfit, clvPercent } from "./metrics";
import { eventDelta, isImminent, type EventDelta } from "./betTime";

export interface BetRowView {
  id: string;
  status: Bet["status"];
  eventName: string;
  eventAt: string;
  /** "Futebol · UCL" — contexto compacto numa string só. */
  context: string;
  market: string;
  selection: string;
  bookmakerName: string;
  strategyName: string | null;
  stake: number;
  odds: number;
  closingOdds: number | null;
  mode: Bet["mode"];
  source?: Bet["source"];
  tags: string[];
  slipImageUrl?: string;
  /** Delta de tempo até o evento (pendentes). */
  delta: EventDelta;
  imminent: boolean;
  /** Retorno potencial (pendente) ou efetivo (liquidada). */
  returnValue: number;
  /** Ganho potencial (pendente) ou lucro líquido (liquidada). */
  gainValue: number;
  payout: number | null;
  clv: number | null;
}

function buildContext(bet: Bet): string {
  return [bet.sport, bet.league].filter(Boolean).join(" · ");
}

/** Converte um Bet num modelo de linha pronto para exibição. */
export function toBetRowView(
  bet: Bet,
  bookmakerById: Map<string, string>,
  strategyById: Map<string, string>,
  now: number = Date.now(),
): BetRowView {
  const isPending = bet.status === "pending";
  const returnValue = isPending
    ? potentialReturn(bet)
    : bet.status === "void"
      ? bet.payout ?? bet.stake
      : bet.payout ?? 0;
  const gainValue = isPending ? potentialReturn(bet) - bet.stake : betProfit(bet);

  return {
    id: bet.id,
    status: bet.status,
    eventName: bet.eventName,
    eventAt: bet.eventAt,
    context: buildContext(bet),
    market: bet.market,
    selection: bet.selection,
    bookmakerName: bookmakerById.get(bet.bookmakerId) ?? "—",
    strategyName: bet.strategyId ? strategyById.get(bet.strategyId) ?? null : null,
    stake: bet.stake,
    odds: bet.odds,
    closingOdds: bet.closingOdds ?? null,
    mode: bet.mode,
    source: bet.source,
    tags: bet.tags,
    slipImageUrl: bet.slipImageUrl,
    delta: eventDelta(bet.eventAt, now),
    imminent: isPending && isImminent(bet.eventAt, now),
    returnValue,
    gainValue,
    payout: bet.payout ?? null,
    clv: clvPercent(bet),
  };
}

export type TimeBucket = "live" | "today" | "tomorrow" | "thisWeek" | "later";

const BUCKET_LABEL: Record<TimeBucket, string> = {
  live: "Ao vivo",
  today: "Hoje",
  tomorrow: "Amanhã",
  thisWeek: "Esta semana",
  later: "Mais tarde",
};

const BUCKET_ORDER: TimeBucket[] = ["live", "today", "tomorrow", "thisWeek", "later"];

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Classifica um evento num balde temporal relativo a agora. */
export function bucketForEvent(eventAt: string, now: number = Date.now()): TimeBucket {
  const target = new Date(eventAt).getTime();
  if (Number.isNaN(target)) return "later";
  if (target < now) return "live";

  const today0 = startOfDay(now);
  const dayMs = 86_400_000;
  const eventDay0 = startOfDay(target);
  const dayDiff = Math.round((eventDay0 - today0) / dayMs);

  if (dayDiff <= 0) return "today";
  if (dayDiff === 1) return "tomorrow";
  if (dayDiff <= 7) return "thisWeek";
  return "later";
}

export interface BetGroup {
  bucket: TimeBucket;
  label: string;
  bets: BetRowView[];
}

/**
 * Agrupa apostas pendentes por proximidade temporal e ordena cada grupo
 * pelo evento mais próximo primeiro. Grupos vazios são omitidos.
 */
export function groupPendingByTime(views: BetRowView[], now: number = Date.now()): BetGroup[] {
  const pending = views.filter((v) => v.status === "pending");
  const byBucket = new Map<TimeBucket, BetRowView[]>();

  for (const view of pending) {
    const bucket = bucketForEvent(view.eventAt, now);
    const list = byBucket.get(bucket) ?? [];
    list.push(view);
    byBucket.set(bucket, list);
  }

  return BUCKET_ORDER.flatMap((bucket) => {
    const bets = byBucket.get(bucket);
    if (!bets || bets.length === 0) return [];
    bets.sort((a, b) => a.eventAt.localeCompare(b.eventAt));
    return [{ bucket, label: BUCKET_LABEL[bucket], bets }];
  });
}

/** Constrói os view-models de todas as apostas do estado. */
export function buildBetRowViews(state: AppState, now: number = Date.now()): BetRowView[] {
  const bookmakerById = new Map(state.bookmakers.map((b) => [b.id, b.name]));
  const strategyById = new Map(state.strategies.map((s) => [s.id, s.name]));
  return state.bets.map((bet) => toBetRowView(bet, bookmakerById, strategyById, now));
}
