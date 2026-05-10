import { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { betsToCsv, downloadTextFile } from "../lib/csv";
import { betProfit, clvPercent, money, percent, potentialReturn } from "../lib/metrics";
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
  deleteBet: (id: string) => void;
}

export function Bets({ state, settleBet, deleteBet }: BetsProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Bet["status"] | "all">("all");
  const [cashoutBetId, setCashoutBetId] = useState<string | null>(null);
  const [cashoutInput, setCashoutInput] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [actionMenuBetId, setActionMenuBetId] = useState<string | null>(null);
  const actionMenuRef = useRef<HTMLDivElement | null>(null);
  const bookmakerById = new Map(state.bookmakers.map((book) => [book.id, book.name]));
  const strategyById = new Map(state.strategies.map((strategy) => [strategy.id, strategy.name]));

  const pendingBets = state.bets.filter((bet) => bet.status === "pending");
  const settledBets = state.bets.filter((bet) => bet.status !== "pending");
  const openExposure = pendingBets.reduce((sum, bet) => sum + bet.stake, 0);
  const settledProfit = settledBets.reduce((sum, bet) => sum + betProfit(bet), 0);

  const filtered = state.bets
    .filter((bet) => statusFilter === "all" || bet.status === statusFilter)
    .filter((bet) => {
      if (!search) return true;
      const query = search.toLowerCase();
      const bookmakerName = bookmakerById.get(bet.bookmakerId)?.toLowerCase() ?? "";
      return [
        bet.eventName,
        bet.sport,
        bet.league,
        bet.market,
        bet.selection,
        bet.mode,
        bookmakerName,
        ...(bet.tags ?? []),
      ].some((field) => field.toLowerCase().includes(query));
    });

  function getReturnValue(bet: Bet) {
    if (bet.status === "pending") return potentialReturn(bet);
    if (bet.status === "void") return bet.payout ?? bet.stake;
    return bet.payout ?? 0;
  }

  function getGainValue(bet: Bet) {
    if (bet.status === "pending") return potentialReturn(bet) - bet.stake;
    return betProfit(bet);
  }

  useEffect(() => {
    if (!actionMenuBetId) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (actionMenuRef.current?.contains(target)) return;
      setActionMenuBetId(null);
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [actionMenuBetId]);

  useEffect(() => {
    setActionMenuBetId(null);
  }, [search, statusFilter, cashoutBetId, confirmDeleteId]);

  return (
    <section className="page page-bets">
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

      <div className="bets-toolbar">
        <div className="bets-toolbar-copy">
          <span className="dashboard-kicker">Leitura ativa</span>
          <strong>
            {filtered.length} resultado(s){search ? ` para "${search}"` : " na fila atual"}
          </strong>
          <small>Mostrando somente o essencial para leitura, status e liquidacao.</small>
        </div>
        <div className="bets-toolbar-meta">
          <span>Pendente {pendingBets.length}</span>
          <span>Liquidadas {settledBets.length}</span>
          <span>Cashout {state.bets.filter((bet) => bet.status === "cashout").length}</span>
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
        <div className="table-shell-head">
          <div>
            <span className="dashboard-kicker">Fila operacional</span>
            <strong>Leitura consolidada das apostas</strong>
            <small>Evento, execucao, precificacao e status em uma grade unica para decisao rapida.</small>
          </div>
          <div className="table-shell-meta">
            <span>{money.format(openExposure)} em risco</span>
            <span>{filtered.filter((bet) => bet.status === "pending").length} pendentes visiveis</span>
          </div>
        </div>
        <div className="bets-table-wrapper">
          <table className="bets-table bets-table-expanded">
            <thead>
              <tr>
                <th>Evento</th>
                <th>Mercado</th>
                <th>Execucao</th>
                <th>Valor apostado</th>
                <th>Preco</th>
                <th>Performance</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((bet) => (
                <tr key={bet.id}>
                  <td className="bet-cell bet-cell-event">
                    <div className="bet-block-head">
                      <strong className="bet-primary-text">{bet.eventName}</strong>
                    </div>
                    <small>{bet.sport} · {bet.league} · {new Date(bet.eventAt).toLocaleString("pt-BR")}</small>
                    <div className="bet-meta-chips">
                      <span className="bet-meta-chip">{bet.mode === "live" ? "Live" : "Pre-live"}</span>
                      {bet.source && <span className="bet-meta-chip">{bet.source === "ai_suggestion" ? "IA" : bet.source.toUpperCase()}</span>}
                      {bet.tags.slice(0, 2).map((tag) => (
                        <span key={tag} className="bet-meta-chip">#{tag}</span>
                      ))}
                      {bet.slipImageUrl && <a className="bet-meta-chip bet-meta-chip-link" href={bet.slipImageUrl} rel="noreferrer" target="_blank">Ver print</a>}
                    </div>
                  </td>
                  <td className="bet-cell" data-label="Mercado">
                    <strong className="bet-primary-text">{bet.market}</strong>
                    <small>{bet.selection}</small>
                  </td>
                  <td className="bet-cell" data-label="Execução">
                    <strong className="bet-primary-text">{bookmakerById.get(bet.bookmakerId) ?? "-"}</strong>
                    <small>{bet.strategyId ? strategyById.get(bet.strategyId) ?? "Com estrategia" : "Sem estrategia"}</small>
                    <div className="bet-inline-stats">
                      <span>{bet.status === "pending" ? "Em risco" : "Executada"}</span>
                    </div>
                  </td>
                  <td className="bet-cell bet-cell-money" data-label="Stake">
                    <strong className="bet-primary-text text-mono">{money.format(bet.stake)}</strong>
                    <small>{bet.status === "pending" ? "Capital em risco" : "Stake liquidada"}</small>
                  </td>
                  <td className="bet-cell" data-label="Odd">
                    <strong className="bet-primary-text text-mono">@ {bet.odds.toFixed(2)}</strong>
                    <small>{bet.closingOdds ? `Fechamento ${bet.closingOdds.toFixed(2)}` : "Sem fechamento"}</small>
                  </td>
                  <td className="bet-cell bet-cell-performance">
                    <div className="bet-performance-grid">
                      <div className="bet-performance-item">
                        <span>Retorno</span>
                        <strong className="text-mono">{money.format(getReturnValue(bet))}</strong>
                        <small>{bet.status === "pending" ? "Potencial" : "Efetivo"}</small>
                      </div>
                      <div className="bet-performance-item">
                        <span>Ganho</span>
                        <strong className={`text-mono ${getGainValue(bet) >= 0 ? "pos" : "neg"}`}>
                          {money.format(getGainValue(bet))}
                        </strong>
                        <small>{bet.status === "pending" ? "Potencial" : "Liquido"}</small>
                      </div>
                    </div>
                    <div className="bet-inline-stats bet-inline-stats-metrics">
                      <span>CLV</span>
                      <span className="text-mono">{clvPercent(bet) === null ? "Sem CLV" : percent.format(clvPercent(bet)!)}</span>
                    </div>
                  </td>
                  <td className="bet-status-cell" data-label="Status">
                    <span className={`pill ${bet.status}`}>{statusLabel[bet.status]}</span>
                    {bet.status !== "pending" && (
                      <div className="settlement-value">
                        <span className={betProfit(bet) >= 0 ? "pos" : "neg"}>{money.format(betProfit(bet))}</span>
                        <small>{bet.payout ? `Retorno ${money.format(bet.payout)}` : "Sem retorno financeiro"}</small>
                      </div>
                    )}
                  </td>
                  <td className="bet-actions-cell">
                    {confirmDeleteId === bet.id ? (
                      <div className="actions actions-compact">
                        <span className="bet-delete-confirm-label">Excluir aposta?</span>
                        <button className="danger" onClick={() => { deleteBet(bet.id); setConfirmDeleteId(null); }}>Confirmar</button>
                        <button onClick={() => setConfirmDeleteId(null)}>Cancelar</button>
                      </div>
                    ) : bet.status === "pending" ? (
                      cashoutBetId === bet.id ? (
                        <div className="cashout-form cashout-form-inline">
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
                          <div className="actions actions-compact">
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
                        <div className="bet-actions-menu" ref={actionMenuBetId === bet.id ? actionMenuRef : null}>
                          <button
                            className="bet-actions-trigger"
                            type="button"
                            onClick={() => setActionMenuBetId((current) => current === bet.id ? null : bet.id)}
                            aria-expanded={actionMenuBetId === bet.id}
                            aria-label="Abrir ações da aposta"
                          >
                            <MoreHorizontal size={16} />
                            <span>Ações</span>
                          </button>
                          {actionMenuBetId === bet.id && (
                            <div className="bet-actions-dropdown">
                              <button onClick={() => { settleBet(bet.id, "won"); setActionMenuBetId(null); }}>Ganha</button>
                              <button onClick={() => { settleBet(bet.id, "lost"); setActionMenuBetId(null); }}>Perdida</button>
                              <button onClick={() => { setCashoutBetId(bet.id); setCashoutInput(""); setActionMenuBetId(null); }}>Cashout</button>
                              <button onClick={() => { settleBet(bet.id, "void"); setActionMenuBetId(null); }}>Void</button>
                              <button className="danger-ghost" onClick={() => { setConfirmDeleteId(bet.id); setActionMenuBetId(null); }}>Excluir</button>
                            </div>
                          )}
                        </div>
                      )
                    ) : (
                      <div className="bet-actions-menu" ref={actionMenuBetId === bet.id ? actionMenuRef : null}>
                        <span className="bet-closed-state">Encerrada</span>
                        <button
                          className="bet-actions-trigger"
                          type="button"
                          onClick={() => setActionMenuBetId((current) => current === bet.id ? null : bet.id)}
                          aria-expanded={actionMenuBetId === bet.id}
                          aria-label="Abrir ações da aposta"
                        >
                          <MoreHorizontal size={16} />
                          <span>Ações</span>
                        </button>
                        {actionMenuBetId === bet.id && (
                          <div className="bet-actions-dropdown">
                            <button className="danger-ghost" onClick={() => { setConfirmDeleteId(bet.id); setActionMenuBetId(null); }}>Excluir</button>
                          </div>
                        )}
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
      </div>
    </section>
  );
}
