import { useState, useMemo } from "react";
import { Coins, RefreshCw } from "lucide-react";
import type { NewBetPrefill } from "../lib/types";
import {
  SUPPORTED_SPORTS,
  fetchSportOdds,
  isOddsMarketConfigured,
  sportNameFromKey,
  type MarketOddsEvent,
  type MarketOddsOutcome,
} from "../lib/oddsMarket";
import { EmptyState } from "./EmptyState";

function dateShort(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function timeShort(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function toDatetimeLocal(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function outcomeLabel(side: MarketOddsOutcome["side"]): string {
  return side === "home" ? "1" : side === "draw" ? "X" : "2";
}

/** Logo da casa via favicon do domínio (heurística no nome: "1xBet" -> 1xbet.com). */
function bookmakerLogo(name: string): string {
  const domain = name
    .replace(/\(.*?\)/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return `https://www.google.com/s2/favicons?domain=${domain}.com&sz=128`;
}

export function Odds({ onOpenNewBet }: { onOpenNewBet: (prefill: NewBetPrefill) => void }) {
  const [sportKey, setSportKey] = useState<string | null>(null);
  const [events, setEvents] = useState<MarketOddsEvent[]>([]);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);

  const sportLabel = SUPPORTED_SPORTS.find((sport) => sport.key === sportKey)?.label ?? "";

  const highlights = useMemo(() => {
    const items: Array<{ event: MarketOddsEvent; outcome: MarketOddsOutcome; edge: number }> = [];
    for (const event of events) {
      for (const outcome of event.outcomes) {
        if (outcome.fairOdds != null && outcome.best > outcome.fairOdds) {
          items.push({ event, outcome, edge: (outcome.best / outcome.fairOdds - 1) * 100 });
        }
      }
    }
    return items.sort((a, b) => b.edge - a.edge).slice(0, 6);
  }, [events]);

  async function selectSport(key: string) {
    setSportKey(key);
    setTouched(true);
    setLoading(true);
    const result = await fetchSportOdds(key);
    setEvents(result.events);
    setRemaining(result.requestsRemaining);
    setLoading(false);
  }

  function register(event: MarketOddsEvent, outcome: MarketOddsOutcome) {
    onOpenNewBet({
      eventName: `${event.homeTeam} x ${event.awayTeam}`,
      eventAt: toDatetimeLocal(event.commenceTime),
      sport: sportKey ? sportNameFromKey(sportKey) : "Futebol",
      league: sportLabel,
      market: "Moneyline",
      selection: outcome.name,
      odds: String(outcome.best),
    });
  }

  if (!isOddsMarketConfigured()) {
    return (
      <section className="page">
        <article className="panel">
          <EmptyState
            icon={<Coins size={24} />}
            title="Odds indisponíveis"
            description="Configure o Firebase para habilitar o mercado de odds."
          />
        </article>
      </section>
    );
  }

  return (
    <section className="page odds-page">
      <div className="section-head">
        <div>
          <h1>Odds</h1>
          <p>Mercado ao vivo · melhor preço entre casas vs. linha justa</p>
        </div>
        {sportKey && (
          <button className="odds-refresh" type="button" onClick={() => selectSport(sportKey)} disabled={loading}>
            <RefreshCw size={14} /> Atualizar
          </button>
        )}
      </div>

      <div className="odds-toolbar">
        <div className="odds-sports">
          {SUPPORTED_SPORTS.map((sport) => (
            <button
              key={sport.key}
              type="button"
              className={`odds-sport-chip ${sportKey === sport.key ? "active" : ""}`}
              onClick={() => selectSport(sport.key)}
              disabled={loading}
            >
              <span className="odds-sport-icon">{sport.icon}</span>
              {sport.label}
            </button>
          ))}
        </div>
        <span className="odds-quota">
          {remaining != null ? `${remaining}/500 créditos` : "cada busca = 1 crédito"}
        </span>
      </div>

      {loading ? (
        <article className="panel"><div className="odds-status">Buscando odds de {sportLabel}…</div></article>
      ) : !touched ? (
        <article className="panel">
          <EmptyState
            icon={<Coins size={24} />}
            title="Escolha um campeonato"
            description="Selecione acima para ver os jogos e comparar o melhor preço entre casas. Cada busca consome 1 crédito do plano grátis (500/mês)."
          />
        </article>
      ) : events.length === 0 ? (
        <article className="panel">
          <EmptyState
            icon={<Coins size={24} />}
            title={`Sem jogos futuros em ${sportLabel}`}
            description="Pode estar fora de temporada ou sem mercado aberto agora. Tente outro campeonato."
          />
        </article>
      ) : (
        <>
        {highlights.length > 0 && (
          <div className="odds-highlights">
            <div className="odds-highlights-head">
              <span className="odds-highlights-title">Destaques de valor</span>
              <span className="odds-highlights-sub">maior edge vs. linha justa · clique pra registrar</span>
            </div>
            <div className="odds-highlights-list">
              {highlights.map(({ event, outcome, edge }) => (
                <button
                  key={`${event.id}-${outcome.side}`}
                  type="button"
                  className="odds-highlight"
                  onClick={() => register(event, outcome)}
                >
                  <span className="odds-highlight-edge">+{edge.toFixed(1)}%</span>
                  <span className="odds-highlight-main">
                    <span className="odds-highlight-pick">{outcome.name}</span>
                    <span className="odds-highlight-event">{event.homeTeam} × {event.awayTeam}</span>
                  </span>
                  <span className="odds-highlight-line">
                    <strong>{outcome.best.toFixed(2)}</strong>
                    <img className="odds-highlight-logo" src={bookmakerLogo(outcome.bestBook)} alt={outcome.bestBook} title={outcome.bestBook} loading="lazy" />
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="odds-board">
          {events.map((event) => (
            <div key={event.id} className="odds-row">
              <span className="odds-row-time">
                <em>{dateShort(event.commenceTime)}</em>
                <strong>{timeShort(event.commenceTime)}</strong>
              </span>
              <div className="odds-row-event">
                <span className="odds-row-team">{event.homeTeam}</span>
                <span className="odds-row-team">{event.awayTeam}</span>
              </div>
              <div className={`odds-cells ${event.outcomes.length === 2 ? "two" : ""}`}>
                {event.outcomes.map((outcome) => {
                  const isValue = outcome.fairOdds != null && outcome.best > outcome.fairOdds;
                  const edge = isValue && outcome.fairOdds ? (outcome.best / outcome.fairOdds - 1) * 100 : 0;
                  return (
                    <button
                      key={outcome.side}
                      type="button"
                      className={`odds-cell ${isValue ? "value" : ""}`}
                      onClick={() => register(event, outcome)}
                      title={`${outcome.name} · melhor: ${outcome.bestBook} · justo ${outcome.fairOdds != null ? outcome.fairOdds.toFixed(2) : "—"}`}
                    >
                      {isValue && <span className="odds-cell-edge">+{edge.toFixed(1)}%</span>}
                      <span className="odds-cell-label">{outcomeLabel(outcome.side)}</span>
                      <span className="odds-cell-odd">{outcome.best.toFixed(2)}</span>
                      <img className="odds-cell-logo" src={bookmakerLogo(outcome.bestBook)} alt={outcome.bestBook} title={outcome.bestBook} loading="lazy" />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        </>
      )}
    </section>
  );
}
