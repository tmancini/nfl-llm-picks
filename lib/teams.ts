export type TeamInfo = {
  code: string;
  name: string;
  city: string;
};

const TEAMS: TeamInfo[] = [
  { code: "ARI", name: "Arizona Cardinals", city: "Arizona" },
  { code: "ATL", name: "Atlanta Falcons", city: "Atlanta" },
  { code: "BAL", name: "Baltimore Ravens", city: "Baltimore" },
  { code: "BUF", name: "Buffalo Bills", city: "Buffalo" },
  { code: "CAR", name: "Carolina Panthers", city: "Carolina" },
  { code: "CHI", name: "Chicago Bears", city: "Chicago" },
  { code: "CIN", name: "Cincinnati Bengals", city: "Cincinnati" },
  { code: "CLE", name: "Cleveland Browns", city: "Cleveland" },
  { code: "DAL", name: "Dallas Cowboys", city: "Dallas" },
  { code: "DEN", name: "Denver Broncos", city: "Denver" },
  { code: "DET", name: "Detroit Lions", city: "Detroit" },
  { code: "GB", name: "Green Bay Packers", city: "Green Bay" },
  { code: "HOU", name: "Houston Texans", city: "Houston" },
  { code: "IND", name: "Indianapolis Colts", city: "Indianapolis" },
  { code: "JAX", name: "Jacksonville Jaguars", city: "Jacksonville" },
  { code: "KC", name: "Kansas City Chiefs", city: "Kansas City" },
  { code: "LAC", name: "Los Angeles Chargers", city: "Los Angeles" },
  { code: "LAR", name: "Los Angeles Rams", city: "Los Angeles" },
  { code: "LV", name: "Las Vegas Raiders", city: "Las Vegas" },
  { code: "MIA", name: "Miami Dolphins", city: "Miami" },
  { code: "MIN", name: "Minnesota Vikings", city: "Minnesota" },
  { code: "NE", name: "New England Patriots", city: "New England" },
  { code: "NO", name: "New Orleans Saints", city: "New Orleans" },
  { code: "NYG", name: "New York Giants", city: "New York" },
  { code: "NYJ", name: "New York Jets", city: "New York" },
  { code: "PHI", name: "Philadelphia Eagles", city: "Philadelphia" },
  { code: "PIT", name: "Pittsburgh Steelers", city: "Pittsburgh" },
  { code: "SEA", name: "Seattle Seahawks", city: "Seattle" },
  { code: "SF", name: "San Francisco 49ers", city: "San Francisco" },
  { code: "TB", name: "Tampa Bay Buccaneers", city: "Tampa Bay" },
  { code: "TEN", name: "Tennessee Titans", city: "Tennessee" },
  { code: "WSH", name: "Washington Commanders", city: "Washington" },
];

const ALIASES: Record<string, string> = {
  ARZ: "ARI",
  ARI: "ARI",
  GBP: "GB",
  GNB: "GB",
  GB: "GB",
  JAC: "JAX",
  JAX: "JAX",
  KAN: "KC",
  KCC: "KC",
  KC: "KC",
  LA: "LAR",
  LAR: "LAR",
  STL: "LAR",
  LVR: "LV",
  OAK: "LV",
  LV: "LV",
  SD: "LAC",
  SDG: "LAC",
  LAC: "LAC",
  NEP: "NE",
  NWE: "NE",
  NE: "NE",
  NOR: "NO",
  NOS: "NO",
  NO: "NO",
  SFO: "SF",
  SF: "SF",
  TAM: "TB",
  TBB: "TB",
  TB: "TB",
  WAS: "WSH",
  WSH: "WSH",
  WASH: "WSH",
  CLV: "CLE",
  CLE: "CLE",
  HST: "HOU",
  HOU: "HOU",
};

const BY_CODE = new Map(TEAMS.map((team) => [team.code, team]));

export function normalizeTeamCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().toUpperCase();
  if (!trimmed) return null;
  if (ALIASES[trimmed]) return ALIASES[trimmed];
  if (BY_CODE.has(trimmed)) return trimmed;
  return null;
}

export function teamName(code: string): string {
  return BY_CODE.get(code)?.name ?? code;
}

export function teamInfo(code: string): TeamInfo | undefined {
  const normalized = normalizeTeamCode(code) ?? code;
  return BY_CODE.get(normalized);
}

export const NFL_TEAM_CODES = TEAMS.map((team) => team.code);
