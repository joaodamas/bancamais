import { useEffect, useMemo, useRef, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
  type ColumnFiltersState,
} from "@tanstack/react-table";
import { MoreHorizontal, ArrowUpDown, ArrowUp, ArrowDown, SlidersHorizontal, X } from "lucide-react";
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

const columnHelper = createColumnHelper<Bet>();

export function Bets({ state, settleBet, deleteBet }: BetsProps) {
  const [statusFilter, setStatusFilter] = useState<Bet["status"] | "all">("all");
  const [cashoutBetId, setCashoutBetId] = useState<string | null>(null);
  const [cashoutInput, setCashoutInput] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [actionMenuBetId, setActionMenuBetId] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>([{ id: "placedAt", desc: true }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const actionMenuRef = useRef<HTMLDivElement | null>(null);

  const bookmakerById = useMemo(() => new Map(state.bookmakers.map((b) => [b.id, b.name])), [state.bookmakers]);
  const strategyById = useMemo(() => new Map(state.strategies.map((s) => [s.id, s.name])), [state.strategies]);

  const pendingBets = state.bets.filter((b) => b.status === "pending");
  const settledBets = state.bets.filter((b) => b.status !== "pending");
  const openExposure = pendingBets.reduce((s, b) => s + b.stake, 0);
  const settledProfit = settledBets.reduce((s, b) => s + betProfit(b), 0);

  function getReturnValue(bet: Bet) {
    if (bet.status === "pending") return potentialReturn(bet);
    if (bet.status === "void") return bet.payout ?? bet.stake;
    return bet.payout ?? 0;
  }

  function getGainValue(bet: Bet) {
    if (bet.status === "pending") return potentialReturn(bet) - bet.stake;
    return betProfit(bet);
  }

  // Filtro de status pré-processado antes da tabela
  const sourceData = useMemo(
    () => statusFilter === "all" ? state.bets : state.bets.filter((b) => b.status === statusFilter),
    [state.bets, statusFilter],
  );

  const columns = useMemo(() => [
    columnHelper.accessor("eventName", {
      header: "Evento",
      enableSorting: true,
      filterFn: "includesString",
    }),
    columnHelper.accessor("market", {
      header: "Mercado",
      enableSorting: true,
      filterFn: "includesString",
    }),
    columnHelper.accessor("bookmakerId", {
      header: "Execução",
      enableSorting: true,
      sortingFn: (a, b) => {
        const nameA = bookmakerById.get(a.original.bookmakerId) ?? "";
        const nameB = bookmakerById.get(b.original.bookmakerId) ?? "";
        return nameA.localeCompare(nameB);
      },
    }),
    columnHelper.accessor("stake", {
      header: "Stake",
      enableSorting: true,
    }),
    columnHelper.accessor("odds", {
      header: "Odd",
      enableSorting: true,
    }),
    columnHelper.display({
      id: "performance",
      header: "Performance",
      enableSorting: false,
    }),
    columnHelper.accessor("status", {
      header: "Status",
      enableSorting: true,
    }),
    columnHelper.display({
      id: "actions",
      header: "Ações",
      enableSorting: false,
    }),
    // Hidden accessor for global filter and date sort
    columnHelper.accessor("placedAt", {
      id: "placedAt",
      header: "Data",
      enableSorting: true,
      enableHiding: true,
    }),
    columnHelper.accessor("eventAt", {
      id: "eventAt",
      header: "Evento em",
      enableSorting: true,
      enableHiding: true,
    }),
    columnHelper.display({
      id: "profit",
      header: "Lucro",
      enableSorting: true,
      // Custom sort using accessorFn workaround
    }),
  ], [bookmakerById]);

  const table = useReactTable({
    data: sourceData,
    columns,
    state: { sorting, columnFilters, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: (row, _colId, filterValue: string) => {
      const q = filterValue.toLowerCase();
      const bet = row.original;
      const bookmakerName = bookmakerById.get(bet.bookmakerId)?.toLowerCase() ?? "";
      return [bet.eventName, bet.sport, bet.league, bet.market, bet.selection, bet.mode, bookmakerName, ...(bet.tags ?? [])]
        .some((f) => f?.toLowerCase().includes(q));
    },
    // Custom sort for profit (display column workaround)
    sortingFns: {
      profit: (a, b) => betProfit(a.original) - betProfit(b.original),
      placedAt: (a, b) => a.original.placedAt.localeCompare(b.original.placedAt),
      eventAt: (a, b) => a.original.eventAt.localeCompare(b.original.eventAt),
    },
    initialState: {
      columnVisibility: { placedAt: false, eventAt: false, profit: false },
    },
  });

  const rows = table.getRowModel().rows;

  useEffect(() => {
    if (!actionMenuBetId) return;
    function handlePointerDown(event: MouseEvent) {
      if (!(event.target instanceof Node)) return;
      if (actionMenuRef.current?.contains(event.target)) return;
      setActionMenuBetId(null);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [actionMenuBetId]);

  useEffect(() => {
    setActionMenuBetId(null);
  }, [globalFilter, statusFilter, cashoutBetId, confirmDeleteId]);

  function SortIcon({ colId }: { colId: string }) {
    const col = table.getColumn(colId);
    if (!col?.getCanSort()) return null;
    const sorted = col.getIsSorted();
    if (sorted === "asc") return <ArrowUp size={12} className="sort-icon sort-active" />;
    if (sorted === "desc") return <ArrowDown size={12} className="sort-icon sort-active" />;
    return <ArrowUpDown size={12} className="sort-icon" />;
  }

  return (
    <section className="page page-bets">
      <div className="page-actions">
        <div className="page-actions-copy">
          <strong>{state.bets.length} apostas registradas</strong>
          <span>Ordene, filtre e liquide resultados. Clique nos cabeçalhos para ordenar.</span>
        </div>
        <div className="page-actions-controls">
          <input
            placeholder="Buscar evento, esporte, liga, tag..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
          />
          <button
            className={showFilters ? "primary" : ""}
            onClick={() => setShowFilters((v) => !v)}
            title="Filtros por coluna"
          >
            <SlidersHorizontal size={14} />
          </button>
          <button onClick={() => downloadTextFile("bancamais-apostas.csv", betsToCsv(state))}>Exportar CSV</button>
        </div>
      </div>

      {/* Column filters panel */}
      {showFilters && (
        <div className="bets-column-filters">
          <label>
            <span>Evento</span>
            <input
              placeholder="Filtrar evento..."
              value={(table.getColumn("eventName")?.getFilterValue() as string) ?? ""}
              onChange={(e) => table.getColumn("eventName")?.setFilterValue(e.target.value)}
            />
          </label>
          <label>
            <span>Mercado</span>
            <input
              placeholder="Filtrar mercado..."
              value={(table.getColumn("market")?.getFilterValue() as string) ?? ""}
              onChange={(e) => table.getColumn("market")?.setFilterValue(e.target.value)}
            />
          </label>
          <label>
            <span>Ordenar por</span>
            <select
              value={sorting[0]?.id ?? "placedAt"}
              onChange={(e) => {
                const id = e.target.value;
                setSorting([{ id, desc: sorting[0]?.id === id ? !sorting[0].desc : true }]);
              }}
            >
              <option value="placedAt">Data registro</option>
              <option value="eventAt">Data evento</option>
              <option value="stake">Stake</option>
              <option value="odds">Odd</option>
              <option value="status">Status</option>
            </select>
          </label>
          <button
            className="bets-filters-clear"
            onClick={() => { setColumnFilters([]); setGlobalFilter(""); setSorting([{ id: "placedAt", desc: true }]); }}
          >
            <X size={12} /> Limpar
          </button>
        </div>
      )}

      <div className="bets-toolbar">
        <div className="bets-toolbar-copy">
          <span className="dashboard-kicker">Fila operacional</span>
          <strong>
            {rows.length} resultado(s){globalFilter ? ` para "${globalFilter}"` : " na fila atual"}
          </strong>
          <small>Clique nos cabeçalhos de coluna para ordenar.</small>
        </div>
        <div className="bets-toolbar-meta">
          <span>Pendente {pendingBets.length}</span>
          <span>Liquidadas {settledBets.length}</span>
          <span>Cashout {state.bets.filter((b) => b.status === "cashout").length}</span>
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
            <em>{s === "all" ? state.bets.length : state.bets.filter((b) => b.status === s).length}</em>
          </button>
        ))}
      </div>

      <div className="table-card">
        <div className="table-shell-head">
          <div>
            <span className="dashboard-kicker">Leitura consolidada</span>
            <strong>Apostas ordenadas por {sorting[0]?.id === "placedAt" ? "data de registro" : sorting[0]?.id === "stake" ? "stake" : sorting[0]?.id ?? "data"}</strong>
            <small>Evento, execucao, precificacao e status em uma grade unica.</small>
          </div>
          <div className="table-shell-meta">
            <span>{money.format(openExposure)} em risco</span>
            <span>{rows.filter((r) => r.original.status === "pending").length} pendentes visíveis</span>
          </div>
        </div>
        <div className="bets-table-wrapper">
          <table className="bets-table bets-table-expanded">
            <thead>
              <tr>
                <th
                  className={table.getColumn("eventName")?.getCanSort() ? "sortable" : ""}
                  onClick={() => table.getColumn("eventName")?.toggleSorting()}
                >
                  Evento <SortIcon colId="eventName" />
                </th>
                <th
                  className={table.getColumn("market")?.getCanSort() ? "sortable" : ""}
                  onClick={() => table.getColumn("market")?.toggleSorting()}
                >
                  Mercado <SortIcon colId="market" />
                </th>
                <th
                  className={table.getColumn("bookmakerId")?.getCanSort() ? "sortable" : ""}
                  onClick={() => table.getColumn("bookmakerId")?.toggleSorting()}
                >
                  Execução <SortIcon colId="bookmakerId" />
                </th>
                <th
                  className={table.getColumn("stake")?.getCanSort() ? "sortable" : ""}
                  onClick={() => table.getColumn("stake")?.toggleSorting()}
                >
                  Stake <SortIcon colId="stake" />
                </th>
                <th
                  className={table.getColumn("odds")?.getCanSort() ? "sortable" : ""}
                  onClick={() => table.getColumn("odds")?.toggleSorting()}
                >
                  Odd <SortIcon colId="odds" />
                </th>
                <th>Performance</th>
                <th
                  className={table.getColumn("status")?.getCanSort() ? "sortable" : ""}
                  onClick={() => table.getColumn("status")?.toggleSorting()}
                >
                  Status <SortIcon colId="status" />
                </th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const bet = row.original;
                return (
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
                          <span className="bet-delete-confirm-label">Excluir?</span>
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
                              placeholder={`Máx ${money.format(bet.stake * bet.odds)}`}
                              value={cashoutInput}
                              onChange={(e) => setCashoutInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  const amount = Number(cashoutInput);
                                  if (amount > 0) { settleBet(bet.id, "cashout", amount); setCashoutBetId(null); setCashoutInput(""); }
                                }
                                if (e.key === "Escape") { setCashoutBetId(null); setCashoutInput(""); }
                              }}
                            />
                            <div className="actions actions-compact">
                              <button
                                className="primary"
                                disabled={!cashoutInput || Number(cashoutInput) <= 0}
                                onClick={() => {
                                  const amount = Number(cashoutInput);
                                  if (amount > 0) { settleBet(bet.id, "cashout", amount); setCashoutBetId(null); setCashoutInput(""); }
                                }}
                              >Confirmar</button>
                              <button onClick={() => { setCashoutBetId(null); setCashoutInput(""); }}>Cancelar</button>
                            </div>
                          </div>
                        ) : (
                          <div className="bet-actions-menu" ref={actionMenuBetId === bet.id ? actionMenuRef : null}>
                            <button
                              className="bet-actions-trigger"
                              type="button"
                              onClick={() => setActionMenuBetId((c) => c === bet.id ? null : bet.id)}
                              aria-expanded={actionMenuBetId === bet.id}
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
                            onClick={() => setActionMenuBetId((c) => c === bet.id ? null : bet.id)}
                            aria-expanded={actionMenuBetId === bet.id}
                          >
                            <MoreHorizontal size={16} />
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
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8}>
                    <div className="table-empty rich">
                      <strong>{state.bets.length === 0 ? "Nenhuma aposta registrada" : "Nenhum resultado para os filtros"}</strong>
                      <span>{state.bets.length === 0 ? "Abra Nova aposta para iniciar sua base." : "Ajuste os filtros ou a busca."}</span>
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
