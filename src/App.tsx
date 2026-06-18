import React, { FormEvent, Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "firebase/auth";
import { Toaster, toast } from "react-hot-toast";
import {
  LayoutDashboard, ListChecks, Upload, Brain, FileBarChart,
  TrendingUp, Wallet, Target, Settings2, Plus,
  CloudUpload, User as UserIcon, Bell, Search, X
} from "lucide-react";
import { BrandLogo } from "./components/BrandLogo";
import { CookieBanner, getStoredConsent, type CookieConsent } from "./components/CookieBanner";
import { LoadingScreen } from "./components/LoadingScreen";
import { Button } from "./components/ui/button";
import {
  createEmailUser,
  loadCloudState,
  resetEmailPassword,
  saveCloudState,
  signInDemoUser,
  signInEmailUser,
  signInWithGoogle,
  signOutDemoUser,
  watchAuth,
} from "./lib/cloudRepository";
import { useFirestoreSync } from "./lib/useFirestoreSync";
import {
  calculateMetrics,
  money,
  potentialReturn,
} from "./lib/metrics";
import { getDerivedBookmakerBalance, reconcileBookmakerBalances } from "./lib/ledger";
import { createBetId, createBookmakerId, createStrategyId, createTransactionId, emptyState, isFirstRun, loadStateForUser, resetState, saveState, saveStateForUser } from "./lib/storage";
import { uploadBetSlip } from "./lib/storageRepository";
import type { AppState, Bet, BookmakerAccount, NewBetDraft, NewBetPrefill, RiskSettings, Strategy, Transaction, TransactionType } from "./lib/types";
import { checkHardStop, riskAlertsExtended } from "./lib/riskGuard";
import { detectTilt } from "./lib/tiltDetection";
import { buildBetFromForm, buildBetEdit, buildSettlement, buildBulkSettlement, buildDeletedBetState, mergeImportedBets } from "./services/bets.service";
import { EditBetModal } from "./components/EditBetModal";
import type { OnboardingResult } from "./components/Onboarding";
import { buildBookmaker, buildManualTransaction, buildVoidEntry } from "./services/bookmaker.service";

type View = "dashboard" | "bets" | "new-bet" | "import" | "intelligence" | "reports" | "clv" | "books" | "strategies" | "settings";

type NavItem = { id: View; label: string; badge?: string; Icon: React.ElementType };

const Onboarding = lazy(() => import("./components/Onboarding").then((module) => ({ default: module.Onboarding })));
const Dashboard = lazy(() => import("./components/Dashboard").then((module) => ({ default: module.Dashboard })));
const Bets = lazy(() => import("./components/Bets").then((module) => ({ default: module.Bets })));
const NewBet = lazy(() => import("./components/NewBet").then((module) => ({ default: module.NewBet })));
const QuickBet = lazy(() => import("./components/QuickBet").then((module) => ({ default: module.QuickBet })));
const Import = lazy(() => import("./components/Import").then((module) => ({ default: module.Import })));
const Intelligence = lazy(() => import("./components/Intelligence").then((module) => ({ default: module.Intelligence })));
const ClvEdge = lazy(() => import("./components/ClvEdge").then((module) => ({ default: module.ClvEdge })));
const Books = lazy(() => import("./components/Books").then((module) => ({ default: module.Books })));
const Strategies = lazy(() => import("./components/Strategies").then((module) => ({ default: module.Strategies })));
const Reports = lazy(() => import("./components/Reports").then((module) => ({ default: module.Reports })));
const Settings = lazy(() => import("./components/Settings").then((module) => ({ default: module.Settings })));
const AuthPage = lazy(() => import("./components/AuthPage").then((module) => ({ default: module.AuthPage })));


function withStateTimestamp(state: AppState): AppState {
  return {
    ...state,
    lastModifiedAt: new Date().toISOString(),
  };
}

function getStateTimestamp(state: AppState | null): number {
  if (!state?.lastModifiedAt) return 0;
  const time = new Date(state.lastModifiedAt).getTime();
  return Number.isFinite(time) ? time : 0;
}

function formatSyncTimestamp(value: string | null | undefined) {
  if (!value) return "sem registro";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "sem registro";
  return date.toLocaleString("pt-BR");
}

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
  const [state, setState] = useState<AppState>(() => emptyState());
  const [newBetPrefill, setNewBetPrefill] = useState<NewBetPrefill | null>(null);
  const [newBetDraft, setNewBetDraft] = useState<NewBetDraft | null>(null);
  const [betMode, setBetMode] = useState<"quick" | "full">("quick");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState("Sem sessao autenticada");
  const [authMessage, setAuthMessage] = useState("Entre para sincronizar seus dados em nuvem.");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [cookieConsent, setCookieConsent] = useState<CookieConsent | null>(() => getStoredConsent());
  const [editingBetId, setEditingBetId] = useState<string | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const notifRef = useRef<HTMLDivElement | null>(null);
  const metrics = useMemo(() => calculateMetrics(state), [state]);
  const hydratedUserRef = useRef<string | null>(null);
  const latestStateRef = useRef<AppState>(state);
  const latestUserRef = useRef<User | null>(user);
  latestStateRef.current = state;
  latestUserRef.current = user;

  useEffect(() => {
    const unsubscribe = watchAuth(async (nextUser) => {
      if (!nextUser) {
        setUser(null);
        hydratedUserRef.current = null;
        setState(emptyState());
        setShowOnboarding(false);
        setSyncStatus("Sem sessao autenticada");
        setAuthLoading(false);
        return;
      }
      setUser(nextUser);
      const label = nextUser.isAnonymous ? `sessao temporaria ${nextUser.uid.slice(0, 8)}` : nextUser.email ?? "usuario autenticado";
      setSyncStatus(`Conectado como ${label}`);
      let loadedState: AppState;
      try {
        const localState = loadStateForUser(nextUser.uid);
        const cloudState = await loadCloudState(nextUser.uid);
        if (cloudState) {
          loadedState = getStateTimestamp(localState) > getStateTimestamp(cloudState)
            ? localState
            : cloudState;
          saveStateForUser(nextUser.uid, loadedState);
          if (loadedState === localState && getStateTimestamp(localState) > getStateTimestamp(cloudState)) {
            saveCloudState(nextUser.uid, loadedState).catch(console.error);
          }
        } else {
          loadedState = localState;
          if (getStateTimestamp(localState) > 0) {
            saveCloudState(nextUser.uid, localState).catch(console.error);
          }
        }
      } catch {
        loadedState = loadStateForUser(nextUser.uid);
      }
      hydratedUserRef.current = nextUser.uid;
      applyHydratedState(loadedState, nextUser.uid);
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user || user.isAnonymous || authLoading) return;
    saveStateForUser(user.uid, state);
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      saveCloudState(user.uid, state).catch(console.error);
    }, 1500);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [state, user, authLoading]);

  // Flush imediato quando o app vai para segundo plano (troca de aba, lock screen, fechar)
  useEffect(() => {
    function onVisibilityChange() {
      const u = latestUserRef.current;
      const s = latestStateRef.current;
      if (document.visibilityState !== "hidden" || !u || u.isAnonymous) return;
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
      saveCloudState(u.uid, s).catch(console.error);
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;
    const bets = state.bets.filter((bet) =>
      [bet.eventName, bet.league, bet.sport, bet.market, bet.selection, ...(bet.tags ?? [])]
        .some((field) => field?.toLowerCase().includes(q))
    );
    const bookmakers = state.bookmakers.filter((book) =>
      book.name.toLowerCase().includes(q)
    );
    const strategies = state.strategies.filter((s) =>
      s.name.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q)
    );
    return { bets, bookmakers, strategies };
  }, [searchQuery, state.bets, state.bookmakers, state.strategies]);

  const totalResults = searchResults
    ? searchResults.bets.length + searchResults.bookmakers.length + searchResults.strategies.length
    : 0;

  function handleSearchInput(value: string) {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setSearchQuery(value);
    }, 200);
    if (value.trim()) {
      setSearchOpen(true);
    } else {
      setSearchOpen(false);
    }
  }

  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setSearchOpen(false);
      setSearchQuery("");
      if (searchInputRef.current) searchInputRef.current.value = "";
    }
    if (event.key === "Enter" && searchResults) {
      if (searchResults.bets.length > 0) {
        setView("bets");
        setSearchOpen(false);
      } else if (searchResults.bookmakers.length > 0) {
        setView("books");
        setSearchOpen(false);
      } else if (searchResults.strategies.length > 0) {
        setView("strategies");
        setSearchOpen(false);
      }
    }
  }

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setSearchQuery("");
    if (searchInputRef.current) searchInputRef.current.value = "";
  }, []);

  const notifications = useMemo(() => {
    const alerts = riskAlertsExtended(state).map((a) => ({ level: a.level, title: a.title, detail: a.detail }));
    const tilt = detectTilt(state);
    const tiltItems = tilt.signals.map((s) => ({
      level: tilt.level === "high" || tilt.level === "critical" ? "danger" as const : "warning" as const,
      title: s.type.replace(/_/g, " "),
      detail: s.description,
    }));
    return [...alerts, ...tiltItems];
  }, [state]);

  useEffect(() => {
    if (!showNotifications) return;
    function handleClick(e: MouseEvent) {
      if (!(e.target instanceof Node)) return;
      if (!notifRef.current?.contains(e.target)) setShowNotifications(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showNotifications]);

  function updateState(next: AppState): AppState {
    const reconciled = reconcileBookmakerBalances(next);
    const stamped = withStateTimestamp(reconciled);
    setState(stamped);
    setShowOnboarding(isFirstRun(stamped));
    if (user) {
      saveStateForUser(user.uid, stamped);
    } else {
      saveState(stamped);
    }
    return stamped;
  }

  function syncToCloud(stamped: AppState) {
    if (!user || user.isAnonymous) return;
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    saveCloudState(user.uid, stamped).catch(console.error);
  }

  function applyHydratedState(next: AppState, targetUid?: string | null) {
    const reconciled = reconcileBookmakerBalances(next);
    setState(reconciled);
    setShowOnboarding(isFirstRun(reconciled));
    if (targetUid) {
      saveStateForUser(targetUid, reconciled);
    } else {
      saveState(reconciled);
    }
  }

  const handleRemoteSyncUpdate = useCallback((remoteState: AppState) => {
    if (!user || user.isAnonymous || authLoading) return;
    if (hydratedUserRef.current !== user.uid) return;

    const localTimestamp = getStateTimestamp(state);
    const remoteTimestamp = getStateTimestamp(remoteState);

    if (remoteTimestamp === 0 || remoteTimestamp <= localTimestamp) {
      return;
    }

    applyHydratedState(remoteState, user.uid);
    setSyncStatus(`Snapshot remoto aplicado em ${new Date().toLocaleTimeString("pt-BR")}`);
  }, [authLoading, state, user]);

  const realtimeSync = useFirestoreSync(user, state, handleRemoteSyncUpdate);

  useEffect(() => {
    if (!user || user.isAnonymous || authLoading) return;
    if (realtimeSync.status === "error" && realtimeSync.error) {
      setSyncStatus(`Sync realtime com erro: ${realtimeSync.error}`);
      return;
    }
    if (realtimeSync.status === "synced" && realtimeSync.lastSyncAt) {
      setSyncStatus(`Sync realtime ativo - ultimo check ${realtimeSync.lastSyncAt.toLocaleTimeString("pt-BR")}`);
    }
  }, [authLoading, realtimeSync.error, realtimeSync.lastSyncAt, realtimeSync.status, user]);

  function openNewBet(prefill: NewBetPrefill | null = null) {
    if (prefill) {
      setNewBetDraft(null);
    }
    setNewBetPrefill(prefill);
    setView("new-bet");
  }

  function completeOnboarding(patch: OnboardingResult) {
    const onboardingTransactions = patch.bookmakers
      .filter((book) => book.balance > 0)
      .map((book) => ({
        id: createTransactionId(),
        date: new Date().toISOString(),
        type: "deposit" as TransactionType,
        bookmakerId: book.id,
        description: `Saldo inicial - ${book.name}`,
        amount: book.balance,
        referenceType: "bookmaker" as const,
        referenceId: book.id,
      }));
    const next: AppState = {
      ...state,
      bankrollName: patch.bankrollName,
      startingBalance: patch.startingBalance,
      riskSettings: {
        ...state.riskSettings,
        unitMode: patch.unit.mode,
        unitFixed: patch.unit.fixed,
        unitPercent: patch.unit.percent,
        maxStakeUnits: patch.unit.maxStakeUnits,
      },
      bookmakers: patch.bookmakers.length > 0
        ? patch.bookmakers
        : state.bookmakers,
      transactions: onboardingTransactions.length > 0 ? onboardingTransactions : state.transactions,
    };
    updateState(next);
    setShowOnboarding(false);
  }

  async function connectCloud() {
    setSyncStatus("Conectando ao Firebase...");
    try {
      const signedUser = await signInDemoUser();
      setSyncStatus(`Sessao temporaria iniciada: ${signedUser.uid.slice(0, 8)}`);
      toast.success("Sessão temporária iniciada.");
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
        hydratedUserRef.current = signedUser.uid;
        applyHydratedState(cloudState, signedUser.uid);
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

  async function signInWithGoogleAccount() {
    setAuthMessage("Conectando com Google...");
    try {
      const googleUser = await signInWithGoogle();
      const cloudState = await loadCloudState(googleUser.uid);
      if (cloudState) {
        hydratedUserRef.current = googleUser.uid;
        applyHydratedState(cloudState, googleUser.uid);
        setAuthMessage("Login feito. Dados carregados da nuvem.");
        toast.success("Login com Google! Dados carregados da nuvem.");
        return;
      }
      await saveCloudState(googleUser.uid, state);
      setAuthMessage("Login feito. Estado local salvo na nuvem.");
      toast.success("Login com Google! Estado local salvo na nuvem.");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Falha ao entrar com Google.";
      setAuthMessage(msg);
      toast.error(msg);
    }
  }

  async function disconnectCloud() {
    await signOutDemoUser();
    hydratedUserRef.current = null;
    setState(emptyState());
    setShowOnboarding(false);
    setUser(null);
    setSyncStatus("Sem sessao autenticada");
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

      const localTimestamp = getStateTimestamp(state);
      const remoteTimestamp = getStateTimestamp(cloudState);

      if (localTimestamp > 0 && remoteTimestamp > 0 && remoteTimestamp < localTimestamp) {
        const shouldOverwrite = window.confirm(
          [
            "O snapshot local e mais recente do que o snapshot salvo na nuvem.",
            "",
            `Local: ${formatSyncTimestamp(state.lastModifiedAt)}`,
            `Nuvem: ${formatSyncTimestamp(cloudState.lastModifiedAt)}`,
            "",
            "Se continuar, o estado local atual sera substituido pelo snapshot remoto.",
          ].join("\n"),
        );

        if (!shouldOverwrite) {
          setSyncStatus("Restauracao cancelada: o estado local continua preservado.");
          return;
        }
      }

      applyHydratedState(cloudState, user.uid);
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
    const uploadedSlipImagePath = String(data.get("uploadedSlipImagePath") || "");
    const uploadedSlipImageUrl = String(data.get("uploadedSlipImageUrl") || "");

    const hardStop = checkHardStop(state);
    if (hardStop?.blocked) {
      toast.error(`Hard Stop ativo: ${hardStop.reason}`, { duration: 6000 });
      return;
    }

    let slipImagePath: string | undefined;
    let slipImageUrl: string | undefined;

    if (maybeSlip instanceof File && maybeSlip.size > 0) {
      if (uploadedSlipImagePath && uploadedSlipImageUrl) {
        slipImagePath = uploadedSlipImagePath;
        slipImageUrl = uploadedSlipImageUrl;
      } else if (user) {
        const upload = await uploadBetSlip(user.uid, maybeSlip);
        slipImagePath = upload.path;
        slipImageUrl = upload.url;
      }
    }

    const result = buildBetFromForm(data, state, slipImagePath, slipImageUrl);
    if (!result.ok) {
      toast.error(result.error);
      if (result.redirectTo) setView(result.redirectTo);
      return;
    }

    const { bet, transaction } = result;
    syncToCloud(updateState({ ...state, bets: [bet, ...state.bets], transactions: [transaction, ...state.transactions] }));
    setNewBetPrefill(null);
    setNewBetDraft(null);
    form.reset();
    setView("bets");
    toast.success("Aposta registrada com sucesso!");
  }

  function settleBet(id: string, status: Bet["status"], cashoutAmount?: number) {
    const result = buildSettlement(state.bets, id, status, cashoutAmount);
    if (!result) return;
    const { updatedBets, newTransaction } = result;
    const transactions = newTransaction ? [newTransaction, ...state.transactions] : state.transactions;
    syncToCloud(updateState({ ...state, bets: updatedBets, transactions }));
    const labels: Record<Bet["status"], string> = {
      won: "Ganha! 🎯", lost: "Perdida", cashout: "Cashout registrado",
      void: "Aposta cancelada", pending: "Pendente"
    };
    toast.success(labels[status] ?? "Status atualizado");
  }

  function bulkSettle(ids: string[], status: "won" | "lost" | "void") {
    const { updatedBets, newTransactions, settledCount } = buildBulkSettlement(state, ids, status);
    if (settledCount === 0) return;
    syncToCloud(updateState({
      ...state,
      bets: updatedBets,
      transactions: [...newTransactions, ...state.transactions],
    }));
    const labels: Record<"won" | "lost" | "void", string> = {
      won: "ganhas", lost: "perdidas", void: "anuladas",
    };
    toast.success(`${settledCount} aposta${settledCount > 1 ? "s" : ""} ${labels[status]}`);
  }

  function deleteBet(id: string) {
    const bet = state.bets.find((b) => b.id === id);
    if (!bet) return;

    syncToCloud(updateState({
      ...state,
      bets: state.bets.filter((b) => b.id !== id),
      transactions: state.transactions.filter((t) => t.referenceId !== id),
    }));
    toast.success("Aposta excluída");
  }

  function editBet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const betId = editingBetId;
    if (!betId) return;
    const result = buildBetEdit(new FormData(event.currentTarget), state, betId);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    syncToCloud(updateState({
      ...state,
      bets: state.bets.map((b) => b.id === betId ? result.updatedBet : b),
      transactions: result.updatedTransactions,
    }));
    setEditingBetId(null);
    toast.success("Aposta atualizada");
  }

  function importBets(bets: Bet[]) {
    const existingIds = new Set(state.bets.map((bet) => bet.id));
    const uniqueBets = bets.filter((bet) => !existingIds.has(bet.id));
    const importTransactions: Transaction[] = uniqueBets.flatMap((bet) => {
      const items: Transaction[] = [{
        id: createTransactionId(),
        date: bet.placedAt,
        type: "bet_stake",
        bookmakerId: bet.bookmakerId,
        description: `Stake - ${bet.eventName}`,
        amount: -bet.stake,
        referenceType: "bet",
        referenceId: bet.id,
      }];

      if (bet.status === "won" || bet.status === "cashout") {
        const payout = bet.payout ?? (bet.status === "won" ? potentialReturn(bet) : undefined);
        if (payout != null) {
          items.push({
            id: createTransactionId(),
            date: bet.eventAt,
            type: "bet_payout",
            bookmakerId: bet.bookmakerId,
            description: `Retorno - ${bet.eventName}`,
            amount: payout,
            referenceType: "bet",
            referenceId: bet.id,
          });
        }
      }

      if (bet.status === "void") {
        items.push({
          id: createTransactionId(),
          date: bet.eventAt,
          type: "bet_refund",
          bookmakerId: bet.bookmakerId,
          description: `Void - ${bet.eventName}`,
          amount: bet.stake,
          referenceType: "bet",
          referenceId: bet.id,
        });
      }

      return items;
    });
    syncToCloud(updateState({
      ...state,
      bets: [...uniqueBets, ...state.bets],
      transactions: [...importTransactions.reverse(), ...state.transactions],
    }));
    setView("bets");
    toast.success(`${uniqueBets.length} apostas importadas!`);
  }

  function addBookmaker(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name")).trim();
    const balance = Number(data.get("balance")) || 0;

    if (!name) {
      toast.error("Informe o nome da casa.");
      return;
    }

    if (state.bookmakers.some((book) => book.name.toLowerCase() === name.toLowerCase())) {
      toast.error("Esta casa ja esta cadastrada.");
      return;
    }

    const bookmaker: BookmakerAccount = {
      id: createBookmakerId(),
      name,
      balance,
      status: "manual",
      lastSyncLabel: "manual",
    };

    const transaction = balance > 0 ? [{
      id: createTransactionId(),
      date: new Date().toISOString(),
      type: "deposit" as TransactionType,
      bookmakerId: bookmaker.id,
      description: `Saldo inicial - ${name}`,
      amount: balance,
      referenceType: "bookmaker" as const,
      referenceId: bookmaker.id,
    }] : [];

    syncToCloud(updateState({
      ...state,
      bookmakers: [...state.bookmakers, bookmaker],
      transactions: [...transaction, ...state.transactions],
    }));
    event.currentTarget.reset();
    toast.success("Casa adicionada.");
  }

  function updateBookmaker(event: FormEvent<HTMLFormElement>, bookmakerId: string) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name")).trim();

    if (!name) {
      toast.error("Informe o nome da casa.");
      return;
    }

    const currentBook = state.bookmakers.find((book) => book.id === bookmakerId);
    if (!currentBook) {
      toast.error("Casa nao encontrada.");
      return;
    }

    if (
      state.bookmakers.some(
        (book) => book.id !== bookmakerId && book.name.toLowerCase() === name.toLowerCase()
      )
    ) {
      toast.error("Ja existe outra casa com este nome.");
      return;
    }

    updateState({
      ...state,
      bookmakers: state.bookmakers.map((book) => (
        book.id === bookmakerId ? { ...book, name } : book
      )),
    });
    toast.success(`Casa atualizada para ${name}.`);
  }

  function removeBookmaker(bookmakerId: string) {
    const currentBook = state.bookmakers.find((book) => book.id === bookmakerId);
    if (!currentBook) {
      toast.error("Casa nao encontrada.");
      return;
    }

    const hasBets = state.bets.some((bet) => bet.bookmakerId === bookmakerId);
    const hasTransactions = state.transactions.some(
      (transaction) =>
        transaction.bookmakerId === bookmakerId || transaction.targetBookmakerId === bookmakerId
    );

    if (hasBets || hasTransactions) {
      toast.error("Nao e possivel remover uma casa com historico vinculado.");
      return;
    }

    updateState({
      ...state,
      bookmakers: state.bookmakers.filter((book) => book.id !== bookmakerId),
    });
    toast.success(`Casa ${currentBook.name} removida.`);
  }

  function addTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const type = String(data.get("type")) as TransactionType;
    const bookmakerId = String(data.get("bookmakerId"));
    const targetBookmakerId = String(data.get("targetBookmakerId"));
    const rawAmount = Math.abs(Number(data.get("amount")));
    const sourceBookmaker = state.bookmakers.find((book) => book.id === bookmakerId);
    const targetBookmaker = state.bookmakers.find((book) => book.id === targetBookmakerId);

    if (!sourceBookmaker) {
      toast.error("Selecione uma casa de origem valida.");
      return;
    }

    if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
      toast.error("Informe um valor valido.");
      return;
    }

    if (type === "transfer") {
      if (!targetBookmaker) {
        toast.error("Selecione uma casa de destino valida.");
        return;
      }
      if (targetBookmakerId === bookmakerId) {
        toast.error("Origem e destino precisam ser diferentes.");
        return;
      }
    }

    const sourceAvailableBalance = getDerivedBookmakerBalance(state, bookmakerId);
    if ((type === "withdrawal" || type === "transfer") && rawAmount > sourceAvailableBalance) {
      toast.error(`Saldo insuficiente na ${sourceBookmaker.name}.`);
      return;
    }

    const signedAmount = type === "withdrawal" || type === "transfer" ? -rawAmount : rawAmount;
    const baseDate = new Date().toISOString();
    const description = String(data.get("description")) || type;
    const transactions: Transaction[] = type === "transfer"
      ? [
        {
          id: createTransactionId(),
          date: baseDate,
          type,
          bookmakerId,
          targetBookmakerId,
          description,
          amount: signedAmount,
          referenceType: "manual",
        },
        {
          id: createTransactionId(),
          date: baseDate,
          type,
          bookmakerId: targetBookmakerId,
          targetBookmakerId: bookmakerId,
          description,
          amount: rawAmount,
          referenceType: "manual",
        },
      ]
      : [{
        id: createTransactionId(),
        date: baseDate,
        type,
        bookmakerId,
        targetBookmakerId: undefined,
        description,
        amount: signedAmount,
        referenceType: "manual",
      }];

    syncToCloud(updateState({ ...state, transactions: [...transactions.reverse(), ...state.transactions] }));
    event.currentTarget.reset();
    toast.success("Transação registrada!");
  }

  function voidTransaction(transactionId: string, bookmakerId: string, reason: string) {
    const original = state.transactions.find((t) => t.id === transactionId);
    if (!original) { toast.error("Transação não encontrada."); return; }
    if (original.voidedById) { toast.error("Esta transação já foi anulada."); return; }
    if (original.type === "void_entry") { toast.error("Não é possível anular uma anulação."); return; }
    if (original.referenceType === "bet") {
      toast.error("Lançamentos de apostas são imutáveis — eles refletem eventos já ocorridos.");
      return;
    }

    const voidId = createTransactionId();
    const voidEntry: Transaction = {
      id: voidId,
      date: new Date().toISOString(),
      type: "void_entry",
      bookmakerId,
      description: `Anulação: ${reason} (ref ${transactionId.slice(0, 12)})`,
      amount: -original.amount,
      referenceType: "manual",
      voidsCancelledId: transactionId,
    };
    const patchedOriginal: Transaction = { ...original, voidedById: voidId };
    const updatedTransactions = state.transactions.map((t) =>
      t.id === transactionId ? patchedOriginal : t,
    );
    syncToCloud(updateState({ ...state, transactions: [voidEntry, ...updatedTransactions] }));
    toast.success("Transação anulada. Lançamento de anulação criado no ledger.");
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

    syncToCloud(updateState({ ...state, strategies: [strategy, ...state.strategies] }));
    event.currentTarget.reset();
    toast.success("Estratégia criada!");
  }

  function toggleStrategy(id: string) {
    const strategy = state.strategies.find(s => s.id === id);
    const nextStatus = strategy?.status === "active" ? "pausada" : "reativada";
    syncToCloud(updateState({
      ...state,
      strategies: state.strategies.map((s) => (
        s.id === id
          ? { ...s, status: s.status === "active" ? "paused" : "active" }
          : s
      )),
    }));
    toast.success(`Estratégia ${nextStatus}`);
  }

  function updateRiskSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const riskSettings: RiskSettings = {
      unitMode: (data.get("unitMode") as RiskSettings["unitMode"]) || state.riskSettings.unitMode,
      unitFixed: data.get("unitFixed") != null ? Number(data.get("unitFixed")) : state.riskSettings.unitFixed,
      unitPercent: data.get("unitPercent") != null ? Number(data.get("unitPercent")) : state.riskSettings.unitPercent,
      maxStakeUnits: Number(data.get("maxStakeUnits")),
      maxOpenExposurePercent: Number(data.get("maxOpenExposurePercent")),
      lossStreakLimit: Number(data.get("lossStreakLimit")),
      hardStopEnabled: data.get("hardStopEnabled") === "on",
      dailyLossLimitPercent: Number(data.get("dailyLossLimitPercent")),
      weeklyLossLimitPercent: Number(data.get("weeklyLossLimitPercent")),
      monthlyDrawdownPercent: Number(data.get("monthlyDrawdownPercent")),
    };

    updateState({ ...state, riskSettings });
    toast.success("Limites de risco atualizados.");
  }

  function updateBankrollSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const bankrollName = String(data.get("bankrollName") || "").trim();
    const startingBalance = Number(data.get("startingBalance"));

    if (!bankrollName) {
      toast.error("Informe o nome da banca.");
      return;
    }

    if (!Number.isFinite(startingBalance) || startingBalance < 0) {
      toast.error("Informe um saldo inicial valido.");
      return;
    }

    syncToCloud(updateState({
      ...state,
      bankrollName,
      startingBalance,
    }));
    toast.success("Dados da banca atualizados.");
  }

  if (authLoading) return <LoadingScreen />;

  if (!user) {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <AuthPage
          onSignIn={signInAccount}
          onSignUp={createAccount}
          onReset={sendReset}
          onDemoMode={async () => { await connectCloud(); }}
          onGoogleSignIn={signInWithGoogleAccount}
          message={authMessage}
        />
      </Suspense>
    );
  }

  if (showOnboarding) {
    return (
      <Suspense fallback={<ViewFallback title="Carregando onboarding..." />}>
        <Onboarding onComplete={completeOnboarding} />
      </Suspense>
    );
  }

  const currentView = renderCurrentView();
  const newBetModal = view === "new-bet" ? (
    betMode === "quick" && !newBetPrefill ? (
      <Suspense fallback={<ModalFallback />}>
        <QuickBet
          state={state}
          onSubmit={addBet}
          onClose={() => { setNewBetPrefill(null); setView("bets"); }}
          onSwitchToFull={() => setBetMode("full")}
        />
      </Suspense>
    ) : (
      <Suspense fallback={<ModalFallback />}>
        <NewBet
          state={state}
          addBet={addBet}
          onClose={() => {
            setNewBetPrefill(null);
            setBetMode("quick");
            setView("bets");
          }}
          prefill={newBetPrefill}
          draft={newBetDraft}
          onDraftChange={setNewBetDraft}
        />
      </Suspense>
    )
  ) : null;

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
          <div className="search-wrapper">
            <div className="search-box">
              <Search size={14} className="search-icon" />
              <input
                ref={searchInputRef}
                placeholder="Buscar evento, liga, mercado, tag..."
                onChange={(e) => handleSearchInput(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                onFocus={() => { if (searchQuery.trim()) setSearchOpen(true); }}
                autoComplete="off"
              />
              {searchQuery && (
                <button className="search-clear" onClick={closeSearch} title="Limpar busca">
                  <X size={12} />
                </button>
              )}
            </div>
            {searchOpen && searchResults && totalResults > 0 && (
              <div className="search-dropdown">
                {searchResults.bets.length > 0 && (
                  <div className="search-group">
                    <span className="search-group-label">Apostas</span>
                    {searchResults.bets.slice(0, 5).map((bet) => (
                      <button
                        key={bet.id}
                        className="search-result-item"
                        onClick={() => { setView("bets"); closeSearch(); }}
                      >
                        <span className="search-result-title">{bet.eventName}</span>
                        <span className="search-result-meta">{bet.sport} · {bet.league} · {bet.market}</span>
                      </button>
                    ))}
                    {searchResults.bets.length > 5 && (
                      <button className="search-result-more" onClick={() => { setView("bets"); closeSearch(); }}>
                        +{searchResults.bets.length - 5} apostas
                      </button>
                    )}
                  </div>
                )}
                {searchResults.bookmakers.length > 0 && (
                  <div className="search-group">
                    <span className="search-group-label">Casas</span>
                    {searchResults.bookmakers.map((book) => (
                      <button
                        key={book.id}
                        className="search-result-item"
                        onClick={() => { setView("books"); closeSearch(); }}
                      >
                        <span className="search-result-title">{book.name}</span>
                        <span className="search-result-meta">Saldo disponível</span>
                      </button>
                    ))}
                  </div>
                )}
                {searchResults.strategies.length > 0 && (
                  <div className="search-group">
                    <span className="search-group-label">Estratégias</span>
                    {searchResults.strategies.map((s) => (
                      <button
                        key={s.id}
                        className="search-result-item"
                        onClick={() => { setView("strategies"); closeSearch(); }}
                      >
                        <span className="search-result-title">{s.name}</span>
                        <span className="search-result-meta">{s.description || s.status}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {searchOpen && searchResults && totalResults === 0 && (
              <div className="search-dropdown search-dropdown-empty">
                <span>Nenhum resultado para "{searchQuery}"</span>
              </div>
            )}
          </div>
          <div className="topbar-meta">
            <strong>{viewTitle(view)}</strong>
            <span>{user ? accountLabel(user) : `Sem sessao · ${state.bookmakers.length} ${state.bookmakers.length === 1 ? "casa" : "casas"}`}</span>
          </div>
          <div className="topbar-actions">
            <div className="notif-anchor" ref={notifRef}>
              <button
                title="Notificações"
                className={notifications.length > 0 ? "notif-btn notif-btn-active" : "notif-btn"}
                onClick={() => setShowNotifications((v) => !v)}
              >
                <Bell size={18} />
                {notifications.length > 0 && (
                  <span className="notif-badge">{notifications.length}</span>
                )}
              </button>
              {showNotifications && (
                <div className="notif-panel">
                  <div className="notif-panel-head">
                    <strong>Alertas</strong>
                    <span>{notifications.length} ativo{notifications.length !== 1 ? "s" : ""}</span>
                  </div>
                  {notifications.length === 0 ? (
                    <p className="notif-empty">Nenhum alerta ativo.</p>
                  ) : (
                    <ul className="notif-list">
                      {notifications.map((n, i) => (
                        <li key={i} className={`notif-item notif-item-${n.level}`}>
                          <strong>{n.title}</strong>
                          <span>{n.detail}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
            <button title="Configurações" onClick={() => setView("settings")}>
              <UserIcon size={18} />
            </button>
            {user && (
              <button title="Sync" onClick={pushCloud} className="sync-btn">
                <CloudUpload size={16} />
                <span>Salvar</span>
              </button>
            )}
            <Button className="primary btn-nova-aposta" onClick={() => openNewBet()}>
              <Plus size={16} />
              <span>Nova aposta</span>
            </Button>
          </div>
        </header>

        <Suspense fallback={<ViewFallback title={`Carregando ${viewTitle(view).toLowerCase()}...`} />}>
          {currentView}
        </Suspense>

        {/* Modal — renderizado sobre qualquer view */}
        {newBetModal}
        {editingBetId && (() => {
          const bet = state.bets.find((b) => b.id === editingBetId);
          return bet ? (
            <EditBetModal
              bet={bet}
              state={state}
              onSubmit={editBet}
              onClose={() => setEditingBetId(null)}
            />
          ) : null;
        })()}
        <button className="fab" onClick={() => openNewBet()} title="Nova aposta">+</button>

        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "#141414",
              color: "#EDEDED",
              border: "1px solid rgba(255,255,255,0.12)",
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: "14px",
            },
            success: { iconTheme: { primary: "#22C55E", secondary: "#0a1a0f" } },
            error: { iconTheme: { primary: "#EF4444", secondary: "#1a0505" } },
          }}
        />

        {cookieConsent === null && (
          <CookieBanner
            onConsent={(choice) => {
              setCookieConsent(choice);
              if (choice === "all") void import("./lib/firebase").then((m) => m.initAnalytics());
            }}
          />
        )}
      </main>
    </div>
  );

  function renderCurrentView() {
    switch (view) {
      case "dashboard":
        return (
          <Dashboard
            state={state}
            metrics={metrics}
            onOpenNewBet={() => openNewBet()}
            onOpenBooks={() => setView("books")}
          />
        );
      case "bets":
        return <Bets state={state} settleBet={settleBet} bulkSettle={bulkSettle} deleteBet={deleteBet} onEditBet={setEditingBetId} />;
      case "import":
        return <Import state={state} importBets={importBets} onOpenBets={() => setView("bets")} />;
      case "intelligence":
        return <Intelligence state={state} metrics={metrics} onOpenNewBet={openNewBet} />;
      case "reports":
        return <Reports state={state} metrics={metrics} />;
      case "clv":
        return <ClvEdge state={state} metrics={metrics} />;
      case "books":
        return (
          <Books
            state={state}
            addBookmaker={addBookmaker}
            updateBookmaker={updateBookmaker}
            removeBookmaker={removeBookmaker}
            addTransaction={addTransaction}
            voidTransaction={voidTransaction}
          />
        );
      case "strategies":
        return <Strategies state={state} addStrategy={addStrategy} toggleStrategy={toggleStrategy} />;
      case "settings":
        return (
          <Settings
            state={state}
            reset={() => updateState(resetState())}
            user={user}
            pushCloud={pushCloud}
            pullCloud={pullCloud}
            disconnectCloud={disconnectCloud}
            onGoToAuth={() => { /* auth is now the gate — logging out redirects automatically */ }}
            updateBankrollSettings={updateBankrollSettings}
            updateRiskSettings={updateRiskSettings}
          />
        );
      default:
        return null;
    }
  }
}

function viewTitle(view: View) {
  const item = navGroups.flatMap((group) => group.items).find((nav) => nav.id === view);
  return item?.label ?? "Banca+";
}

function accountLabel(user: User) {
  if (user.isAnonymous) return `Conta temporaria ${user.uid.slice(0, 8)}`;
  return user.displayName || user.email || "Conta conectada";
}

function ViewFallback({ title }: { title: string }) {
  return (
    <section className="page">
      <article className="panel">
        <strong>{title}</strong>
        <p style={{ marginTop: 8, color: "var(--muted)" }}>
          Carregando...
        </p>
      </article>
    </section>
  );
}

function ModalFallback() {
  return (
    <div className="modal-overlay">
      <div className="modal-panel">
        <h2>Carregando nova aposta...</h2>
        <p style={{ color: "var(--muted)" }}>
          Preparando OCR, busca de eventos e formulário.
        </p>
      </div>
    </div>
  );
}
