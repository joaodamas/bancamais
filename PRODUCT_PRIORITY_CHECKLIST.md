# Banca+ - Checklist de Prioridades

_Atualizado em 2026-05-07 22:11:00 a partir da auditoria funcional/tecnica._

## Prioridade 0 - Bloqueios de confianca operacional

- [x] Corrigir a semantica de `modo demo local`: hoje a UI vende modo local, mas a implementacao depende de autenticacao anonima no Firebase.
- [x] Definir politica final de cooldown de risco: reativar com UX coerente ou remover a feature do dominio e da interface.
- [x] Proteger `pullCloud()` contra sobrescrita cega de estado local mais recente.
- [ ] Ativar `App Check` em Hosting, Functions, Firestore e Storage.
  - frontend preparado em `src/lib/firebase.ts` para `recaptcha-v3` ou `enterprise` via env vars
  - pendente: chaves/site keys, enforcement no console e validacao final por ambiente
- [x] Fechar a divergencia entre saldo salvo e saldo derivado para consolidar o ledger como fonte primaria de verdade.

## Prioridade 1 - Fundacao financeira e persistencia

- [x] Corrigir a leitura da banca quando o usuario ainda nao cadastrou casas.
- [x] Debitar stake da casa ao registrar aposta.
- [x] Creditar retorno/refund ao liquidar aposta.
- [x] Registrar movimentacoes automaticas de stake e liquidacao no ledger.
- [x] Corrigir transferencias para refletirem nas duas casas.
- [x] Remover dupla contagem financeira da curva de banca.
- [x] Conciliar onboarding inicial com o ledger para evitar drift nas casas.
- [x] Alimentar o ledger na importacao CSV de apostas.
- [x] Evitar perda de alteracoes no refresh priorizando a versao mais recente entre local e nuvem.
- [x] Permitir editar nome da banca e saldo inicial de referencia pela interface.
- [x] Transformar o ledger em fonte unica de verdade, reduzindo dependencia de `bookmakers[].balance`.
- [ ] Revisar consistencia numerica entre dashboard, casas e lista de apostas com casos de void, cashout e exclusao.
- [ ] Definir politica de merge entre estado local, cloud e updates remotos em multiplos dispositivos.

## Prioridade 2 - OCR de bilhetes

- [x] Criar backend seguro para OCR via Firebase Functions.
- [x] Guardar chave da Anthropic apenas em secret/env da Function.
- [x] Implementar extracao OCR para evento, data, mercado, selecao, odd, stake e casa.
- [x] Integrar OCR ao frontend para pre-preenchimento de `NewBet`.
- [x] Transformar `NewBet` em formulario controlado para receber preenchimento automatico.
- [x] Exibir confianca e alertas de revisao dos campos extraidos.
- [x] Salvar metadados do OCR junto da aposta.
- [x] Preservar rascunho e leitura OCR ao fechar e reabrir o modal de nova aposta.
- [x] Validar que o OCR esta funcional no ambiente atual.
- [ ] Adicionar trilha minima de auditoria para falhas de OCR, timeout e parsing ruim.
- [ ] Melhorar UX de indisponibilidade quando auth/function/provider externo nao estiverem disponiveis.

## Prioridade 3 - IA, sugestoes e dados esportivos

- [x] Criar modelo de dados para jogos futuros, times, odds e sugestoes.
- [x] Mover consultas esportivas sensiveis para backend.
- [x] Permitir transformar uma sugestao em nova aposta pre-preenchida.
- [x] Medir performance basica das sugestoes aceitas pelo usuario.
- [ ] Substituir scaffold/offline atual por pipeline real de fixtures, odds, contexto e publicacao de sugestoes.
- [ ] Diferenciar claramente na UI o que e insight local, o que e sugestao real e o que ainda e demonstracao operacional.
- [ ] Revisar confianca, ranking e criterio de edge antes de tratar a camada de sugestoes como recurso confiavel de producao.
- [ ] Garantir fallback explicito quando providers externos estiverem indisponiveis.

## Prioridade 4 - Sync, auth e operacao multi-dispositivo

- [x] Adicionar login Google.
- [x] Persistir estado local e em nuvem por usuario autenticado.
- [x] Ligar `useFirestoreSync` no app com politica conservadora por `lastModifiedAt`, evitando overwrite de mudancas locais mais recentes.
- [ ] Revisar logout/login para nao confundir sessao anonima com modo local permanente.
- [ ] Mapear readiness real dos providers de Auth: email/senha, Google e anonimo.

## Prioridade 5 - Produto e fluxos funcionais

- [x] Permitir adicionar casas depois do onboarding.
- [x] Permitir editar/remover casas com protecao contra historico.
- [x] Auto-selecionar a unica casa disponivel no modal de nova aposta.
- [x] Preservar rascunho da nova aposta.
- [x] Importar apostas por CSV com validacao basica.
- [x] Exportar apostas por CSV.
- [ ] Melhorar importacao CSV com mapeamento/criacao assistida de casas ausentes.
- [ ] Validar ponta a ponta os fluxos reais com smoke manual estruturado:
  - onboarding
  - nova aposta manual
  - nova aposta OCR
  - liquidacao
  - ledger
  - refresh
  - logout/login
  - cloud sync

## Prioridade 6 - UI/UX e confianca de produto

- [x] Reorganizar `NewBet` em secoes mais operacionais.
- [x] Redesenhar Dashboard, Apostas, Relatorios, Books e Configuracoes para linguagem mais profissional.
- [x] Alinhar a UI principal ao modelo mental das casas: saldo liquido em destaque e capital aberto separado.
- [x] Despoluir a lista de apostas com performance consolidada e menu contextual de acoes.
- [x] Refinar responsividade, skeletons e transicoes das superficies principais.
- [ ] Reduzir ambiguidades de linguagem operacional:
  - `modo demo local`
  - `saldo` vs `capital monitorado`
  - recursos que dependem de provider externo
- [ ] Revisar indicadores visuais para recursos parciais/scaffold, especialmente na tela de Inteligencia.

## Prioridade 7 - Seguranca e governanca

- [x] Tirar chaves sensiveis do frontend e mover consumo critico para backend.
- [ ] Revisar rules de Firestore e Storage com cenarios de abuso, isolamento e volume.
- [ ] Padronizar secrets de producao e runbook de rotacao para Anthropic e provedores externos.
- [ ] Adicionar rate limit, validacao de payload e limites operacionais nas entradas criticas.
- [ ] Atualizar runtime/dependencias das Functions para evitar bloqueio futuro de deploy.
- [ ] Criar trilha minima de auditoria para acoes sensiveis:
  - importacao
  - OCR
  - anulacao de transacao
  - exclusao de aposta

## Prioridade 8 - Documentacao, QA e readiness

- [x] Criar documento tecnico-funcional simples da plataforma.
- [x] Criar prompt estruturado para validacao completa ponta a ponta.
- [x] Rodar auditoria funcional/tecnica e registrar diagnostico objetivo.
- [ ] Gerar relatorio versionado de validacao da plataforma com data e status.
- [ ] Criar rotina recorrente de QA com checklist executavel por release.
- [ ] Revisar readiness final para producao real apos fechar os itens de Prioridade 0 e 7.
