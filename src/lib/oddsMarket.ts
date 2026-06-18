import { getFunctions, httpsCallable } from "firebase/functions";
import { firebaseApp } from "./firebase";

export interface MarketOddsOutcome {
  side: "home" | "away" | "draw";
  name: string;
  best: number;
  bestBook: string;
  pinnacle: number | null;
  fairOdds: number | null;
  impliedProb: number;
}

export interface MarketOddsEvent {
  id: string;
  commenceTime: string;
  homeTeam: string;
  awayTeam: string;
  outcomes: MarketOddsOutcome[];
}

export interface SportOddsResult {
  events: MarketOddsEvent[];
  requestsRemaining: number | null;
}

export interface SupportedSport {
  key: string;
  label: string;
  icon: string;
}

/** Campeonatos de cobertura do The Odds API mais relevantes para o usuário BR. */
export const SUPPORTED_SPORTS: SupportedSport[] = [
  { key: "soccer_fifa_world_cup", label: "Copa do Mundo", icon: "🏆" },
  { key: "soccer_brazil_campeonato", label: "Brasileirão", icon: "🇧🇷" },
  { key: "soccer_uefa_champs_league", label: "Champions", icon: "⭐" },
  { key: "soccer_epl", label: "Premier League", icon: "🦁" },
  { key: "soccer_spain_la_liga", label: "La Liga", icon: "🇪🇸" },
  { key: "soccer_italy_serie_a", label: "Serie A", icon: "🇮🇹" },
  { key: "soccer_germany_bundesliga", label: "Bundesliga", icon: "🇩🇪" },
  { key: "soccer_france_ligue_one", label: "Ligue 1", icon: "🇫🇷" },
  { key: "basketball_nba", label: "NBA", icon: "🏀" },
  { key: "americanfootball_nfl", label: "NFL", icon: "🏈" },
  { key: "mma_mixed_martial_arts", label: "MMA / UFC", icon: "🥊" },
];

export function sportNameFromKey(key: string): string {
  if (key.startsWith("basketball")) return "Basquete";
  if (key.startsWith("americanfootball")) return "Futebol Americano";
  if (key.startsWith("mma")) return "MMA";
  if (key.startsWith("baseball")) return "Beisebol";
  if (key.startsWith("icehockey")) return "Hóquei";
  return "Futebol";
}

const functions = getFunctions(firebaseApp, "southamerica-east1");
const listSportOddsCallable = httpsCallable<{ sportKey: string }, SportOddsResult>(
  functions,
  "listSportOddsCallable",
);

export async function fetchSportOdds(sportKey: string): Promise<SportOddsResult> {
  try {
    const response = await listSportOddsCallable({ sportKey });
    const data = response.data;
    return {
      events: Array.isArray(data?.events) ? data.events : [],
      requestsRemaining:
        typeof data?.requestsRemaining === "number" ? data.requestsRemaining : null,
    };
  } catch {
    return { events: [], requestsRemaining: null };
  }
}

export function isOddsMarketConfigured(): boolean {
  return Boolean(import.meta.env.VITE_FIREBASE_PROJECT_ID);
}
