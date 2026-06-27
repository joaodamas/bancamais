import { useEffect, useMemo, useRef, useState } from "react";
import {
  createColumnHelper,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
  type ColumnFiltersState,
} from "@tanstack/react-table";
import { MoreHorizontal, ArrowUpDown, ArrowUp, ArrowDown, SlidersHorizontal, X, Check, Search } from "lucide-react";
import { betsToCsv, downloadTextFile } from "../lib/csv";
import { betProfit, money, potentialReturn, clvPercent } from "../lib/metrics";
import { eventDelta, isImminent } from "../lib/betTime";
import { StatusBadge } from "./StatusBadge";
import { MultiBetPopover, parseLegs } from "./MultiBetPopover";
import type { AppState, Bet } from "../lib/types";

const statusLabel: Record<Bet["status"], string> = {
  pending: "Pendente",
  won: "Ganha",
  lost: "Perdida",
  cashout: "Cashout",
  void: "Cancelada",
  half_won: "Meia ganha",
  half_lost: "Meia perdida",
};

/** Selo de status do CLV por aposta: captura, espera ou ausência da linha de fechamento. */
function clvChip(bet: Bet): { label: string; tone: string; title: string } | null {
  if (bet.closingOdds != null) {
    const clv = clvPercent(bet);
    if (clv == null) return null;
    const pct = clv * 100;
    return {
      label: `CLV ${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`,
      tone: pct >= 0 ? "pos" : "neg",
      title: `Sua odd ${bet.odds.toFixed(2)} vs. fechamento ${bet.closingOdds.toFixed(2)}`,
    };
  }
  if (bet.status !== "pending") return null;
  const eventTime = Date.parse(bet.eventAt);
  if (Number.isNaN(eventTime)) return null;
  if (eventTime > Date.now()) {
    return {
      label: "CLV aguardando",
      tone: "muted",
      title: "O app tenta capturar a odd de fechamento perto do início do evento.",
    };
  }
  return {
    label: "CLV sem captura",
    tone: "warn",
    title: "O evento começou sem a linha de fechamento capturada. Lance manualmente em Editar.",
  };
}

type DateRange = "all" | "today" | "7d" | "30d" | "month" | "year";

function inDateRange(iso: string, range: DateRange): boolean {
  if (range === "all") return true;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  if (range === "today") return date.toDateString() === now.toDateString();
  if (range === "month") return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  if (range === "year") return date.getFullYear() === now.getFullYear();
  const days = range === "7d" ? 7 : 30;
  return date.getTime() >= now.getTime() - days * 86400000;
}

interface BetsProps {
  state: AppState;
  settleBet: (id: string, status: Bet["status"], cashoutAmount?: number) => void;
  bulkSettle: (ids: string[], status: "won" | "lost" | "void") => void;
  deleteBet: (id: string) => void;
  onEditBet: (id: string) => void;
}

const columnHelper = createColumnHelper<Bet>();

