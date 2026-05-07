import { BrainCircuit, DatabaseZap, Radar, Target } from "lucide-react";
import { EmptyState } from "./EmptyState";
import { percent } from "../lib/metrics";
import {
  buildSuggestionsWorkspace,
  formatCoverage,
  formatFeedStatus,
  formatFixtureStatus,
  formatProfit,
  formatSuggestionStatus,
} from "../lib/suggestions";
import type { AppState, NewBetPrefill } from "../lib/types";

interface SuggestionsProps {
  state: AppState;
  onOpenNewBet: (prefill?: NewBetPrefill | null) => void;
}

export function Suggestions({ state, onOpenNewBet }: SuggestionsProps) {
  const workspace = buildSuggestionsWorkspace(state);
  const readySuggestions = workspace.suggestions.filter((item) => item.status === "ready").length;
  const queuedSuggestions = workspace.suggestions.filter((item) => item.status === "queued").length;
  const pricedFixtures = workspace.fixtures.filter((item) => item.status !== "monitoring").length;
  const performanceReady = workspace.performance.settledSuggestions > 0;
  const operationalReady = workspace.readiness.every((item) => item.ready);
  const firstReadySuggestion = workspace.suggestions.find((item) => item.status === "ready") ?? workspace.suggestions[0];

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

  return (
    <section className="suggestions-section">
      <div className="section-head suggestions-head">
        <div>
          <h2>Sugestões IA</h2>
          <p>Workspace operacional para jogos futuros, preços capturados, fila de publicação e leitura de performance.</p>
        </div>
        <div className="suggestions-stage">Scaffold local · pronto para backend</div>
      </div>

      <div className="ops-summary-grid">
        <article className="ops-summary-card">
          <span>Jogos futuros</span>
          <strong>{workspace.fixtures.length}</strong>
          <small>{pricedFixtures} com precificação inicial e cobertura pronta para ingestão real.</small>
        </article>
        <article className="ops-summary-card">
          <span>Odds monitoradas</span>
          <strong>{workspace.odds.length}</strong>
          <small>{workspace.odds.map((item) => item.bookmakerName).filter((value, index, list) => list.indexOf(value) === index).length} casas mapeadas no scaffold atual.</small>
        </article>
        <article className="ops-summary-card">
          <span>Fila de sugestões</span>
          <strong>{readySuggestions + queuedSuggestions}</strong>
          <small>{readySuggestions} pronta(s) para publicação e {queuedSuggestions} em revisão.</small>
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
                  <p>{feed.detail}</p>
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
            <strong>{workspace.performance.trackedSuggestions > 0 ? `${workspace.performance.trackedSuggestions} aposta(s) com source ai_suggestion` : "Aguardando integração com backend de publicação"}</strong>
          </div>
        </article>
      </div>

      <div className="table-card suggestions-table-card">
        <div className="suggestions-table-head">
          <div>
            <strong>Jogos em monitoramento</strong>
            <span>Fixtures futuros com estrutura de preço e cobertura pronta para sincronizar feeds externos.</span>
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
            <span>Modelo de payload para backend de sugestão, publicação e rastreio de execução.</span>
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
                    <small>{item.linkedBookmakers.join(", ")} · {new Date(item.generatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</small>
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
                      Usar
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
            description="A UI já está pronta para consumo, mas a operação fica mais útil quando houver casas, estratégias ativas e histórico mínimo para calibrar os scores."
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
