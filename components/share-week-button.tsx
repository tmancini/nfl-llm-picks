"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function ShareWeekButton({ season, week }: { season: number; week: number }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copyingImage, setCopyingImage] = useState(false);
  const [status, setStatus] = useState("");
  const imageUrl = `/weeks/${season}/${week}/share`;
  const filename = `nfllm-${season}-week-${week}.png`;

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  async function onShare() {
    setStatus("");
    if (
      window.matchMedia("(pointer: coarse)").matches &&
      typeof navigator.share === "function" &&
      typeof navigator.canShare === "function"
    ) {
      setBusy(true);
      try {
        const response = await fetch(imageUrl);
        if (!response.ok) throw new Error("Image unavailable");
        const image = new File([await response.blob()], filename, { type: "image/png" });
        if (navigator.canShare({ files: [image] })) {
          await navigator.share({ files: [image], title: `NFLLM Week ${week}` });
          return;
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      } finally {
        setBusy(false);
      }
    }
    setOpen(true);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/weeks/${season}/${week}`);
      setStatus("Link copied");
    } catch {
      setStatus("Copy unavailable in this browser");
    }
  }

  async function copyImage() {
    if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
      setStatus("Image copy is unavailable here. Download the PNG instead.");
      return;
    }
    setCopyingImage(true);
    setStatus("");
    try {
      const image = fetch(imageUrl).then(async (response) => {
        if (!response.ok) throw new Error("Image unavailable");
        return new Blob([await response.blob()], { type: "image/png" });
      });
      await navigator.clipboard.write([new ClipboardItem({ "image/png": image })]);
      setStatus("Image copied. Paste it into your X post.");
    } catch {
      setStatus("Could not copy the image. Download the PNG instead.");
    } finally {
      setCopyingImage(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={onShare}
        disabled={busy}
        className="inline-flex items-center justify-center rounded-sm border border-header bg-header px-4 py-2 font-mono text-[11px] font-bold tracking-[0.12em] text-white uppercase transition-colors hover:bg-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-header disabled:opacity-60"
      >
        {busy ? "Preparing…" : "Share for X"}
      </button>
      {open && typeof document !== "undefined" ? createPortal(
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-header/75 p-3" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="share-title" className="w-full max-w-lg overflow-hidden rounded-sm bg-panel p-4 text-left shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 id="share-title" className="font-display text-2xl font-bold text-ink">Share Week {week}</h3>
                <p className="mt-1 text-sm text-ink-muted">A square image sized for a single X post.</p>
              </div>
              <button type="button" autoFocus onClick={() => setOpen(false)} aria-label="Close share preview" className="px-2 py-1 text-xl leading-none text-ink-muted hover:text-ink">×</button>
            </div>
            <div className="mx-auto mt-4 border border-rule" style={{ width: "min(400px, 50vh, 100%)" }}>
              <Image src={imageUrl} alt={`NFLLM Week ${week} picks and records share image`} width={1200} height={1200} unoptimized className="h-auto w-full" />
            </div>
            <p className="mt-3 text-xs text-ink-muted">Copy the image, or download the PNG to attach it to your X post.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <a href={`${imageUrl}?download=1`} download={filename} className="rounded-sm bg-header px-4 py-2 text-sm font-semibold text-white no-underline hover:text-white/80">Download PNG</a>
              <button type="button" onClick={copyImage} disabled={copyingImage} className="rounded-sm border border-rule px-4 py-2 text-sm font-semibold text-ink hover:bg-panel-alt disabled:opacity-60">{copyingImage ? "Copying…" : "Copy image"}</button>
              <button type="button" onClick={copyLink} className="rounded-sm border border-rule px-4 py-2 text-sm font-semibold text-ink hover:bg-panel-alt">Copy week link</button>
            </div>
            {status ? <p role="status" className="mt-3 text-xs text-ink-soft">{status}</p> : null}
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  );
}
