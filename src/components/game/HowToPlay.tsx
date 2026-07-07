"use client";

import { useState } from "react";
import { getGuide } from "@/lib/engine/guides";

/** The guide content itself — reusable inside a modal, a card, or a lobby panel. */
export function GuideBody({ type, className = "" }: { type: string; className?: string }) {
  const guide = getGuide(type);
  if (!guide) return null;
  return (
    <div className={`flex flex-col gap-4 text-left ${className}`}>
      <div>
        <p className="plaque-header text-[10px] text-brass/60">The goal</p>
        <p className="font-display text-lg leading-snug text-cream">{guide.goal}</p>
      </div>
      <div>
        <p className="plaque-header text-[10px] text-brass/60">How it plays</p>
        <ol className="mt-1 flex flex-col gap-1.5">
          {guide.steps.map((s, i) => (
            <li key={i} className="flex gap-2.5 text-sm leading-snug text-cream/80">
              <span className="tabular mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brass/15 text-[11px] text-brass">{i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      </div>
      <p className="rounded-xl border border-brass/20 bg-brass/5 px-3 py-2 text-sm italic leading-snug text-brass/90">
        ✦ {guide.tip}
      </p>
    </div>
  );
}

/** A "How to play" text trigger that opens the guide in a modal. */
export function HowToPlay({ type, name, className = "" }: { type: string; name: string; className?: string }) {
  const [open, setOpen] = useState(false);
  if (!getGuide(type)) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1 text-xs text-cream/50 transition-colors hover:text-brass ${className}`}
      >
        <span aria-hidden>♦</span> How to play
      </button>
      {open && (
        <div
          className="fixed inset-0 z-40 grid place-items-center bg-felt-deep/80 px-6 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="deal-in flex max-h-[85vh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-2xl border border-brass/40 bg-felt-dark p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <h2 className="font-display text-2xl text-cream">{name}</h2>
              <button onClick={() => setOpen(false)} className="text-cream/40 transition-colors hover:text-cream" aria-label="Close">✕</button>
            </div>
            <GuideBody type={type} />
          </div>
        </div>
      )}
    </>
  );
}
