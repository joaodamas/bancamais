import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { CheckCircle2 } from "lucide-react";
import { auth } from "../lib/firebase";
import {
  buildOcrSubmissionMetadata,
  uploadAndParseBetSlip,
  type OcrFieldName,
  type OcrReviewFlag,
  type ParseBetSlipResponse,
} from "../lib/ocr";
import { LoadingSkeleton } from "./LoadingSkeleton";
import type {
  AppState,
  BetTemplate,
  NewBetDraft,
  NewBetFormValues,
  NewBetOcrFieldMeta,
  NewBetOcrFieldMetaMap,
  NewBetPrefill,
} from "../lib/types";
import { isSportsApiConfigured, searchFixtures, type FixtureSearchResult } from "../lib/sportsApi";
import { deriveBetSuggestions, leaguesForSport } from "../lib/betSuggestions";
import { calculateLedgerTotalBalance } from "../lib/ledger";
import { money } from "../lib/metrics";
import { canBuildTemplate } from "../services/template.service";
import { TemplateChip } from "./TemplateChip";

const DEFAULT_SPORTS = ["Futebol", "Basquete", "Tênis", "Esports", "Vôlei", "Hóquei", "Beisebol", "NFL", "MMA"];

interface NewBetProps {
  state: AppState;
  addBet: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onClose: () => void;
  prefill?: NewBetPrefill | null;
  draft?: NewBetDraft | null;
  onDraftChange?: (draft: NewBetDraft | null) => void;
  templates?: BetTemplate[];
  onSaveTemplate?: (name: string, values: NewBetFormValues) => void;
  onDeleteTemplate?: (id: string) => void;
}

type FormFieldName = keyof NewBetFormValues;
type OcrFieldMeta = NewBetOcrFieldMeta;
type OcrFieldMetaMap = NewBetOcrFieldMetaMap;

