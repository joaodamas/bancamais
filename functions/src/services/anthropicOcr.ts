import type { SlipImagePayload } from "../contracts/ocr.js";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-sonnet-4-6";

// Flat schema — zero union types (API limit: 16, this uses 0)
const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    rawText:       { type: "string" },
    eventName:     { type: "string" },
    eventAt:       { type: "string" },
    sport:         { type: "string" },
    league:        { type: "string" },
    market:        { type: "string" },
    selection:     { type: "string" },
    bookmakerName: { type: "string" },
    stake:         { type: "number" },
    odds:          { type: "number" },
    mode:          { type: "string" },
    missingFields:  { type: "array", items: { type: "string" } },
    uncertainFields: { type: "array", items: { type: "string" } },
  },
  required: [
    "rawText", "eventName", "eventAt", "sport", "league",
    "market", "selection", "bookmakerName", "stake", "odds",
    "mode", "missingFields", "uncertainFields",
  ],
  additionalProperties: false,
} as const;

export interface FlatOcrPayload {
  rawText: string;
  eventName: string;
  eventAt: string;
  sport: string;
  league: string;
  market: string;
  selection: string;
  bookmakerName: string;
  stake: number;
  odds: number;
  mode: string;
  missingFields: string[];
  uncertainFields: string[];
}

export class AnthropicOcrClient {
  constructor(
    private readonly apiKey: string | undefined,
    private readonly model = process.env.ANTHROPIC_OCR_MODEL || DEFAULT_MODEL,
  ) {}

  isConfigured() {
    return Boolean(this.apiKey && this.model);
  }

  async extractSlip(image: SlipImagePayload): Promise<{ requestId: string; payload: FlatOcrPayload }> {
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
        tools: [
          {
            name: "extract_bet_slip",
            description: "Extrai campos estruturados de um bilhete de aposta esportiva.",
            input_schema: OUTPUT_SCHEMA,
          },
        ],
        tool_choice: { type: "tool", name: "extract_bet_slip" },
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
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Anthropic request failed with ${response.status}: ${errorBody}`);
    }

    const body = (await response.json()) as AnthropicMessagesResponse;
    const toolUse = body.content.find(isToolUseBlock);

    if (!toolUse) {
      throw new Error("Anthropic response did not contain a tool_use block.");
    }

    return {
      requestId: body.id,
      payload: toolUse.input as FlatOcrPayload,
    };
  }
}

function buildPrompt() {
  return [
    "Leia o bilhete de aposta da imagem e extraia os campos.",
    "Para campos nao encontrados ou ilegíveis, retorne string vazia ou 0 para numeros,",
    "e inclua o nome do campo em missingFields.",
    "Para campos encontrados mas com baixa certeza, inclua o nome em uncertainFields.",
    "eventAt deve ser ISO 8601 (ex: 2025-05-10T20:00:00). mode deve ser 'prelive' ou 'live'.",
    "Nao invente stake ou odds quando estiver ambiguo.",
  ].join(" ");
}

interface AnthropicToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: unknown;
}

interface AnthropicMessagesResponse {
  id: string;
  content: Array<AnthropicToolUseBlock | { type: string }>;
}

function isToolUseBlock(block: AnthropicToolUseBlock | { type: string }): block is AnthropicToolUseBlock {
  return block.type === "tool_use";
}
