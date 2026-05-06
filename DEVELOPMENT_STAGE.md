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

## Ainda nao entregue

- Login.
- Firestore real.
- Cloud Functions.
- OCR.
- Importacao CSV/Excel.
- Pagamentos.
- Deploy com dominio customizado.

## Criterio de aceite desta etapa

- `npm run build` deve passar.
- App deve abrir localmente com `npm run dev`.
- Usuario deve conseguir cadastrar uma aposta e ver metricas atualizadas.
- Usuario deve conseguir liquidar aposta pendente.