export function Bets({ state, settleBet, bulkSettle, deleteBet, onEditBet }: BetsProps) {
  const [statusFilter, setStatusFilter] = useState<Bet["status"] | "all">("all");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [cashoutBetId, setCashoutBetId] = useState<string | null>(null);
  const [cashoutInput, setCashoutInput] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [actionMenuBetId, setActionMenuBetId] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>([{ id: "placedAt", desc: true }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateRange>("all");
  const actionMenuRef = useRef<HTMLDivElement | null>(null);

  const bookmakerById = useMemo(() => new Map(state.bookmakers.map((b) => [b.id, b.name])), [state.bookmakers]);
  const strategyById = useMemo(() => new Map(state.strategies.map((s) => [s.id, s.name])), [state.strategies]);
  const allTags = useMemo(() => {
    const set = new Set<string>();
    state.bets.forEach((b) => b.tags.forEach((t) => set.add(t)));
    return [...set].sort();
  }, [state.bets]);

  const pendingBets = state.bets.filter((b) => b.status === "pending");
  const settledBets = state.bets.filter((b) => b.status !== "pending");
  const openExposure = pendingBets.reduce((s, b) => s + b.stake, 0);
  const pendingPotential = pendingBets.reduce((s, b) => s + potentialReturn(b), 0);
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

  // Filtros de status e tag pré-processados antes da tabela
  const sourceData = useMemo(() => {
    let bets = state.bets;
    if (statusFilter !== "all") bets = bets.filter((b) => b.status === statusFilter);
    if (tagFilter) bets = bets.filter((b) => b.tags.includes(tagFilter));
    if (dateFilter !== "all") bets = bets.filter((b) => inDateRange(b.placedAt, dateFilter));
    return bets;
  }, [state.bets, statusFilter, tagFilter, dateFilter]);

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

  const visiblePendingIds = rows.filter((r) => r.original.status === "pending").map((r) => r.original.id);
  const allPendingSelected = visiblePendingIds.length > 0 && visiblePendingIds.every((id) => selectedIds.has(id));

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds(visiblePendingIds.every((id) => selectedIds.has(id)) ? new Set() : new Set(visiblePendingIds));
  }

  function runBulk(status: "won" | "lost" | "void") {
    bulkSettle([...selectedIds], status);
    setSelectedIds(new Set());
  }

  useEffect(() => {
    setSelectedIds(new Set());
  }, [statusFilter, tagFilter, globalFilter, dateFilter]);

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

  const sortLabel = (id?: string) =>
    id === "placedAt" ? "registro" : id === "eventAt" ? "evento" : id === "stake" ? "stake" : id === "odds" ? "odd" : id === "status" ? "status" : id ?? "registro";

  return (
    <section className="page page-bets">
      {/* Toolbar única: filtros de status + busca + export */}
      <div className="bets-head">
        <div className="filter-tabs">
          {(["all", "pending", "won", "half_won", "half_lost", "lost", "cashout", "void"] as const).map((s) => (
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
        <div className="bets-head-tools">
          <div className="bets-search">
            <Search size={14} />
            <input
              placeholder="Filtrar apostas..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
            />
            {globalFilter && (
              <button className="bets-search-clear" onClick={() => setGlobalFilter("")} title="Limpar"><X size={12} /></button>
            )}
          </div>
          <button
            className={showFilters ? "bets-tool-btn active" : "bets-tool-btn"}
            onClick={() => setShowFilters((v) => !v)}
            title="Filtros avançados"
          >
            <SlidersHorizontal size={14} />
          </button>
          <button className="bets-tool-btn" onClick={() => downloadTextFile("bancamais-apostas.csv", betsToCsv(state))}>
            Exportar CSV
          </button>
        </div>
      </div>

      <div className="bets-date-filters">
        {([
          ["all", "Tudo"],
          ["today", "Hoje"],
          ["7d", "7 dias"],
          ["30d", "30 dias"],
          ["month", "Mês"],
          ["year", "Ano"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            className={dateFilter === key ? "date-chip active" : "date-chip"}
            onClick={() => setDateFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Resumo financeiro compacto (não repete contagens — essas estão nas abas) */}
      <div className="bets-summary-strip">
        <div className="bets-summary-item">
          <span>Em risco</span>
          <strong className="text-mono">{money.format(openExposure)}</strong>
        </div>
        <div className="bets-summary-item">
          <span>Possível retorno</span>
          <strong className="text-mono">{money.format(pendingPotential)}</strong>
        </div>
        <div className="bets-summary-item">
          <span>Lucro realizado</span>
          <strong className={`text-mono ${settledProfit >= 0 ? "pos" : "neg"}`}>{money.format(settledProfit)}</strong>
        </div>
        <div className="bets-summary-spacer" />
        <span className="bets-summary-sorthint">ordenado por {sortLabel(sorting[0]?.id)}</span>
      </div>

      {/* Filtros avançados (opcional) */}
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

      {allTags.length > 0 && (
        <div className="tag-filter-row">
          {tagFilter && (
            <button className="tag-chip tag-chip-clear" onClick={() => setTagFilter(null)}>
              <X size={10} /> limpar
            </button>
          )}
          {allTags.map((tag) => (
            <button
              key={tag}
              className={tagFilter === tag ? "tag-chip tag-chip-active" : "tag-chip"}
              onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      {selectedIds.size > 0 && (
        <div className="bulk-actions-bar">
          <span className="bulk-count">{selectedIds.size} selecionada{selectedIds.size > 1 ? "s" : ""}</span>
          <div className="bulk-actions-buttons">
            <button className="bulk-btn bulk-won" onClick={() => runBulk("won")}><Check size={13} /> Ganhas</button>
            <button className="bulk-btn bulk-lost" onClick={() => runBulk("lost")}><X size={13} /> Perdidas</button>
            <button className="bulk-btn" onClick={() => runBulk("void")}>Anular</button>
            <button className="bulk-btn bulk-clear" onClick={() => setSelectedIds(new Set())}>Limpar seleção</button>
          </div>
        </div>
      )}

      <div className="table-card">
        <div className="bets-table-wrapper">
          <table className="bets-table bets-table-v2">
            <colgroup>
              <col style={{ width: "38px" }} />
              <col />
              <col style={{ width: "27%" }} />
              <col style={{ width: "108px" }} />
              <col style={{ width: "104px" }} />
              <col style={{ width: "140px" }} />
              <col style={{ width: "104px" }} />
              <col style={{ width: "120px" }} />
            </colgroup>
            <thead>
              <tr>
                <th className="bet-select-col">
                  <input
                    type="checkbox"
                    checked={allPendingSelected}
                    onChange={toggleSelectAll}
                    disabled={visiblePendingIds.length === 0}
                    aria-label="Selecionar todas pendentes"
                  />
                </th>
                <th className="sortable" onClick={() => table.getColumn("eventName")?.toggleSorting()}>
                  Evento <SortIcon colId="eventName" />
                </th>
                <th className="sortable" onClick={() => table.getColumn("market")?.toggleSorting()}>
                  Mercado <SortIcon colId="market" />
                </th>
                <th className="sortable" onClick={() => table.getColumn("bookmakerId")?.toggleSorting()}>
                  Casa <SortIcon colId="bookmakerId" />
                </th>
                <th className="num sortable" onClick={() => table.getColumn("stake")?.toggleSorting()}>
                  Aposta <SortIcon colId="stake" />
                </th>
                <th className="num">Retorno</th>
                <th className="sortable" onClick={() => table.getColumn("status")?.toggleSorting()}>
                  Status <SortIcon colId="status" />
                </th>
                <th className="bet-actions-col">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const bet = row.original;
                const isPending = bet.status === "pending";
                const delta = eventDelta(bet.eventAt);
                const imminent = isPending && isImminent(bet.eventAt);
                const gain = getGainValue(bet);
                const legs = parseLegs(bet.selection);
                return (
                  <tr key={bet.id} className={`bet-row-${bet.status}${imminent ? " bet-row-imminent" : ""}${selectedIds.has(bet.id) ? " bet-row-selected" : ""}`}>
                    <td className="bet-select-col">
                      {isPending && (
                        <input
                          type="checkbox"
                          checked={selectedIds.has(bet.id)}
                          onChange={() => toggleSelect(bet.id)}
                          aria-label="Selecionar aposta"
                        />
                      )}
                    </td>
                    <td className="bet-cell bet-cell-event">
                      <div className="bet-event-line">
                        <strong className="bet-event-name" title={bet.eventName}>{bet.eventName}</strong>
                        {isPending && delta.label && (
                          <span className={`bet-time-chip bet-time-${delta.state}`}>{delta.label}</span>
                        )}
                        {(() => {
                          const chip = clvChip(bet);
                          return chip ? (
                            <span className={`bet-clv-chip bet-clv-${chip.tone}`} title={chip.title}>{chip.label}</span>
                          ) : null;
                        })()}
                      </div>
                      <small className="bet-event-sub">
                        {bet.sport} · {bet.league} · {bet.mode === "live" ? "Live" : "Pré-live"}
                        {bet.source === "ocr" && " · OCR"}
                        {bet.slipImageUrl && (
                          <> · <a className="bet-print-link" href={bet.slipImageUrl} rel="noreferrer" target="_blank">print</a></>
                        )}
                      </small>
                    </td>
                    <td className="bet-cell bet-cell-market" data-label="Mercado">
                      <strong className="bet-market-name" title={bet.market}>{bet.market}</strong>
                      {legs.length > 1 ? (
                        <MultiBetPopover market={bet.market} legs={legs} oddTotal={bet.odds} eventName={bet.eventName} />
                      ) : (
                        <small className="bet-market-sel" title={bet.selection}>{bet.selection}</small>
                      )}
                    </td>
                    <td className="bet-cell" data-label="Casa">
                      <span className="bet-book">{bookmakerById.get(bet.bookmakerId) ?? "—"}</span>
                      {bet.strategyId && <small className="bet-strat">{strategyById.get(bet.strategyId) ?? ""}</small>}
                    </td>
                    <td className="bet-cell num" data-label="Stake">
                      <strong className="text-mono">{money.format(bet.stake)}</strong>
                      <small className="text-mono bet-odd">@ {bet.odds.toFixed(2)} · {(100 / bet.odds).toFixed(0)}%</small>
                    </td>
                    <td className="bet-cell num" data-label="Retorno">
                      <strong className="text-mono">{money.format(getReturnValue(bet))}</strong>
                      <small className={`text-mono ${gain >= 0 ? "pos" : "neg"}`}>
                        {gain >= 0 ? "+" : ""}{money.format(gain)}
                      </small>
                    </td>
                    <td className="bet-cell bet-status-cell" data-label="Status">
                      <StatusBadge status={bet.status} />
                    </td>
                    <td className="bet-cell bet-actions-cell">
                      {confirmDeleteId === bet.id ? (
                        <div className="actions actions-compact">
                          <button className="danger" onClick={() => { deleteBet(bet.id); setConfirmDeleteId(null); }}>Excluir</button>
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
                              >OK</button>
                              <button onClick={() => { setCashoutBetId(null); setCashoutInput(""); }}>×</button>
                            </div>
                          </div>
                        ) : (
                          <div className="bet-settle-actions">
                            <button className="settle-btn settle-won" type="button" title="Liquidar como ganha" onClick={() => settleBet(bet.id, "won")}>
                              <Check size={14} />
                            </button>
                            <button className="settle-btn settle-lost" type="button" title="Liquidar como perdida" onClick={() => settleBet(bet.id, "lost")}>
                              <X size={14} />
                            </button>
                            <div className="bet-actions-menu" ref={actionMenuBetId === bet.id ? actionMenuRef : null}>
                              <button
                                className="bet-actions-trigger settle-more"
                                type="button"
                                onClick={() => setActionMenuBetId((c) => c === bet.id ? null : bet.id)}
                                aria-expanded={actionMenuBetId === bet.id}
                                title="Mais ações"
                              >
                                <MoreHorizontal size={16} />
                              </button>
                              {actionMenuBetId === bet.id && (
                                <div className="bet-actions-dropdown">
                                  <button onClick={() => { onEditBet(bet.id); setActionMenuBetId(null); }}>Editar</button>
                                  <button onClick={() => { settleBet(bet.id, "half_won"); setActionMenuBetId(null); }}>Meia ganha</button>
                                  <button onClick={() => { settleBet(bet.id, "half_lost"); setActionMenuBetId(null); }}>Meia perdida</button>
                                  <button onClick={() => { setCashoutBetId(bet.id); setCashoutInput(""); setActionMenuBetId(null); }}>Cashout</button>
                                  <button onClick={() => { settleBet(bet.id, "void"); setActionMenuBetId(null); }}>Anular (void)</button>
                                  <div className="bet-actions-separator" />
                                  <button className="danger-ghost" onClick={() => { setConfirmDeleteId(bet.id); setActionMenuBetId(null); }}>Excluir</button>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      ) : (
                        <div className="bet-actions-menu" ref={actionMenuBetId === bet.id ? actionMenuRef : null}>
                          <button
                            className="bet-actions-trigger"
                            type="button"
                            onClick={() => setActionMenuBetId((c) => c === bet.id ? null : bet.id)}
                            aria-expanded={actionMenuBetId === bet.id}
                            title="Ações"
                          >
                            <MoreHorizontal size={16} />
                          </button>
                          {actionMenuBetId === bet.id && (
                            <div className="bet-actions-dropdown">
                              <button onClick={() => { onEditBet(bet.id); setActionMenuBetId(null); }}>Editar</button>
                              <div className="bet-actions-separator" />
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
