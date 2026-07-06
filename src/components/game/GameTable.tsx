"use client";

import { useState } from "react";
import { PlayingCard } from "./PlayingCard";
import { Button } from "../Button";
import { SUITS, SUIT_SYMBOL, RANK_LABEL, isRed, type Card, type Suit, type Rank } from "@/lib/engine/cards";
import { getRule } from "@/lib/engine/houserules";
import type { Action, GameView, PlayerPublic } from "@/lib/engine/types";

const key = (c: Card) => `${c.r}${c.s}`;
function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export function GameTable({
  view,
  isHost,
  onAction,
  onRematch,
  onBackToLobby,
}: {
  view: GameView;
  isHost: boolean;
  onAction: (a: Action) => void;
  onRematch: () => void;
  onBackToLobby: () => void;
}) {
  const myTurn = view.turn === view.you;
  const opponents = view.players.filter((p) => p.id !== view.you);
  const me = view.players.find((p) => p.id === view.you);

  return (
    <div className="relative mx-auto flex w-full max-w-4xl flex-col gap-6">
      {/* Opponents */}
      <div className="flex flex-wrap items-start justify-center gap-3">
        {opponents.map((p) => (
          <OpponentBadge key={p.id} p={p} type={view.type} />
        ))}
      </div>

      {/* Active house rules — always visible, the signature idea. */}
      {view.rules.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          <span className="plaque-header text-[10px] text-brass/60">House rules</span>
          {view.rules.map((id) => (
            <span key={id} className="rounded-full border border-brass/30 bg-brass/5 px-2.5 py-0.5 text-xs text-brass">
              {getRule(id)?.label ?? id}
            </span>
          ))}
        </div>
      )}

      {/* Center — game-specific */}
      <div className="min-h-40 rounded-2xl border border-brass/15 bg-felt-dark/30 px-4 py-6">
        <Center view={view} onAction={onAction} />
      </div>

      {/* Log ticker */}
      {view.log.length > 0 && (
        <p className="text-center text-xs text-cream/45">{view.log[view.log.length - 1]}</p>
      )}

      {/* Your hand + actions */}
      <div className="flex flex-col items-center gap-4">
        {me && <ActionBar view={view} onAction={onAction} />}
        {view.hand.length > 0 && <Hand view={view} onAction={onAction} />}
        <p className="text-xs text-cream/45">
          {myTurn ? "Your move." : view.turn ? `Waiting on ${view.players.find((p) => p.id === view.turn)?.name ?? "…"}.` : ""}
        </p>
      </div>

      {view.status.over && (
        <EndOverlay
          message={view.status.message ?? "Game over"}
          won={view.status.winners.includes(view.you)}
          isHost={isHost}
          onRematch={onRematch}
          onBackToLobby={onBackToLobby}
        />
      )}
    </div>
  );
}

// ── Opponents ───────────────────────────────────────────────────────────────
function OpponentBadge({ p, type }: { p: PlayerPublic; type: string }) {
  const bjCards = (p.extra?.cards as Card[] | undefined) ?? null;
  const books = p.extra?.books as number | undefined;
  const result = p.extra?.result as string | undefined;
  return (
    <div className={`flex w-28 flex-col items-center gap-1.5 rounded-xl px-2 py-2 ${p.isTurn ? "bg-brass/10 ring-1 ring-brass/50" : ""}`}>
      <div className={`grid h-11 w-11 place-items-center rounded-full bg-felt-dark text-sm font-semibold text-cream ring-2 ${p.isTurn ? "ring-brass-bright turn-pulse" : "ring-brass/50"} ${p.out ? "opacity-40" : ""}`}>
        {initials(p.name)}
      </div>
      <span className="max-w-28 truncate text-xs font-medium text-cream">{p.name}</span>
      {type === "blackjack" && bjCards ? (
        <div className="flex items-center gap-0.5">
          {bjCards.map((c, i) => <PlayingCard key={i} card={c} size="sm" />)}
        </div>
      ) : (
        <span className="tabular text-xs text-cream/50">{p.handCount} cards</span>
      )}
      {type === "blackjack" && p.extra?.total != null && (
        <span className="tabular text-xs text-brass">{String(p.extra.total)}{result ? ` · ${result}` : ""}</span>
      )}
      {books != null && <span className="text-xs text-brass">{books} books</span>}
    </div>
  );
}

