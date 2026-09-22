import { MODELS } from "./models";
import { providerForModel } from "./standings";
import type { WeekFile } from "./types";

const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  "x-ai": "xAI",
};

export type TrendPoint = {
  week: number;
  wins: number;
  losses: number;
  rate: number;
};

export type ModelTrend = {
  provider: string;
  label: string;
  points: TrendPoint[];
};

export function seasonTrends(weeks: WeekFile[], season: number): ModelTrend[] {
  const graded = weeks
    .filter((week) => week.season === season && week.source === "openrouter")
    .sort((a, b) => a.week - b.week);

  return MODELS.map((model) => {
    const provider = providerForModel(model.id);
    let wins = 0;
    let losses = 0;
    const points: TrendPoint[] = [];
    for (const week of graded) {
      const historicalModel = week.models.find(
        (entry) => providerForModel(entry.id) === provider,
      );
      const record = historicalModel ? week.records[historicalModel.id] : undefined;
      if (!record) continue;
      wins += record.wins;
      losses += record.losses;
      if (wins + losses === 0) continue;
      points.push({
        week: week.week,
        wins,
        losses,
        rate: wins / (wins + losses),
      });
    }
    return { provider, label: PROVIDER_LABELS[provider] ?? model.shortLabel, points };
  });
}
