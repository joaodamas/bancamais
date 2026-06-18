import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Zap, X, ChevronRight } from "lucide-react";
import type { AppState } from "../lib/types";
import { money } from "../lib/metrics";

interface QuickBetProps {
  state: AppState;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onClose: () => void;
  onSwitchToFull: () => void;
}

/**
 * Modo Rápido de registro de aposta.
 * Fluxo linear por Tab/Enter: Evento → Stake → Odd → Casa → [Salvar]
 * Sem seções, sem OCR, sem wizard. Ideal para entrada em sequência.
 */
export function QuickBet({ state, onSubmit, onClose, onSwitchToFull }: QuickBetProps) {
  const [submitting, setSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Refs dos campos para navegação por Enter
  const eventRef = useRef<HTMLInputElement>(null);
  const stakeRef = useRef<HTMLInputElement>(null);
  const oddsRef = useRef<HTMLInputElement>(null);
  const bookmakerRef = useRef<HTMLSelectElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);

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

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(e);
    } finally {
      setSubmitting(false);
    }
  }

  // Prevê o retorno potencial para feedback imediato
  const [stake, setStake] = useState("");
  const [odds, setOdds] = useState("");
  const potentialReturn = Number(stake) > 0 && Number(odds) > 1
    ? Number(stake) * Number(odds)
    : null;

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
              title="Abrir modo completo com OCR e wizard"
            >
              Modo completo <ChevronRight size={12} />
            </button>
            <button type="button" className="modal-close quick-bet-close" onClick={onClose}>×</button>
          </div>
        </div>

        <p className="quick-bet-hint">
          Navegue pelos campos com <kbd>Tab</kbd> ou <kbd>Enter</kbd>. Use o modo completo para OCR e sugestões de fixture.
        </p>

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
          <input type="hidden" name="uploadedSlipImagePath" value="" />
          <input type="hidden" name="uploadedSlipImageUrl" value="" />
          <input type="hidden" name="ocrRequestId" value="" />
          <input type="hidden" name="ocrStatus" value="" />
          <input type="hidden" name="ocrProvider" value="" />
          <input type="hidden" name="ocrMetadata" value="" />
          <input type="hidden" name="suggestionId" value="" />
          <input type="hidden" name="fixtureId" value="" />
          <input type="hidden" name="estimatedProbability" value="" />
          <input type="hidden" name="estimatedEdge" value="" />
          <input type="hidden" name="suggestionConfidenceScore" value="" />

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
                name="eventAt"
                required
                type="datetime-local"
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

          {/* Linha 3: Casa */}
          <div className="quick-bet-row">
            <label className="quick-bet-field quick-bet-full">
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
          </div>

          {/* Feedback de retorno potencial */}
          {potentialReturn !== null && (
            <div className="quick-bet-return">
              <span>Possível retorno</span>
              <strong className="pos">{money.format(potentialReturn)}</strong>
              <span className="quick-bet-gain">
                (ganho: <b className="pos">{money.format(potentialReturn - Number(stake))}</b>)
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
