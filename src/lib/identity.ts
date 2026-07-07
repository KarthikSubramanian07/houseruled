// Anonymous, account-free identity. A player is a random id + a display name kept
// in localStorage. This is the "no account required" backbone of Phase 0 — the
// same id is reused across rooms so presence/host checks are stable, and it's the
// value we'll optionally link to a real account in Phase 5.

import type { Player } from "./types";
import { randomPlayerName } from "./names";

const ID_KEY = "houseruled.player.id";
const NAME_KEY = "houseruled.player.name";

function makeId(): string {
  const cryptoObj = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (cryptoObj?.randomUUID) return cryptoObj.randomUUID();
  // Fallback for old runtimes.
  return "p_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Read (or lazily create) this browser's player identity. Client-only. */
export function getPlayer(): Player {
  if (typeof window === "undefined") {
    // SSR guard — never persisted; real identity is resolved on the client.
    return { id: "ssr", name: "Player" };
  }

  // Storage can be disabled/blocked (locked-down Safari, private embeds, quota).
  // Never let that crash the table — fall back to an in-memory identity.
  let store: Storage | null = null;
  try {
    store = window.localStorage;
  } catch {
    store = null;
  }

  const read = (key: string): string | null => {
    try {
      return store?.getItem(key) ?? null;
    } catch {
      return null;
    }
  };
  const write = (key: string, value: string): void => {
    try {
      store?.setItem(key, value);
    } catch {
      // Ignore — identity just won't persist across reloads this session.
    }
  };

  let id = read(ID_KEY);
  if (!id) {
    id = makeId();
    write(ID_KEY, id);
  }

  let name = read(NAME_KEY);
  if (!name) {
    name = randomPlayerName();
    write(NAME_KEY, name);
  }

  return { id, name };
}

/** Rename the local player. Returns the trimmed name actually stored. */
export function setPlayerName(name: string): string {
  const trimmed = name.trim().slice(0, 24);
  const finalName = trimmed.length > 0 ? trimmed : randomPlayerName();
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(NAME_KEY, finalName);
    } catch {
      // Ignore — won't persist, but the session still uses it.
    }
  }
  return finalName;
}
