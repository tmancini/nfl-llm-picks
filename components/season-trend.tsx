import { seasonTrends } from "@/lib/trends";
import type { WeekFile } from "@/lib/types";

const COLORS: Record<string, string> = {
  openai: "#2b659f",
  anthropic: "#579b20",
  google: "#a66a18",
  "x-ai": "#7657ad",
};

export function SeasonTrend({ weeks, season }: { weeks: WeekFile[]; season: number }) {
  const trends = seasonTrends(weeks, season);
  const allWeeks = [...new Set(trends.flatMap((trend) => trend.points.map((point) => point.week)))].sort((a, b) => a - b);
  if (allWeeks.length === 0) return null;

  const left = 66;
  const right = 954;
  const top = 24;
  const bottom = 260;
  const x = (week: number) =>
    allWeeks.length === 1
      ? (left + right) / 2
      : left + (allWeeks.indexOf(week) / (allWeeks.length - 1)) * (right - left);
  const y = (rate: number) => bottom - rate * (bottom - top);

  return (
    <section className="mt-6 rounded-sm border border-rule bg-panel p-4 sm:p-6" aria-labelledby="trend-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] font-semibold tracking-[0.2em] text-ink-muted uppercase">
            Season tracker
          </p>
          <h3 id="trend-title" className="mt-1 font-display text-2xl font-bold text-ink">
            Accuracy over time
          </h3>
        </div>
        <p className="max-w-sm text-xs text-ink-muted">
          Cumulative correct picks ÷ decided games. Ties and pending games are excluded.
        </p>
      </div>

      <div className="mt-5 overflow-x-auto">
        <svg
          className="min-w-[580px] w-full"
          viewBox="0 0 1000 320"
          role="img"
          aria-label={`${season} season cumulative win percentage by model through week ${allWeeks.at(-1)}`}
        >
          {[0, 0.25, 0.5, 0.75, 1].map((rate) => (
            <g key={rate}>
              <line x1={left} x2={right} y1={y(rate)} y2={y(rate)} stroke="#d4dde6" strokeWidth="1" />
              <text x={left - 14} y={y(rate) + 5} textAnchor="end" fill="#6b7c90" fontSize="15" fontFamily="monospace">
                {Math.round(rate * 100)}%
              </text>
            </g>
          ))}
          {allWeeks.map((week) => (
            <text key={week} x={x(week)} y={bottom + 30} textAnchor="middle" fill="#6b7c90" fontSize="15" fontFamily="monospace">
              W{week}
            </text>
          ))}
          {trends.map((trend) => {
            const color = COLORS[trend.provider] ?? "#102038";
            const path = trend.points.map((point) => `${x(point.week)},${y(point.rate)}`).join(" ");
            return (
              <g key={trend.provider}>
                {trend.points.length > 1 ? (
                  <polyline points={path} fill="none" stroke={color} strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />
                ) : null}
                {trend.points.map((point) => {
                  const tied = trends.filter((other) =>
                    other.points.some((otherPoint) =>
                      otherPoint.week === point.week && otherPoint.rate === point.rate,
                    ),
                  );
                  const ringIndex = tied.findIndex((other) => other.provider === trend.provider);
                  return (
                    <circle key={point.week} cx={x(point.week)} cy={y(point.rate)} r={11 - ringIndex * 3} fill={color} stroke="#fbfcfd" strokeWidth="1.5">
                      <title>{`${trend.label}, week ${point.week}: ${Math.round(point.rate * 100)}% (${point.wins}–${point.losses})`}</title>
                    </circle>
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="mt-2 flex flex-wrap justify-center gap-x-6 gap-y-2">
        {trends.map((trend) => {
          const point = trend.points.at(-1);
          return (
            <div key={trend.provider} className="flex items-center gap-2 text-xs text-ink-soft">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[trend.provider] ?? "#102038" }} />
              <span className="font-semibold">{trend.label}</span>
              <span className="font-mono">{point ? `${point.wins}–${point.losses}` : "—"}</span>
            </div>
          );
        })}
      </div>
      {allWeeks.length === 1 ? (
        <p className="mt-4 text-center text-xs text-ink-muted">The lines will appear as more weeks are graded.</p>
      ) : null}
      <table className="sr-only">
        <caption>{season} cumulative records by week</caption>
        <thead><tr><th>Model</th><th>Week</th><th>Wins</th><th>Losses</th><th>Accuracy</th></tr></thead>
        <tbody>
          {trends.flatMap((trend) => trend.points.map((point) => (
            <tr key={`${trend.provider}-${point.week}`}>
              <th>{trend.label}</th><td>{point.week}</td><td>{point.wins}</td><td>{point.losses}</td><td>{Math.round(point.rate * 100)}%</td>
            </tr>
          )))}
        </tbody>
      </table>
    </section>
  );
}
