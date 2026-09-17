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

  // Archive page omits `active`; home passes null when no featured week.
  const onArchive = active === undefined;

  return (
    <nav
      aria-label="Weeks"
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 font-mono text-[11px] font-medium tracking-[0.12em] uppercase"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        {sorted.map((week) => {
          const href = `/weeks/${week.season}/${week.week}`;
          const isActive =
            active?.season === week.season && active?.week === week.week;
          return (
            <Link
              key={`${week.season}-${week.week}`}
              href={href}
              className={
                isActive
                  ? "rounded-sm bg-header px-2.5 py-1 text-white no-underline hover:text-white"
                  : "rounded-sm px-2.5 py-1 text-ink no-underline hover:bg-panel-alt hover:text-ink"
              }
              aria-current={isActive ? "page" : undefined}
              aria-label={`Week ${week.week}, ${week.season}`}
            >
              W{week.week}
            </Link>
          );
        })}
      </div>
      <span className="text-rule" aria-hidden="true">
        /
      </span>
      <Link
        href="/weeks"
        className={
          onArchive
            ? "tracking-[0.14em] text-ink no-underline"
            : "tracking-[0.14em] text-ink-muted no-underline hover:text-ink"
        }
        aria-current={onArchive ? "page" : undefined}
      >
        Archive
      </Link>
    </nav>
  );
}
