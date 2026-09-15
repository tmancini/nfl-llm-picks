import Link from "next/link";
import type { WeekFile } from "@/lib/types";

export function WeekNav({
  weeks,
  active,
}: {
  weeks: WeekFile[];
  active?: { season: number; week: number } | null;
}) {
  if (weeks.length === 0) return null;

  const sorted = [...weeks].sort(
    (a, b) => a.season - b.season || a.week - b.week,
  );

  return (
    <nav
      aria-label="Weeks"
      className="flex flex-wrap items-center gap-x-1 gap-y-2 font-mono text-[11px] font-medium tracking-[0.14em] uppercase"
    >
      <span className="mr-2 text-ink-muted">Weeks</span>
      {sorted.map((week) => {
        const href = `/weeks/${week.season}/${week.week}`;
        const isActive =
          active?.season === week.season && active?.week === week.week;
        return (
          <Link
            key={`${week.season}-${week.week}`}
            href={href}
            className={`rounded-sm px-2.5 py-1.5 no-underline ${
              isActive
                ? "bg-header text-white"
                : "text-ink hover:bg-panel-alt"
            }`}
            aria-current={isActive ? "page" : undefined}
          >
            {week.week}
          </Link>
        );
      })}
      <Link
        href="/weeks"
        className="ml-1 rounded-sm px-2.5 py-1.5 text-ink-muted no-underline hover:bg-panel-alt hover:text-ink"
      >
        Archive
      </Link>
    </nav>
  );
}
