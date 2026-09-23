import { MODELS, MAX_LOCK_ATTEMPTS } from "./models";
import { emptyRecord, gradeWeekFile } from "./grade";
import { parsePicksPayload, validatePicks } from "./picks";
import { SYSTEM_PROMPT, userPrompt } from "./prompt";
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
): Promise<Pick[]> {
  const user = userPrompt(season, week, contexts);
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const raw = await client.complete(modelId, SYSTEM_PROMPT, user);
      return validatePicks(games, parsePicksPayload(raw));
    } catch (error) {
      lastError = error;
      console.warn(
        `${modelId} attempt ${attempt}/${maxAttempts} unusable: ${String(error)}`,
      );
    }
  }
  throw new Error(
    `No usable pick set from ${modelId} after ${maxAttempts} attempt(s): ${String(lastError)}`,
  );
}

export async function applyLocks(
  week: WeekFile,
  client: OpenRouterClient,
  contexts?: GameContext[],
  onModelLocked?: (partial: WeekFile) => void | Promise<void>,
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
