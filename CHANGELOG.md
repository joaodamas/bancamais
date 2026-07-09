# Changelog

Todas as mudanças relevantes do Banca+ são registradas aqui.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).
Tipos de mudança: **Adicionado**, **Alterado**, **Corrigido**, **Removido**.

## [Não lançado]

### Adicionado
- **Go-to-market: materiais de venda** (`docs/marketing/`) — estratégia de monetização (escada de valor grátis -> Protocolo R$47 -> Edge Founder -> assinatura), lead magnet "7 armadilhas", ebook "Protocolo de Gestão de Banca" e 10 roteiros de Reels.
- **Checkout do Protocolo (Mercado Pago Checkout Pro)** — Cloud Function `createProtocoloCheckout` cria a preference de pagamento único (R$47) e devolve o `initPoint`; wrapper `src/lib/checkout.ts` e handler `handleBuyProtocolo` no App (exige conta; guarda a intenção e retoma o checkout após o cadastro). Falta ativar: definir o secret `MERCADOPAGO_ACCESS_TOKEN` e deployar. Fulfillment (conceder Founder por webhook) fica para etapa futura.
- **Tracking de aquisição** — `analytics.ts` ganhou camada Meta Pixel + GA4 env-gated (`VITE_META_PIXEL_ID`, `VITE_GA4_ID`; vazio = no-op) com `initAnalytics`, `trackEvent`, `trackPageView` e captura/persistência de UTM (`captureUtmParams`/`getStoredUtm`). Eventos disparados: `InitiateCheckout` (CTA fundador) e `Lead` (lista de espera).
- **Landing: seção "Planilha vs Banca+"** (comparativo) e estrutura de **prova social** (renderiza só quando houver depoimentos reais; sem dados falsos).
- **Export de relatório em PDF** — botão "Exportar PDF" em Relatórios gera um relatório executivo de uma página (métricas + apostas recentes). jsPDF carregado sob demanda.
- **Lista de espera do plano Edge** — o CTA do Edge na landing virou "Entrar na lista de espera" com modal de captura de email; registros gravados na coleção `waitlist` do Firestore (regra create-only validada).
- **Fundação de planos (gating) — fase 1** — modelo `plan.ts` (tiers free/edge, features, limites), hook `usePlan` (demo = edge, conta real = free, override de dev `bancamais_dev_plan`) e paywall `PlanLock`. As telas **Inteligência, Odds e CLV & Edge** agora mostram o paywall para o plano Free; o CTA registra na lista de espera.
- **Gating — fase 1.5** — OCR (escanear bilhete) vira estado bloqueado no Free (QuickBet e NewBet); enforcement dos limites: bloqueia a 51ª aposta do mês e a 3ª casa no Free.
- **Allowlist de contas master** (`MASTER_UIDS`) — Edge vitalício para UIDs de confiança, ponte até o billing.
- **Gating — fase 2 (backend)** — fonte de verdade do plano migra para o backend: doc `entitlements/{uid}` (regra: dono lê, só Admin escreve), hook `useEntitlement` em tempo real, e Cloud Functions de billing do **Mercado Pago** (`createSubscriptionCheckout` + `mercadoPagoWebhook`). Falta ativar: definir o secret `MERCADOPAGO_ACCESS_TOKEN`, deployar as functions e registrar a URL do webhook.

