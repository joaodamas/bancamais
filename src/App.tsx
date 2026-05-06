import { FormEvent, useMemo, useState } from "react";
import { calculateMetrics, clvPercent, groupProfitByBookmaker, groupProfitBySport, money, percent, potentialReturn } from "./lib/metrics";
import { createBetId, loadState, resetState, saveState } from "./lib/storage";
import type { AppState, Bet } from "./lib/types";

type View = "dashboard" | "bets" | "new-bet" | "books" | "settings";

const statusLabel: Record<Bet["status"], string> = {
  pending: "Pendente",
  won: "Ganha",
  lost: "Perdida",
  cashout: "Cashout",
  void: "Cancelada",
};

const navItems: Array<{ id: View; label: string }> = [
  { id: "dashboard", label: "Dashboard" },
  { id: "bets", label: "Apostas" },
  { id: "new-bet", label: "Nova aposta" },
  { id: "books", label: "Bancas & casas" },
  { id: "settings", label: "Configuracoes" },
];

export function App() {
  const [view, setView] = useState<View>("dashboard");
  const [state, setState] = useState<AppState>(() => loadState());
  const metrics = useMemo(() => calculateMetrics(state), [state]);

  function updateState(next: AppState) {
    setState(next);
    saveState(next);
  }

  function addBet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const bet: Bet = {
      id: createBetId(),
      placedAt: new Date().toISOString(),
      eventAt: String(data.get("eventAt")),
      sport: String(data.get("sport")),
      league: String(data.get("league")),
      eventName: String(data.get("eventName")),
      market: String(data.get("market")),
      selection: String(data.get("selection")),
      bookmakerId: String(data.get("bookmakerId")),
      strategyId: String(data.get("strategyId")) || undefined,
      tags: String(data.get("tags"))
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      stake: Number(data.get("stake")),
      odds: Number(data.get("odds")),
      status: "pending",
      closingOdds: Number(data.get("closingOdds")) || undefined,
      mode: String(data.get("mode")) as Bet["mode"],
    };

    updateState({ ...state, bets: [bet, ...state.bets] });
    event.currentTarget.reset();
    setView("bets");
  }

  function settleBet(id: string, status: Bet["status"]) {
    updateState({
      ...state,
      bets: state.bets.map((bet) => {
        if (bet.id !== id) return bet;
        const payout = status === "won" ? potentialReturn(bet) : status === "void" ? bet.stake : 0;
        return { ...bet, status, payout };
      }),
    });
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">+</div>
          <div>
            <strong>Banca+</strong>
            <span>Controle profissional</span>
          </div>
        </div>

        <button className="bank-pill" onClick={() => setView("books")}>
          <span>{state.bankrollName}</span>
          <strong>{money.format(metrics.totalBalance)}</strong>
        </button>

        <nav>
          {navItems.map((item) => (
            <button className={view === item.id ? "active" : ""} key={item.id} onClick={() => setView(item.id)}>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <strong>{viewTitle(view)}</strong>
            <span>Repositorio joaodamas/bancamais · dominio bancamais.jpproject.com.br</span>
          </div>
          <button className="primary" onClick={() => setView("new-bet")}>Nova aposta</button>
        </header>

        {view === "dashboard" && <Dashboard state={state} metrics={metrics} />}
        {view === "bets" && <Bets state={state} settleBet={settleBet} />}
        {view === "new-bet" && <NewBet state={state} addBet={addBet} />}
        {view === "books" && <Books state={state} />}
        {view === "settings" && (
          <Settings
            state={state}
            reset={() => updateState(resetState())}
          />
        )}
      </main>
    </div>
  );
}

function viewTitle(view: View) {
  const item = navItems.find((nav) => nav.id === view);
  return item?.label ?? "Banca+";
}

function Dashboard({ state, metrics }: { state: AppState; metrics: ReturnType<typeof calculateMetrics> }) {
  const byBook = groupProfitByBookmaker(state);
  const bySport = groupProfitBySport(state);
  const bestBook = [...byBook].sort((a, b) => b.profit - a.profit)[0];
  const worstSport = [...bySport].sort((a, b) => a.profit - b.profit)[0];

  return (
    <section className="page">
      <div className="hero">
        <div className="balance-card">
          <span>Banca total</span>
          <strong>{money.format(metrics.totalBalance)}</strong>
          <small>{money.format(metrics.profit)} de resultado liquidado · {money.format(metrics.openExposure)} em aberto</small>
        </div>
        <Metric label="ROI" value={percent.format(metrics.roi)} detail="sobre apostas liquidadas" tone={metrics.roi >= 0 ? "good" : "bad"} />
        <Metric label="Taxa de acerto" value={percent.format(metrics.hitRate)} detail={`${metrics.settledCount} apostas liquidadas`} />
        <Metric label="CLV medio" value={percent.format(metrics.clvAverage)} detail="vs linha de fechamento" tone={metrics.clvAverage >= 0 ? "good" : "bad"} />
      </div>

      <div className="grid two">
        <article className="panel">
          <h2>Insights da etapa</h2>
          <p>
            Melhor casa no seed: <b>{bestBook?.name}</b> com {money.format(bestBook?.profit ?? 0)} de resultado.
            O ponto de atencao atual e <b>{worstSport?.sport}</b>, com {money.format(worstSport?.profit ?? 0)}.
          </p>
          <p>
            Esta versao ja calcula saldo total, exposicao aberta, ROI, yield, taxa de acerto,
            odd media e CLV medio a partir do modelo local.
          </p>
        </article>

        <article className="panel">
          <h2>Distribuicao por esporte</h2>
          {bySport.map((row) => (
            <div className="bar-row" key={row.sport}>
              <span>{row.sport}</span>
              <meter min="0" max={Math.max(...bySport.map((sport) => sport.stake))} value={row.stake} />
              <strong className={row.profit >= 0 ? "pos" : "neg"}>{money.format(row.profit)}</strong>
            </div>
          ))}
        </article>
      </div>
    </section>
  );
}

function Metric({ label, value, detail, tone }: { label: string; value: string; detail: string; tone?: "good" | "bad" }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong className={tone === "good" ? "pos" : tone === "bad" ? "neg" : ""}>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function Bets({ state, settleBet }: { state: AppState; settleBet: (id: string, status: Bet["status"]) => void }) {
  return (
    <section className="page">
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
              <th>Acoes</th>
            </tr>
          </thead>
          <tbody>
            {state.bets.map((bet) => (
              <tr key={bet.id}>
                <td>
                  <strong>{bet.eventName}</strong>
                  <small>{bet.sport} · {bet.league} · {new Date(bet.eventAt).toLocaleString("pt-BR")}</small>
                </td>
                <td>
                  {bet.selection}
                  <small>{bet.market} · {bet.mode}</small>
                </td>
                <td>{state.bookmakers.find((book) => book.id === bet.bookmakerId)?.name}</td>
                <td>{money.format(bet.stake)}</td>
                <td>{bet.odds.toFixed(2)}</td>
                <td>{clvPercent(bet) === null ? "-" : percent.format(clvPercent(bet)!)}</td>
                <td><span className={`pill ${bet.status}`}>{statusLabel[bet.status]}</span></td>
                <td>
                  {bet.status === "pending" ? (
                    <div className="actions">
                      <button onClick={() => settleBet(bet.id, "won")}>Ganha</button>
                      <button onClick={() => settleBet(bet.id, "lost")}>Perdida</button>
                      <button onClick={() => settleBet(bet.id, "void")}>Void</button>
                    </div>
                  ) : (
                    <span>{money.format((bet.payout ?? 0) - bet.stake)}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function NewBet({ state, addBet }: { state: AppState; addBet: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <section className="page">
      <form className="panel form" onSubmit={addBet}>
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
          <span>Entrada manual pronta. OCR entra na proxima etapa.</span>
          <button className="primary" type="submit">Salvar aposta</button>
        </div>
      </form>
    </section>
  );
}

function Books({ state }: { state: AppState }) {
  return (
    <section className="page cards">
      {state.bookmakers.map((book) => (
        <article className="panel book" key={book.id}>
          <span>{book.status}</span>
          <h2>{book.name}</h2>
          <strong>{money.format(book.balance)}</strong>
          <small>Sincronizacao: {book.lastSyncLabel}</small>
        </article>
      ))}
    </section>
  );
}

function Settings({ state, reset }: { state: AppState; reset: () => void }) {
  return (
    <section className="page">
      <article className="panel">
        <h2>Etapa atual</h2>
        <p>
          Produto <b>Banca+</b>, Firebase <b>bancamais-12778</b>, deploy planejado em
          <b> bancamais.jpproject.com.br</b>.
        </p>
        <p>
          Esta entrega usa persistencia local para acelerar validacao. O contrato de dados ja
          esta separado em `src/lib/types.ts` para migrar para Firestore/Cloud Functions.
        </p>
        <button onClick={reset}>Restaurar dados demo de {state.bankrollName}</button>
      </article>
    </section>
  );
}
