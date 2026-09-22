import type { Game, Pick, WeekFile, WeekRecord } from "./types";

export function emptyRecord(pending: number): WeekRecord {
  return { wins: 0, losses: 0, pushes: 0, pending };
}

export function gradePick(
  game: Game,
  pick: Pick | undefined,
): "win" | "loss" | "push" | "pending" {
  if (game.status !== "final") return "pending";
  if (!pick) return "pending";
  if (game.winner === null) return "push";
  if (pick.winner === game.winner) return "win";
  return "loss";
}

export function recordForModel(games: Game[], picks: Pick[] | undefined): WeekRecord {
  const byGame = new Map((picks ?? []).map((pick) => [pick.gameId, pick]));
  const record = emptyRecord(0);
  for (const game of games) {
    const result = gradePick(game, byGame.get(game.id));
    if (result === "win") record.wins += 1;
    else if (result === "loss") record.losses += 1;
    else if (result === "push") record.pushes += 1;
    else record.pending += 1;
  }
  return record;
}

export function gradeWeekFile(week: WeekFile): WeekFile {
  const records: WeekFile["records"] = {};
  for (const model of week.models) {
    records[model.id] = recordForModel(week.games, week.picks[model.id]);
  }
  const allFinal = week.games.every((game) => game.status === "final");
  return {
    ...week,
    records,
    gradedAt: allFinal ? (week.gradedAt ?? new Date().toISOString()) : week.gradedAt,
  };
}
