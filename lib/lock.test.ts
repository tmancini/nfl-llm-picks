import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  parseEspnInjuries,
  parseEspnScoreboard,
  parseNflverseScheduleCsv,
  parseTeamRecentForm,
} from "../lib/espn";
import { gamesForPrompt, userPrompt } from "../lib/prompt";
import { minimalGameContexts } from "../lib/context";
import { parsePicksPayload, validatePicks, isFillerRationale } from "../lib/picks";
import { gradePick, recordForModel, gradeWeekFile } from "../lib/grade";
import { applyLocks, lockModelPicks, scaffoldWeekFile, weekHasPicks } from "../lib/lock";
import { assertCappedOpenRouterKey, createOpenRouterClient } from "../lib/openrouter";
import { seasonStandings, formatRecord } from "../lib/standings";
import { parseCliArgs } from "../lib/cli";
import { consensusWinner } from "../lib/consensus";
import { normalizeTeamCode } from "../lib/teams";
import { seasonTrends } from "../lib/trends";
import { archiveOriginalWeek, listWeekFiles, readCheckpointFile, readRevisionCheckpointFile, removeCheckpointFile, removeRevisionCheckpointFile, writeCheckpointFile, writeRevisionCheckpointFile, writeWeekFile } from "../lib/store";
import type { Game } from "../lib/types";

const espnFixture = {
  season: { year: 2026, type: 2 },
  week: { number: 2 },
  events: [
    {
      id: "401772001",
      date: "2026-09-18T00:15Z",
      competitions: [
        {
          status: { type: { state: "pre", completed: false } },
          odds: [{
            provider: { name: "DraftKings" },
            spread: -3.5,
            moneyline: {
              home: { close: { odds: "-175" } },
              away: { close: { odds: "+145" } },
            },
          }],
          venue: {
            fullName: "GEHA Field at Arrowhead Stadium",
            indoor: false,
            address: { city: "Kansas City", state: "MO", country: "USA" },
          },
          competitors: [
            {
              homeAway: "home",
              score: "0",
              records: [{ type: "total", summary: "1-0" }],
              team: {
                id: "12",
                abbreviation: "KC",
                displayName: "Kansas City Chiefs",
              },
            },
            {
              homeAway: "away",
              score: "0",
              records: [{ type: "total", summary: "1-0" }],
              team: {
                id: "21",
                abbreviation: "PHI",
                displayName: "Philadelphia Eagles",
              },
            },
          ],
        },
      ],
    },
    {
      id: "401772002",
      date: "2026-09-20T17:00Z",
      competitions: [
        {
          status: { type: { state: "post", completed: true } },
          venue: {
            fullName: "Northwest Stadium",
            indoor: false,
            address: { city: "Landover", state: "MD", country: "USA" },
          },
          competitors: [
            {
              homeAway: "home",
              score: "17",
              team: { abbreviation: "WSH", displayName: "Washington Commanders" },
            },
            {
              homeAway: "away",
              score: "17",
              team: { abbreviation: "NYG", displayName: "New York Giants" },
            },
          ],
        },
      ],
    },
  ],
};

function game(partial: Partial<Game> & Pick<Game, "id" | "away" | "home">): Game {
  return {
    awayName: partial.away,
    homeName: partial.home,
    kickoffUtc: "2026-09-18T00:15:00Z",
    kickoffEt: "Thu, Sep 17, 8:15 PM ET",
    status: "scheduled",
    homeScore: null,
    awayScore: null,
    winner: null,
    ...partial,
  };
}

