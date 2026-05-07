import React, { FormEvent, Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "firebase/auth";
import { Toaster, toast } from "react-hot-toast";
import {
  LayoutDashboard, ListChecks, Upload, Brain, FileBarChart,
  TrendingUp, Wallet, Target, Settings2, Plus,
  CloudUpload, User as UserIcon, Bell, Search, X
} from "lucide-react";
import { BrandLogo } from "./components/BrandLogo";
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
import {
  calculateMetrics,
  computeCooldown,
  money,
  potentialReturn,
} from "./lib/metrics";
import { createBetId, createBookmakerId, createStrategyId, createTransactionId, isFirstRun, loadState, resetState, saveState } from "./lib/storage";
import { uploadBetSlip } from "./lib/storageRepository";
import type { AppState, Bet, BookmakerAccount, NewBetPrefill, RiskSettings, Strategy, Transaction, TransactionType } from "./lib/types";
import type { OcrSubmissionMetadata } from "./lib/ocr";

type View = "dashboard" | "bets" | "new-bet" | "import" | "intelligence" | "reports" | "clv" | "books" | "strategies" | "settings" | "auth";

type NavItem = { id: View; label: string; badge?: string; Icon: React.ElementType };

const Onboarding = lazy(() => import("./components/Onboarding").then((module) => ({ default: module.Onboarding })));
const Dashboard = lazy(() => import("./components/Dashboard").then((module) => ({ default: module.Dashboard })));
const Bets = lazy(() => import("./components/Bets").then((module) => ({ default: module.Bets })));
const NewBet = lazy(() => import("./components/NewBet").then((module) => ({ default: module.NewBet })));
const Import = lazy(() => import("./components/Import").then((module) => ({ default: module.Import })));
const Intelligence = lazy(() => import("./components/Intelligence").then((module) => ({ default: module.Intelligence })));
const ClvEdge = lazy(() => import("./components/ClvEdge").then((module) => ({ default: module.ClvEdge })));
const Books = lazy(() => import("./components/Books").then((module) => ({ default: module.Books })));
const Strategies = lazy(() => import("./components/Strategies").then((module) => ({ default: module.Strategies })));
const Reports = lazy(() => import("./components/Reports").then((module) => ({ default: module.Reports })));
const Settings = lazy(() => import("./components/Settings").then((module) => ({ default: module.Settings })));
const AuthPage = lazy(() => import("./components/AuthPage").then((module) => ({ default: module.AuthPage })));

function parseOcrMetadata(raw: FormDataEntryValue | null): OcrSubmissionMetadata | undefined {
  if (typeof raw !== "string" || raw.trim().length === 0) return undefined;

  try {
    return JSON.parse(raw) as OcrSubmissionMetadata;
  } catch {
    return undefined;
  }
}

function getOcrConfidenceScore(metadata: OcrSubmissionMetadata | undefined): number | undefined {
  if (!metadata) return undefined;

  const confidentFields = metadata.fields
    .map((field) => field.confidence)
    .filter((value): value is number => typeof value === "number");

  if (confidentFields.length === 0) return undefined;
  return confidentFields.reduce((sum, value) => sum + value, 0) / confidentFields.length;
}

function isSuccessfulOcr(metadata: OcrSubmissionMetadata | undefined) {
  return metadata?.status === "success" || metadata?.status === "needs_review";
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
  const [state, setState] = useState<AppState>(() => loadState());
  const [newBetPrefill, setNewBetPrefill] = useState<NewBetPrefill | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(() => isFirstRun(loadState()));
  const [user, setUser] = useState<User | null>(null);
  const [syncStatus, setSyncStatus] = useState("Modo demo local");
  const [authMessage, setAuthMessage] = useState("Entre para sincronizar seus dados em nuvem.");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const metrics = useMemo(() => calculateMetrics(state), [state]);
  const cooldown = useMemo(() => computeCooldown(state), [state]);
  const [cooldownOverride, setCooldownOverride] = useState(false);

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

  function updateState(next: AppState) {
    setState(next);
    saveState(next);
  }

  function openNewBet(prefill: NewBetPrefill | null = null) {
    if (cooldown.active && !cooldownOverride) {
      toast.error(
        `Nova aposta bloqueada — cooldown ativo até ${cooldown.until?.toLocaleString("pt-BR") ?? "?"}. Revise seus limites de risco.`,
        { duration: 5000 },
      );
      return;
    }
    setNewBetPrefill(prefill);
    setView("new-bet");
  }

  function completeOnboarding(patch: Pick<AppState, "bankrollName" | "startingBalance" | "bookmakers">) {
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

  async function signInWithGoogleAccount() {
    setAuthMessage("Conectando com Google...");
    try {
      const googleUser = await signInWithGoogle();
      const cloudState = await loadCloudState(googleUser.uid);
      if (cloudState) {
        updateState(cloudState);
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
    const bookmakerId = String(data.get("bookmakerId"));
    const stake = Number(data.get("stake"));
    const uploadedSlipImagePath = String(data.get("uploadedSlipImagePath") || "");
    const uploadedSlipImageUrl = String(data.get("uploadedSlipImageUrl") || "");
    const ocrMetadata = parseOcrMetadata(data.get("ocrMetadata"));
    const hasSuccessfulOcr = isSuccessfulOcr(ocrMetadata);
    const suggestionId = String(data.get("suggestionId") || "") || undefined;
    const fixtureId = String(data.get("fixtureId") || "") || undefined;
    const estimatedProbability = Number(data.get("estimatedProbability"));
    const estimatedEdge = Number(data.get("estimatedEdge"));
    const suggestionConfidenceScore = Number(data.get("suggestionConfidenceScore"));
    let slipImagePath: string | undefined;
    let slipImageUrl: string | undefined;

    const selectedBookmaker = state.bookmakers.find((book) => book.id === bookmakerId);
    if (!selectedBookmaker) {
      toast.error("Cadastre uma casa antes de registrar a aposta.");
      setView("books");
      return;
    }

    if (!Number.isFinite(stake) || stake <= 0) {
      toast.error("Informe uma stake valida.");
      return;
    }

    const odds = Number(data.get("odds"));
    if (!Number.isFinite(odds) || odds < 1.01) {
      toast.error("Odd invalida. O valor minimo e 1.01.");
      return;
    }

    if (stake > selectedBookmaker.balance) {
      toast.error(`Saldo insuficiente na ${selectedBookmaker.name}.`);
      return;
    }

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

    const bet: Bet = {
      id: createBetId(),
      placedAt: new Date().toISOString(),
      eventAt: String(data.get("eventAt")),
      sport: String(data.get("sport")),
      league: String(data.get("league")),
      eventName: String(data.get("eventName")),
      market: String(data.get("market")),
      selection: String(data.get("selection")),
      bookmakerId,
      source: suggestionId ? "ai_suggestion" : hasSuccessfulOcr ? "ocr" : "manual",
      suggestionId,
      fixtureId,
      strategyId: String(data.get("strategyId")) || undefined,
      tags: String(data.get("tags"))
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      stake,
      odds,
      status: "pending",
      closingOdds: Number(data.get("closingOdds")) || undefined,
      estimatedProbability: Number.isFinite(estimatedProbability) ? estimatedProbability : undefined,
      estimatedEdge: Number.isFinite(estimatedEdge) ? estimatedEdge : undefined,
      confidenceScore: suggestionId
        ? (Number.isFinite(suggestionConfidenceScore) ? suggestionConfidenceScore : undefined)
        : hasSuccessfulOcr
          ? getOcrConfidenceScore(ocrMetadata)
          : undefined,
      mode: String(data.get("mode")) as Bet["mode"],
      slipImagePath,
      slipImageUrl,
      ocrMetadata,
    };

    const transaction: Transaction = {
      id: createTransactionId(),
      date: bet.placedAt,
      type: "bet_stake",
      bookmakerId,
      description: `Stake - ${bet.eventName}`,
      amount: -stake,
      referenceType: "bet",
      referenceId: bet.id,
    };
    const bookmakers = state.bookmakers.map((book) => (
      book.id === bookmakerId ? { ...book, balance: book.balance - stake } : book
    ));

    updateState({ ...state, bookmakers, bets: [bet, ...state.bets], transactions: [transaction, ...state.transactions] });
    setNewBetPrefill(null);
    form.reset();
    setView("bets");
    toast.success("Aposta registrada com sucesso!");
  }

  function settleBet(id: string, status: Bet["status"]) {
    const currentBet = state.bets.find((bet) => bet.id === id);
    if (!currentBet || currentBet.status !== "pending") return;

    const payout = (status === "won" || status === "cashout") ? potentialReturn(currentBet) : status === "void" ? currentBet.stake : 0;
    const transaction = payout > 0 ? [{
      id: createTransactionId(),
      date: new Date().toISOString(),
      type: (status === "won" || status === "cashout" ? "bet_payout" : "bet_refund") as TransactionType,
      bookmakerId: currentBet.bookmakerId,
      description: status === "won"
        ? `Retorno - ${currentBet.eventName}`
        : status === "cashout"
          ? `Cashout - ${currentBet.eventName}`
          : `Void - ${currentBet.eventName}`,
      amount: payout,
      referenceType: "bet" as const,
      referenceId: currentBet.id,
    }] : [];
    const bookmakers = state.bookmakers.map((book) => (
      book.id === currentBet.bookmakerId ? { ...book, balance: book.balance + payout } : book
    ));

    updateState({
      ...state,
      bookmakers,
      transactions: [...transaction, ...state.transactions],
      bets: state.bets.map((bet) => (
        bet.id === id ? { ...bet, status, payout, settlementSource: "manual" } : bet
      )),
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
    const bookmakers = state.bookmakers.map((book) => {
      const balanceDelta = importTransactions.reduce((sum, transaction) => (
        transaction.bookmakerId === book.id ? sum + transaction.amount : sum
      ), 0);
      return balanceDelta !== 0 ? { ...book, balance: book.balance + balanceDelta } : book;
    });

    updateState({
      ...state,
      bookmakers,
      bets: [...uniqueBets, ...state.bets],
      transactions: [...importTransactions.reverse(), ...state.transactions],
    });
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

    updateState({
      ...state,
      bookmakers: [...state.bookmakers, bookmaker],
      transactions: [...transaction, ...state.transactions],
    });
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

    if ((type === "withdrawal" || type === "transfer") && rawAmount > sourceBookmaker.balance) {
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

    const bookmakers = state.bookmakers.map((book) => {
      if (book.id === bookmakerId) {
        return { ...book, balance: book.balance + signedAmount };
      }

      if (type === "transfer" && book.id === targetBookmakerId) {
        return { ...book, balance: book.balance + rawAmount };
      }

      return book;
    });

    updateState({ ...state, bookmakers, transactions: [...transactions.reverse(), ...state.transactions] });
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
    const updatedBookmakers = state.bookmakers.map((book) =>
      book.id === bookmakerId
        ? { ...book, balance: Number((book.balance - original.amount).toFixed(2)) }
        : book,
    );
    const updatedTransactions = state.transactions.map((t) =>
      t.id === transactionId ? patchedOriginal : t,
    );
    updateState({ ...state, bookmakers: updatedBookmakers, transactions: [voidEntry, ...updatedTransactions] });
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

  if (showOnboarding) {
    return (
      <Suspense fallback={<ViewFallback title="Carregando onboarding..." />}>
        <Onboarding onComplete={completeOnboarding} />
      </Suspense>
    );
  }

  const currentView = renderCurrentView();
  const newBetModal = view === "new-bet" ? (
    <Suspense fallback={<ModalFallback />}>
      <NewBet
        state={state}
        addBet={addBet}
        onClose={() => {
          setNewBetPrefill(null);
          setView("bets");
        }}
        prefill={newBetPrefill}
        cooldown={cooldown}
        cooldownOverride={cooldownOverride}
        onCooldownOverride={() => setCooldownOverride(true)}
      />
    </Suspense>
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
            <span>{user ? accountLabel(user) : `Operação local · ${state.bookmakers.length} ${state.bookmakers.length === 1 ? "casa" : "casas"}`}</span>
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
            <button className="primary btn-nova-aposta" onClick={() => openNewBet()}>
              <Plus size={16} />
              Nova aposta
            </button>
          </div>
        </header>

        {cooldown.active && (
          <div className={`cooldown-banner${cooldownOverride ? " cooldown-banner-overridden" : ""}`}>
            <div className="cooldown-banner-body">
              <strong>Cooldown de risco ativo</strong>
              <span>{cooldown.reason}</span>
              <span className="cooldown-banner-until">
                Bloqueio até {cooldown.until?.toLocaleString("pt-BR") ?? "—"}
              </span>
            </div>
            {!cooldownOverride ? (
              <button
                className="cooldown-override-btn"
                type="button"
                onClick={() => setCooldownOverride(true)}
              >
                Entendo o risco — desbloquear sessão
              </button>
            ) : (
              <button
                className="cooldown-relock-btn"
                type="button"
                onClick={() => setCooldownOverride(false)}
              >
                Rebloquear
              </button>
            )}
          </div>
        )}

        <Suspense fallback={<ViewFallback title={`Carregando ${viewTitle(view).toLowerCase()}...`} />}>
          {currentView}
        </Suspense>

        {/* Modal — renderizado sobre qualquer view */}
        {newBetModal}
        <button className="fab" onClick={() => openNewBet()} title="Nova aposta">+</button>

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
        return <Bets state={state} settleBet={settleBet} />;
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
            onGoToAuth={() => setView("auth")}
            updateRiskSettings={updateRiskSettings}
          />
        );
      case "auth":
        return (
          <AuthPage
            onSignIn={signInAccount}
            onSignUp={createAccount}
            onReset={sendReset}
            onDemoMode={async () => { await connectCloud(); setView("dashboard"); }}
            onGoogleSignIn={signInWithGoogleAccount}
            message={authMessage}
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
