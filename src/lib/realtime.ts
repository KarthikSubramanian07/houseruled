// Realtime client. Connects a WebSocket to the room's Durable Object
// (/api/room/<code>/ws) for live presence + game-state relay. Under `next dev`
// (no Worker) it degrades to a local single-seat demo so the lobby still renders.

import { HAS_REMOTE_BACKEND } from "./env";
import type { Player, PresenceState, SeatedPlayer } from "./types";

export type ChannelStatus = "connecting" | "connected" | "demo" | "error";

export interface JoinOptions {
  code: string;
  player: Player;
  onPlayers: (players: SeatedPlayer[]) => void;
  onBroadcast?: (event: string, payload: unknown) => void;
  onStatus?: (status: ChannelStatus) => void;
}

export interface RoomChannel {
  /** Send a game-state delta / message to everyone else in the room. */
  broadcast(event: string, payload: unknown): void;
  /** Leave the room and close the socket. */
  destroy(): Promise<void>;
}

/**
 * Collapse a flat presence list into a stable, sorted seat list: dedupe by id
 * (keeping the earliest join — e.g. a player with two tabs), mark the viewer's
 * own seat, host first then by join order. Exported for unit testing.
 */
export function toSeats(players: PresenceState[], selfId: string): SeatedPlayer[] {
  const byId = new Map<string, SeatedPlayer>();
  for (const p of players) {
    if (!p?.id) continue;
    const existing = byId.get(p.id);
    if (existing && existing.joinedAt <= p.joinedAt) continue;
    byId.set(p.id, {
      id: p.id,
      name: p.name,
      isHost: p.isHost,
      isSelf: p.id === selfId,
      joinedAt: p.joinedAt,
    });
  }
  return [...byId.values()].sort((a, b) => {
    if (a.isHost !== b.isHost) return a.isHost ? -1 : 1;
    return a.joinedAt - b.joinedAt;
  });
}

export function joinRoomChannel(opts: JoinOptions): RoomChannel {
  const { code, player, onPlayers, onBroadcast, onStatus } = opts;

  // ── Demo mode: no Worker, seat the local player so the felt renders. ────────
  if (!HAS_REMOTE_BACKEND) {
    onStatus?.("demo");
    onPlayers([{ ...player, isHost: true, isSelf: true, joinedAt: Date.now() }]);
    return { broadcast: () => {}, destroy: async () => {} };
  }

  onStatus?.("connecting");
  let destroyed = false;

  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  const ws = new WebSocket(`${proto}://${window.location.host}/api/room/${code}/ws`);

  ws.onopen = () => {
    if (destroyed) {
      ws.close();
      return;
    }
    ws.send(JSON.stringify({ t: "join", id: player.id, name: player.name }));
    onStatus?.("connected");
  };

  ws.onmessage = (ev) => {
    if (destroyed || typeof ev.data !== "string") return;
    let msg: { t?: string; players?: PresenceState[]; event?: string; data?: unknown };
    try {
      msg = JSON.parse(ev.data);
    } catch {
      return;
    }
    if (msg.t === "presence" && Array.isArray(msg.players)) {
      onPlayers(toSeats(msg.players, player.id));
    } else if (msg.t === "msg" && msg.event) {
      onBroadcast?.(msg.event, msg.data);
    }
  };

  ws.onerror = () => {
    if (!destroyed) onStatus?.("error");
  };
  ws.onclose = () => {
    if (!destroyed) onStatus?.("error");
  };

  return {
    broadcast(event: string, data: unknown) {
      try {
        ws.send(JSON.stringify({ t: "msg", event, data }));
      } catch {
        // Socket not open — drop (Phase 1 will add buffering/reconnect).
      }
    },
    async destroy() {
      destroyed = true;
      try {
        ws.close();
      } catch {
        // Already closed.
      }
    },
  };
}
