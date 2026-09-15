import type { Game, GameStatus } from "./types";
import { normalizeTeamCode, teamName } from "./teams";
import { formatKickoffEt } from "./time";

const ESPN_SCOREBOARD =
  "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";
const NFLVERSE_SCHEDULE =
  "https://github.com/nflverse/nflverse-data/releases/download/schedules/schedules.csv";

export type EspnFetch = (url: string) => Promise<unknown>;

export type ScoreboardResult = {
  season: number;
  week: number;
  seasonType: number;
  games: Game[];
  source: "espn" | "nflverse";
};

type EspnCompetitor = {
  homeAway?: string;
  score?: string | number;
  team?: { abbreviation?: string; displayName?: string };
};

type EspnEvent = {
  id?: string;
  date?: string;
  competitions?: Array<{
    competitors?: EspnCompetitor[];
    status?: { type?: { state?: string; completed?: boolean } };
  }>;
};

type EspnScoreboard = {
  season?: { year?: number; type?: number };
  week?: { number?: number };
  events?: EspnEvent[];
};

function defaultFetch(url: string): Promise<unknown> {
  return fetch(url, {
    headers: { "User-Agent": "nfl-llm-picks/0.1 (public slate)" },
  }).then(async (res) => {
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} for ${url}`);
    }
    return res.json();
  });
}

function mapStatus(state: string | undefined, completed: boolean | undefined): GameStatus {
  if (completed || state === "post") return "final";
  if (state === "in") return "live";
  return "scheduled";
}

function parseScore(value: string | number | undefined): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function parseEspnScoreboard(payload: unknown): ScoreboardResult {
  const data = payload as EspnScoreboard;
  const season = data.season?.year;
  const week = data.week?.number;
  if (!season || !week) {
    throw new Error("ESPN scoreboard missing season or week");
  }
  const games: Game[] = [];
  for (const event of data.events ?? []) {
    const competition = event.competitions?.[0];
    if (!event.id || !event.date || !competition) continue;
    const competitors = competition.competitors ?? [];
    const home = competitors.find((c) => c.homeAway === "home");
    const away = competitors.find((c) => c.homeAway === "away");
    const homeCode = normalizeTeamCode(home?.team?.abbreviation);
    const awayCode = normalizeTeamCode(away?.team?.abbreviation);
    if (!homeCode || !awayCode) continue;
    const status = mapStatus(
      competition.status?.type?.state,
      competition.status?.type?.completed,
    );
    const homeScore = parseScore(home?.score);
    const awayScore = parseScore(away?.score);
    let winner: string | null = null;
    if (status === "final" && homeScore !== null && awayScore !== null) {
      if (homeScore > awayScore) winner = homeCode;
      else if (awayScore > homeScore) winner = awayCode;
    }
    games.push({
      id: String(event.id),
      away: awayCode,
      home: homeCode,
      awayName: away?.team?.displayName ?? teamName(awayCode),
      homeName: home?.team?.displayName ?? teamName(homeCode),
      kickoffUtc: event.date,
      kickoffEt: formatKickoffEt(event.date),
      status,
      homeScore: status === "scheduled" ? null : homeScore,
      awayScore: status === "scheduled" ? null : awayScore,
      winner,
    });
  }
  games.sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc) || a.id.localeCompare(b.id));
  return {
    season,
    week,
    seasonType: data.season?.type ?? 2,
    games,
    source: "espn",
  };
}

export async function fetchEspnScoreboard(
  season: number,
  week: number,
  fetcher: EspnFetch = defaultFetch,
): Promise<ScoreboardResult> {
  const url = `${ESPN_SCOREBOARD}?dates=${season}&seasontype=2&week=${week}`;
  const payload = await fetcher(url);
  const parsed = parseEspnScoreboard(payload);
  if (parsed.games.length === 0) {
    throw new Error(`ESPN returned no games for ${season} week ${week}`);
  }
  return { ...parsed, season, week };
}

export async function fetchEspnCurrent(
  fetcher: EspnFetch = defaultFetch,
): Promise<ScoreboardResult> {
  const payload = await fetcher(ESPN_SCOREBOARD);
  return parseEspnScoreboard(payload);
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  cells.push(current);
  return cells;
}

export function parseNflverseScheduleCsv(
  csv: string,
  season: number,
  week: number,
): Game[] {
  const lines = csv.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const header = parseCsvLine(lines[0]).map((h) => h.trim());
  const idx = (name: string) => header.indexOf(name);
  const seasonIdx = idx("season");
  const weekIdx = idx("week");
  const gameIdIdx = idx("game_id") !== -1 ? idx("game_id") : idx("old_game_id");
  const homeIdx = idx("home_team");
  const awayIdx = idx("away_team");
  const kickoffIdx = idx("gameday") !== -1 ? idx("gameday") : idx("gametime");
  const games: Game[] = [];
  for (const line of lines.slice(1)) {
    const cols = parseCsvLine(line);
    if (Number(cols[seasonIdx]) !== season) continue;
    if (Number(cols[weekIdx]) !== week) continue;
    const home = normalizeTeamCode(cols[homeIdx]);
    const away = normalizeTeamCode(cols[awayIdx]);
    if (!home || !away) continue;
    const kickoff = cols[kickoffIdx] ? new Date(cols[kickoffIdx]).toISOString() : "";
    games.push({
      id: cols[gameIdIdx] || `${season}-${week}-${away}-${home}`,
      away,
      home,
      awayName: teamName(away),
      homeName: teamName(home),
      kickoffUtc: kickoff,
      kickoffEt: kickoff ? formatKickoffEt(kickoff) : "",
      status: "scheduled",
      homeScore: null,
      awayScore: null,
      winner: null,
    });
  }
  return games;
}

export async function fetchNflverseFallback(
  season: number,
  week: number,
  fetcher: EspnFetch = async (url) => {
    const res = await fetch(url, {
      headers: { "User-Agent": "nfl-llm-picks/0.1 (public slate)" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.text();
  },
): Promise<ScoreboardResult> {
  const csv = (await fetcher(NFLVERSE_SCHEDULE)) as string;
  const games = parseNflverseScheduleCsv(csv, season, week);
  if (games.length === 0) {
    throw new Error(`nflverse returned no games for ${season} week ${week}`);
  }
  return { season, week, seasonType: 2, games, source: "nflverse" };
}

export async function fetchSlate(
  season: number,
  week: number,
  fetcher: EspnFetch = defaultFetch,
): Promise<ScoreboardResult> {
  try {
    return await fetchEspnScoreboard(season, week, fetcher);
  } catch (error) {
    console.warn(`ESPN slate failed (${String(error)}); trying nflverse fallback`);
    return fetchNflverseFallback(season, week);
  }
}

export function mergeScores(existing: Game, incoming: Game): Game {
  return {
    ...existing,
    status: incoming.status,
    homeScore: incoming.homeScore,
    awayScore: incoming.awayScore,
    winner: incoming.winner,
    kickoffUtc: incoming.kickoffUtc || existing.kickoffUtc,
    kickoffEt: incoming.kickoffEt || existing.kickoffEt,
    awayName: incoming.awayName || existing.awayName,
    homeName: incoming.homeName || existing.homeName,
  };
}
