import { useMemo, useState } from "react";
import {
  ArrowDownLeft, ArrowUpRight, ArrowLeftRight, SlidersHorizontal,
  Ban, Trophy, CircleDollarSign, Undo2, Receipt,
} from "lucide-react";
import { money } from "../lib/metrics";
import { computeGlobalLedger, TRANSACTION_TYPE_LABELS } from "../lib/ledger";
import type { AppState, TransactionType } from "../lib/types";

interface StatementProps {
  state: AppState;
  onOpenBets: () => void;
}

type CategoryFilter = "all" | "bets" | "cash";
type PeriodFilter = "7d" | "30d" | "90d" | "all";

const CATEGORY_TABS: { id: CategoryFilter; label: string }[] = [
  { id: "all", label: "Tudo" },
  { id: "bets", label: "Apostas" },
  { id: "cash", label: "Caixa" },
];

const PERIOD_TABS: { id: PeriodFilter; label: string; days: number | null }[] = [
  { id: "7d", label: "7 dias", days: 7 },
  { id: "30d", label: "30 dias", days: 30 },
  { id: "90d", label: "90 dias", days: 90 },
  { id: "all", label: "Tudo", days: null },
];

const BET_TYPES: TransactionType[] = ["bet_stake", "bet_payout", "bet_refund"];

const TYPE_ICON: Record<TransactionType, typeof Receipt> = {
  deposit: ArrowDownLeft,
  withdrawal: ArrowUpRight,
  transfer: ArrowLeftRight,
  adjustment: SlidersHorizontal,
  bet_stake: CircleDollarSign,
  bet_payout: Trophy,
  bet_refund: Undo2,
  void_entry: Ban,
};

