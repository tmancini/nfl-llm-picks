import type { ModelDef } from "./types";

/**
 * Pin exact OpenRouter slugs (never `:latest`) so a week's record stays comparable.
 *
 * Google: checked 2026-09-14. `google/gemini-3.1-pro-preview` exists but is
 * still preview. The plan only swaps if 3.x Pro is stable, so keep 2.5 Pro.
 */
export const MODELS: readonly ModelDef[] = [
  { id: "openai/gpt-5.6-sol", label: "GPT-5.6 Sol", shortLabel: "Sol" },
  { id: "anthropic/claude-opus-5", label: "Claude Opus 5", shortLabel: "Opus" },
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro", shortLabel: "Gemini" },
  { id: "x-ai/grok-4.6", label: "Grok 4.6", shortLabel: "Grok" },
] as const;

export const MODEL_IDS = MODELS.map((model) => model.id);

export const MODEL_SHORT: Record<string, string> = Object.fromEntries(
  MODELS.map((model) => [model.id, model.shortLabel]),
);

export const MAX_LOCK_ATTEMPTS = 2;
export const MAX_MODELS_PER_LOCK = MODELS.length;
