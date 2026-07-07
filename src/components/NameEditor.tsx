"use client";

import { useEffect, useState } from "react";
import { getPlayer, setPlayerName, getPlayerSecret } from "@/lib/identity";

let synced = false; // upsert the public profile once per session

/** Shows the player's name with inline editing; persists to localStorage + the
 *  public profile. `onChange` lets a parent (e.g. the lobby) re-broadcast it. */
export function NameEditor({ onChange }: { onChange?: (name: string) => void }) {
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    const p = getPlayer();
    setId(p.id);
    setName(p.name);
    setDraft(p.name);
    if (!synced) {
      synced = true;
      fetch("/api/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: p.id, name: p.name, secret: getPlayerSecret() }),
      }).catch(() => {});
    }
  }, []);

  function save() {
    const finalName = setPlayerName(draft);
    setName(finalName);
    setEditing(false);
    fetch("/api/profile", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, name: finalName, secret: getPlayerSecret() }),
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
      onClick={() => { setDraft(name); setEditing(true); }}
      className="group inline-flex items-center gap-1.5 text-sm text-cream/70 transition-colors hover:text-cream"
      title="Change your name"
    >
      <span className="text-cream/45">playing as</span>
      <span className="font-medium text-cream">{name || "…"}</span>
      <span className="text-cream/30 group-hover:text-brass">✎</span>
    </button>
  );
}
