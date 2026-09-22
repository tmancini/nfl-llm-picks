import type { Game, GameStatus } from "./types";
import { normalizeTeamCode, teamName } from "./teams";
import { formatKickoffEt } from "./time";

const ESPN_SCOREBOARD =
  "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";
const ESPN_SUMMARY =
  "https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary";
const ESPN_TEAM_SCHEDULE =
  "https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams";
const NFLVERSE_SCHEDULE =
  "https://github.com/nflverse/nflverse-data/releases/download/schedules/schedules.csv";

export type EspnFetch = (url: string) => Promise<unknown>;

export type GameExtras = {
  venueName: string | null;
  venueCity: string | null;
  venueState: string | null;
  venueCountry: string | null;
  indoor: boolean | null;
  homeRecord: string | null;
  awayRecord: string | null;
  homeEspnId: string | null;
  awayEspnId: string | null;
  market: MarketOdds | null;
};

export type MarketOdds = {
  source: string;
  homeMoneyline: number;
  awayMoneyline: number;
  homeSpread: number | null;
};

export type InjuryNote = {
  player: string;
  position: string | null;
  status: string;
  detail: string | null;
};

export type RecentResult = {
  week: number;
  opponent: string;
  location: "home" | "away" | "neutral";
  result: "W" | "L" | "T";
  score: string;
};

export type ScoreboardResult = {
  season: number;
  week: number;
  seasonType: number;
  games: Game[];
  extras: Record<string, GameExtras>;
  source: "espn" | "nflverse";
  fetchedAtUtc?: string;
};

type EspnCompetitor = {
  homeAway?: string;
  score?: string | number | { value?: number; displayValue?: string };
  winner?: boolean;
  records?: Array<{ type?: string; summary?: string }>;
  team?: { id?: string; abbreviation?: string; displayName?: string };
};

type EspnVenue = {
  fullName?: string;
  indoor?: boolean;
  address?: { city?: string; state?: string; country?: string };
};

type EspnEvent = {
  id?: string;
  date?: string;
  competitions?: Array<{
    competitors?: EspnCompetitor[];
    status?: { type?: { state?: string; completed?: boolean; name?: string } };
    venue?: EspnVenue;
    neutralSite?: boolean;
    odds?: Array<{
      provider?: { name?: string };
      spread?: number;
      moneyline?: {
        home?: { close?: { odds?: string } };
        away?: { close?: { odds?: string } };
      };
    }>;
  }>;
  week?: { number?: number };
  seasonType?: { type?: number };
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

function parseScore(
  value: string | number | { value?: number; displayValue?: string } | undefined,
): number | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "object") {
    if (typeof value.value === "number" && Number.isFinite(value.value)) {
      return value.value;
    }
    if (value.displayValue !== undefined) return parseScore(value.displayValue);
    return null;
  }
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function overallRecord(competitor: EspnCompetitor | undefined): string | null {
  const rows = competitor?.records ?? [];
  const total = rows.find((row) => row.type === "total") ?? rows[0];
  return total?.summary ?? null;
}

function emptyExtras(): GameExtras {
  return {
    venueName: null,
    venueCity: null,
    venueState: null,
    venueCountry: null,
    indoor: null,
    homeRecord: null,
    awayRecord: null,
    homeEspnId: null,
    awayEspnId: null,
    market: null,
  };
}

function parseMarketOdds(competition: NonNullable<EspnEvent["competitions"]>[number]): MarketOdds | null {
  const line = competition.odds?.[0];
  if (!line) return null;
  const homeMoneyline = Number(line.moneyline?.home?.close?.odds);
  const awayMoneyline = Number(line.moneyline?.away?.close?.odds);
  if (!Number.isFinite(homeMoneyline) || !Number.isFinite(awayMoneyline) ||
      homeMoneyline === 0 || awayMoneyline === 0) return null;
  return {
    source: `${line.provider?.name ?? "sportsbook"} via ESPN`,
    homeMoneyline,
    awayMoneyline,
    homeSpread: typeof line.spread === "number" ? line.spread : null,
  };
}

export function parseEspnScoreboard(payload: unknown): ScoreboardResult {
  const data = payload as EspnScoreboard;
  const season = data.season?.year;
  const week = data.week?.number;
  if (!season || !week) {
    throw new Error("ESPN scoreboard missing season or week");
  }
  const games: Game[] = [];
  const extras: Record<string, GameExtras> = {};
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
    const gameId = String(event.id);
    games.push({
      id: gameId,
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
    const venue = competition.venue;
    extras[gameId] = {
      venueName: venue?.fullName ?? null,
      venueCity: venue?.address?.city ?? null,
      venueState: venue?.address?.state ?? null,
      venueCountry: venue?.address?.country ?? null,
      indoor: typeof venue?.indoor === "boolean" ? venue.indoor : null,
      homeRecord: overallRecord(home),
      awayRecord: overallRecord(away),
      homeEspnId: home?.team?.id ? String(home.team.id) : null,
      awayEspnId: away?.team?.id ? String(away.team.id) : null,
      market: parseMarketOdds(competition),
    };
  }
  games.sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc) || a.id.localeCompare(b.id));
  return {
    season,
    week,
    seasonType: data.season?.type ?? 2,
    games,
    extras,
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
  return { ...parsed, season, week, fetchedAtUtc: new Date().toISOString() };
}

