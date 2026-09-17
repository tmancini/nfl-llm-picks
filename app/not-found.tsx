import Link from "next/link";
import { Disclaimer } from "@/components/disclaimer";
import { Masthead } from "@/components/masthead";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col px-4 py-6 sm:px-6">
      <Masthead kicker="Misprint" edition="404" />
      <main className="mt-8 flex-1 border border-rule bg-panel px-6 py-16 text-center">
        <p className="font-mono text-[10px] font-medium tracking-[0.22em] text-ink-muted uppercase">
          Week not on file
        </p>
        <h2 className="font-display mt-3 text-4xl font-bold tracking-tight">
          That issue does not exist.
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm text-ink-soft">
          The archive only prints weeks that have been locked into JSON. Check the week
          number, or go back to the current sheet.
        </p>
        <p className="mt-6 font-mono text-[11px] tracking-[0.16em] uppercase">
          <Link href="/">Return to this week</Link>
          <span aria-hidden="true"> · </span>
          <Link href="/weeks">Archive</Link>
        </p>
      </main>
      <Disclaimer />
    </div>
  );
}
