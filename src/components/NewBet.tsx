import { useState, useRef } from "react";
import type { FormEvent } from "react";
import type { AppState } from "../lib/types";
import { searchFixtures, isSportsApiConfigured, type FixtureSearchResult } from "../lib/sportsApi";

interface NewBetProps {
  state: AppState;
  addBet: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onClose: () => void;
}

export function NewBet({ state, addBet, onClose }: NewBetProps) {
  const [fixtureQuery, setFixtureQuery] = useState("");
  const [fixtureSuggestions, setFixtureSuggestions] = useState<FixtureSearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleEventSearch(value: string) {
    setFixtureQuery(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (value.length < 3 || !isSportsApiConfigured()) {
      setFixtureSuggestions([]);
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
    const f = result.fixture;
    const form = formRef.current;
    if (!form) return;
    const eventNameInput = form.querySelector<HTMLInputElement>('[name="eventName"]');
    const eventAtInput = form.querySelector<HTMLInputElement>('[name="eventAt"]');
    const sportInput = form.querySelector<HTMLInputElement>('[name="sport"]');
    const leagueInput = form.querySelector<HTMLInputElement>('[name="league"]');

    if (eventNameInput) eventNameInput.value = `${f.homeTeam} x ${f.awayTeam}`;
    if (eventAtInput) {
      // Converter para datetime-local format (sem timezone)
      const d = new Date(f.date);
      const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
      eventAtInput.value = local.toISOString().slice(0, 16);
    }
    if (sportInput) sportInput.value = "Futebol";
    if (leagueInput) leagueInput.value = f.league;

    setFixtureQuery(`${f.homeTeam} x ${f.awayTeam}`);
    setShowSuggestions(false);
    setFixtureSuggestions([]);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} type="button">×</button>
        <h2>Nova Aposta</h2>
        <form className="form" onSubmit={addBet} ref={formRef}>
          <div className="dropzone full">
            <strong>Cole, arraste ou selecione o print do bilhete</strong>
            <span>Upload no Firebase Storage quando houver usuario conectado. OCR entra na proxima etapa.</span>
            <input accept="image/*" name="slip" type="file" />
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
              value={fixtureQuery}
              onChange={e => handleEventSearch(e.target.value)}
              onFocus={() => fixtureSuggestions.length > 0 && setShowSuggestions(true)}
              autoComplete="off"
            />
            {showSuggestions && fixtureSuggestions.length > 0 && (
              <ul className="fixture-suggestions">
                {fixtureSuggestions.map(result => (
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
                        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
                      })}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </label>
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
