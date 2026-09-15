import type { ModelDef } from "./types";

/**
 * Pin exact OpenRouter slugs (never `:latest`) so a week's record stays comparable.
 *
 * Checked 2026-09-15 against OpenRouter:
 * - OpenAI frontier: GPT-6 Astra (not mid-tier Sol/Luna)
 * - Anthropic frontier: Claude Fable 5.1 (Mythos-class; ahead of Opus 5)
 * - Google Pro-class: Gemini 3.1 Pro Preview (no stable 3.x Pro yet; Flash is not the flagship)
 * - xAI frontier: Grok 4.6 (newest flagship text model)
 */
export const MODELS: readonly ModelDef[] = [
  { id: "openai/gpt-6-astra", label: "GPT-6 Astra", shortLabel: "Astra" },
  { id: "anthropic/claude-fable-5.1", label: "Claude Fable 5.1", shortLabel: "Fable" },
  { id: "google/gemini-3.1-pro-preview", label: "Gemini 3.1 Pro", shortLabel: "Gemini" },
  { id: "x-ai/grok-4.6", label: "Grok 4.6", shortLabel: "Grok" },
] as const;

export const MODEL_IDS = MODELS.map((model) => model.id);

export const MODEL_SHORT: Record<string, string> = Object.fromEntries(
  MODELS.map((model) => [model.id, model.shortLabel]),
);

export const MAX_LOCK_ATTEMPTS = 2;
export const MAX_MODELS_PER_LOCK = MODELS.length;
