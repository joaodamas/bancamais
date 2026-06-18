import { CalendarDays } from "lucide-react";
import type { AppState } from "../lib/types";
import { buildDiary } from "../lib/diary";
import { money } from "../lib/metrics";
import { EmptyState } from "./EmptyState";

function signed(value: number): string {
  return `${value >= 0 ? "+" : ""}${money.format(value)}`;
}

export function Diario({ state }: { state: AppState }) {
  const months = buildDiary(state);

  if (months.length === 0) {
    return (
      <section className="page">
        <div className="section-head">
          <div>
            <h1>Diário</h1>
            <p>Seu histórico, dia a dia</p>
          </div>
        </div>
        <article className="panel">
          <EmptyState
            icon={<CalendarDays size={24} />}
            title="Sem registros ainda"
            description="Registre apostas para montar seu diário de operações — lucro por dia, semana e mês."
          />
        </article>
      </section>
    );
  }

  return (
    <section className="page">
      <div className="section-head">
        <div>
          <h1>Diário</h1>
          <p>Lucro e operações, dia a dia</p>
        </div>
      </div>

      <div className="diary">
        {months.map((month) => (
          <div key={month.key} className="diary-month">
            <header className="diary-month-head">
              <span className="diary-month-name">{month.label}</span>
              <span className="diary-month-meta">
                <em>{month.betCount} apostas</em>
                <strong className={month.profit >= 0 ? "pos" : "neg"}>{signed(month.profit)}</strong>
              </span>
            </header>

            {month.days.map((day) => (
              <div key={day.key} className="diary-day">
                <header className="diary-day-head">
                  <span className="diary-day-name">{day.label}</span>
                  <strong className={`diary-day-pnl ${day.profit >= 0 ? "pos" : "neg"}`}>{signed(day.profit)}</strong>
                </header>
                <div className="diary-bets">
                  {day.bets.map((bet) => (
                    <div key={bet.id} className="diary-bet">
                      <span className="diary-bet-time text-mono">{bet.time}</span>
                      <div className="diary-bet-info">
                        <span className="diary-bet-event">{bet.eventName}</span>
                        <span className="diary-bet-sub">{bet.selection} · {bet.market} · @{bet.odds.toFixed(2)}</span>
                      </div>
                      <span className="diary-bet-stake text-mono">{money.format(bet.stake)}</span>
                      <span className={`diary-bet-pnl text-mono ${!bet.settled ? "muted" : bet.profit >= 0 ? "pos" : "neg"}`}>
                        {bet.settled ? signed(bet.profit) : "pendente"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
