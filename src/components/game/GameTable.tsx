"use client";

import { useState } from "react";
import { PlayingCard } from "./PlayingCard";
import { Button } from "../Button";
import { SUITS, SUIT_SYMBOL, RANK_LABEL, isRed, type Card, type Suit, type Rank } from "@/lib/engine/cards";
import { getRule } from "@/lib/engine/houserules";
import { GAME_CATALOG } from "@/lib/engine/registry";
import { validCapture } from "@/lib/engine/games/casino";
import { HowToPlay } from "./HowToPlay";
import type { Action, GameView, PlayerPublic } from "@/lib/engine/types";

const key = (c: Card) => (c.j ? "JK" : `${c.r}${c.s}`);
function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export function GameTable({
  view,
  isHost,
  onAction,
  onProposeRule,
  onRematch,
  onBackToLobby,
}: {
  view: GameView;
  isHost: boolean;
  onAction: (a: Action) => void;
  onProposeRule: (text: string) => void;
  onRematch: () => void;
  onBackToLobby: () => void;
}) {
  const myTurn = view.turn === view.you;
  const opponents = view.players.filter((p) => p.id !== view.you);
  const me = view.players.find((p) => p.id === view.you);

  const gameName = GAME_CATALOG.find((g) => g.type === view.type)?.name ?? "";

  return (
    <div className="relative mx-auto flex w-full max-w-4xl flex-col gap-6">
      {/* Quick rules reference — always one tap away. */}
      <div className="absolute right-0 top-0 z-10">
        <HowToPlay type={view.type} name={gameName} />
      </div>

      {/* Opponents */}
      <div className="flex flex-wrap items-start justify-center gap-3">
        {opponents.map((p) => (
          <OpponentBadge key={p.id} p={p} type={view.type} />
        ))}
      </div>

      {/* Active house rules — always visible, the signature idea. */}
      <RulesBar view={view} isHost={isHost} onProposeRule={onProposeRule} />

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
        {view.type === "cheat" ? (
          <CheatControls view={view} onAction={onAction} />
        ) : view.type === "gin" ? (
          <GinControls view={view} onAction={onAction} />
        ) : view.type === "casino" ? (
          <CasinoControls view={view} onAction={onAction} />
        ) : view.type === "cribbage" ? (
          <CribbageControls view={view} onAction={onAction} />
        ) : view.type === "fivehundred" ? (
          <FiveHundredControls view={view} onAction={onAction} />
        ) : (
          <>
            {me && <ActionBar view={view} onAction={onAction} />}
            {view.hand.length > 0 && <Hand view={view} onAction={onAction} />}
          </>
        )}
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

// ── House-rules bar (Phase 2 chips + Phase 3 free-text chips + host add) ──────
function RulesBar({
  view,
  isHost,
  onProposeRule,
}: {
  view: GameView;
  isHost: boolean;
  onProposeRule: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const [adding, setAdding] = useState(false);
  const supportsAI = view.aiRules !== undefined;
  const hasRules = view.rules.length > 0 || (view.aiRules?.length ?? 0) > 0;

  function submit() {
    const t = text.trim();
    if (!t) return;
    onProposeRule(t);
    setText("");
    setAdding(false);
  }

  return (
    <div className="flex flex-col items-center gap-2">
      {hasRules && (
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          <span className="plaque-header text-[10px] text-brass/60">House rules</span>
          {view.rules.map((id) => (
            <span key={id} className="rounded-full border border-brass/30 bg-brass/5 px-2.5 py-0.5 text-xs text-brass">
              {getRule(id)?.label ?? id}
            </span>
          ))}
          {view.aiRules?.map((r) => (
            <span key={r.id} title={r.summary} className="rounded-full border border-brass/40 bg-brass/10 px-2.5 py-0.5 text-xs text-brass">
              ✦ {r.raw}
            </span>
          ))}
        </div>
      )}
      {isHost && supportsAI && !view.status.over &&
        (adding ? (
          <div className="flex items-center gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              autoFocus
              placeholder="e.g. tens skip the next player"
              maxLength={200}
              className="felt-panel w-64 rounded-full px-3 py-1 text-xs text-cream placeholder:text-cream/30"
            />
            <button onClick={submit} className="text-xs text-brass hover:text-brass-bright">Add</button>
            <button onClick={() => setAdding(false)} className="text-xs text-cream/40">cancel</button>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} className="text-xs text-cream/45 transition-colors hover:text-brass">
            ✦ add a house rule (plain English)
          </button>
        ))}
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
      {type === "hearts" && p.extra?.points != null && (
        <span className="tabular text-xs text-brass">{String(p.extra.points)} pts</span>
      )}
      {(type === "spades" || type === "ohhell") && (
        <span className="tabular text-xs text-brass">
          {p.extra?.bid == null ? "bidding…" : `bid ${String(p.extra.bid)} · won ${String(p.extra.won ?? 0)}`}
        </span>
      )}
      {type === "euchre" && (
        <span className="text-xs text-brass/80">
          Team {p.extra?.team === 0 ? "A" : "B"}{p.extra?.isMaker ? " · maker" : ""}
        </span>
      )}
      {type === "scopa" && (
        <span className="tabular text-xs text-brass/80">
          {String(p.extra?.captured ?? 0)} cards{Number(p.extra?.scope ?? 0) > 0 ? ` · ${p.extra?.scope} scopa` : ""}
        </span>
      )}
      {type === "pitch" && (
        <span className="tabular text-xs text-brass/80">
          {p.extra?.isPitcher ? `pitched ${String(p.extra?.bid ?? "")}` : "in the hand"}
          {p.extra?.score != null ? ` · ${Number(p.extra.score) >= 0 ? "+" : ""}${String(p.extra.score)}` : ""}
        </span>
      )}
      {type === "casino" && (
        <span className="tabular text-xs text-brass/80">
          {String(p.extra?.total ?? 0)} pts · {String(p.extra?.captured ?? 0)} cards{Number(p.extra?.sweeps ?? 0) > 0 ? ` · ${p.extra?.sweeps} sweep` : ""}
        </span>
      )}
      {type === "cribbage" && (
        <span className="tabular text-xs text-brass/80">
          {String(p.extra?.score ?? 0)} / 121{p.extra?.isDealer ? " · deals" : ""}
        </span>
      )}
      {type === "fivehundred" && (
        <span className="tabular text-xs text-brass/80">
          Team {p.extra?.team === 0 ? "A" : "B"}{p.extra?.isDeclarer ? " · bidder" : ""}
          {p.extra?.passed ? " · passed" : ""}
        </span>
      )}
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
    case "hearts":
    case "spades": {
      const trick = (c.trick as { card: Card; name: string }[]) ?? [];
      const trump = view.type === "spades";
      const broken = trump ? (c.spadesBroken as boolean) : (c.heartsBroken as boolean);
      const bidding = trump && c.phase === "bidding";
      const myTurn = view.turn === view.you;
      if (bidding) {
        return (
          <div className="flex flex-col items-center gap-2 py-4">
            <span className="font-display text-xl text-cream/80">Bidding</span>
            <span className="text-xs text-cream/50">{myTurn ? "How many tricks will you take?" : "Waiting for bids…"}</span>
          </div>
        );
      }
      return (
        <div className="flex flex-col items-center gap-3">
          <div className="flex min-h-24 items-center justify-center gap-3">
            {trick.length === 0 ? (
              <span className="text-sm text-cream/45">{myTurn ? "Lead a card." : "Waiting…"}</span>
            ) : (
              trick.map((p, i) => (
                <div key={i} className="deal-in flex flex-col items-center gap-1">
                  <PlayingCard card={p.card} size="md" />
                  <span className="max-w-16 truncate text-xs text-cream/55">{p.name}</span>
                </div>
              ))
            )}
          </div>
          <span className="text-xs text-cream/45">
            Trick {(c.trickCount as number) + 1} / 13
            {trump ? " · ♠ trump" : ""}
            {broken ? "" : trump ? " · spades unbroken" : " · hearts unbroken"}
          </span>
        </div>
      );
    }
    case "ohhell": {
      const trick = (c.trick as { card: Card; name: string }[]) ?? [];
      const trump = c.trump as Suit;
      const myTurn = view.turn === view.you;
      if (c.phase === "bidding") {
        return (
          <div className="flex flex-col items-center gap-2">
            <span className="text-xs uppercase tracking-widest text-cream/45">Trump</span>
            <PlayingCard card={c.turned as Card} size="lg" />
            <span className="text-xs text-cream/50">{myTurn ? "Bid the exact tricks you'll take." : "Waiting for bids…"}</span>
          </div>
        );
      }
      return (
        <div className="flex flex-col items-center gap-3">
          <div className="flex min-h-24 items-center justify-center gap-3">
            {trick.length === 0 ? (
              <span className="text-sm text-cream/45">{myTurn ? "Lead a card." : "Waiting…"}</span>
            ) : (
              trick.map((p, i) => (
                <div key={i} className="deal-in flex flex-col items-center gap-1">
                  <PlayingCard card={p.card} size="md" />
                  <span className="max-w-16 truncate text-xs text-cream/55">{p.name}</span>
                </div>
              ))
            )}
          </div>
          <span className="text-xs text-cream/45">
            Trump {SUIT_SYMBOL[trump]} · Trick {(c.trickCount as number) + 1} / {String(c.handSize)}
          </span>
        </div>
      );
    }
    case "scopa": {
      const table = (c.table as Card[]) ?? [];
      return (
        <div className="flex flex-col items-center gap-2">
          <div className="flex min-h-24 flex-wrap items-center justify-center gap-1.5">
            {table.length === 0 ? (
              <span className="text-sm text-cream/45">Table is clear.</span>
            ) : (
              table.map((cd, i) => <PlayingCard key={`${cd.r}${cd.s}-${i}`} card={cd} size="md" />)
            )}
          </div>
          <span className="tabular text-xs text-cream/45">Table · {table.length} cards · deck {String(c.deckCount)}</span>
        </div>
      );
    }
    case "gin": {
      const top = c.discardTop as Card | null;
      const stockCount = c.stockCount as number;
      return (
        <div className="flex items-end justify-center gap-6">
          <div className="flex flex-col items-center gap-1">
            {stockCount > 0 ? <PlayingCard faceDown size="lg" /> : <div className="h-28 w-20 rounded-lg border border-dashed border-cream/20" />}
            <span className="tabular text-xs text-cream/50">stock · {stockCount}</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            {top ? <PlayingCard card={top} size="lg" /> : <div className="h-28 w-20 rounded-lg border border-dashed border-cream/20" />}
            <span className="text-xs text-cream/50">discard</span>
          </div>
        </div>
      );
    }
    case "cheat": {
      const claim = c.claim as { name: string; rank: string; count: number } | null;
      const pileCount = c.pileCount as number;
      return (
        <div className="flex flex-col items-center gap-2">
          {pileCount > 0 ? <PlayingCard faceDown size="lg" /> : <div className="h-28 w-20 rounded-lg border border-dashed border-cream/20" />}
          <span className="tabular text-xs text-cream/50">{pileCount} in the pile</span>
          {claim ? (
            <span className="text-sm text-cream/80">
              {claim.name} claims <span className="text-brass">{claim.count} × {claim.rank}</span>
            </span>
          ) : (
            <span className="text-xs text-cream/45">No claim yet.</span>
          )}
          <span className="text-xs text-cream/45">You must claim: <span className="text-brass">{String(c.requiredRank)}s</span></span>
        </div>
      );
    }
    case "euchre": {
      const trick = (c.trick as { card: Card; name: string }[]) ?? [];
      const trump = c.trump as Suit | null;
      const phase = c.phase as string;
      const tw = (c.tricksWon as [number, number]) ?? [0, 0];
      const myTurn = view.turn === view.you;
      if (phase === "bid1" || phase === "bid2") {
        return (
          <div className="flex flex-col items-center gap-2">
            <span className="text-xs uppercase tracking-widest text-cream/45">Turned up</span>
            <PlayingCard card={c.turned as Card} size="lg" />
            <span className="text-xs text-cream/50">
              {phase === "bid1" ? "Order it up as trump, or pass." : "Name a different suit, or pass."}
            </span>
          </div>
        );
      }
      if (phase === "discard") return <p className="text-center text-sm text-cream/50">{String(c.dealerName)} is discarding…</p>;
      return (
        <div className="flex flex-col items-center gap-3">
          <div className="flex min-h-24 items-center justify-center gap-3">
            {trick.length === 0 ? (
              <span className="text-sm text-cream/45">{myTurn ? "Lead a card." : "Waiting…"}</span>
            ) : (
              trick.map((p, i) => (
                <div key={i} className="deal-in flex flex-col items-center gap-1">
                  <PlayingCard card={p.card} size="md" />
                  <span className="max-w-16 truncate text-xs text-cream/55">{p.name}</span>
                </div>
              ))
            )}
          </div>
          <span className="text-xs text-cream/45">
            Trump {trump ? SUIT_SYMBOL[trump] : "?"} · Trick {(c.trickCount as number) + 1} / 5 · A {tw[0]} – B {tw[1]}
          </span>
        </div>
      );
    }
    case "pitch": {
      const trick = (c.trick as { card: Card; name: string }[]) ?? [];
      const trump = c.trump as Suit | null;
      const myTurn = view.turn === view.you;
      if (c.phase === "bidding") {
        return (
          <div className="flex flex-col items-center gap-2 py-4">
            <span className="font-display text-xl text-cream/80">Bidding</span>
            <span className="text-xs text-cream/50">
              {c.highBid ? `${c.pitcherName} bids ${String(c.highBid)}` : "No bids yet"}
              {" · "}{myTurn ? "bid 2–4 for the points you'll take, or pass" : "waiting for bids…"}
            </span>
          </div>
        );
      }
      return (
        <div className="flex flex-col items-center gap-3">
          <div className="flex min-h-24 items-center justify-center gap-3">
            {trick.length === 0 ? (
              <span className="text-sm text-cream/45">
                {myTurn ? (trump ? "Lead a card." : "Lead — the suit you play sets trump.") : "Waiting…"}
              </span>
            ) : (
              trick.map((p, i) => (
                <div key={i} className="deal-in flex flex-col items-center gap-1">
                  <PlayingCard card={p.card} size="md" />
                  <span className="max-w-16 truncate text-xs text-cream/55">{p.name}</span>
                </div>
              ))
            )}
          </div>
          <span className="text-xs text-cream/45">
            {trump ? `Trump ${SUIT_SYMBOL[trump]}` : "Trump not set"} · {String(c.pitcherName)} pitched {String(c.highBid)} · Trick {(c.trickCount as number) + 1} / 6
          </span>
        </div>
      );
    }
    case "casino": {
      const tot = (c.total as [number, number]) ?? [0, 0];
      return (
        <div className="flex flex-col items-center gap-2">
          {(c.deckCount as number) > 0 ? <PlayingCard faceDown size="lg" /> : <div className="h-28 w-20 rounded-lg border border-dashed border-cream/20" />}
          <span className="tabular text-xs text-cream/50">Deal {String(c.deal)} · {String(c.deckCount)} in the deck</span>
          <span className="tabular text-xs text-brass">Race to 21 · {tot[0]} – {tot[1]}</span>
        </div>
      );
    }
    case "fivehundred": {
      const trick = (c.trick as { card: Card; name: string }[]) ?? [];
      const contract = c.contract as { tricks: number; label: string } | null;
      const highBid = c.highBid as { tricks: number; label: string; name: string; value: number } | null;
      const tw = (c.tricksWon as [number, number]) ?? [0, 0];
      const ts = (c.teamScores as [number, number]) ?? [0, 0];
      const myTurn = view.turn === view.you;
      if (c.phase === "bidding") {
        return (
          <div className="flex flex-col items-center gap-2 py-3">
            <span className="font-display text-xl text-cream/80">Bidding</span>
            <span className="text-xs text-cream/55">
              {highBid ? `${highBid.name} holds ${highBid.tricks} ${highBid.label} (${highBid.value})` : "No bids yet — open the auction."}
            </span>
            <span className="tabular text-[11px] text-brass/70">Team A {ts[0]} · Team B {ts[1]}</span>
          </div>
        );
      }
      if (c.phase === "kitty") {
        return (
          <div className="flex flex-col items-center gap-2 py-4">
            <span className="font-display text-xl text-cream/80">{contract?.tricks} {contract?.label}</span>
            <span className="text-xs text-cream/55">{c.kittyPickup ? "Take the kitty — discard 3." : `${String(c.declarerName)} is exchanging the kitty…`}</span>
          </div>
        );
      }
      return (
        <div className="flex flex-col items-center gap-3">
          <div className="flex min-h-24 items-center justify-center gap-3">
            {trick.length === 0 ? (
              <span className="text-sm text-cream/45">{myTurn ? "Lead a card." : "Waiting…"}</span>
            ) : (
              trick.map((p, i) => (
                <div key={i} className="deal-in flex flex-col items-center gap-1">
                  <PlayingCard card={p.card} size="md" />
                  <span className="max-w-16 truncate text-xs text-cream/55">{p.name}</span>
                </div>
              ))
            )}
          </div>
          <span className="text-xs text-cream/45">
            {contract?.tricks} {contract?.label} · Trick {(c.trickCount as number) + 1} / 10 · A {tw[0]} – B {tw[1]}
          </span>
        </div>
      );
    }
    case "cribbage": {
      const starter = c.starter as Card | null;
      const pile = (c.pile as { card: Card; name: string }[]) ?? [];
      if (c.phase === "discard") {
        return (
          <div className="flex flex-col items-center gap-2 py-4">
            <span className="font-display text-xl text-cream/80">The Crib</span>
            <span className="text-xs text-cream/50">
              Each player lays 2 cards aside for {c.isDealer ? "your" : "the dealer's"} crib.
            </span>
            <span className="tabular text-xs text-brass/70">{String(c.cribSize)} / 4 in the crib</span>
          </div>
        );
      }
      return (
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-center gap-1">
              {starter ? <PlayingCard card={starter} size="md" /> : <PlayingCard faceDown size="md" />}
              <span className="text-[10px] uppercase tracking-widest text-cream/40">starter</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="font-display text-3xl text-brass">{String(c.count)}</span>
              <span className="text-[10px] uppercase tracking-widest text-cream/40">count</span>
            </div>
          </div>
          <div className="flex min-h-16 flex-wrap items-center justify-center gap-1.5">
            {pile.map((p, i) => (
              <div key={i} className="deal-in flex flex-col items-center gap-0.5">
                <PlayingCard card={p.card} size="sm" />
              </div>
            ))}
          </div>
        </div>
      );
    }
    default:
      return null;
  }
}

// ── Your hand ─────────────────────────────────────────────────────────────────
const CARD_PLAY = new Set(["crazyeights", "hearts", "spades", "euchre", "ohhell", "scopa", "pitch"]);

function Hand({ view, onAction }: { view: GameView; onAction: (a: Action) => void }) {
  const [wild, setWild] = useState<Card | null>(null);
  const isCardPlay = CARD_PLAY.has(view.type);
  // Actions that come with a card: play (all card games) or discard (euchre dealer).
  const playMap = new Map(
    isCardPlay
      ? view.legal.filter((a) => a.card && (a.type === "play" || a.type === "discard")).map((a) => [key(a.card as Card), a] as const)
      : [],
  );

  function clickCard(card: Card) {
    const a = playMap.get(key(card));
    if (!a) return;
    if ((a as { wild?: boolean }).wild) setWild(card); // crazyeights 8 / AI-wild
    else onAction(a as Action);
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-center gap-1.5">
        {view.hand.map((card, i) => {
          const canPlay = playMap.has(key(card));
          const myTurn = view.turn === view.you;
          return (
            <PlayingCard
              key={`${key(card)}-${i}`}
              card={card}
              size="md"
              delay={Math.min(i, 8) * 45}
              onClick={isCardPlay && canPlay ? () => clickCard(card) : undefined}
              highlight={isCardPlay && myTurn && canPlay}
              dimmed={isCardPlay && myTurn && !canPlay}
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
  if (view.type === "euchre") {
    if (has("orderup")) {
      const up = (view.center.turned as Card)?.s;
      return (
        <div className="flex gap-3">
          <Button size="lg" onClick={() => onAction({ type: "orderup" })}>
            Order up {up ? SUIT_SYMBOL[up] : ""}
          </Button>
          <Button variant="quiet" size="lg" onClick={() => onAction({ type: "pass" })}>Pass</Button>
        </div>
      );
    }
    if (has("call")) {
      const calls = legal.filter((a) => a.type === "call");
      return (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="mr-1 text-xs text-cream/60">Name trump:</span>
          {calls.map((a) => {
            const s = a.suit as Suit;
            return (
              <button
                key={s}
                onClick={() => onAction({ type: "call", suit: s })}
                className={`grid h-10 w-10 place-items-center rounded-lg bg-cream text-2xl ${isRed(s) ? "text-ember" : "text-ink"} hover:ring-2 hover:ring-brass`}
              >
                {SUIT_SYMBOL[s]}
              </button>
            );
          })}
          {has("pass") && <Button variant="quiet" size="md" onClick={() => onAction({ type: "pass" })}>Pass</Button>}
        </div>
      );
    }
    return null;
  }
  if (view.type === "spades" && has("bid")) {
    return (
      <div className="flex max-w-md flex-wrap items-center justify-center gap-1.5">
        <span className="mr-1 text-xs text-cream/60">Your bid:</span>
        {Array.from({ length: 14 }, (_, n) => (
          <button
            key={n}
            onClick={() => onAction({ type: "bid", n })}
            className="tabular grid h-9 w-9 place-items-center rounded-lg bg-cream text-sm text-ink transition-transform hover:-translate-y-0.5 hover:ring-2 hover:ring-brass"
          >
            {n === 0 ? "Nil" : n}
          </button>
        ))}
      </div>
    );
  }
  if (view.type === "ohhell" && has("bid")) {
    const bids = legal.filter((a) => a.type === "bid").map((a) => a.n as number);
    return (
      <div className="flex max-w-md flex-wrap items-center justify-center gap-1.5">
        <span className="mr-1 text-xs text-cream/60">Bid exactly:</span>
        {bids.map((n) => (
          <button
            key={n}
            onClick={() => onAction({ type: "bid", n })}
            className="tabular grid h-9 w-9 place-items-center rounded-lg bg-cream text-sm text-ink transition-transform hover:-translate-y-0.5 hover:ring-2 hover:ring-brass"
          >
            {n}
          </button>
        ))}
      </div>
    );
  }
  if (view.type === "pitch" && (has("bid") || has("pass"))) {
    const bids = legal.filter((a) => a.type === "bid").map((a) => a.n as number);
    return (
      <div className="flex max-w-md flex-wrap items-center justify-center gap-1.5">
        <span className="mr-1 text-xs text-cream/60">Bid:</span>
        {bids.map((n) => (
          <button
            key={n}
            onClick={() => onAction({ type: "bid", n })}
            className="tabular grid h-9 w-9 place-items-center rounded-lg bg-cream text-sm text-ink transition-transform hover:-translate-y-0.5 hover:ring-2 hover:ring-brass"
          >
            {n}
          </button>
        ))}
        {has("pass") && <Button variant="quiet" size="md" onClick={() => onAction({ type: "pass" })}>Pass</Button>}
      </div>
    );
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

// ── Cheat (Bluff) controls: multi-select + play/call ─────────────────────────
function CheatControls({ view, onAction }: { view: GameView; onAction: (a: Action) => void }) {
  const [sel, setSel] = useState<string[]>([]);
  const myTurn = view.turn === view.you;
  const canPlay = view.legal.some((a) => a.type === "play");
  const canCall = view.legal.some((a) => a.type === "call");
  const required = view.center.requiredRank as string;

  function toggle(card: Card) {
    if (!myTurn || !canPlay) return;
    const k = key(card);
    setSel((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : prev.length < 4 ? [...prev, k] : prev));
  }
  function play() {
    const cards = view.hand.filter((c) => sel.includes(key(c)));
    if (cards.length < 1) return;
    onAction({ type: "play", cards });
    setSel([]);
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex flex-wrap items-end justify-center gap-1.5">
        {view.hand.map((card, i) => (
          <PlayingCard
            key={`${key(card)}-${i}`}
            card={card}
            size="md"
            delay={Math.min(i, 8) * 30}
            onClick={myTurn && canPlay ? () => toggle(card) : undefined}
            selected={sel.includes(key(card))}
          />
        ))}
      </div>
      {myTurn ? (
        <div className="flex gap-3">
          <Button size="md" disabled={!canPlay || sel.length < 1} onClick={play}>
            Play {sel.length || ""} as {required}s
          </Button>
          {canCall && (
            <Button variant="quiet" size="md" onClick={() => onAction({ type: "call" })}>
              Call bluff
            </Button>
          )}
        </div>
      ) : (
        <p className="text-xs text-cream/45">Waiting…</p>
      )}
    </div>
  );
}

// ── Gin Rummy controls: draw, then select a card to discard / knock / gin ─────
function GinControls({ view, onAction }: { view: GameView; onAction: (a: Action) => void }) {
  const [sel, setSel] = useState<string | null>(null);
  const myTurn = view.turn === view.you;
  const phase = view.center.phase as string;
  const melded = new Set(view.center.melded as string[]);
  const deadwood = view.center.deadwood as number;

  const drawStock = view.legal.some((a) => a.type === "drawStock");
  const drawDiscard = view.legal.some((a) => a.type === "drawDiscard");
  const canKnock = sel != null && view.legal.some((a) => a.type === "knock" && key(a.card as Card) === sel);
  const canGin = sel != null && view.legal.some((a) => a.type === "gin" && key(a.card as Card) === sel);
  const selCard = view.hand.find((c) => key(c) === sel);

  function act(type: string) {
    if (!selCard) return;
    onAction({ type, card: selCard });
    setSel(null);
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {phase === "discard" && myTurn && (
        <span className="text-xs text-cream/50">
          Deadwood: <span className={deadwood <= 10 ? "text-brass" : "text-cream/70"}>{deadwood}</span>
          {deadwood <= 10 && " — you can knock"}
        </span>
      )}
      <div className="flex flex-wrap items-end justify-center gap-1.5">
        {view.hand.map((card, i) => (
          <PlayingCard
            key={`${key(card)}-${i}`}
            card={card}
            size="md"
            delay={Math.min(i, 8) * 30}
            onClick={phase === "discard" && myTurn ? () => setSel(key(card)) : undefined}
            selected={sel === key(card)}
            highlight={melded.has(key(card))}
          />
        ))}
      </div>
      {!myTurn ? (
        <p className="text-xs text-cream/45">Waiting…</p>
      ) : phase === "draw" ? (
        <div className="flex gap-3">
          {drawStock && <Button size="md" onClick={() => onAction({ type: "drawStock" })}>Draw from stock</Button>}
          {drawDiscard && <Button variant="quiet" size="md" onClick={() => onAction({ type: "drawDiscard" })}>Take discard</Button>}
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <Button size="md" disabled={!selCard} onClick={() => act("discard")}>Discard</Button>
          {canGin ? (
            <Button variant="quiet" size="md" onClick={() => act("gin")}>Gin! ✦</Button>
          ) : canKnock ? (
            <Button variant="quiet" size="md" onClick={() => act("knock")}>Knock</Button>
          ) : null}
          {!selCard && <span className="text-xs text-cream/40">pick a card</span>}
        </div>
      )}
    </div>
  );
}

// ── Casino controls: pick a card, tap table cards to capture, or trail ────────
function CasinoControls({ view, onAction }: { view: GameView; onAction: (a: Action) => void }) {
  const [handSel, setHandSel] = useState<string | null>(null);
  const [tableSel, setTableSel] = useState<string[]>([]);
  const myTurn = view.turn === view.you;
  const table = (view.center.table as Card[]) ?? [];
  const me = view.players.find((p) => p.id === view.you);
  const myTotal = me?.extra?.total as number | undefined;

  const handCard = view.hand.find((c) => key(c) === handSel) ?? null;
  const targets = table.filter((c) => tableSel.includes(key(c)));
  const canCapture = !!handCard && validCapture(targets, handCard);
  const canTrail = !!handCard && tableSel.length === 0;

  function reset() { setHandSel(null); setTableSel([]); }
  function toggleTable(c: Card) {
    if (!myTurn) return;
    const k = key(c);
    setTableSel((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  }
  function capture() { if (handCard && canCapture) { onAction({ type: "capture", card: handCard, targets }); reset(); } }
  function trail() { if (handCard) { onAction({ type: "trail", card: handCard }); reset(); } }

  return (
    <div className="flex flex-col items-center gap-3">
      {myTotal != null && <span className="text-xs text-cream/50">You: <span className="text-brass">{myTotal}</span> pts</span>}
      <div className="flex flex-col items-center gap-1">
        <span className="plaque-header text-[10px] text-brass/60">Table — tap cards to capture</span>
        <div className="flex min-h-24 max-w-lg flex-wrap items-center justify-center gap-1.5">
          {table.length === 0 ? (
            <span className="text-sm text-cream/45">Table is clear.</span>
          ) : (
            table.map((c, i) => (
              <PlayingCard
                key={`${key(c)}-t${i}`}
                card={c}
                size="md"
                onClick={myTurn ? () => toggleTable(c) : undefined}
                selected={tableSel.includes(key(c))}
              />
            ))
          )}
        </div>
      </div>
      <div className="h-px w-24 bg-brass/15" />
      <div className="flex flex-wrap items-end justify-center gap-1.5">
        {view.hand.map((c, i) => (
          <PlayingCard
            key={`${key(c)}-h${i}`}
            card={c}
            size="md"
            delay={Math.min(i, 8) * 30}
            onClick={myTurn ? () => setHandSel(handSel === key(c) ? null : key(c)) : undefined}
            selected={handSel === key(c)}
            highlight={myTurn && handSel === key(c)}
          />
        ))}
      </div>
      {myTurn ? (
        <div className="flex items-center gap-3">
          <Button size="md" disabled={!canCapture} onClick={capture}>
            Capture{targets.length ? ` ${targets.length}` : ""}
          </Button>
          <Button variant="quiet" size="md" disabled={!canTrail} onClick={trail}>Trail</Button>
          {!handCard && <span className="text-xs text-cream/40">pick a card to play</span>}
        </div>
      ) : (
        <p className="text-xs text-cream/45">Waiting…</p>
      )}
    </div>
  );
}

// ── Cribbage controls: discard 2 to the crib, then peg the play ───────────────
function CribbageControls({ view, onAction }: { view: GameView; onAction: (a: Action) => void }) {
  const [sel, setSel] = useState<string[]>([]);
  const phase = view.center.phase as string;
  const me = view.players.find((p) => p.id === view.you);
  const iDiscarded = !!me?.extra?.discarded;
  const myScore = me?.extra?.score as number | undefined;
  const myTurn = view.turn === view.you;
  const isDealer = !!view.center.isDealer;

  const playMap = new Map(
    phase === "play" ? view.legal.filter((a) => a.type === "play" && a.card).map((a) => [key(a.card as Card), a] as const) : [],
  );

  function toggle(card: Card) {
    const k = key(card);
    setSel((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : prev.length < 2 ? [...prev, k] : prev));
  }
  function sendCrib() {
    const cards = view.hand.filter((c) => sel.includes(key(c)));
    if (cards.length !== 2) return;
    onAction({ type: "discard", cards });
    setSel([]);
  }

  if (phase === "discard") {
    return (
      <div className="flex flex-col items-center gap-3">
        {myScore != null && <span className="text-xs text-cream/50">You: <span className="text-brass">{myScore}</span> / 121{isDealer ? " · your crib" : ""}</span>}
        <div className="flex flex-wrap items-end justify-center gap-1.5">
          {view.hand.map((card, i) => (
            <PlayingCard
              key={`${key(card)}-${i}`}
              card={card}
              size="md"
              delay={Math.min(i, 8) * 30}
              onClick={!iDiscarded ? () => toggle(card) : undefined}
              selected={sel.includes(key(card))}
            />
          ))}
        </div>
        {iDiscarded ? (
          <p className="text-xs text-cream/45">Laid to the crib — waiting for your opponent…</p>
        ) : (
          <Button size="md" disabled={sel.length !== 2} onClick={sendCrib}>
            Send {sel.length}/2 to the crib
          </Button>
        )}
      </div>
    );
  }

  // Play phase.
  return (
    <div className="flex flex-col items-center gap-3">
      {myScore != null && <span className="text-xs text-cream/50">You: <span className="text-brass">{myScore}</span> / 121</span>}
      <div className="flex flex-wrap items-end justify-center gap-1.5">
        {view.hand.map((card, i) => {
          const canPlay = playMap.has(key(card));
          return (
            <PlayingCard
              key={`${key(card)}-${i}`}
              card={card}
              size="md"
              delay={Math.min(i, 8) * 30}
              onClick={myTurn && canPlay ? () => onAction(playMap.get(key(card)) as Action) : undefined}
              highlight={myTurn && canPlay}
              dimmed={myTurn && !canPlay}
            />
          );
        })}
      </div>
      {view.hand.length === 0 && <p className="text-xs text-cream/45">Hand played out — counting the show…</p>}
      {view.hand.length > 0 && !myTurn && <p className="text-xs text-cream/45">Waiting…</p>}
    </div>
  );
}

// ── 500 controls: bid grid, kitty discard, then trick play ────────────────────
function FiveHundredControls({ view, onAction }: { view: GameView; onAction: (a: Action) => void }) {
  const phase = view.center.phase as string;
  const myTurn = view.turn === view.you;

  const playMap = new Map(
    phase === "playing" ? view.legal.filter((a) => a.type === "play" && a.card).map((a) => [key(a.card as Card), a] as const) : [],
  );

  if (phase === "bidding") {
    const bids = view.legal.filter((a) => a.type === "bid");
    const canPass = view.legal.some((a) => a.type === "pass");
    const SUIT_COLS: { s: string; label: string }[] = [
      { s: "S", label: "♠" }, { s: "C", label: "♣" }, { s: "D", label: "♦" }, { s: "H", label: "♥" }, { s: "NT", label: "NT" },
    ];
    return (
      <div className="flex flex-col items-center gap-3">
        {myTurn ? (
          <>
            <div className="flex flex-col gap-1">
              {[6, 7, 8, 9, 10].map((t) => {
                const row = bids.filter((b) => b.tricks === t);
                if (row.length === 0) return null;
                return (
                  <div key={t} className="flex items-center gap-1.5">
                    <span className="tabular w-4 text-right text-xs text-cream/50">{t}</span>
                    {SUIT_COLS.map((col) => {
                      const b = row.find((x) => x.suit === col.s);
                      const red = col.s === "H" || col.s === "D";
                      return b ? (
                        <button
                          key={col.s}
                          onClick={() => onAction({ type: "bid", tricks: t, suit: col.s })}
                          className={`grid h-8 min-w-8 place-items-center rounded-lg bg-cream px-1.5 text-sm ${red ? "text-ember" : "text-ink"} transition-transform hover:-translate-y-0.5 hover:ring-2 hover:ring-brass`}
                        >
                          {col.label}
                        </button>
                      ) : (
                        <span key={col.s} className="grid h-8 min-w-8 place-items-center px-1.5 text-sm text-cream/15">{col.label}</span>
                      );
                    })}
                  </div>
                );
              })}
            </div>
            {canPass && <Button variant="quiet" size="md" onClick={() => onAction({ type: "pass" })}>Pass</Button>}
          </>
        ) : (
          <p className="text-xs text-cream/45">Waiting for the auction…</p>
        )}
        <div className="flex flex-wrap items-end justify-center gap-1.5 opacity-90">
          {view.hand.map((card, i) => (
            <PlayingCard key={`${key(card)}-${i}`} card={card} size="sm" delay={Math.min(i, 10) * 25} />
          ))}
        </div>
      </div>
    );
  }

  if (phase === "kitty") {
    const mine = view.center.kittyPickup as boolean;
    const toGo = view.hand.length - 10;
    return (
      <div className="flex flex-col items-center gap-3">
        {mine ? (
          <span className="text-xs text-cream/60">Tap {toGo} card{toGo === 1 ? "" : "s"} to discard to the kitty.</span>
        ) : (
          <span className="text-xs text-cream/45">The bidder is exchanging the kitty…</span>
        )}
        <div className="flex flex-wrap items-end justify-center gap-1.5">
          {view.hand.map((card, i) => (
            <PlayingCard
              key={`${key(card)}-${i}`}
              card={card}
              size="md"
              delay={Math.min(i, 12) * 25}
              onClick={mine ? () => onAction({ type: "kitty", card }) : undefined}
              highlight={mine}
            />
          ))}
        </div>
      </div>
    );
  }

  // Play phase.
  return (
    <div className="flex flex-wrap items-end justify-center gap-1.5">
      {view.hand.map((card, i) => {
        const canPlay = playMap.has(key(card));
        return (
          <PlayingCard
            key={`${key(card)}-${i}`}
            card={card}
            size="md"
            delay={Math.min(i, 10) * 30}
            onClick={myTurn && canPlay ? () => onAction(playMap.get(key(card)) as Action) : undefined}
            highlight={myTurn && canPlay}
            dimmed={myTurn && !canPlay}
          />
        );
      })}
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
