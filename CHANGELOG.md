# Changelog

Todas as mudanças relevantes do Banca+ são registradas aqui.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).
Tipos de mudança: **Adicionado**, **Alterado**, **Corrigido**, **Removido**.

## [Não lançado]

### Adicionado
- **Export de relatório em PDF** — botão "Exportar PDF" em Relatórios gera um relatório executivo de uma página (métricas + apostas recentes). jsPDF carregado sob demanda.
- **Lista de espera do plano Edge** — o CTA do Edge na landing virou "Entrar na lista de espera" com modal de captura de email; registros gravados na coleção `waitlist` do Firestore (regra create-only validada).

### Alterado
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
