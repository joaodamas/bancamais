import { type FormEvent, useState } from "react";
import { X } from "lucide-react";
import { money } from "../lib/metrics";
import { getDerivedBookmakerBalance } from "../lib/ledger";
import type { AppState, Bet } from "../lib/types";
import { Button } from "./ui/button";

interface EditBetModalProps {
  bet: Bet;
  state: AppState;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onClose: () => void;
}

export function EditBetModal({ bet, state, onSubmit, onClose }: EditBetModalProps) {
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(e);
    } finally {
      setSubmitting(false);
    }
  }

  const bookmakerBalance = (id: string) => {
    const available = getDerivedBookmakerBalance(state, id);
    return id === bet.bookmakerId ? available + bet.stake : available;
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal edit-bet-modal">
        <div className="modal-head">
          <h2>Editar aposta</h2>
          <button className="modal-close" onClick={onClose} aria-label="Fechar">
            <X size={16} />
          </button>
        </div>

        <form className="edit-bet-form" onSubmit={handleSubmit}>
          <input type="hidden" name="betId" value={bet.id} />

          <div className="edit-bet-grid">
            <label className="edit-bet-span2">
              Evento
              <input name="eventName" defaultValue={bet.eventName} required placeholder="Real x City" />
            </label>

            <label>
              Data / hora do evento
              <input
                name="eventAt"
                type="datetime-local"
                defaultValue={bet.eventAt.slice(0, 16)}
                required
              />
            </label>

            <label>
              Modalidade
              <select name="mode" defaultValue={bet.mode}>
                <option value="prelive">Pré-live</option>
                <option value="live">Live</option>
              </select>
            </label>

            <label>
              Esporte
              <input name="sport" defaultValue={bet.sport} placeholder="Futebol" />
            </label>

            <label>
              Liga
              <input name="league" defaultValue={bet.league} placeholder="UCL" />
            </label>

            <label>
              Mercado
              <input name="market" defaultValue={bet.market} placeholder="Resultado" />
            </label>

            <label>
              Seleção
              <input name="selection" defaultValue={bet.selection} placeholder="Casa vence" />
            </label>

            <label>
              Casa de apostas
              <select name="bookmakerId" defaultValue={bet.bookmakerId} required>
                {state.bookmakers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({money.format(bookmakerBalance(b.id))} disp.)
                  </option>
                ))}
              </select>
            </label>

            <label>
              Estratégia
              <select name="strategyId" defaultValue={bet.strategyId ?? ""}>
                <option value="">Sem estratégia</option>
                {state.strategies.filter((s) => s.status === "active").map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </label>

            <label>
              Stake
              <input
                name="stake"
                type="number"
                step="0.01"
                min="0.01"
                defaultValue={bet.stake}
                required
              />
            </label>

            <label>
              Odd
              <input
                name="odds"
                type="number"
                step="0.01"
                min="1.01"
                defaultValue={bet.odds}
                required
              />
            </label>

            <label>
              Odd de fechamento
              <span className="field-hint">
                Odd final do mercado logo antes do jogo. Habilita o CLV (mede se você bateu a
                linha de fechamento). O app tenta preencher sozinho em eventos compatíveis.
              </span>
              <input
                name="closingOdds"
                type="number"
                step="0.01"
                min="1.01"
                defaultValue={bet.closingOdds ?? ""}
                placeholder="opcional"
              />
            </label>

            <label className="edit-bet-span2">
              Tags
              <input
                name="tags"
                defaultValue={bet.tags.join(", ")}
                placeholder="value, ev, arb (separadas por vírgula)"
              />
            </label>
          </div>

          <div className="edit-bet-actions">
            <Button variant="ghost" type="button" onClick={onClose}>Cancelar</Button>
            <Button className="primary" type="submit" disabled={submitting}>
              {submitting ? "Salvando..." : "Salvar alterações"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