describe("ESPN parser", () => {
  it("parses slate, aliases, finals, and ties", () => {
    const parsed = parseEspnScoreboard(espnFixture);
    expect(parsed.season).toBe(2026);
    expect(parsed.week).toBe(2);
    expect(parsed.games).toHaveLength(2);
    expect(parsed.games[0]).toMatchObject({
      id: "401772001",
      away: "PHI",
      home: "KC",
      status: "scheduled",
      winner: null,
    });
    expect(parsed.games[1]).toMatchObject({
      away: "NYG",
      home: "WSH",
      status: "final",
      homeScore: 17,
      awayScore: 17,
      winner: null,
    });
    expect(parsed.extras["401772001"]).toMatchObject({
      venueName: "GEHA Field at Arrowhead Stadium",
      venueCity: "Kansas City",
      indoor: false,
      homeRecord: "1-0",
      awayRecord: "1-0",
      homeEspnId: "12",
      awayEspnId: "21",
      market: {
        source: "DraftKings via ESPN",
        homeMoneyline: -175,
        awayMoneyline: 145,
        homeSpread: -3.5,
      },
    });
  });

  it("parses nflverse CSV fallback rows", () => {
    const csv = [
      "season,week,game_id,home_team,away_team,gameday",
      "2026,2,2026_02_PHI_KC,KC,PHI,2026-09-17T20:15:00Z",
      "2025,1,skip,KC,PHI,2025-09-07T20:15:00Z",
    ].join("\n");
    const games = parseNflverseScheduleCsv(csv, 2026, 2);
    expect(games).toHaveLength(1);
    expect(games[0].home).toBe("KC");
    expect(games[0].away).toBe("PHI");
  });

  it("parses injuries without touching odds payloads", () => {
    const notes = parseEspnInjuries({
      odds: [{ details: "DO NOT USE" }],
      pickcenter: [{ spread: -3 }],
      injuries: [
        {
          team: { abbreviation: "KC" },
          injuries: [
            {
              status: "Out",
              athlete: {
                displayName: "Patrick Mahomes",
                position: { abbreviation: "QB" },
              },
              details: { type: "Ankle" },
            },
            {
              status: "Questionable",
              athlete: {
                displayName: "Travis Kelce",
                position: { abbreviation: "TE" },
              },
              details: { type: "Knee" },
            },
          ],
        },
      ],
    });
    expect(notes.KC).toEqual([
      {
        player: "Patrick Mahomes",
        position: "QB",
        status: "Out",
        detail: "Ankle",
      },
      {
        player: "Travis Kelce",
        position: "TE",
        status: "Questionable",
        detail: "Knee",
      },
    ]);
  });

  it("parses recent form from a team schedule", () => {
    const recent = parseTeamRecentForm(
      {
        team: { abbreviation: "KC" },
        events: [
          {
            week: { number: 1 },
            seasonType: { type: 2 },
            competitions: [
              {
                status: { type: { completed: true, state: "post" } },
                neutralSite: false,
                competitors: [
                  {
                    homeAway: "home",
                    winner: true,
                    score: { value: 27, displayValue: "27" },
                    team: { id: "12", abbreviation: "KC" },
                  },
                  {
                    homeAway: "away",
                    winner: false,
                    score: { value: 20, displayValue: "20" },
                    team: { id: "21", abbreviation: "PHI" },
                  },
                ],
              },
            ],
          },
          {
            week: { number: 2 },
            seasonType: { type: 2 },
            competitions: [
              {
                status: { type: { completed: false, state: "pre" } },
                competitors: [
                  {
                    homeAway: "home",
                    team: { id: "12", abbreviation: "KC" },
                  },
                  {
                    homeAway: "away",
                    team: { id: "22", abbreviation: "NYG" },
                  },
                ],
              },
            ],
          },
        ],
      },
      "KC",
      2,
      3,
    );
    expect(recent).toEqual([
      {
        week: 1,
        opponent: "PHI",
        location: "home",
        result: "W",
        score: "27-20",
      },
    ]);
  });
});

