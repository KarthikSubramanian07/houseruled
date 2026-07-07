"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Wordmark } from "./Wordmark";
import { NameEditor } from "./NameEditor";
import { getPlayer } from "@/lib/identity";

/** Shared top nav: wordmark, Library / Invent / your Profile, and name editing. */
export function SiteHeader() {
  const [id, setId] = useState("");
  useEffect(() => setId(getPlayer().id), []);

  return (
    <header className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 px-6 py-5 sm:px-10">
      <Wordmark size="sm" />
      <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <Link href="/games" className="text-cream/60 no-underline transition-colors hover:text-cream">Library</Link>
        <Link href="/invent" className="text-brass no-underline transition-colors hover:text-brass-bright">✦ Invent</Link>
        {id && (
          <Link href={`/u/${id}`} className="text-cream/60 no-underline transition-colors hover:text-cream">My profile</Link>
        )}
        <NameEditor />
      </nav>
    </header>
  );
}
