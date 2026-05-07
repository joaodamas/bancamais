import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { auth } from "../lib/firebase";
import {
  buildOcrSubmissionMetadata,
  uploadAndParseBetSlip,
  type OcrFieldName,
  type OcrReviewFlag,
  type ParseBetSlipResponse,
} from "../lib/ocr";
import type { AppState, NewBetPrefill } from "../lib/types";
import { isSportsApiConfigured, searchFixtures, type FixtureSearchResult } from "../lib/sportsApi";

interface NewBetProps {
  state: AppState;
  addBet: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onClose: () => void;
  prefill?: NewBetPrefill | null;
}

interface BetFormValues {
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
  mode: "prelive" | "live";
  tags: string;
}

type FormFieldName = keyof BetFormValues;

interface OcrFieldMeta {
  ocrField: OcrFieldName;
  confidence: number | null;
  sourceText: string | null;
  extractedValue: string | number | null;
  warnings: string[];
  requiresReview: boolean;
  reviewedManually: boolean;
}

type OcrFieldMetaMap = Partial<Record<FormFieldName, OcrFieldMeta>>;

const initialFormValues: BetFormValues = {
  eventName: "",
  eventAt: "",
  sport: "",
  league: "",
  market: "",
  selection: "",
  bookmakerId: "",
  strategyId: "",
  stake: "",
  odds: "",
  closingOdds: "",
  mode: "prelive",
  tags: "",
};

const ocrFieldToFormField: Record<OcrFieldName, FormFieldName> = {
  eventName: "eventName",
  eventAtIso: "eventAt",
  sport: "sport",
  league: "league",
  market: "market",
  selection: "selection",
  bookmakerName: "bookmakerId",
  stake: "stake",
  odds: "odds",
  mode: "mode",
};

