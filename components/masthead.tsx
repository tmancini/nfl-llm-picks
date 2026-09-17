import Image from "next/image";
import Link from "next/link";

export function Masthead({
  kicker,
  edition,
  editionHref,
}: {
  kicker: string;
  edition: string;
  editionHref?: string;
}) {
  return (
    <header className="rise">
      <div className="flex items-center justify-between gap-4 font-mono text-[10px] font-medium tracking-[0.2em] text-ink-muted uppercase sm:text-[11px]">
        <span className="font-semibold text-header">Live board</span>
        <span className="text-center text-ink-muted">{kicker}</span>
        <span className="text-right">
          {editionHref ? (
            <Link href={editionHref} className="text-ink-muted no-underline hover:text-header">
              {edition}
            </Link>
          ) : (
            <span className="text-ink-muted">{edition}</span>
          )}
        </span>
      </div>

      <div className="relative mt-3 overflow-hidden rounded-sm bg-header px-4 py-6 text-white sm:px-8 sm:py-8">
        <div className="masthead-grid pointer-events-none absolute inset-0 opacity-40" aria-hidden />
        <div className="relative flex flex-col items-center text-center">
          <Link
            href="/"
            className="flex flex-col items-center gap-3 no-underline hover:text-white sm:gap-4"
          >
            <Image
              src="/brand/nfllm-mark.png"
              alt=""
              width={48}
              height={48}
              className="size-10 sm:size-12"
              priority
            />
            <h1 className="font-display text-[12vw] leading-[0.85] font-bold tracking-[-0.03em] sm:text-7xl md:text-8xl">
              NFLLM
            </h1>
          </Link>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/75 sm:text-base">
            Four models pick every NFL game straight up. Entertainment only.
          </p>
        </div>
      </div>
    </header>
  );
}
