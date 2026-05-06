import { betsToCsv, downloadTextFile } from "../lib/csv";
import { money, percent } from "../lib/metrics";
import type { AppState } from "../lib/types";
import type { calculateMetrics } from "../lib/metrics";

interface ReportsProps {
  state: AppState;
  metrics: ReturnType<typeof calculateMetrics>;
}

export function Reports({ state, metrics }: ReportsProps) {
  const settled = state.bets.filter((bet) => bet.status !== "pending");
  const won = settled.filter((bet) => bet.status === "won" || bet.status === "cashout");
  const lost = settled.filter((bet) => bet.status === "lost");
  const totalStaked = state.bets.reduce((sum, bet) => sum + bet.stake, 0);
  const csv = betsToCsv(state);

  return (
    <section className="page">
      <div className="report-grid">
        <article className="panel report-card">
          <span>Relatorio mensal</span>
          <strong>Maio 2026</strong>
          <p>
            Resultado liquidado de <b>{money.format(metrics.profit)}</b>, ROI de <b>{percent.format(metrics.roi)}</b>
            e exposicao aberta de <b>{money.format(metrics.openExposure)}</b>.
          </p>
          <button onClick={() => downloadTextFile("bancamais-relatorio-maio-2026.csv", csv)}>Baixar base CSV</button>
        </article>

        <article className="panel report-card">
          <span>Resumo fiscal</span>
          <strong>{money.format(Math.max(metrics.profit, 0))}</strong>
          <p>
            Valor positivo liquidado no periodo. A regra fiscal final ainda precisa ser validada
            com contador antes de automatizar DARF/IR.
          </p>
          <button onClick={() => downloadTextFile("bancamais-fiscal-base.csv", csv)}>Exportar fiscal</button>
        </article>

        <article className="panel report-card">
          <span>Pagina tipster</span>
          <strong>Banca verificada</strong>
          <p>
            Base pronta para mostrar ROI, yield e historico sem expor valores absolutos.
            Publicacao fica para a etapa de auth/perfil.
          </p>
          <button disabled>Preparar perfil publico</button>
        </article>
      </div>

      <div className="grid two report-section">
        <article className="panel">
          <h2>Resumo operacional</h2>
          <div className="summary-list">
            <div><span>Apostas totais</span><strong>{state.bets.length}</strong></div>
            <div><span>Liquidadas</span><strong>{settled.length}</strong></div>
            <div><span>Ganhas/cashout</span><strong>{won.length}</strong></div>
            <div><span>Perdidas</span><strong>{lost.length}</strong></div>
            <div><span>Valor apostado</span><strong>{money.format(totalStaked)}</strong></div>
            <div><span>Yield</span><strong>{percent.format(metrics.yield)}</strong></div>
          </div>
        </article>

        <article className="panel">
          <h2>Transacoes</h2>
          <div className="transaction-list">
            {state.transactions.map((transaction) => (
              <div key={transaction.id}>
                <span>
                  {new Date(transaction.date).toLocaleDateString("pt-BR")} · {transaction.description}
                </span>
                <strong className={transaction.amount >= 0 ? "pos" : "neg"}>{money.format(transaction.amount)}</strong>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
