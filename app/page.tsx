import { Disclaimer } from "@/components/disclaimer";
import { EmptyState } from "@/components/empty-state";
import { Masthead } from "@/components/masthead";
import { WeekBoard } from "@/components/week-board";
import { featuredWeek } from "@/lib/board";
import { listWeekFiles } from "@/lib/weeks";

export default function Home() {
  const weeks = listWeekFiles();
  const week = featuredWeek(weeks);
  const edition = week
    ? `Week ${String(week.week).padStart(2, "0")}`
    : "Off the wire";

  return (
    <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col px-4 py-6 sm:px-6">
      <Masthead kicker="2026 NFL season" edition={edition} />
      <main className="mt-8 flex flex-1 flex-col gap-8">
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
