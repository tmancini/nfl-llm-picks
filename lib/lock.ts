import { MODELS, MAX_LOCK_ATTEMPTS } from "./models";
import { emptyRecord, gradeWeekFile } from "./grade";
import { parsePicksPayload, validatePicks } from "./picks";
import { INDEPENDENT_SYSTEM_PROMPT, SYSTEM_PROMPT, userPrompt, type PromptMode } from "./prompt";
import { minimalGameContexts, type GameContext } from "./context";
import type { OpenRouterClient } from "./openrouter";
import type { Game, Pick, WeekFile } from "./types";
import { nowIso } from "./time";

export function weekHasPicks(week: WeekFile): boolean {
  if (week.source !== "openrouter") return false;
  return week.models.every((model) => (week.picks[model.id] ?? []).length > 0);
}

export function scaffoldWeekFile(season: number, week: number, games: Game[]): WeekFile {
  const picks: WeekFile["picks"] = {};
  const records: WeekFile["records"] = {};
  for (const model of MODELS) {
    picks[model.id] = [];
    records[model.id] = emptyRecord(games.length);
  }
  return gradeWeekFile({
    season,
    week,
    source: "slate",
    lockedAt: null,
    gradedAt: null,
    models: [...MODELS],
    games,
    picks,
    records,
  });
}

export async function lockModelPicks(
  client: OpenRouterClient,
  modelId: string,
  season: number,
  week: number,
  games: Game[],
  contexts: GameContext[],
  maxAttempts = MAX_LOCK_ATTEMPTS,
  mode: PromptMode = "market",
): Promise<Pick[]> {
  const system = mode === "independent" ? INDEPENDENT_SYSTEM_PROMPT : SYSTEM_PROMPT;
  // Gemini twice returned truncated 16-game sets; smaller independent batches
  // keep its response within the output budget without increasing the call cap.
  const batches = mode === "independent" && modelId.startsWith("google/") && contexts.length > 8
    ? [contexts.slice(0, 8), contexts.slice(8)]
    : [contexts];
  const picks: Pick[] = [];
  for (const batch of batches) {
    const batchIds = new Set(batch.map((game) => game.id));
    const batchGames = games.filter((game) => batchIds.has(game.id));
    const user = userPrompt(season, week, batch, mode);
    const attempts = batches.length > 1 ? 1 : maxAttempts;
    let lastError: unknown;
    let valid: Pick[] | null = null;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        const raw = await client.complete(modelId, system, user);
        valid = validatePicks(batchGames, parsePicksPayload(raw));
        break;
      } catch (error) {
        lastError = error;
        console.warn(
          `${modelId} attempt ${attempt}/${attempts} unusable: ${String(error)}`,
        );
      }
    }
    if (!valid) {
      throw new Error(
        `No usable pick set from ${modelId} after ${attempts} attempt(s): ${String(lastError)}`,
      );
    }
    picks.push(...valid);
  }
  return validatePicks(games, picks);
}

export async function applyLocks(
  week: WeekFile,
  client: OpenRouterClient,
  contexts?: GameContext[],
  onModelLocked?: (partial: WeekFile) => void | Promise<void>,
  mode: PromptMode = "market",
): Promise<WeekFile> {
  if (weekHasPicks(week)) return week;
  const promptGames = contexts ?? minimalGameContexts(week.games);
  const next: WeekFile = {
    ...week,
    picks: { ...week.picks },
    models: [...MODELS],
  };
  for (const model of MODELS) {
    if ((next.picks[model.id] ?? []).length > 0 && week.source === "openrouter") {
      continue;
    }
    next.picks[model.id] = await lockModelPicks(
      client,
      model.id,
      week.season,
      week.week,
      week.games,
      promptGames,
      MAX_LOCK_ATTEMPTS,
      mode,
    );
    if (onModelLocked) {
      await onModelLocked(gradeWeekFile({ ...next, source: "openrouter" }));
    }
  }
  next.lockedAt = nowIso();
  next.source = "openrouter";
  return gradeWeekFile(next);
}

export function applyFixturePicks(week: WeekFile): WeekFile {
  const picks: WeekFile["picks"] = {};
  for (const [modelIndex, model] of MODELS.entries()) {
    picks[model.id] = week.games.map((game, gameIndex) => ({
      gameId: game.id,
      winner: (gameIndex + modelIndex) % 2 === 0 ? game.home : game.away,
      rationale: "Sample pick — OpenRouter was not configured.",
    }));
  }
  return gradeWeekFile({
    ...week,
    source: "fixture",
    lockedAt: nowIso(),
    picks,
  });
}
