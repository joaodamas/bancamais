import type { FormEvent } from "react";
import { money } from "../lib/metrics";
import type { AppState } from "../lib/types";

interface BooksProps {
  state: AppState;
  addTransaction: (event: FormEvent<HTMLFormElement>) => void;
}

export function Books({ state, addTransaction }: BooksProps) {
  return (
    <section className="page">
      <div className="cards">
        {state.bookmakers.map((book) => (
          <article className="panel book" key={book.id}>
            <span>{book.status}</span>
            <h2>{book.name}</h2>
            <strong>{money.format(book.balance)}</strong>
            <small>Sincronizacao: {book.lastSyncLabel}</small>
          </article>
        ))}
      </div>

      <div className="grid two report-section">
        <form className="panel transaction-form" onSubmit={addTransaction}>
          <h2>Registrar movimentacao</h2>
          <label>Tipo
            <select name="type">
              <option value="deposit">Deposito</option>
              <option value="withdrawal">Saque</option>
              <option value="transfer">Transferencia</option>
              <option value="adjustment">Ajuste</option>
            </select>
          </label>
          <label>Casa origem
            <select name="bookmakerId">
              {state.bookmakers.map((book) => <option key={book.id} value={book.id}>{book.name}</option>)}
            </select>
          </label>
          <label>Casa destino
            <select name="targetBookmakerId">
              {state.bookmakers.map((book) => <option key={book.id} value={book.id}>{book.name}</option>)}
            </select>
          </label>
          <label>Valor<input name="amount" required min="0.01" step="0.01" type="number" placeholder="500" /></label>
          <label className="full">Descricao<input name="description" placeholder="PIX, ajuste manual, transferencia" /></label>
          <button className="primary" type="submit">Registrar</button>
        </form>

        <article className="panel">
          <h2>Ultimas transacoes</h2>
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
