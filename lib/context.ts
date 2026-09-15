import {
  fetchGameInjuries,
  fetchTeamRecentForm,
  type EspnFetch,
  type GameExtras,
  type InjuryNote,
  type RecentResult,
  type ScoreboardResult,
} from "./espn";
import type { Game } from "./types";

export type WeatherContext =
  | { status: "indoor"; note: string }
  | { status: "forecast"; tempF: number; precipProb: number | null; summary: string }
  | { status: "unavailable"; note: string };

export type TeamSideContext = {
  code: string;
  record: string | null;
  recent: RecentResult[] | null;
  injuries: InjuryNote[] | null;
  injuriesNote?: string;
};

export type GameContext = {
  id: string;
  away: string;
  home: string;
  kickoffEt: string;
  venue: {
    name: string | null;
    city: string | null;
    state: string | null;
    indoor: boolean | null;
  } | null;
  awaySide: TeamSideContext;
  homeSide: TeamSideContext;
  weather: WeatherContext;
};

const RECENT_N = 3;
const INJURY_LIMIT = 8;

const WMO_SUMMARY: Record<number, string> = {
  0: "clear",
  1: "mainly clear",
  2: "partly cloudy",
  3: "overcast",
  45: "fog",
  48: "depositing rime fog",
  51: "light drizzle",
  53: "drizzle",
  55: "heavy drizzle",
  61: "light rain",
  63: "rain",
  65: "heavy rain",
  71: "light snow",
  73: "snow",
  75: "heavy snow",
  80: "rain showers",
  81: "rain showers",
  82: "heavy rain showers",
  95: "thunderstorm",
  96: "thunderstorm with hail",
  99: "thunderstorm with hail",
};

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
  };
}

export function minimalGameContexts(games: Game[]): GameContext[] {
  return games.map((game) => ({
    id: game.id,
    away: game.away,
    home: game.home,
    kickoffEt: game.kickoffEt,
    venue: null,
    awaySide: {
      code: game.away,
      record: null,
      recent: null,
      injuries: null,
      injuriesNote: "not fetched",
    },
    homeSide: {
      code: game.home,
      record: null,
      recent: null,
      injuries: null,
      injuriesNote: "not fetched",
    },
    weather: { status: "unavailable", note: "not fetched" },
  }));
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index]);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () =>
    worker(),
  );
  await Promise.all(workers);
  return results;
}

function countryCodeForGeocode(country: string | null): string | null {
  if (!country) return "US";
  const normalized = country.trim().toLowerCase();
  if (normalized === "usa" || normalized === "us" || normalized === "united states") {
    return "US";
  }
  if (normalized === "australia" || normalized === "aus") return "AU";
  if (normalized === "germany" || normalized === "deu" || normalized === "de") return "DE";
  if (normalized === "uk" || normalized === "united kingdom" || normalized === "england") {
    return "GB";
  }
  if (normalized === "mexico" || normalized === "mex") return "MX";
  if (normalized === "brazil" || normalized === "bra") return "BR";
  if (normalized === "canada" || normalized === "can") return "CA";
  // Unknown international label — omit country filter rather than force US.
  return null;
}

async function geocodeCity(
  city: string,
  state: string | null,
  country: string | null,
  fetcher: EspnFetch,
): Promise<{ lat: number; lon: number } | null> {
  const params = new URLSearchParams({
    name: city,
    count: "1",
    language: "en",
    format: "json",
  });
  const countryCode = countryCodeForGeocode(country);
  if (countryCode) params.set("countryCode", countryCode);
  if (state && countryCode === "US") params.set("admin1", state);
  try {
    const payload = (await fetcher(
      `https://geocoding-api.open-meteo.com/v1/search?${params}`,
    )) as { results?: Array<{ latitude?: number; longitude?: number }> };
    const hit = payload.results?.[0];
    if (
      hit &&
      typeof hit.latitude === "number" &&
      typeof hit.longitude === "number"
    ) {
      return { lat: hit.latitude, lon: hit.longitude };
    }
  } catch {
    return null;
  }
  return null;
}

