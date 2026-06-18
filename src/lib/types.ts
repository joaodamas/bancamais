import type { OcrFieldName, OcrSubmissionMetadata, ParseBetSlipResponse } from "./ocr";

export type BetStatus = "pending" | "won" | "lost" | "cashout" | "void";

export type TransactionType =
  | "deposit"
  | "withdrawal"
  | "transfer"
  | "adjustment"
  | "bet_stake"
  | "bet_payout"
  | "bet_refund"
  | "void_entry";

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

export interface NewBetFormValues {
  eventName: string;
  eventAt: string;
  sport: string;
  league: string;
  market: string;
  selection: string;
  bookmakerId: string;
  strategyId: string;
  stake: string;
  odds: string;
  closingOdds: string;
  mode: Bet["mode"];
  tags: string;
}

/** Campos "fixos" de um template — o que se repete entre apostas (sem evento/odd/data). */
export type BetTemplateFields = Pick<
  NewBetFormValues,
  "sport" | "league" | "market" | "selection" | "bookmakerId" | "strategyId" | "stake" | "mode" | "tags"
>;

export interface BetTemplate {
  id: string;
  name: string;
  partial: Partial<BetTemplateFields>;
  createdAt: string;
}

export interface ReportSnapshotEdge {
  key: string;
  profit: number;
  roi: number;
  bets: number;
}

/** Snapshot congelado do relatório executivo de um mês (BI histórico). */
export interface ReportSnapshot {
  monthKey: string;
  periodLabel: string;
  /** null = vista ao vivo (não congelada); ISO = momento em que foi salva. */
  savedAt: string | null;
  hasData: boolean;
  profit: number;
  yield: number;
  hitRate: number;
  staked: number;
  settledCount: number;
  clvAverage: number | null;
  topEdges: ReportSnapshotEdge[];
  behaviorAlert: string | null;
  summary: string;
}

export interface NewBetOcrFieldMeta {
  ocrField: OcrFieldName;
  confidence: number | null;
  sourceText: string | null;
  extractedValue: string | number | null;
  warnings: string[];
  requiresReview: boolean;
  reviewedManually: boolean;
}

export type NewBetOcrFieldMetaMap = Partial<Record<keyof NewBetFormValues, NewBetOcrFieldMeta>>;

export interface NewBetDraft {
  formValues: NewBetFormValues;
  ocrStatus: "idle" | "loading" | "done" | "error";
  ocrMessage: string;
  ocrWarnings: string[];
  uploadedSlip: { path: string; url: string } | null;
  ocrResult: ParseBetSlipResponse | null;
  fieldOcrMeta: NewBetOcrFieldMetaMap;
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
  /** ID of the void_entry transaction that cancels this transaction */
  voidedById?: string;
  /** ID of the original transaction this void_entry cancels */
  voidsCancelledId?: string;
}

export interface AppState {
  bankrollName: string;
  currency: "BRL";
  startingBalance: number;
  lastModifiedAt?: string | null;
  riskSettings: RiskSettings;
  bookmakers: BookmakerAccount[];
  strategies: Strategy[];
  bets: Bet[];
  transactions: Transaction[];
  betTemplates: BetTemplate[];
  reportSnapshots: ReportSnapshot[];
}

export type UnitMode = "fixed" | "percent";

export interface RiskSettings {
  /** Como a unidade é definida: valor fixo em R$ ou % da banca. */
  unitMode: UnitMode;
  /** Valor da unidade em R$ quando unitMode === "fixed". */
  unitFixed: number;
  unitPercent: number;
  maxStakeUnits: number;
  maxOpenExposurePercent: number;
  lossStreakLimit: number;
  hardStopEnabled: boolean;
  dailyLossLimitPercent: number;
  weeklyLossLimitPercent: number;
  monthlyDrawdownPercent: number;
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