const initialFormValues: NewBetFormValues = {
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

export function NewBet({ state, addBet, onClose, prefill, draft, onDraftChange, templates = [], onSaveTemplate, onDeleteTemplate }: NewBetProps) {
  const [formValues, setFormValues] = useState<NewBetFormValues>(initialFormValues);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
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
  const lastHydratedDraftSignature = useRef<string | null>(null);
  const draftSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onDraftChangeRef = useRef(onDraftChange);
  const currentDraftRef = useRef<typeof currentDraft | null>(null);

  const selectedBookmakerName = useMemo(() => {
    const selectedBookmaker = state.bookmakers.find((book) => book.id === formValues.bookmakerId);
    return selectedBookmaker?.name ?? null;
  }, [formValues.bookmakerId, state.bookmakers]);

  // Autocomplete derivado do histórico (esporte/liga/mercado/seleção/tags)
  const betSuggestions = useMemo(() => deriveBetSuggestions(state), [state]);
  const sportOptions = useMemo(
    () => [...new Set([...betSuggestions.sports, ...DEFAULT_SPORTS])],
    [betSuggestions.sports],
  );
  const leagueOptions = useMemo(
    () => leaguesForSport(state, formValues.sport),
    [state, formValues.sport],
  );
  const bankroll = useMemo(() => calculateLedgerTotalBalance(state), [state]);

  function applyStakePercent(pct: number) {
    if (bankroll <= 0) return;
    const value = Math.round(bankroll * (pct / 100) * 100) / 100;
    setFieldValue("stake", String(value), { markReviewed: true });
  }

  function applyTemplate(template: BetTemplate) {
    setFormValues((prev) => ({ ...prev, ...template.partial }));
  }

  function handleSaveTemplate() {
    if (!onSaveTemplate || !canBuildTemplate(formValues)) return;
    onSaveTemplate(templateName, formValues);
    setTemplateName("");
    setSavingTemplate(false);
  }

  const baselineFormValues = useMemo<NewBetFormValues>(() => ({
    ...initialFormValues,
    ...(prefill ?? {}),
    bookmakerId: prefill?.bookmakerId ?? "",
    strategyId: prefill?.strategyId ?? "",
    stake: prefill?.stake ?? "",
    odds: prefill?.odds ?? "",
    closingOdds: prefill?.closingOdds ?? "",
    mode: prefill?.mode ?? "prelive",
    tags: prefill?.tags ?? "",
  }), [prefill]);

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

  const hasUnsavedProgress = useMemo(() => {
    const changedFields = (Object.keys(initialFormValues) as FormFieldName[]).some(
      (field) => formValues[field] !== baselineFormValues[field],
    );

    return (
      changedFields ||
      uploadedSlip !== null ||
      ocrResult !== null ||
      Object.keys(fieldOcrMeta).length > 0 ||
      ocrStatus !== "idle"
    );
  }, [baselineFormValues, fieldOcrMeta, formValues, ocrResult, ocrStatus, uploadedSlip]);

  const currentDraft = useMemo<NewBetDraft>(() => ({
    formValues,
    ocrStatus,
    ocrMessage,
    ocrWarnings,
    uploadedSlip,
    ocrResult,
    fieldOcrMeta,
  }), [fieldOcrMeta, formValues, ocrMessage, ocrResult, ocrStatus, ocrWarnings, uploadedSlip]);

  const currentDraftSignature = useMemo(() => JSON.stringify(currentDraft), [currentDraft]);

  onDraftChangeRef.current = onDraftChange;
  currentDraftRef.current = currentDraft;

  useEffect(() => {
    if (draft) {
      const incomingSignature = JSON.stringify(draft);
      if (incomingSignature === currentDraftSignature) return;
      if (incomingSignature === lastHydratedDraftSignature.current) return;

      lastHydratedDraftSignature.current = incomingSignature;
      setFormValues(draft.formValues);
      setUploadedSlip(draft.uploadedSlip);
      setOcrResult(draft.ocrResult);
      setFieldOcrMeta(draft.fieldOcrMeta);
      setOcrStatus(draft.ocrStatus);
      setOcrWarnings(draft.ocrWarnings);
      setOcrMessage(draft.ocrMessage);
      setShowSuggestions(false);
      setFixtureSuggestions([]);
      return;
    }

    if (!prefill) {
      setFormValues(initialFormValues);
      setShowSuggestions(false);
      setFixtureSuggestions([]);
      setUploadedSlip(null);
      setOcrResult(null);
      setFieldOcrMeta({});
      setOcrStatus("idle");
      setOcrWarnings([]);
      setOcrMessage("Selecione um print para tentar o preenchimento automatico.");
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
  }, [draft, prefill]);

  useEffect(() => {
    if (formValues.bookmakerId || state.bookmakers.length !== 1) return;

    setFormValues((current) => (
      current.bookmakerId
        ? current
        : { ...current, bookmakerId: state.bookmakers[0].id }
    ));
  }, [formValues.bookmakerId, state.bookmakers]);

  useEffect(() => {
    if (!onDraftChange) return;

    if (draftSyncTimerRef.current) clearTimeout(draftSyncTimerRef.current);
    draftSyncTimerRef.current = setTimeout(() => {
      onDraftChangeRef.current?.(currentDraftRef.current!);
    }, 250);

    return () => {
      if (draftSyncTimerRef.current) clearTimeout(draftSyncTimerRef.current);
    };
  }, [currentDraft, onDraftChange]);

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
      const nextValues: Partial<NewBetFormValues> = {};
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

  function getFieldStateClass(field: FormFieldName) {
    const meta = fieldOcrMeta[field];
    if (!meta) return "";
    if (meta.reviewedManually) return " nb-field-reviewed";
    if (!meta.requiresReview) return " nb-field-autofilled";
    return " nb-field-warning";
  }

  function renderFieldLabel(label: string, field?: FormFieldName) {
    const meta = field ? fieldOcrMeta[field] : undefined;
    const showSuccess = meta ? (!meta.requiresReview || meta.reviewedManually) : false;

    return (
      <span className="nb-label-row">
        <span>{label}</span>
        {showSuccess && <CheckCircle2 size={12} className="nb-label-check" aria-hidden="true" />}
      </span>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    setShowSuggestions(false);
    await addBet(event);
  }

  function handleCloseRequest() {
    if (
      hasUnsavedProgress &&
      !window.confirm("Existem dados preenchidos neste modal, incluindo leitura de OCR. Fechar agora descartara esse progresso. Deseja continuar?")
    ) {
      return;
    }

    onClose();
  }

  return (
    <div className="modal-overlay">
      {ocrStatus === "loading" && (
        <div className="nb-ocr-overlay" role="status" aria-live="polite">
          <div className="nb-ocr-overlay-card">
            <span className="nb-ocr-spinner" aria-hidden="true" />
            <strong>Lendo o bilhete…</strong>
            <span>{ocrMessage}</span>
          </div>
        </div>
      )}
      <div className="modal-panel modal-wide" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={handleCloseRequest} type="button">×</button>
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

          {(templates.length > 0 || onSaveTemplate) && (
            <div className="nb-templates">
              <span className="nb-templates-label">Templates</span>
              <div className="nb-templates-list">
                {templates.map((t) => (
                  <TemplateChip
                    key={t.id}
                    name={t.name}
                    onApply={() => applyTemplate(t)}
                    onDelete={onDeleteTemplate ? () => onDeleteTemplate(t.id) : undefined}
                  />
                ))}
                {onSaveTemplate && (
                  savingTemplate ? (
                    <span className="nb-template-save">
                      <input
                        autoFocus
                        placeholder="Nome do template"
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") { e.preventDefault(); handleSaveTemplate(); }
                          if (e.key === "Escape") { setSavingTemplate(false); setTemplateName(""); }
                        }}
                      />
                      <button type="button" className="nb-template-save-ok" onClick={handleSaveTemplate} disabled={!canBuildTemplate(formValues)}>Salvar</button>
                      <button type="button" className="nb-template-save-cancel" onClick={() => { setSavingTemplate(false); setTemplateName(""); }} aria-label="Cancelar">×</button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="nb-template-add"
                      onClick={() => setSavingTemplate(true)}
                      disabled={!canBuildTemplate(formValues)}
                      title={canBuildTemplate(formValues) ? "Salvar os campos atuais como template" : "Preencha esporte, mercado ou casa para salvar um template"}
                    >
                      + Salvar atual
                    </button>
                  )
                )}
              </div>
            </div>
          )}

          <div className="nb-section nb-ocr-section full">
            <div className="nb-section-head">
              <span className="nb-section-label">Bilhete</span>
              <span className="nb-section-title">Comprovante e leitura automática</span>
            </div>
            <div className="nb-section-body nb-row-1">
              <div className="dropzone">
                <strong>Cole, arraste ou selecione o print do bilhete</strong>
                <span>Anexe o comprovante para manter o registro completo da entrada.</span>
                <input accept="image/*" name="slip" type="file" onChange={handleSlipChange} />
                <div className={`ocr-feedback ocr-feedback-${ocrStatus}`} role="status" aria-live="polite">
                  <strong>{ocrStatus === "loading" ? "Leitura em andamento" : "Leitura do bilhete"}</strong>
                  <span>{ocrMessage}</span>
                  {ocrStatus === "loading" && (
                    <div className="ocr-skeleton-grid" aria-hidden="true">
                      <LoadingSkeleton lines={1} height={14} />
                      <LoadingSkeleton lines={3} height={12} />
                    </div>
                  )}
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
            </div>
          </div>

          <div className="nb-section full">
            <div className="nb-section-head">
              <span className="nb-section-label">Evento</span>
              <span className="nb-section-title">Partida e contexto esportivo</span>
            </div>
            <div className="nb-section-body nb-row-1">
              <label className="nb-event-search">
                {renderFieldLabel("Evento", "eventName")}
                {isSportsApiConfigured() && (
                  <span className="fixture-search-hint">
                    {isSearching ? "Buscando..." : "Digite o nome de um time para sugestões"}
                  </span>
                )}
                <input
                  className={getFieldStateClass("eventName")}
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
              <div className="nb-inline-grid nb-inline-grid-3">
                <label>
                  {renderFieldLabel("Data do evento", "eventAt")}
                  <input className={getFieldStateClass("eventAt")} name="eventAt" required type="datetime-local" value={formValues.eventAt} onChange={handleTextInput("eventAt")} />
                  {renderOcrFieldMeta("eventAt")}
                </label>
                <label>
                  {renderFieldLabel("Esporte", "sport")}
                  <input className={getFieldStateClass("sport")} name="sport" required placeholder="Futebol" value={formValues.sport} onChange={handleTextInput("sport")} list="nb-sport-options" autoComplete="off" />
                  <datalist id="nb-sport-options">{sportOptions.map((s) => <option key={s} value={s} />)}</datalist>
                  {renderOcrFieldMeta("sport")}
                </label>
                <label>
                  {renderFieldLabel("Liga", "league")}
                  <input className={getFieldStateClass("league")} name="league" required placeholder="UCL" value={formValues.league} onChange={handleTextInput("league")} list="nb-league-options" autoComplete="off" />
                  <datalist id="nb-league-options">{leagueOptions.map((l) => <option key={l} value={l} />)}</datalist>
                  {renderOcrFieldMeta("league")}
                </label>
              </div>
            </div>
          </div>

          <div className="nb-section full">
            <div className="nb-section-head">
              <span className="nb-section-label">Mercado</span>
              <span className="nb-section-title">Tipo de aposta e seleção</span>
            </div>
            <div className="nb-section-body nb-row-2">
              <label>
                {renderFieldLabel("Mercado", "market")}
                <input className={getFieldStateClass("market")} name="market" required placeholder="Total de gols" value={formValues.market} onChange={handleTextInput("market")} list="nb-market-options" autoComplete="off" />
                <datalist id="nb-market-options">{betSuggestions.markets.map((m) => <option key={m} value={m} />)}</datalist>
                {renderOcrFieldMeta("market")}
              </label>
              <label>
                {renderFieldLabel("Seleção", "selection")}
                <input className={getFieldStateClass("selection")} name="selection" required placeholder="Over 2.5 gols" value={formValues.selection} onChange={handleTextInput("selection")} list="nb-selection-options" autoComplete="off" />
                <datalist id="nb-selection-options">{betSuggestions.selections.map((s) => <option key={s} value={s} />)}</datalist>
                {renderOcrFieldMeta("selection")}
              </label>
            </div>
          </div>

          <div className="nb-section full">
            <div className="nb-section-head">
              <span className="nb-section-label">Execução</span>
              <span className="nb-section-title">Casa, stake e precificação</span>
            </div>
            <div className="nb-section-body nb-row-1">
              <div className="nb-inline-grid nb-inline-grid-2">
                <label>
                  {renderFieldLabel("Casa", "bookmakerId")}
                  <select className={getFieldStateClass("bookmakerId")} name="bookmakerId" required value={formValues.bookmakerId} onChange={handleTextInput("bookmakerId")}>
                    <option value="" disabled={state.bookmakers.length > 0}>Selecione uma casa</option>
                    {state.bookmakers.length === 0 && <option value="">Cadastre uma casa primeiro</option>}
                    {state.bookmakers.map((book) => <option key={book.id} value={book.id}>{book.name}</option>)}
                  </select>
                  {renderOcrFieldMeta("bookmakerId")}
                </label>
                <label>
                  {renderFieldLabel("Estratégia")}
                  <select name="strategyId" value={formValues.strategyId} onChange={handleTextInput("strategyId")}>
                    <option value="">Sem estrategia</option>
                    {state.strategies.map((strategy) => <option key={strategy.id} value={strategy.id}>{strategy.name}</option>)}
                  </select>
                </label>
              </div>
              <div className="nb-inline-grid nb-inline-grid-3">
                <label>
                  {renderFieldLabel("Stake", "stake")}
                  <input className={getFieldStateClass("stake")} name="stake" required min="1" step="0.01" type="number" placeholder="250" value={formValues.stake} onChange={handleTextInput("stake")} />
                  {bankroll > 0 && (
                    <div className="nb-stake-pct">
                      <span className="nb-stake-pct-label">% da banca</span>
                      {[1, 2, 3, 5].map((p) => (
                        <button key={p} type="button" className="nb-stake-pct-chip" onClick={() => applyStakePercent(p)}>
                          {p}%
                        </button>
                      ))}
                      <span className="nb-stake-pct-hint">de {money.format(bankroll)}</span>
                    </div>
                  )}
                  {renderOcrFieldMeta("stake")}
                </label>
                <label>
                  {renderFieldLabel("Odd", "odds")}
                  <input className={getFieldStateClass("odds")} name="odds" required min="1.01" step="0.01" type="number" placeholder="1.92" value={formValues.odds} onChange={handleTextInput("odds")} />
                  {renderOcrFieldMeta("odds")}
                </label>
                <label>
                  {renderFieldLabel("Odd fechamento")}
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
              </div>
            </div>
          </div>

          <div className="nb-section full">
            <div className="nb-section-head">
              <span className="nb-section-label">Contexto</span>
              <span className="nb-section-title">Modo e classificação</span>
            </div>
            <div className="nb-section-body nb-row-2">
              <label>
                {renderFieldLabel("Modo", "mode")}
                <select className={getFieldStateClass("mode")} name="mode" value={formValues.mode} onChange={handleTextInput("mode")}>
                  <option value="prelive">Pre-live</option>
                  <option value="live">Live</option>
                </select>
                {renderOcrFieldMeta("mode")}
              </label>
              <label>
                {renderFieldLabel("Tags")}
                <input name="tags" placeholder="euro, overgols, prelive" value={formValues.tags} onChange={handleTextInput("tags")} />
              </label>
            </div>
          </div>

          <div className="form-actions">
            <span>
              {state.bookmakers.length === 0
                ? "Cadastre uma casa em Bancas & Casas antes de registrar apostas."
                : pendingReviewCount > 0
                    ? `OCR marcou ${pendingReviewCount} campo(s) para revisao antes do submit.`
                    : "Revise os dados antes de confirmar a entrada."}
            </span>
            <button
              className="primary"
              type="submit"
              disabled={state.bookmakers.length === 0}
            >
              Salvar aposta
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