export async function fetchKickoffWeather(
  city: string | null,
  state: string | null,
  country: string | null,
  kickoffUtc: string,
  indoor: boolean | null,
  fetcher: EspnFetch = async (url) => {
    const res = await fetch(url, {
      headers: { "User-Agent": "nfl-llm-picks/0.1 (public weather)" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.json();
  },
): Promise<WeatherContext> {
  if (indoor === true) {
    return { status: "indoor", note: "Dome / indoor stadium — weather not a factor" };
  }
  if (!city || !kickoffUtc) {
    return { status: "unavailable", note: "venue or kickoff unknown" };
  }
  const coords = await geocodeCity(city, state, country, fetcher);
  if (!coords) {
    return { status: "unavailable", note: `could not geocode ${city}` };
  }
  const kickoff = new Date(kickoffUtc);
  if (Number.isNaN(kickoff.getTime())) {
    return { status: "unavailable", note: "invalid kickoff" };
  }
  // Align to the forecast hour containing kickoff (UTC). Open-Meteo wants YYYY-MM-DDTHH:00.
  const hourIso = `${kickoff.toISOString().slice(0, 13)}:00`;

  const params = new URLSearchParams({
    latitude: String(coords.lat),
    longitude: String(coords.lon),
    hourly: "temperature_2m,precipitation_probability,weather_code",
    temperature_unit: "fahrenheit",
    timezone: "UTC",
    start_hour: hourIso,
    end_hour: hourIso,
  });
  try {
    const payload = (await fetcher(
      `https://api.open-meteo.com/v1/forecast?${params}`,
    )) as {
      hourly?: {
        time?: string[];
        temperature_2m?: Array<number | null>;
        precipitation_probability?: Array<number | null>;
        weather_code?: Array<number | null>;
      };
    };
    const temp = payload.hourly?.temperature_2m?.[0];
    if (typeof temp !== "number") {
      return { status: "unavailable", note: "forecast missing for kickoff hour" };
    }
    const code = payload.hourly?.weather_code?.[0];
    const precip = payload.hourly?.precipitation_probability?.[0];
    const summary =
      typeof code === "number"
        ? (WMO_SUMMARY[code] ?? `weather code ${code}`)
        : "unknown conditions";
    return {
      status: "forecast",
      tempF: Math.round(temp),
      precipProb: typeof precip === "number" ? precip : null,
      summary,
    };
  } catch {
    return { status: "unavailable", note: "weather fetch failed" };
  }
}

function sideContext(
  code: string,
  record: string | null,
  recent: RecentResult[] | null,
  injuries: InjuryNote[] | null,
  injuriesNote?: string,
): TeamSideContext {
  return { code, record, recent, injuries, injuriesNote };
}

/**
 * Build per-game context for the pick prompt: form, injuries, venue, weather.
 * Never includes betting lines/odds even when ESPN summary payloads contain them.
 */
export async function buildWeekContexts(
  slate: ScoreboardResult,
  fetcher?: EspnFetch,
  options?: { recentN?: number; injuryLimit?: number },
): Promise<GameContext[]> {
  const recentN = options?.recentN ?? RECENT_N;
  const injuryLimit = options?.injuryLimit ?? INJURY_LIMIT;
  const extrasById = slate.extras ?? {};

  const teamIds = new Map<string, string>();
  for (const game of slate.games) {
    const extras = extrasById[game.id] ?? emptyExtras();
    if (extras.awayEspnId) teamIds.set(game.away, extras.awayEspnId);
    if (extras.homeEspnId) teamIds.set(game.home, extras.homeEspnId);
  }

  const formByTeam = new Map<string, RecentResult[] | null>();
  await mapPool([...teamIds.entries()], 6, async ([code, espnId]) => {
    try {
      const recent = await fetchTeamRecentForm(
        espnId,
        slate.season,
        slate.week,
        recentN,
        fetcher,
      );
      formByTeam.set(code, recent);
    } catch {
      formByTeam.set(code, null);
    }
    return null;
  });

  const injuryByGame = new Map<
    string,
    { away: InjuryNote[] | null; home: InjuryNote[] | null; note?: string }
  >();
  await mapPool(slate.games, 6, async (game) => {
    try {
      const raw = await fetchGameInjuries(game.id, injuryLimit, fetcher);
      injuryByGame.set(game.id, {
        away: raw[game.away] ?? [],
        home: raw[game.home] ?? [],
      });
    } catch {
      injuryByGame.set(game.id, {
        away: null,
        home: null,
        note: "injury report unavailable",
      });
    }
    return null;
  });

  const contexts: GameContext[] = [];
  for (const game of slate.games) {
    const extras = extrasById[game.id] ?? emptyExtras();
    const injuries = injuryByGame.get(game.id);
    const venue =
      extras.venueName || extras.indoor !== null
        ? {
            name: extras.venueName,
            city: extras.venueCity,
            state: extras.venueState,
            indoor: extras.indoor,
          }
        : null;
    const weather = await fetchKickoffWeather(
      extras.venueCity,
      extras.venueState,
      extras.venueCountry,
      game.kickoffUtc,
      extras.indoor,
      fetcher,
    );
    contexts.push({
      id: game.id,
      away: game.away,
      home: game.home,
      kickoffEt: game.kickoffEt,
      venue,
      awaySide: sideContext(
        game.away,
        extras.awayRecord,
        formByTeam.has(game.away) ? formByTeam.get(game.away)! : null,
        injuries?.away ?? null,
        injuries?.away === null ? injuries.note : undefined,
      ),
      homeSide: sideContext(
        game.home,
        extras.homeRecord,
        formByTeam.has(game.home) ? formByTeam.get(game.home)! : null,
        injuries?.home ?? null,
        injuries?.home === null ? injuries.note : undefined,
      ),
      weather,
    });
  }
  return contexts;
}
