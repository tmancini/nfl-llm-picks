import { describe, expect, it } from "vitest";
import { parseEspnScoreboard, parseNflverseScheduleCsv } from "../lib/espn";
import { parsePicksPayload, validatePicks, isFillerRationale } from "../lib/picks";
import { gradePick, recordForModel, gradeWeekFile } from "../lib/grade";
import { applyLocks, scaffoldWeekFile, weekHasPicks } from "../lib/lock";
import { seasonStandings, formatRecord } from "../lib/standings";
import { parseCliArgs } from "../lib/cli";
import { consensusWinner } from "../lib/consensus";
import { normalizeTeamCode } from "../lib/teams";
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
          competitors: [
            {
              homeAway: "home",
              score: "0",
              team: { abbreviation: "KC", displayName: "Kansas City Chiefs" },
            },
            {
              homeAway: "away",
              score: "0",
              team: { abbreviation: "PHI", displayName: "Philadelphia Eagles" },
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
    week.picks["openai/gpt-5.6-sol"] = [
      { gameId: "1", winner: "KC", rationale: "Home field." },
    ];
    week.picks["anthropic/claude-opus-5"] = [
      { gameId: "1", winner: "PHI", rationale: "Eagles road form." },
    ];
    const graded = gradeWeekFile(week);
    const standings = seasonStandings([graded], 2026);
    const sol = standings.find((row) => row.modelId === "openai/gpt-5.6-sol");
    const opus = standings.find((row) => row.modelId === "anthropic/claude-opus-5");
    expect(sol?.wins).toBe(1);
    expect(opus?.losses).toBe(1);
    expect(formatRecord(sol!)).toBe("1–0");
  });
});

describe("lock protocol", () => {
  it("retries unusable JSON once, then accepts the first valid parse", async () => {
    const games = [game({ id: "1", away: "PHI", home: "KC" })];
    const week = scaffoldWeekFile(2026, 2, games);
    let calls = 0;
    const locked = await applyLocks(week, {
      async complete(model) {
        if (model !== "openai/gpt-5.6-sol") {
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
    expect(locked.picks["openai/gpt-5.6-sol"][0].winner).toBe("KC");
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
    expect(second.picks["openai/gpt-5.6-sol"][0].winner).toBe("KC");
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