describe("prompt context", () => {
  it("embeds market context and asks for accuracy without forced upsets", () => {
    const games = minimalGameContexts([
      game({ id: "1", away: "PHI", home: "KC", kickoffEt: "Thu 8:15 PM ET" }),
    ]);
    games[0].awaySide.record = "1-0";
    games[0].homeSide.recent = [
      {
        week: 1,
        opponent: "LAC",
        location: "home",
        result: "W",
        score: "27-20",
      },
    ];
    games[0].weather = {
      status: "forecast",
      tempF: 72,
      precipProb: 10,
      summary: "partly cloudy",
    };
    games[0].market = {
      source: "DraftKings via ESPN",
      homeMoneyline: -175,
      awayMoneyline: 145,
      homeSpread: -3.5,
      fetchedAtUtc: "2026-09-16T14:00:00Z",
    };
    const prompt = userPrompt(2026, 2, games);
    expect(prompt).toContain("Do not force a number of upsets");
    expect(prompt).toContain("Avoid double-counting news");
    expect(prompt).toContain("partly cloudy");
    const packed = gamesForPrompt(games)[0] as Record<string, unknown>;
    expect(packed.gameId).toBe("1");
    expect(packed.market).toMatchObject({ homeMoneyline: -175, awayMoneyline: 145 });
    expect(JSON.stringify(packed)).toContain("2026-09-16T14:00:00Z");
  });

  it("withholds market prices in an independent revision", () => {
    const games = minimalGameContexts([game({ id: "1", away: "PHI", home: "KC" })]);
    games[0].market = {
      source: "DraftKings via ESPN",
      homeMoneyline: -175,
      awayMoneyline: 145,
      homeSpread: -3.5,
      fetchedAtUtc: "2026-09-24T12:00:00Z",
    };
    const prompt = userPrompt(2026, 3, games, "independent");
    expect(gamesForPrompt(games, "independent")[0]).not.toHaveProperty("market");
    expect(prompt).not.toContain("-175");
    expect(prompt).not.toContain("DraftKings");
    expect(prompt).toContain("Do not consult or use sportsbook odds");
  });
});

describe("picks", () => {
  const slate = [
    game({ id: "1", away: "PHI", home: "KC" }),
    game({ id: "2", away: "NYG", home: "WSH" }),
  ];

  it("parses fenced JSON and normalizes WAS to WSH", () => {
    const raw = '```json\n{"picks":[{"gameId":"1","winner":"KC","rationale":"Mahomes at home in September still matters."},{"gameId":"2","winner":"WAS","rationale":"Commanders have the cleaner quarterback situation."}]}\n```';
    const picks = validatePicks(slate, parsePicksPayload(raw));
    expect(picks[1].winner).toBe("WSH");
  });

  it("rejects a missing game, unknown team, and extras stay invalid via missing coverage", () => {
    expect(() =>
      validatePicks(slate, [
        { gameId: "1", winner: "KC", rationale: "enough characters here" },
      ]),
    ).toThrow(/Missing picks/);
    expect(() =>
      validatePicks(slate, [
        { gameId: "1", winner: "DAL", rationale: "enough characters here" },
        { gameId: "2", winner: "WSH", rationale: "enough characters here" },
      ]),
    ).toThrow(/not on the slate/);
  });

  it("flags filler rationale", () => {
    expect(isFillerRationale("win")).toBe(true);
    expect(isFillerRationale("Chiefs offensive line should control this one.")).toBe(
      false,
    );
  });
});

describe("independent revision batches", () => {
  it("requests Gemini in two eight-game sets and validates all 16 picks", async () => {
    const games = Array.from({ length: 16 }, (_, index) => game({
      id: String(index + 1),
      away: "PHI",
      home: "KC",
    }));
    const contexts = minimalGameContexts(games);
    const sizes: number[] = [];
    const picks = await lockModelPicks({
      async complete(_model, _system, user) {
        const ids = (JSON.parse(user.split("Games:\n")[1]) as Array<{ gameId: string }>).map((entry) => entry.gameId);
        sizes.push(ids.length);
        return JSON.stringify({ picks: ids.map((gameId) => ({
          gameId,
          winner: "KC",
          rationale: "KC has the stronger matchup this week.",
        })) });
      },
    }, "google/gemini-3.1-pro-preview", 2026, 3, games, contexts, 2, "independent");
    expect(sizes).toEqual([8, 8]);
    expect(picks).toHaveLength(16);
  });
});

