import React, { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "firebase/auth";
import { Toaster, toast } from "react-hot-toast";
import {
  LayoutDashboard, ListChecks, Upload, Brain, FileBarChart,
  TrendingUp, Wallet, Target, Settings2, Plus,
  CloudUpload, User as UserIcon, Bell
} from "lucide-react";
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
import { AuthPage } from "./components/AuthPage";
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

type View = "dashboard" | "bets" | "new-bet" | "import" | "intelligence" | "reports" | "clv" | "books" | "strategies" | "settings" | "auth";

type NavItem = { id: View; label: string; badge?: string; Icon: React.ElementType };

const navGroups: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "Inicio",
    items: [
      { id: "dashboard" as View, label: "Dashboard", Icon: LayoutDashboard },
      { id: "bets" as View, label: "Apostas", Icon: ListChecks },
      { id: "import" as View, label: "Importar", Icon: Upload },
    ],
  },
  {
    label: "Análise",
    items: [
      { id: "intelligence" as View, label: "Inteligência", badge: "IA", Icon: Brain },
      { id: "reports" as View, label: "Relatórios", Icon: FileBarChart },
      { id: "clv" as View, label: "CLV & Edge", Icon: TrendingUp },
    ],
  },
  {
    label: "Gestão",
    items: [
      { id: "books" as View, label: "Bancas & Casas", Icon: Wallet },
      { id: "strategies" as View, label: "Estratégias", Icon: Target },
      { id: "settings" as View, label: "Configurações", Icon: Settings2 },
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

  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user || user.isAnonymous) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      saveCloudState(user.uid, state).catch(console.error);
    }, 3000);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [state, user]);

  function updateState(next: AppState) {
    setState(next);
    saveState(next);
  }

  async function connectCloud() {
    setSyncStatus("Conectando ao Firebase...");
    try {
      const signedUser = await signInDemoUser();
      setSyncStatus(`Conectado anonimamente: ${signedUser.uid.slice(0, 8)}`);
      toast.success("Conectado ao Firebase!");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Falha ao conectar";
      setSyncStatus(msg);
      toast.error(msg);
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
      toast.success(`Conta criada para ${createdUser.email}!`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Falha ao criar conta.";
      setAuthMessage(msg);
      toast.error(msg);
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
        toast.success("Login feito. Dados carregados da nuvem!");
        return;
      }

      await saveCloudState(signedUser.uid, state);
      setAuthMessage("Login feito. Nenhum snapshot anterior encontrado; estado local salvo na nuvem.");
      toast.success("Login feito. Estado local salvo na nuvem!");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Falha ao entrar.";
      setAuthMessage(msg);
      toast.error(msg);
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
      toast.success("Email de recuperação enviado!");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Falha ao enviar recuperacao.";
      setAuthMessage(msg);
      toast.error(msg);
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
      toast.success("Dados salvos na nuvem!");
    } catch (error) {
      setSyncStatus(error instanceof Error ? error.message : "Falha ao salvar no Firestore");
      toast.error("Falha ao salvar na nuvem");
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
      toast.success("Dados carregados da nuvem!");
    } catch (error) {
      setSyncStatus(error instanceof Error ? error.message : "Falha ao carregar do Firestore");
      toast.error("Falha ao carregar da nuvem");
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
    toast.success("Aposta registrada com sucesso!");
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
    const labels: Record<Bet["status"], string> = {
      won: "Ganha! 🎯", lost: "Perdida", cashout: "Cashout registrado",
      void: "Aposta cancelada", pending: "Pendente"
    };
    toast.success(labels[status] ?? "Status atualizado");
  }

  function importBets(bets: Bet[]) {
    const existingIds = new Set(state.bets.map((bet) => bet.id));
    const uniqueBets = bets.filter((bet) => !existingIds.has(bet.id));
    updateState({ ...state, bets: [...uniqueBets, ...state.bets] });
    setView("bets");
    toast.success(`${uniqueBets.length} apostas importadas!`);
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
    toast.success("Transação registrada!");
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
    toast.success("Estratégia criada!");
  }

  function toggleStrategy(id: string) {
    const strategy = state.strategies.find(s => s.id === id);
    const nextStatus = strategy?.status === "active" ? "pausada" : "reativada";
    updateState({
      ...state,
      strategies: state.strategies.map((s) => (
        s.id === id
          ? { ...s, status: s.status === "active" ? "paused" : "active" }
          : s
      )),
    });
    toast.success(`Estratégia ${nextStatus}`);
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
                <button
                  className={view === item.id ? "active" : ""}
                  key={item.id}
                  onClick={() => setView(item.id)}
                >
                  <span className="nav-icon-label">
                    <item.Icon size={16} strokeWidth={2} />
                    {item.label}
                  </span>
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
            <button title="Notificações"><Bell size={18} /></button>
            <button title={user ? "Configurações" : "Entrar"} onClick={() => setView(user ? "settings" : "auth")}>
              <UserIcon size={18} />
            </button>
            {user && (
              <button title="Sync" onClick={pushCloud} className="sync-btn">
                <CloudUpload size={16} />
                <span>Salvar</span>
              </button>
            )}
            <button className="primary btn-nova-aposta" onClick={() => setView("new-bet")}>
              <Plus size={16} />
              Nova aposta
            </button>
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
        {view === "auth" && (
          <AuthPage
            onSignIn={signInAccount}
            onSignUp={createAccount}
            onReset={sendReset}
            onDemoMode={async () => { await connectCloud(); setView("dashboard"); }}
            message={authMessage}
          />
        )}
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

        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "#141c33",
              color: "#e6ecf7",
              border: "1px solid rgba(148,163,184,0.16)",
              fontFamily: "'Space Grotesk', system-ui, sans-serif",
              fontSize: "14px",
            },
            success: { iconTheme: { primary: "#7cffb2", secondary: "#052015" } },
            error: { iconTheme: { primary: "#ff6b81", secondary: "#1a0008" } },
          }}
        />
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
