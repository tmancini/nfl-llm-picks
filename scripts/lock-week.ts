import { parseCliArgs } from "../lib/cli";
import { loadLocalEnv, getOpenRouterApiKey } from "../lib/env";
import { fetchEspnCurrent, fetchSlate, mergeScores } from "../lib/espn";
import {
  applyFixturePicks,
  applyLocks,
  scaffoldWeekFile,
  weekHasPicks,
} from "../lib/lock";
import { createOpenRouterClient } from "../lib/openrouter";
import { readWeekFile, writeCurrentPointer, writeWeekFile } from "../lib/store";

async function main(): Promise<void> {
  loadLocalEnv();
  const args = parseCliArgs(process.argv.slice(2));
  const live = await fetchEspnCurrent();
  const season = args.season ?? live.season;
  const week = args.week ?? live.week;
  const slate = args.season || args.week ? await fetchSlate(season, week) : live;

  if (slate.games.every((game) => game.status === "final")) {
    console.warn(
      `Warning: ${season} week ${week} is already final. Locked picks may be contaminated by known results.`,
    );
  }

  const existing = readWeekFile(season, week);
  let weekFile = existing
    ? {
        ...existing,
        games: existing.games.map((game) => {
          const incoming = slate.games.find((row) => row.id === game.id);
          return incoming ? mergeScores(game, incoming) : game;
        }),
      }
    : scaffoldWeekFile(season, week, slate.games);

  if (!existing) {
    const knownIds = new Set(weekFile.games.map((game) => game.id));
    for (const game of slate.games) {
      if (!knownIds.has(game.id)) weekFile.games.push(game);
    }
  }

  const alreadyLocked = weekHasPicks(weekFile);
  if (alreadyLocked && !args.force) {
    writeWeekFile(weekFile);
    writeCurrentPointer({ season, week });
    console.log(`Already locked: data/weeks/${season}-w${String(week).padStart(2, "0")}.json`);
    return;
  }
  if (args.force && alreadyLocked) {
    weekFile = {
      ...weekFile,
      lockedAt: null,
      picks: Object.fromEntries(Object.keys(weekFile.picks).map((id) => [id, []])),
    };
    weekFile = scaffoldWeekFile(season, week, weekFile.games);
  }

  if (args.fixture) {
    const fixture = applyFixturePicks(weekFile);
    const path = writeWeekFile(fixture);
    writeCurrentPointer({ season, week });
    console.log(`Wrote sample fixture week: ${path}`);
    return;
  }

  const apiKey = getOpenRouterApiKey();
  if (!apiKey) {
    const path = writeWeekFile(weekFile);
    writeCurrentPointer({ season, week });
    console.log(`Wrote slate without picks (OPENROUTER_API_KEY missing): ${path}`);
    console.log(
      `Lock for real:\n  OPENROUTER_API_KEY=sk-or-... pnpm lock-week --season ${season} --week ${week}`,
    );
    return;
  }

  const locked = await applyLocks(weekFile, createOpenRouterClient(apiKey));
  const path = writeWeekFile(locked);
  writeCurrentPointer({ season, week });
  console.log(`Locked ${season} week ${week}: ${path}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