describe("grade + standings", () => {
  it("scores wins, losses, pushes, and pending", () => {
    const games = [
      game({ id: "1", away: "PHI", home: "KC", status: "final", winner: "KC", homeScore: 24, awayScore: 17 }),
      game({ id: "2", away: "NYG", home: "WSH", status: "final", winner: null, homeScore: 17, awayScore: 17 }),
      game({ id: "3", away: "DAL", home: "NYG", status: "scheduled" }),
    ];
    const picks = [
      { gameId: "1", winner: "KC", rationale: "x" },
      { gameId: "2", winner: "WSH", rationale: "x" },
      { gameId: "3", winner: "DAL", rationale: "x" },
    ];
    expect(gradePick(games[0], picks[0])).toBe("win");
    expect(gradePick(games[1], picks[1])).toBe("push");
    expect(gradePick(games[2], picks[2])).toBe("pending");
    expect(recordForModel(games, picks)).toEqual({
      wins: 1,
      losses: 0,
      pushes: 1,
      pending: 1,
    });
  });

  it("aggregates season records", () => {
    const week = scaffoldWeekFile(2026, 1, [
      game({ id: "1", away: "PHI", home: "KC", status: "final", winner: "KC", homeScore: 21, awayScore: 7 }),
    ]);
    week.models = week.models.map((model) =>
      model.id.startsWith("anthropic/")
        ? { id: "anthropic/claude-fable-5.1", label: "Claude Fable 5.1", shortLabel: "Fable" }
        : model,
    );
    week.picks["openai/gpt-6-astra"] = [
      { gameId: "1", winner: "KC", rationale: "Home field." },
    ];
    week.picks["anthropic/claude-fable-5.1"] = [
      { gameId: "1", winner: "PHI", rationale: "Eagles road form." },
    ];
    const graded = gradeWeekFile(week);
    const standings = seasonStandings([graded], 2026);
    const astra = standings.find((row) => row.modelId === "openai/gpt-6-astra");
    const opus = standings.find((row) => row.modelId === "anthropic/claude-opus-5.5");
    expect(astra?.wins).toBe(1);
    expect(opus?.losses).toBe(1);
    expect(formatRecord(astra!)).toBe("1–0");
  });

  it("tracks cumulative accuracy by provider across model changes", () => {
    const first = scaffoldWeekFile(2026, 2, [
      game({ id: "1", away: "PHI", home: "KC", status: "final", winner: "KC" }),
    ]);
    first.source = "openrouter";
    first.models = first.models.map((model) =>
      model.id.startsWith("anthropic/")
        ? { id: "anthropic/claude-fable-5.1", label: "Claude Fable 5.1", shortLabel: "Fable" }
        : model,
    );
    first.records["anthropic/claude-fable-5.1"] = { wins: 1, losses: 0, pushes: 0, pending: 0 };
    const second = scaffoldWeekFile(2026, 3, [
      game({ id: "2", away: "PHI", home: "KC", status: "final", winner: "PHI" }),
    ]);
    second.source = "openrouter";
    second.records["anthropic/claude-opus-5.5"] = { wins: 0, losses: 1, pushes: 0, pending: 0 };
    const trend = seasonTrends([second, first], 2026).find((item) => item.provider === "anthropic");
    expect(trend?.label).toBe("Anthropic");
    expect(trend?.points).toEqual([
      { week: 2, wins: 1, losses: 0, rate: 1 },
      { week: 3, wins: 1, losses: 1, rate: 0.5 },
    ]);
  });
});

