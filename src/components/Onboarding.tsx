import { FormEvent, useState } from "react";
import { BrandLogo } from "./BrandLogo";
import type { AppState, BookmakerAccount } from "../lib/types";

interface OnboardingProps {
  onComplete: (patch: Pick<AppState, "bankrollName" | "startingBalance" | "bookmakers">) => void;
}

type Step = 1 | 2 | 3;

const BOOKMAKER_SUGGESTIONS = [
  "Bet365", "Betano", "Sportingbet", "KTO", "Superbet",
  "Pixbet", "EstrelaBet", "BetNacional", "Novibet", "Betfair"
];

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState<Step>(1);
  const [bankrollName, setBankrollName] = useState("");
  const [startingBalance, setStartingBalance] = useState("");
  const [bookmakers, setBookmakers] = useState<BookmakerAccount[]>([]);
  const [newBookName, setNewBookName] = useState("");
  const [newBookBalance, setNewBookBalance] = useState("");

  function handleStep1(e: FormEvent) {
    e.preventDefault();
    if (!bankrollName.trim() || !startingBalance) return;
    setStep(2);
  }

  function addBookmaker() {
    if (!newBookName.trim()) return;
    const balance = parseFloat(newBookBalance) || 0;
    const bookmaker: BookmakerAccount = {
      id: `book-${Date.now()}`,
      name: newBookName.trim(),
      balance,
      status: "manual",
      lastSyncLabel: "manual",
    };
    setBookmakers(prev => [...prev, bookmaker]);
    setNewBookName("");
    setNewBookBalance("");
  }

  function removeBookmaker(id: string) {
    setBookmakers(prev => prev.filter(b => b.id !== id));
  }

  function handleComplete() {
    onComplete({
      bankrollName: bankrollName.trim() || "Minha Banca",
      startingBalance: parseFloat(startingBalance) || 0,
      bookmakers,
    });
  }

  const totalBalance = bookmakers.reduce((sum, b) => sum + b.balance, 0);

  return (
    <div className="onboarding-page">
      <div className="onboarding-container">
        <div className="onboarding-header">
          <BrandLogo />
          <div className="onboarding-steps">
            {([1, 2, 3] as Step[]).map(s => (
              <div key={s} className={`onboarding-step-dot ${step === s ? "active" : step > s ? "done" : ""}`} />
            ))}
          </div>
        </div>

        {step === 1 && (
          <form className="onboarding-card" onSubmit={handleStep1}>
            <div className="onboarding-step-label">Passo 1 de 3</div>
            <h1>Configure sua banca</h1>
            <p>Como você quer chamar sua banca e qual é o saldo inicial que você está destinando para apostas?</p>

            <label>
              Nome da banca
              <input
                autoFocus
                placeholder="Ex: Banca Principal, Banca Futebol..."
                value={bankrollName}
                onChange={e => setBankrollName(e.target.value)}
                required
              />
            </label>

            <label>
              Saldo inicial (R$)
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Ex: 1000.00"
                value={startingBalance}
                onChange={e => setStartingBalance(e.target.value)}
                required
              />
            </label>

            <button className="primary full-width" type="submit" disabled={!bankrollName.trim() || !startingBalance}>
              Continuar
            </button>
          </form>
        )}

        {step === 2 && (
          <div className="onboarding-card">
            <div className="onboarding-step-label">Passo 2 de 3</div>
            <h1>Adicione suas casas de apostas</h1>
            <p>Informe as casas onde você tem conta e quanto tem depositado em cada uma.</p>

            <div className="onboarding-book-suggestions">
              {BOOKMAKER_SUGGESTIONS.map(name => (
                <button
                  key={name}
                  type="button"
                  className={`book-suggestion-chip ${bookmakers.some(b => b.name === name) ? "selected" : ""}`}
                  onClick={() => {
                    if (!bookmakers.some(b => b.name === name)) {
                      setNewBookName(name);
                    }
                  }}
                >
                  {name}
                </button>
              ))}
            </div>

            <div className="onboarding-book-form">
              <input
                placeholder="Nome da casa"
                value={newBookName}
                onChange={e => setNewBookName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addBookmaker()}
              />
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Saldo (R$)"
                value={newBookBalance}
                onChange={e => setNewBookBalance(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addBookmaker()}
              />
              <button type="button" onClick={addBookmaker} disabled={!newBookName.trim()}>
                Adicionar
              </button>
            </div>

            {bookmakers.length > 0 && (
              <div className="onboarding-books-list">
                {bookmakers.map(b => (
                  <div key={b.id} className="onboarding-book-item">
                    <span>{b.name}</span>
                    <strong>R$ {b.balance.toFixed(2)}</strong>
                    <button type="button" className="btn-remove" onClick={() => removeBookmaker(b.id)}>×</button>
                  </div>
                ))}
                <div className="onboarding-book-total">
                  <span>Total nas casas</span>
                  <strong>R$ {totalBalance.toFixed(2)}</strong>
                </div>
              </div>
            )}

            <div className="onboarding-actions">
              <button type="button" className="btn-ghost" onClick={() => setStep(3)}>
                Pular — adicionar depois
              </button>
              <button
                type="button"
                className="primary"
                onClick={() => setStep(3)}
                disabled={bookmakers.length === 0}
              >
                Continuar
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="onboarding-card">
            <div className="onboarding-step-label">Tudo pronto!</div>
            <h1>Banca configurada</h1>

            <div className="onboarding-summary">
              <div className="onboarding-summary-row">
                <span>Nome da banca</span>
                <strong>{bankrollName}</strong>
              </div>
              <div className="onboarding-summary-row">
                <span>Saldo inicial</span>
                <strong>R$ {parseFloat(startingBalance || "0").toFixed(2)}</strong>
              </div>
              <div className="onboarding-summary-row">
                <span>Casas cadastradas</span>
                <strong>{bookmakers.length === 0 ? "Nenhuma (adicionar depois)" : `${bookmakers.length} casa${bookmakers.length > 1 ? "s" : ""}`}</strong>
              </div>
            </div>

            <div className="onboarding-next-steps">
              <p>O que fazer agora:</p>
              <ul>
                <li>Registre sua primeira aposta com o botão <strong>+ Nova aposta</strong></li>
                <li>Configure suas estratégias em <strong>Estratégias</strong></li>
                <li>Crie uma conta para sincronizar em nuvem em <strong>Configurações</strong></li>
              </ul>
            </div>

            <button className="primary full-width" onClick={handleComplete}>
              Entrar no Banca+
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
