import { useState } from "react";
import { parseBetsCsv } from "../lib/csv";
import type { AppState, Bet } from "../lib/types";

interface ImportProps {
  state: AppState;
  importBets: (bets: Bet[]) => void;
  onOpenBets: () => void;
}

export function Import({ state, importBets, onOpenBets }: ImportProps) {
  const [csv, setCsv] = useState("");
  const [message, setMessage] = useState("Cole um CSV exportado pelo Banca+ ou por planilha equivalente.");

  async function readFile(file: File) {
    setCsv(await file.text());
    setMessage(`Arquivo carregado: ${file.name}`);
  }

  function previewImport() {
    const result = parseBetsCsv(csv, state);
    if (result.bets.length === 0) {
      setMessage(result.errors.join(" ") || "Nenhuma aposta valida encontrada.");
      return;
    }

    if (result.errors.length > 0) {
      setMessage(`${result.bets.length} apostas validas. Alertas: ${result.errors.join(" ")}`);
      return;
    }

    setMessage(`${result.bets.length} apostas prontas para importar.`);
  }

  function commitImport() {
    const result = parseBetsCsv(csv, state);
    if (result.bets.length === 0) {
      setMessage(result.errors.join(" ") || "Nenhuma aposta valida encontrada.");
      return;
    }

    importBets(result.bets);
  }

  return (
    <section className="page">
      <div className="panel import-panel">
        <div>
          <h2>Importar apostas por CSV</h2>
          <p>
            Use o mesmo formato exportado pelo Banca+ para incorporar historico operacional sem redigitar apostas.
          </p>
        </div>

        {state.bets.length > 0 && !csv && (
          <div className="import-context">
            <strong>Base atual: {state.bets.length} apostas registradas</strong>
            <button type="button" onClick={onOpenBets}>Ver base atual</button>
          </div>
        )}

        <label className="file-drop">
          <span>Selecionar arquivo CSV</span>
          <input
            accept=".csv,text/csv"
            type="file"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void readFile(file);
            }}
          />
        </label>

        {!csv && (
          <div className="import-empty">
            <strong>Pronto para importar</strong>
            <span>Selecione um arquivo ou cole o conteudo CSV para validar antes da entrada na base.</span>
          </div>
        )}

        <label className="full">
          Conteudo CSV
          <textarea
            value={csv}
            onChange={(event) => setCsv(event.target.value)}
            placeholder="id,placedAt,eventAt,sport,league,eventName,market,selection,bookmaker,stake,odds,status,payout,closingOdds,mode,tags"
          />
        </label>

        <div className="form-actions">
          <span>{message}</span>
          <div className="actions">
            <button type="button" onClick={previewImport}>Validar</button>
            <button className="primary" type="button" onClick={commitImport}>Importar</button>
          </div>
        </div>
      </div>
    </section>
  );
}
