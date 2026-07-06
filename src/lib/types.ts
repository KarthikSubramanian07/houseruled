// Shared domain types. Kept deliberately small in Phase 0 — game state lands in
// Phase 1. Room/presence shapes mirror RoomDO (src/server/room-do.ts).

export type RoomStatus = "lobby" | "in_game" | "finished";

export interface Room {
  id: string;
  code: string;
  hostId: string;
  status: RoomStatus;
  gameType: string | null;
  settings: Record<string, unknown>;
  createdAt: string;
}

/** An anonymous player identity, generated client-side and kept in localStorage. */
export interface Player {
  id: string;
  name: string;
}

/** A player as seen live around the table, via Realtime Presence. */
export interface SeatedPlayer extends Player {
  /** True for the seat belonging to this browser. */
  isSelf: boolean;
  /** True if this player created the room. */
  isHost: boolean;
  /** When they joined this presence session (ms since epoch, from their client). */
  joinedAt: number;
}

/** The presence payload each client tracks on the room channel. */
export interface PresenceState {
  id: string;
  name: string;
  isHost: boolean;
  joinedAt: number;
}