export async function fetchEspnCurrent(
  fetcher: EspnFetch = defaultFetch,
): Promise<ScoreboardResult> {
  const payload = await fetcher(ESPN_SCOREBOARD);
  return { ...parseEspnScoreboard(payload), fetchedAtUtc: new Date().toISOString() };
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
  const extras: Record<string, GameExtras> = {};
  for (const game of games) extras[game.id] = emptyExtras();
  return { season, week, seasonType: 2, games, extras, source: "nflverse" };
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

type EspnInjuryAthlete = {
  displayName?: string;
  position?: { abbreviation?: string };
};

type EspnInjuryEntry = {
  status?: string;
  athlete?: EspnInjuryAthlete;
  details?: { type?: string };
  type?: { description?: string; abbreviation?: string };
};

type EspnInjuryTeamBlock = {
  team?: { abbreviation?: string };
  injuries?: EspnInjuryEntry[];
};

const INJURY_STATUS_RANK: Record<string, number> = {
  out: 0,
  "injured reserve": 1,
  doubtful: 2,
  questionable: 3,
  probable: 4,
};

function injuryStatusRank(status: string): number {
  return INJURY_STATUS_RANK[status.toLowerCase()] ?? 50;
}

export function parseEspnInjuries(
  payload: unknown,
  limitPerTeam = 8,
): Record<string, InjuryNote[]> {
  const data = payload as { injuries?: EspnInjuryTeamBlock[] };
  const byTeam: Record<string, InjuryNote[]> = {};
  for (const block of data.injuries ?? []) {
    const code = normalizeTeamCode(block.team?.abbreviation);
    if (!code) continue;
    const notes: InjuryNote[] = [];
    for (const entry of block.injuries ?? []) {
      const player = entry.athlete?.displayName?.trim();
      const status = entry.status?.trim();
      if (!player || !status) continue;
      // Skip non-injury active listings if ESPN ever includes them.
      if (/^active$/i.test(status)) continue;
      notes.push({
        player,
        position: entry.athlete?.position?.abbreviation ?? null,
        status,
        detail: entry.details?.type?.trim() || null,
      });
    }
    notes.sort(
      (a, b) =>
        injuryStatusRank(a.status) - injuryStatusRank(b.status) ||
        a.player.localeCompare(b.player),
    );
    byTeam[code] = notes.slice(0, limitPerTeam);
  }
  return byTeam;
}

/** ESPN game summary — extracts injuries only (ignores odds/pickcenter). */
export async function fetchGameInjuries(
  eventId: string,
  limitPerTeam = 8,
  fetcher: EspnFetch = defaultFetch,
): Promise<Record<string, InjuryNote[]>> {
  const payload = await fetcher(`${ESPN_SUMMARY}?event=${encodeURIComponent(eventId)}`);
  return parseEspnInjuries(payload, limitPerTeam);
}

type EspnSchedulePayload = {
  events?: EspnEvent[];
};

export function parseTeamRecentForm(
  payload: unknown,
  teamCode: string,
  beforeWeek: number,
  limit = 3,
): RecentResult[] {
  const data = payload as EspnSchedulePayload;
  const code = normalizeTeamCode(teamCode);
  if (!code) return [];
  const completed: RecentResult[] = [];
  for (const event of data.events ?? []) {
    const weekNum = event.week?.number;
    const seasonType = event.seasonType?.type ?? 2;
    if (seasonType !== 2) continue;
    if (typeof weekNum !== "number" || weekNum >= beforeWeek) continue;
    const competition = event.competitions?.[0];
    if (!competition) continue;
    const completedFlag =
      competition.status?.type?.completed === true ||
      competition.status?.type?.state === "post";
    if (!completedFlag) continue;
    const competitors = competition.competitors ?? [];
    const self = competitors.find(
      (c) => normalizeTeamCode(c.team?.abbreviation) === code,
    );
    const opp = competitors.find(
      (c) => normalizeTeamCode(c.team?.abbreviation) !== code,
    );
    if (!self || !opp) continue;
    const selfScore = parseScore(self.score);
    const oppScore = parseScore(opp.score);
    if (selfScore === null || oppScore === null) continue;
    const oppCode = normalizeTeamCode(opp.team?.abbreviation) ?? "UNK";
    let result: "W" | "L" | "T" = "T";
    if (self.winner === true || selfScore > oppScore) result = "W";
    else if (self.winner === false || selfScore < oppScore) result = "L";
    let location: "home" | "away" | "neutral" = "neutral";
    if (competition.neutralSite) location = "neutral";
    else if (self.homeAway === "home") location = "home";
    else if (self.homeAway === "away") location = "away";
    completed.push({
      week: weekNum,
      opponent: oppCode,
      location,
      result,
      score: `${selfScore}-${oppScore}`,
    });
  }
  completed.sort((a, b) => b.week - a.week);
  return completed.slice(0, limit);
}

export async function fetchTeamRecentForm(
  espnTeamId: string,
  season: number,
  beforeWeek: number,
  limit = 3,
  fetcher: EspnFetch = defaultFetch,
): Promise<RecentResult[]> {
  const url = `${ESPN_TEAM_SCHEDULE}/${encodeURIComponent(espnTeamId)}/schedule?season=${season}`;
  const payload = await fetcher(url);
  const data = payload as EspnSchedulePayload & {
    team?: { abbreviation?: string };
  };
  let teamCode = normalizeTeamCode(data.team?.abbreviation);
  if (!teamCode) {
    for (const event of data.events ?? []) {
      for (const competitor of event.competitions?.[0]?.competitors ?? []) {
        if (String(competitor.team?.id ?? "") === String(espnTeamId)) {
          teamCode = normalizeTeamCode(competitor.team?.abbreviation);
          break;
        }
      }
      if (teamCode) break;
    }
  }
  if (!teamCode) return [];
  return parseTeamRecentForm(payload, teamCode, beforeWeek, limit);
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
