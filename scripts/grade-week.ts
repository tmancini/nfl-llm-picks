import { parseCliArgs } from "../lib/cli";
import { loadLocalEnv } from "../lib/env";
import { fetchEspnCurrent, fetchSlate, mergeScores } from "../lib/espn";
import { gradeWeekFile } from "../lib/grade";
import { listWeekFiles, readWeekFile, writeWeekFile } from "../lib/store";
import type { WeekFile } from "../lib/types";

function gradeOne(week: WeekFile, incomingGames: WeekFile["games"]): WeekFile {
  const merged = {
    ...week,
    games: week.games.map((game) => {
      const incoming = incomingGames.find((row) => row.id === game.id);
      return incoming ? mergeScores(game, incoming) : game;
    }),
  };
  return gradeWeekFile(merged);
}

async function main(): Promise<void> {
  loadLocalEnv();
  const args = parseCliArgs(process.argv.slice(2));
  const targets: Array<{ season: number; week: number }> = [];

  if (args.season && args.week) {
    targets.push({ season: args.season, week: args.week });
  } else if (args.week || args.season) {
    const live = await fetchEspnCurrent();
    targets.push({
      season: args.season ?? live.season,
      week: args.week ?? live.week,
    });
  } else {
    const files = listWeekFiles();
    if (files.length === 0) {
      const live = await fetchEspnCurrent();
      targets.push({ season: live.season, week: live.week });
    } else {
      for (const file of files) {
        if (file.games.some((game) => game.status !== "final")) {
          targets.push({ season: file.season, week: file.week });
        }
      }
      if (targets.length === 0) {
        const live = await fetchEspnCurrent();
        targets.push({ season: live.season, week: live.week });
      }
    }
  }

  for (const target of targets) {
    const existing = readWeekFile(target.season, target.week);
    if (!existing) {
      console.log(`No week file for ${target.season} week ${target.week}; skip`);
      continue;
    }
    const slate = await fetchSlate(target.season, target.week);
    const graded = gradeOne(existing, slate.games);
    const path = writeWeekFile(graded);
    const sample = Object.values(graded.records)[0];
    console.log(
      `Graded ${target.season} week ${target.week} (${path}) sample W-L ${sample.wins}-${sample.losses} pending ${sample.pending}`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
