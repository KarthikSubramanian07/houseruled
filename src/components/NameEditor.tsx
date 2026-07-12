"use client";

import { useEffect, useRef, useState } from "react";
import { getPlayerSecret } from "@/lib/identity";
import { renamePlayer, usePlayer } from "@/lib/use-player";

let synced = false; // upsert the public profile once per session

/** Shows the player's name with inline editing; persists to localStorage + the
 *  public profile. `onChange` lets a parent (e.g. the lobby) re-broadcast it. */
export function NameEditor({ onChange }: { onChange?: (name: string) => void }) {
  const player = usePlayer();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const syncedRef = useRef(false);

  useEffect(() => {
    if (syncedRef.current || synced) return;
    syncedRef.current = true;
    synced = true;
    fetch("/api/profile", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: player.id, name: player.name, secret: getPlayerSecret() }),
    }).catch(() => {});
  }, [player.id, player.name]);

  function save() {
    const finalName = renamePlayer(draft);
    setEditing(false);
    fetch("/api/profile", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: player.id, name: finalName, secret: getPlayerSecret() }),
    }).catch(() => {});
    onChange?.(finalName);
  }

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" ? save() : e.key === "Escape" ? setEditing(false) : null}
          autoFocus
          maxLength={24}
          className="w-32 rounded-full bg-felt-dark/70 px-3 py-1 text-sm text-cream ring-1 ring-brass/40"
        />
        <button onClick={save} className="text-xs text-brass hover:text-brass-bright">save</button>
      </span>
    );
  }
  return (
    <button
      onClick={() => { setDraft(player.name); setEditing(true); }}
      className="group inline-flex items-center gap-1.5 text-sm text-cream/70 transition-colors hover:text-cream"
      title="Change your name"
    >
      <span className="text-cream/45">playing as</span>
      <span className="font-medium text-cream">{player.name || "…"}</span>
      <span className="text-cream/30 group-hover:text-brass">✎</span>
    </button>
  );
}
