import type { OcrSubmissionMetadata } from "./ocr";

export type BetStatus = "pending" | "won" | "lost" | "cashout" | "void";

export type TransactionType =
  | "deposit"
  | "withdrawal"
  | "transfer"
  | "adjustment"
  | "bet_stake"
  | "bet_payout"
  | "bet_refund";

export type BookmakerStatus = "synced" | "manual" | "reconnect";

export interface BookmakerAccount {
  id: string;
  name: string;
  balance: number;
  status: BookmakerStatus;
  lastSyncLabel: string;
}

export interface Strategy {
  id: string;
  name: string;
  description: string;
  status: "active" | "paused";
}

export interface Bet {
  id: string;
  placedAt: string;
  eventAt: string;
  sport: string;
  league: string;
  eventName: string;
  market: string;
  selection: string;
  bookmakerId: string;
  source?: "manual" | "ocr" | "ai_suggestion";
  suggestionId?: string;
  fixtureId?: number | string;
  strategyId?: string;
  tags: string[];
  stake: number;
  odds: number;
  status: BetStatus;
  payout?: number;
  closingOdds?: number;
  settlementSource?: "manual" | "api";
  estimatedProbability?: number;
  estimatedEdge?: number;
  confidenceScore?: number;
  mode: "prelive" | "live";
  slipImageUrl?: string;
  slipImagePath?: string;
  ocrMetadata?: OcrSubmissionMetadata;
}

export interface NewBetPrefill {
  eventName?: string;
  eventAt?: string;
  sport?: string;
  league?: string;
  market?: string;
  selection?: string;
  bookmakerId?: string;
  strategyId?: string;
  stake?: string;
  odds?: string;
  closingOdds?: string;
  mode?: Bet["mode"];
  tags?: string;
  source?: Bet["source"];
  suggestionId?: string;
  fixtureId?: number | string;
  estimatedProbability?: number;
  estimatedEdge?: number;
  confidenceScore?: number;
}

export interface Transaction {
  id: string;
  date: string;
  type: TransactionType;
  bookmakerId: string;
  targetBookmakerId?: string;
  description: string;
  amount: number;
  referenceType?: "bet" | "bookmaker" | "manual";
  referenceId?: string;
}

export interface AppState {
  bankrollName: string;
  currency: "BRL";
  startingBalance: number;
  riskSettings: RiskSettings;
  bookmakers: BookmakerAccount[];
  strategies: Strategy[];
  bets: Bet[];
  transactions: Transaction[];
}

export interface RiskSettings {
  unitPercent: number;
  maxStakeUnits: number;
  maxOpenExposurePercent: number;
  lossStreakLimit: number;
}

export interface DashboardMetrics {
  totalBalance: number;
  openExposure: number;
  profit: number;
  roi: number;
  yield: number;
  hitRate: number;
  averageOdds: number;
  clvAverage: number;
  pendingCount: number;
  settledCount: number;
}
