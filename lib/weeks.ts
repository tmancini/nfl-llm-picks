import { readWeekFile, listWeekFiles as listStoredWeeks } from "./store";
import type { WeekFile } from "./types";

export function listWeekFiles(): WeekFile[] {
  return listStoredWeeks();
}

export function loadWeek(season: number, week: number): WeekFile | null {
  return readWeekFile(season, week);
}
