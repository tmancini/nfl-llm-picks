import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { CurrentPointer, WeekFile } from "./types";

export function dataDir(cwd = process.cwd()): string {
  return path.join(cwd, "data");
}

export function weeksDir(cwd = process.cwd()): string {
  return path.join(dataDir(cwd), "weeks");
}

export function checkpointsDir(cwd = process.cwd()): string {
  return path.join(dataDir(cwd), "checkpoints");
}

export function archivesDir(cwd = process.cwd()): string {
  return path.join(dataDir(cwd), "archives");
}

export function weekFileName(season: number, week: number): string {
  return `${season}-w${String(week).padStart(2, "0")}.json`;
}

export function weekFilePath(season: number, week: number, cwd = process.cwd()): string {
  return path.join(weeksDir(cwd), weekFileName(season, week));
}

export function checkpointFilePath(season: number, week: number, cwd = process.cwd()): string {
  return path.join(checkpointsDir(cwd), weekFileName(season, week));
}

export function revisionCheckpointFilePath(season: number, week: number, cwd = process.cwd()): string {
  return path.join(checkpointsDir(cwd), `${season}-w${String(week).padStart(2, "0")}-revision.json`);
}

export function originalArchivePath(season: number, week: number, cwd = process.cwd()): string {
  return path.join(archivesDir(cwd), `${season}-w${String(week).padStart(2, "0")}-original.json`);
}

export function currentPointerPath(cwd = process.cwd()): string {
  return path.join(dataDir(cwd), "current.json");
}

export function ensureDataDirs(cwd = process.cwd()): void {
  mkdirSync(weeksDir(cwd), { recursive: true });
}

export function readWeekFile(
  season: number,
  week: number,
  cwd = process.cwd(),
): WeekFile | null {
  const filePath = weekFilePath(season, week, cwd);
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf8")) as WeekFile;
}

export function writeWeekFile(week: WeekFile, cwd = process.cwd()): string {
  ensureDataDirs(cwd);
  const filePath = weekFilePath(week.season, week.week, cwd);
  writeFileSync(filePath, `${JSON.stringify(week, null, 2)}\n`);
  return filePath;
}

export function readCheckpointFile(season: number, week: number, cwd = process.cwd()): WeekFile | null {
  const filePath = checkpointFilePath(season, week, cwd);
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf8")) as WeekFile;
}

export function writeCheckpointFile(week: WeekFile, cwd = process.cwd()): string {
  mkdirSync(checkpointsDir(cwd), { recursive: true });
  const filePath = checkpointFilePath(week.season, week.week, cwd);
  writeFileSync(filePath, `${JSON.stringify(week, null, 2)}\n`);
  return filePath;
}

export function removeCheckpointFile(season: number, week: number, cwd = process.cwd()): void {
  const filePath = checkpointFilePath(season, week, cwd);
  if (existsSync(filePath)) unlinkSync(filePath);
}

export function readRevisionCheckpointFile(season: number, week: number, cwd = process.cwd()): WeekFile | null {
  const filePath = revisionCheckpointFilePath(season, week, cwd);
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf8")) as WeekFile;
}

export function writeRevisionCheckpointFile(week: WeekFile, cwd = process.cwd()): string {
  mkdirSync(checkpointsDir(cwd), { recursive: true });
  const filePath = revisionCheckpointFilePath(week.season, week.week, cwd);
  writeFileSync(filePath, `${JSON.stringify(week, null, 2)}\n`);
  return filePath;
}

export function removeRevisionCheckpointFile(season: number, week: number, cwd = process.cwd()): void {
  const filePath = revisionCheckpointFilePath(season, week, cwd);
  if (existsSync(filePath)) unlinkSync(filePath);
}

export function archiveOriginalWeek(week: WeekFile, cwd = process.cwd()): string {
  const filePath = originalArchivePath(week.season, week.week, cwd);
  if (existsSync(filePath)) return filePath;
  mkdirSync(archivesDir(cwd), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(week, null, 2)}\n`);
  return filePath;
}

export function writeCurrentPointer(pointer: CurrentPointer, cwd = process.cwd()): void {
  ensureDataDirs(cwd);
  writeFileSync(currentPointerPath(cwd), `${JSON.stringify(pointer, null, 2)}\n`);
}

export function readCurrentPointer(cwd = process.cwd()): CurrentPointer | null {
  const filePath = currentPointerPath(cwd);
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf8")) as CurrentPointer;
}

export function listWeekFiles(cwd = process.cwd()): WeekFile[] {
  const dir = weeksDir(cwd);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => JSON.parse(readFileSync(path.join(dir, name), "utf8")) as WeekFile);
}
