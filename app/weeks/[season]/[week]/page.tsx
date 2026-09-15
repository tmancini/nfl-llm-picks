import { notFound } from "next/navigation";
import { Disclaimer } from "@/components/disclaimer";
import { Masthead } from "@/components/masthead";
import { WeekBoard } from "@/components/week-board";
import { WeekNav } from "@/components/week-nav";
import { listWeekFiles, loadWeek } from "@/lib/weeks";

export function generateStaticParams() {
  return listWeekFiles().map((week) => ({
    season: String(week.season),
    week: String(week.week),
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ season: string; week: string }>;
}) {
  const { season, week } = await params;
  return { title: `${season} Week ${week}` };
}

export default async function WeekPage({
  params,
}: {
  params: Promise<{ season: string; week: string }>;
}) {
  const { season, week } = await params;
  const data = loadWeek(Number(season), Number(week));
  if (!data) notFound();
  const weeks = listWeekFiles();
  const editionHref = `/weeks/${data.season}/${data.week}`;

  return (
    <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col px-4 py-6 sm:px-6">
      <Masthead
        kicker={`${data.season} archive`}
        edition={`Week ${String(data.week).padStart(2, "0")}`}
        editionHref={editionHref}
      />
      <main className="mt-8 flex flex-1 flex-col gap-8">
        <WeekNav
          weeks={weeks}
          active={{ season: data.season, week: data.week }}
        />
        <WeekBoard week={data} />
      </main>
      <Disclaimer />
    </div>
  );
}