// ── Center dispatch ───────────────────────────────────────────────────────────
function Center({ view, onAction }: { view: GameView; onAction: (a: Action) => void }) {
  const c = view.center;
  switch (view.type) {
    case "war": {
      const battle = c.battle as { a: Card; b: Card; war: boolean } | null;
      return (
        <div className="flex flex-col items-center gap-3">
          {battle ? (
            <div className="flex items-center gap-6">
              <PlayingCard card={battle.a} size="lg" />
              <span className="font-display text-xl text-brass">{battle.war ? "WAR!" : "vs"}</span>
              <PlayingCard card={battle.b} size="lg" />
            </div>
          ) : (
            <div className="flex items-center gap-6">
              <PlayingCard faceDown size="lg" />
              <span className="font-display text-xl text-cream/40">vs</span>
              <PlayingCard faceDown size="lg" />
            </div>
          )}
        </div>
      );
    }
    case "crazyeights": {
      const top = c.top as Card;
      const suit = c.currentSuit as Suit;
      const mustDraw = (c.mustDraw as number) ?? 0;
      return (
        <div className="flex items-center justify-center gap-8">
          <div className="flex flex-col items-center gap-1">
            <PlayingCard faceDown size="lg" />
            <span className="tabular text-xs text-cream/50">{String(c.drawCount)} left</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <PlayingCard card={top} size="lg" />
            <span className={`text-xs ${isRed(suit) ? "text-ember" : "text-cream/70"}`}>
              suit {SUIT_SYMBOL[suit]}
            </span>
          </div>
          {mustDraw > 0 && <span className="font-display text-ember">+{mustDraw} to draw</span>}
        </div>
      );
    }
    case "blackjack": {
      const dealer = c.dealer as Card[];
      const hidden = (c.dealerHiddenCount as number) ?? 0;
      const total = c.dealerTotal as number | undefined;
      return (
        <div className="flex flex-col items-center gap-2">
          <span className="plaque-header text-xs text-brass/70">Dealer{total != null ? ` · ${total}` : ""}</span>
          <div className="flex items-center gap-1.5">
            {dealer.map((card, i) => <PlayingCard key={i} card={card} size="md" />)}
            {Array.from({ length: hidden }).map((_, i) => <PlayingCard key={`h${i}`} faceDown size="md" />)}
          </div>
        </div>
      );
    }
    case "gofish": {
      return (
        <div className="flex flex-col items-center gap-2">
          <PlayingCard faceDown size="lg" />
          <span className="tabular text-xs text-cream/50">{String(c.poolCount)} in the pool</span>
        </div>
      );
    }
    case "oldmaid": {
      const sourceCount = (c.sourceCount as number) ?? 0;
      const draws = view.legal.filter((a) => a.type === "draw");
      const canDraw = draws.length > 0;
      return (
        <div className="flex flex-col items-center gap-3">
          <span className="text-xs text-cream/55">
            {canDraw ? "Pick a card to draw:" : "Waiting…"}
          </span>
          <div className="flex flex-wrap items-center justify-center gap-1">
            {Array.from({ length: sourceCount }).map((_, i) => (
              <PlayingCard
                key={i}
                faceDown
                size="md"
                onClick={canDraw ? () => onAction({ type: "draw", index: i }) : undefined}
              />
            ))}
          </div>
          <span className="tabular text-xs text-cream/40">{String(c.discardCount)} discarded</span>
        </div>
      );
    }
    default:
      return null;
  }
}

