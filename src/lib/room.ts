// Room lifecycle against the Cloudflare backend. createRoom / getRoomByCode talk
// to the RoomDO Durable Object over a small REST surface (/api/room/<code>).
// Under plain `next dev` there's no Worker, so we degrade to a local "table demo"
// (un-persisted) and the felt still comes up. See HAS_REMOTE_BACKEND in env.ts.

import { generateRoomCode } from "./code";
import { HAS_REMOTE_BACKEND } from "./env";
import type { Player, Room, RoomStatus } from "./types";

// Shape returned by RoomDO (see src/server/room-do.ts → RoomMeta).
interface RoomMetaResponse {
  code: string;
  hostId: string;
  status: RoomStatus;
  gameType: string | null;
  settings: Record<string, unknown>;
  createdAt: string;
}

function mapMeta(m: RoomMetaResponse): Room {
  return {
    id: `room-${m.code}`,
    code: m.code,
    hostId: m.hostId,
    status: m.status,
    gameType: m.gameType ?? null,
    settings: m.settings ?? {},
    createdAt: m.createdAt,
  };
}

/** A synthetic, un-persisted room for local demo mode. */
function demoRoom(code: string, hostId: string): Room {
  return {
    id: `demo-${code}`,
    code,
    hostId,
    status: "lobby",
    gameType: null,
    settings: { demo: true },
    createdAt: new Date().toISOString(),
  };
}

const MAX_CODE_ATTEMPTS = 6;

/**
 * Create a room and return it. Retries on the (astronomically rare) code
 * collision reported by the DO (409). Demo mode returns an un-persisted room.
 */
export async function createRoom(host: Player): Promise<Room> {
  if (!HAS_REMOTE_BACKEND) return demoRoom(generateRoomCode(), host.id);

  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const code = generateRoomCode();
    const res = await fetch(`/api/room/${code}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ hostId: host.id }),
    });

    if (res.status === 201) return mapMeta((await res.json()) as RoomMetaResponse);
    if (res.status === 409) continue; // code already taken — try another
    throw new Error(`Failed to create room (${res.status})`);
  }
  throw new Error("Could not generate a free room code — try again.");
}

/**
 * Look up a room by its share code. Returns null if it doesn't exist. Demo mode
 * synthesizes a lobby room so /room/<code> always renders locally.
 */
export async function getRoomByCode(code: string, viewerId: string): Promise<Room | null> {
  if (!HAS_REMOTE_BACKEND) return demoRoom(code, viewerId);

  const res = await fetch(`/api/room/${code}`, { method: "GET" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Room lookup failed (${res.status})`);
  return mapMeta((await res.json()) as RoomMetaResponse);
}
