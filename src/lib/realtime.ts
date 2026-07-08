// Realtime client. Connects a WebSocket to the room's Durable Object for live
// presence AND authoritative gameplay: it sends host/action messages and receives
// this player's own game view. Under `next dev` (no Worker) it degrades to a local
// single-seat demo so the lobby still renders.

import { HAS_REMOTE_BACKEND } from "./env";
import type { Player, PresenceState, SeatedPlayer } from "./types";
import type { Action, GameView } from "./engine/types";

export type ChannelStatus = "connecting" | "connected" | "demo" | "error";

export interface ChatMessage {
  from: string;
  id: string;
  text: string;
  at: number;
}

export interface JoinOptions {
  code: string;
  player: Player;
  onPlayers: (players: SeatedPlayer[]) => void;
  onGame: (view: GameView | null) => void;
  onStatus?: (status: ChannelStatus) => void;
  onError?: (message: string) => void;
  onNotice?: (message: string) => void;
  onChat?: (message: ChatMessage) => void;
}

export interface RoomChannel {
  startGame(game: string, rules: string[], ruleTexts?: string[]): void;
  sendAction(action: Action): void;
  proposeRule(text: string): void;
  sendChat(text: string): void;
  setName(name: string): void;
  rematch(): void;
  backToLobby(): void;
  destroy(): Promise<void>;
}

/**
 * Collapse a flat presence list into a stable, sorted seat list: dedupe by id
 * (earliest join wins), mark the viewer's own seat, host first then join order.
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
  const { code, player, onPlayers, onGame, onStatus, onError, onNotice, onChat } = opts;

  // ── Demo mode: no Worker, so seat the local player; games need the backend. ──
  if (!HAS_REMOTE_BACKEND) {
    onStatus?.("demo");
    onPlayers([{ ...player, isHost: true, isSelf: true, joinedAt: Date.now() }]);
    onGame(null);
    return {
      startGame: () => onError?.("Games run on the live backend - deploy or run `wrangler dev`."),
      sendAction: () => {},
      proposeRule: () => onError?.("Custom rules need the live backend."),
      sendChat: () => {},
      setName: () => {},
      rematch: () => {},
      backToLobby: () => {},
      destroy: async () => {},
    };
  }

  onStatus?.("connecting");
  let destroyed = false;
  // Per-room identity token: proves this client owns `player.id` so nobody else
  // can claim the seat (and read this hand). Minted by the server on first join.
  const tokenKey = `ht:tok:${code}`;
  const readToken = (): string | undefined => {
    try { return localStorage.getItem(tokenKey) ?? undefined; } catch { return undefined; }
  };
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  const ws = new WebSocket(`${proto}://${window.location.host}/api/room/${code}/ws`);

  const send = (obj: unknown) => {
    try {
      ws.send(JSON.stringify(obj));
    } catch {
      /* not open */
    }
  };

  ws.onopen = () => {
    if (destroyed) return ws.close();
    send({ t: "join", id: player.id, name: player.name, token: readToken() });
    onStatus?.("connected");
  };

  ws.onmessage = (ev) => {
    if (destroyed || typeof ev.data !== "string") return;
    let msg: {
      t?: string;
      players?: PresenceState[];
      view?: GameView | null;
      message?: string;
      from?: string;
      id?: string;
      text?: string;
      at?: number;
      token?: string;
    };
    try {
      msg = JSON.parse(ev.data);
    } catch {
      return;
    }
    if (msg.t === "welcome" && typeof msg.token === "string") {
      try { localStorage.setItem(tokenKey, msg.token); } catch { /* storage blocked */ }
    } else if (msg.t === "presence" && Array.isArray(msg.players)) onPlayers(toSeats(msg.players, player.id));
    else if (msg.t === "game") onGame(msg.view ?? null);
    else if (msg.t === "error" && msg.message) onError?.(msg.message);
    else if (msg.t === "notice" && msg.message) onNotice?.(msg.message);
    else if (msg.t === "chat" && msg.text)
      onChat?.({ from: msg.from ?? "?", id: msg.id ?? "", text: msg.text, at: msg.at ?? Date.now() });
  };

  ws.onerror = () => { if (!destroyed) onStatus?.("error"); };
  ws.onclose = () => { if (!destroyed) onStatus?.("error"); };

  return {
    startGame: (game, rules, ruleTexts) => send({ t: "start", game, rules, ruleTexts }),
    sendAction: (action) => send({ t: "action", action }),
    proposeRule: (text) => send({ t: "proposeRule", text }),
    sendChat: (text) => send({ t: "chat", text }),
    setName: (name) => send({ t: "rename", name }),
    rematch: () => send({ t: "rematch" }),
    backToLobby: () => send({ t: "backToLobby" }),
    async destroy() {
      destroyed = true;
      try {
        ws.close();
      } catch {
        /* already closed */
      }
    },
  };
}
