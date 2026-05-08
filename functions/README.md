# OCR e feeds externos

Este diretório concentra integrações sensíveis em Firebase Functions, mantendo chaves fora do frontend.

## O que existe

- `parseBetSlipFromStorage`: callable function autenticada.
- `searchSportsFixturesCallable`: consulta fixtures esportivas via provedor externo.
- `getSportsFixtureResultCallable`: consulta placar/status de fixture específica.
- `fetchTeamNewsCallable`: consulta notícias esportivas por time.
- Validação de ownership do arquivo no Storage (`users/{uid}/bet-slips/...`).
- Download seguro da imagem via Admin SDK.
- Cliente Anthropic Vision com resposta estruturada em JSON Schema.
- Contratos tipados, validação de payload, timeout e cache em memória para feeds externos.

## Entrada esperada

```json
{
  "storagePath": "users/<uid>/bet-slips/<arquivo>.png",
  "mimeType": "image/png",
  "source": "upload"
}
```

## Resposta resumida

```json
{
  "requestId": "msg_xxx",
  "status": "success",
  "provider": "anthropic",
  "slip": {
    "storagePath": "users/<uid>/bet-slips/<arquivo>.png",
    "contentType": "image/png",
    "sizeBytes": 182736
  },
  "fields": {
    "eventName": { "value": "Real Madrid x Manchester City", "confidence": 0.94 },
    "stake": { "value": 250, "confidence": 0.98 },
    "odds": { "value": 1.92, "confidence": 0.97 }
  },
  "reviewFlags": []
}
```

## Configuracao

1. Instalar dependencias dentro de `functions/`:
   - `npm install`
2. Configurar o secret exigido pela function:
   - `firebase functions:secrets:set ANTHROPIC_API_KEY`
   - `firebase functions:secrets:set APISPORTS_API_KEY`
   - `firebase functions:secrets:set GNEWS_API_KEY`
3. Definir o modelo da Anthropic em ambiente da function:
   - `ANTHROPIC_OCR_MODEL=claude-sonnet-4-6`
4. Deployar as functions para disponibilizar os callables novos:
   - `firebase deploy --only functions`

## Lacunas intencionais

- O parser devolve estrutura pronta, mas a calibracao do prompt e os limiares de confianca vao precisar ajuste com bilhetes reais.
- A camada esportiva atual cobre busca de fixture, resultado e notícias; histórico, tabela, odds e H2H continuam como próximo passo natural nesta mesma borda.
