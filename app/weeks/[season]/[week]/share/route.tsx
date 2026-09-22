import { ImageResponse } from "next/og";
import { pickFor, pickResult } from "@/lib/board";
import { formatRecord, seasonStandings, standingForModel } from "@/lib/standings";
import { listWeekFiles, loadWeek } from "@/lib/weeks";

export const runtime = "nodejs";

const ink = "#102038";
const muted = "#6b7c90";
const rule = "#c9d3de";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ season: string; week: string }> },
) {
  const { season: seasonParam, week: weekParam } = await params;
  const season = Number(seasonParam);
  const weekNumber = Number(weekParam);
  const week = loadWeek(season, weekNumber);
  if (!week) return new Response("Week not found", { status: 404 });

  const scoped = listWeekFiles().filter(
    (entry) => entry.season === season && entry.week <= weekNumber,
  );
  const standings = seasonStandings(scoped, season);
  const rowHeight = Math.min(50, Math.floor(820 / Math.max(week.games.length, 1)));
  const download = new URL(request.url).searchParams.has("download");

  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#eef1f4", color: ink, padding: 38, fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 18 }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: 2 }}>NFLLM</div>
          <div style={{ fontSize: 46, fontWeight: 800, letterSpacing: -1 }}>{`Week ${week.week} picks`}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", fontSize: 19, color: muted }}>
          <span>{week.season} NFL season</span>
          <span>{week.source === "openrouter" ? "Four models · straight up" : "Slate preview"}</span>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", border: `2px solid ${rule}`, background: "#fbfcfd" }}>
        <div style={{ display: "flex", height: 58, background: "#0d2137", color: "white", alignItems: "center" }}>
          <div style={{ display: "flex", width: 280, paddingLeft: 18, fontSize: 19, fontWeight: 700 }}>GAME</div>
          {week.models.map((model) => (
            <div key={model.id} style={{ display: "flex", width: 210, justifyContent: "center", fontSize: 19, fontWeight: 700 }}>
              {model.shortLabel.toUpperCase()}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", height: 42, alignItems: "center", background: "#e8eef3", borderBottom: `1px solid ${rule}` }}>
          <div style={{ display: "flex", width: 280, paddingLeft: 18, fontSize: 18, fontWeight: 700 }}>THIS WEEK</div>
          {week.models.map((model) => (
            <div key={model.id} style={{ display: "flex", width: 210, justifyContent: "center", fontSize: 20, fontWeight: 700 }}>
              {formatRecord(week.records[model.id] ?? { wins: 0, losses: 0, pushes: 0 })}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", height: 42, alignItems: "center", background: "#e8eef3", borderBottom: `2px solid ${rule}` }}>
          <div style={{ display: "flex", width: 280, paddingLeft: 18, fontSize: 18, fontWeight: 700 }}>SEASON</div>
          {week.models.map((model) => {
            const standing = standingForModel(standings, model.id);
            return (
              <div key={model.id} style={{ display: "flex", width: 210, justifyContent: "center", fontSize: 20 }}>
                {standing ? formatRecord(standing) : "0–0"}
              </div>
            );
          })}
        </div>
        {week.games.map((game, index) => (
          <div key={game.id} style={{ display: "flex", height: rowHeight, alignItems: "center", background: index % 2 === 0 ? "#fbfcfd" : "#f3f6f8", borderBottom: index === week.games.length - 1 ? "none" : `1px solid ${rule}` }}>
            <div style={{ display: "flex", flexDirection: "column", width: 280, paddingLeft: 18 }}>
              <span style={{ fontSize: 21, fontWeight: 700 }}>{`${game.away} @ ${game.home}`}</span>
              {game.status === "final" && game.awayScore !== null && game.homeScore !== null ? (
                <span style={{ fontSize: 13, color: muted }}>{`Final ${game.awayScore}–${game.homeScore}`}</span>
              ) : null}
            </div>
            {week.models.map((model) => {
              const pick = pickFor(week, model.id, game.id);
              const result = pick ? pickResult(pick.winner, game) : null;
              return (
                <div key={model.id} style={{ display: "flex", width: 210, justifyContent: "center", alignItems: "center", gap: 9, fontSize: 21, fontWeight: 700, color: result === "W" ? "#1a7a45" : result === "L" ? "#c0392b" : ink }}>
                  <span>{pick?.winner ?? "—"}</span>
                  {result ? <span style={{ fontSize: 14, fontWeight: 800 }}>{result}</span> : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 18, fontSize: 18, color: muted }}>
        <span>W = correct · L = incorrect · T = tie</span>
        <span>nfllm.fun</span>
      </div>
    </div>,
    {
      width: 1200,
      height: 1200,
      headers: {
        "Cache-Control": "public, max-age=300",
        ...(download ? { "Content-Disposition": `attachment; filename="nfllm-${season}-week-${weekNumber}.png"` } : {}),
      },
    },
  );
}
