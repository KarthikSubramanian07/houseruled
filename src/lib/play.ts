// Client helper: spin up a room preloaded with a game + house rules, so the
// pre-game setup opens with them filled in (host just hits Deal). Used by the
// "invent a game" flow and the community library.

import { createRoom } from "./room";
import { getPlayer } from "./identity";

const PRELOAD_KEY = "houseruled.preload";

export interface Preload {
  baseGame: string;
  ruleTexts: string[];
}

export async function startCustomTable(
  push: (href: string) => void,
  baseGame: string,
  ruleTexts: string[],
): Promise<void> {
  const room = await createRoom(getPlayer());
  try {
    sessionStorage.setItem(PRELOAD_KEY, JSON.stringify({ baseGame, ruleTexts }));
  } catch {
    /* sessionStorage blocked — setup just won't prefill */
  }
  push(`/room/${room.code}`);
}

/** Read + clear a preload (called once by the pre-game setup). */
export function takePreload(): Preload | null {
  try {
    const raw = sessionStorage.getItem(PRELOAD_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(PRELOAD_KEY);
    const p = JSON.parse(raw) as Preload;
    if (typeof p.baseGame === "string" && Array.isArray(p.ruleTexts)) return p;
  } catch {
    /* ignore */
  }
  return null;
}
