export type OcrStatus = "success" | "needs_review" | "not_configured" | "failed";

export type BetMode = "prelive" | "live";

export interface ParseBetSlipRequest {
  storagePath: string;
  mimeType?: string;
  source?: "upload" | "paste" | "camera";
}

export interface ExtractedField<T> {
  value: T | null;
  confidence: number | null;
  sourceText: string | null;
}

export interface OcrReviewFlag {
  code:
    | "missing_field"
    | "low_confidence"
    | "invalid_number"
    | "invalid_datetime"
    | "provider_not_configured"
    | "provider_failed";
  severity: "info" | "warning" | "error";
  field?: OcrFieldName;
  message: string;
}

export interface ParsedSlipFields {
  eventName: ExtractedField<string>;
  eventAtIso: ExtractedField<string>;
  sport: ExtractedField<string>;
  league: ExtractedField<string>;
  market: ExtractedField<string>;
  selection: ExtractedField<string>;
  bookmakerName: ExtractedField<string>;
  stake: ExtractedField<number>;
  odds: ExtractedField<number>;
  mode: ExtractedField<BetMode>;
}

export type OcrFieldName = keyof ParsedSlipFields;

export interface ParseBetSlipResponse {
  requestId: string;
  status: OcrStatus;
  provider: "anthropic" | "stub";
  extractedAt: string;
  slip: {
    storagePath: string;
    contentType: string;
    sizeBytes: number;
  };
  fields: ParsedSlipFields;
  reviewFlags: OcrReviewFlag[];
  rawText: string | null;
}

export interface SlipImagePayload {
  storagePath: string;
  contentType: string;
  sizeBytes: number;
  base64: string;
}

export interface ProviderExtractedField<T> {
  value?: T | null;
  confidence?: number | null;
  sourceText?: string | null;
}

export interface ProviderOcrPayload {
  rawText?: string | null;
  fields: {
    eventName?: ProviderExtractedField<string>;
    eventAtIso?: ProviderExtractedField<string>;
    sport?: ProviderExtractedField<string>;
    league?: ProviderExtractedField<string>;
    market?: ProviderExtractedField<string>;
    selection?: ProviderExtractedField<string>;
    bookmakerName?: ProviderExtractedField<string>;
    stake?: ProviderExtractedField<number>;
    odds?: ProviderExtractedField<number>;
    mode?: ProviderExtractedField<BetMode>;
  };
}

export function emptyFields(): ParsedSlipFields {
  return {
    eventName: emptyField<string>(),
    eventAtIso: emptyField<string>(),
    sport: emptyField<string>(),
    league: emptyField<string>(),
    market: emptyField<string>(),
    selection: emptyField<string>(),
    bookmakerName: emptyField<string>(),
    stake: emptyField<number>(),
    odds: emptyField<number>(),
    mode: emptyField<BetMode>(),
  };
}

export function emptyField<T>(): ExtractedField<T> {
  return {
    value: null,
    confidence: null,
    sourceText: null,
  };
}
