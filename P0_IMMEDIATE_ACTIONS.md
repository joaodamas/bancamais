# Banca+ - P0 Immediate Actions

_Atualizado em 2026-05-07._

## Objetivo

Fechar os bloqueios que hoje impedem o Banca+ de ser tratado como produto operacional confiavel em producao real.

## Escopo P0

### 1. Corrigir a semantica de "modo demo local"

**Problema**
- A interface comunica modo local/demo.
- A implementacao atual depende de autenticacao anonima no Firebase.

**Ajuste**
- Escolher uma das duas direcoes:
  - virar de fato um modo local offline
  - ou renomear para sessao anonima em nuvem

**Impacto**
- elimina ambiguidade de produto
- reduz suporte e erro de expectativa

**Status**
- concluido na interface atual via renomeacao para sessao temporaria/anônima

### 2. Proteger `pullCloud()` contra overwrite cego

**Problema**
- hoje o carregamento manual da nuvem pode sobrescrever estado local mais recente.

**Ajuste**
- comparar `lastModifiedAt` local vs cloud antes de aplicar
- quando houver conflito, exigir confirmacao explicita
- idealmente mostrar qual lado e mais recente

**Impacto**
- reduz risco de perda de dados
- melhora confianca em sync manual

### 3. Definir o destino do cooldown de risco

**Problema**
- a logica ainda existe no dominio
- a UX de bloqueio foi desmontada parcialmente

**Ajuste**
- escolher uma direcao unica:
  - reativar com UX clara e nao invasiva
  - ou remover cooldown do dominio, das mensagens e do checklist funcional

**Impacto**
- elimina regra fantasma
- evita comportamento incoerente no registro de aposta

**Status**
- concluido via remocao do cooldown do dominio, persistencia e superficies de UI

### 4. Ativar App Check

**Problema**
- o projeto segue sem App Check habilitado.

**Ajuste**
- ativar em:
  - Hosting
  - Functions
  - Firestore
  - Storage
- frontend ja preparado para inicializacao opcional via env vars em `src/lib/firebase.ts`
- ainda falta a parte externa: site key, enforcement por produto e validacao por ambiente

**Impacto**
- endurece protecao basica contra abuso
- eleva readiness real de producao

### 5. Consolidar o ledger como fonte primaria de verdade

**Problema**
- o sistema ainda opera com estado hibrido:
  - saldo salvo na casa
  - saldo derivado do ledger

**Ajuste**
- mover o app para leitura prioritaria do saldo derivado
- reduzir `bookmakers[].balance` para papel transitorio ou removivel
- revisar exclusao, cashout, void e importacao sob essa regra

**Impacto**
- reduz drift de saldo
- melhora auditabilidade
- simplifica leitura financeira entre telas

**Status**
- concluido via reconciliacao centralizada do ledger no `updateState()` e uso de saldo derivado nas validacoes operacionais

### 6. Ligar ou remover o sync em tempo real

**Problema**
- existe hook de Firestore realtime no codigo, mas ele nao esta ligado no app.

**Ajuste**
- ou ativar `useFirestoreSync`
- ou remover o hook e a expectativa de capacidade live

**Impacto**
- reduz codigo morto
- elimina gap entre promessa tecnica e entrega real

**Status**
- concluido via ativacao de `useFirestoreSync` no `App`, com aplicacao remota conservadora baseada em `lastModifiedAt` e sem restampar snapshots vindos da nuvem

### 7. Reclassificar a superficie de IA/Sugestoes

**Problema**
- parte da UI de sugestoes parece pronta, mas ainda usa scaffold/offline em trechos relevantes.

**Ajuste**
- diferenciar visualmente:
  - insight local
  - sugestao real
  - scaffold operacional
- nao tratar a camada atual como motor confiavel de recomendacao ainda

**Impacto**
- protege percepcao do produto
- reduz risco de overpromise funcional

## Ordem recomendada de execucao

1. `pullCloud()` com protecao de conflito
2. semantica correta de `modo demo local`
3. decisao final sobre cooldown
4. App Check
5. ledger como verdade principal
6. sync realtime ligado ou removido
7. clareza visual da camada de IA

## Criterio de saida do P0

O P0 pode ser considerado fechado quando:

- nao houver mais risco obvio de sobrescrita cega de estado
- o fluxo demo/local estiver semanticamente correto
- o cooldown nao existir de forma incoerente
- App Check estiver ativo
- saldo principal vier de uma regra financeira unica e defensavel
- sync realtime nao estiver mais em estado fantasma
- IA/sugestoes nao venderem maturidade maior do que a entrega real
