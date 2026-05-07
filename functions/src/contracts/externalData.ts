export interface FixtureSummary {
  id: number;
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeLogo: string;
  awayLogo: string;
  league: string;
  leagueLogo: string;
  country: string;
  status: string;
  homeGoals: number | null;
  awayGoals: number | null;
}

export interface FixtureSearchResult {
  fixture: FixtureSummary;
  displayLabel: string;
}

export interface SearchSportsFixturesRequest {
  query: string;
  limit?: number;
}

export interface GetSportsFixtureResultRequest {
  fixtureId: number;
}

export interface FixtureResult {
  homeGoals: number;
  awayGoals: number;
  status: string;
}

export interface NewsArticle {
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
  image: string | null;
}

export interface FetchTeamNewsRequest {
  teamName: string;
  maxResults?: number;
}

// --- Team context ---

export interface MatchResult {
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeGoals: number;
  awayGoals: number;
}

export interface WinLossRecord {
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
}

export interface TeamStats {
  name: string;
  last5: MatchResult[];
  homeRecord: WinLossRecord;
  position?: number;
}

export interface TeamContext {
  homeTeam: TeamStats;
  awayTeam: TeamStats;
  headToHead: MatchResult[];
}

export interface GetTeamContextRequest {
  fixtureId: number;
}

// --- Edge estimation ---

export interface EstimateEdgeRequest {
  fixtureId: number;
  market: string;
  selection: string;
  odds: number;
}

export interface EdgeEstimate {
  estimatedProbability: number;
  impliedProbability: number;
  edge: number;
  confidence: "high" | "medium" | "low";
  reasoning: string;
}
