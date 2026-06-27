import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Zap, ChevronRight, ScanLine, Loader2 } from "lucide-react";
import type { AppState, BetStatus } from "../lib/types";
import { money } from "../lib/metrics";
import { uploadAndParseBetSlip, buildOcrSubmissionMetadata, type ParseBetSlipResponse } from "../lib/ocr";

interface QuickBetProps {
  state: AppState;
  userId?: string | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onClose: () => void;
  onSwitchToFull: () => void;
}

type SettleStatus = Extract<BetStatus, "pending" | "won" | "lost" | "cashout" | "void">;

const STATUS_OPTIONS: { value: SettleStatus; label: string }[] = [
  { value: "pending", label: "Pendente" },
  { value: "won", label: "Ganha" },
  { value: "lost", label: "Perdida" },
  { value: "cashout", label: "Cashout" },
  { value: "void", label: "Reembolso" },
];

/** Datetime-local no fuso local, formato yyyy-MM-ddTHH:mm. */
function nowLocalInput(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

/**
 * Modo Rápido de registro de aposta.
 * Fluxo linear por Tab/Enter: Evento → Stake → Odd → Casa → [Salvar]
 * Suporta OCR leve (escanear print) e liquidação imediata (status + cashout).
 */
export function QuickBet({ state, userId, onSubmit, onClose, onSwitchToFull }: QuickBetProps) {
  const [submitting, setSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Refs dos campos para navegação por Enter e preenchimento via OCR
  const eventRef = useRef<HTMLInputElement>(null);
  const eventAtRef = useRef<HTMLInputElement>(null);
  const stakeRef = useRef<HTMLInputElement>(null);
  const oddsRef = useRef<HTMLInputElement>(null);
  const bookmakerRef = useRef<HTMLSelectElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [stake, setStake] = useState("");
  const [odds, setOdds] = useState("");
  const [status, setStatus] = useState<SettleStatus>("pending");
  const [cashoutAmount, setCashoutAmount] = useState("");

  // OCR
  const [ocrState, setOcrState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [ocrMessage, setOcrMessage] = useState("");
  const [ocrMeta, setOcrMeta] = useState("");
  const [slipPath, setSlipPath] = useState("");
  const [slipUrl, setSlipUrl] = useState("");

  function focusNext(current: "event" | "stake" | "odds" | "bookmaker") {
    const map = { event: stakeRef, stake: oddsRef, odds: bookmakerRef, bookmaker: submitRef };
    map[current].current?.focus();
  }

  function handleKeyDown(field: "event" | "stake" | "odds" | "bookmaker") {
    return (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        focusNext(field);
      }
    };
  }

  function applyOcr(ocr: ParseBetSlipResponse, upload: { path: string; url: string }) {
    const f = ocr.fields;
    if (f.eventName.value && eventRef.current) eventRef.current.value = f.eventName.value;
    if (f.eventAtIso.value && eventAtRef.current) {
      const local = isoToLocalInput(f.eventAtIso.value);
      if (local) eventAtRef.current.value = local;
    }
    if (typeof f.stake.value === "number" && f.stake.value > 0) setStake(String(f.stake.value));
    if (typeof f.odds.value === "number" && f.odds.value > 1) setOdds(String(f.odds.value));
    if (f.bookmakerName.value && bookmakerRef.current) {
      const match = state.bookmakers.find(
        (b) => b.name.toLowerCase() === String(f.bookmakerName.value).toLowerCase(),
      );
      if (match) bookmakerRef.current.value = match.id;
    }

    const currentValues = {
      eventName: f.eventName.value,
      eventAtIso: f.eventAtIso.value,
      stake: f.stake.value,
      odds: f.odds.value,
      bookmakerName: f.bookmakerName.value,
    };
    setOcrMeta(buildOcrSubmissionMetadata(ocr, currentValues, {}, upload));
    setSlipPath(upload.path);
    setSlipUrl(upload.url);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !userId) return;
    setOcrState("loading");
    setOcrMessage("Lendo o print...");
    try {
      const { ocr, upload } = await uploadAndParseBetSlip(userId, file);
      applyOcr(ocr, upload);
      setOcrState("done");
      setOcrMessage("Campos preenchidos pelo print. Confira antes de salvar.");
    } catch {
      setOcrState("error");
      setOcrMessage("Não foi possível ler o print. Preencha manualmente.");
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(e);
    } finally {
      setSubmitting(false);
    }
  }

  const potentialReturn = Number(stake) > 0 && Number(odds) > 1
    ? Number(stake) * Number(odds)
    : null;

  // Retorno efetivo conforme o status escolhido (para feedback imediato)
  const settledReturn = (() => {
    if (status === "pending" || potentialReturn === null) return null;
    if (status === "won") return potentialReturn;
    if (status === "void") return Number(stake);
    if (status === "cashout") return Number(cashoutAmount) > 0 ? Number(cashoutAmount) : potentialReturn;
    return 0; // lost
  })();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel quick-bet-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="quick-bet-header">
          <div className="quick-bet-title">
            <Zap size={14} style={{ color: "var(--accent)" }} />
            <span>Entrada Rápida</span>
          </div>
          <div className="quick-bet-header-actions">
            <button
              type="button"
              className="quick-bet-switch"
              onClick={onSwitchToFull}
              title="Abrir modo completo com wizard e revisão de OCR"
            >
              Modo completo <ChevronRight size={12} />
            </button>
            <button type="button" className="modal-close quick-bet-close" onClick={onClose}>×</button>
          </div>
        </div>

        <p className="quick-bet-hint">
          Navegue pelos campos com <kbd>Tab</kbd> ou <kbd>Enter</kbd>. Escaneie um print para preencher automaticamente.
        </p>

        {userId && (
          <div className="quick-bet-ocr">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="quick-bet-file"
              onChange={handleFile}
            />
            <button
              type="button"
              className="quick-bet-ocr-btn"
              onClick={() => fileRef.current?.click()}
              disabled={ocrState === "loading"}
            >
              {ocrState === "loading" ? <Loader2 size={14} className="spin" /> : <ScanLine size={14} />}
              {ocrState === "loading" ? "Lendo print..." : "Escanear print (OCR)"}
            </button>
            {ocrMessage && (
              <span className={`quick-bet-ocr-msg quick-bet-ocr-${ocrState}`}>{ocrMessage}</span>
            )}
          </div>
        )}

        <form ref={formRef} className="quick-bet-form" onSubmit={handleSubmit}>
          {/* Campos ocultos com defaults */}
          <input type="hidden" name="sport" value="Futebol" />
          <input type="hidden" name="league" value="-" />
          <input type="hidden" name="market" value="Resultado" />
          <input type="hidden" name="selection" value="-" />
          <input type="hidden" name="mode" value="prelive" />
          <input type="hidden" name="tags" value="" />
          <input type="hidden" name="closingOdds" value="" />
          <input type="hidden" name="strategyId" value="" />
          <input type="hidden" name="suggestionId" value="" />
          <input type="hidden" name="fixtureId" value="" />
          <input type="hidden" name="estimatedProbability" value="" />
          <input type="hidden" name="estimatedEdge" value="" />
          <input type="hidden" name="suggestionConfidenceScore" value="" />
          <input type="hidden" name="ocrMetadata" value={ocrMeta} />
          <input type="hidden" name="uploadedSlipImagePath" value={slipPath} />
          <input type="hidden" name="uploadedSlipImageUrl" value={slipUrl} />

          {/* Linha 1: Evento + Data */}
          <div className="quick-bet-row">
            <label className="quick-bet-field quick-bet-event">
              <span>Evento <em className="quick-bet-required">*</em></span>
              <input
                ref={eventRef}
                name="eventName"
                required
                autoFocus
                placeholder="Real Madrid x City"
                autoComplete="off"
                onKeyDown={handleKeyDown("event")}
              />
            </label>
            <label className="quick-bet-field quick-bet-date">
              <span>Data do evento <em className="quick-bet-required">*</em></span>
              <input
                ref={eventAtRef}
                name="eventAt"
                required
                type="datetime-local"
                lang="pt-BR"
                defaultValue={nowLocalInput()}
                onKeyDown={handleKeyDown("event")}
              />
            </label>
          </div>

          {/* Linha 2: Stake + Odd */}
          <div className="quick-bet-row">
            <label className="quick-bet-field">
              <span>Stake (R$) <em className="quick-bet-required">*</em></span>
              <input
                ref={stakeRef}
                name="stake"
                required
                min="1"
                step="0.01"
                type="number"
                placeholder="250"
                value={stake}
                onChange={(e) => setStake(e.target.value)}
                onKeyDown={handleKeyDown("stake")}
              />
            </label>
            <label className="quick-bet-field">
              <span>Odd <em className="quick-bet-required">*</em></span>
              <input
                ref={oddsRef}
                name="odds"
                required
                min="1.01"
                step="0.01"
                type="number"
                placeholder="1.92"
                value={odds}
                onChange={(e) => setOdds(e.target.value)}
                onKeyDown={handleKeyDown("odds")}
              />
            </label>
          </div>

          {/* Linha 3: Casa + Status */}
          <div className="quick-bet-row">
            <label className="quick-bet-field">
              <span>Casa de apostas <em className="quick-bet-required">*</em></span>
              <select
                ref={bookmakerRef}
                name="bookmakerId"
                required
                defaultValue={state.bookmakers.length === 1 ? state.bookmakers[0].id : ""}
                onKeyDown={handleKeyDown("bookmaker")}
              >
                <option value="" disabled>Selecione a casa</option>
                {state.bookmakers.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </label>
            <label className="quick-bet-field">
              <span>Status</span>
              <select
                name="status"
                value={status}
                onChange={(e) => setStatus(e.target.value as SettleStatus)}
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>
          </div>

          {/* Campo condicional: valor do cashout */}
          {status === "cashout" && (
            <div className="quick-bet-row">
              <label className="quick-bet-field quick-bet-full">
                <span>Valor recebido no cashout (R$)</span>
                <input
                  name="cashoutAmount"
                  min="0"
                  step="0.01"
                  type="number"
                  placeholder={potentialReturn ? money.format(potentialReturn).replace("R$", "").trim() : "0,00"}
                  value={cashoutAmount}
                  onChange={(e) => setCashoutAmount(e.target.value)}
                />
              </label>
            </div>
          )}

          {/* Feedback de retorno */}
          {status === "pending" && potentialReturn !== null && (
            <div className="quick-bet-return">
              <span>Possível retorno</span>
              <strong className="pos">{money.format(potentialReturn)}</strong>
              <span className="quick-bet-gain">
                (ganho: <b className="pos">{money.format(potentialReturn - Number(stake))}</b>)
              </span>
            </div>
          )}
          {status !== "pending" && settledReturn !== null && (
            <div className="quick-bet-return">
              <span>Resultado registrado</span>
              <strong className={settledReturn - Number(stake) >= 0 ? "pos" : "neg"}>
                {money.format(settledReturn)}
              </strong>
              <span className="quick-bet-gain">
                (lucro: <b className={settledReturn - Number(stake) >= 0 ? "pos" : "neg"}>
                  {money.format(settledReturn - Number(stake))}
                </b>)
              </span>
            </div>
          )}

          {/* Ações */}
          <div className="quick-bet-actions">
            {state.bookmakers.length === 0 && (
              <span className="quick-bet-warning">Cadastre uma casa antes de registrar apostas.</span>
            )}
            <button
              ref={submitRef}
              type="submit"
              className="primary quick-bet-submit"
              disabled={state.bookmakers.length === 0 || submitting}
            >
              {submitting ? "Salvando..." : "Salvar aposta"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
