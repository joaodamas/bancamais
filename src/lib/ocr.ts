import { getFunctions, httpsCallable } from "firebase/functions";
import { firebaseApp } from "./firebase";
import { uploadBetSlip } from "./storageRepository";

export type OcrStatus = "success" | "needs_review" | "not_configured" | "failed";
export type BetMode = "prelive" | "live";
export type OcrFieldName =
  | "eventName"
  | "eventAtIso"
  | "sport"
  | "league"
  | "market"
  | "selection"
  | "bookmakerName"
  | "stake"
  | "odds"
  | "mode";

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

interface ParseBetSlipRequest {
  storagePath: string;
  mimeType?: string;
  source?: "upload" | "paste" | "camera";
}

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
  fields: {
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
  };
  reviewFlags: OcrReviewFlag[];
  rawText: string | null;
}

export interface OcrSubmissionFieldMetadata {
  field: OcrFieldName;
  extractedValue: string | number | null;
  currentValue: string | number | null;
  confidence: number | null;
  sourceText: string | null;
  overridden: boolean;
  reviewedManually: boolean;
}

export interface OcrSubmissionMetadata {
  requestId: string;
  status: OcrStatus;
  provider: "anthropic" | "stub";
  extractedAt: string;
  uploadedSlipPath: string | null;
  uploadedSlipUrl: string | null;
  reviewFlags: OcrReviewFlag[];
  fields: OcrSubmissionFieldMetadata[];
}

const functions = getFunctions(firebaseApp, "southamerica-east1");
const parseBetSlip = httpsCallable<ParseBetSlipRequest, ParseBetSlipResponse>(
  functions,
  "parseBetSlipFromStorage",
);

function normalizeComparableValue(value: string | number | null | undefined) {
  if (value == null) return null;
  if (typeof value === "number") return String(value);
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function parseOcrMetadata(raw: FormDataEntryValue | null): OcrSubmissionMetadata | undefined {
  if (typeof raw !== "string" || raw.trim().length === 0) return undefined;
  try {
    return JSON.parse(raw) as OcrSubmissionMetadata;
  } catch {
    return undefined;
  }
}

export function isSuccessfulOcr(metadata: OcrSubmissionMetadata | undefined): boolean {
  return metadata?.status === "success" || metadata?.status === "needs_review";
}

export function getOcrConfidenceScore(metadata: OcrSubmissionMetadata | undefined): number | undefined {
  if (!metadata) return undefined;
  const confidentFields = metadata.fields
    .map((field) => field.confidence)
    .filter((value): value is number => typeof value === "number");
  if (confidentFields.length === 0) return undefined;
  return confidentFields.reduce((sum, value) => sum + value, 0) / confidentFields.length;
}

export function buildOcrSubmissionMetadata(
  ocr: ParseBetSlipResponse | null,
  currentValues: Partial<Record<OcrFieldName, string | number | null>>,
  reviewedFields: Partial<Record<OcrFieldName, boolean>>,
  upload: { path: string; url: string } | null,
) {
  if (!ocr) return "";

  const fields: OcrSubmissionFieldMetadata[] = Object.entries(ocr.fields).map(([field, extractedField]) => {
    const typedField = field as OcrFieldName;
    const extractedValue = extractedField.value;
    const currentValue = currentValues[typedField] ?? null;
    const normalizedExtracted = normalizeComparableValue(extractedValue);
    const normalizedCurrent = normalizeComparableValue(currentValue);

    return {
      field: typedField,
      extractedValue,
      currentValue,
      confidence: extractedField.confidence,
      sourceText: extractedField.sourceText,
      overridden:
        normalizedExtracted !== null &&
        normalizedCurrent !== null &&
        normalizedExtracted !== normalizedCurrent,
      reviewedManually: Boolean(reviewedFields[typedField]),
    };
  });

  const metadata: OcrSubmissionMetadata = {
    requestId: ocr.requestId,
    status: ocr.status,
    provider: ocr.provider,
    extractedAt: ocr.extractedAt,
    uploadedSlipPath: upload?.path ?? null,
    uploadedSlipUrl: upload?.url ?? null,
    reviewFlags: ocr.reviewFlags,
    fields,
  };

  return JSON.stringify(metadata);
}

export async function uploadAndParseBetSlip(userId: string, file: File) {
  const upload = await uploadBetSlip(userId, file);
  const response = await parseBetSlip({
    storagePath: upload.path,
    mimeType: file.type || undefined,
    source: "upload",
  });

  return {
    upload,
    ocr: response.data,
  };
}
