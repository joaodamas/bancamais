import type { EdgeEstimate, EstimateEdgeRequest } from "../contracts/externalData.js";
import { getTeamContext } from "./teamContext.js";

// homeTeam.homeRecord holds the home team's record in their last 5 HOME matches.
// awayTeam.homeRecord holds the away team's record in their last 5 AWAY matches
// (the field is named homeRecord on TeamStats for both teams; the caller populates
// it with the venue-appropriate subset in teamContext.ts).

function winRate(wins: number, total: number): number {
  if (total === 0) return 0;
  return wins / total;
}

function totalGames(rec: { wins: number; draws: number; losses: number }): number {
  return rec.wins + rec.draws + rec.losses;
}

function bttsRate(last5: { homeGoals: number; awayGoals: number }[], asHome: boolean): number {
  const relevant = last5.filter((m) =>
    asHome ? m.homeGoals > 0 : m.awayGoals > 0,
  );
  return last5.length === 0 ? 0 : relevant.length / last5.length;
}

function confidenceLevel(homeSamples: number, awaySamples: number): "high" | "medium" | "low" {
  const min = Math.min(homeSamples, awaySamples);
  if (min >= 4) return "high";
  if (min >= 2) return "medium";
  return "low";
}

export async function estimateEdge(
  apiKey: string,
  request: EstimateEdgeRequest,
): Promise<EdgeEstimate> {
  const impliedProbability = 1 / request.odds;

  const context = await getTeamContext(apiKey, request.fixtureId);
  const { homeTeam, awayTeam } = context;

  // homeTeam.homeRecord = home team's record in their last 5 home fixtures
  // awayTeam.homeRecord = away team's record in their last 5 away fixtures
  const homeRec = homeTeam.homeRecord;
  const awayRec = awayTeam.homeRecord;

  const homeGames = totalGames(homeRec);
  const awayGames = totalGames(awayRec);
  const confidence = confidenceLevel(homeGames, awayGames);

  const marketKey = request.market.toLowerCase().replace(/[\s_-]+/g, "_");
  const selectionKey = request.selection.toLowerCase().replace(/[\s_-]+/g, "_");

  let estimatedProbability: number;
  let reasoning: string;

  if (
    (marketKey.includes("match_winner") || marketKey.includes("1x2")) &&
    (selectionKey === "home" || selectionKey === "1")
  ) {
    estimatedProbability = homeGames > 0 ? winRate(homeRec.wins, homeGames) : impliedProbability;
    reasoning =
      homeGames > 0
        ? `Home team won ${homeRec.wins} of their last ${homeGames} home matches (${(estimatedProbability * 100).toFixed(1)}%).`
        : "No home match data available; falling back to implied probability.";
  } else if (
    (marketKey.includes("match_winner") || marketKey.includes("1x2")) &&
    (selectionKey === "away" || selectionKey === "2")
  ) {
    estimatedProbability = awayGames > 0 ? winRate(awayRec.wins, awayGames) : impliedProbability;
    reasoning =
      awayGames > 0
        ? `Away team won ${awayRec.wins} of their last ${awayGames} away matches (${(estimatedProbability * 100).toFixed(1)}%).`
        : "No away match data available; falling back to implied probability.";
  } else if (
    marketKey.includes("both_teams") ||
    marketKey.includes("btts") ||
    marketKey.includes("ambas_marcam")
  ) {
    const homeScored = bttsRate(homeTeam.last5, true);
    const awayScored = bttsRate(awayTeam.last5, false);
    estimatedProbability =
      homeTeam.last5.length > 0 && awayTeam.last5.length > 0
        ? homeScored * awayScored
        : impliedProbability;
    reasoning =
      homeTeam.last5.length > 0 && awayTeam.last5.length > 0
        ? `Home team scored in ${(homeScored * 100).toFixed(0)}% of last 5; away team scored in ${(awayScored * 100).toFixed(0)}% of last 5. Combined BTTS estimate: ${(estimatedProbability * 100).toFixed(1)}%.`
        : "Insufficient data for BTTS model; falling back to implied probability.";
  } else {
    estimatedProbability = impliedProbability;
    reasoning = `Market "${request.market}" is not directly modelled; estimated probability equals implied probability.`;
  }

  const edge = estimatedProbability - impliedProbability;

  return {
    estimatedProbability: Number(estimatedProbability.toFixed(4)),
    impliedProbability: Number(impliedProbability.toFixed(4)),
    edge: Number(edge.toFixed(4)),
    confidence,
    reasoning,
  };
}
