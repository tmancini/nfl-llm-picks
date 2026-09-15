export type GameStatus = "scheduled" | "live" | "final";

export type ModelId =
  | "openai/gpt-6-astra"
  | "anthropic/claude-fable-5.1"
  | "google/gemini-3.1-pro-preview"
  | "x-ai/grok-4.6";

export type ModelDef = {
  id: ModelId;
  label: string;
  shortLabel: string;
};

export type Game = {
  id: string;
  away: string;
  home: string;
  awayName: string;
  homeName: string;
  kickoffUtc: string;
  kickoffEt: string;
  status: GameStatus;
  homeScore: number | null;
  awayScore: number | null;
  winner: string | null;
};

export type Pick = {
  gameId: string;
  winner: string;
  rationale: string;
};

export type WeekRecord = {
  wins: number;
  losses: number;
  pushes: number;
  pending: number;
};

export type WeekSource = "openrouter" | "slate" | "fixture";

export type WeekFile = {
  season: number;
  week: number;
  source: WeekSource;
  lockedAt: string | null;
  gradedAt: string | null;
  models: ModelDef[];
  games: Game[];
  picks: Record<string, Pick[]>;
  records: Record<string, WeekRecord>;
};

export type CurrentPointer = {
  season: number;
  week: number;
};

export type SeasonStanding = {
  modelId: string;
  label: string;
  shortLabel: string;
  wins: number;
  losses: number;
  pushes: number;
  pending: number;
  weeksLocked: number;
};

export type SlateGame = {
  id: string;
  away: string;
  home: string;
  kickoffEt: string;
};
