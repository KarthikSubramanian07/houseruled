/// <reference types="@cloudflare/workers-types" />

// RoomDO — one Durable Object instance per room code. It IS the room:
//   • room metadata (host, status, settings) lives in DO storage
//   • live players are the connected WebSockets, tracked via presence broadcasts
//   • game-state deltas (Phase 1+) relay through the same sockets
//
// This replaces both Supabase Realtime and the Supabase `rooms` table — the room
// exists as long as this DO holds state, addressed deterministically by its code.
// WebSocket Hibernation keeps idle rooms free (no wall-clock billing while empty).

import type { PresenceState, RoomStatus } from "../lib/types";

export interface RoomMeta {
  code: string;
  hostId: string;
  status: RoomStatus;
  gameType: string | null;
  settings: Record<string, unknown>;
  createdAt: string;
}

// Per-socket identity, stashed on the WebSocket so it survives hibernation.
interface SocketAttachment {
  id: string;
  name: string;
  isHost: boolean;
  joinedAt: number;
}

// Wire messages (client <-> DO). Kept tiny and mirrored in src/lib/realtime.ts.
type ClientMessage =
  | { t: "join"; id: string; name: string }
  | { t: "msg"; event: string; data: unknown };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export class RoomDO implements DurableObject {
  private readonly state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  private async getMeta(): Promise<RoomMeta | null> {
    return (await this.state.storage.get<RoomMeta>("room")) ?? null;
  }

  // ── HTTP: create / info / websocket-upgrade ─────────────────────────────────
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    // Paths arrive as /api/room/<code>[/ws]; the code is stored on create.
    const parts = url.pathname.split("/").filter(Boolean); // ["api","room",code, "ws"?]
    const code = decodeURIComponent(parts[2] ?? "");
    const isWs = parts[3] === "ws";

    if (isWs) return this.handleWebSocketUpgrade(request);

    if (request.method === "POST") {
      // Create. If this DO already holds a room, it's a code collision.
      const existing = await this.getMeta();
      if (existing) return json({ error: "code_taken" }, 409);

      const body = (await request.json().catch(() => ({}))) as { hostId?: string };
      if (!body.hostId) return json({ error: "missing_host" }, 400);

      const meta: RoomMeta = {
        code,
        hostId: body.hostId,
        status: "lobby",
        gameType: null,
        settings: {},
        createdAt: new Date().toISOString(),
      };
      await this.state.storage.put("room", meta);
      return json(meta, 201);
    }

    // GET: room info (used to join by code).
    const meta = await this.getMeta();
    if (!meta) return json({ error: "not_found" }, 404);
    return json(meta, 200);
  }

  private handleWebSocketUpgrade(request: Request): Response {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("expected websocket", { status: 426 });
    }
    const { 0: client, 1: server } = new WebSocketPair();
    // Hibernation API: the runtime can evict us between messages and rehydrate
    // the sockets (with their attachments) on the next event.
    this.state.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  // ── WebSocket lifecycle (hibernation handlers) ──────────────────────────────
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== "string") return;
    let parsed: ClientMessage;
    try {
      parsed = JSON.parse(message) as ClientMessage;
    } catch {
      return;
    }

    if (parsed.t === "join") {
      const meta = await this.getMeta();
      // SECURITY (Phase 1 TODO): isHost is derived from a client-supplied id, so
      // it's spoofable. Harmless now — it only drives a cosmetic badge and no
      // privileged action exists. Before wiring host-gated actions (deal/kick/
      // settings), authenticate the host with a server-issued secret and stop
      // returning hostId to non-host clients.
      const attachment: SocketAttachment = {
        id: String(parsed.id ?? ""),
        name: String(parsed.name ?? "Player").slice(0, 24),
        isHost: !!meta && parsed.id === meta.hostId,
        joinedAt: Date.now(),
      };
      ws.serializeAttachment(attachment);
      this.broadcastPresence();
      return;
    }

    if (parsed.t === "msg") {
      // Relay game-state deltas to everyone else on the channel.
      this.relay(ws, JSON.stringify({ t: "msg", event: parsed.event, data: parsed.data }));
      return;
    }
  }

  async webSocketClose(ws: WebSocket, code: number, _reason: string, _wasClean: boolean): Promise<void> {
    try {
      ws.close(code <= 1000 || code >= 3000 ? code : 1000);
    } catch {
      // Already closing.
    }
    this.broadcastPresence();
  }

  async webSocketError(): Promise<void> {
    this.broadcastPresence();
  }

  // ── Presence ────────────────────────────────────────────────────────────────
  private collectPlayers(): PresenceState[] {
    const players: PresenceState[] = [];
    for (const ws of this.state.getWebSockets()) {
      const att = ws.deserializeAttachment() as SocketAttachment | null;
      if (!att || !att.id) continue; // hasn't sent "join" yet
      players.push({
        id: att.id,
        name: att.name,
        isHost: att.isHost,
        joinedAt: att.joinedAt,
      });
    }
    return players;
  }

  private broadcastPresence(): void {
    const msg = JSON.stringify({ t: "presence", players: this.collectPlayers() });
    for (const ws of this.state.getWebSockets()) {
      try {
        ws.send(msg);
      } catch {
        // Socket gone mid-broadcast — ignore.
      }
    }
  }

  private relay(sender: WebSocket, msg: string): void {
    for (const ws of this.state.getWebSockets()) {
      if (ws === sender) continue;
      try {
        ws.send(msg);
      } catch {
        // Ignore.
      }
    }
  }
}
