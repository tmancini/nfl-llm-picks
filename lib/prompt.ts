import type { Game } from "./types";
import { slateForPrompt } from "./picks";

export const SYSTEM_PROMPT =
  "You are picking NFL game winners. Return JSON only. Pick exactly one team per game. No ties.";

export function userPrompt(season: number, week: number, games: Game[]): string {
  const slate = slateForPrompt(games);
  return [
    `Season ${season}, week ${week}.`,
    "Pick the straight-up winner of each game. Use the team codes exactly as given (away, home).",
    "Do not consult or mention betting lines, spreads, or totals.",
    "Response schema:",
    `{ "picks": [ { "gameId": "401772001", "winner": "KC", "rationale": "one short sentence" } ] }`,
    "Games:",
    JSON.stringify(slate, null, 2),
  ].join("\n");
}