### Alterado
- Landing: CTA do Edge virou "Garantir preço de fundador" (leva ao checkout do Protocolo, que inclui acesso Founder ao Edge), com fallback de "entrar na lista de espera"; badge "Em breve" virou "Oferta de fundador".
- Landing (quick wins da auditoria): card de Inteligência agora exibe o rótulo "exemplo ilustrativo" nos dados fictícios, evitando que sejam lidos como promessa de performance (risco de compliance de anúncio).
- Landing (quick wins da auditoria): cards de feature com jargão de sharp ganharam tradução em português para tráfego frio ("CLV é o teste de skill vs. sorte" e "Hard stop é a trava que te impede de perder o mês numa noite").
- SEO: meta description trocada de "Terminal analítico de gestão de banca..." para copy com dor + benefício ("Saiba se você está no lucro de verdade. Controle de banca com stop loss, ROI real e disciplina. Grátis, sem cartão.").
- Logo: o símbolo "+" da marca ficou maior e com traços mais grossos.
- Copy da landing e do login: removidos os travessões das frases para um texto mais natural.
- Landing: plano Edge marcado como "Em breve" (sem cobrança até existir billing); honestidade de pré-lançamento.
- URL espelha o contexto: `/` para a landing (deslogado) e `/app` para o produto (logado/demo); deep-link `/app` deslogado abre o login.
- Tela de Odds: removida a copy de "plano grátis · 500/mês · créditos" (era setup de teste da API), agora neutra ("buscas no mês · odds ao vivo").
- Auditoria de plataforma: rótulo "ROI mensal" virou "Yield mensal" em Performance (o número já era yield/turnover, não ROI sobre capital) e a coluna "ROI" por estratégia virou "Yield" — para não confundir com o ROI global (`lucro/capital`).

### Corrigido
- **Import CSV — re-importação duplicava apostas** (P0): o `id` era um UUID novo a cada parse, então a dedup nunca detectava repetição. Agora linhas sem `id` recebem um id determinístico por conteúdo (`placedAt|eventName|selection|stake|odds|bookmakerId`), e o preview deduplica contra o estado atual E contra linhas repetidas dentro do próprio arquivo.
- **Import CSV — datas não validadas** (P0): datas inválidas ou em `DD/MM/YYYY` gravavam string crua e viravam `NaN` em métricas/gráficos. Agora há parser tolerante (pt-BR primeiro, depois ISO) e a linha inválida é rejeitada com erro.
- **Import CSV — status e payout** (P1): status fora do enum agora é rejeitado (antes virava prejuízo silencioso); o payout de apostas liquidadas é sempre reconciliado por `settledPayout` (freebet, meia, etc.), ignorando payout do CSV que contradiga a regra.
- **Cashout sem valor creditava vitória cheia** (P0): `settledPayout` caía para `stake × odds`, gravando saldo/lucro inflado no ledger. Agora cashout sem valor válido é rejeitado no formulário e na liquidação em lote; o fallback nunca é vitória cheia.
- **Yield mensal contaminado por void e freebet** (P0): o denominador somava stake de todas as apostas (inclusive void e freebet) e o numerador incluía ganho de freebet. Agora usa só apostas arriscadas (`isRiskedBet`), alinhado ao yield global.
- **Anexo de bilhete engolia falha de upload** (P0): `addBet` não tratava erro do Storage e os formulários não davam feedback. Agora a falha mostra `toast.error` e a aposta é salva sem o print (degrada, não perde a entrada).
- **Sync entre dispositivos re-enviava estado remoto** (P1): o auto-save reemitia à nuvem o snapshot recebido de outro aparelho, podendo reverter edição recente. Agora atualizações vindas do remoto não disparam auto-save (`applyingRemoteRef`).
- **Campos de risco vazios zeravam limites** (P1): `Number("")` virava `0` silenciosamente. Agora campo vazio mantém o valor atual e valores inválidos/fora de faixa são rejeitados com toast.
- **"Perdas consecutivas" não eram consecutivas** (P1): a contagem usava uma janela (incluindo apostas pendentes) e o texto mentia. Agora conta a sequência real de derrotas liquidadas em ordem cronológica.
- **Exposição aberta incluía freebet pendente** (P1): freebet não é dinheiro próprio em risco e disparava alertas de exposição indevidos. Agora a exposição filtra apenas apostas arriscadas.
- **CLV médio divergia do gráfico** (P1): a média incluía apostas pendentes e não validava a odd de fechamento. Agora exige `status != pending` e `closingOdds > 1`, igual à série temporal.
- **Retorno potencial de freebet pendente** (P2): a exibição somava o stake que não volta; agora mostra `stake × (odds−1)`.
- **`eventAt` gravado sem fuso** (P2): normalizado para ISO no cadastro e na edição, consistente com `placedAt`.
- **localStorage não era limpo no logout** (P2): o estado do usuário anterior ficava legível em dispositivo compartilhado; agora `clearStateForUser` roda no signOut.
- Detalhes menores: `key` estável na lista de notificações; `syncToCloud` explícito em `completeOnboarding`/`removeBookmaker`/`updateRiskSettings`.

