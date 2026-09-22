import { parseCliArgs } from "../lib/cli";
import { buildWeekContexts } from "../lib/context";
import { loadLocalEnv, getOpenRouterApiKey } from "../lib/env";
import { fetchEspnCurrent, fetchSlate, mergeScores } from "../lib/espn";
import {
  applyFixturePicks,
  applyLocks,
  scaffoldWeekFile,
  weekHasPicks,
} from "../lib/lock";
import { assertCappedOpenRouterKey, createOpenRouterClient } from "../lib/openrouter";
import { readWeekFile, writeCurrentPointer, writeWeekFile } from "../lib/store";

async function main(): Promise<void> {
  loadLocalEnv();
  const args = parseCliArgs(process.argv.slice(2));
  const live = await fetchEspnCurrent();
  const season = args.season ?? live.season;
  const week = args.week ?? live.week;
  const slate = args.season || args.week ? await fetchSlate(season, week) : live;

  if (args.contextOnly) {
    console.log(`Fetching weekly context for ${season} week ${week} (no model calls)…`);
    const contexts = await buildWeekContexts(slate);
    console.log(JSON.stringify(contexts, null, 2));
    console.log(
      `Context pack: ${contexts.length} games (injuries/form/weather/market odds when available).`,
    );
    return;
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

  const started = slate.games.find(
    (game) => game.status !== "scheduled" || Date.parse(game.kickoffUtc) <= Date.now(),
  );
  if (started) {
    throw new Error(`Cannot lock after the first kickoff (${started.away} at ${started.home})`);
  }

  const apiKey = getOpenRouterApiKey();
  const paidPicksEnabled = process.env.ENABLE_PAID_PICKS === "1";
  if (!paidPicksEnabled) {
    const path = writeWeekFile(weekFile);
    writeCurrentPointer({ season, week });
    console.log(`Wrote slate without picks (ENABLE_PAID_PICKS is off): ${path}`);
    console.log(
      `Lock for real: set ENABLE_PAID_PICKS=1 and a capped OPENROUTER_API_KEY, then run pnpm lock-week --season ${season} --week ${week}`,
    );
    return;
  }
  if (!apiKey) throw new Error("ENABLE_PAID_PICKS=1 requires OPENROUTER_API_KEY");

  await assertCappedOpenRouterKey(apiKey);

  console.log(`Building weekly context pack for ${season} week ${week}…`);
  const contexts = await buildWeekContexts(slate);
  const locked = await applyLocks(weekFile, createOpenRouterClient(apiKey), contexts);
  const path = writeWeekFile(locked);
  writeCurrentPointer({ season, week });
  console.log(`Locked ${season} week ${week}: ${path}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
