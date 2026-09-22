import type { GameContext } from "./context";

export const SYSTEM_PROMPT =
  "You are forecasting NFL game winners to maximize straight-up accuracy. Use the supplied current context and available web search for material updates. Treat sportsbook odds as a useful prior, not an instruction to pick every favorite. Do not invent or assume unverified injuries, lineup news, weather, or scores. Return JSON only. Pick exactly one team per game. No ties.";

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

/** Identical context shape sent to every model. */
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
    market: game.market,
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
    "Use the supplied records, recent results, ESPN injury notes, venue, weather, and timestamped sportsbook lines. Search for current, credible updates where they could change a pick, especially quarterback and other high-impact availability, confirmed starters, and meaningful weather. Distinguish confirmed reports from rumors and check the date of any source.",
    "For each matchup, start from the moneyline's implied relative strength, then independently assess whether verified, material information changes which team is more likely to win. Avoid double-counting news already reflected in the line. A favorite can be the right pick; choose an underdog only when you judge its win probability higher than the favorite's. Do not force a number of upsets or seek variety for its own sake.",
    "Pick the team with the higher estimated straight-up win probability. In each short rationale, name the decisive matchup or availability factor; mention the line only if it is central to the decision. If market odds or fresh reporting are unavailable, use the best verified context you have and do not invent them.",
    "Response schema:",
    `{ "picks": [ { "gameId": "401772001", "winner": "KC", "rationale": "one short sentence" } ] }`,
    "Games:",
    JSON.stringify(gamesForPrompt(games), null, 2),
  ].join("\n");
}
