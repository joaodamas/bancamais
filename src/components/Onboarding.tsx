import { FormEvent, useState } from "react";
import { TrendingUp, Wallet, Building2, Check, Coins, Percent } from "lucide-react";
import { BrandLogo } from "./BrandLogo";
import type { BookmakerAccount, UnitMode } from "../lib/types";

export interface OnboardingResult {
  bankrollName: string;
  startingBalance: number;
  bookmakers: BookmakerAccount[];
  unit: {
    mode: UnitMode;
    fixed: number;
    percent: number;
    maxStakeUnits: number;
  };
}

interface OnboardingProps {
  onComplete: (patch: OnboardingResult) => void;
}

type Step = 1 | 2 | 3 | 4;

const BOOKMAKER_SUGGESTIONS = [
  "Bet365", "Betano", "Sportingbet", "KTO", "Superbet",
  "Pixbet", "EstrelaBet", "BetNacional", "Novibet", "Betfair",
];

const STEP_META: Record<Step, { label: string; Icon: typeof Wallet }> = {
  1: { label: "Banca", Icon: Wallet },
  2: { label: "Unidade", Icon: Coins },
  3: { label: "Casas", Icon: Building2 },
  4: { label: "Pronto", Icon: Check },
};

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState<Step>(1);
  const [bankrollName, setBankrollName] = useState("");
  const [startingBalance, setStartingBalance] = useState("");

  const [unitMode, setUnitMode] = useState<UnitMode>("fixed");
  const [unitFixed, setUnitFixed] = useState("");
  const [unitPercent, setUnitPercent] = useState("2");
  const [maxStakeUnits, setMaxStakeUnits] = useState("3");

  const [bookmakers, setBookmakers] = useState<BookmakerAccount[]>([]);
  const [newBookName, setNewBookName] = useState("");
  const [newBookBalance, setNewBookBalance] = useState("");

  const balance = parseFloat(startingBalance) || 0;
  const unitValue =
    unitMode === "fixed"
      ? parseFloat(unitFixed) || 0
      : balance * ((parseFloat(unitPercent) || 0) / 100);
  const maxUnits = parseInt(maxStakeUnits, 10) || 0;

  function handleStep1(e: FormEvent) {
    e.preventDefault();
    if (!bankrollName.trim() || !startingBalance) return;
    setStep(2);
  }

  function handleStep2(e: FormEvent) {
    e.preventDefault();
    if (unitValue <= 0) return;
    setStep(3);
  }

  function addBookmaker() {
    if (!newBookName.trim()) return;
    const bookmaker: BookmakerAccount = {
      id: `book-${crypto.randomUUID()}`,
      name: newBookName.trim(),
      balance: parseFloat(newBookBalance) || 0,
      status: "manual",
      lastSyncLabel: "manual",
    };
    setBookmakers((prev) => [...prev, bookmaker]);
    setNewBookName("");
    setNewBookBalance("");
  }

  function removeBookmaker(id: string) {
    setBookmakers((prev) => prev.filter((b) => b.id !== id));
  }

  function handleComplete() {
    onComplete({
      bankrollName: bankrollName.trim() || "Minha Banca",
      startingBalance: balance,
      bookmakers,
      unit: {
        mode: unitMode,
        fixed: parseFloat(unitFixed) || 0,
        percent: parseFloat(unitPercent) || 0,
        maxStakeUnits: maxUnits || 3,
      },
    });
  }

  const totalInBooks = bookmakers.reduce((sum, b) => sum + b.balance, 0);

  return (
    <div className="onboarding-page">
      <div className="onboarding-container">
        <div className="onboarding-header">
          <BrandLogo />
          <div className="onboarding-rail">
            {([1, 2, 3, 4] as Step[]).map((s) => {
              const { label, Icon } = STEP_META[s];
              return (
                <div key={s} className={`onboarding-rail-step ${step === s ? "active" : step > s ? "done" : ""}`}>
                  <span className="onboarding-rail-dot">
                    {step > s ? <Check size={12} /> : <Icon size={12} />}
                  </span>
                  <span className="onboarding-rail-label">{label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {step === 1 && (
          <form className="onboarding-card" onSubmit={handleStep1}>
            <div className="onboarding-step-label">Passo 1 de 4</div>
            <h1>Configure sua banca</h1>
            <p>Como você quer chamar sua banca e qual o capital que está destinando para apostas?</p>

            <label>
              Nome da banca
              <input
                autoFocus
                placeholder="Ex: Banca Principal, Banca Futebol..."
                value={bankrollName}
                onChange={(e) => setBankrollName(e.target.value)}
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
                onChange={(e) => setStartingBalance(e.target.value)}
                required
              />
            </label>

            <button className="primary full-width" type="submit" disabled={!bankrollName.trim() || !startingBalance}>
              Continuar
            </button>
          </form>
        )}

        {step === 2 && (
          <form className="onboarding-card" onSubmit={handleStep2}>
            <div className="onboarding-step-label">Passo 2 de 4</div>
            <h1>Defina sua unidade</h1>
            <p>A unidade é a base de toda a sua gestão — os alertas de stake, exposição e disciplina partem dela.</p>

            <div className="onboarding-unit-toggle">
              <button
                type="button"
                className={`unit-mode-btn ${unitMode === "fixed" ? "active" : ""}`}
                onClick={() => setUnitMode("fixed")}
              >
                <Coins size={16} />
                <span>Valor fixo</span>
                <small>R$ por unidade</small>
              </button>
              <button
                type="button"
                className={`unit-mode-btn ${unitMode === "percent" ? "active" : ""}`}
                onClick={() => setUnitMode("percent")}
              >
                <Percent size={16} />
                <span>% da banca</span>
                <small>cresce com o saldo</small>
              </button>
            </div>

            {unitMode === "fixed" ? (
              <label>
                Valor da unidade (R$)
                <input
                  autoFocus
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="Ex: 50.00"
                  value={unitFixed}
                  onChange={(e) => setUnitFixed(e.target.value)}
                />
              </label>
            ) : (
              <label>
                Unidade (% da banca)
                <input
                  autoFocus
                  type="number"
                  min="0.1"
                  step="0.1"
                  placeholder="Ex: 2"
                  value={unitPercent}
                  onChange={(e) => setUnitPercent(e.target.value)}
                />
              </label>
            )}

            <label>
              Máximo por aposta (em unidades)
              <input
                type="number"
                min="1"
                step="1"
                placeholder="Ex: 3"
                value={maxStakeUnits}
                onChange={(e) => setMaxStakeUnits(e.target.value)}
              />
            </label>

            <div className="onboarding-unit-preview">
              <div>
                <span>1 unidade equivale a</span>
                <strong className="text-mono">{unitValue > 0 ? `R$ ${unitValue.toFixed(2)}` : "—"}</strong>
              </div>
              <div>
                <span>Teto por aposta</span>
                <strong className="text-mono">{unitValue > 0 && maxUnits > 0 ? `R$ ${(unitValue * maxUnits).toFixed(2)}` : "—"}</strong>
              </div>
            </div>

            <div className="onboarding-actions">
              <button type="button" className="btn-ghost" onClick={() => setStep(1)}>Voltar</button>
              <button type="submit" className="primary" disabled={unitValue <= 0}>Continuar</button>
            </div>
          </form>
        )}

        {step === 3 && (
          <div className="onboarding-card">
            <div className="onboarding-step-label">Passo 3 de 4</div>
            <h1>Suas casas de apostas</h1>
            <p>Onde você tem conta e quanto há depositado em cada uma. Isso permite rastrear saldo por casa.</p>

            <div className="onboarding-book-suggestions">
              {BOOKMAKER_SUGGESTIONS.map((name) => (
                <button
                  key={name}
                  type="button"
                  className={`book-suggestion-chip ${bookmakers.some((b) => b.name === name) ? "selected" : ""}`}
                  onClick={() => { if (!bookmakers.some((b) => b.name === name)) setNewBookName(name); }}
                >
                  {name}
                </button>
              ))}
            </div>

            <div className="onboarding-book-form">
              <input
                placeholder="Nome da casa"
                value={newBookName}
                onChange={(e) => setNewBookName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addBookmaker())}
              />
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Saldo (R$)"
                value={newBookBalance}
                onChange={(e) => setNewBookBalance(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addBookmaker())}
              />
              <button type="button" onClick={addBookmaker} disabled={!newBookName.trim()}>Adicionar</button>
            </div>

            {bookmakers.length > 0 && (
              <div className="onboarding-books-list">
                {bookmakers.map((b) => (
                  <div key={b.id} className="onboarding-book-item">
                    <span>{b.name}</span>
                    <strong className="text-mono">R$ {b.balance.toFixed(2)}</strong>
                    <button type="button" className="btn-remove" onClick={() => removeBookmaker(b.id)}>×</button>
                  </div>
                ))}
                <div className="onboarding-book-total">
                  <span>Total nas casas</span>
                  <strong className="text-mono">R$ {totalInBooks.toFixed(2)}</strong>
                </div>
              </div>
            )}

            <div className="onboarding-actions">
              <button type="button" className="btn-ghost" onClick={() => setStep(2)}>Voltar</button>
              <button type="button" className="primary" onClick={() => setStep(4)}>
                {bookmakers.length === 0 ? "Pular — adicionar depois" : "Continuar"}
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
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
                <strong className="text-mono">R$ {balance.toFixed(2)}</strong>
              </div>
              <div className="onboarding-summary-row">
                <span>Unidade</span>
                <strong className="text-mono">
                  R$ {unitValue.toFixed(2)}
                  {unitMode === "percent" ? ` (${unitPercent}%)` : " (fixo)"}
                </strong>
              </div>
              <div className="onboarding-summary-row">
                <span>Teto por aposta</span>
                <strong className="text-mono">{maxUnits}u · R$ {(unitValue * maxUnits).toFixed(2)}</strong>
              </div>
              <div className="onboarding-summary-row">
                <span>Casas cadastradas</span>
                <strong>{bookmakers.length === 0 ? "Nenhuma (adicionar depois)" : `${bookmakers.length} casa${bookmakers.length > 1 ? "s" : ""}`}</strong>
              </div>
            </div>

            <div className="onboarding-next-steps">
              <p><TrendingUp size={14} /> Próximos passos</p>
              <ul>
                <li>Registre sua primeira aposta com <strong>+ Nova aposta</strong></li>
                <li>Acompanhe stake em unidades e alertas de over-staking no <strong>Dashboard</strong></li>
                <li>Crie conta para sincronizar em nuvem em <strong>Configurações</strong></li>
              </ul>
            </div>

            <button className="primary full-width" onClick={handleComplete}>Entrar no Banca+</button>
          </div>
        )}
      </div>
    </div>
  );
}