function isBetType(type: TransactionType): boolean {
  return BET_TYPES.includes(type);
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

export function Statement({ state, onOpenBets }: StatementProps) {
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [period, setPeriod] = useState<PeriodFilter>("30d");
  const [bookmakerId, setBookmakerId] = useState<string>("all");

  const bookmakerName = useMemo(
    () => new Map(state.bookmakers.map((book) => [book.id, book.name])),
    [state.bookmakers],
  );

  const ledger = useMemo(() => computeGlobalLedger(state), [state]);

  const cutoff = useMemo(() => {
    const days = PERIOD_TABS.find((tab) => tab.id === period)?.days ?? null;
    if (days === null) return null;
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString();
  }, [period]);

  const filtered = useMemo(() => {
    return ledger
      .filter(({ transaction: t }) => {
        if (cutoff && t.date < cutoff) return false;
        if (category === "bets" && !isBetType(t.type)) return false;
        if (category === "cash" && isBetType(t.type)) return false;
        if (bookmakerId !== "all" && t.bookmakerId !== bookmakerId && t.targetBookmakerId !== bookmakerId) {
          return false;
        }
        return true;
      })
      .reverse();
  }, [ledger, cutoff, category, bookmakerId]);

  const totals = useMemo(() => {
    let inflow = 0;
    let outflow = 0;
    for (const { transaction: t, isVoided } of filtered) {
      if (isVoided) continue;
      if (t.amount >= 0) inflow += t.amount;
      else outflow += t.amount;
    }
    return { inflow, outflow, net: inflow + outflow, count: filtered.length };
  }, [filtered]);

  const groups = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const entry of filtered) {
      const key = dayKey(entry.transaction.date);
      const bucket = map.get(key);
      if (bucket) bucket.push(entry);
      else map.set(key, [entry]);
    }
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <section className="page">
      <div className="dashboard-command panel">
        <div className="dashboard-command-copy">
          <span className="dashboard-kicker">Linha do tempo</span>
          <h1>Extrato consolidado da operação</h1>
          <p>Apostas, depósitos, saques e transferências numa única timeline cronológica com saldo da banca evoluindo.</p>
        </div>
      </div>

      <div className="ops-summary-grid">
        <article className="ops-summary-card">
          <span>Entradas</span>
          <strong className="statement-pos">{money.format(totals.inflow)}</strong>
          <small>Depósitos, liquidações e estornos no período.</small>
        </article>
        <article className="ops-summary-card">
          <span>Saídas</span>
          <strong className="statement-neg">{money.format(totals.outflow)}</strong>
          <small>Saques e stakes apostados no período.</small>
        </article>
        <article className="ops-summary-card">
          <span>Resultado líquido</span>
          <strong className={`text-mono ${totals.net >= 0 ? "statement-pos" : "statement-neg"}`}>
            {totals.net >= 0 ? "+" : ""}{money.format(totals.net)}
          </strong>
          <small>Saldo de movimentações filtradas (transferências internas se anulam).</small>
        </article>
        <article className="ops-summary-card">
          <span>Lançamentos</span>
          <strong className="text-mono">{totals.count}</strong>
          <small>Eventos exibidos com os filtros atuais.</small>
        </article>
      </div>

      <div className="statement-toolbar panel">
        <div className="statement-filter-group">
          <span className="dashboard-kicker">Categoria</span>
          <div className="chart-period-tabs">
            {CATEGORY_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`chart-period-tab${category === tab.id ? " active" : ""}`}
                onClick={() => setCategory(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <div className="statement-filter-group">
          <span className="dashboard-kicker">Período</span>
          <div className="chart-period-tabs">
            {PERIOD_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`chart-period-tab${period === tab.id ? " active" : ""}`}
                onClick={() => setPeriod(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <label className="statement-book-filter">
          <span className="dashboard-kicker">Casa</span>
          <select value={bookmakerId} onChange={(e) => setBookmakerId(e.target.value)}>
            <option value="all">Todas as casas</option>
            {state.bookmakers.map((book) => (
              <option key={book.id} value={book.id}>{book.name}</option>
            ))}
          </select>
        </label>
      </div>

      {filtered.length === 0 ? (
        <article className="panel statement-empty">
          <Receipt size={28} aria-hidden />
          <h2>Nenhuma movimentação no recorte</h2>
          <p>Ajuste os filtros de categoria, período ou casa para ver os lançamentos da operação.</p>
        </article>
      ) : (
        <div className="statement-timeline">
          {groups.map(([key, entries]) => {
            const dayNet = entries.reduce(
              (sum, { transaction: t, isVoided }) => (isVoided ? sum : sum + t.amount),
              0,
            );
            return (
              <div className="statement-day" key={key}>
                <header className="statement-day-head">
                  <h3>
                    {new Date(`${key}T12:00:00`).toLocaleDateString("pt-BR", {
                      weekday: "short",
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </h3>
                  <span className={`statement-day-net text-mono ${dayNet >= 0 ? "statement-pos" : "statement-neg"}`}>
                    {dayNet >= 0 ? "+" : ""}{money.format(dayNet)}
                  </span>
                </header>
                <ul className="statement-list">
                  {entries.map(({ transaction: t, runningBalance, isVoided }) => {
                    const Icon = TYPE_ICON[t.type];
                    const isVoidEntry = t.type === "void_entry";
                    const betLinked = t.referenceType === "bet" && isBetType(t.type);
                    const origin = bookmakerName.get(t.bookmakerId) ?? "—";
                    const target = t.targetBookmakerId ? bookmakerName.get(t.targetBookmakerId) : null;
                    const houseLabel = t.type === "transfer" && target ? `${origin} → ${target}` : origin;
                    return (
                      <li
                        key={t.id}
                        className={`statement-row${isVoided ? " statement-row-voided" : ""}${isVoidEntry ? " statement-row-void-entry" : ""}${betLinked ? " statement-row-clickable" : ""}`}
                        onClick={betLinked ? onOpenBets : undefined}
                        role={betLinked ? "button" : undefined}
                        tabIndex={betLinked ? 0 : undefined}
                        onKeyDown={betLinked ? (e) => { if (e.key === "Enter") onOpenBets(); } : undefined}
                      >
                        <span className={`statement-icon statement-icon-${t.type}`} aria-hidden>
                          <Icon size={16} />
                        </span>
                        <div className="statement-body">
                          <div className="statement-line">
                            <span className={`statement-type-badge statement-type-${t.type}`}>
                              {TRANSACTION_TYPE_LABELS[t.type]}
                            </span>
                            <span className="statement-desc">{t.description}</span>
                            {isVoided && <span className="statement-voided-tag">Anulado</span>}
                          </div>
                          <div className="statement-meta">
                            <span>{houseLabel}</span>
                            <span className="statement-dot">·</span>
                            <span>
                              {new Date(t.date).toLocaleTimeString("pt-BR", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                        </div>
                        <div className="statement-amounts">
                          <span className={`statement-amount text-mono ${t.amount >= 0 ? "statement-pos" : "statement-neg"}${isVoided ? " statement-struck" : ""}`}>
                            {t.amount >= 0 ? "+" : ""}{money.format(t.amount)}
                          </span>
                          <span className="statement-running text-mono">{money.format(runningBalance)}</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
