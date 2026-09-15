import Link from "next/link";
import { Disclaimer } from "@/components/disclaimer";
import { EmptyState } from "@/components/empty-state";
import { Masthead } from "@/components/masthead";
import { WeekNav } from "@/components/week-nav";
import { listWeekFiles } from "@/lib/weeks";

export const metadata = {
  title: "Archive",
};

export default function ArchivePage() {
  const weeks = listWeekFiles();
  const reversed = [...weeks].reverse();

  return (
    <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col px-4 py-6 sm:px-6">
      <Masthead kicker="Back issues" edition="Archive" />
      <main className="mt-8 flex flex-1 flex-col gap-8">
        <WeekNav weeks={weeks} />
        {reversed.length === 0 ? (
          <EmptyState
            title="No back issues."
            body="Once a week is locked, it lives here as a public JSON file you can audit."
          />
        ) : (
          <section className="rise">
            <h2 className="font-display text-3xl font-bold tracking-tight">All weeks</h2>
            <ul className="mt-4 divide-y divide-rule border-y border-rule bg-panel">
              {reversed.map((week) => (
                <li key={`${week.season}-${week.week}`}>
                  <Link
                    href={`/weeks/${week.season}/${week.week}`}
                    className="flex items-baseline justify-between gap-4 px-4 py-4 no-underline hover:bg-panel-alt"
                  >
                    <span className="font-display text-2xl font-bold">
                      {week.season} · Week {week.week}
                    </span>
                    <span className="font-mono text-[11px] tracking-[0.14em] text-ink-muted uppercase">
                      {week.source === "fixture"
                        ? "Sample"
                        : week.source === "slate"
                          ? "Slate"
                          : "Locked"}{" "}
                      · {week.games.length} games
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
      <Disclaimer />
    </div>
  );
}
