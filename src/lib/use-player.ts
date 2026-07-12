"use client";

import { useSyncExternalStore } from "react";
import { getPlayer, setPlayerName } from "./identity";
import type { Player } from "./types";

const PLAYER_EVENT = "houseruled:player";

function emitPlayerChange(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(PLAYER_EVENT));
}

function subscribePlayer(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => onStoreChange();
  window.addEventListener(PLAYER_EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(PLAYER_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

function getPlayerSnapshot(): Player {
  const next = getPlayer();
  if (
    cachedPlayer &&
    cachedPlayer.id === next.id &&
    cachedPlayer.name === next.name
  ) {
    return cachedPlayer;
  }
  cachedPlayer = next;
  return next;
}

let cachedPlayer: Player | null = null;

function getServerPlayerSnapshot(): Player {
  return { id: "", name: "" };
}

/** Stable external-store subscription for the local player identity. */
export function usePlayer(): Player {
  return useSyncExternalStore(subscribePlayer, getPlayerSnapshot, getServerPlayerSnapshot);
}

export function usePlayerId(): string {
  return usePlayer().id;
}

export function useIsPlayerId(id: string): boolean {
  const playerId = usePlayerId();
  return playerId.length > 0 && playerId === id;
}

/** Rename the local player and notify subscribers. */
export function renamePlayer(name: string): string {
  const finalName = setPlayerName(name);
  cachedPlayer = null;
  emitPlayerChange();
  return finalName;
}

function getOriginSnapshot(): string {
  return typeof window !== "undefined" ? window.location.origin : "";
}

/** Current window origin; empty during SSR. */
export function useOrigin(): string {
  return useSyncExternalStore(
    () => () => {},
    getOriginSnapshot,
    () => "",
  );
}
