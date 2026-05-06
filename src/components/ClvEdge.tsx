import { groupProfitByBookmaker, clvPercent, percent, money } from "../lib/metrics";
import type { AppState } from "../lib/types";
import type { calculateMetrics } from "../lib/metrics";

interface ClvEdgeProps {
  state: AppState;
  metrics: ReturnType<typeof calculateMetrics>;
}

export function ClvEdge({ state, metrics }: ClvEdgeProps) {
  const byBook = groupProfitByBookmaker(state).map((book) => {
    const bets = state.bets.filter((bet) => bet.bookmakerId === book.id);
    const clvs = bets.map(clvPercent).filter((value): value is number => value !== null);
    return {
      ...book,
      clv: clvs.length > 0 ? clvs.reduce((sum, value) => sum + value, 0) / clvs.length : 0,
    };
  });

  return (
    <section className="page">
      <div className="section-head">
        <div>
          <h1>CLV & Edge · Pro</h1>
          <p>Mede se voce esta batendo a linha de fechamento. E o melhor sinal de edge antes do resultado.</p>
        </div>
      </div>

      <div className="grid two">
        <article className="panel clv-hero">
          <span>CLV medio</span>
          <strong className={metrics.clvAverage >= 0 ? "pos" : "neg"}>{percent.format(metrics.clvAverage)}</strong>
          <p>Voce bate a linha em apostas com odd de fechamento registrada.</p>
          <svg viewBox="0 0 600 180" role="img" aria-label="Curva CLV">
            <path d="M20 130 L80 120 L140 100 L200 112 L260 82 L320 70 L380 88 L440 58 L520 42 L580 30" fill="none" stroke="#a78bfa" strokeWidth="4" />
            <path d="M20 130 L80 120 L140 100 L200 112 L260 82 L320 70 L380 88 L440 58 L520 42 L580 30 L580 170 L20 170 Z" fill="rgba(167,139,250,.18)" />
          </svg>
        </article>

        <article className="panel">
          <h2>CLV por casa</h2>
          {byBook.map((book) => (
            <div className="clv-row" key={book.id}>
              <span>{book.name}</span>
              <meter min="-0.1" max="0.1" value={book.clv} />
              <strong className={book.clv >= 0 ? "pos" : "neg"}>{percent.format(book.clv)}</strong>
            </div>
          ))}
        </article>
      </div>
    </section>
  );
}
