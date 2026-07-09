# Changelog

Todas as mudanças relevantes do Banca+ são registradas aqui.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).
Tipos de mudança: **Adicionado**, **Alterado**, **Corrigido**, **Removido**.

## [Não lançado]

### Adicionado
- **Export de relatório em PDF** — botão "Exportar PDF" em Relatórios gera um relatório executivo de uma página (métricas + apostas recentes). jsPDF carregado sob demanda.
- **Lista de espera do plano Edge** — o CTA do Edge na landing virou "Entrar na lista de espera" com modal de captura de email; registros gravados na coleção `waitlist` do Firestore (regra create-only validada).
- **Fundação de planos (gating) — fase 1** — modelo `plan.ts` (tiers free/edge, features, limites), hook `usePlan` (demo = edge, conta real = free, override de dev `bancamais_dev_plan`) e paywall `PlanLock`. As telas **Inteligência, Odds e CLV & Edge** agora mostram o paywall para o plano Free; o CTA registra na lista de espera.
- **Gating — fase 1.5** — OCR (escanear bilhete) vira estado bloqueado no Free (QuickBet e NewBet); enforcement dos limites: bloqueia a 51ª aposta do mês e a 3ª casa no Free.
- **Allowlist de contas master** (`MASTER_UIDS`) — Edge vitalício para UIDs de confiança, ponte até o billing.
- **Gating — fase 2 (backend)** — fonte de verdade do plano migra para o backend: doc `entitlements/{uid}` (regra: dono lê, só Admin escreve), hook `useEntitlement` em tempo real, e Cloud Functions de billing do **Mercado Pago** (`createSubscriptionCheckout` + `mercadoPagoWebhook`). Falta ativar: definir o secret `MERCADOPAGO_ACCESS_TOKEN`, deployar as functions e registrar a URL do webhook.

### Alterado
- Landing (quick wins da auditoria): card de Inteligência agora exibe o rótulo "exemplo ilustrativo" nos dados fictícios, evitando que sejam lidos como promessa de performance (risco de compliance de anúncio).
- Landing (quick wins da auditoria): cards de feature com jargão de sharp ganharam tradução em português para tráfego frio ("CLV é o teste de skill vs. sorte" e "Hard stop é a trava que te impede de perder o mês numa noite").
- SEO: meta description trocada de "Terminal analítico de gestão de banca..." para copy com dor + benefício ("Saiba se você está no lucro de verdade. Controle de banca com stop loss, ROI real e disciplina. Grátis, sem cartão.").
- Logo: o símbolo "+" da marca ficou maior e com traços mais grossos.
- Copy da landing e do login: removidos os travessões das frases para um texto mais natural.
- Landing: plano Edge marcado como "Em breve" (sem cobrança até existir billing); honestidade de pré-lançamento.
- URL espelha o contexto: `/` para a landing (deslogado) e `/app` para o produto (logado/demo); deep-link `/app` deslogado abre o login.
- Tela de Odds: removida a copy de "plano grátis · 500/mês · créditos" (era setup de teste da API), agora neutra ("buscas no mês · odds ao vivo").

### Pendente
- Sistema de planos/gating no backend (entitlements + Cloud Functions + pagamento). Hoje não existe; todo recurso está liberado.

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
