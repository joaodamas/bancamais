# Banca+ - Documento Técnico e Funcional

## 1. Visão geral

O Banca+ é uma plataforma de controle de banca para apostas esportivas com foco em:

- registro e acompanhamento de apostas
- controle de saldo por casa
- rastreabilidade financeira por ledger
- leitura OCR de bilhetes
- análise operacional e sugestões com IA

O produto foi desenhado para operar como uma camada própria de gestão sobre o uso de casas como Betano, Bet365 e similares.

## 2. Objetivo funcional

O sistema ajuda o usuário a:

- cadastrar a banca inicial
- cadastrar casas de aposta e seus saldos
- registrar apostas manualmente, por OCR ou por sugestão IA
- acompanhar exposição aberta, lucro, ROI, CLV e performance
- auditar movimentações financeiras por casa
- usar IA para leitura de bilhetes e análise de oportunidades

## 3. Principais módulos da plataforma

### 3.1 Onboarding

Arquivo principal:
- `src/components/Onboarding.tsx`

Função:
- configurar nome da banca
- configurar saldo inicial de referência
- cadastrar casas iniciais

### 3.2 Dashboard

Arquivo principal:
- `src/components/Dashboard.tsx`

Função:
- exibir saldo atual
- mostrar exposição aberta
- mostrar capital monitorado
- resumir lucro, ROI, acerto e CLV
- apresentar gráficos de evolução e alertas de risco

### 3.3 Apostas

Arquivo principal:
- `src/components/Bets.tsx`

Função:
- listar apostas
- filtrar por status
- buscar por evento, mercado, esporte, casa e tags
- liquidar apostas como ganha, perdida, cashout ou void

### 3.4 Nova aposta

Arquivo principal:
- `src/components/NewBet.tsx`

Função:
- criar nova aposta
- anexar bilhete
- acionar OCR
- pré-preencher campos automaticamente
- preservar rascunho do formulário

### 3.5 Bancas e casas

Arquivo principal:
- `src/components/Books.tsx`

Função:
- cadastrar casas
- editar casa
- remover casa sem histórico
- registrar depósitos, saques, transferências e ajustes
- consultar ledger por casa

### 3.6 Estratégias

Arquivo principal:
- `src/components/Strategies.tsx`

Função:
- cadastrar estratégias operacionais
- associar apostas a estratégias
- ativar e pausar estratégias

### 3.7 Inteligência

Arquivos principais:
- `src/components/Intelligence.tsx`
- `src/components/Suggestions.tsx`
- `src/components/TeamNewsWidget.tsx`

Função:
- analisar a base do usuário
- exibir insights operacionais
- sugerir apostas com apoio de dados esportivos
- mostrar contexto de times e notícias

### 3.8 Relatórios

Arquivo principal:
- `src/components/Reports.tsx`

Função:
- resumir métricas consolidadas
- apoiar leitura gerencial da operação

### 3.9 Configurações

Arquivo principal:
- `src/components/Settings.tsx`

Função:
- editar nome da banca
- editar saldo inicial de referência
- ajustar parâmetros de risco
- acionar sincronização em nuvem

## 4. Regras de negócio principais

### 4.1 Saldo

O app hoje trabalha com duas ideias distintas:

- saldo atual das casas
- saldo inicial de referência da banca

Na interface principal:

- `Saldo` = saldo operacional atual, baseado no ledger reconciliado
- `Apostas abertas` = soma das stakes pendentes
- `Capital monitorado` = saldo atual + exposição aberta

### 4.2 Ledger

Arquivo principal:
- `src/lib/ledger.ts`

Regras:
- depósitos aumentam saldo
- saques reduzem saldo
- transferências movem saldo entre casas
- stake de aposta reduz saldo da casa no momento do registro
- payout devolve saldo ao liquidar aposta
- void e anulações mantêm trilha histórica

### 4.3 Apostas

Arquivo principal:
- `src/lib/metrics.ts`

Regras:
- aposta pendente entra como exposição aberta
- aposta ganha ou cashout conta como vitória
- lucro por aposta é `payout - stake`
- aposta void não conta lucro

