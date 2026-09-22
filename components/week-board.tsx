import Image from "next/image";
import Link from "next/link";
import { EmptyPickCell, PickCell } from "@/components/pick-cell";
import {
  consensusForGame,
  isConsensusGame,
  pickFor,
  pickResult,
  shortKickoff,
} from "@/lib/board";
import { modelLogoUrl } from "@/lib/logos";
import { formatRecord, seasonStandings, standingForModel } from "@/lib/standings";
import { listWeekFiles } from "@/lib/store";
import type { Game, ModelDef, WeekFile } from "@/lib/types";

function MatchupCell({ game }: { game: Game }) {
  const kickoff =
    game.status === "final" && game.awayScore !== null && game.homeScore !== null
      ? `Final ${game.awayScore}–${game.homeScore}`
      : shortKickoff(game.kickoffEt);

  return (
    <div className="flex flex-col gap-0.5">
      <div className="font-display text-[15px] leading-none font-bold tracking-wide text-signal uppercase">
        {game.away}{" "}
        <span className="font-sans text-[11px] font-semibold tracking-normal text-ink-muted">
          @
        </span>{" "}
        {game.home}
      </div>
      <div className="font-mono text-[10px] tracking-wide text-ink-muted">{kickoff}</div>
    </div>
  );
}

function ModelHead({
  modelId,
  label,
  shortLabel,
}: {
  modelId: string;
  label: string;
  shortLabel: string;
}) {
  const logoSrc = modelLogoUrl(modelId);
  return (
    <div className="flex flex-col items-center gap-1.5 px-1 py-2" title={label}>
      {logoSrc ? (
        <Image
          src={logoSrc}
          alt={label}
          title={label}
          width={28}
          height={28}
          className="h-7 w-7 object-contain"
          unoptimized
        />
      ) : (
        <div
          className="flex h-7 w-7 items-center justify-center rounded-sm bg-white/15 text-[10px] font-bold text-white"
          aria-hidden="true"
        >
          {shortLabel.slice(0, 2).toUpperCase()}
        </div>
      )}
      <div className="font-display text-[11px] font-bold tracking-[0.08em] text-white/90 uppercase">
        {shortLabel}
      </div>
      <div className="sr-only">{label}</div>
    </div>
  );
}

function BoardPickCell({
  week,
  modelId,
  game,
}: {
  week: WeekFile;
  modelId: string;
  game: Game;
}) {
  const pick = pickFor(week, modelId, game.id);
  if (!pick) return <EmptyPickCell />;
  return (
    <PickCell
      winner={pick.winner}
      rationale={pick.rationale}
      result={pickResult(pick.winner, game)}
    />
  );
}

function CompactModelPick({
  week,
  model,
  game,
}: {
  week: WeekFile;
  model: ModelDef;
  game: Game;
}) {
  const logoSrc = modelLogoUrl(model.id);
  return (
    <div className="flex min-h-[4.5rem] flex-col overflow-hidden rounded-sm border border-rule/80 bg-panel">
      <div className="flex items-center justify-center gap-1.5 border-b border-rule/70 bg-header px-2 py-1.5 text-white">
        {logoSrc ? (
          <Image
            src={logoSrc}
            alt=""
            width={14}
            height={14}
            className="h-3.5 w-3.5 object-contain"
            unoptimized
          />
        ) : null}
        <span className="font-display text-[10px] font-bold tracking-[0.1em] uppercase">
          {model.shortLabel}
        </span>
      </div>
      <div className="flex flex-1 items-stretch justify-center">
        <BoardPickCell week={week} modelId={model.id} game={game} />
      </div>
    </div>
  );
}

