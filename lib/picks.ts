import type { Game, Pick } from "./types";
import { normalizeTeamCode } from "./teams";

const FILLER =
  /^(yes|no|idk|n\/a|na|winner|the winner|better team|they win|because they will win)\.?$/i;

export function isFillerRationale(rationale: string | undefined): boolean {
  const text = (rationale ?? "").trim();
  if (text.length < 20) return true;
  if (FILLER.test(text)) return true;
  if (/sample pick/i.test(text)) return true;
  return false;
}

export function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Response did not contain a JSON object");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

export function parsePicksPayload(raw: string): Pick[] {
  const parsed = extractJsonObject(raw) as { picks?: unknown };
  if (!Array.isArray(parsed.picks)) {
    throw new Error("JSON missing picks array");
  }
  return parsed.picks.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error(`Pick ${index} is not an object`);
    }
    const row = item as { gameId?: unknown; winner?: unknown; rationale?: unknown };
    if (typeof row.gameId !== "string" && typeof row.gameId !== "number") {
      throw new Error(`Pick ${index} missing gameId`);
    }
    if (typeof row.winner !== "string") {
      throw new Error(`Pick ${index} missing winner`);
    }
    return {
      gameId: String(row.gameId),
      winner: row.winner,
      rationale: typeof row.rationale === "string" ? row.rationale.trim() : "",
    };
  });
}

export function validatePicks(games: Game[], picks: Pick[]): Pick[] {
  const byId = new Map(games.map((game) => [game.id, game]));
  const seen = new Set<string>();
  const normalized: Pick[] = [];

  for (const pick of picks) {
    const game = byId.get(pick.gameId);
    if (!game) {
      throw new Error(`Pick for unknown game ${pick.gameId}`);
    }
    if (seen.has(pick.gameId)) {
      throw new Error(`Duplicate pick for game ${pick.gameId}`);
    }
    const winner = normalizeTeamCode(pick.winner);
    if (!winner) {
      throw new Error(`Unrecognized team ${pick.winner} for game ${pick.gameId}`);
    }
    if (winner !== game.home && winner !== game.away) {
      throw new Error(
        `Team ${winner} is not on the slate for ${game.away}@${game.home}`,
      );
    }
    seen.add(pick.gameId);
    normalized.push({
      gameId: pick.gameId,
      winner,
      rationale: pick.rationale,
    });
  }

  const missing = games.filter((game) => !seen.has(game.id));
  if (missing.length > 0) {
    throw new Error(
      `Missing picks for ${missing.map((g) => `${g.away}@${g.home}`).join(", ")}`,
    );
  }

  return normalized;
}
