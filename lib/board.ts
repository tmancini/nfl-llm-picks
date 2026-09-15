import { isFillerRationale } from "./picks";
import { listWeekFiles, readCurrentPointer } from "./store";
import type { Game, Pick, WeekFile } from "./types";
import { consensusWinner } from "./consensus";

export { consensusWinner } from "./consensus";

export function pickFor(week: WeekFile, modelId: string, gameId: string): Pick | undefined {
  return (week.picks[modelId] ?? []).find((pick) => pick.gameId === gameId);
}

export function pickResult(
  winner: string | undefined,
  game: Game,
): "W" | "L" | "T" | null {
  if (game.status !== "final" || !winner) return null;
  if (game.winner === null) return "T";
  return winner === game.winner ? "W" : "L";
}

export function consensusForGame(
  week: WeekFile,
  gameId: string,
): { team: string; count: number; total: number } | null {
  const winners = week.models
    .map((model) => pickFor(week, model.id, gameId)?.winner)
    .filter((winner): winner is string => Boolean(winner));
  const team = consensusWinner(winners);
  if (!team) return null;
  const count = winners.filter((winner) => winner === team).length;
  return { team, count, total: winners.length };
}

export function isConsensusGame(week: WeekFile, gameId: string): boolean {
  return consensusForGame(week, gameId) !== null;
}

export function visibleRationale(rationale: string | undefined): string | null {
  if (!rationale || isFillerRationale(rationale)) return null;
  return rationale;
}

export function resolveBoardWeek(weeks = listWeekFiles()): WeekFile | null {
  if (weeks.length === 0) return null;
  const open = weeks.find((week) => week.games.some((game) => game.status !== "final"));
  if (open) return open;
  const pointer = readCurrentPointer();
  if (pointer) {
    const match = weeks.find(
      (week) => week.season === pointer.season && week.week === pointer.week,
    );
    if (match) return match;
  }
  return weeks[weeks.length - 1];
}

export function featuredWeek(weeks = listWeekFiles()): WeekFile | null {
  return resolveBoardWeek(weeks);
}

export function weeksForSeason(season: number, weeks = listWeekFiles()): WeekFile[] {
  return weeks.filter((week) => week.season === season);
}

export function shortKickoff(kickoffEt: string): string {
  // "Thu, Sep 17, 8:15 PM ET" → "Thu 8:15PM"
  const match = kickoffEt.match(/^([A-Za-z]{3}).*?(\d{1,2}:\d{2})\s*(AM|PM)/i);
  if (!match) return kickoffEt.replace(/\s*ET$/i, "").trim();
  return `${match[1]} ${match[2]}${match[3].toUpperCase()}`;
}