describe("lock protocol", () => {
  it("gives each model capped live web search with structured output", async () => {
    let body: Record<string, unknown> | null = null;
    let referer: string | null = null;
    const fetcher = async (_url: RequestInfo | URL, init?: RequestInit) => {
      body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      referer = new Headers(init?.headers).get("HTTP-Referer");
      return {
        ok: true,
        json: async () => ({ choices: [{ message: { content: '{"picks":[]}' } }] }),
      } as Response;
    };
    await createOpenRouterClient("test", fetcher as typeof fetch)
      .complete("openai/gpt-6-astra", "system", "user");
    expect(body).toMatchObject({
      provider: { require_parameters: true },
      response_format: { type: "json_schema" },
      plugins: [{ id: "response-healing" }],
      tools: [{
        type: "openrouter:web_search",
        parameters: {
          engine: "exa",
          max_results: 2,
          max_total_results: 6,
          search_context_size: "low",
        },
      }],
    });
    expect(referer).toBe("https://github.com/tmancini/nfl-llm-picks");
  });

  it("rejects an uncapped API key before paid calls", async () => {
    const response = (limit: number | null, reset: string | null, remaining: number) =>
      async () => ({ ok: true, json: async () => ({ data: { limit, limit_reset: reset, limit_remaining: remaining } }) }) as Response;
    await expect(assertCappedOpenRouterKey("test", response(null, null, 1) as typeof fetch))
      .rejects.toThrow("daily spending limit");
    await expect(assertCappedOpenRouterKey("test", response(1, "daily", 0.3) as typeof fetch))
      .rejects.toThrow("$0.75");
    await expect(assertCappedOpenRouterKey("test", response(1, "daily", 1) as typeof fetch))
      .resolves.toBeUndefined();
    await expect(assertCappedOpenRouterKey("test", response(2, "daily", 1.3) as typeof fetch, 2))
      .resolves.toBeUndefined();
    await expect(assertCappedOpenRouterKey("test", response(2, "daily", 1.3) as typeof fetch))
      .rejects.toThrow("$1 or less");
    await expect(assertCappedOpenRouterKey("test", response(2, "daily", 0.61) as typeof fetch, 2, 0.5))
      .resolves.toBeUndefined();
  });

  it("checkpoints valid models and resumes without paying for them again", async () => {
    const games = [game({ id: "1", away: "PHI", home: "KC" })];
    const week = scaffoldWeekFile(2026, 3, games);
    const checkpoints: typeof week[] = [];
    await expect(applyLocks(week, {
      async complete(model) {
        if (model === "google/gemini-3.1-pro-preview") return "invalid";
        return JSON.stringify({ picks: [{ gameId: "1", winner: "KC", rationale: "KC is the stronger side." }] });
      },
    }, undefined, (partial) => { checkpoints.push(partial); })).rejects.toThrow("No usable pick set");

    const partial = checkpoints.at(-1)!;
    expect(partial.source).toBe("openrouter");
    expect(partial.lockedAt).toBeNull();
    expect(partial.picks["openai/gpt-6-astra"]).toHaveLength(1);
    expect(partial.picks["anthropic/claude-opus-5.5"]).toHaveLength(1);

    const called: string[] = [];
    const complete = await applyLocks(partial, {
      async complete(model) {
        called.push(model);
        return JSON.stringify({ picks: [{ gameId: "1", winner: "KC", rationale: "KC is the stronger side." }] });
      },
    });
    expect(called).toEqual(["google/gemini-3.1-pro-preview", "x-ai/grok-4.7"]);
    expect(weekHasPicks(complete)).toBe(true);
  });

  it("keeps incomplete checkpoints out of the published week list", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "nfllm-lock-"));
    try {
      const partial = scaffoldWeekFile(2026, 3, [game({ id: "1", away: "PHI", home: "KC" })]);
      writeCheckpointFile(partial, cwd);
      expect(readCheckpointFile(2026, 3, cwd)?.week).toBe(3);
      expect(listWeekFiles(cwd)).toEqual([]);
      removeCheckpointFile(2026, 3, cwd);
      expect(readCheckpointFile(2026, 3, cwd)).toBeNull();
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("preserves the original and keeps a revision checkpoint unpublished", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "nfllm-revision-"));
    try {
      const original = scaffoldWeekFile(2026, 3, [game({ id: "1", away: "PHI", home: "KC" })]);
      original.picks[original.models[0].id] = [{ gameId: "1", winner: "KC", rationale: "Original pick." }];
      writeWeekFile(original, cwd);
      const archive = archiveOriginalWeek(original, cwd);
      const partial = { ...original, revision: { originalLockedAt: "2026-09-24T05:00:00Z", originalPath: "data/archives/2026-w03-original.json", promptMode: "independent" as const } };
      writeRevisionCheckpointFile(partial, cwd);
      expect(readRevisionCheckpointFile(2026, 3, cwd)?.revision?.promptMode).toBe("independent");
      expect(listWeekFiles(cwd)[0].revision).toBeUndefined();
      expect(JSON.parse(readFileSync(archive, "utf8")).picks[original.models[0].id][0].winner).toBe("KC");
      removeRevisionCheckpointFile(2026, 3, cwd);
      expect(readRevisionCheckpointFile(2026, 3, cwd)).toBeNull();
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("retries unusable JSON once, then accepts the first valid parse", async () => {
    const games = [game({ id: "1", away: "PHI", home: "KC" })];
    const week = scaffoldWeekFile(2026, 2, games);
    let calls = 0;
    const locked = await applyLocks(week, {
      async complete(model) {
        if (model !== "openai/gpt-6-astra") {
          return JSON.stringify({
            picks: [{ gameId: "1", winner: "PHI", rationale: "Road dog with a plan." }],
          });
        }
        calls += 1;
        if (calls === 1) return "not json";
        return JSON.stringify({
          picks: [{ gameId: "1", winner: "KC", rationale: "Mahomes at Arrowhead." }],
        });
      },
    });
    expect(calls).toBe(2);
    expect(locked.picks["openai/gpt-6-astra"][0].winner).toBe("KC");
    expect(weekHasPicks(locked)).toBe(true);
    expect(locked.lockedAt).toBeTruthy();
  });

  it("is idempotent once picks exist", async () => {
    const games = [game({ id: "1", away: "PHI", home: "KC" })];
    const week = scaffoldWeekFile(2026, 2, games);
    const first = await applyLocks(week, {
      async complete() {
        return JSON.stringify({
          picks: [{ gameId: "1", winner: "KC", rationale: "Chiefs at home." }],
        });
      },
    });
    let extra = 0;
    const second = await applyLocks(first, {
      async complete() {
        extra += 1;
        return "nope";
      },
    });
    expect(extra).toBe(0);
    expect(second.picks["openai/gpt-6-astra"][0].winner).toBe("KC");
  });

  it("does not ask three times or vote", async () => {
    const games = [game({ id: "1", away: "PHI", home: "KC" })];
    const week = scaffoldWeekFile(2026, 2, games);
    const counts = new Map<string, number>();
    await applyLocks(week, {
      async complete(model) {
        counts.set(model, (counts.get(model) ?? 0) + 1);
        return JSON.stringify({
          picks: [{ gameId: "1", winner: "KC", rationale: "One call per model." }],
        });
      },
    });
    expect([...counts.values()].every((n) => n === 1)).toBe(true);
    expect(counts.size).toBe(4);
  });
});

describe("cli + consensus", () => {
  it("parses season and week flags", () => {
    expect(parseCliArgs(["--season", "2026", "--week", "2"])).toEqual({
      season: 2026,
      week: 2,
    });
    expect(parseCliArgs(["--fixture", "--force"])).toEqual({
      fixture: true,
      force: true,
    });
    expect(parseCliArgs(["--context-only"])).toEqual({
      contextOnly: true,
    });
    expect(parseCliArgs(["--season", "2026", "--week", "3", "--revise"])).toEqual({
      season: 2026,
      week: 3,
      revise: true,
    });
    expect(() => parseCliArgs(["--force", "--revise"])).toThrow();
  });

  it("marks 3-of-4 agreement as consensus", () => {
    expect(consensusWinner(["KC", "KC", "KC", "PHI"])).toBe("KC");
    expect(consensusWinner(["KC", "KC", "PHI", "PHI"])).toBeNull();
  });

  it("normalizes common aliases", () => {
    expect(normalizeTeamCode("was")).toBe("WSH");
    expect(normalizeTeamCode("JAC")).toBe("JAX");
    expect(normalizeTeamCode("LA")).toBe("LAR");
  });
});
