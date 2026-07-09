# Banca+ — Guia para Desenvolvimento

## Visão do produto

Banca+ é uma ferramenta financeira de gestão de apostas esportivas. **Não é um cassino**: é um terminal analítico para apostadores profissionais que querem controle, disciplina e edge de longo prazo.

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | React 19 + TypeScript 5 (strict) |
| Build | Vite 7 + @tailwindcss/vite |
| Estilo | Tailwind CSS v4 (CSS-first) + `src/styles.css` (tokens + classes globais) |
| Componentes UI | shadcn/ui (Radix UI + cva + tailwind-merge) em `src/components/ui/` |
| Ícones | lucide-react |
| Gráficos | recharts (cores hex inline — não lê CSS vars) |
| Notificações | react-hot-toast |
| Backend | Firebase (Auth + Firestore + Storage) |
| Deploy | Firebase Hosting |

### Design system — Linear/Vercel dark

Paleta minimalista dark definida em `:root` em `styles.css`:
- Background `#0A0A0A` (`--bg`) · Surface `#111111`/`#141414` (`--panel`/`--panel-2`)
- Border `rgba(255,255,255,0.08)` (`--line`) · Text `#EDEDED` (`--text`) · Muted `#888888` (`--muted`)
- Accent `#7C3AED` (`--accent`) · Success `#22C55E` · Error `#EF4444` · Warning `#F59E0B`
- Fontes: Inter (UI) + JetBrains Mono (números/dados)

`styles.css` começa com `@import "tailwindcss";` seguido das variáveis shadcn/ui e dos tokens de design. As classes customizadas existentes (notif-panel, cookie-banner, tag-chip, chart-period-tab, edit-bet-modal, lgpd-actions, etc.) foram mantidas e re-skinadas via tokens. Use `cn()` de `src/lib/utils.ts` para compor classes Tailwind.

## Estrutura de arquivos

```
src/
├── App.tsx                    # Orquestrador: estado global, handlers, roteamento por view
├── styles.css                 # Todo o CSS em arquivo único
├── main.tsx                   # Entry point
├── components/
│   ├── BrandLogo.tsx          # Logo SVG da marca
│   ├── Dashboard.tsx          # Dashboard com gráficos Recharts
│   ├── Bets.tsx               # Lista de apostas com busca e filtros
│   ├── NewBet.tsx             # Modal de nova aposta
│   ├── Import.tsx             # Importação CSV
│   ├── Intelligence.tsx       # IA: análise de portfólio
│   ├── ClvEdge.tsx            # CLV & Edge com gráficos
│   ├── Books.tsx              # Casas de apostas e transações
│   ├── Strategies.tsx         # Estratégias e performance
│   ├── Reports.tsx            # Relatórios e exportação
│   ├── Settings.tsx           # Configurações e Firebase sync
│   ├── AuthPage.tsx           # Página de autenticação dedicada
│   ├── EmptyState.tsx         # Componente de estado vazio reutilizável
│   └── Metric.tsx             # Card de métrica simples
└── lib/
    ├── types.ts               # Todos os tipos TypeScript
    ├── firebase.ts            # Inicialização do Firebase
    ├── cloudRepository.ts     # Operações Firebase (Auth + Firestore)
    ├── storage.ts             # localStorage + normalização de estado
    ├── storageRepository.ts   # Upload de imagens no Storage
    ├── metrics.ts             # Cálculos: ROI, CLV, yield, hit rate
    ├── csv.ts                 # Exportação e importação CSV
    ├── chartData.ts           # Transformação de dados para Recharts
    ├── aiService.ts           # Análise de portfólio por IA (local + API)
    └── useAIAnalysis.ts       # Hook React para aiService
```

## Firebase

Projeto: `bancamais-12778`
- Auth: Email/senha + anônimo
- Firestore: `users/{uid}/appStates/default`
- Storage: `users/{uid}/bet-slips/*`
- Hosting: configurado para SPA (rewrites para /index.html)

## Variáveis de ambiente

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
VITE_AI_ENDPOINT=   # opcional — deixe vazio para análise local
VITE_META_PIXEL_ID= # opcional — tracking de aquisição (vazio = desativado)
VITE_GA4_ID=        # opcional — GA4 (formato G-XXXX; vazio = desativado)
```

### Monetização e aquisição
- **Materiais de venda** em `docs/marketing/` (estratégia GTM, lead magnet, ebook Protocolo, roteiros de Reels).
- **Checkout do Protocolo** (pagamento único R$47) via Mercado Pago Checkout Pro: Cloud Function `createProtocoloCheckout` + wrapper `src/lib/checkout.ts`. Requer o secret `MERCADOPAGO_ACCESS_TOKEN` (ativar depois). Assinatura recorrente do Edge usa o fluxo de preapproval já existente (`createSubscriptionCheckout` + `mercadoPagoWebhook`).
- **Tracking** em `src/lib/analytics.ts`: Meta Pixel + GA4 env-gated (`initAnalytics`/`trackEvent`/`trackPageView`) + captura de UTM (`captureUtmParams`/`getStoredUtm`). Sem IDs, tudo é no-op. Eventos de aquisição são disparados no App (não nos componentes de UI direto).

## Comandos

```bash
npm run dev      # desenvolvimento em localhost:5173
npm run build    # build de produção (TypeScript + Vite)
npm run lint     # verificação TypeScript
firebase deploy  # deploy no Firebase Hosting
```

## Convenções de código

- **Sem `any`** — TypeScript strict ativado
- **Sem comentários óbvios** — código se explica pelos nomes
- **CSS por classes** — não usar style inline
- **Handlers no App.tsx** — componentes recebem handlers como props, nunca acessam Firebase diretamente
- **Toast para feedback** — todo handler de mutação deve chamar toast.success/error
- **Copy sem travessão** — não usar `—` nas frases de UI/landing; preferir ponto ou parênteses
- **Registro obrigatório** — toda alteração atualiza o `CHANGELOG.md` (seção `[Não lançado]`) e, quando mexer em convenção/arquitetura/estado do projeto, também este `CLAUDE.md`

## Design system

Paleta definida em `:root` em styles.css. Fontes: JetBrains Mono (dados/números) + Space Grotesk (interface). Ver BRAND_GUIDE.md para diretrizes da marca.

## Métricas calculadas

Todas as métricas derivam de `calculateMetrics(state)` em `src/lib/metrics.ts`:
- ROI, yield, hit rate, CLV médio, exposição aberta, lucro total

### Invariantes de cálculo (auditados — não regredir)
- **ROI ≠ yield.** ROI global = `lucro / capital` (dinheiro depositado). Yield/turnover (estratégia, mensal) = `lucro arriscado / stake arriscado`. "Arriscado" = `isRiskedBet` (exclui freebet e void). Não rotule yield como "ROI" na UI.
- **Freebet** não entra no numerador nem no denominador do yield, nem na exposição aberta; payout de vitória = `stake × (odds−1)`.
- **Cashout** exige valor informado (`> 0`); sem valor, é rejeitado — nunca cair para `stake × odds` (vitória cheia).
- **Payout na importação** é sempre reconciliado por `settledPayout`, ignorando payout do CSV que contradiga a regra.
- **Import CSV** usa `id` determinístico por conteúdo quando a linha não traz `id` (para a dedup de re-importação funcionar).
- **Datas** devem ser ISO válidas; nunca gravar string crua não validada (vira `NaN` nas métricas).

## IA

`aiService.ts` analisa o portfólio localmente por regras ou via endpoint externo (`VITE_AI_ENDPOINT`). O hook `useAIAnalysis` expõe `{ analysis, loading, error, refresh }`.
