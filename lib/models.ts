import type { ModelDef } from "./types";

/**
 * Pin exact OpenRouter slugs (never `:latest`) so a week's record stays comparable.
 *
 * Checked 2026-09-22 against the OpenRouter model catalogue.
 * Use each provider's current flagship text model, rather than the newest
 * lower-tier or image variant. Historical weeks retain their original IDs.
 */
export const MODELS: readonly ModelDef[] = [
  { id: "openai/gpt-6-astra", label: "GPT-6 Astra", shortLabel: "Astra" },
  { id: "anthropic/claude-opus-5.5", label: "Claude Opus 5.5", shortLabel: "Opus" },
  { id: "google/gemini-3.1-pro-preview", label: "Gemini 3.1 Pro", shortLabel: "Gemini" },
  { id: "x-ai/grok-4.7", label: "Grok 4.7", shortLabel: "Grok" },
] as const;

export const MODEL_IDS = MODELS.map((model) => model.id);

export const MODEL_SHORT: Record<string, string> = Object.fromEntries(
  MODELS.map((model) => [model.id, model.shortLabel]),
);

export const MAX_LOCK_ATTEMPTS = 2;
export const MAX_MODELS_PER_LOCK = MODELS.length;
