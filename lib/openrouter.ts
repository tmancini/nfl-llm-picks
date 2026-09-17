export type ChatMessage = { role: "system" | "user"; content: string };

export type OpenRouterRequest = {
  model: string;
  messages: ChatMessage[];
  temperature: number;
  max_tokens?: number;
  response_format?: {
    type: "json_schema";
    json_schema: {
      name: string;
      strict: boolean;
      schema: Record<string, unknown>;
    };
  };
};

export type OpenRouterClient = {
  complete: (model: string, system: string, user: string) => Promise<string>;
};

export const PICKS_JSON_SCHEMA = {
  name: "nfl_picks",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["picks"],
    properties: {
      picks: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["gameId", "winner", "rationale"],
          properties: {
            gameId: { type: "string" },
            winner: { type: "string" },
            rationale: { type: "string" },
          },
        },
      },
    },
  },
} as const;

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export function createOpenRouterClient(
  apiKey: string,
  fetcher: typeof fetch = fetch,
): OpenRouterClient {
  return {
    async complete(model, system, user) {
      const body: OpenRouterRequest = {
        model,
        temperature: 0,
        max_tokens: 4000,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: {
          type: "json_schema",
          json_schema: PICKS_JSON_SCHEMA,
        },
      };
      const res = await fetcher(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://github.com/thomas-ellisai/nfl-llm-picks",
          "X-Title": "NFLLM",
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`OpenRouter ${res.status} for ${model}: ${text.slice(0, 400)}`);
      }
      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = json.choices?.[0]?.message?.content;
      if (!content) throw new Error(`OpenRouter returned empty content for ${model}`);
      return content;
    },
  };
}