function toDatetimeLocal(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function toIsoDatetime(value: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function toPercentLabel(confidence: number | null) {
  if (confidence == null) return "sem score";
  return `${Math.round(confidence * 100)}%`;
}

function getConfidenceTone(confidence: number | null) {
  if (confidence == null) return "muted";
  if (confidence >= 0.85) return "high";
  if (confidence >= 0.65) return "medium";
  return "low";
}

function isReviewFlagForField(flag: OcrReviewFlag, field: OcrFieldName) {
  return flag.field === field;
}

export function NewBet({ state, addBet, onClose, prefill }: NewBetProps) {
  const [formValues, setFormValues] = useState<BetFormValues>(initialFormValues);
  const [fixtureSuggestions, setFixtureSuggestions] = useState<FixtureSearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [ocrStatus, setOcrStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [ocrMessage, setOcrMessage] = useState("Selecione um print para tentar o preenchimento automatico.");
  const [ocrWarnings, setOcrWarnings] = useState<string[]>([]);
  const [uploadedSlip, setUploadedSlip] = useState<{ path: string; url: string } | null>(null);
  const [ocrResult, setOcrResult] = useState<ParseBetSlipResponse | null>(null);
  const [fieldOcrMeta, setFieldOcrMeta] = useState<OcrFieldMetaMap>({});
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedBookmakerName = useMemo(() => {
    const selectedBookmaker = state.bookmakers.find((book) => book.id === formValues.bookmakerId);
    return selectedBookmaker?.name ?? null;
  }, [formValues.bookmakerId, state.bookmakers]);

  const reviewedOcrFields = useMemo(() => {
    return Object.values(fieldOcrMeta).reduce<Partial<Record<OcrFieldName, boolean>>>((acc, meta) => {
      if (meta?.reviewedManually) acc[meta.ocrField] = true;
      return acc;
    }, {});
  }, [fieldOcrMeta]);

  const ocrMetadataPayload = useMemo(() => {
    return buildOcrSubmissionMetadata(
      ocrResult,
      {
        eventName: formValues.eventName || null,
        eventAtIso: toIsoDatetime(formValues.eventAt),
        sport: formValues.sport || null,
        league: formValues.league || null,
        market: formValues.market || null,
        selection: formValues.selection || null,
        bookmakerName: selectedBookmakerName,
        stake: formValues.stake || null,
        odds: formValues.odds || null,
        mode: formValues.mode || null,
      },
      reviewedOcrFields,
      uploadedSlip,
    );
  }, [formValues, ocrResult, reviewedOcrFields, selectedBookmakerName, uploadedSlip]);

  const reviewedFieldCount = useMemo(() => {
    return Object.values(fieldOcrMeta).filter((meta) => meta?.reviewedManually).length;
  }, [fieldOcrMeta]);

  const pendingReviewCount = useMemo(() => {
    return Object.values(fieldOcrMeta).filter((meta) => meta && meta.requiresReview && !meta.reviewedManually).length;
  }, [fieldOcrMeta]);

  useEffect(() => {
    if (!prefill) {
      setFormValues(initialFormValues);
      return;
    }

    setFormValues({
      ...initialFormValues,
      ...prefill,
      bookmakerId: prefill.bookmakerId ?? "",
      strategyId: prefill.strategyId ?? "",
      stake: prefill.stake ?? "",
      odds: prefill.odds ?? "",
      closingOdds: prefill.closingOdds ?? "",
      mode: prefill.mode ?? "prelive",
      tags: prefill.tags ?? "",
    });
    setShowSuggestions(false);
    setFixtureSuggestions([]);
    setUploadedSlip(null);
    setOcrResult(null);
    setFieldOcrMeta({});
    setOcrStatus("idle");
    setOcrWarnings([]);
    setOcrMessage("Sugestao aplicada. Revise stake, casa e contexto antes de salvar.");
  }, [prefill]);

  function setFieldValue(field: FormFieldName, value: string, options?: { markReviewed?: boolean }) {
    setFormValues((current) => ({ ...current, [field]: value }));

    if (!options?.markReviewed) return;

    setFieldOcrMeta((current) => {
      const meta = current[field];
      if (!meta || meta.reviewedManually) return current;
      return {
        ...current,
        [field]: {
          ...meta,
          reviewedManually: true,
        },
      };
    });
  }

  function handleTextInput(field: FormFieldName) {
    return (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setFieldValue(field, event.target.value, { markReviewed: true });
    };
  }

  function handleEventSearch(value: string) {
    setFieldValue("eventName", value, { markReviewed: true });

    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (value.length < 3 || !isSportsApiConfigured()) {
      setFixtureSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    searchTimer.current = setTimeout(async () => {
      setIsSearching(true);
      const results = await searchFixtures(value);
      setFixtureSuggestions(results);
      setShowSuggestions(results.length > 0);
      setIsSearching(false);
    }, 400);
  }

  function selectFixture(result: FixtureSearchResult) {
    const fixture = result.fixture;
    const localDate = toDatetimeLocal(fixture.date);

    setFieldValue("eventName", `${fixture.homeTeam} x ${fixture.awayTeam}`, { markReviewed: true });
    if (localDate) setFieldValue("eventAt", localDate, { markReviewed: true });
    setFieldValue("sport", "Futebol", { markReviewed: true });
    setFieldValue("league", fixture.league, { markReviewed: true });
    setShowSuggestions(false);
    setFixtureSuggestions([]);
  }

  function applyBookmakerSelection(bookmakerName: string | null) {
    if (!bookmakerName) return null;

    const normalized = bookmakerName.trim().toLowerCase();
    const exact = state.bookmakers.find((book) => book.name.trim().toLowerCase() === normalized);
    const partial = state.bookmakers.find((book) => {
      const candidate = book.name.trim().toLowerCase();
      return candidate.includes(normalized) || normalized.includes(candidate);
    });

    return exact ?? partial ?? null;
  }

  function buildFieldMeta(
    ocr: ParseBetSlipResponse,
    extraWarnings: Partial<Record<FormFieldName, string[]>>,
  ) {
    const nextMeta: OcrFieldMetaMap = {};

    (Object.keys(ocrFieldToFormField) as OcrFieldName[]).forEach((ocrFieldName) => {
      const formField = ocrFieldToFormField[ocrFieldName];
      const extractedField = ocr.fields[ocrFieldName];
      const warnings = [
        ...ocr.reviewFlags.filter((flag) => isReviewFlagForField(flag, ocrFieldName)).map((flag) => flag.message),
        ...(extraWarnings[formField] ?? []),
      ];

      if (extractedField.value == null && extractedField.confidence == null && warnings.length === 0) {
        return;
      }

      nextMeta[formField] = {
        ocrField: ocrFieldName,
        confidence: extractedField.confidence,
        sourceText: extractedField.sourceText,
        extractedValue: extractedField.value,
        warnings,
        requiresReview:
          warnings.length > 0 ||
          ocr.status === "needs_review" ||
          (extractedField.confidence != null && extractedField.confidence < 0.85),
        reviewedManually: false,
      };
    });

    return nextMeta;
  }

  async function handleSlipChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      setOcrStatus("idle");
      setOcrMessage("Selecione um print para tentar o preenchimento automatico.");
      setOcrWarnings([]);
      setUploadedSlip(null);
      setOcrResult(null);
      setFieldOcrMeta({});
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      setUploadedSlip(null);
      setOcrResult(null);
      setFieldOcrMeta({});
      setOcrStatus("error");
      setOcrMessage("Sem conta conectada, o preenchimento automatico fica indisponivel neste momento.");
      setOcrWarnings(["A aposta ainda pode ser salva normalmente, sem anexar o bilhete na nuvem."]);
      return;
    }

    setOcrStatus("loading");
    setOcrMessage("Enviando print e lendo campos do bilhete...");
    setOcrWarnings([]);

    try {
      const { upload, ocr } = await uploadAndParseBetSlip(user.uid, file);
      const nextValues: Partial<BetFormValues> = {};
      const extraWarnings: Partial<Record<FormFieldName, string[]>> = {};
      const generalWarnings = ocr.reviewFlags.filter((flag) => !flag.field).map((flag) => flag.message);
      const fieldsFilled: string[] = [];

      setUploadedSlip(upload);
      setOcrResult(ocr);

      if (ocr.fields.eventName.value) {
        nextValues.eventName = ocr.fields.eventName.value;
        fieldsFilled.push("evento");
      }

      if (ocr.fields.eventAtIso.value) {
        const localValue = toDatetimeLocal(ocr.fields.eventAtIso.value);
        if (localValue) {
          nextValues.eventAt = localValue;
          fieldsFilled.push("data");
        } else {
          extraWarnings.eventAt = ["OCR identificou uma data invalida. Revise manualmente."];
        }
      }

      if (ocr.fields.sport.value) {
        nextValues.sport = ocr.fields.sport.value;
        fieldsFilled.push("esporte");
      }

      if (ocr.fields.league.value) {
        nextValues.league = ocr.fields.league.value;
        fieldsFilled.push("liga");
      }

      if (ocr.fields.market.value) {
        nextValues.market = ocr.fields.market.value;
        fieldsFilled.push("mercado");
      }

      if (ocr.fields.selection.value) {
        nextValues.selection = ocr.fields.selection.value;
        fieldsFilled.push("selecao");
      }

      if (ocr.fields.stake.value != null) {
        nextValues.stake = String(ocr.fields.stake.value);
        fieldsFilled.push("stake");
      }

      if (ocr.fields.odds.value != null) {
        nextValues.odds = String(ocr.fields.odds.value);
        fieldsFilled.push("odd");
      }

      if (ocr.fields.mode.value) {
        nextValues.mode = ocr.fields.mode.value;
        fieldsFilled.push("modo");
      }

      const matchedBookmaker = applyBookmakerSelection(ocr.fields.bookmakerName.value);
      if (matchedBookmaker) {
        nextValues.bookmakerId = matchedBookmaker.id;
        fieldsFilled.push("casa");
      } else if (ocr.fields.bookmakerName.value) {
        extraWarnings.bookmakerId = [
          `Casa detectada no OCR: ${ocr.fields.bookmakerName.value}. Revise a selecao manualmente.`,
        ];
      }

      if (ocr.status === "failed" || ocr.status === "not_configured") {
        setFieldOcrMeta(buildFieldMeta(ocr, extraWarnings));
        setOcrStatus("error");
        setOcrMessage("Nao foi possivel preencher automaticamente este bilhete.");
        setOcrWarnings(
          generalWarnings.length > 0
            ? generalWarnings
            : ["Revise o formulario manualmente."],
        );
        return;
      }

      setFormValues((current) => ({ ...current, ...nextValues }));
      setFieldOcrMeta(buildFieldMeta(ocr, extraWarnings));
      setOcrStatus("done");
      setOcrMessage(
        fieldsFilled.length > 0
          ? `OCR aplicou: ${fieldsFilled.join(", ")}. Revise antes de salvar.`
          : "OCR concluido sem campos confiaveis para aplicar.",
      );
      setOcrWarnings(generalWarnings);
    } catch (error) {
      setUploadedSlip(null);
      setOcrResult(null);
      setFieldOcrMeta({});
      setOcrStatus("error");
      setOcrMessage(error instanceof Error ? error.message : "Falha ao processar o bilhete.");
      setOcrWarnings(["O upload do submit continua normal, mas o preenchimento automatico falhou nesta tentativa."]);
    }
  }

  function renderOcrFieldMeta(field: FormFieldName) {
    const meta = fieldOcrMeta[field];
    if (!meta) return null;

    const tone = meta.reviewedManually ? "reviewed" : meta.requiresReview ? "warning" : "ok";
    const sourceText = meta.sourceText?.trim();

    return (
      <div className={`ocr-field-meta ocr-field-meta-${tone}`}>
        <div className="ocr-field-meta-head">
          <strong>OCR {toPercentLabel(meta.confidence)}</strong>
          <span className={`ocr-confidence ocr-confidence-${getConfidenceTone(meta.confidence)}`}>
            {meta.reviewedManually ? "Revisado manualmente" : meta.requiresReview ? "Revisar" : "Conferido"}
          </span>
        </div>
        {meta.warnings.length > 0 && (
          <ul className="ocr-field-meta-list">
            {meta.warnings.map((warning) => <li key={`${field}-${warning}`}>{warning}</li>)}
          </ul>
        )}
        {sourceText && (
          <small className="ocr-field-source">Trecho lido: "{sourceText}"</small>
        )}
      </div>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    setShowSuggestions(false);
    await addBet(event);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={onClose} type="button">×</button>
        <h2>Nova Aposta</h2>
        <form className="form" onSubmit={handleSubmit}>
          <input type="hidden" name="uploadedSlipImagePath" value={uploadedSlip?.path ?? ""} />
          <input type="hidden" name="uploadedSlipImageUrl" value={uploadedSlip?.url ?? ""} />
          <input type="hidden" name="ocrRequestId" value={ocrResult?.requestId ?? ""} />
          <input type="hidden" name="ocrStatus" value={ocrResult?.status ?? ""} />
          <input type="hidden" name="ocrProvider" value={ocrResult?.provider ?? ""} />
          <input type="hidden" name="ocrMetadata" value={ocrMetadataPayload} />
          <input type="hidden" name="suggestionId" value={prefill?.suggestionId ?? ""} />
          <input type="hidden" name="fixtureId" value={prefill?.fixtureId ?? ""} />
          <input type="hidden" name="estimatedProbability" value={prefill?.estimatedProbability ?? ""} />
          <input type="hidden" name="estimatedEdge" value={prefill?.estimatedEdge ?? ""} />
          <input type="hidden" name="suggestionConfidenceScore" value={prefill?.confidenceScore ?? ""} />

          <div className="form-section-title full">
            <span>Entrada</span>
            <strong>Comprovante e leitura do evento</strong>
          </div>

          <div className="dropzone full">
            <strong>Cole, arraste ou selecione o print do bilhete</strong>
            <span>Anexe o comprovante para manter o registro completo da entrada.</span>
            <input accept="image/*" name="slip" type="file" onChange={handleSlipChange} />
            <div className={`ocr-feedback ocr-feedback-${ocrStatus}`} role="status" aria-live="polite">
              <strong>{ocrStatus === "loading" ? "Leitura em andamento" : "Leitura do bilhete"}</strong>
              <span>{ocrMessage}</span>
              {(ocrResult || Object.keys(fieldOcrMeta).length > 0) && (
                <div className="ocr-feedback-summary">
                  <span>{Object.keys(fieldOcrMeta).length} campo(s) sinalizado(s) pelo OCR</span>
                  <span>{pendingReviewCount} pendente(s) de revisao</span>
                  <span>{reviewedFieldCount} revisado(s) manualmente</span>
                </div>
              )}
              {ocrWarnings.length > 0 && (
                <ul className="ocr-feedback-list">
                  {ocrWarnings.map((warning) => <li key={warning}>{warning}</li>)}
                </ul>
              )}
            </div>
          </div>

          <label className="full" style={{ position: "relative" }}>
            Evento
            {isSportsApiConfigured() && (
              <span className="fixture-search-hint">
                {isSearching ? "Buscando..." : "Digite o nome de um time para sugestões"}
              </span>
            )}
            <input
              name="eventName"
              required
              placeholder="Real Madrid x Manchester City"
              value={formValues.eventName}
              onChange={(event) => handleEventSearch(event.target.value)}
              onFocus={() => fixtureSuggestions.length > 0 && setShowSuggestions(true)}
              autoComplete="off"
            />
            {showSuggestions && fixtureSuggestions.length > 0 && (
              <ul className="fixture-suggestions">
                {fixtureSuggestions.map((result) => (
                  <li key={result.fixture.id} onClick={() => selectFixture(result)}>
                    <div className="fixture-suggestion-teams">
                      {result.fixture.homeLogo && (
                        <img src={result.fixture.homeLogo} alt="" width={16} height={16} />
                      )}
                      <span>{result.fixture.homeTeam} x {result.fixture.awayTeam}</span>
                      {result.fixture.awayLogo && (
                        <img src={result.fixture.awayLogo} alt="" width={16} height={16} />
                      )}
                    </div>
                    <div className="fixture-suggestion-meta">
                      {result.fixture.league} ·{" "}
                      {new Date(result.fixture.date).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {renderOcrFieldMeta("eventName")}
          </label>

          <div className="form-section-title full">
            <span>Mercado</span>
            <strong>Dados principais da aposta</strong>
          </div>

          <label>
            Data do evento
            <input name="eventAt" required type="datetime-local" value={formValues.eventAt} onChange={handleTextInput("eventAt")} />
            {renderOcrFieldMeta("eventAt")}
          </label>
          <label>
            Esporte
            <input name="sport" required placeholder="Futebol" value={formValues.sport} onChange={handleTextInput("sport")} />
            {renderOcrFieldMeta("sport")}
          </label>
          <label>
            Liga
            <input name="league" required placeholder="UCL" value={formValues.league} onChange={handleTextInput("league")} />
            {renderOcrFieldMeta("league")}
          </label>
          <label>
            Mercado
            <input name="market" required placeholder="Total de gols" value={formValues.market} onChange={handleTextInput("market")} />
            {renderOcrFieldMeta("market")}
          </label>
          <label>
            Selecao
            <input name="selection" required placeholder="Over 2.5 gols" value={formValues.selection} onChange={handleTextInput("selection")} />
            {renderOcrFieldMeta("selection")}
          </label>

          <div className="form-section-title full">
            <span>Execucao</span>
            <strong>Casa, stake e precificacao</strong>
          </div>

          <label>
            Casa
            <select name="bookmakerId" required value={formValues.bookmakerId} onChange={handleTextInput("bookmakerId")}>
              <option value="" disabled={state.bookmakers.length > 0}>Selecione uma casa</option>
              {state.bookmakers.length === 0 && <option value="">Cadastre uma casa primeiro</option>}
              {state.bookmakers.map((book) => <option key={book.id} value={book.id}>{book.name}</option>)}
            </select>
            {renderOcrFieldMeta("bookmakerId")}
          </label>
          <label>
            Estrategia
            <select name="strategyId" value={formValues.strategyId} onChange={handleTextInput("strategyId")}>
              <option value="">Sem estrategia</option>
              {state.strategies.map((strategy) => <option key={strategy.id} value={strategy.id}>{strategy.name}</option>)}
            </select>
          </label>
          <label>
            Stake
            <input name="stake" required min="1" step="0.01" type="number" placeholder="250" value={formValues.stake} onChange={handleTextInput("stake")} />
            {renderOcrFieldMeta("stake")}
          </label>
          <label>
            Odd
            <input name="odds" required min="1.01" step="0.01" type="number" placeholder="1.92" value={formValues.odds} onChange={handleTextInput("odds")} />
            {renderOcrFieldMeta("odds")}
          </label>
          <label>
            Odd fechamento
            <input
              name="closingOdds"
              min="1.01"
              step="0.01"
              type="number"
              placeholder="1.83"
              value={formValues.closingOdds}
              onChange={handleTextInput("closingOdds")}
            />
          </label>

          <div className="form-section-title full">
            <span>Contexto</span>
            <strong>Classificacao e analise posterior</strong>
          </div>

          <label>
            Modo
            <select name="mode" value={formValues.mode} onChange={handleTextInput("mode")}>
              <option value="prelive">Pre-live</option>
              <option value="live">Live</option>
            </select>
            {renderOcrFieldMeta("mode")}
          </label>
          <label className="full">
            Tags
            <input name="tags" placeholder="euro, overgols, prelive" value={formValues.tags} onChange={handleTextInput("tags")} />
          </label>

          <div className="form-actions">
            <span>
              {state.bookmakers.length === 0
                ? "Cadastre uma casa em Bancas & Casas antes de registrar apostas."
                : pendingReviewCount > 0
                  ? `OCR marcou ${pendingReviewCount} campo(s) para revisao antes do submit.`
                  : "Revise os dados antes de confirmar a entrada."}
            </span>
            <button className="primary" type="submit" disabled={state.bookmakers.length === 0}>Salvar aposta</button>
          </div>
        </form>
      </div>
    </div>
  );
}
