# Banca+ - Checklist de Prioridades

## Prioridade 1 - Fundacao financeira e usabilidade essencial

- [x] Documentar prioridades do produto em checklist versionado.
- [x] Corrigir a leitura da banca total quando o usuario ainda nao cadastrou casas.
- [x] Debitar a stake da casa ao registrar uma aposta.
- [x] Creditar o retorno na casa ao liquidar aposta ganha ou void.
- [x] Registrar movimentacoes automaticas no historico para stake e liquidacao.
- [x] Permitir adicionar casas de apostas depois do onboarding.
- [x] Permitir editar/remover casas com protecao contra casas com apostas vinculadas.
- [x] Corrigir transferencias para terem reflexo contabil nas duas casas.
- [x] Introduzir saldo derivado e reconciliacao inicial do ledger.
- [x] Remover dupla contagem financeira da curva de banca.
- [x] Conciliar onboarding inicial com o ledger para evitar drift nas casas.
- [x] Alimentar o ledger na importacao CSV de apostas.
- [x] Transformar transacoes em ledger contabil completo e auditavel.
- [x] Criar bloqueios/cooldown quando limites de risco forem ultrapassados.

## Prioridade 2 - OCR de bilhetes

- [x] Criar backend seguro para OCR via Firebase Functions.
- [x] Guardar chave da Anthropic apenas em secret/env da Function.
- [x] Implementar extracao Claude Vision para evento, data, mercado, selecao, odd, stake e casa.
- [x] Integrar OCR ao frontend para pre-preenchimento de `NewBet`.
- [x] Transformar `NewBet` em formulario controlado para receber preenchimento automatico.
- [x] Exibir confianca e alertas de revisao dos campos extraidos.
- [x] Salvar metadados do OCR junto da aposta.

## Prioridade 3 - Sugestoes de apostas com IA

- [x] Criar modelo de dados para jogos futuros, times, odds e sugestoes.
- [x] Mover consultas esportivas sensiveis para backend.
- [x] Buscar historico recente dos times, mando/visitante, confrontos diretos, tabela e odds.
- [x] Calcular probabilidade estimada e edge por mercado.
- [x] Criar tela "Sugestoes IA" com justificativa, risco, odd e fonte dos dados.
- [x] Permitir transformar uma sugestao em nova aposta pre-preenchida.
- [x] Medir performance das sugestoes aceitas pelo usuario.

## Prioridade 4 - Produto e operacao

- [x] Ativar busca global funcional.
- [x] Ligar sincronizacao Firestore em tempo real ou remover hook nao usado.
- [x] Adicionar login Google.
- [ ] Ativar App Check antes de producao.
- [x] Estabelecer uma frente recorrente de QA para smoke test e regressao das entregas.
- [ ] Fazer code splitting para reduzir bundle principal.
- [ ] Criar relatorios PDF/HTML reais.
- [ ] Validar regras fiscais com contador antes de automatizar calculos fiscais.

## Prioridade 5 - UI/UX e confianca de produto

- [x] Remover da interface a maior parte da linguagem de bastidor tecnico e roadmap.
- [x] Reorganizar `NewBet` em secoes mais operacionais.
- [x] Reforcar transparencia da analise automatica com fonte, momento e limites.
- [x] Transformar estados vazios passivos em estados guiados com CTA contextual.
- [x] Unificar linguagem visual de icones e reduzir elementos com cara promocional.
- [x] Refinar telas operacionais com contexto, resumos e leitura mais profissional.
- [x] Migrar paleta para premium fintech escuro (indigo) e ativar Space Grotesk.
- [x] Simplificar tela de Configuracoes removendo formularios de auth duplicados.
- [x] Corrigir cashout — payout e transacao de retorno corretos no ledger.
- [x] Adicionar validacao de odds minimas no registro de aposta.

## Prioridade 6 - Seguranca e governanca

- [x] Tirar chaves sensiveis de esportes/noticias do frontend e mover consumo para backend.
- [ ] Ativar App Check em hosting, functions, firestore e storage.
- [ ] Revisar regras de Firestore e Storage com casos de abuso e isolamento por usuario.
- [ ] Padronizar secrets de producao e runbook de rotacao para Anthropic e provedores externos.
- [ ] Adicionar trilha minima de auditoria para acoes sensiveis e erros de OCR/importacao.
- [ ] Definir limites de upload, rate limit e validacao de payload nas entradas criticas.
