# Banca+ — Relatório Técnico Completo

**Versão do relatório:** 2026-05-10
**Fonte:** leitura direta do código-fonte em `c:\Users\João Damas\Documents\bancamais\src\`

---

## 1. Visão Geral do Produto

### O que é e para quem é

Banca+ é um terminal analítico de gestão de apostas esportivas voltado para apostadores profissionais. O produto não é um cassino nem uma plataforma de apostas — é uma ferramenta de controle financeiro, de desempenho e de disciplina operacional. O usuário registra suas próprias apostas e movimentações, e o sistema calcula métricas, gera alertas de risco, rastreia o CLV (Closing Line Value) e mantém um ledger auditável por casa de apostas.

O produto é adequado para apostadores que querem:

- Controle rigoroso de bankroll distribuído em múltiplas casas
- Métricas de performance reais (ROI, Yield, Hit Rate, CLV)
- Gestão de risco com alertas automáticos
- Histórico auditável e imutável de todas as transações financeiras
- Análise automática do portfólio por IA local ou endpoint externo

### Stack Tecnológica Completa

| Camada | Tecnologia | Versão indicada |
|---|---|---|
| Framework UI | React | 19 |
| Linguagem | TypeScript | 5 (strict mode) |
| Build | Vite | 7 |
| Estilo | CSS puro, arquivo único | `src/styles.css` |
| Ícones | lucide-react | via npm |
| Gráficos | recharts | via npm |
| Notificações | react-hot-toast | via npm |
| Auth | Firebase Authentication | Email/senha, Google, anônimo |
| Banco de dados | Firebase Firestore | Coleção `users/{uid}/appStates/default` |
| Storage | Firebase Storage | `users/{uid}/bet-slips/*` |
| Deploy | Firebase Hosting | SPA com rewrite para `/index.html` |

### Estrutura de Arquivos

```
src/
├── App.tsx                    # Orquestrador: estado global, handlers, roteamento por view
├── styles.css                 # Todo o CSS em arquivo único (~3500+ linhas)
├── main.tsx                   # Entry point React
├── components/
│   ├── AuthPage.tsx           # Tela de autenticação dedicada (portal de entrada)
│   ├── Onboarding.tsx         # Fluxo de 3 passos na primeira sessão
│   ├── Dashboard.tsx          # Dashboard com gráficos Recharts
│   ├── Bets.tsx               # Lista de apostas com busca, filtros e liquidação
│   ├── NewBet.tsx             # Modal de nova aposta com OCR e fixture search
│   ├── Import.tsx             # Importação CSV
│   ├── Intelligence.tsx       # IA: análise de portfólio, heatmap, sugestões
│   ├── ClvEdge.tsx            # CLV & Edge com gráficos de série temporal
│   ├── Books.tsx              # Casas de apostas, ledger por casa, transações
│   ├── Strategies.tsx         # Estratégias e performance comparativa
│   ├── Reports.tsx            # Relatórios e exportação
│   ├── Settings.tsx           # Configurações, sync e gestão de risco
│   ├── BrandLogo.tsx          # Logo SVG da marca
│   ├── EmptyState.tsx         # Componente de estado vazio reutilizável
│   ├── Metric.tsx             # Card de métrica simples
│   ├── LoadingSkeleton.tsx    # Skeleton animado para loading states
│   ├── LoadingScreen.tsx      # Tela de carregamento inicial
│   ├── Suggestions.tsx        # Sugestões de apostas da IA
│   └── TeamNewsWidget.tsx     # Widget de notícias por time
└── lib/
    ├── types.ts               # Todos os tipos TypeScript
    ├── firebase.ts            # Inicialização do Firebase SDK
    ├── cloudRepository.ts     # Operações Firebase (Auth + Firestore)
    ├── storage.ts             # localStorage + normalização de estado
    ├── storageRepository.ts   # Upload de imagens no Storage
    ├── metrics.ts             # Cálculos: ROI, CLV, yield, hit rate, alertas
    ├── csv.ts                 # Exportação e importação CSV
    ├── chartData.ts           # Transformação de dados para Recharts
    ├── ledger.ts              # Ledger financeiro por bookmaker
    ├── aiService.ts           # Análise de portfólio por IA (local + API)
    ├── useAIAnalysis.ts       # Hook React para aiService
    ├── useFirestoreSync.ts    # Hook de sync em tempo real com Firestore
    ├── ocr.ts                 # Upload e parse de bilhetes por OCR
    ├── sportsApi.ts           # Busca de fixtures (API externa)
    └── newsApi.ts             # Busca de notícias por time
```

---

## 2. Design System

### 2.1 Paleta de Cores (tokens CSS em `:root`)

Filosofia: **Notion/Linear-inspired dark tool — warm neutral backgrounds**, confortável para longas sessões. Versão 4.0 do design system.

#### Backgrounds

| Token | Hex | Uso |
|---|---|---|
| `--bg` | `#0E0E0E` | Fundo do body / inputs |
| `--panel` | `#161512` | Cards, sidebar, painéis principais |
| `--panel-2` | `#1E1C18` | Modal, toasts, panel secundário |
| `--panel-3` | `#252219` | Hover states, badges de nav |

#### Bordas

| Token | Valor | Uso |
|---|---|---|
| `--line` | `rgba(255, 250, 240, 0.07)` | Bordas sutis, separadores |
| `--line-strong` | `rgba(255, 250, 240, 0.13)` | Bordas em foco, inputs ativos |

#### Texto

| Token | Hex | Uso |
|---|---|---|
| `--text` | `#F0EDE8` | Texto principal (quente, não branco puro) |
| `--muted` | `#9E9A93` | Labels, descrições secundárias |
| `--soft` | `#5A574F` | Texto mínimo, placeholders |

#### Accent (violeta morno)

| Token | Valor | Uso |
|---|---|---|
| `--accent` | `#8B7CF6` | Primário: botões, ativo, bordas de foco |
| `--accent-dim` | `rgba(139, 124, 246, 0.12)` | Background de elementos ativos |
| `--accent-bright` | `#A899F8` | Hover do accent |

#### Status

| Token | Hex | Alias | Uso |
|---|---|---|---|
| `--positive` | `#4ADE80` | `--green` | Ganho, ok, positivo |
| `--negative` | `#F87171` | `--red` | Perda, erro, alerta crítico |
| `--warning` | `#FBBF24` | `--amber` | Aviso, pendente |
| `--info` | `#60A5FA` | — | Informação, link |
| `--cyan` | `#67E8F9` | — | Cashout, info especial |

#### Cores hardcoded para Recharts (não leem CSS vars)

```
accent:  #6366F1   (Dashboard)   /   #7cffb2  (ClvEdge)
cyan:    #818CF8   (Dashboard)   /   #5ee0ff  (ClvEdge)
green:   #10B981   (Dashboard)
red:     #BE123C   (Dashboard)   /   #ff6b81  (ClvEdge)
amber:   #FBBF24   (Dashboard)
panel:   #18181B   (Dashboard)   /   #10172a  (ClvEdge)
muted:   #94A3B8   (Dashboard)   /   #8a95ad  (ClvEdge)
```

### 2.2 Tipografia

| Token | Família | Uso |
|---|---|---|
| `--font-ui` | `'Inter', system-ui, -apple-system, sans-serif` | Corpo, botões, labels, headings |
| `--font-mono` | `'JetBrains Mono', 'SF Mono', 'Fira Code', monospace` | Valores numéricos, códigos, tabelas |
| `--font-display` | `'Inter', system-ui, sans-serif` | Display (mesmo que UI) |
| `--font-brand` | `'Syne', sans-serif` | Logo, nome da marca |

Fontes carregadas via Google Fonts: `Inter` (weights 400, 500, 600, 700, 800) e `Outfit` (weights 500, 600, 700, 800).

Tamanhos utilizados no sistema:

| Classe utilitária | Tamanho |
|---|---|
| `.text-xs` | 11px |
| `.text-sm` | 13px |
| `.text-base` | 14px |
| `.text-lg` | 16px |
| Body base | 14px |
| Labels mono uppercase | 10–11px |
| Balance card | 36px |
| CLV Hero | 48px (desktop), 32px (mobile) |
| Metric card | 22px |
| H1 de seção | 20px |
| H2 de painel | 15px |

### 2.3 Espaçamentos e Border-radius

#### Sistema de Espaçamento (base 4px)

| Token | Valor |
|---|---|
| `--space-1` | 4px |
| `--space-2` | 8px |
| `--space-3` | 12px |
| `--space-4` | 16px |
| `--space-5` | 20px |
| `--space-6` | 24px |
| `--space-8` | 32px |
| `--space-10` | 40px |

#### Border-radius

| Token | Valor | Uso |
|---|---|---|
| `--radius-sm` | 4px | Pills de status, badges, inputs, botões |
| `--radius` | 6px | Cards, painéis, modais pequenos |
| `--radius-lg` | 8px | Modais maiores, cards premium |
| `--radius-pill` | 999px | Disponível, não usado por padrão |

#### Transições

| Token | Valor |
|---|---|
| `--transition-fast` | 100ms ease-out |
| `--transition` | 150ms ease-out |
| `--transition-slow` | 250ms ease-out |

#### Z-index Scale

| Token | Valor |
|---|---|
| `--z-base` | 0 |
| `--z-raised` | 10 |
| `--z-dropdown` | 20 |
| `--z-sticky` | 30 |
| `--z-modal` | 50 |
| `--z-toast` | 100 |

### 2.4 Componentes Base

#### Botão Primário (`.primary`)

- Background: `var(--accent)` (#8B7CF6)
- Texto: `#0a0614` (quase preto)
- Borda: `rgba(139, 124, 246, 0.30)`
- Border-radius: `--radius-sm` (4px)
- Padding: `6px 12px`
- Hover: `var(--accent-bright)` + `box-shadow: 0 0 0 2px var(--accent-dim)`
- Font-weight: 600

#### Botão Padrão (`.actions button`, `.panel button`)

- Background: `transparent`
- Borda: `var(--line-strong)`
- Cor: `var(--muted)`
- Hover: borda `var(--accent)`, fundo `rgba(139, 124, 246, 0.05)`

#### Botão de Perigo (`.btn-danger`)

- Background: `transparent`
- Borda: `rgba(248, 81, 73, 0.35)`
- Cor: `var(--negative)`
- Hover: fundo `rgba(248, 81, 73, 0.08)`

#### Inputs, Selects, Textareas

- Background: `var(--bg)` (#0E0E0E)
- Borda: `var(--line-strong)`
- Border-radius: `--radius-sm`
- Padding: `7px 10px`
- Font-size: 13px
- Foco: borda `var(--accent)`, outline `rgba(139, 124, 246, 0.5)`
- Textarea min-height: 200px

#### Pills de Status (`.pill`)

| Classe | Background | Cor | Borda |
|---|---|---|---|
| `.pill.won` | `rgba(74, 222, 128, 0.12)` | `--positive` (#4ADE80) | `rgba(74, 222, 128, 0.30)` |
| `.pill.lost` | `rgba(248, 113, 113, 0.12)` | `--negative` (#F87171) | `rgba(248, 113, 113, 0.30)` |
| `.pill.pending` | `rgba(251, 191, 36, 0.12)` | `--warning` (#FBBF24) | `rgba(251, 191, 36, 0.30)` |
| `.pill.cashout` | `rgba(103, 232, 249, 0.10)` | `--cyan` (#67E8F9) | `rgba(103, 232, 249, 0.28)` |
| `.pill.void` | `rgba(90, 87, 79, 0.20)` | `--soft` (#5A574F) | `rgba(90, 87, 79, 0.35)` |

Border-radius das pills: `--radius-sm` (4px) — não é círculo.

#### Cards / Panels (`.panel`, `.table-card`, `.metric`, `.balance-card`)

- Background: `var(--panel)` (#161512)
- Borda: `var(--line)`
- Border-radius: `--radius` (6px)
- Box-shadow: `0 1px 3px rgba(0,0,0,0.4), 0 0 0 1px var(--line)`
- Padding: 16px

### 2.5 Breakpoints de Responsividade

| Breakpoint | Largura máxima | Mudanças principais |
|---|---|---|
| Tablet/médio | 980px | Sidebar vira barra horizontal wrap no topo. `.app-shell` passa de `grid 200px 1fr` para `grid 1fr`. `.hero`, `.grid.two`, `.report-grid`, `.insight-grid` viram coluna única. `.ops-summary-grid` vira coluna única. Topbar vira coluna. FAB reduzido para `bottom: 14px`. Modal ocupa 100% da largura. |
| Mobile | 520px | `.hero` vira coluna única (já era 2 colunas no breakpoint anterior). `.page` reduz padding para 14px. `.risk-settings-form` vira coluna única. `.report-grid` vira coluna única. CLV Hero reduz de 48px para 32px. Balance card reduz de 36px para 26px. Onboarding reduz padding. |
| Auth page | 768px | `.auth-page` vira coluna única. Painel de features some (`display: none`). |

---

## 3. Autenticação e Sessão

### 3.1 Fluxos de Login

O app é protegido por um auth gate: se não houver usuário autenticado, o `App.tsx` renderiza exclusivamente o `AuthPage`. A autenticação é gerenciada pelo Firebase Auth via `cloudRepository.ts`.

#### Modos disponíveis

| Modo | Função chamada | Comportamento |
|---|---|---|
| Email/senha — login | `signInEmailUser(email, password)` | `signInWithEmailAndPassword`; carrega estado da nuvem se existir |
| Email/senha — cadastro | `createEmailUser(email, password, displayName)` | `createUserWithEmailAndPassword` + `updateProfile`; salva estado local na nuvem |
| Google | `signInWithGoogle()` | `signInWithPopup` com `GoogleAuthProvider`; carrega estado da nuvem |
| Sessão temporária (demo) | `signInDemoUser()` | `signInAnonymously`; sem sincronização automática de escrita |
| Recuperação de senha | `resetEmailPassword(email)` | `sendPasswordResetEmail`; email enviado pelo Firebase |

#### Comportamento pós-login

Ao detectar login via `onAuthStateChanged`:

1. Carrega o estado local do `localStorage` (`bancamais.state.{uid}`)
2. Carrega o estado da nuvem via `loadCloudState(uid)`
3. Compara os timestamps (`lastModifiedAt`) dos dois estados
4. Aplica o mais recente e reconcilia os saldos pelo ledger
5. Se o estado local for mais novo, faz upload para a nuvem
6. Verifica se é primeira execução (`isFirstRun`) para exibir o Onboarding

### 3.2 Tela de Autenticação (AuthPage)

**Layout:** Split de duas colunas — `460px` (formulário) + `1fr` (feature list). Em mobile (<768px): coluna única, feature list oculta.

**Componentes do painel esquerdo:**

- BrandLogo (SVG)
- Subtítulo: "Gestão profissional de apostas esportivas"
- Tab switcher: "Entrar" / "Criar conta"
- Mensagem de feedback (`authMessage`) com estilo `auth-page-message`
- Botão Google (SVG inline com as 4 cores oficiais)
- Divisor "ou entre com email"
- Formulário dinâmico conforme o modo (`signin`, `signup`, `reset`)
- Divisor "ou"
- Botão de sessão temporária com sublabel explicativo

**Formulários:**

| Modo | Campos | Botão |
|---|---|---|
| `signin` | email (required), password (required) | "Entrar" + link "Esqueci minha senha" |
| `signup` | displayName, email (required), password (required, minLength=6) | "Criar conta" |
| `reset` | email (required) | "Enviar link" + link "Voltar ao login" |

### 3.3 Persistência de Sessão

- Firebase Auth mantém a sessão automaticamente entre recargas (IndexedDB interno)
- O estado da aplicação é salvo em `localStorage` com chave `bancamais.state.{uid}`
- Usuários anônimos têm chave própria mas não têm sync automático de escrita para nuvem
- `onAuthStateChanged` é o listener central que hidrata o estado ao iniciar

---

## 4. Onboarding

### 4.1 Fluxo Passo a Passo

O onboarding é exibido quando `isFirstRun(state)` retorna `true`, ou seja, quando `bookmakers.length === 0 && bets.length === 0 && startingBalance === 0`.

O componente `Onboarding` usa 3 steps representados por dots animados no topo.

**Passo 1 — Configurar a Banca:**

- Campo: Nome da banca (texto, required, placeholder "Ex: Banca Principal, Banca Futebol...")
- Campo: Saldo inicial em BRL (number, min=0, step=0.01, required)
- Botão "Continuar" desabilitado enquanto campos incompletos
- Avança para o Passo 2

**Passo 2 — Adicionar Casas de Apostas:**

- Chips de sugestão pré-definidos: `Bet365, Betano, Sportingbet, KTO, Superbet, Pixbet, EstrelaBet, BetNacional, Novibet, Betfair`
- Clicar em um chip preenche o campo de nome automaticamente
- Formulário inline: `[Nome da casa] [Saldo (R$)] [Adicionar]`
- Lista das casas adicionadas com saldo e botão de remover (×)
- Rodapé da lista: total somado das casas
- Botão "Pular — adicionar depois" (salta para Passo 3)
- Botão "Continuar" habilitado somente com ao menos 1 casa

**Passo 3 — Confirmação:**

- Resumo: Nome da banca, saldo inicial, número de casas
- Lista de próximos passos (UI)
- Botão "Entrar no Banca+"

### 4.2 O que é criado ao completar

Ao chamar `completeOnboarding()` em App.tsx:

- O `bankrollName` e `startingBalance` são gravados no estado
- Para cada bookmaker com `balance > 0`, é criada uma transação do tipo `deposit` com description `"Saldo inicial - {nome}"` e amount positivo igual ao saldo
- O estado é salvo no localStorage e na nuvem

---

## 5. Telas Principais

### 5.1 Dashboard

**Propósito:** Centro de controle operacional. Visão consolidada da banca, performance e risco.

**Layout:**

1. Banner de comando com título, CTA "Nova entrada" e "Gerir casas"
2. Hero grid — `1.7fr` (balance card) + 3 × `1fr` (metrics)
3. Mini-grid de 4 cards secundários
4. Chart panel — Evolução da banca (AreaChart, height 220px)
5. Grid 2 colunas — ROI Mensal (BarChart, 180px) | Lucro por esporte (BarChart horizontal, 180px)
6. Risk grid — cards de alerta

**Métricas exibidas:**

| Card | Dado |
|---|---|
| Balance card | `totalBalance` com breakdown: disponível para apostar, disponível para saque, apostas abertas (`openExposure`) |
| ROI | `metrics.roi` formatado como percent + count de apostas liquidadas |
| Taxa de acerto | `metrics.hitRate` |
| CLV médio | `metrics.clvAverage` vs linha de fechamento |
| Capital monitorado | `totalBalance + openExposure` |
| Resultado liquidado | `metrics.profit` (colorido positivo/negativo) |
| Apostas abertas | `metrics.openExposure` + `pendingCount` |
| Liquidadas | `metrics.settledCount` |

**Estado vazio:** Quando `state.bets.length === 0`, exibe `EmptyState` com CTAs para registrar aposta ou configurar casas.

**Gráficos:**

- *Evolução da banca:* `AreaChart` com `buildBankrollTimeSeries()`. Modo intraday (HH:MM) quando todos os eventos são do mesmo dia; modo multi-dia (DD MMM) caso contrário. Gradiente roxo. Tooltips customizados.
- *ROI mensal:* `BarChart` com dados de `buildMonthlyData()`. Barras verdes para ROI positivo, vermelhas para negativo. `ReferenceLine y={0}`.
- *Lucro por esporte:* `BarChart` horizontal, top 6 esportes por volume, barras verdes/vermelhas.

**Alertas de risco:** Seção `.risk-grid` com cards coloridos — `warning` (borda amber) ou `danger` (borda vermelha).

### 5.2 Apostas (Bets)

**Propósito:** Fila operacional de apostas. Liquidação de resultados, busca e exportação.

**Layout:**

1. Page actions — contagem, busca inline, botão exportar CSV
2. Bets toolbar — contadores de pendente/liquidadas/cashout
3. Summary grid — 3 cards: fila ativa, liquidadas, resultado liquidado
4. Filter tabs — Todas, Pendente, Ganha, Perdida, Cashout, Cancelada (com contagem)
5. Tabela expandida de apostas

**Colunas da tabela:**

| Coluna | Conteúdo |
|---|---|
| Evento | Nome + esporte · liga · data/hora + chips (modo, source, tags, link print) |
| Mercado | Tipo de mercado + seleção |
| Execução | Casa + estratégia + status inline |
| Valor apostado | Stake formatado |
| Preço | Odd + odd de fechamento |
| Performance | Retorno (potencial ou efetivo) + ganho (positivo/negativo) + CLV inline |
| Status | Pill colorido + resultado pós-liquidação |
| Ações | Menu dropdown contextual |

**Ações disponíveis por status:**

- *Pendente:* dropdown com "Ganha", "Perdida", "Cashout" (abre input inline para valor), "Void", "Excluir"
- *Liquidada:* dropdown com "Excluir" (confirma em 2 cliques)
- Cashout: campo inline com input de valor, Enter confirma, Escape cancela

**Busca local:** Filtra por eventName, sport, league, market, selection, mode, bookmakerName, tags.

### 5.3 Inteligência (Intelligence / IA)

**Propósito:** Análise automática do portfólio, heatmap de atividade, performance por estratégia, alertas de risco da IA, widget de notícias e sugestões de apostas.

**Layout:**

1. Cabeçalho com botão "Atualizar análise"
2. Grid 2 colunas — Painel de análise IA | Heatmap 21 dias
3. Risk warnings da IA (se existirem)
4. Insight grid 3 colunas — Performance por estratégia | Apostas em aberto | Estatísticas
5. Widget de notícias (se `isNewsApiConfigured()` e há apostas pendentes)
6. Componente `Suggestions` (sugestões de apostas da IA)

**Painel de Análise IA:**

- Metadados: Fonte (Regras internas / Modelo externo) + timestamp
- Texto de summary (~2 frases)
- Insight principal destacado
- Nota de disclaimer
- Summary list compacta: melhor estratégia, estratégia a revisar, exposição aberta
- Até 3 sugestões com prioridade (high=amber, medium=cyan, low=soft)

**Heatmap:**

- Grid 7 colunas (dias da semana: Dom–Sáb)
- 21 dias retroativos
- Células verdes (`hm-pos`) para lucro positivo, vermelhas (`hm-neg`) para negativo
- Tooltip com data, número de apostas e resultado

### 5.4 CLV & Edge

**Propósito:** Medir se o usuário está batendo a linha de fechamento — principal indicador de edge de longo prazo.

**Layout:**

1. CLV Hero card — CLV médio geral em fonte 48px + interpretação textual
2. AreaChart — CLV por aposta em ordem cronológica (apenas apostas com `closingOdds` registrada)
3. BarChart horizontal — CLV médio por casa de apostas

**Dados exibidos:**

- CLV médio geral (colorido verde/vermelho)
- Quantidade de apostas com closingOdds registrada
- Interpretação: CLV positivo = edge real de longo prazo; CLV negativo = revisar timing

**Gráficos:**

- *CLV por aposta:* `AreaChart` com gradiente verde (`#7cffb2`), `ReferenceLine y={0}`, eixo Y em porcentagem
- *CLV por casa:* `BarChart` horizontal, barras verdes/vermelhas, baseado em `groupProfitByBookmaker()` cruzado com CLV por apostas da casa

### 5.5 Bancas & Casas (Books)

**Propósito:** Console financeiro. Cadastro de casas, visualização de saldos reconciliados pelo ledger, registro de movimentações e auditoria por transação.

**Layout:**

1. Dashboard command (título)
2. Page actions (contagem de casas)
3. Summary grid — Saldo consolidado, casas com histórico, total de movimentações
4. Command grid — 2 cards contextuais
5. Grid de cards de bookmakers (auto-fit minmax 190px)
6. Painel do ledger (expande ao clicar "Ver ledger" em um card)
7. Grid 2 colunas — Formulário "Adicionar casa" | Formulário "Registrar movimentação"

**Card de Bookmaker:**

- Status (Sincronizada / Manual / Reconectar)
- Badge "Ledger"
- Nome da casa
- Saldo derivado do ledger (fonte mono 22px)
- Data da última atualização
- Aviso de divergência legada (se houver)
- Contagem de apostas e lançamentos vinculados
- Botões: Ver ledger, Editar, Remover (desabilitado se tiver histórico)

**Painel do Ledger (por casa):**

- Tabela com colunas: Data, Tipo, Descrição, Valor, Saldo Acumulado, Ação
- Tipos de lançamento com badges coloridos
- Lançamentos anulados: row com classe `ledger-row-voided`, saldo tachado
- Lançamentos de anulação: row com classe `ledger-row-void-entry`
- Botão "Anular" aparece apenas em lançamentos manuais não anulados e não de aposta
- Formulário inline de anulação: input de razão (obrigatório) + confirmar/cancelar

**Formulário de transação manual:**

- Tipo: Depósito, Saque, Transferência, Ajuste
- Casa origem (select)
- Casa destino (select, relevante para Transferência)
- Valor (number, min=0.01)
- Descrição (texto)

### 5.6 Estratégias (Strategies)

**Propósito:** Criar estratégias de aposta, associá-las a apostas e comparar performance entre elas.

**Layout:**

1. Formulário inline de nova estratégia (Nome + Descrição + Criar)
2. Tabela comparativa de estratégias

**Colunas da tabela:**

| Coluna | Conteúdo |
|---|---|
| Estratégia | Nome em negrito + descrição |
| Apostas | Contagem total |
| ROI | Formatado como percent (verde/vermelho) |
| Acerto | Hit rate como percent |
| CLV | CLV médio (verde/vermelho) |
| Lucro | Valor monetário (verde/vermelho) |
| Status | Pill "Ativa" (verde) ou "Pausada" (amarelo) |
| Ação | Botão "Pausar" / "Reativar" |

### 5.7 Relatórios (Reports)

**Propósito:** Consolidação de resultados para tomada de decisão, base fiscal e exportação.

**Layout:**

1. Dashboard command com botões "Exportar base" e "Base fiscal"
2. Mini-grid — Lucro liquidado, Yield, Fluxo lançado
3. Report grid 3 colunas — Relatório mensal | Resumo fiscal | Página tipster (placeholder)
4. Grid 2 colunas — Resumo operacional (lista key-value) | Últimas 6 transações

**Métricas no resumo operacional:**

- Apostas totais, Liquidadas, Ganhas/cashout, Perdidas
- Valor apostado (total staked)
- Yield, Taxa de liquidação, Hit rate

**Exportação:** Gera CSV via `betsToCsv(state)` e dispara download com `downloadTextFile`.

### 5.8 Configurações (Settings)

**Propósito:** Gerenciar conta, sincronização com nuvem e limites de risco operacional.

**Layout:**

1. Dashboard command
2. Summary grid — Status da conta, Unidade da banca, Exposição máxima
3. Settings layout — 4 painéis empilhados

**Painel Sincronização:**

- Exibe `SyncDot` colorido (online=verde, temp=amarelo, offline=cinza)
- Modo autenticado: "Salvar automático ativo", botões Forçar sincronização / Restaurar da nuvem / Sair
- Modo anônimo: "Conta temporária", botões Criar conta permanente / Salvar snapshot
- Sem sessão: "Sem sessão autenticada", botão Criar conta ou entrar

**Painel Banca Base:**

- Campo: Nome da banca (text, maxLength=60, required)
- Campo: Saldo inicial de referência (number, min=0, step=0.01)

**Painel Limites de Risco:**

Grid 2×2 com os 4 campos de `RiskSettings`:

| Campo | Nome | Min | Step |
|---|---|---|---|
| Unidade da banca | `unitPercent` | 0.1 | 0.1 |
| Stake máxima (unidades) | `maxStakeUnits` | 0.5 | 0.5 |
| Exposição aberta máxima (%) | `maxOpenExposurePercent` | 1 | 1 |
| Alerta após perdas seguidas | `lossStreakLimit` | 1 | 1 |

**Zona de Perigo:**

- Botão "Restaurar dados demo" — requer confirmação via `window.confirm`
- Chama `resetState()` que sobrescreve com `initialState`

### 5.9 Importar CSV (Import)

**Propósito:** Importar apostas em lote a partir de um arquivo CSV no formato do Banca+ ou planilha equivalente.

**Layout:**

1. Painel com título e instrução
2. Contexto da base atual (se houver apostas)
3. File drop (label estilizada para upload)
4. Textarea para colar CSV manualmente
5. Form actions — status message + botões Validar / Importar

**Fluxo:**

1. Usuário seleciona arquivo CSV ou cola conteúdo no textarea
2. Clica "Validar" — chama `parseBetsCsv()`, exibe contagem de apostas válidas e erros
3. Clica "Importar" — chama `importBets()` no App.tsx, que filtra duplicatas por ID e redireciona para Bets

---

## 6. Modais e Formulários

### 6.1 Modal Nova Aposta (NewBet)

**Dimensões:**

- Overlay: `position: fixed; inset: 0; background: rgba(14,14,14,0.85); backdrop-filter: blur(8px); padding: 24px 16px; overflow-y: auto`
- Painel: `max-width: 1040px; width: 100%; background: var(--panel-2); border-radius: --radius-lg (8px); padding: 20px`
- Mobile: `max-width: 100%; margin: 0; padding: 12px 8px`

**Fechamento:** Botão × no canto superior direito (26×26px). Se houver progresso não salvo (`hasUnsavedProgress`), exibe `window.confirm` antes de fechar. O progresso inclui: campos preenchidos diferente do baseline, slip uploadado, resultado de OCR, ou status de OCR diferente de idle.

**Estrutura do formulário em seções:**

**Seção 1 — Bilhete (OCR):**

- Dropzone para upload da imagem do bilhete (`accept="image/*"`)
- Feedback visual do OCR com estados: idle, loading (skeleton animado), done (bordas verdes), error (bordas vermelhas)
- Resumo: campos sinalizados, pendentes de revisão, revisados manualmente

**Seção 2 — Evento:**

- Campo "Evento" (input com autocomplete de fixture via Sports API)
  - Debounce de 400ms após 3 caracteres
  - Dropdown de sugestões: logo do time home, nome home x away, logo away, liga, data formatada
- Grid 3 colunas: Data do evento (datetime-local), Esporte (text), Liga (text)

**Seção 3 — Mercado:**

- Grid 2 colunas: Mercado (text), Seleção (text)

**Seção 4 — Execução:**

- Grid 2 colunas: Casa (select), Estratégia (select)
- Grid 3 colunas: Stake (number, min=1, step=0.01), Odd (number, min=1.01, step=0.01), Odd fechamento (number, min=1.01, step=0.01, opcional)

**Seção 5 — Contexto:**

- Grid 2 colunas: Modo (select: Pre-live / Live), Tags (text, separadas por vírgula)

**Campos hidden:**

- `uploadedSlipImagePath`, `uploadedSlipImageUrl` (após upload bem-sucedido)
- `ocrRequestId`, `ocrStatus`, `ocrProvider`, `ocrMetadata` (JSON serializado)
- `suggestionId`, `fixtureId`, `estimatedProbability`, `estimatedEdge`, `suggestionConfidenceScore`

**Indicadores de OCR por campo:**

- Verde (`nb-field-autofilled`): campo preenchido pelo OCR com confiança >= 85%
- Amarelo (`nb-field-warning`): campo marcado para revisão
- Azul/revisado (`nb-field-reviewed`): usuário editou o campo manualmente
- Ícone `CheckCircle2` na label quando campo aprovado

**Draft persistence:** O estado do modal é serializado e salvo em `newBetDraft` (estado do App.tsx) com debounce de 250ms via `onDraftChange`. Ao reabrir o modal, o draft é restaurado.

**Prefill:** Se o modal for aberto com `NewBetPrefill`, os campos são pré-preenchidos. O prefill é usado pela IA ao sugerir apostas.

---

## 7. Sistema de Apostas

### 7.1 Tipos de Status

| Status | Descrição | Cor |
|---|---|---|
| `pending` | Aposta registrada, resultado não resolvido | Amber (warning) |
| `won` | Aposta ganha | Verde (positive) |
| `lost` | Aposta perdida | Vermelho (negative) |
| `cashout` | Cashout realizado com valor específico | Cyan |
| `void` | Aposta cancelada (stake estornada) | Cinza (soft) |

### 7.2 Fluxo Completo

**Criação:**

1. Usuário abre Nova Aposta (via FAB, botão no topbar, ou prefill da IA)
2. Preenche o formulário (manual, OCR, ou sugestão de IA)
3. App.tsx valida: bookmaker existente, stake > 0, odds >= 1.01, saldo suficiente na casa
4. Objeto `Bet` criado com `status: "pending"`
5. Transação `bet_stake` criada com `amount: -stake`
6. Estado atualizado, sincronizado com localStorage e Firestore

**Liquidação:**

```
settleBet(id, status, cashoutAmount?)
```

- Somente apostas com `status === "pending"` podem ser liquidadas
- Payout calculado:
  - `won`: `stake * odds`
  - `cashout`: `cashoutAmount` (se informado) ou `stake * odds`
  - `void`: `stake` (estorno)
  - `lost`: `0`
- Transação criada:
  - `won` / `cashout`: tipo `bet_payout`, amount = payout
  - `void`: tipo `bet_refund`, amount = stake
  - `lost`: nenhuma transação adicional
- `settlementSource` marcado como `"manual"`

**Exclusão:**

- Remove o `Bet` do array
- Remove todas as transações com `referenceId === bet.id`
- Atualiza estado e sincroniza

### 7.3 Campos do Tipo `Bet`

```typescript
interface Bet {
  id: string;                         // "bet-{uuid}"
  placedAt: string;                   // ISO 8601 — momento do registro
  eventAt: string;                    // ISO 8601 — data/hora do evento
  sport: string;                      // Esporte (texto livre)
  league: string;                     // Liga/competição
  eventName: string;                  // Nome do evento (ex: "Flamengo x Fluminense")
  market: string;                     // Tipo de mercado (ex: "Total de gols")
  selection: string;                  // Seleção (ex: "Over 2.5")
  bookmakerId: string;                // ID da casa de apostas
  source?: "manual" | "ocr" | "ai_suggestion";
  suggestionId?: string;              // ID da sugestão de IA que originou a aposta
  fixtureId?: number | string;        // ID do fixture na Sports API
  strategyId?: string;                // ID da estratégia associada
  tags: string[];                     // Tags livres
  stake: number;                      // Valor apostado em BRL
  odds: number;                       // Odd de entrada (decimal)
  status: BetStatus;
  payout?: number;                    // Retorno efetivo (pós-liquidação)
  closingOdds?: number;               // Odd de fechamento (para CLV)
  settlementSource?: "manual" | "api";
  estimatedProbability?: number;      // Prob. estimada (sugestão IA)
  estimatedEdge?: number;             // Edge estimado (sugestão IA)
  confidenceScore?: number;           // Confiança OCR ou IA
  mode: "prelive" | "live";
  slipImageUrl?: string;              // URL público da imagem no Storage
  slipImagePath?: string;             // Caminho interno no Storage
  ocrMetadata?: OcrSubmissionMetadata;
}
```

### 7.4 Fontes de Apostas

| `source` | Origem |
|---|---|
| `"manual"` | Preenchimento manual pelo usuário |
| `"ocr"` | OCR aplicado com sucesso (`ocrMetadata.status === "success"` ou `"needs_review"`) |
| `"ai_suggestion"` | Aposta aberta a partir de sugestão da IA (tem `suggestionId`) |
| Importação CSV | Definida pelo campo `status` no CSV; source não é explicitamente gravada |

---

## 8. Sistema Financeiro / Ledger

### 8.1 Tipos de Transação

```typescript
type TransactionType =
  | "deposit"       // Entrada de dinheiro externo na casa
  | "withdrawal"    // Saque da casa
  | "transfer"      // Transferência entre casas
  | "adjustment"    // Ajuste manual (positivo ou negativo)
  | "bet_stake"     // Débito de stake ao registrar aposta (amount negativo)
  | "bet_payout"    // Crédito de retorno ao liquidar aposta ganha/cashout
  | "bet_refund"    // Crédito de estorno em aposta void
  | "void_entry";   // Lançamento de anulação (cancela outro lançamento)
```

Labels legíveis:

| Tipo | Label |
|---|---|
| `deposit` | Depósito |
| `withdrawal` | Saque |
| `transfer` | Transferência |
| `adjustment` | Ajuste |
| `bet_stake` | Stake |
| `bet_payout` | Liquidação |
| `bet_refund` | Estorno |
| `void_entry` | Anulação |

### 8.2 Interface Transaction

```typescript
interface Transaction {
  id: string;
  date: string;                    // ISO 8601
  type: TransactionType;
  bookmakerId: string;             // Casa de origem/referência
  targetBookmakerId?: string;      // Casa de destino (em transferências)
  description: string;
  amount: number;                  // Positivo = entrada, negativo = saída
  referenceType?: "bet" | "bookmaker" | "manual";
  referenceId?: string;
  voidedById?: string;             // ID do void_entry que anulou esta
  voidsCancelledId?: string;       // ID da transação original que este void_entry cancela
}
```

### 8.3 Cálculo do Saldo de Cada Bookmaker

O saldo **derivado** é calculado pela função `deriveBookmakerBalances(state)` em `ledger.ts`:

```
Para cada bookmaker:
  1. Filtrar todas as transações onde bookmakerId === book.id OU targetBookmakerId === book.id
  2. Se não houver transações: usar book.balance (saldo salvo manualmente)
  3. Se houver transações: somar o impacto de cada transação no saldo da casa:
     - Se transaction.bookmakerId === bookmakerId: usar transaction.amount diretamente
     - Se é uma transferência e targetBookmakerId === bookmakerId E não há mirror transfer:
       usar Math.abs(transaction.amount) como crédito
```

**Lógica de mirror transfer:** Transferências geram dois lançamentos (origem com valor negativo, destino com valor positivo). O sistema detecta se já existe o lançamento espelho para evitar dupla contagem.

### 8.4 Cálculo do Saldo Total da Banca

`calculateLedgerTotalBalance(state)`:

```
Se não houver bookmakers: retornar state.startingBalance
Senão: somar os derivedBalance de todos os bookmakers
```

### 8.5 Reconciliação de Saldos

`reconcileBookmakerBalances(state)`: atualiza `book.balance` com o valor derivado do ledger para manter coerência entre o campo salvo e o calculado.

`hasLedgerMismatch(bookmaker, balances)`: retorna `true` se `|delta| >= 0.01` e a casa tem histórico de transações.

### 8.6 Anulação de Transações (Void)

Somente transações manuais (não originadas de apostas) podem ser anuladas. O processo:

1. Valida: transação existe, não está anulada (`!original.voidedById`), não é `void_entry`, não é `referenceType === "bet"`
2. Cria um `void_entry` com `amount = -original.amount` e `voidsCancelledId = transactionId`
3. Atualiza a transação original com `voidedById = voidId`
4. O ledger ainda exibe ambas as linhas (imutabilidade da trilha de auditoria)

**Lançamentos de apostas são imutáveis:** `bet_stake`, `bet_payout`, `bet_refund` não podem ser anulados pelo ledger.

---

## 9. Métricas Calculadas

Todas as métricas são derivadas de `calculateMetrics(state: AppState): DashboardMetrics` em `src/lib/metrics.ts`.

### 9.1 Definições e Fórmulas

**Conjuntos base:**

```
pending  = bets where status === "pending"
settled  = bets where status !== "pending" AND status !== "void"
wins     = settled where status === "won" OR status === "cashout"
```

**`totalBalance`**

```
calculateLedgerTotalBalance(state)
→ se sem bookmakers: state.startingBalance
→ senão: Σ derivedBalance de todos os bookmakers (via ledger)
```

**`openExposure`**

```
Σ bet.stake para todos os bets com status === "pending"
```

**`profit`**

```
Σ (bet.payout ?? 0) - bet.stake  para todos os bets em settled

Onde betProfit(bet):
  - pending → 0
  - void    → 0
  - demais  → (bet.payout ?? 0) - bet.stake
```

**`roi` (Return on Investment)**

```
roi = profit / stakedSettled
onde stakedSettled = Σ bet.stake de bets em settled
roi = 0 se stakedSettled === 0
```

**`yield`**

```
yield = profit / stakedAll
onde stakedAll = Σ bet.stake de TODOS os bets (incluindo pendentes)
yield = 0 se stakedAll === 0
```

A diferença entre ROI e Yield: ROI usa apenas apostas liquidadas como denominador; Yield usa todas as apostas (incluindo pendentes), refletindo a eficiência sobre o volume total apostado.

**`hitRate`**

```
hitRate = wins.length / settled.length
hitRate = 0 se settled.length === 0
```

**`averageOdds`**

```
averageOdds = Σ bet.odds / state.bets.length
averageOdds = 0 se não há apostas
```

Inclui apostas pendentes e liquidadas.

**`clvAverage` (Closing Line Value médio)**

```
clvPercent(bet) = (bet.odds - bet.closingOdds) / bet.closingOdds
  → retorna null se bet.closingOdds não existe

clvAverage = Σ clvPercent(bet) [somente não-null] / count
clvAverage = 0 se nenhum bet tem closingOdds
```

CLV positivo indica que a aposta foi feita a um preço melhor que o mercado fechou — sinal de edge real.

**`potentialReturn(bet)`**

```
potentialReturn = bet.stake * bet.odds
```

### 9.2 Alertas de Risco (`riskAlerts`)

A função `riskAlerts(state)` usa os mesmos cálculos para gerar até 3 tipos de alerta:

| Condição | Nível | Título |
|---|---|---|
| >= `lossStreakLimit` perdas nas últimas 3 apostas | `danger` | "Sequencia negativa" |
| Maior stake pendente > `unit * maxStakeUnits` | `warning` | "Stake acima da unidade" |
| `openExposure > totalBalance * maxOpenExposurePercent/100` | `warning` | "Exposicao aberta elevada" |

Onde `unit = totalBalance * (unitPercent / 100)`.

### 9.3 Agrupamentos para Gráficos

**`groupProfitByBookmaker`:** Por bookmaker — `{id, name, profit, bets}`. Profit soma `betProfit()` de cada aposta.

**`groupProfitBySport`:** Por esporte — `{sport, stake, profit, bets}`. Ordenado por stake descrescente.

**`groupProfitByStrategy`:** Por estratégia — inclui `roi`, `hitRate`, `clvAverage`, `profit`, `bets`, `stake`. Usa somente apostas liquidadas para ROI e hitRate, mas todas as apostas para CLV e count.

---

## 10. Sistema de IA / Inteligência

### 10.1 Arquitetura

```
aiService.ts
  analyzePortfolio(state)
    → if VITE_AI_ENDPOINT:
        callAIEndpoint(state)   → buildPortfolioPrompt(state)
                                → POST endpoint com {prompt, model, max_tokens}
                                → parseAIResponse(text, state)
      else / fallback:
        analyzePortfolioLocally(state)
```

O hook `useAIAnalysis(state)` expõe `{ analysis, loading, error, refresh }` com `useCallback` para evitar rerenders.

### 10.2 Análise Local (Regras)

A função `analyzePortfolioLocally` gera sugestões e avisos com base em regras fixas:

**Sugestões:**

| Condição | Tipo | Prioridade |
|---|---|---|
| ROI > 8% | `increase` | medium |
| ROI < -5% | `review` | high |
| Hit rate < 40% | `focus` | high |
| Hit rate > 65% com > 30 apostas liquidadas | `review` | medium |
| Sequência de perdas > 5 | `decrease` | high |
| CLV médio > 0 | `focus` | low |

**Warnings:**

| Condição | Severidade |
|---|---|
| Exposição > 30% da banca | `critical` |
| Exposição > 20% da banca | `warning` |
| < 20 apostas liquidadas | `info` |
| Alertas de `riskAlerts()` | `critical` / `warning` |

### 10.3 Análise via API Externa

O prompt enviado ao endpoint externo inclui:

- Métricas gerais (banca, exposição, lucro, ROI, hit rate, CLV, counts)
- Top 3 estratégias por ROI
- Últimas 10 apostas liquidadas (data, evento, stake, odds, resultado)
- Casas de apostas com lucro

A resposta é parseada com regex buscando seções numeradas (`1)`, `2)`, `3)`, `4)`). Se o parse falhar, cai no modo local como fallback.

O endpoint recebe `{ prompt, model: "claude-sonnet-4-6", max_tokens: 1000 }`.

### 10.4 Tipos de Saída

```typescript
interface AIAnalysis {
  summary: string;              // 2 frases de resumo executivo
  topInsight: string;           // Insight mais crítico
  suggestions: AISuggestion[]; // Lista de ações recomendadas
  riskWarnings: AIWarning[];   // Lista de avisos de risco
  bestStrategy: string | null;  // Nome da melhor estratégia
  worstStrategy: string | null; // Nome da estratégia a revisar
  generatedAt: string;          // ISO 8601
  source: "local" | "api";
}

interface AISuggestion {
  type: "increase" | "decrease" | "avoid" | "focus" | "review";
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
}

interface AIWarning {
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
}
```

---

## 11. OCR de Bilhetes

### 11.1 Fluxo Completo

1. Usuário seleciona uma imagem no dropzone da seção "Bilhete" do modal Nova Aposta
2. `handleSlipChange` é chamado com o `File`
3. Verifica se há usuário autenticado (OCR requer storage)
4. Chama `uploadAndParseBetSlip(user.uid, file)` de `src/lib/ocr.ts`
5. O arquivo é enviado ao Firebase Storage em `users/{uid}/bet-slips/`
6. A URL pública é obtida
7. O endpoint de OCR processa a imagem (configurado externamente)
8. A resposta `ParseBetSlipResponse` é recebida

### 11.2 Campos Extraídos pelo OCR

Mapeamento entre campos OCR e campos do formulário:

| `OcrFieldName` | Campo do formulário | Observação |
|---|---|---|
| `eventName` | `eventName` | Nome do evento |
| `eventAtIso` | `eventAt` | Data convertida para `datetime-local` |
| `sport` | `sport` | Esporte |
| `league` | `league` | Liga |
| `market` | `market` | Tipo de mercado |
| `selection` | `selection` | Seleção |
| `bookmakerName` | `bookmakerId` | Match exato ou parcial com casas cadastradas |
| `stake` | `stake` | Valor convertido para string |
| `odds` | `odds` | Valor convertido para string |
| `mode` | `mode` | prelive / live |

Cada campo extraído tem: `value`, `confidence` (0–1), `sourceText` (trecho original lido).

### 11.3 Estados de OCR

| Status OCR | Significado |
|---|---|
| `idle` | Nenhum arquivo selecionado |
| `loading` | Upload e parsing em andamento (skeleton animado) |
| `done` | OCR concluído, campos aplicados |
| `error` | Falha no upload ou no parse |

Os status da resposta OCR:

| `ocr.status` | Significado |
|---|---|
| `success` | OCR bem-sucedido, todos os campos com boa confiança |
| `needs_review` | OCR concluído mas alguns campos precisam de revisão |
| `failed` | OCR não conseguiu extrair dados úteis |
| `not_configured` | Endpoint de OCR não configurado |

### 11.4 Indicadores de Confiança por Campo

| Threshold | Tone | Rótulo visual |
|---|---|---|
| >= 85% | `high` | Verde ("Conferido") |
| >= 65% e < 85% | `medium` | Amarelo ("Revisar") |
| < 65% | `low` | Vermelho ("Revisar") |
| null | `muted` | "sem score" |

Campos com `requiresReview = true` se: há warnings, status `needs_review`, ou confiança < 85%.

Ao editar manualmente um campo com metadados de OCR, `reviewedManually` é marcado como `true`.

### 11.5 Metadados de OCR Salvos na Aposta

```typescript
interface OcrSubmissionMetadata {
  status: "success" | "needs_review" | "failed" | "not_configured";
  requestId?: string;
  provider?: string;
  fields: Array<{
    name: OcrFieldName;
    value: string | number | null;
    confidence: number | null;
    sourceText: string | null;
    reviewedManually: boolean;
  }>;
}
```

`confidenceScore` da aposta = média das confianças de todos os campos OCR numéricos.

A `source` da aposta é marcada como `"ocr"` se `ocrMetadata.status === "success"` ou `"needs_review"`.

---

## 12. Sincronização Firebase

### 12.1 Estratégia Geral

O sistema usa duas camadas de persistência: `localStorage` (rápida, local, offline) e Firestore (nuvem, multi-dispositivo). O `localStorage` é sempre escrito primeiro (síncrono); o Firestore é escrito de forma assíncrona.

**Chave do localStorage:** `bancamais.state.{uid}` para usuários autenticados.

**Documento Firestore:** `users/{uid}/appStates/default`

Campos salvos no Firestore: todos os campos do `AppState` + `updatedAt: serverTimestamp()` + `schemaVersion: 1`.

### 12.2 Quando o Estado é Salvo

| Evento | localStorage | Firestore |
|---|---|---|
| Qualquer `updateState()` com usuário autenticado | Imediato, síncrono | Não (gerenciado pelo useEffect) |
| `useEffect` que observa `[state, user, authLoading]` | — | Debounce de **1500ms** após última mudança |
| `document.visibilityState === "hidden"` (trocar aba, bloquear tela, fechar janela) | — | Imediato, flush do timer pendente |
| Ações críticas (`addBet`, `settleBet`, `addTransaction`, `voidTransaction`, `addBookmaker`) | Imediato via `updateState` | Imediato via `syncToCloud()` |

**Usuários anônimos:** O localStorage é escrito normalmente, mas o Firestore não recebe writes automáticos.

### 12.3 Resolução de Conflitos por Timestamp

O campo `lastModifiedAt: string | null` é atualizado para `new Date().toISOString()` em toda chamada a `updateState()` via `withStateTimestamp()`.

No login:

```
if (cloudState existe):
  winner = getStateTimestamp(localState) > getStateTimestamp(cloudState)
           ? localState
           : cloudState
  se localState ganhar: sobe local para nuvem
else:
  usar localState, subir para nuvem se timestamp > 0
```

No `pullCloud()` manual: se estado local for mais recente, exibe `window.confirm` com timestamps comparativos antes de sobrescrever.

### 12.4 Sync em Tempo Real (onSnapshot)

O hook `useFirestoreSync` assina `onSnapshot` no documento do usuário:

1. Ignora snapshots com `metadata.hasPendingWrites === true` (writes locais do SDK)
2. No primeiro snapshot: apenas registra o timestamp remoto, não aplica
3. Nos snapshots subsequentes:
   - Se `remoteTimestamp <= localTimestamp`: ignora (local é mais recente)
   - Se `remoteTimestamp <= lastAppliedRemoteTimestamp`: ignora (já aplicado)
   - Caso contrário: chama `onRemoteUpdate(remoteState)` que aplica o estado remoto

O status do sync é `"idle" | "syncing" | "synced" | "error" | "offline"`.

Usuários anônimos têm status permanente `"offline"`.

### 12.5 Reconciliação Automática

Toda vez que o estado é aplicado (local ou remoto), `reconcileBookmakerBalances(state)` é chamado. Isso atualiza `book.balance` de cada bookmaker com o valor derivado pelo ledger, garantindo coerência entre o saldo salvo e o calculado.

---

## 13. Importação e Exportação CSV

### 13.1 Formato de Exportação

Gerado por `betsToCsv(state)`:

```
id,placedAt,eventAt,sport,league,eventName,market,selection,bookmaker,stake,odds,status,payout,closingOdds,mode,tags,slipImageUrl
```

- `bookmaker`: nome da casa (não o ID)
- `tags`: separadas por `|`
- `payout`: vazio se não liquidada
- `closingOdds`: vazio se não registrada
- `slipImageUrl`: URL pública ou vazio

Valores com vírgulas, quebras de linha ou aspas são envolvidos em aspas duplas (escape RFC 4180).

### 13.2 Formato de Importação

O parser `parseBetsCsv(content, state)` aceita o mesmo formato da exportação. Comportamento:

**Validações:**

| Validação | Erro gerado |
|---|---|
| CSV com menos de 2 linhas | "CSV sem linhas de aposta." |
| `bookmaker` não encontrado nas casas cadastradas | "Linha N: casa nao encontrada ({nome})." |
| `eventName`, `selection`, `stake` ou `odds` ausentes | "Linha N: campos obrigatorios ausentes." |

**Mapeamento de campos:**

| Campo CSV | Campo `Bet` | Fallback |
|---|---|---|
| `id` | `id` | `createBetId()` |
| `placedAt` | `placedAt` | `new Date().toISOString()` |
| `eventAt` | `eventAt` | `new Date().toISOString()` |
| `sport` | `sport` | `"Nao informado"` |
| `league` | `league` | `"Nao informado"` |
| `market` | `market` | `"Nao informado"` |
| `bookmaker` | `bookmakerId` | Match por nome ou ID |
| `tags` | `tags` | Split por `|` |
| `status` | `status` | `"pending"` |
| `payout` | `payout` | `undefined` se vazio |
| `closingOdds` | `closingOdds` | `undefined` se vazio |
| `mode` | `mode` | `"prelive"` se não for `"live"` |

**Deduplicação:** Ao importar, `importBets()` filtra IDs já existentes (`existingIds`). Somente apostas com IDs únicos são adicionadas.

**Transações geradas na importação:**

Para cada aposta importada com sucesso:
- Sempre: `bet_stake` com `amount = -stake`
- Se `won` ou `cashout`: `bet_payout` com `amount = payout`
- Se `void`: `bet_refund` com `amount = stake`

---

## 14. Navegação e Estrutura do App

### 14.1 Sidebar / Navegação

A sidebar tem 200px de largura em desktop. Contém:

1. **BrandLogo** (SVG + nome "Banca+" em Syne)
2. **Bank pill** — clicável, navega para "books", exibe nome da banca e saldo total em mono
3. **Nav** — 3 grupos com seus itens

**Grupos e itens de navegação:**

| Grupo | View ID | Label | Ícone (lucide-react) |
|---|---|---|---|
| Inicio | `dashboard` | Dashboard | `LayoutDashboard` |
| Inicio | `bets` | Apostas | `ListChecks` |
| Inicio | `import` | Importar | `Upload` |
| Análise | `intelligence` | Inteligência | `Brain` (badge: "IA") |
| Análise | `reports` | Relatórios | `FileBarChart` |
| Análise | `clv` | CLV & Edge | `TrendingUp` |
| Gestão | `books` | Bancas & Casas | `Wallet` |
| Gestão | `strategies` | Estratégias | `Target` |
| Gestão | `settings` | Configurações | `Settings2` |

Item ativo: borda esquerda 2px `var(--accent)`, fundo `rgba(139, 124, 246, 0.10)`, ícone opacity 1.

Em mobile (<980px): sidebar vira barra horizontal com `flex-wrap: wrap`, botões sem borda esquerda e com borda inferior ativa.

### 14.2 Topbar

Sempre visível, `position: sticky; top: 0; z-index: --z-sticky`. Contém:

1. **Search box** — busca global (descrição abaixo)
2. **Topbar meta** — título da view atual + label do usuário logado
3. **Topbar actions** — Bell (notificações, sem ação), User (vai para settings), CloudUpload (força sync), "Nova aposta" (primary button com `Plus` icon)

### 14.3 Busca Global

A busca global opera com debounce de 200ms. Indexa:

- **Apostas:** eventName, league, sport, market, selection, tags
- **Casas:** name
- **Estratégias:** name, description

Resultados exibidos em dropdown `.search-dropdown` agrupados por categoria:

- Apostas: até 5 resultados + "+N apostas" se houver mais
- Casas: todas as correspondências
- Estratégias: todas as correspondências

Clicar em um resultado navega para a view correspondente e fecha o dropdown.

`Enter` navega para a primeira categoria com resultados.
`Escape` limpa a busca e fecha o dropdown.

### 14.4 FAB (Botão Flutuante)

- Posição: `fixed; bottom: 24px; right: 24px`
- Tamanho: 44×44px
- Border-radius: `--radius` (6px) — quadrado, não círculo
- Background: `var(--accent)`
- Label: `+` em JetBrains Mono 20px
- Z-index: `--z-dropdown`
- Hover: `translateY(-1px)` + shadow maior
- Mobile: reposicionado para `bottom: 14px; right: 14px`
- Abre Nova Aposta sem prefill

### 14.5 Abertura da Nova Aposta

| Origem | Prefill |
|---|---|
| FAB ou botão "Nova aposta" no topbar | `null` — formulário vazio |
| Botão "Nova entrada" no Dashboard | `null` |
| Sugestão da IA (Suggestions) | `NewBetPrefill` com eventName, odds, estimatedProbability, estimatedEdge, suggestionId, etc. |
| Import com `onOpenNewBet` | `null` |

Se `newBetDraft` existir e `prefill` for null, o draft salvo é restaurado no modal.

---

## 15. Configurações e Gestão de Risco

### 15.1 Campos de `RiskSettings`

```typescript
interface RiskSettings {
  unitPercent: number;            // % da banca que corresponde a 1 unidade
  maxStakeUnits: number;          // Stake máxima em unidades
  maxOpenExposurePercent: number; // % máximo da banca em apostas abertas
  lossStreakLimit: number;        // Número de perdas seguidas que dispara alerta
}
```

**Valores padrão (em `emptyState()`):**

| Campo | Default |
|---|---|
| `unitPercent` | 1 (1% da banca = 1u) |
| `maxStakeUnits` | 2 (stake máxima = 2u) |
| `maxOpenExposurePercent` | 5 (5% da banca) |
| `lossStreakLimit` | 3 (3 perdas seguidas) |

### 15.2 Como as Regras de Risco são Usadas na UI

**Em `riskAlerts()` (Dashboard e Intelligence):**

```
unit = totalBalance * (unitPercent / 100)
maxStake = unit * maxStakeUnits
maxExposure = totalBalance * (maxOpenExposurePercent / 100)

Alerta de sequência:
  → últimas 3 apostas registradas, contar quantas são "lost"
  → se count >= lossStreakLimit: alerta "danger"

Alerta de stake:
  → maior stake pendente > maxStake: alerta "warning"

Alerta de exposição:
  → openExposure > maxExposure: alerta "warning"
```

**No Settings (resumo):**

- "Unidade da banca": `riskSettings.unitPercent.toFixed(1)%`
- "Exposição máxima": `riskSettings.maxOpenExposurePercent.toFixed(0)%`

**Na IA (`analyzePortfolioLocally`):**

A IA usa `riskAlerts()` internamente e converte os resultados em `AIWarning` com severidade `critical` ou `warning`.

### 15.3 Configurações de Conta e Bankroll

| Campo | Tipo | Validação |
|---|---|---|
| `bankrollName` | texto | Required, maxLength=60, trim |
| `startingBalance` | number | >= 0, isFinite |

O `startingBalance` é usado somente quando não há bookmakers cadastrados (serve como fallback para `calculateLedgerTotalBalance`). Com bookmakers ativos, o saldo é sempre derivado do ledger de transações.

---

**Fim do Relatório Técnico Banca+ — versão 2026-05-10**

---

Os arquivos centrais referenciados ao longo deste relatório são:

- `/src/lib/types.ts` — todos os tipos TypeScript do sistema
- `/src/lib/metrics.ts` — fórmulas de todas as métricas
- `/src/lib/ledger.ts` — sistema financeiro e saldo por bookmaker
- `/src/lib/cloudRepository.ts` — autenticação e Firestore
- `/src/lib/useFirestoreSync.ts` — sync em tempo real
- `/src/lib/aiService.ts` — análise de portfólio local e via API
- `/src/lib/csv.ts` — importação e exportação
- `/src/lib/storage.ts` — persistência local e normalização de estado
- `/src/App.tsx` — orquestrador central, todos os handlers de mutação
- `/src/styles.css` — design system completo (~3500 linhas)

