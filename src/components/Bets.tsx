import { useState } from "react";
import { betsToCsv, downloadTextFile } from "../lib/csv";
import { clvPercent, money, percent } from "../lib/metrics";
import type { AppState, Bet } from "../lib/types";

const statusLabel: Record<Bet["status"], string> = {
  pending: "Pendente",
  won: "Ganha",
  lost: "Perdida",
  cashout: "Cashout",
  void: "Cancelada",
};

interface BetsProps {
  state: AppState;
  settleBet: (id: string, status: Bet["status"]) => void;
}

export function Bets({ state, settleBet }: BetsProps) {
  const [search, setSearch] = useState("");
  const filtered = search
    ? state.bets.filter(b =>
        b.eventName.toLowerCase().includes(search.toLowerCase()) ||
        b.sport.toLowerCase().includes(search.toLowerCase()) ||
        b.league.toLowerCase().includes(search.toLowerCase())
      )
    : state.bets;

  return (
    <section className="page">
      <div className="page-actions">
        <div>
          <strong>{state.bets.length} apostas registradas</strong>
          <span>Exportacao CSV pronta para relatorios e migracao de dados.</span>
        </div>
        <input
          placeholder="Buscar evento, esporte, liga..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button onClick={() => downloadTextFile("bancamais-apostas.csv", betsToCsv(state))}>Exportar CSV</button>
      </div>
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
            {filtered.map((bet) => (
              <tr key={bet.id}>
                <td>
                  <strong>{bet.eventName}</strong>
                  <small>{bet.sport} · {bet.league} · {new Date(bet.eventAt).toLocaleString("pt-BR")}</small>
                  {bet.slipImageUrl && <a className="inline-link" href={bet.slipImageUrl} rel="noreferrer" target="_blank">ver print</a>}
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
