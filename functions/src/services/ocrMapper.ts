import {
  emptyField,
  emptyFields,
  type ExtractedField,
  type OcrFieldName,
  type OcrReviewFlag,
  type ParseBetSlipResponse,
  type SlipImagePayload,
} from "../contracts/ocr.js";
import type { FlatOcrPayload } from "./anthropicOcr.js";

const LOW_CONFIDENCE_THRESHOLD = 0.8;

export function buildNotConfiguredResponse(slip: SlipImagePayload): ParseBetSlipResponse {
  return {
    requestId: "not-configured",
    status: "not_configured",
    provider: "stub",
    extractedAt: new Date().toISOString(),
    slip: toSlipSummary(slip),
    fields: emptyFields(),
    rawText: null,
    reviewFlags: [
      {
        code: "provider_not_configured",
        severity: "error",
        message: "OCR provider nao configurado. Defina o secret ANTHROPIC_API_KEY antes do deploy.",
      },
    ],
  };
}

export function buildFailedResponse(
  slip: SlipImagePayload,
  requestId: string,
  reason: string,
): ParseBetSlipResponse {
  return {
    requestId,
    status: "failed",
    provider: "anthropic",
    extractedAt: new Date().toISOString(),
    slip: toSlipSummary(slip),
    fields: emptyFields(),
    rawText: null,
    reviewFlags: [
      {
        code: "provider_failed",
        severity: "error",
        message: reason,
      },
    ],
  };
}

export function mapProviderPayload(
  slip: SlipImagePayload,
  requestId: string,
  payload: FlatOcrPayload,
): ParseBetSlipResponse {
  const fields = emptyFields();
  const missing = new Set(payload.missingFields ?? []);
  const uncertain = new Set(payload.uncertainFields ?? []);

  fields.eventName     = flatToField(payload.eventName, "string", missing, uncertain, "eventName");
  fields.eventAtIso    = flatToStringField(payload.eventAt, missing, uncertain, "eventAt", normaliseIsoDate);
  fields.sport         = flatToField(payload.sport, "string", missing, uncertain, "sport");
  fields.league        = flatToField(payload.league, "string", missing, uncertain, "league");
  fields.market        = flatToField(payload.market, "string", missing, uncertain, "market");
  fields.selection     = flatToField(payload.selection, "string", missing, uncertain, "selection");
  fields.bookmakerName = flatToField(payload.bookmakerName, "string", missing, uncertain, "bookmakerName");
  fields.stake         = flatToNumberField(payload.stake, missing, uncertain);
  fields.odds          = flatToNumberField(payload.odds, missing, uncertain, "odds");
  fields.mode          = flatToStringField(payload.mode, missing, uncertain, "mode", normaliseMode);

  const reviewFlags = collectReviewFlags(fields);

  return {
    requestId,
    status: reviewFlags.length > 0 ? "needs_review" : "success",
    provider: "anthropic",
    extractedAt: new Date().toISOString(),
    slip: toSlipSummary(slip),
    fields,
    rawText: payload.rawText || null,
    reviewFlags,
  };
}

function confidenceFor(fieldName: string, missing: Set<string>, uncertain: Set<string>): number {
  if (missing.has(fieldName)) return 0;
  if (uncertain.has(fieldName)) return 0.55;
  return 0.92;
}

function flatToField(
  value: string,
  _type: "string",
  missing: Set<string>,
  uncertain: Set<string>,
  fieldName = "",
): ExtractedField<string> {
  const str = String(value ?? "").trim();
  const conf = confidenceFor(fieldName, missing, uncertain);
  return { value: str || null, confidence: conf, sourceText: str || null };
}

function flatToStringField<T>(
  value: string,
  missing: Set<string>,
  uncertain: Set<string>,
  fieldName: string,
  transform: (v: string) => T | null,
): ExtractedField<T> {
  const str = String(value ?? "").trim();
  const conf = confidenceFor(fieldName, missing, uncertain);
  if (!str) return emptyField<T>();
  const transformed = transform(str);
  return { value: transformed, confidence: conf, sourceText: str };
}

function flatToNumberField(
  value: number,
  missing: Set<string>,
  uncertain: Set<string>,
  fieldName = "",
): ExtractedField<number> {
  const num = Number(value);
  const conf = confidenceFor(fieldName, missing, uncertain);
  return { value: num > 0 ? num : null, confidence: conf, sourceText: num > 0 ? String(num) : null };
}

function toSlipSummary(slip: SlipImagePayload) {
  return {
    storagePath: slip.storagePath,
    contentType: slip.contentType,
    sizeBytes: slip.sizeBytes,
  };
}


function collectReviewFlags(fields: ParseBetSlipResponse["fields"]): OcrReviewFlag[] {
  const flags: OcrReviewFlag[] = [];

  const requiredFields: OcrFieldName[] = [
    "eventName",
    "market",
    "selection",
    "stake",
    "odds",
    "bookmakerName",
  ];

  for (const fieldName of requiredFields) {
    const field = fields[fieldName];
    if (field.value == null) {
      flags.push({
        code: "missing_field",
        severity: "warning",
        field: fieldName,
        message: `Campo ${fieldName} nao foi identificado com seguranca.`,
      });
      continue;
    }

    if (field.confidence != null && field.confidence < LOW_CONFIDENCE_THRESHOLD) {
      flags.push({
        code: "low_confidence",
        severity: "warning",
        field: fieldName,
        message: `Campo ${fieldName} com confianca baixa (${field.confidence}).`,
      });
    }
  }

  if (fields.eventAtIso.value == null && fields.eventAtIso.sourceText) {
    flags.push({
      code: "invalid_datetime",
      severity: "warning",
      field: "eventAtIso",
      message: "Data encontrada, mas nao foi possivel normalizar para ISO.",
    });
  }

  if (fields.stake.value == null && fields.stake.sourceText) {
    flags.push({
      code: "invalid_number",
      severity: "warning",
      field: "stake",
      message: "Stake encontrada, mas nao foi possivel converter para numero.",
    });
  }

  if (fields.odds.value == null && fields.odds.sourceText) {
    flags.push({
      code: "invalid_number",
      severity: "warning",
      field: "odds",
      message: "Odd encontrada, mas nao foi possivel converter para numero.",
    });
  }

  return flags;
}

function normaliseConfidence(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return null;
  }

  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function normaliseIsoDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function normaliseMode(value: string) {
  const normalised = value.trim().toLowerCase();
  if (normalised === "live" || normalised === "ao vivo") {
    return "live" as const;
  }

  if (normalised === "prelive" || normalised === "pre-live" || normalised === "prematch") {
    return "prelive" as const;
  }

  return null;
}
