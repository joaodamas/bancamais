import type { FormEvent } from "react";
import type { AppState } from "../lib/types";

interface NewBetProps {
  state: AppState;
  addBet: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onClose: () => void;
}

export function NewBet({ state, addBet, onClose }: NewBetProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} type="button">×</button>
        <h2>Nova Aposta</h2>
        <form className="form" onSubmit={addBet}>
          <div className="dropzone full">
            <strong>Cole, arraste ou selecione o print do bilhete</strong>
            <span>Upload no Firebase Storage quando houver usuario conectado. OCR entra na proxima etapa.</span>
            <input accept="image/*" name="slip" type="file" />
          </div>
          <label>Evento<input name="eventName" required placeholder="Real Madrid x Manchester City" /></label>
          <label>Data do evento<input name="eventAt" required type="datetime-local" /></label>
          <label>Esporte<input name="sport" required placeholder="Futebol" /></label>
          <label>Liga<input name="league" required placeholder="UCL" /></label>
          <label>Mercado<input name="market" required placeholder="Total de gols" /></label>
          <label>Selecao<input name="selection" required placeholder="Over 2.5 gols" /></label>
          <label>Casa
            <select name="bookmakerId" required>
              {state.bookmakers.map((book) => <option key={book.id} value={book.id}>{book.name}</option>)}
            </select>
          </label>
          <label>Estrategia
            <select name="strategyId">
              <option value="">Sem estrategia</option>
              {state.strategies.map((strategy) => <option key={strategy.id} value={strategy.id}>{strategy.name}</option>)}
            </select>
          </label>
          <label>Stake<input name="stake" required min="1" step="0.01" type="number" placeholder="250" /></label>
          <label>Odd<input name="odds" required min="1.01" step="0.01" type="number" placeholder="1.92" /></label>
          <label>Odd fechamento<input name="closingOdds" min="1.01" step="0.01" type="number" placeholder="1.83" /></label>
          <label>Modo
            <select name="mode">
              <option value="prelive">Pre-live</option>
              <option value="live">Live</option>
            </select>
          </label>
          <label className="full">Tags<input name="tags" placeholder="euro, overgols, prelive" /></label>
          <div className="form-actions">
            <span>Entrada manual com anexo opcional. OCR entra na proxima etapa.</span>
            <button className="primary" type="submit">Salvar aposta</button>
          </div>
        </form>
      </div>
    </div>
  );
}
