import type { GameContext } from "./context";

export const SYSTEM_PROMPT =
  "You are picking NFL game winners. Return JSON only. Pick exactly one team per game. No ties. Use only the provided weekly context plus general football knowledge — do not invent injuries, weather, or scores that are not listed.";

function compactSide(side: GameContext["awaySide"]) {
  return {
    team: side.code,
    record: side.record,
    recent: side.recent,
    injuries: side.injuries,
    ...(side.injuriesNote ? { injuriesNote: side.injuriesNote } : {}),
  };
}

function compactWeather(weather: GameContext["weather"]) {
  if (weather.status === "forecast") {
    return {
      status: weather.status,
      tempF: weather.tempF,
      precipProb: weather.precipProb,
      summary: weather.summary,
    };
  }
  return { status: weather.status, note: weather.note };
}

/** Shape sent to every model (no betting lines). */
export function gamesForPrompt(games: GameContext[]) {
  return games.map((game) => ({
    gameId: game.id,
    away: game.away,
    home: game.home,
    kickoffEt: game.kickoffEt,
    venue: game.venue,
    weather: compactWeather(game.weather),
    awaySide: compactSide(game.awaySide),
    homeSide: compactSide(game.homeSide),
  }));
}

export function userPrompt(
  season: number,
  week: number,
  games: GameContext[],
): string {
  return [
    `Season ${season}, week ${week}.`,
    "Pick the straight-up winner of each game. Use the team codes exactly as given (away, home).",
    "Context pack per game may include season record, recent regular-season results (newest first), key injury/inactive notes from ESPN, venue, and outdoor kickoff weather (or an indoor/dome note). Fields may be null or marked unavailable — do not invent missing facts.",
    "Do not consult or mention betting lines, spreads, moneylines, or totals.",
    "Response schema:",
    `{ "picks": [ { "gameId": "401772001", "winner": "KC", "rationale": "one short sentence" } ] }`,
    "Games:",
    JSON.stringify(gamesForPrompt(games), null, 2),
  ].join("\n");
}
