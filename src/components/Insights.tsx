import { Lightbulb } from "lucide-react";
import type { AppState } from "../lib/types";
import { buildInsights } from "../lib/insights";
import { EmptyState } from "./EmptyState";

export function Insights({ state }: { state: AppState }) {
  const insights = buildInsights(state);

  return (
    <section className="page">
      <div className="section-head">
        <div>
          <h1>Insights</h1>
          <p>Leitura automática do seu jogo — onde você ganha e onde sangra</p>
        </div>
      </div>

      {insights.length === 0 ? (
        <article className="panel">
          <EmptyState
            icon={<Lightbulb size={24} />}
            title="Sem insights ainda"
            description="Liquide mais apostas (mín. 3) com mercado e liga preenchidos para a leitura automática aparecer."
          />
        </article>
      ) : (
        <div className="insights-list">
          {insights.map((insight, index) => (
            <article key={index} className={`insight-card insight-${insight.tone}`}>
              <span className="insight-dot" />
              <div className="insight-body">
                <strong className="insight-title">{insight.title}</strong>
                <span className="insight-detail">{insight.detail}</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
