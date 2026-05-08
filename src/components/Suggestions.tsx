import { BrainCircuit, DatabaseZap, Radar, RefreshCw, Target } from "lucide-react";
import { EmptyState } from "./EmptyState";
import { LoadingSkeleton } from "./LoadingSkeleton";
import { percent } from "../lib/metrics";
import {
  formatCoverage,
  formatFeedStatus,
  formatFixtureStatus,
  formatProfit,
  formatSuggestionStatus,
} from "../lib/suggestions";
import { useSuggestions } from "../lib/useSuggestions";
import type { AppState, NewBetPrefill } from "../lib/types";

interface SuggestionsProps {
  state: AppState;
  onOpenNewBet: (prefill?: NewBetPrefill | null) => void;
}

export function Suggestions({ state, onOpenNewBet }: SuggestionsProps) {
  const { workspace, loading, error, source, usingCache, note, lastUpdatedAt, refresh } = useSuggestions(state);
  const readySuggestions = workspace.suggestions.filter((item) => item.status === "ready").length;
  const queuedSuggestions = workspace.suggestions.filter((item) => item.status === "queued").length;
  const pricedFixtures = workspace.fixtures.filter((item) => item.status !== "monitoring").length;
  const performanceReady = workspace.performance.settledSuggestions > 0;
  const operationalReady = workspace.readiness.every((item) => item.ready);
  const firstReadySuggestion = workspace.suggestions.find((item) => item.status === "ready") ?? workspace.suggestions[0];
  const runtimeModeLabel = source === "live" ? "Ao vivo" : "Demonstracao";
  const runtimeModeDescription =
    source === "live"
      ? "Fixtures, odds e fila vieram do backend configurado."
      : "Fixtures, odds e fila vieram do scaffold local para demonstracao operacional.";
  const cacheLabel = usingCache ? "Cache operacional" : source === "live" ? "Atualizacao recente" : "Fallback local";
  const cacheDescription = lastUpdatedAt
    ? new Date(lastUpdatedAt).toLocaleString("pt-BR")
    : "Sem coleta recente";

  function toDatetimeLocal(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }

  function buildSuggestionPrefill(suggestionId: string): NewBetPrefill | null {
    const suggestion = workspace.suggestions.find((item) => item.id === suggestionId);
    if (!suggestion) return null;

    const fixture = workspace.fixtures.find((item) => item.id === suggestion.fixtureId);
    if (!fixture) return null;

    const matchedBookmaker = suggestion.linkedBookmakers
      .map((name) => state.bookmakers.find((book) => book.name.trim().toLowerCase() === name.trim().toLowerCase()))
      .find(Boolean);

    return {
      eventName: `${fixture.homeTeam} x ${fixture.awayTeam}`,
      eventAt: toDatetimeLocal(fixture.startsAt),
      sport: fixture.sport,
      league: fixture.league,
      market: suggestion.marketLabel,
      selection: suggestion.selectionLabel,
      bookmakerId: matchedBookmaker?.id,
      odds: suggestion.targetOdds.toFixed(2),
      mode: "prelive",
      tags: "ia,sugestao",
      source: "ai_suggestion",
      suggestionId: suggestion.id,
      fixtureId: fixture.id,
      estimatedProbability: suggestion.estimatedProbability,
      estimatedEdge: suggestion.edge,
      confidenceScore: suggestion.confidence,
    };
  }

  if (loading) {
    return (
      <section className="suggestions-section">
        <div className="section-head suggestions-head">
          <div>
            <h2>Sugestões IA</h2>
            <p>Buscando partidas e estimando edge via API…</p>
          </div>
        </div>
        <div className="suggestions-loading-layout" aria-hidden="true">
          <div className="ops-summary-grid">
            {Array.from({ length: 3 }).map((_, index) => (
              <article key={index} className="ops-summary-card">
                <LoadingSkeleton lines={3} height={index === 1 ? 24 : 20} />
              </article>
            ))}
          </div>
          <div className="grid two suggestions-grid">
            <article className="panel">
              <LoadingSkeleton lines={6} height={16} />
            </article>
            <article className="panel">
              <LoadingSkeleton lines={6} height={16} />
            </article>
          </div>
          <div className="table-card suggestions-table-card">
            <LoadingSkeleton lines={7} height={18} />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="suggestions-section">
      {error && (
        <div className="suggestions-api-warning">
          <span>{error}</span>
        </div>
      )}

      <div className="section-head suggestions-head">
        <div>
          <h2>Sugestões IA</h2>
          <p>Workspace operacional para jogos futuros, preços capturados, fila de publicação e leitura de performance.</p>
        </div>
        <button type="button" className="btn-ghost suggestions-refresh-button" onClick={refresh}>
          <RefreshCw size={14} />
          Atualizar
        </button>
      </div>

      <div className="ops-summary-grid">
        <article className="ops-summary-card">
          <span>Modo da superfície</span>
          <strong>{runtimeModeLabel}</strong>
          <small>{runtimeModeDescription}</small>
        </article>
        <article className="ops-summary-card">
          <span>Origem ativa</span>
          <strong>{cacheLabel}</strong>
          <small>{note ?? cacheDescription}</small>
        </article>
        <article className="ops-summary-card">
          <span>Jogos futuros</span>
          <strong>{workspace.fixtures.length}</strong>
          <small>
            {source === "live"
              ? `${pricedFixtures} com precificacao inicial vinda dos feeds ativos.`
              : `${pricedFixtures} com precificacao demonstrativa para validar a experiencia.`}
          </small>
        </article>
        <article className="ops-summary-card">
          <span>Odds monitoradas</span>
          <strong>{workspace.odds.length}</strong>
          <small>
            {workspace.odds.map((item) => item.bookmakerName).filter((value, index, list) => list.indexOf(value) === index).length} casa(s) mapeada(s)
            {source === "live" ? " no feed ativo." : " no fallback local."}
          </small>
        </article>
      </div>

      <div className="grid two suggestions-grid">
        <article className="panel">
          <div className="suggestions-panel-head">
            <div>
              <span className="suggestions-kicker">Pipeline</span>
              <h3>Saúde da operação</h3>
            </div>
            <Radar size={16} />
          </div>

          <div className="suggestions-feed-list">
            {workspace.feeds.map((feed) => (
              <div key={feed.label} className="suggestions-feed-item">
                <div>
                  <strong>{feed.label}</strong>
                  <p>
                    {feed.detail}
                    {source === "fallback" ? " · leitura demonstrativa" : ""}
                  </p>
                </div>
                <span className={`suggestions-status-chip ${feed.status}`}>{formatFeedStatus(feed.status)}</span>
              </div>
            ))}
          </div>

          <div className="suggestions-readiness">
            {workspace.readiness.map((item) => (
              <div key={item.label} className={`suggestions-readiness-item ${item.ready ? "ready" : "pending"}`}>
                <strong>{item.label}</strong>
                <span>{item.detail}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="suggestions-panel-head">
            <div>
              <span className="suggestions-kicker">Performance</span>
              <h3>Execução das sugestões</h3>
            </div>
            <Target size={16} />
          </div>

          {performanceReady ? (
            <>
              <div className="summary-list compact">
              <div><span>Sugestões adotadas</span><strong>{workspace.performance.adoptedSuggestions}</strong></div>
              <div><span>Liquidadas</span><strong>{workspace.performance.settledSuggestions}</strong></div>
              <div><span>Win rate</span><strong>{workspace.performance.winRate === null ? "-" : percent.format(workspace.performance.winRate)}</strong></div>
                <div><span>ROI</span><strong className={workspace.performance.roi == null ? "" : workspace.performance.roi >= 0 ? "pos" : "neg"}>{workspace.performance.roi === null ? "-" : percent.format(workspace.performance.roi)}</strong></div>
                <div><span>Lucro</span><strong className={workspace.performance.profit >= 0 ? "pos" : "neg"}>{formatProfit(workspace.performance.profit)}</strong></div>
                <div><span>CLV médio</span><strong>{workspace.performance.averageClv === null ? "-" : percent.format(workspace.performance.averageClv)}</strong></div>
              </div>
            </>
          ) : (
            <EmptyState
              icon={<BrainCircuit size={20} />}
              title="Sem histórico de sugestão liquidado"
              description="A tela já está preparada para medir adoção, ROI, edge e CLV assim que entradas com origem IA começarem a ser executadas."
              action={{
                label: "Registrar aposta vinculada",
                onClick: () => onOpenNewBet(firstReadySuggestion ? buildSuggestionPrefill(firstReadySuggestion.id) : null),
              }}
            />
          )}

          <div className="suggestions-performance-note">
            <span>Fonte de performance</span>
            <strong>
              {workspace.performance.trackedSuggestions > 0
                ? `${workspace.performance.trackedSuggestions} aposta(s) com source ai_suggestion`
                : source === "live"
                  ? "Aguardando primeiras sugestoes adotadas nesta operacao"
                  : "Aguardando sugestoes adotadas; o workspace atual esta em demonstracao"}
            </strong>
          </div>
        </article>
      </div>

      <div className="table-card suggestions-table-card">
        <div className="suggestions-table-head">
          <div>
            <strong>Jogos em monitoramento</strong>
            <span>
              {source === "live"
                ? "Fixtures futuros com estrutura de preco vinda dos feeds externos."
                : "Fixtures futuros demonstrativos para validar a experiencia enquanto os feeds externos estao indisponiveis."}
            </span>
          </div>
          <DatabaseZap size={16} />
        </div>
        <table>
          <thead>
            <tr>
              <th>Evento</th>
              <th>Mercado foco</th>
              <th>Casa</th>
              <th>Odd</th>
              <th>Cobertura</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {workspace.fixtures.map((fixture) => {
              const topOdd = workspace.odds.find((item) => item.fixtureId === fixture.id);
              return (
                <tr key={fixture.id}>
                  <td>
                    <strong>{fixture.homeTeam} vs {fixture.awayTeam}</strong>
                    <small>{fixture.sport} · {fixture.league} · {new Date(fixture.startsAt).toLocaleString("pt-BR")}</small>
                  </td>
                  <td>
                    {topOdd?.selectionLabel ?? "-"}
                    <small>{topOdd?.marketLabel ?? "Sem mercado primário ainda"}</small>
                  </td>
                  <td>{topOdd?.bookmakerName ?? "-"}</td>
                  <td>{topOdd ? topOdd.decimalOdds.toFixed(2) : "-"}</td>
                  <td>{formatCoverage(fixture.coverage)}</td>
                  <td><span className={`pill suggestion-pill ${fixture.status}`}>{formatFixtureStatus(fixture.status)}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="table-card suggestions-table-card">
        <div className="suggestions-table-head">
          <div>
            <strong>Fila de recomendação</strong>
            <span>
              {source === "live"
                ? "Sugestoes calculadas para revisao e execucao operacional."
                : "Payload demonstrativo para validar UX e rastreio antes da publicacao automatica."}
            </span>
          </div>
          <BrainCircuit size={16} />
        </div>

        {workspace.suggestions.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Sugestão</th>
                <th>Entrada</th>
                <th>Edge</th>
                <th>Confiança</th>
                <th>Stake</th>
                <th>Status</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              {workspace.suggestions.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.title}</strong>
                    <small>
                      {item.linkedBookmakers.join(", ")} · {new Date(item.generatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      {source === "fallback" ? " · demonstracao" : ""}
                    </small>
                  </td>
                  <td>
                    {item.selectionLabel}
                    <small>Min {item.minimumOdds.toFixed(2)} · Alvo {item.targetOdds.toFixed(2)}</small>
                  </td>
                  <td className={item.edge >= 0 ? "pos" : "neg"}>{percent.format(item.edge)}</td>
                  <td>{percent.format(item.confidence)}</td>
                  <td>{item.stakeUnits.toFixed(2)}u</td>
                  <td><span className={`pill suggestion-pill ${item.status}`}>{formatSuggestionStatus(item.status)}</span></td>
                  <td>
                    <button
                      type="button"
                      className="btn-ghost suggestions-use-button"
                      onClick={() => onOpenNewBet(buildSuggestionPrefill(item.id))}
                    >
                      {source === "live" ? "Usar" : "Usar demo"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="table-empty rich">
            <strong>Fila sem payloads</strong>
            <span>O componente já aceita fixtures, odds e sugestões; falta apenas o produtor backend publicar objetos nesta fila.</span>
          </div>
        )}
      </div>

      {!operationalReady && (
        <article className="panel suggestions-empty-panel">
          <EmptyState
            icon={<Radar size={20} />}
            title="Ambiente ainda incompleto para publicação automática"
            description={
              source === "live"
                ? "A UI ja esta pronta para consumo, mas a operacao fica mais util quando houver casas, estrategias ativas e historico minimo para calibrar os scores."
                : "A superficie esta funcional para demonstracao, mas a publicacao automatica ganha valor real quando os feeds externos, casas e historico operacional estiverem completos."
            }
          />
        </article>
      )}

      <div className="suggestions-rationale-grid">
        {workspace.suggestions.slice(0, 2).map((item) => (
          <article key={item.id} className="panel suggestions-rationale-card">
            <div className="suggestions-panel-head">
              <div>
                <span className="suggestions-kicker">Racional</span>
                <h3>{item.selectionLabel}</h3>
              </div>
            </div>
            <div className="suggestions-rationale-meta">
              <span>{item.marketLabel}</span>
              <strong>Odd alvo {item.targetOdds.toFixed(2)}</strong>
            </div>
            <ul>
              {item.rationale.map((line) => <li key={line}>{line}</li>)}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
