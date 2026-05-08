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
  const currentMonthLabel = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date());
  const settlementRate = state.bets.length > 0 ? settled.length / state.bets.length : 0;
  const transactionBalance = state.transactions.reduce((sum, transaction) => sum + transaction.amount, 0);
  const latestTransactions = [...state.transactions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 6);

  return (
    <section className="page">
      <div className="dashboard-command panel report-command">
        <div className="dashboard-command-copy">
          <span className="dashboard-kicker">Central analítica</span>
          <h1>Relatórios executivos da operação</h1>
          <p>Consolide resultados, base fiscal e movimentação financeira com uma leitura mais clara para decisão e prestação de contas.</p>
        </div>
        <div className="dashboard-command-actions">
          <button className="primary" onClick={() => downloadTextFile("bancamais-relatorio-operacional.csv", csv)}>Exportar base</button>
          <button onClick={() => downloadTextFile("bancamais-fiscal-base.csv", csv)}>Base fiscal</button>
        </div>
      </div>

      <div className="page-actions">
        <div className="page-actions-copy">
          <strong>Relatórios operacionais</strong>
          <span>Consolide performance, fiscal e movimentação com uma leitura menos provisória e mais acionável.</span>
        </div>
      </div>

      <div className="dashboard-mini-grid">
        <article className="panel dashboard-mini-card">
          <span>Lucro liquidado</span>
          <strong className={metrics.profit >= 0 ? "pos" : "neg"}>{money.format(metrics.profit)}</strong>
          <small>Resultado financeiro confirmado até agora.</small>
        </article>
        <article className="panel dashboard-mini-card">
          <span>Yield</span>
          <strong>{percent.format(metrics.yield)}</strong>
          <small>Eficiência sobre o volume efetivamente apostado.</small>
        </article>
        <article className="panel dashboard-mini-card">
          <span>Fluxo lançado</span>
          <strong className={transactionBalance >= 0 ? "pos" : "neg"}>{money.format(transactionBalance)}</strong>
          <small>Leitura bruta de entradas e saídas registradas.</small>
        </article>
      </div>

      <div className="report-grid">
        <article className="panel report-card">
          <span>Relatório mensal</span>
          <strong className="report-title-case">{currentMonthLabel}</strong>
          <p>
            Resultado liquidado de <b>{money.format(metrics.profit)}</b>, ROI de <b>{percent.format(metrics.roi)}</b>
            e exposição aberta de <b>{money.format(metrics.openExposure)}</b>.
          </p>
          <button onClick={() => downloadTextFile("bancamais-relatorio-operacional.csv", csv)}>Baixar base CSV</button>
        </article>

        <article className="panel report-card">
          <span>Resumo fiscal</span>
          <strong>{money.format(Math.max(metrics.profit, 0))}</strong>
          <p>
            Valor positivo liquidado no período. A regra fiscal final ainda precisa ser validada
            com contador antes de automatizar DARF/IR.
          </p>
          <button onClick={() => downloadTextFile("bancamais-fiscal-base.csv", csv)}>Exportar fiscal</button>
        </article>

        <article className="panel report-card">
          <span>Página tipster</span>
          <strong>Banca verificada</strong>
          <p>
            Base pronta para mostrar ROI, yield e histórico sem expor valores absolutos.
            Publicação fica para a etapa de auth/perfil.
          </p>
          <div className="report-placeholder-state">
            <span>Disponível na próxima etapa de produto</span>
          </div>
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
            <div><span>Taxa de liquidação</span><strong>{percent.format(settlementRate)}</strong></div>
            <div><span>Hit rate</span><strong>{percent.format(metrics.hitRate)}</strong></div>
          </div>
        </article>

        <article className="panel">
          <h2>Transacoes</h2>
          <div className="transaction-list">
            {latestTransactions.length > 0 ? latestTransactions.map((transaction) => (
              <div key={transaction.id} className="transaction-row">
                <span>
                  <b>{new Date(transaction.date).toLocaleDateString("pt-BR")}</b>
                  <small>{transaction.description || "Lançamento sem descrição operacional."}</small>
                </span>
                <strong className={transaction.amount >= 0 ? "pos" : "neg"}>{money.format(transaction.amount)}</strong>
              </div>
            )) : (
              <div className="transaction-row">
                <span>
                  <b>Sem transações registradas</b>
                  <small>Os relatórios financeiros ficam mais úteis depois do primeiro depósito, saque ou ajuste.</small>
                </span>
                <strong>{money.format(0)}</strong>
              </div>
            )}
          </div>
          <div className="report-note">
            <span>Saldo transacional líquido</span>
            <strong className={transactionBalance >= 0 ? "pos" : "neg"}>{money.format(transactionBalance)}</strong>
          </div>
        </article>
      </div>
    </section>
  );
}
