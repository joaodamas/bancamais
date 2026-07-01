import { useMemo, useState } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Copy, FileText } from "lucide-react";
import { parseBetsCsv } from "../lib/csv";
import { betProfit, money } from "../lib/metrics";
import type { AppState, Bet } from "../lib/types";

interface ImportProps {
  state: AppState;
  importBets: (bets: Bet[]) => void;
  onOpenBets: () => void;
}

interface ParsePreview {
  valid: Bet[];
  errors: string[];
  duplicates: number;
}

const STATUS_LABEL: Record<Bet["status"], string> = {
  pending: "Pendente",
  won: "Ganha",
  lost: "Perdida",
  cashout: "Cashout",
  void: "Cancelada",
  half_won: "Meia ganha",
  half_lost: "Meia perdida",
};

/** Categoria de cor da linha por resultado — verde/vermelho/neutro/pendente. */
function rowTone(bet: Bet): "green" | "red" | "neutral" | "pending" {
  if (bet.status === "pending") return "pending";
  if (bet.status === "void") return "neutral";
  if (bet.status === "won" || bet.status === "half_won") return "green";
  if (bet.status === "lost" || bet.status === "half_lost") return "red";
  return betProfit(bet) >= 0 ? "green" : "red"; // cashout
}

function signed(value: number): string {
  return `${value >= 0 ? "+" : ""}${money.format(value)}`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

/** Teto de linhas renderizadas na prévia para manter o DOM leve em imports grandes. */
const PREVIEW_ROW_CAP = 500;

export function Import({ state, importBets, onOpenBets }: ImportProps) {
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<ParsePreview | null>(null);
  const [imported, setImported] = useState(false);

  const bookmakerName = useMemo(
    () => new Map(state.bookmakers.map((book) => [book.id, book.name])),
    [state.bookmakers],
  );

  async function readFile(file: File) {
    const text = await file.text();
    setCsv(text);
    setPreview(null);
    setImported(false);
  }

  function runPreview() {
    if (!csv.trim()) return;
    const existingIds = new Set(state.bets.map((b) => b.id));
    const result = parseBetsCsv(csv, state);
    const duplicates = result.bets.filter((b) => existingIds.has(b.id)).length;
    setPreview({ valid: result.bets, errors: result.errors, duplicates });
    setImported(false);
  }

  function commitImport() {
    if (!preview || preview.valid.length === 0) return;
    importBets(preview.valid);
    setImported(true);
  }

  function reset() {
    setCsv("");
    setPreview(null);
    setImported(false);
  }

  const canImport = preview && preview.valid.length > 0 && !imported;

  return (
    <section className="page">
      <div className="panel import-panel">
        <div className="import-header">
          <FileText size={20} style={{ color: "var(--accent)" }} />
          <div>
            <h2>Importar apostas por CSV</h2>
            <p>Use o formato exportado pelo Banca+ para incorporar histórico sem redigitar apostas.</p>
          </div>
        </div>

        {state.bets.length > 0 && !csv && (
          <div className="import-context">
            <strong>Base atual: {state.bets.length} apostas</strong>
            <button type="button" onClick={onOpenBets}>Ver apostas</button>
          </div>
        )}

        {/* Dropzone */}
        <label className="import-dropzone">
          <div className="import-dropzone-content">
            <Copy size={18} />
            <span>Selecionar arquivo CSV</span>
            <small>ou arraste o arquivo aqui</small>
          </div>
          <input
            accept=".csv,text/csv"
            type="file"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void readFile(f); }}
          />
        </label>

        {/* Textarea */}
        <label className="full">
          <span className="import-label">Ou cole o conteúdo CSV diretamente</span>
          <textarea
            value={csv}
            onChange={(e) => { setCsv(e.target.value); setPreview(null); setImported(false); }}
            placeholder={"id,placedAt,eventAt,sport,league,eventName,market,selection,bookmaker,stake,odds,status,payout,closingOdds,mode,tags\n..."}
            rows={6}
          />
        </label>

        {/* Preview de validação */}
        {preview && (
          <div className="import-preview">
            {/* Summary */}
            <div className="import-preview-summary">
              <div className="import-summary-item import-summary-ok">
                <CheckCircle2 size={14} />
                <span><strong>{preview.valid.length}</strong> apostas válidas</span>
              </div>
              {preview.duplicates > 0 && (
                <div className="import-summary-item import-summary-warn">
                  <AlertTriangle size={14} />
                  <span><strong>{preview.duplicates}</strong> duplicadas (serão ignoradas)</span>
                </div>
              )}
              {preview.errors.length > 0 && (
                <div className="import-summary-item import-summary-error">
                  <XCircle size={14} />
                  <span><strong>{preview.errors.length}</strong> erro(s) encontrado(s)</span>
                </div>
              )}
            </div>

            {/* Erros por linha */}
            {preview.errors.length > 0 && (
              <div className="import-errors">
                <span className="import-errors-label">Erros detectados</span>
                <ul>
                  {preview.errors.map((err, i) => (
                    <li key={i}>
                      <XCircle size={11} />
                      <span>{err}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Preview das apostas válidas — tabela detalhada, linha por resultado */}
            {preview.valid.length > 0 && (
              <div className="import-valid-preview">
                <span className="import-errors-label">
                  Prévia das apostas válidas ({preview.valid.length})
                </span>
                <div className="import-preview-table-wrap import-preview-scroll">
                  <table className="import-preview-table">
                    <thead>
                      <tr>
                        <th>Data</th>
                        <th>Evento</th>
                        <th>Casa</th>
                        <th className="num">Stake</th>
                        <th className="num">Odd</th>
                        <th>Status</th>
                        <th className="num">Resultado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.valid.slice(0, PREVIEW_ROW_CAP).map((bet, i) => {
                        const tone = rowTone(bet);
                        const settled = bet.status !== "pending";
                        const profit = betProfit(bet);
                        return (
                          <tr key={bet.id ?? i} className={`tone-${tone}`}>
                            <td className="text-mono import-cell-date">{fmtDate(bet.eventAt)}</td>
                            <td>
                              <span className="import-cell-event">{bet.eventName || "—"}</span>
                              <span className="import-cell-sub">
                                {[bet.selection, bet.market].filter(Boolean).join(" · ") || bet.sport}
                              </span>
                            </td>
                            <td>{bookmakerName.get(bet.bookmakerId) ?? "—"}</td>
                            <td className="text-mono num">{money.format(bet.stake)}</td>
                            <td className="text-mono num">{bet.odds.toFixed(2)}</td>
                            <td>
                              <span className={`pill ${bet.status}`} style={{ fontSize: 10 }}>
                                {STATUS_LABEL[bet.status] ?? bet.status}
                              </span>
                            </td>
                            <td className="num text-mono">
                              {settled
                                ? <span className={tone === "green" ? "pos" : tone === "red" ? "neg" : "muted"}>
                                    {tone === "neutral" ? money.format(0) : signed(profit)}
                                  </span>
                                : <span className="muted">pendente</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {preview.valid.length > PREVIEW_ROW_CAP && (
                    <p className="import-preview-more">
                      + {preview.valid.length - PREVIEW_ROW_CAP} apostas adicionais (serão importadas normalmente)
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Resultado após importar */}
        {imported && (
          <div className="import-success">
            <CheckCircle2 size={16} />
            <div>
              <strong>Importação concluída!</strong>
              <p>
                {preview?.valid.length} apostas adicionadas.{" "}
                <button type="button" onClick={onOpenBets}>Ver apostas</button>
              </p>
            </div>
          </div>
        )}

        {/* Ações */}
        <div className="form-actions">
          <span className="import-hint">
            {!csv.trim()
              ? "Selecione um arquivo ou cole o CSV para começar."
              : preview
                ? canImport
                  ? `${preview.valid.length} apostas prontas para importar.`
                  : imported
                    ? "Importação finalizada."
                    : "Nenhuma aposta válida para importar."
                : "Clique em Validar para verificar o conteúdo antes de importar."}
          </span>
          <div className="actions">
            {csv && !imported && (
              <button type="button" onClick={reset}>Limpar</button>
            )}
            {csv && !imported && (
              <button type="button" onClick={runPreview}>
                {preview ? "Revalidar" : "Validar"}
              </button>
            )}
            {canImport && (
              <button className="primary" type="button" onClick={commitImport}>
                Importar {preview.valid.length} apostas
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
