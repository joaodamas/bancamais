import {
  emptyField,
  emptyFields,
  type ExtractedField,
  type OcrFieldName,
  type OcrReviewFlag,
  type ParseBetSlipResponse,
  type ProviderExtractedField,
  type ProviderOcrPayload,
  type SlipImagePayload,
} from "../contracts/ocr.js";

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
  payload: ProviderOcrPayload,
): ParseBetSlipResponse {
  const fields = emptyFields();

  fields.eventName = normalizeField(payload.fields.eventName, "string");
  fields.eventAtIso = normalizeField(payload.fields.eventAtIso, "string", normaliseIsoDate);
  fields.sport = normalizeField(payload.fields.sport, "string");
  fields.league = normalizeField(payload.fields.league, "string");
  fields.market = normalizeField(payload.fields.market, "string");
  fields.selection = normalizeField(payload.fields.selection, "string");
  fields.bookmakerName = normalizeField(payload.fields.bookmakerName, "string");
  fields.stake = normalizeField(payload.fields.stake, "number");
  fields.odds = normalizeField(payload.fields.odds, "number");
  fields.mode = normalizeField(payload.fields.mode, "string", normaliseMode);

  const reviewFlags = collectReviewFlags(fields);

  return {
    requestId,
    status: reviewFlags.length > 0 ? "needs_review" : "success",
    provider: "anthropic",
    extractedAt: new Date().toISOString(),
    slip: toSlipSummary(slip),
    fields,
    rawText: payload.rawText ?? null,
    reviewFlags,
  };
}

function toSlipSummary(slip: SlipImagePayload) {
  return {
    storagePath: slip.storagePath,
    contentType: slip.contentType,
    sizeBytes: slip.sizeBytes,
  };
}

function normalizeField<TInput, TOutput = TInput>(
  field: ProviderExtractedField<TInput> | undefined,
  expectedType: "string" | "number",
  transformer?: (value: TInput) => TOutput | null,
): ExtractedField<TOutput> {
  if (!field) {
    return emptyField<TOutput>();
  }

  const rawValue = field.value;
  if (rawValue == null) {
    return {
      value: null,
      confidence: normaliseConfidence(field.confidence),
      sourceText: field.sourceText ?? null,
    };
  }

  if (expectedType === "number" && typeof rawValue !== "number") {
    return {
      value: null,
      confidence: normaliseConfidence(field.confidence),
      sourceText: field.sourceText ?? null,
    };
  }

  if (expectedType === "string" && typeof rawValue !== "string") {
    return {
      value: null,
      confidence: normaliseConfidence(field.confidence),
      sourceText: field.sourceText ?? null,
    };
  }

  const transformedValue = transformer ? transformer(rawValue) : (rawValue as unknown as TOutput);

  return {
    value: transformedValue,
    confidence: normaliseConfidence(field.confidence),
    sourceText: field.sourceText ?? null,
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
