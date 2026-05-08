# Prompt - Validacao Completa da Plataforma Banca+

Use este prompt para executar uma validacao completa, ponta a ponta, da plataforma `Banca+`.

Objetivo:
- identificar o que esta funcionando de fato
- identificar o que existe no codigo mas nao funciona
- identificar o que existe no codigo mas nao esta habilitado
- identificar o que depende de configuracao externa/manual
- identificar regressao visual, funcional, tecnica e operacional
- gerar um relatorio final acionavel

## Prompt

Atue como um QA Lead Senior + Product Engineer + Auditor Tecnico de Software.

Sua tarefa e executar uma validacao completa da plataforma `Banca+`, do inicio ao fim, como se estivesse auditando um SaaS em pre-producao que precisa provar readiness operacional.

Voce deve avaliar a ferramenta em 4 camadas:

1. Funcional
2. Tecnica
3. Produto/UI/UX
4. Operacional/infraestrutura

Sua analise precisa separar claramente:

- o que funciona hoje
- o que esta parcialmente funcionando
- o que existe no codigo mas nao funciona na pratica
- o que existe no codigo mas depende de configuracao/manual externo
- o que esta desabilitado
- o que esta com comportamento incoerente
- o que ainda precisa de ajuste para producao real

## Escopo da validacao

Valide a plataforma inteira, incluindo:

### 1. Acesso e onboarding
- fluxo de autenticacao
- login Google
- modo local/demo
- onboarding inicial
- criacao de banca
- criacao de casas no onboarding
- migracao de estados antigos/mockados

### 2. Dashboard
- saldo
- saldo operacional
- capital monitorado
- exposicao aberta
- ROI
- CLV
- acerto
- graficos
- cards
- estados vazios
- consistencia numerica entre dashboard e demais telas

### 3. Nova aposta
- abertura do modal
- preenchimento manual
- selecao de casa
- selecao de estrategia
- validacoes de stake/odd
- fechamento do modal
- persistencia de rascunho
- submit
- criacao real da aposta
- reflexo em saldo, ledger e dashboard

### 4. OCR de bilhetes
- upload da imagem
- envio para storage
- leitura OCR
- pre-preenchimento dos campos
- feedback visual
- estados de erro
- comportamento sem login/autenticacao
- congelamento do modal
- reabertura do modal com draft OCR
- persistencia dos metadados OCR

### 5. Lista de apostas
- filtros
- busca
- leitura da grade
- colunas financeiras
- menu de acoes
- liquidacao como ganha
- liquidacao como perdida
- cashout
- void
- exclusao
- consistencia dos valores apos cada acao

### 6. Bancas e casas
- cadastro de casa
- edicao
- remocao
- bloqueio por historico
- deposito
- saque
- transferencia
- ajuste
- leitura do ledger
- reconciliacao de saldo

### 7. Estrategias
- cadastro
- associacao com aposta
- ativacao/pausa
- reflexo visual

### 8. Inteligencia / IA
- tela de inteligencia
- insights
- sugestoes IA
- transformacao de sugestao em aposta
- dados esportivos
- noticias/contexto de time
- o que esta funcional de verdade
- o que e apenas scaffold/interface

### 9. Importacao / exportacao
- importar apostas
- validacao do CSV
- impacto no ledger
- exportacao CSV

### 10. Configuracoes
- edicao do nome da banca
- edicao do saldo inicial de referencia
- risco
- sincronizacao com nuvem
- comportamento apos refresh

### 11. Persistencia e sincronizacao
- persistencia local
- persistencia em nuvem
- criterio de reconciliacao local vs cloud
- comportamento apos F5
- comportamento apos logout/login

### 12. Seguranca e infraestrutura
- Firebase Auth
- Firestore
- Storage
- Functions
- App Check
- secrets
- regras de acesso
- dependencias externas necessarias
- o que impede readiness real de producao

## Metodo de execucao

Execute a validacao em ordem operacional:

1. Primeiro acesso
2. Onboarding
3. Cadastro de casas
4. Nova aposta manual
5. Nova aposta via OCR
6. Liquidacao de aposta
7. Consulta de ledger
8. Navegacao completa entre telas
9. Refresh do navegador
10. Logout/login
11. Sincronizacao cloud
12. Fluxos IA

Durante a validacao:

- confronte o comportamento da interface com o codigo
- marque divergencias entre UI e regra de negocio
- destaque bugs reproduziveis
- identifique validacoes faltantes
- identifique dependencias externas nao configuradas
- identifique itens que so funcionam com dados/mock/config manual

## Formato obrigatorio do relatorio final

Entregue o resultado exatamente nesta estrutura:

### 1. Resumo executivo
- status geral da plataforma
- nivel de maturidade atual
- readiness para producao: `sim`, `parcial`, ou `nao`

### 2. O que esta funcionando hoje
Lista objetiva por modulo.

### 3. O que esta no codigo mas nao funciona
Para cada item:
- modulo
- comportamento esperado
- comportamento real
- causa provavel

### 4. O que existe mas nao esta habilitado
Itens implementados mas dependentes de:
- secret
- function
- provider externo
- regra
- feature flag
- configuracao manual

### 5. O que esta parcialmente funcionando
Para cada item:
- o que funciona
- o que falha
- risco gerado

### 6. Bugs encontrados
Para cada bug:
- titulo
- severidade: `critico`, `alto`, `medio`, `baixo`
- passos para reproduzir
- resultado atual
- resultado esperado

### 7. Ajustes manuais pendentes
Liste tudo que depende de acao manual fora do codigo:
- Firebase
- secrets
- providers
- billing
- auth
- regras
- deploy

### 8. Pendencias para producao real
Liste o que ainda falta para considerar o produto pronto para uso real.

### 9. Recomendacao priorizada
Organize em:
- corrigir imediatamente
- corrigir nesta sprint
- evolucao posterior

## Regras importantes

- Nao assuma que porque existe tela, existe funcionalidade real.
- Nao assuma que porque existe codigo, a feature esta operacional.
- Nao assuma que porque existe deploy, a feature esta configurada corretamente.
- Valide comportamento real, integracao real e consistencia real.
- Seja rigoroso com saldo, ledger, OCR, IA, sync e UX operacional.
- Quando houver duvida, classifique como `parcial` e explique por que.

## Resultado esperado

Ao final, quero um diagnostico brutalmente honesto da plataforma:

- o que ja esta confiavel
- o que parece pronto mas nao esta
- o que ainda esta incompleto
- o que precisa de configuracao
- o que bloqueia producao real

