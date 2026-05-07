# OCR scaffold para bilhetes

Este diretório prepara o backend Firebase Functions para OCR de bilhetes sem acoplar a implementação ao frontend agora.

## O que existe

- `parseBetSlipFromStorage`: callable function autenticada.
- Validação de ownership do arquivo no Storage (`users/{uid}/bet-slips/...`).
- Download seguro da imagem via Admin SDK.
- Cliente Anthropic Vision com resposta estruturada em JSON Schema.
- Contrato tipado e normalização para o frontend consumir depois.

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
3. Definir o modelo da Anthropic em ambiente da function:
   - `ANTHROPIC_OCR_MODEL=claude-sonnet-4-6`

## Lacunas intencionais

- O frontend ainda nao chama essa function nem preenche `NewBet` com a resposta.
- `firebase.json` ainda nao aponta para `functions/`; isso ficou fora do escopo pedido.
- O parser devolve estrutura pronta, mas a calibracao do prompt e os limiares de confianca vao precisar ajuste com bilhetes reais.
