import { Disclaimer } from "@/components/disclaimer";
import { EmptyState } from "@/components/empty-state";
import { Masthead } from "@/components/masthead";
import { WeekBoard } from "@/components/week-board";
import { WeekNav } from "@/components/week-nav";
import { featuredWeek } from "@/lib/board";
import { listWeekFiles } from "@/lib/weeks";

export default function Home() {
  const weeks = listWeekFiles();
  const week = featuredWeek(weeks);
  const edition = week
    ? `Week ${String(week.week).padStart(2, "0")}`
    : "Off the wire";
  const editionHref = week ? `/weeks/${week.season}/${week.week}` : undefined;

  return (
    <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col px-4 py-6 sm:px-6">
      <Masthead
        kicker="2026 NFL season"
        edition={edition}
        editionHref={editionHref}
      />
      <main className="mt-8 flex flex-1 flex-col gap-8">
        <WeekNav
          weeks={weeks}
          active={week ? { season: week.season, week: week.week } : null}
        />
        {week ? (
          <WeekBoard week={week} />
        ) : (
          <EmptyState
            title="The sheet is blank."
            body="No week has been locked yet. Run pnpm lock-week with OPENROUTER_API_KEY."
          />
        )}
      </main>
      <Disclaimer />
    </div>
  );
}
