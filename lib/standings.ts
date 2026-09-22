import { MODELS } from "./models";
import type { SeasonStanding, WeekFile } from "./types";

export function providerForModel(modelId: string): string {
  return modelId.split("/", 1)[0];
}

export function standingForModel(
  standings: SeasonStanding[],
  modelId: string,
): SeasonStanding | undefined {
  return standings.find((row) => providerForModel(row.modelId) === providerForModel(modelId));
}

export function seasonStandings(weeks: WeekFile[], season?: number): SeasonStanding[] {
  const scoped = season === undefined ? weeks : weeks.filter((week) => week.season === season);
  return MODELS.map((model) => {
    const standing: SeasonStanding = {
      modelId: model.id,
      label: model.label,
      shortLabel: model.shortLabel,
      wins: 0,
      losses: 0,
      pushes: 0,
      pending: 0,
      weeksLocked: 0,
    };
    for (const week of scoped) {
      const historicalModel = week.models.find(
        (entry) => providerForModel(entry.id) === providerForModel(model.id),
      );
      if (!historicalModel) continue;
      const record = week.records[historicalModel.id];
      if (!record) continue;
      standing.wins += record.wins;
      standing.losses += record.losses;
      standing.pushes += record.pushes;
      standing.pending += record.pending;
      if ((week.picks[historicalModel.id] ?? []).length > 0) standing.weeksLocked += 1;
    }
    return standing;
  }).sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (a.losses !== b.losses) return a.losses - b.losses;
    return a.label.localeCompare(b.label);
  });
}

export function formatRecord(standing: {
  wins: number;
  losses: number;
  pushes: number;
}): string {
  if (standing.pushes > 0) {
    return `${standing.wins}–${standing.losses}–${standing.pushes}`;
  }
  return `${standing.wins}–${standing.losses}`;
}

export function recordLabel(
  wins: number,
  losses: number,
  pushes = 0,
): string {
  return formatRecord({ wins, losses, pushes });
}
