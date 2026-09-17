"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { visibleRationale } from "@/lib/picks";
import { teamLogoUrl } from "@/lib/logos";

type PickCellProps = {
  winner: string;
  rationale: string;
  result: "W" | "L" | "T" | null;
};

type TipPos = { top: number; left: number; width: number; transform: string };

export function PickCell({ winner, rationale, result }: PickCellProps) {
  const tipId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [pos, setPos] = useState<TipPos | null>(null);

  const reason = visibleRationale(rationale);
  const tipText = reason ?? `Pick: ${winner}`;

  const ring =
    result === "W"
      ? "ring-2 ring-win bg-win/8"
      : result === "L"
        ? "ring-2 ring-loss bg-loss/8"
        : result === "T"
          ? "ring-1 ring-ink-muted/40"
          : "";

  const updatePos = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = 8;
    const width = Math.min(280, window.innerWidth - 16);
    const placeAbove = rect.top > 140;
    let left = rect.left + rect.width / 2 - width / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    const top = placeAbove ? rect.top - gap : rect.bottom + gap;
    setPos({
      top,
      left,
      width,
      transform: placeAbove ? "translateY(-100%)" : "none",
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePos();
  }, [open, updatePos]);

  useEffect(() => {
    if (!open) return;

    const onScrollOrResize = () => updatePos();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPinned(false);
        setOpen(false);
        triggerRef.current?.blur();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (tipRef.current?.contains(target)) return;
      setPinned(false);
      setOpen(false);
    };

    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open, updatePos]);

  const show = () => setOpen(true);
  const hideIfUnpinned = () => {
    if (!pinned) setOpen(false);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`flex h-full min-h-[3.25rem] w-full cursor-help flex-col items-center justify-center gap-0.5 px-2 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 ${ring}`}
        aria-describedby={open ? tipId : undefined}
        aria-expanded={open}
        aria-label={`${winner} pick. Show rationale.`}
        onMouseEnter={show}
        onMouseLeave={hideIfUnpinned}
        onFocus={show}
        onBlur={hideIfUnpinned}
        onClick={() => {
          // Desktop uses hover/focus; pin-toggle is for touch / click-only.
          if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
            return;
          }
          setPinned((was) => {
            const next = !was;
            setOpen(next);
            return next;
          });
        }}
      >
        <Image
          src={teamLogoUrl(winner)}
          alt=""
          width={36}
          height={36}
          className="h-9 w-9 object-contain"
          unoptimized
        />
        <span className="font-mono text-[10px] font-medium tracking-wide text-ink">
          {winner}
        </span>
      </button>

      {typeof document !== "undefined" && open && pos
        ? createPortal(
            <div
              ref={tipRef}
              id={tipId}
              role="tooltip"
              className="pointer-events-none fixed z-[80] rounded-sm border border-white/10 bg-header px-3 py-2 text-white shadow-[0_12px_28px_-12px_rgba(0,0,0,0.55)]"
              style={{
                top: pos.top,
                left: pos.left,
                width: pos.width,
                transform: pos.transform,
              }}
            >
              <div className="font-display text-[12px] font-bold tracking-wide text-white uppercase">
                {winner}
              </div>
              <p className="mt-1 font-sans text-[12px] leading-snug text-white/85">
                {tipText}
              </p>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

export function EmptyPickCell() {
  return (
    <div className="flex h-full min-h-[3.25rem] items-center justify-center px-2 text-center font-mono text-[10px] text-ink-muted">
      No pick
    </div>
  );
}
