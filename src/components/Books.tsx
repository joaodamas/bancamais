import { useState } from "react";
import type { FormEvent } from "react";
import { money } from "../lib/metrics";
import type { AppState, BookmakerStatus, TransactionType } from "../lib/types";

interface BooksProps {
  state: AppState;
  addBookmaker: (event: FormEvent<HTMLFormElement>) => void;
  updateBookmaker: (event: FormEvent<HTMLFormElement>, bookmakerId: string) => void;
  removeBookmaker: (bookmakerId: string) => void;
  addTransaction: (event: FormEvent<HTMLFormElement>) => void;
}

export function Books({ state, addBookmaker, updateBookmaker, removeBookmaker, addTransaction }: BooksProps) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const totalBalance = state.bookmakers.reduce((sum, book) => sum + book.balance, 0);
  const linkedBooksCount = state.bookmakers.filter((book) =>
    state.bets.some((bet) => bet.bookmakerId === book.id)
    || state.transactions.some(
      (transaction) => transaction.bookmakerId === book.id || transaction.targetBookmakerId === book.id
    )
  ).length;
  const latestTransactions = [...state.transactions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 6);

  const statusLabel: Record<BookmakerStatus, string> = {
    synced: "Sincronizada",
    manual: "Manual",
    reconnect: "Reconectar",
  };

  const transactionTypeLabel: Record<TransactionType, string> = {
    deposit: "Depósito",
    withdrawal: "Saque",
    transfer: "Transferência",
    adjustment: "Ajuste",
    bet_stake: "Stake",
    bet_payout: "Liquidação",
    bet_refund: "Estorno",
  };

  return (
    <section className="page">
      <div className="page-actions">
        <div className="page-actions-copy">
          <strong>{state.bookmakers.length} casas monitoradas</strong>
          <span>Concentre saldo, cadastro e movimentações sem perder rastreabilidade por casa.</span>
        </div>
      </div>

      <div className="ops-summary-grid">
        <article className="ops-summary-card">
          <span>Saldo consolidado</span>
          <strong>{money.format(totalBalance)}</strong>
          <small>Soma dos saldos atualmente atribuídos às casas.</small>
        </article>
        <article className="ops-summary-card">
          <span>Casas com histórico</span>
          <strong>{linkedBooksCount}</strong>
          <small>Contas com apostas ou transações já vinculadas.</small>
        </article>
        <article className="ops-summary-card">
          <span>Movimentações</span>
          <strong>{state.transactions.length}</strong>
          <small>Últimos registros disponíveis para conciliação.</small>
        </article>
      </div>

      <div className="cards">
        {state.bookmakers.map((book) => {
          const hasLinks = state.bets.some((bet) => bet.bookmakerId === book.id)
            || state.transactions.some(
              (transaction) => transaction.bookmakerId === book.id || transaction.targetBookmakerId === book.id
            );

          return (
            <article className="panel book" key={book.id}>
              <span>{statusLabel[book.status]}</span>
              {editingId === book.id ? (
                <form className="book-edit-form" onSubmit={(event) => { updateBookmaker(event, book.id); setEditingId(null); }}>
                  <label className="sr-only">
                    Nome da casa
                    <input name="name" defaultValue={book.name} required />
                  </label>
                  <div className="actions">
                    <button className="primary" type="submit">Salvar</button>
                    <button type="button" onClick={() => setEditingId(null)}>Cancelar</button>
                  </div>
                </form>
              ) : (
                <>
                  <h2>{book.name}</h2>
                  <strong>{money.format(book.balance)}</strong>
                  <small>Atualização: {book.lastSyncLabel}</small>
                  <div className="book-actions">
                    <button type="button" onClick={() => setEditingId(book.id)}>Editar</button>
                    <button type="button" onClick={() => removeBookmaker(book.id)} disabled={hasLinks}>Remover</button>
                  </div>
                  {hasLinks && (
                    <small>Remoção bloqueada: histórico financeiro ou apostas vinculadas.</small>
                  )}
                </>
              )}
            </article>
          );
        })}
        {state.bookmakers.length === 0 && (
          <article className="panel book">
            <span>Configuração inicial</span>
            <h2>Nenhuma casa cadastrada</h2>
            <small>Adicione ao menos uma casa para operar stakes, saldos e movimentações.</small>
          </article>
        )}
      </div>

      <div className="grid two report-section">
        <form className="panel transaction-form" onSubmit={addBookmaker}>
          <h2>Adicionar casa</h2>
          <p className="panel-intro full">Cadastre a conta com o saldo inicial para manter a base operacional consistente desde o primeiro lançamento.</p>
          <label>Nome
            <input name="name" required placeholder="Betano, Bet365, KTO..." />
          </label>
          <label>Saldo atual
            <input name="balance" min="0" step="0.01" type="number" placeholder="500" />
          </label>
          <button className="primary" type="submit">Adicionar casa</button>
        </form>

        <form className="panel transaction-form" onSubmit={addTransaction}>
          <h2>Registrar movimentação</h2>
          <p className="panel-intro full">Use esta fila para depósitos, saques, transferências e ajustes manuais entre casas.</p>
          <label>Tipo
            <select name="type">
              <option value="deposit">Depósito</option>
              <option value="withdrawal">Saque</option>
              <option value="transfer">Transferência</option>
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
          <label className="full">Descrição<input name="description" placeholder="PIX, ajuste manual, transferência" /></label>
          <button className="primary" type="submit" disabled={state.bookmakers.length === 0}>Registrar</button>
        </form>

        <article className="panel">
          <h2>Últimas transações</h2>
          <div className="transaction-list">
            {latestTransactions.length > 0 ? latestTransactions.map((transaction) => (
              <div key={transaction.id} className="transaction-row">
                <span>
                  <b>{transactionTypeLabel[transaction.type]}</b>
                  <small>
                    {new Date(transaction.date).toLocaleDateString("pt-BR")}
                    {transaction.description ? ` · ${transaction.description}` : ""}
                  </small>
                </span>
                <strong className={transaction.amount >= 0 ? "pos" : "neg"}>{money.format(transaction.amount)}</strong>
              </div>
            )) : (
              <div className="transaction-row">
                <span>
                  <b>Sem movimentações</b>
                  <small>Nenhuma movimentação registrada ainda.</small>
                </span>
                <strong>R$ 0,00</strong>
              </div>
            )}
          </div>
        </article>
      </div>
    </section>
  );
}
