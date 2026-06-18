/**
 * Sugestões para o formulário de nova aposta, derivadas do histórico.
 * Reduz digitação repetitiva e mantém consistência nos dados (esporte,
 * liga, mercado sempre escritos do mesmo jeito), o que melhora filtros e
 * agrupamentos depois. Tudo ranqueado por frequência: o mais usado primeiro.
 */
import type { AppState, Bet } from "./types";

export interface BetSuggestions {
  sports: string[];
  leagues: string[];
  markets: string[];
  selections: string[];
  tags: string[];
}

/** Ordena valores por frequência de uso (desc), desempatando alfabeticamente. */
function rankByFrequency(values: string[]): string[] {
  const counts = new Map<string, number>();
  for (const raw of values) {
    const key = raw.trim();
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([value]) => value);
}

/** Conjunto completo de sugestões para datalists do formulário. */
export function deriveBetSuggestions(state: AppState): BetSuggestions {
  const bets = state.bets;
  return {
    sports: rankByFrequency(bets.map((b) => b.sport)),
    leagues: rankByFrequency(bets.map((b) => b.league)),
    markets: rankByFrequency(bets.map((b) => b.market)),
    selections: rankByFrequency(bets.map((b) => b.selection)),
    tags: rankByFrequency(bets.flatMap((b) => b.tags)),
  };
}

/** Ligas usadas dentro de um esporte específico (datalist contextual). */
export function leaguesForSport(state: AppState, sport: string): string[] {
  const target = sport.trim().toLowerCase();
  const source = target
    ? state.bets.filter((b) => b.sport.trim().toLowerCase() === target)
    : state.bets;
  return rankByFrequency(source.map((b) => b.league));
}

export interface BetDefaults {
  bookmakerId: string | null;
  mode: Bet["mode"];
  stake: number | null;
}

/** Defaults inteligentes para pré-preencher o formulário: última casa, modo e stake mais comum. */
export function recentBetDefaults(state: AppState): BetDefaults {
  const sorted = [...state.bets].sort((a, b) => b.placedAt.localeCompare(a.placedAt));
  const last = sorted[0];

  const stakeCounts = new Map<number, number>();
  for (const bet of state.bets) {
    stakeCounts.set(bet.stake, (stakeCounts.get(bet.stake) ?? 0) + 1);
  }
  const mostCommonStake = [...stakeCounts.entries()]
    .sort((a, b) => b[1] - a[1] || b[0] - a[0])
    .map(([stake]) => stake)[0];

  return {
    bookmakerId: last?.bookmakerId ?? null,
    mode: last?.mode ?? "prelive",
    stake: mostCommonStake ?? null,
  };
}
