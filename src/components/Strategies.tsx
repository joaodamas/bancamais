import type { FormEvent } from "react";
import { groupProfitByStrategy, money, percent } from "../lib/metrics";
import type { AppState } from "../lib/types";

interface StrategiesProps {
  state: AppState;
  addStrategy: (event: FormEvent<HTMLFormElement>) => void;
  toggleStrategy: (id: string) => void;
}

export function Strategies({ state, addStrategy, toggleStrategy }: StrategiesProps) {
  const rows = groupProfitByStrategy(state);

  return (
    <section className="page">
      <div className="strategy-layout">
        <form className="panel strategy-form" onSubmit={addStrategy}>
          <h2>Nova estrategia</h2>
          <label>Nome<input name="name" required placeholder="Over 1.5 ligas europeias" /></label>
          <label>Descricao<input name="description" required placeholder="Pre-live, odds 1.40 a 1.70" /></label>
          <button className="primary" type="submit">Criar estrategia</button>
        </form>

        <div className="table-card">
          <div className="table-scroll-x">
          <table>
            <thead>
              <tr>
                <th>Estrategia</th>
                <th>Apostas</th>
                <th>ROI</th>
                <th>Acerto</th>
                <th>CLV</th>
                <th>Lucro</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{row.name}</strong>
                    <small>{row.description}</small>
                  </td>
                  <td>{row.bets}</td>
                  <td className={row.roi >= 0 ? "pos" : "neg"}>{percent.format(row.roi)}</td>
                  <td>{percent.format(row.hitRate)}</td>
                  <td className={row.clvAverage >= 0 ? "pos" : "neg"}>{percent.format(row.clvAverage)}</td>
                  <td className={row.profit >= 0 ? "pos" : "neg"}>{money.format(row.profit)}</td>
                  <td><span className={`pill ${row.status === "active" ? "won" : "pending"}`}>{row.status === "active" ? "Ativa" : "Pausada"}</span></td>
                  <td><button onClick={() => toggleStrategy(row.id)}>{row.status === "active" ? "Pausar" : "Reativar"}</button></td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8}>
                    <div className="table-empty rich">
                      <strong>Nenhuma estratégia cadastrada</strong>
                      <span>Crie sua primeira estratégia no formulário ao lado para organizar e comparar seus mercados.</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    </section>
  );
}
