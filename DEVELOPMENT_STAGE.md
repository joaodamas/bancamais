# Banca+ - Etapa 1

## Objetivo

Transformar o prototipo estatico em uma base de produto executavel, com dominio de dados, calculos reais e fundacao para Firebase.

## Entregue

- App React/TypeScript criado.
- Configuracao Vite.
- Configuracao Firebase Hosting.
- Regras iniciais de Firestore e Storage.
- Variaveis Firebase documentadas em `.env.example`.
- Dados seedados do prototipo.
- Modelos: banca, casa, aposta, estrategia e transacao.
- Calculos: saldo, exposicao, lucro, ROI, yield, taxa de acerto, odd media e CLV.
- Dashboard funcional.
- Lista de apostas funcional.
- Cadastro manual de aposta.
- Liquidacao rapida de aposta pendente.
- Persistencia demo via `localStorage`.
- Firebase Auth anonimo opcional.
- Firebase Auth com email/senha.
- Recuperacao de senha por email.
- Snapshot de estado no Firestore por usuario.
- Carregamento de snapshot do Firestore.
- Exportacao CSV das apostas.
- Importacao CSV das apostas.
- Primeiro sistema visual de marca: logo SVG, favicon e guia visual.
- Relatorios basicos: mensal, fiscal e base de pagina publica tipster.
- Registro de movimentacoes financeiras por casa: deposito, saque, transferencia e ajuste.
- Gestao de estrategias com metricas reais por metodo.
- Alertas basicos de risco no dashboard.
- Configuracao de limites de risco: unidade, stake maxima, exposicao aberta e perdas seguidas.
- Revisao visual baseada nas telas do prototipo.
- Navegacao lateral agrupada e topbar com busca visual.
- Telas dedicadas de Inteligencia e CLV & Edge.
- Botao flutuante para nova aposta.

## Ainda nao entregue

- Login Google.
- Cloud Functions.
- OCR.
- Importacao CSV/Excel.
- Importacao Excel.
- Pagamentos.
- Deploy com dominio customizado.
- PDF real dos relatorios.
- Ledger contabil completo com auditoria.
- Lockout/cooldown baseado nos limites configurados.
- Busca global funcional.
- Graficos mais fieis ao prototipo.

## Criterio de aceite desta etapa

- `npm run build` deve passar.
- App deve abrir localmente com `npm run dev`.
- Usuario deve conseguir cadastrar uma aposta e ver metricas atualizadas.
- Usuario deve conseguir liquidar aposta pendente.
- Usuario deve conseguir exportar CSV.
- Usuario deve conseguir importar CSV exportado pelo Banca+.
- Usuario deve conseguir acessar relatorios e exportar bases mensal/fiscal.
- Usuario deve conseguir criar conta, entrar e recuperar senha se Firebase Auth estiver habilitado.
- Usuario deve conseguir registrar transacoes e ver saldos das casas atualizados.
- Usuario deve conseguir criar, pausar e reativar estrategias.
- Dashboard deve exibir alertas de risco quando houver exposicao elevada, stake acima da unidade ou sequencia negativa.
- Usuario deve conseguir ajustar os limites que disparam alertas de risco.
- Usuario deve conseguir acessar Inteligencia e CLV em telas separadas.
- Usuario deve conseguir conectar via Auth anonimo e salvar/carregar snapshot no Firestore, desde que Auth/Firestore estejam habilitados no Firebase.
