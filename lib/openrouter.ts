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
const MAX_REQUESTS_PER_LOCK = 8;

/** Reject uncapped or shared keys before the first paid request. */
export async function assertCappedOpenRouterKey(
  apiKey: string,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  const response = await fetcher("https://openrouter.ai/api/v1/key", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!response.ok) throw new Error(`OpenRouter key check failed: HTTP ${response.status}`);
  const payload = (await response.json()) as {
    data?: { limit?: number | null; limit_reset?: string | null };
  };
  const { limit, limit_reset: reset } = payload.data ?? {};
  if (reset !== "daily" || typeof limit !== "number" || limit <= 0 || limit > 1) {
    throw new Error("OpenRouter key must have a daily spending limit of $1 or less");
  }
}

export function createOpenRouterClient(
  apiKey: string,
  fetcher: typeof fetch = fetch,
): OpenRouterClient {
  let requestCount = 0;
  return {
    async complete(model, system, user) {
      if (requestCount >= MAX_REQUESTS_PER_LOCK) {
        throw new Error(`OpenRouter request cap reached (${MAX_REQUESTS_PER_LOCK})`);
      }
      requestCount += 1;
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
