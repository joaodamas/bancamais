import { FormEvent, useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { BrandLogo } from "./components/BrandLogo";
import { Dashboard } from "./components/Dashboard";
import { Bets } from "./components/Bets";
import { NewBet } from "./components/NewBet";
import { Import } from "./components/Import";
import { Intelligence } from "./components/Intelligence";
import { ClvEdge } from "./components/ClvEdge";
import { Books } from "./components/Books";
import { Strategies } from "./components/Strategies";
import { Reports } from "./components/Reports";
import { Settings } from "./components/Settings";
import {
  createEmailUser,
  loadCloudState,
  resetEmailPassword,
  saveCloudState,
  signInDemoUser,
  signInEmailUser,
  signOutDemoUser,
  watchAuth,
} from "./lib/cloudRepository";
import {
  calculateMetrics,
  money,
  potentialReturn,
} from "./lib/metrics";
import { createBetId, createStrategyId, createTransactionId, loadState, resetState, saveState } from "./lib/storage";
import { uploadBetSlip } from "./lib/storageRepository";
import type { AppState, Bet, RiskSettings, Strategy, Transaction, TransactionType } from "./lib/types";

type View = "dashboard" | "bets" | "new-bet" | "import" | "intelligence" | "reports" | "clv" | "books" | "strategies" | "settings";

const navGroups: Array<{ label: string; items: Array<{ id: View; label: string; badge?: string }> }> = [
  {
    label: "Inicio",
    items: [
      { id: "dashboard", label: "Dashboard" },
      { id: "bets", label: "Apostas", badge: "+12" },
      { id: "import", label: "Importar" },
    ],
  },
  {
    label: "Analise",
    items: [
      { id: "intelligence", label: "Inteligencia", badge: "IA" },
      { id: "reports", label: "Relatorios" },
      { id: "clv", label: "CLV & Edge" },
    ],
  },
  {
    label: "Gestao",
    items: [
      { id: "books", label: "Bancas & casas" },
      { id: "strategies", label: "Estrategias" },
      { id: "settings", label: "Configuracoes" },
    ],
  },
];

export function App() {
  const [view, setView] = useState<View>("dashboard");
  const [state, setState] = useState<AppState>(() => loadState());
  const [user, setUser] = useState<User | null>(null);
  const [syncStatus, setSyncStatus] = useState("Modo demo local");
  const [authMessage, setAuthMessage] = useState("Entre para sincronizar seus dados em nuvem.");
  const metrics = useMemo(() => calculateMetrics(state), [state]);

  useEffect(() => watchAuth((nextUser) => {
    setUser(nextUser);
    if (!nextUser) {
      setSyncStatus("Modo demo local");
      return;
    }

    const label = nextUser.isAnonymous ? "usuario anonimo" : nextUser.email ?? "usuario autenticado";
    setSyncStatus(`Conectado como ${label}`);
  }), []);

  function updateState(next: AppState) {
    setState(next);
    saveState(next);
  }

  async function connectCloud() {
    setSyncStatus("Conectando ao Firebase...");
    try {
      const signedUser = await signInDemoUser();
      setSyncStatus(`Conectado anonimamente: ${signedUser.uid.slice(0, 8)}`);
    } catch (error) {
      setSyncStatus(error instanceof Error ? error.message : "Falha ao conectar ao Firebase");
    }
  }

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const displayName = String(data.get("displayName"));
    const email = String(data.get("email"));
    const password = String(data.get("password"));

    setAuthMessage("Criando conta...");
    try {
      const createdUser = await createEmailUser(email, password, displayName);
      await saveCloudState(createdUser.uid, state);
      setAuthMessage(`Conta criada para ${createdUser.email}. Snapshot local salvo na nuvem.`);
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : "Falha ao criar conta.");
    }
  }

  async function signInAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email"));
    const password = String(data.get("password"));

    setAuthMessage("Entrando...");
    try {
      const signedUser = await signInEmailUser(email, password);
      const cloudState = await loadCloudState(signedUser.uid);
      if (cloudState) {
        updateState(cloudState);
        setAuthMessage("Login feito. Snapshot carregado da nuvem.");
        return;
      }

      await saveCloudState(signedUser.uid, state);
      setAuthMessage("Login feito. Nenhum snapshot anterior encontrado; estado local salvo na nuvem.");
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : "Falha ao entrar.");
    }
  }

  async function sendReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email"));

    setAuthMessage("Enviando reset...");
    try {
      await resetEmailPassword(email);
      setAuthMessage("Email de recuperacao enviado.");
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : "Falha ao enviar recuperacao.");
    }
  }

  async function disconnectCloud() {
    await signOutDemoUser();
    setSyncStatus("Modo demo local");
  }

  async function pushCloud() {
    if (!user) {
      setSyncStatus("Conecte ao Firebase antes de salvar na nuvem.");
      return;
    }

    setSyncStatus("Salvando snapshot no Firestore...");
    try {
      await saveCloudState(user.uid, state);
      setSyncStatus(`Snapshot salvo no Firestore em ${new Date().toLocaleTimeString("pt-BR")}`);
    } catch (error) {
      setSyncStatus(error instanceof Error ? error.message : "Falha ao salvar no Firestore");
    }
  }

  async function pullCloud() {
    if (!user) {
      setSyncStatus("Conecte ao Firebase antes de carregar da nuvem.");
      return;
    }

    setSyncStatus("Carregando snapshot do Firestore...");
    try {
      const cloudState = await loadCloudState(user.uid);
      if (!cloudState) {
        setSyncStatus("Nenhum snapshot encontrado na nuvem.");
        return;
      }

      updateState(cloudState);
      setSyncStatus(`Snapshot carregado do Firestore em ${new Date().toLocaleTimeString("pt-BR")}`);
    } catch (error) {
      setSyncStatus(error instanceof Error ? error.message : "Falha ao carregar do Firestore");
    }
  }

  async function addBet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const maybeSlip = data.get("slip");
    let slipImagePath: string | undefined;
    let slipImageUrl: string | undefined;

    if (maybeSlip instanceof File && maybeSlip.size > 0) {
      if (!user) {
        setSyncStatus("Conecte uma conta antes de enviar print para o Storage.");
        return;
      }

      const upload = await uploadBetSlip(user.uid, maybeSlip);
      slipImagePath = upload.path;
      slipImageUrl = upload.url;
    }

    const bet: Bet = {
      id: createBetId(),
      placedAt: new Date().toISOString(),
      eventAt: String(data.get("eventAt")),
      sport: String(data.get("sport")),
      league: String(data.get("league")),
      eventName: String(data.get("eventName")),
      market: String(data.get("market")),
      selection: String(data.get("selection")),
      bookmakerId: String(data.get("bookmakerId")),
      strategyId: String(data.get("strategyId")) || undefined,
      tags: String(data.get("tags"))
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      stake: Number(data.get("stake")),
      odds: Number(data.get("odds")),
      status: "pending",
      closingOdds: Number(data.get("closingOdds")) || undefined,
      mode: String(data.get("mode")) as Bet["mode"],
      slipImagePath,
      slipImageUrl,
    };

    updateState({ ...state, bets: [bet, ...state.bets] });
    form.reset();
    setView("bets");
  }

  function settleBet(id: string, status: Bet["status"]) {
    updateState({
      ...state,
      bets: state.bets.map((bet) => {
        if (bet.id !== id) return bet;
        const payout = status === "won" ? potentialReturn(bet) : status === "void" ? bet.stake : 0;
        return { ...bet, status, payout };
      }),
    });
  }

  function importBets(bets: Bet[]) {
    const existingIds = new Set(state.bets.map((bet) => bet.id));
    const uniqueBets = bets.filter((bet) => !existingIds.has(bet.id));
    updateState({ ...state, bets: [...uniqueBets, ...state.bets] });
    setView("bets");
  }

  function addTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const type = String(data.get("type")) as TransactionType;
    const bookmakerId = String(data.get("bookmakerId"));
    const targetBookmakerId = String(data.get("targetBookmakerId"));
    const rawAmount = Math.abs(Number(data.get("amount")));
    const signedAmount = type === "withdrawal" || type === "transfer" ? -rawAmount : rawAmount;
    const transaction: Transaction = {
      id: createTransactionId(),
      date: new Date().toISOString(),
      type,
      bookmakerId,
      targetBookmakerId: type === "transfer" ? targetBookmakerId : undefined,
      description: String(data.get("description")) || type,
      amount: signedAmount,
    };

    const bookmakers = state.bookmakers.map((book) => {
      if (book.id === bookmakerId) {
        return { ...book, balance: book.balance + signedAmount };
      }

      if (type === "transfer" && book.id === targetBookmakerId) {
        return { ...book, balance: book.balance + rawAmount };
      }

      return book;
    });

    updateState({ ...state, bookmakers, transactions: [transaction, ...state.transactions] });
    event.currentTarget.reset();
  }

  function addStrategy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const strategy: Strategy = {
      id: createStrategyId(),
      name: String(data.get("name")),
      description: String(data.get("description")),
      status: "active",
    };

    updateState({ ...state, strategies: [strategy, ...state.strategies] });
    event.currentTarget.reset();
  }

  function toggleStrategy(id: string) {
    updateState({
      ...state,
      strategies: state.strategies.map((strategy) => (
        strategy.id === id
          ? { ...strategy, status: strategy.status === "active" ? "paused" : "active" }
          : strategy
      )),
    });
  }

  function updateRiskSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const riskSettings: RiskSettings = {
      unitPercent: Number(data.get("unitPercent")),
      maxStakeUnits: Number(data.get("maxStakeUnits")),
      maxOpenExposurePercent: Number(data.get("maxOpenExposurePercent")),
      lossStreakLimit: Number(data.get("lossStreakLimit")),
    };

    updateState({ ...state, riskSettings });
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <BrandLogo />

        <button className="bank-pill" onClick={() => setView("books")}>
          <span>{state.bankrollName}</span>
          <strong>{money.format(metrics.totalBalance)}</strong>
        </button>

        <nav>
          {navGroups.map((group) => (
            <div className="nav-group" key={group.label}>
              <span>{group.label}</span>
              {group.items.map((item) => (
                <button className={view === item.id ? "active" : ""} key={item.id} onClick={() => setView(item.id)}>
                  {item.label}
                  {item.badge && <em>{item.badge}</em>}
                </button>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="search-box">
            <span>⌕</span>
            <input placeholder="Buscar evento, liga, mercado, tag..." />
          </div>
          <div className="topbar-meta">
            <strong>{viewTitle(view)}</strong>
            <span>{user ? accountLabel(user) : "Modo local"} · bancamais.jpproject.com.br</span>
          </div>
          <div className="topbar-actions">
            <button title="Notificacoes">●</button>
            <button title="Calendario">□</button>
            <button className="primary" onClick={() => setView("new-bet")}>+ Nova aposta</button>
          </div>
        </header>

        {view === "dashboard" && <Dashboard state={state} metrics={metrics} />}
        {view === "bets" && <Bets state={state} settleBet={settleBet} />}
        {view === "import" && <Import state={state} importBets={importBets} />}
        {view === "intelligence" && <Intelligence state={state} metrics={metrics} />}
        {view === "strategies" && <Strategies state={state} addStrategy={addStrategy} toggleStrategy={toggleStrategy} />}
        {view === "clv" && <ClvEdge state={state} metrics={metrics} />}
        {view === "reports" && <Reports state={state} metrics={metrics} />}
        {view === "books" && <Books state={state} addTransaction={addTransaction} />}
        {view === "settings" && (
          <Settings
            state={state}
            reset={() => updateState(resetState())}
            user={user}
            syncStatus={syncStatus}
            connectCloud={connectCloud}
            disconnectCloud={disconnectCloud}
            pushCloud={pushCloud}
            pullCloud={pullCloud}
            createAccount={createAccount}
            signInAccount={signInAccount}
            sendReset={sendReset}
            authMessage={authMessage}
            updateRiskSettings={updateRiskSettings}
          />
        )}

        {/* Modal — renderizado sobre qualquer view */}
        {view === "new-bet" && (
          <NewBet state={state} addBet={addBet} onClose={() => setView("bets")} />
        )}
        <button className="fab" onClick={() => setView("new-bet")} title="Nova aposta">+</button>
      </main>
    </div>
  );
}

function viewTitle(view: View) {
  const item = navGroups.flatMap((group) => group.items).find((nav) => nav.id === view);
  return item?.label ?? "Banca+";
}

function accountLabel(user: User) {
  if (user.isAnonymous) return `Conectado anonimo ${user.uid.slice(0, 8)}`;
  return user.displayName || user.email || "Conta conectada";
}