### Segurança
- **Regra `publicPages` removida** (P0): permitia a qualquer autenticado (inclusive anônimo) criar documentos ilimitados e sobrescrever a página de terceiros. A coleção não era usada pelo app.
- **`waitlist` validada** (P1): `create` agora exige formato de email, limita tamanho de `plan`/`userAgent` e restringe as chaves permitidas.
- **Callables pagas com gating de plano** (P1): `searchSportsFixtures` e `getSportsFixtureResult` passaram a exigir `ensureEdge`, impedindo conta anônima de queimar a quota da API-Sports.
- **Webhook Mercado Pago valida assinatura** (P2): verificação HMAC-SHA256 do header `x-signature` (com `timingSafeEqual`) antes de processar; o re-fetch do preapproval segue como defesa em profundidade. Requer o secret `MERCADOPAGO_WEBHOOK_SECRET`.
- **Security headers no Hosting** (P2): `X-Frame-Options`, `X-Content-Type-Options`, `HSTS`, `Referrer-Policy` e uma CSP restritiva compatível com Firebase/Fonts/reCAPTCHA.
- **Bearer token de IA removido do bundle** (P2): `aiService` não lê mais `VITE_AI_BEARER_TOKEN` (vazava para o cliente); endpoint autenticado deve ir via Cloud Function.
- **CSV export — formula injection** (P2): células que começam com `= + - @`/tab são neutralizadas com aspa simples.

### Pendente
- Sistema de planos/gating no backend (entitlements + Cloud Functions + pagamento). Hoje não existe; todo recurso está liberado.
- **App Check enforcement** (adiado): as callables permanecem sem `enforceAppCheck`; ligar apenas quando o App Check estiver configurado no console + cliente (reCAPTCHA), preferencialmente em modo monitor antes de produção.
- Verificar em staging que a nova CSP não bloqueia fontes, reCAPTCHA nem chamadas Firebase; configurar o secret `MERCADOPAGO_WEBHOOK_SECRET` antes de reativar o webhook.

### Adicionado
- **Landing page (vitrine deslogada)** — visitante deslogado cai na landing; os CTAs levam para cadastro, login ou modo demonstração.
  - Seções: hero com CTA duplo, dor, como funciona (3 passos), IA em destaque, grade de features, planos, privacidade/jogo responsável, FAQ e CTA final.
  - Tabela de planos **Controle** (grátis) vs **Edge** (R$ 24,90/mês) — modelo freemium.
  - `AuthPage` ganhou modo inicial configurável e botão "Voltar" para a landing.

### Pendente
- Rotas reais `/` (landing) e `/app` (produto) — hoje a navegação é por estado, sem alterar a URL.

## [2026-06-27]

### Corrigido
- **OCR da Entrada Rápida** agora usa o overlay central "Lendo o bilhete…" igual ao do modo completo, em vez do feedback inline; mensagem alinhada ("Enviando print e lendo campos do bilhete…").

## [2026-06-26]

### Adicionado
- **OCR no modo rápido** — botão "Escanear print" preenche evento, data, stake, odd e casa automaticamente na Entrada Rápida.
- **Liquidação imediata na criação** — campo Status (ganha/perdida/cashout/reembolso) gera a transação de payout/refund junto da aposta, com campo condicional de valor de cashout e feedback de lucro em tempo real.
- **Script `npm run deploy`** (lint + test + build + deploy) e `firebase-tools` como devDependency.
- **Extrato consolidado** com timeline de apostas e caixa.

### Alterado
- Mobile: Entrada Rápida centralizada; inputs de data com `lang` correto.
- Apostas e estratégias responsivas; gráficos por data.

### Corrigido
- Curva da banca; arredondamento dos scores de risco/tilt.
