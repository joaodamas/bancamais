import { useState } from "react";
import type { FormEvent } from "react";
import { money } from "../lib/metrics";
import { computeBookmakerLedger, TRANSACTION_TYPE_LABELS } from "../lib/ledger";
import type { AppState, BookmakerStatus, Transaction } from "../lib/types";

interface BooksProps {
  state: AppState;
  addBookmaker: (event: FormEvent<HTMLFormElement>) => void;
  updateBookmaker: (event: FormEvent<HTMLFormElement>, bookmakerId: string) => void;
  removeBookmaker: (bookmakerId: string) => void;
  addTransaction: (event: FormEvent<HTMLFormElement>) => void;
  voidTransaction: (transactionId: string, bookmakerId: string, reason: string) => void;
}

export function Books({
  state,
  addBookmaker,
  updateBookmaker,
  removeBookmaker,
  addTransaction,
  voidTransaction,
}: BooksProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedBookmakerId, setSelectedBookmakerId] = useState<string | null>(null);
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("");

  const totalBalance = state.bookmakers.reduce((sum, book) => sum + book.balance, 0);
  const linkedBooksCount = state.bookmakers.filter(
    (book) =>
      state.bets.some((bet) => bet.bookmakerId === book.id) ||
      state.transactions.some(
        (t) => t.bookmakerId === book.id || t.targetBookmakerId === book.id,
      ),
  ).length;

  const statusLabel: Record<BookmakerStatus, string> = {
    synced: "Sincronizada",
    manual: "Manual",
    reconnect: "Reconectar",
  };

  const selectedBook = selectedBookmakerId
    ? state.bookmakers.find((b) => b.id === selectedBookmakerId) ?? null
    : null;

  const ledgerEntries = selectedBook
    ? computeBookmakerLedger(selectedBook.id, state.transactions).reverse()
    : [];

  function handleVoidSubmit(transaction: Transaction) {
    const reason = voidReason.trim();
    if (!reason || !selectedBookmakerId) return;
    voidTransaction(transaction.id, selectedBookmakerId, reason);
    setVoidingId(null);
    setVoidReason("");
  }

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
          <small>Todos os lançamentos imutáveis do ledger.</small>
        </article>
      </div>

      <div className="cards">
        {state.bookmakers.map((book) => {
          const hasLinks =
            state.bets.some((bet) => bet.bookmakerId === book.id) ||
            state.transactions.some(
              (t) => t.bookmakerId === book.id || t.targetBookmakerId === book.id,
            );

          return (
            <article
              className={`panel book${selectedBookmakerId === book.id ? " book-selected" : ""}`}
              key={book.id}
            >
              <span>{statusLabel[book.status]}</span>
              {editingId === book.id ? (
                <form
                  className="book-edit-form"
                  onSubmit={(event) => {
                    updateBookmaker(event, book.id);
                    setEditingId(null);
                  }}
                >
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
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedBookmakerId(selectedBookmakerId === book.id ? null : book.id)
                      }
                    >
                      {selectedBookmakerId === book.id ? "Fechar ledger" : "Ver ledger"}
                    </button>
                    <button type="button" onClick={() => setEditingId(book.id)}>Editar</button>
                    <button
                      type="button"
                      onClick={() => removeBookmaker(book.id)}
                      disabled={hasLinks}
                    >
                      Remover
                    </button>
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

      {selectedBook && (
        <article className="panel ledger-panel">
          <div className="ledger-header">
            <h2>Ledger — {selectedBook.name}</h2>
            <small>
              Registro imutável. Para corrigir um lançamento incorreto, crie uma anulação com
              descrição da razão. O histórico original é sempre preservado.
            </small>
          </div>

          {ledgerEntries.length === 0 ? (
            <p className="ledger-empty">Nenhum lançamento registrado para esta casa ainda.</p>
          ) : (
            <div className="ledger-table-wrapper">
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Tipo</th>
                    <th>Descrição</th>
                    <th className="ledger-col-num">Valor</th>
                    <th className="ledger-col-num">Saldo acumulado</th>
                    <th className="ledger-col-action">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerEntries.map(({ transaction: t, runningBalance, isVoided }) => {
                    const isVoidEntry = t.type === "void_entry";
                    const isBetLinked =
                      t.referenceType === "bet" &&
                      (t.type === "bet_stake" || t.type === "bet_payout" || t.type === "bet_refund");
                    const canVoid =
                      !isVoided &&
                      !isVoidEntry &&
                      !isBetLinked;

                    return (
                      <tr
                        key={t.id}
                        className={`ledger-row${isVoided ? " ledger-row-voided" : ""}${isVoidEntry ? " ledger-row-void-entry" : ""}`}
                      >
                        <td className="ledger-date">
                          {new Date(t.date).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                          <span className="ledger-time">
                            {new Date(t.date).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </td>
                        <td>
                          <span className={`ledger-type-badge ledger-type-${t.type}`}>
                            {TRANSACTION_TYPE_LABELS[t.type]}
                          </span>
                        </td>
                        <td className="ledger-desc">
                          {t.description}
                          {isVoided && <span className="ledger-voided-tag">Anulado</span>}
                          {isVoidEntry && t.voidsCancelledId && (
                            <span className="ledger-void-ref">
                              Ref: {t.voidsCancelledId.slice(0, 12)}…
                            </span>
                          )}
                        </td>
                        <td className={`ledger-col-num ledger-amount ${t.amount >= 0 ? "pos" : "neg"}`}>
                          {t.amount >= 0 ? "+" : ""}
                          {money.format(t.amount)}
                        </td>
                        <td className="ledger-col-num ledger-balance">
                          {isVoided ? (
                            <span className="ledger-balance-struck">{money.format(runningBalance)}</span>
                          ) : (
                            money.format(runningBalance)
                          )}
                        </td>
                        <td className="ledger-col-action">
                          {canVoid && voidingId !== t.id && (
                            <button
                              className="ledger-void-btn"
                              type="button"
                              onClick={() => {
                                setVoidingId(t.id);
                                setVoidReason("");
                              }}
                            >
                              Anular
                            </button>
                          )}
                          {voidingId === t.id && (
                            <div className="ledger-void-form">
                              <input
                                autoFocus
                                className="ledger-void-input"
                                placeholder="Razão da anulação (obrigatório)"
                                value={voidReason}
                                onChange={(e) => setVoidReason(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleVoidSubmit(t);
                                  if (e.key === "Escape") {
                                    setVoidingId(null);
                                    setVoidReason("");
                                  }
                                }}
                              />
                              <div className="ledger-void-form-actions">
                                <button
                                  className="primary"
                                  type="button"
                                  disabled={!voidReason.trim()}
                                  onClick={() => handleVoidSubmit(t)}
                                >
                                  Confirmar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setVoidingId(null);
                                    setVoidReason("");
                                  }}
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          )}
                          {isBetLinked && (
                            <span className="ledger-immutable-tag" title="Lançamento de aposta — imutável pelo ledger">Aposta</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </article>
      )}

      <div className="grid two report-section">
        <form className="panel transaction-form" onSubmit={addBookmaker}>
          <h2>Adicionar casa</h2>
          <p className="panel-intro full">
            Cadastre a conta com o saldo inicial para manter a base operacional consistente desde o
            primeiro lançamento.
          </p>
          <label>
            Nome
            <input name="name" required placeholder="Betano, Bet365, KTO..." />
          </label>
          <label>
            Saldo atual
            <input name="balance" min="0" step="0.01" type="number" placeholder="500" />
          </label>
          <button className="primary" type="submit">
            Adicionar casa
          </button>
        </form>

        <form className="panel transaction-form" onSubmit={addTransaction}>
          <h2>Registrar movimentação</h2>
          <p className="panel-intro full">
            Use esta fila para depósitos, saques, transferências e ajustes manuais entre casas.
            Lançamentos são permanentes — para corrigir, crie uma anulação no ledger da casa.
          </p>
          <label>
            Tipo
            <select name="type">
              <option value="deposit">Depósito</option>
              <option value="withdrawal">Saque</option>
              <option value="transfer">Transferência</option>
              <option value="adjustment">Ajuste</option>
            </select>
          </label>
          <label>
            Casa origem
            <select name="bookmakerId">
              {state.bookmakers.map((book) => (
                <option key={book.id} value={book.id}>
                  {book.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Casa destino
            <select name="targetBookmakerId">
              {state.bookmakers.map((book) => (
                <option key={book.id} value={book.id}>
                  {book.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Valor
            <input name="amount" required min="0.01" step="0.01" type="number" placeholder="500" />
          </label>
          <label className="full">
            Descrição
            <input name="description" placeholder="PIX, ajuste manual, transferência" />
          </label>
          <button
            className="primary"
            type="submit"
            disabled={state.bookmakers.length === 0}
          >
            Registrar
          </button>
        </form>
      </div>
    </section>
  );
}
