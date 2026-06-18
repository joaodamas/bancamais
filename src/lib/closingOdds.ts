import { getFunctions, httpsCallable } from "firebase/functions";
import { firebaseApp } from "./firebase";
import type { Bet } from "./types";

/**
 * Janela pré-kickoff para capturar a closing line. No free tier do The Odds API só há
 * odds de eventos futuros — depois do apito o jogo some do feed. Então captura-se a linha
 * quando o evento está nesta janela e congela-se o valor (cache imutável).
 */
const CLOSING_CAPTURE_WINDOW_HOURS = 48;

const functions = getFunctions(firebaseApp, "southamerica-east1");

export interface ClosingOddsBetInput {
  betId: string;
  sport: string;
  league: string;
  eventName: string;
  selection: string;
  eventAt: string;
}

export interface ClosingOddsResult {
  betId: string;
  closingOdds: number;
  bookmaker: string;
}

const fetchClosingOddsCallable = httpsCallable<
  { bets: ClosingOddsBetInput[] },
  ClosingOddsResult[]
>(functions, "fetchClosingOddsCallable");

/**
 * Decide se vale buscar a closing line: aposta pendente, ainda sem closingOdds,
 * e com evento dentro da janela pré-kickoff.
 */
export function shouldFetchClosing(bet: Bet, now: number = Date.now()): boolean {
  if (bet.status !== "pending") return false;
  if (bet.closingOdds != null) return false;

  const eventTime = Date.parse(bet.eventAt);
  if (Number.isNaN(eventTime)) return false;

  const windowMs = CLOSING_CAPTURE_WINDOW_HOURS * 60 * 60 * 1000;
  return eventTime > now && eventTime - now <= windowMs;
}

/** Monta o payload do callable a partir das apostas que precisam de closing line. */
export function collectBetsNeedingClosing(
  bets: Bet[],
  now: number = Date.now(),
): ClosingOddsBetInput[] {
  return bets
    .filter((bet) => shouldFetchClosing(bet, now))
    .map((bet) => ({
      betId: bet.id,
      sport: bet.sport,
      league: bet.league,
      eventName: bet.eventName,
      selection: bet.selection,
      eventAt: bet.eventAt,
    }));
}

export async function fetchClosingOdds(
  bets: ClosingOddsBetInput[],
): Promise<ClosingOddsResult[]> {
  if (bets.length === 0) return [];
  try {
    const response = await fetchClosingOddsCallable({ bets });
    return Array.isArray(response.data) ? response.data : [];
  } catch {
    return [];
  }
}

export function isClosingOddsConfigured(): boolean {
  return Boolean(import.meta.env.VITE_FIREBASE_PROJECT_ID);
}
