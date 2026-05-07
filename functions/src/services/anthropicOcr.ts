import type { ProviderOcrPayload, SlipImagePayload } from "../contracts/ocr.js";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-sonnet-4-6";

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    rawText: { type: ["string", "null"] },
    fields: {
      type: "object",
      properties: {
        eventName: fieldSchema("string"),
        eventAtIso: fieldSchema("string"),
        sport: fieldSchema("string"),
        league: fieldSchema("string"),
        market: fieldSchema("string"),
        selection: fieldSchema("string"),
        bookmakerName: fieldSchema("string"),
        stake: fieldSchema("number"),
        odds: fieldSchema("number"),
        mode: {
          type: "object",
          properties: {
            value: {
              anyOf: [{ type: "string", enum: ["prelive", "live"] }, { type: "null" }],
            },
            confidence: { type: ["number", "null"] },
            sourceText: { type: ["string", "null"] },
          },
          required: ["value", "confidence", "sourceText"],
          additionalProperties: false,
        },
      },
      required: [
        "eventName",
        "eventAtIso",
        "sport",
        "league",
        "market",
        "selection",
        "bookmakerName",
        "stake",
        "odds",
        "mode",
      ],
      additionalProperties: false,
    },
  },
  required: ["rawText", "fields"],
  additionalProperties: false,
} as const;

export class AnthropicOcrClient {
  constructor(
    private readonly apiKey: string | undefined,
    private readonly model = process.env.ANTHROPIC_OCR_MODEL || DEFAULT_MODEL,
  ) {}

  isConfigured() {
    return Boolean(this.apiKey && this.model);
  }

  async extractSlip(image: SlipImagePayload): Promise<{ requestId: string; payload: ProviderOcrPayload }> {
    if (!this.apiKey) {
      throw new Error("ANTHROPIC_API_KEY is not configured.");
    }

    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 1200,
        temperature: 0,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: image.contentType,
                  data: image.base64,
                },
              },
              {
                type: "text",
                text: buildPrompt(),
              },
            ],
          },
        ],
        output_config: {
          format: {
            type: "json_schema",
            schema: OUTPUT_SCHEMA,
          },
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Anthropic request failed with ${response.status}: ${errorBody}`);
    }

    const body = (await response.json()) as AnthropicMessagesResponse;
    const textBlock = body.content.find(isTextBlock);
    if (!textBlock?.text) {
      throw new Error("Anthropic response did not contain a text block.");
    }

    return {
      requestId: body.id,
      payload: JSON.parse(textBlock.text) as ProviderOcrPayload,
    };
  }
}

function buildPrompt() {
  return [
    "Leia o bilhete de aposta da imagem e extraia os campos estruturados.",
    "Use null quando um campo nao estiver legivel ou nao existir.",
    "Retorne datas em ISO 8601 quando for possivel inferir ano, mes, dia e horario.",
    "Se o bilhete indicar aposta ao vivo, use mode=live; caso contrario use prelive.",
    "Nao invente bookmaker, stake ou odd quando estiver ambiguo.",
  ].join(" ");
}

function fieldSchema(type: "string" | "number") {
  return {
    type: "object",
    properties: {
      value: { type: [type, "null"] },
      confidence: { type: ["number", "null"] },
      sourceText: { type: ["string", "null"] },
    },
    required: ["value", "confidence", "sourceText"],
    additionalProperties: false,
  };
}

interface AnthropicTextBlock {
  type: "text";
  text: string;
}

interface AnthropicMessagesResponse {
  id: string;
  content: Array<AnthropicTextBlock | { type: string }>;
}

function isTextBlock(block: AnthropicTextBlock | { type: string }): block is AnthropicTextBlock {
  return block.type === "text";
}