### 4.4 Risco

Parâmetros:
- percentual por unidade
- stake máxima em unidades
- exposição máxima aberta
- limite de sequência negativa

Quando os limites são rompidos:
- o sistema gera alertas
- pode ativar cooldown para novas entradas

## 5. OCR de bilhetes

Arquivos principais:
- `src/lib/ocr.ts`
- `src/components/NewBet.tsx`
- `functions/src/index.ts`

Fluxo:
1. usuário anexa imagem do bilhete
2. imagem sobe para Firebase Storage
3. uma Function chama OCR com visão
4. o retorno extrai campos relevantes
5. o formulário é pré-preenchido
6. o usuário revisa e salva

Campos extraídos:
- evento
- data
- esporte
- liga
- mercado
- seleção
- odd
- stake
- casa

## 6. Sugestões com IA

Arquivos principais:
- `src/lib/suggestions.ts`
- `src/lib/useSuggestions.ts`
- `src/lib/sportsApi.ts`
- `functions/src/services`

Objetivo:
- buscar jogos futuros
- consultar contexto dos times
- comparar probabilidade estimada com odds
- apresentar oportunidades com justificativa

Estado atual:
- já existe base funcional de sugestões
- ainda depende de evolução contínua em dados, ranking e validação de edge

## 7. Arquitetura técnica

### Frontend

Stack:
- React 19
- TypeScript
- Vite
- Recharts
- Lucide React
- React Hot Toast

Arquivos centrais:
- `src/App.tsx`
- `src/styles.css`

### Backend e infraestrutura

Stack:
- Firebase Authentication
- Firestore
- Firebase Storage
- Firebase Functions

Arquivo central:
- `firebase.json`

Uso:
- autenticação de usuário
- persistência da base do usuário
- upload de bilhetes
- OCR e serviços auxiliares de IA/dados esportivos

## 8. Persistência

### Local

Arquivo:
- `src/lib/storage.ts`

Uso:
- persistência local
- bootstrap de estado
- recuperação rápida ao abrir o app

### Nuvem

Arquivo:
- `src/lib/cloudRepository.ts`

Uso:
- salvar e carregar estado do usuário autenticado
- reconciliar versão local e remota por `lastModifiedAt`

## 9. Estrutura principal do código

### Componentes

Pasta:
- `src/components`

Contém:
- telas
- widgets
- modais
- superfícies operacionais

### Bibliotecas internas

Pasta:
- `src/lib`

Contém:
- tipos
- métricas
- ledger
- storage
- integrações Firebase
- OCR
- IA
- sugestões

### Functions

Pasta:
- `functions/src`

Contém:
- entrypoint das functions
- contratos
- serviços externos

## 10. Fluxos principais do usuário

### Fluxo 1: primeiro acesso
1. usuário entra no app
2. onboarding é exibido
3. usuário define banca e casas
4. dashboard é liberado

### Fluxo 2: registrar aposta
1. usuário abre `Nova aposta`
2. preenche manualmente ou usa OCR
3. aposta é salva
4. stake é debitada da casa
5. dashboard e lista são atualizados

### Fluxo 3: liquidar aposta
1. usuário abre lista de apostas
2. marca como ganha, perdida, cashout ou void
3. payout e ledger são atualizados
4. métricas são recalculadas

### Fluxo 4: auditar saldo
1. usuário entra em `Bancas & Casas`
2. escolhe uma casa
3. vê o ledger da conta
4. confere lançamentos e saldo acumulado

## 11. Pontos de atenção atuais

- App Check ainda não está ativado
- Functions precisam de atualização futura de runtime/dependências
- relatórios exportáveis ainda podem evoluir
- recomendações IA ainda exigem melhoria contínua em confiança e priorização

## 12. Resumo executivo

Hoje o Banca+ já funciona como:

- gestor de banca
- registrador de apostas
- conciliador financeiro por casa
- leitor OCR de bilhetes
- camada inicial de inteligência operacional

Os diferenciais atuais do produto são:

- ledger por casa
- OCR integrado ao fluxo de nova aposta
- análise e sugestões apoiadas por IA
- interface pensada para operação contínua
