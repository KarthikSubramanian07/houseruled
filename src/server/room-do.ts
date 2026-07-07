/// <reference types="@cloudflare/workers-types" />

// RoomDO — one Durable Object instance per room code. It is the room AND the
// authoritative game server:
//   • room metadata (host, status) in DO storage
//   • live players are the connected WebSockets (presence)
//   • when a game is running, the DO owns its state, validates every action, and
//     sends each socket its OWN projected view — a player never receives another
//     player's hidden cards.
// WebSocket Hibernation keeps idle rooms free.

import type { PresenceState, RoomStatus } from "../lib/types";
import type { Action } from "../lib/engine/types";
import { GAMES, initGame, applyGame, viewGame, supportsAIRules, addAIRules } from "../lib/engine/registry";
import { sanitizeRules, detectConflicts } from "../lib/engine/houserules";
import { randomSeed } from "../lib/engine/rng";
import { parseWithCache, type AIEnv } from "../lib/ai/groq";

export interface RoomMeta {
  code: string;
  hostId: string;
  status: RoomStatus;
  gameType: string | null;
  settings: Record<string, unknown>;
  createdAt: string;
}

interface SocketAttachment {
  id: string;
  name: string;
  isHost: boolean;
  joinedAt: number;
}

interface GameSlot {
  type: string;
  rules: string[];
  state: unknown;
}