// ── Your hand ─────────────────────────────────────────────────────────────────
function Hand({ view, onAction }: { view: GameView; onAction: (a: Action) => void }) {
  const [wild, setWild] = useState<Card | null>(null);
  const playable = new Set(
    view.type === "crazyeights"
      ? view.legal.filter((a) => a.type === "play").map((a) => key(a.card as Card))
      : [],
  );

  function clickCard(card: Card) {
    if (view.type !== "crazyeights" || !playable.has(key(card))) return;
    if (card.r === 8) setWild(card);
    else onAction({ type: "play", card });
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-center gap-1.5">
        {view.hand.map((card, i) => {
          const canPlay = playable.has(key(card));
          const myTurn = view.turn === view.you;
          return (
            <PlayingCard
              key={`${key(card)}-${i}`}
              card={card}
              size="md"
              delay={Math.min(i, 8) * 45}
              onClick={view.type === "crazyeights" && canPlay ? () => clickCard(card) : undefined}
              highlight={view.type === "crazyeights" && myTurn && canPlay}
              dimmed={view.type === "crazyeights" && myTurn && !canPlay}
            />
          );
        })}
      </div>
      {wild && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-brass/30 bg-felt-dark/60 p-3">
          <span className="text-sm text-cream/80">Declare a suit for your 8:</span>
          <div className="flex gap-2">
            {SUITS.map((s) => (
              <button
                key={s}
                onClick={() => { onAction({ type: "play", card: wild, suit: s }); setWild(null); }}
                className={`grid h-11 w-11 place-items-center rounded-lg bg-cream text-2xl ${isRed(s) ? "text-ember" : "text-ink"} hover:ring-2 hover:ring-brass`}
              >
                {SUIT_SYMBOL[s]}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// ── Action bars ─────────────────────────────────────────────────────────────
function ActionBar({ view, onAction }: { view: GameView; onAction: (a: Action) => void }) {
  const legal = view.legal;
  const has = (t: string) => legal.some((a) => a.type === t);
  if (legal.length === 0) return null;

  if (view.type === "war" && has("flip")) {
    return <Button size="lg" onClick={() => onAction({ type: "flip" })}>Flip</Button>;
  }
  if (view.type === "blackjack") {
    return (
      <div className="flex gap-3">
        {has("hit") && <Button size="lg" onClick={() => onAction({ type: "hit" })}>Hit</Button>}
        {has("stand") && <Button size="lg" variant="quiet" onClick={() => onAction({ type: "stand" })}>Stand</Button>}
      </div>
    );
  }
  if (view.type === "crazyeights") {
    return (
      <div className="flex gap-3">
        {has("draw") && <Button variant="quiet" onClick={() => onAction({ type: "draw" })}>Draw</Button>}
        {has("pass") && <Button variant="quiet" onClick={() => onAction({ type: "pass" })}>Pass</Button>}
      </div>
    );
  }
  if (view.type === "gofish" && has("ask")) {
    return <GoFishAsk view={view} onAction={onAction} />;
  }
  return null;
}

function GoFishAsk({ view, onAction }: { view: GameView; onAction: (a: Action) => void }) {
  const asks = view.legal.filter((a) => a.type === "ask");
  const targets = [...new Set(asks.map((a) => a.target as string))];
  const [target, setTarget] = useState<string | null>(targets[0] ?? null);
  const ranks = [...new Set(asks.filter((a) => a.target === target).map((a) => a.rank as Rank))].sort((a, b) => a - b);
  const [rank, setRank] = useState<Rank | null>(null);

  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-brass/25 bg-felt-dark/50 p-3">
      <span className="text-sm text-cream/80">Ask a player for a rank:</span>
      <div className="flex flex-wrap justify-center gap-1.5">
        {targets.map((t) => (
          <button
            key={t}
            onClick={() => { setTarget(t); setRank(null); }}
            className={`rounded-full px-3 py-1 text-xs ${target === t ? "bg-brass text-felt-deep" : "felt-panel text-cream"}`}
          >
            {view.players.find((p) => p.id === t)?.name ?? "Player"}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap justify-center gap-1.5">
        {ranks.map((r) => (
          <button
            key={r}
            onClick={() => setRank(r)}
            className={`tabular grid h-8 w-8 place-items-center rounded-lg text-sm ${rank === r ? "bg-brass text-felt-deep" : "bg-cream text-ink"}`}
          >
            {RANK_LABEL[r]}
          </button>
        ))}
      </div>
      <Button
        size="md"
        disabled={!target || rank == null}
        onClick={() => target && rank != null && onAction({ type: "ask", target, rank })}
      >
        {rank != null ? `Ask for ${RANK_LABEL[rank]}s` : "Choose a rank"}
      </Button>
    </div>
  );
}

// ── End overlay ───────────────────────────────────────────────────────────────
function EndOverlay({
  message,
  won,
  isHost,
  onRematch,
  onBackToLobby,
}: {
  message: string;
  won: boolean;
  isHost: boolean;
  onRematch: () => void;
  onBackToLobby: () => void;
}) {
  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-felt-deep/80 px-6 backdrop-blur-sm">
      <div className="deal-in flex max-w-sm flex-col items-center gap-4 rounded-2xl border border-brass/40 bg-felt-dark p-8 text-center shadow-2xl">
        <p className="font-display text-2xl text-brass">{won ? "🏆" : ""}</p>
        <p className="font-display text-3xl leading-tight text-cream">{message}</p>
        {isHost ? (
          <div className="mt-2 flex flex-col gap-2">
            <Button size="lg" onClick={onRematch}>Rematch</Button>
            <Button variant="quiet" onClick={onBackToLobby}>Back to lobby</Button>
          </div>
        ) : (
          <p className="text-sm text-cream/55">Waiting for the host to deal again…</p>
        )}
      </div>
    </div>
  );
}