function MobileGameCard({
  week,
  game,
  rowIndex,
}: {
  week: WeekFile;
  game: Game;
  rowIndex: number;
}) {
  const highlight = isConsensusGame(week, game.id);
  const consensus = consensusForGame(week, game.id);

  return (
    <article
      className={`border-b border-rule/80 px-3 py-3 last:border-b-0 ${
        highlight ? "bg-consensus/40" : rowIndex % 2 === 0 ? "bg-panel" : "bg-panel-alt"
      }`}
      style={{ animationDelay: `${160 + rowIndex * 28}ms` }}
    >
      <div className="mb-2.5">
        <MatchupCell game={game} />
        {highlight && consensus ? (
          <div className="mt-1 font-mono text-[9px] tracking-[0.14em] text-ink-muted uppercase">
            Consensus {consensus.team} {consensus.count}/{consensus.total}
          </div>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {week.models.map((model) => (
          <CompactModelPick key={model.id} week={week} model={model} game={game} />
        ))}
      </div>
    </article>
  );
}

function MobileRecords({ week }: { week: WeekFile }) {
  const season = seasonStandings(listWeekFiles(), week.season);

  return (
    <div className="border-t-2 border-ink/20 bg-footer px-3 py-3">
      <div className="grid grid-cols-2 gap-2">
        {week.models.map((model) => {
          const weekRecord = week.records[model.id];
          const standing = standingForModel(season, model.id);
          const logoSrc = modelLogoUrl(model.id);
          return (
            <div
              key={model.id}
              className="rounded-sm border border-rule/80 bg-panel px-2.5 py-2 text-center"
            >
              <div className="mb-1 flex items-center justify-center gap-1.5">
                {logoSrc ? (
                  <Image
                    src={logoSrc}
                    alt=""
                    width={14}
                    height={14}
                    className="h-3.5 w-3.5 object-contain"
                    unoptimized
                  />
                ) : null}
                <span className="font-display text-[10px] font-bold tracking-[0.1em] text-ink uppercase">
                  {model.shortLabel}
                </span>
              </div>
              <div className="font-mono text-sm font-semibold text-ink">
                {weekRecord ? formatRecord(weekRecord) : "—"}
              </div>
              <div className="mt-0.5 font-mono text-[10px] text-ink-muted">
                Season {standing ? formatRecord(standing) : "0–0"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DesktopTable({ week }: { week: WeekFile }) {
  const season = seasonStandings(listWeekFiles(), week.season);
  const weekHref = `/weeks/${week.season}/${week.week}`;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse">
        <thead>
          <tr className="border-b border-rule bg-header text-white">
            <th className="w-[9.5rem] px-3 py-3 text-left align-bottom font-mono text-[10px] font-medium tracking-[0.18em] text-white/70 uppercase">
              NFL picks
              <div className="mt-1 font-display text-lg tracking-normal text-white normal-case">
                <Link href={weekHref} className="text-white no-underline hover:text-white/80">
                  Week {week.week}
                </Link>
              </div>
            </th>
            {week.models.map((model) => (
              <th key={model.id} className="min-w-[5.5rem] border-l border-white/10 px-1">
                <ModelHead
                  modelId={model.id}
                  label={model.label}
                  shortLabel={model.shortLabel}
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {week.games.map((game, rowIndex) => {
            const highlight = isConsensusGame(week, game.id);
            const consensus = consensusForGame(week, game.id);
            return (
              <tr
                key={game.id}
                className={`border-t border-rule/80 ${
                  highlight ? "bg-consensus/40" : rowIndex % 2 === 0 ? "bg-panel" : "bg-panel-alt"
                }`}
                style={{ animationDelay: `${160 + rowIndex * 28}ms` }}
              >
                <td className="px-3 py-2.5 align-middle">
                  <MatchupCell game={game} />
                  {highlight && consensus ? (
                    <div className="mt-1 font-mono text-[9px] tracking-[0.14em] text-ink-muted uppercase">
                      Consensus {consensus.team} {consensus.count}/{consensus.total}
                    </div>
                  ) : null}
                </td>
                {week.models.map((model) => (
                  <td key={model.id} className="border-l border-rule/70 p-0 align-middle">
                    <BoardPickCell week={week} modelId={model.id} game={game} />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-ink/20 bg-footer">
            <td className="px-3 py-3 font-display text-sm font-bold tracking-wide text-ink uppercase">
              This week
            </td>
            {week.models.map((model) => {
              const record = week.records[model.id];
              return (
                <td
                  key={model.id}
                  className="border-l border-rule/70 px-2 py-3 text-center font-mono text-sm font-semibold text-ink"
                >
                  {record ? formatRecord(record) : "—"}
                </td>
              );
            })}
          </tr>
          <tr className="border-t border-rule/70 bg-footer">
            <td className="px-3 py-3 font-display text-sm font-bold tracking-wide text-ink-muted uppercase">
              Season
            </td>
            {week.models.map((model) => {
              const standing = standingForModel(season, model.id);
              return (
                <td
                  key={model.id}
                  className="border-l border-rule/70 px-2 py-3 text-center font-mono text-sm text-ink-soft"
                >
                  {standing ? formatRecord(standing) : "0–0"}
                </td>
              );
            })}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function WeekBoard({ week }: { week: WeekFile }) {
  const hasPicks = week.models.some((model) => (week.picks[model.id] ?? []).length > 0);
  const weekHref = `/weeks/${week.season}/${week.week}`;

  return (
    <section className="rise" style={{ animationDelay: "120ms" }}>
      <div className="mb-4 text-center">
        {week.source === "fixture" || week.source === "slate" ? (
          <p className="mb-1 font-mono text-[10px] font-medium tracking-[0.22em] text-ink-muted uppercase">
            {week.source === "fixture" ? "Sample slate" : "Slate only"}
          </p>
        ) : null}
        <h2 className="font-display text-3xl leading-none font-bold tracking-tight text-ink sm:text-4xl">
          <Link href={weekHref} className="text-ink no-underline hover:text-header">
            Week {week.week}
          </Link>
          <span className="ml-2 font-sans text-base font-medium text-ink-muted">
            {week.season}
          </span>
        </h2>
      </div>

      {week.source === "fixture" ? (
        <div className="mb-3 border border-dashed border-header/30 bg-header/5 px-3 py-2 font-mono text-[11px] tracking-[0.12em] text-header uppercase">
          Sample week — do not treat as official
        </div>
      ) : null}

      {!hasPicks && week.source === "slate" ? (
        <div className="mb-3 border border-dashed border-ink/25 bg-panel px-3 py-2 text-sm text-ink-soft">
          ESPN slate loaded without model picks. Lock with{" "}
          <code className="font-mono text-xs">pnpm lock-week</code>.
        </div>
      ) : null}

      <div className="overflow-hidden rounded-sm border border-rule bg-panel shadow-[0_12px_40px_-24px_rgba(16,32,56,0.45)]">
        <div className="md:hidden">
          <div className="border-b border-rule bg-header px-3 py-3 text-center text-white">
            <div className="font-mono text-[10px] font-medium tracking-[0.18em] text-white/70 uppercase">
              NFL picks
            </div>
            <div className="mt-1 font-display text-lg">
              <Link href={weekHref} className="text-white no-underline hover:text-white/80">
                Week {week.week}
              </Link>
            </div>
          </div>
          {week.games.map((game, rowIndex) => (
            <MobileGameCard key={game.id} week={week} game={game} rowIndex={rowIndex} />
          ))}
          <MobileRecords week={week} />
        </div>

        <div className="hidden md:block">
          <DesktopTable week={week} />
        </div>
      </div>
    </section>
  );
}
