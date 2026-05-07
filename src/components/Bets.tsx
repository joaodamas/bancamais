import { useState } from "react";
import { betsToCsv, downloadTextFile } from "../lib/csv";
import { betProfit, clvPercent, money, percent } from "../lib/metrics";
import type { AppState, Bet } from "../lib/types";

const statusLabel: Record<Bet["status"], string> = {
  pending: "Pendente",
  won: "Ganha",
  lost: "Perdida",
  cashout: "Cashout",
  void: "Cancelada",
};

interface BetsProps {
  state: AppState;
  settleBet: (id: string, status: Bet["status"], cashoutAmount?: number) => void;
}

export function Bets({ state, settleBet }: BetsProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Bet["status"] | "all">("all");
  const [cashoutBetId, setCashoutBetId] = useState<string | null>(null);
  const [cashoutInput, setCashoutInput] = useState("");

  const pendingBets = state.bets.filter((bet) => bet.status === "pending");
  const settledBets = state.bets.filter((bet) => bet.status !== "pending");
  const openExposure = pendingBets.reduce((sum, bet) => sum + bet.stake, 0);
  const settledProfit = settledBets.reduce((sum, bet) => sum + betProfit(bet), 0);

  const filtered = state.bets
    .filter((bet) => statusFilter === "all" || bet.status === statusFilter)
    .filter((bet) => !search
      || bet.eventName.toLowerCase().includes(search.toLowerCase())
      || bet.sport.toLowerCase().includes(search.toLowerCase())
      || bet.league.toLowerCase().includes(search.toLowerCase()));

  return (
    <section className="page">
      <div className="page-actions">
        <div className="page-actions-copy">
          <strong>{state.bets.length} apostas registradas</strong>
          <span>Filtre a fila, liquide resultados pendentes e exporte a base para conciliação.</span>
        </div>
        <div className="page-actions-controls">
          <input
            placeholder="Buscar evento, esporte, liga..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button onClick={() => downloadTextFile("bancamais-apostas.csv", betsToCsv(state))}>Exportar CSV</button>
        </div>
      </div>

      <div className="ops-summary-grid">
        <article className="ops-summary-card">
          <span>Fila ativa</span>
          <strong>{pendingBets.length}</strong>
          <small>{money.format(openExposure)} expostos em apostas pendentes.</small>
        </article>
        <article className="ops-summary-card">
          <span>Liquidadas</span>
          <strong>{settledBets.length}</strong>
          <small>Base pronta para revisar resultado e performance.</small>
        </article>
        <article className="ops-summary-card">
          <span>Resultado liquidado</span>
          <strong className={settledProfit >= 0 ? "pos" : "neg"}>{money.format(settledProfit)}</strong>
          <small>Lucro acumulado das apostas já encerradas.</small>
        </article>
      </div>

      <div className="filter-tabs">
        {(["all", "pending", "won", "lost", "cashout", "void"] as const).map((s) => (
          <button
            key={s}
            className={statusFilter === s ? "filter-tab active" : "filter-tab"}
            onClick={() => setStatusFilter(s)}
          >
            {s === "all" ? "Todas" : (statusLabel[s as Bet["status"]] ?? s)}
            {s === "all" && <em>{state.bets.length}</em>}
            {s !== "all" && <em>{state.bets.filter((bet) => bet.status === s).length}</em>}
          </button>
        ))}
      </div>

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>Evento</th>
              <th>Mercado</th>
              <th>Casa</th>
              <th>Stake</th>
              <th>Odd</th>
              <th>CLV</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((bet) => (
              <tr key={bet.id}>
                <td>
                  <strong>{bet.eventName}</strong>
                  <small>{bet.sport} · {bet.league} · {new Date(bet.eventAt).toLocaleString("pt-BR")}</small>
                  {bet.slipImageUrl && <a className="inline-link" href={bet.slipImageUrl} rel="noreferrer" target="_blank">ver print</a>}
                </td>
                <td>
                  {bet.selection}
                  <small>{bet.market} · {bet.mode}</small>
                </td>
                <td>{state.bookmakers.find((book) => book.id === bet.bookmakerId)?.name ?? "-"}</td>
                <td>{money.format(bet.stake)}</td>
                <td>{bet.odds.toFixed(2)}</td>
                <td>{clvPercent(bet) === null ? "-" : percent.format(clvPercent(bet)!)}</td>
                <td><span className={`pill ${bet.status}`}>{statusLabel[bet.status]}</span></td>
                <td>
                  {bet.status === "pending" ? (
                    cashoutBetId === bet.id ? (
                      <div className="cashout-form">
                        <input
                          autoFocus
                          type="number"
                          min="0.01"
                          step="0.01"
                          placeholder={`Retorno cashout (máx ${money.format(bet.stake * bet.odds)})`}
                          value={cashoutInput}
                          onChange={(e) => setCashoutInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const amount = Number(cashoutInput);
                              if (amount > 0) {
                                settleBet(bet.id, "cashout", amount);
                                setCashoutBetId(null);
                                setCashoutInput("");
                              }
                            }
                            if (e.key === "Escape") {
                              setCashoutBetId(null);
                              setCashoutInput("");
                            }
                          }}
                        />
                        <div className="actions">
                          <button
                            className="primary"
                            disabled={!cashoutInput || Number(cashoutInput) <= 0}
                            onClick={() => {
                              const amount = Number(cashoutInput);
                              if (amount > 0) {
                                settleBet(bet.id, "cashout", amount);
                                setCashoutBetId(null);
                                setCashoutInput("");
                              }
                            }}
                          >
                            Confirmar
                          </button>
                          <button onClick={() => { setCashoutBetId(null); setCashoutInput(""); }}>Cancelar</button>
                        </div>
                      </div>
                    ) : (
                      <div className="actions">
                        <button onClick={() => settleBet(bet.id, "won")}>Ganha</button>
                        <button onClick={() => settleBet(bet.id, "lost")}>Perdida</button>
                        <button onClick={() => { setCashoutBetId(bet.id); setCashoutInput(""); }}>Cashout</button>
                        <button onClick={() => settleBet(bet.id, "void")}>Void</button>
                      </div>
                    )
                  ) : (
                    <div className="settlement-value">
                      <span className={betProfit(bet) >= 0 ? "pos" : "neg"}>{money.format(betProfit(bet))}</span>
                      <small>{bet.payout ? `Retorno ${money.format(bet.payout)}` : "Sem retorno financeiro"}</small>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8}>
                  <div className="table-empty rich">
                    <strong>{state.bets.length === 0 ? "Nenhuma aposta registrada" : "Nenhum resultado para os filtros atuais"}</strong>
                    <span>
                      {state.bets.length === 0
                        ? "Nenhuma aposta registrada. Abra Nova aposta para iniciar sua base."
                        : "Nenhuma aposta encontrada com os filtros atuais."}
                    </span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
