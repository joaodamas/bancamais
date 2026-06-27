import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Zap, ChevronRight, ScanLine, Loader2, Lock } from "lucide-react";
import type { AppState, BetStatus } from "../lib/types";
import { money } from "../lib/metrics";
import { uploadAndParseBetSlip, buildOcrSubmissionMetadata, type ParseBetSlipResponse } from "../lib/ocr";
import { KNOWN_BOOKMAKERS } from "../lib/knownBookmakers";

interface QuickBetProps {
  state: AppState;
  userId?: string | null;
  canUseOcr?: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onAddBookmaker?: (name: string) => string | null;
  onClose: () => void;
  onSwitchToFull: () => void;
  onUpgrade?: () => void;
}

type SettleStatus = Extract<BetStatus, "pending" | "won" | "lost" | "cashout" | "void" | "half_won" | "half_lost">;

const STATUS_OPTIONS: { value: SettleStatus; label: string }[] = [
  { value: "pending", label: "Pendente" },
  { value: "won", label: "Ganha" },
  { value: "half_won", label: "Meia ganha" },
  { value: "half_lost", label: "Meia perdida" },
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
export function QuickBet({ state, userId, canUseOcr = true, onSubmit, onAddBookmaker, onClose, onSwitchToFull, onUpgrade }: QuickBetProps) {
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
  const [bookmakerId, setBookmakerId] = useState(() => (state.bookmakers.length === 1 ? state.bookmakers[0].id : ""));
  const [addingBook, setAddingBook] = useState(false);
  const [newBookName, setNewBookName] = useState("");

  function handleBookmakerChange(value: string) {
    if (value === "__add__") {
      setAddingBook(true);
      return;
    }
    setBookmakerId(value);
  }

  function confirmAddBook() {
    const name = newBookName.trim();
    if (!name || !onAddBookmaker) return;
    const id = onAddBookmaker(name);
    if (id) {
      setBookmakerId(id);
      setAddingBook(false);
      setNewBookName("");
    }
  }

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
    if (f.bookmakerName.value) {
      const match = state.bookmakers.find(
        (b) => b.name.toLowerCase() === String(f.bookmakerName.value).toLowerCase(),
      );
      if (match) setBookmakerId(match.id);
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
    setOcrMessage("Enviando print e lendo campos do bilhete…");
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
    if (status === "half_won") return potentialReturn / 2 + Number(stake) / 2;
    if (status === "void") return Number(stake);
    if (status === "half_lost") return Number(stake) / 2;
    if (status === "cashout") return Number(cashoutAmount) > 0 ? Number(cashoutAmount) : potentialReturn;
    return 0; // lost
  })();

  return (
    <div className="modal-overlay" onClick={onClose}>
      {ocrState === "loading" && (
        <div className="nb-ocr-overlay" role="status" aria-live="polite">
          <div className="nb-ocr-overlay-card">
            <span className="nb-ocr-spinner" aria-hidden="true" />
            <strong>Lendo o bilhete…</strong>
            <span>{ocrMessage || "Analisando o print…"}</span>
          </div>
        </div>
      )}
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

        {userId && canUseOcr && (
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
        {userId && !canUseOcr && (
          <div className="quick-bet-ocr">
            <button
              type="button"
              className="quick-bet-ocr-btn quick-bet-ocr-locked"
              onClick={() => onUpgrade?.()}
              title="Escanear bilhete é do plano Edge"
            >
              <Lock size={13} /> Escanear print é do Edge
            </button>
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
              {addingBook ? (
                <div className="quick-bet-add-book">
                  <input
                    list="quick-known-books"
                    autoFocus
                    placeholder="Nome da casa (ex: Betano)"
                    value={newBookName}
                    onChange={(e) => setNewBookName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); confirmAddBook(); }
                      if (e.key === "Escape") { setAddingBook(false); setNewBookName(""); }
                    }}
                  />
                  <datalist id="quick-known-books">
                    {KNOWN_BOOKMAKERS.map((n) => <option key={n} value={n} />)}
                  </datalist>
                  <button type="button" className="quick-bet-add-ok primary" onClick={confirmAddBook} disabled={!newBookName.trim()}>Criar</button>
                  <button type="button" className="quick-bet-add-cancel" onClick={() => { setAddingBook(false); setNewBookName(""); }} aria-label="Cancelar">×</button>
                </div>
              ) : (
                <select
                  ref={bookmakerRef}
                  name="bookmakerId"
                  required
                  value={bookmakerId}
                  onChange={(e) => handleBookmakerChange(e.target.value)}
                  onKeyDown={handleKeyDown("bookmaker")}
                >
                  <option value="" disabled>Selecione a casa</option>
                  {state.bookmakers.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                  {onAddBookmaker && <option value="__add__">➕ Adicionar casa…</option>}
                </select>
              )}
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