type ClientMessage =
  | { t: "join"; id: string; name: string }
  | { t: "start"; game: string; rules?: string[]; ruleTexts?: string[] }
  | { t: "action"; action: Action }
  | { t: "proposeRule"; text: string }
  | { t: "chat"; text: string }
  | { t: "rename"; name: string }
  | { t: "rematch" }
  | { t: "backToLobby" };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export class RoomDO implements DurableObject {
  private readonly state: DurableObjectState;
  private readonly env: AIEnv;
  private game: GameSlot | null | undefined = undefined; // undefined = not yet loaded

  constructor(state: DurableObjectState, env: AIEnv) {
    this.state = state;
    this.env = env;
  }

  private async getMeta(): Promise<RoomMeta | null> {
    return (await this.state.storage.get<RoomMeta>("room")) ?? null;
  }

  private async loadGame(): Promise<GameSlot | null> {
    if (this.game === undefined) {
      this.game = (await this.state.storage.get<GameSlot>("game")) ?? null;
    }
    return this.game;
  }

  private async saveGame(slot: GameSlot | null): Promise<void> {
    this.game = slot;
    if (slot) await this.state.storage.put("game", slot);
    else await this.state.storage.delete("game");
  }

  // ── HTTP: create / info / websocket-upgrade ─────────────────────────────────
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean); // ["api","room",code, "ws"?]
    const code = decodeURIComponent(parts[2] ?? "");

    if (parts[3] === "ws") return this.handleWebSocketUpgrade(request);

    if (request.method === "POST") {
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

    const meta = await this.getMeta();
    if (!meta) return json({ error: "not_found" }, 404);
    return json(meta, 200);
  }

  private handleWebSocketUpgrade(request: Request): Response {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("expected websocket", { status: 426 });
    }
    const { 0: client, 1: server } = new WebSocketPair();
    this.state.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  // ── WebSocket lifecycle ─────────────────────────────────────────────────────
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== "string") return;
    let msg: ClientMessage;
    try {
      msg = JSON.parse(message) as ClientMessage;
    } catch {
      return;
    }

    switch (msg.t) {
      case "join":
        return this.onJoin(ws, msg);
      case "start":
        return this.onStart(ws, msg);
      case "action":
        return this.onAction(ws, msg);
      case "proposeRule":
        return this.onProposeRule(ws, msg);
      case "chat":
        return this.onChat(ws, msg);
      case "rename":
        return this.onRename(ws, msg);
      case "rematch":
        return this.onRematch(ws);
      case "backToLobby":
        return this.onBackToLobby(ws);
    }
  }

  private async onJoin(ws: WebSocket, msg: { id: string; name: string }): Promise<void> {
    const meta = await this.getMeta();
    // SECURITY (Phase 1 TODO): isHost is derived from a client-supplied id, so
    // it's spoofable. Harmless today — it only drives a cosmetic badge and the
    // start button, and the server re-checks host on privileged actions below by
    // the same id. Before real stakes, issue the host a server-side secret.
    const attachment: SocketAttachment = {
      id: String(msg.id ?? ""),
      name: String(msg.name ?? "Player").slice(0, 24),
      isHost: !!meta && msg.id === meta.hostId,
      joinedAt: Date.now(),
    };
    ws.serializeAttachment(attachment);
    this.broadcastPresence();
    // Catch a (re)joining player up on any game in progress.
    const game = await this.loadGame();
    if (game && attachment.id) {
      this.sendGameTo(ws, attachment.id, game);
    } else {
      this.sendJson(ws, { t: "game", view: null });
    }
  }

  private async onStart(ws: WebSocket, msg: { game: string; rules?: string[]; ruleTexts?: string[] }): Promise<void> {
    const actor = this.attachmentOf(ws);
    const meta = await this.getMeta();
    if (!actor || !meta) return;
    if (actor.id !== meta.hostId) return this.sendError(ws, "Only the host can start a game.");

    const def = GAMES[msg.game];
    if (!def) return this.sendError(ws, "Unknown game.");

    const seats = this.seatedPlayers();
    if (seats.length < def.minPlayers)
      return this.sendError(ws, `${def.name} needs at least ${def.minPlayers} players.`);
    if (seats.length > def.maxPlayers)
      return this.sendError(ws, `${def.name} allows at most ${def.maxPlayers} players.`);

    const rules = sanitizeRules(msg.game, msg.rules ?? []);
    if (detectConflicts(msg.game, rules).length > 0)
      return this.sendError(ws, "Those house rules conflict — resolve them first.");

    try {
      let state = initGame(msg.game, seats, rules, randomSeed());
      // Parse any free-text rules server-side (never trust client-parsed objects).
      const texts = (msg.ruleTexts ?? []).slice(0, 6);
      if (texts.length && supportsAIRules(msg.game)) {
        const parsed = [];
        for (const text of texts) {
          const r = await parseWithCache(text, msg.game, this.env);
          if (r.ok) parsed.push(r.rule);
        }
        if (parsed.length) state = addAIRules(msg.game, state, parsed);
      }
      await this.saveGame({ type: msg.game, rules, state });
      this.broadcastGame();
    } catch (err) {
      this.sendError(ws, "Couldn't start that game.");
      console.error(err);
    }
  }

  private async onAction(ws: WebSocket, msg: { action: Action }): Promise<void> {
    const actor = this.attachmentOf(ws);
    const game = await this.loadGame();
    if (!actor || !game) return;
    let res;
    try {
      res = applyGame(game.type, game.state, actor.id, msg.action);
    } catch (err) {
      console.error(err);
      return this.sendError(ws, "That move didn't work.");
    }
    if (!res.ok) return this.sendError(ws, res.error ?? "Illegal move.");
    await this.saveGame({ ...game, state: res.state });
    this.broadcastGame();
  }

  // Phase 3d — live free-text rule. Host-only; parsed + validated server-side,
  // then applied to the running game and broadcast (it appears on the table).
  private async onProposeRule(ws: WebSocket, msg: { text: string }): Promise<void> {
    const actor = this.attachmentOf(ws);
    const meta = await this.getMeta();
    const game = await this.loadGame();
    if (!actor || !meta || !game) return;
    if (actor.id !== meta.hostId) return this.sendError(ws, "Only the host can add a rule mid-game.");
    if (!supportsAIRules(game.type)) return this.sendError(ws, "This game doesn't take custom rules.");

    const parsed = await parseWithCache(String(msg.text ?? ""), game.type, this.env);
    if (!parsed.ok) return this.sendError(ws, parsed.error);

    const state = addAIRules(game.type, game.state, [parsed.rule]);
    await this.saveGame({ ...game, state });
    // Announce it so the table sees the change (not just silently applied).
    this.broadcastJson({ t: "notice", message: `New house rule: “${parsed.rule.raw}”` });
    this.broadcastGame();
  }

  private onRename(ws: WebSocket, msg: { name: string }): void {
    const att = this.attachmentOf(ws);
    if (!att) return;
    const name = String(msg.name ?? "").trim().slice(0, 24);
    if (!name) return;
    ws.serializeAttachment({ ...att, name });
    this.broadcastPresence(); // in-game seat labels are fixed at deal time
  }

  private onChat(ws: WebSocket, msg: { text: string }): void {
    const actor = this.attachmentOf(ws);
    if (!actor) return;
    const text = String(msg.text ?? "").trim().slice(0, 300);
    if (!text) return;
    this.broadcastJson({ t: "chat", from: actor.name, id: actor.id, text, at: Date.now() });
  }

  private async onRematch(ws: WebSocket): Promise<void> {
    const actor = this.attachmentOf(ws);
    const meta = await this.getMeta();
    const game = await this.loadGame();
    if (!actor || !meta || !game) return;
    if (actor.id !== meta.hostId) return this.sendError(ws, "Only the host can rematch.");
    const def = GAMES[game.type];
    const seats = this.seatedPlayers();
    if (!def || seats.length < def.minPlayers) return this.sendError(ws, "Not enough players to rematch.");
    const state = initGame(game.type, seats.slice(0, def.maxPlayers), game.rules, randomSeed());
    await this.saveGame({ ...game, state });
    this.broadcastGame();
  }

  private async onBackToLobby(ws: WebSocket): Promise<void> {
    const actor = this.attachmentOf(ws);
    const meta = await this.getMeta();
    if (!actor || !meta) return;
    if (actor.id !== meta.hostId) return this.sendError(ws, "Only the host can do that.");
    await this.saveGame(null);
    this.broadcastGame();
  }

  async webSocketClose(ws: WebSocket, code: number): Promise<void> {
    try {
      ws.close(code >= 1000 && code < 5000 ? code : 1000);
    } catch {
      /* already closing */
    }
    this.broadcastPresence();
  }

  async webSocketError(): Promise<void> {
    this.broadcastPresence();
  }

  // ── Presence ────────────────────────────────────────────────────────────────
  private attachmentOf(ws: WebSocket): SocketAttachment | null {
    const att = ws.deserializeAttachment() as SocketAttachment | null;
    return att && att.id ? att : null;
  }

  /** Unique joined players, in join order — the seats a game starts with. */
  private seatedPlayers(): { id: string; name: string }[] {
    const byId = new Map<string, SocketAttachment>();
    for (const ws of this.state.getWebSockets()) {
      const att = this.attachmentOf(ws);
      if (!att) continue;
      const prev = byId.get(att.id);
      if (!prev || att.joinedAt < prev.joinedAt) byId.set(att.id, att);
    }
    return [...byId.values()]
      .sort((a, b) => a.joinedAt - b.joinedAt)
      .map((a) => ({ id: a.id, name: a.name }));
  }

  private collectPlayers(): PresenceState[] {
    const players: PresenceState[] = [];
    const seen = new Set<string>();
    for (const ws of this.state.getWebSockets()) {
      const att = this.attachmentOf(ws);
      if (!att || seen.has(att.id)) continue;
      seen.add(att.id);
      players.push({ id: att.id, name: att.name, isHost: att.isHost, joinedAt: att.joinedAt });
    }
    return players;
  }

  private broadcastPresence(): void {
    this.broadcastJson({ t: "presence", players: this.collectPlayers() });
  }

  private broadcastJson(obj: unknown): void {
    const data = JSON.stringify(obj);
    for (const ws of this.state.getWebSockets()) this.trySend(ws, data);
  }

  private async broadcastGame(): Promise<void> {
    const game = await this.loadGame();
    for (const ws of this.state.getWebSockets()) {
      const att = this.attachmentOf(ws);
      if (!att) continue;
      if (game) this.sendGameTo(ws, att.id, game);
      else this.sendJson(ws, { t: "game", view: null });
    }
  }

  private sendGameTo(ws: WebSocket, viewerId: string, game: GameSlot): void {
    try {
      const view = viewGame(game.type, game.state, viewerId);
      this.sendJson(ws, { t: "game", view });
    } catch (err) {
      console.error(err);
    }
  }

  private sendError(ws: WebSocket, message: string): void {
    this.sendJson(ws, { t: "error", message });
  }

  private sendJson(ws: WebSocket, obj: unknown): void {
    this.trySend(ws, JSON.stringify(obj));
  }

  private trySend(ws: WebSocket, data: string): void {
    try {
      ws.send(data);
    } catch {
      /* socket gone */
    }
  }
}
