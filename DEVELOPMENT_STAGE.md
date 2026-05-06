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
- Snapshot de estado no Firestore por usuario.
- Carregamento de snapshot do Firestore.
- Exportacao CSV das apostas.
- Importacao CSV das apostas.
- Primeiro sistema visual de marca: logo SVG, favicon e guia visual.

## Ainda nao entregue

- Login real por email/Google.
- Cloud Functions.
- OCR.
- Importacao CSV/Excel.
- Importacao Excel.
- Pagamentos.
- Deploy com dominio customizado.

## Criterio de aceite desta etapa

- `npm run build` deve passar.
- App deve abrir localmente com `npm run dev`.
- Usuario deve conseguir cadastrar uma aposta e ver metricas atualizadas.
- Usuario deve conseguir liquidar aposta pendente.
- Usuario deve conseguir exportar CSV.
- Usuario deve conseguir importar CSV exportado pelo Banca+.
- Usuario deve conseguir conectar via Auth anonimo e salvar/carregar snapshot no Firestore, desde que Auth/Firestore estejam habilitados no Firebase.
