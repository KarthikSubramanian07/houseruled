"use client";

import { useState } from "react";
import { getPlayer } from "@/lib/identity";

/** Heart toggle for a custom game. Optimistic; persists to the player's favorites. */
export function FavoriteButton({ slug, initial = false, size = "md" }: { slug: string; initial?: boolean; size?: "sm" | "md" }) {
  const [fav, setFav] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    const next = !fav;
    setFav(next); // optimistic
    try {
      const res = await fetch(`/api/games/${slug}/favorite`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: getPlayer().id }),
      });
      const data = (await res.json()) as { ok: boolean; favorited?: boolean };
      if (data.ok && typeof data.favorited === "boolean") setFav(data.favorited);
    } catch {
      setFav(!next); // revert
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={toggle}
      aria-pressed={fav}
      aria-label={fav ? "Remove from favorites" : "Add to favorites"}
      title={fav ? "Favorited" : "Add to favorites"}
      className={`transition-transform hover:scale-110 ${size === "sm" ? "text-base" : "text-xl"} ${fav ? "text-ember" : "text-cream/30 hover:text-cream/60"}`}
    >
      {fav ? "♥" : "♡"}
    </button>
  );
}
