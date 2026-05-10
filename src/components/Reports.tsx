import { useMemo } from "react";
import { betsToCsv, downloadTextFile } from "../lib/csv";
import { money, percent, betProfit } from "../lib/metrics";
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

  // DRE: resultado por mês
  const dreByMonth = useMemo(() => {
    const map = new Map<string, { receitas: number; custos: number; bets: number }>();
    settled.forEach((bet) => {
      const d = new Date(bet.placedAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const curr = map.get(key) ?? { receitas: 0, custos: 0, bets: 0 };
      const profit = betProfit(bet);
      curr.receitas += profit > 0 ? bet.payout ?? 0 : 0;
      curr.custos += bet.stake;
      curr.bets += 1;
      map.set(key, curr);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 6)
      .map(([key, data]) => {
        const [year, month] = key.split("-");
        const label = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
        return { label, resultado: data.receitas - data.custos, receitas: data.receitas, custos: data.custos, bets: data.bets };
      });
  }, [settled]);

  // Drawdown máximo
  const drawdown = useMemo(() => {
    if (settled.length < 3) return null;
    const sortedSettled = [...settled].sort((a, b) => a.placedAt.localeCompare(b.placedAt));
    let peak = 0;
    let running = 0;
    let maxDrawdown = 0;
    let maxDrawdownPct = 0;

    sortedSettled.forEach((bet) => {
      running += betProfit(bet);
      if (running > peak) peak = running;
      const dd = peak - running;
      if (dd > maxDrawdown) {
        maxDrawdown = dd;
        maxDrawdownPct = peak > 0 ? dd / peak : 0;
      }
    });
    return { maxDrawdown, maxDrawdownPct };
  }, [settled]);

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

      {/* DRE Mensal */}
      {dreByMonth.length > 0 && (
        <article className="panel">
          <h2>DRE — Resultado por mês</h2>
          <p>Receitas (retornos de apostas ganhas) e custos (stakes) por mês, nos últimos 6 meses.</p>
          <div className="dre-table-wrap">
            <table className="dre-table">
              <thead>
                <tr>
                  <th>Mês</th>
                  <th>Apostas</th>
                  <th>Custos (stakes)</th>
                  <th>Receitas (payouts)</th>
                  <th>Resultado</th>
                </tr>
              </thead>
              <tbody>
                {dreByMonth.map((row) => (
                  <tr key={row.label}>
                    <td className="text-mono">{row.label}</td>
                    <td>{row.bets}</td>
                    <td className="text-mono neg">({money.format(row.custos)})</td>
                    <td className="text-mono pos">{money.format(row.receitas)}</td>
                    <td className={`text-mono ${row.resultado >= 0 ? "pos" : "neg"}`}>
                      {row.resultado >= 0 ? "+" : ""}{money.format(row.resultado)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      )}

      {/* Drawdown */}
      {drawdown && (
        <article className="panel">
          <h2>Drawdown máximo</h2>
          <p>Maior queda acumulada no resultado das apostas liquidadas — indicador de resiliência da estratégia.</p>
          <div className="drawdown-metrics">
            <div className="drawdown-metric">
              <span>Drawdown absoluto</span>
              <strong className="neg">{money.format(drawdown.maxDrawdown)}</strong>
              <small>Maior queda de pico a vale no resultado acumulado</small>
            </div>
            <div className="drawdown-metric">
              <span>Drawdown relativo</span>
              <strong className={drawdown.maxDrawdownPct > 0.2 ? "neg" : "warning"}>
                {percent.format(drawdown.maxDrawdownPct)}
              </strong>
              <small>Em relação ao pico de resultado anterior</small>
            </div>
            <div className="drawdown-metric">
              <span>Interpretação</span>
              <strong>
                {drawdown.maxDrawdownPct === 0 ? "Sem drawdown" :
                 drawdown.maxDrawdownPct < 0.1 ? "Baixo" :
                 drawdown.maxDrawdownPct < 0.25 ? "Moderado" :
                 drawdown.maxDrawdownPct < 0.5 ? "Alto" : "Crítico"}
              </strong>
              <small>
                {drawdown.maxDrawdownPct < 0.1
                  ? "Risco controlado — estratégia robusta."
                  : drawdown.maxDrawdownPct < 0.25
                    ? "Aceitável — monitore a sequência de perdas."
                    : "Revise a gestão de stake e diversificação de mercados."}
              </small>
            </div>
          </div>
        </article>
      )}

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
