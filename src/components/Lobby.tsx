"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wordmark } from "./Wordmark";
import { Button, ButtonLink } from "./Button";
import { FeltTable } from "./FeltTable";
import { HouseRulesPlaque } from "./HouseRulesPlaque";
import { getPlayer } from "@/lib/identity";
import { getRoomByCode } from "@/lib/room";
import { joinRoomChannel, type ChannelStatus, type RoomChannel } from "@/lib/realtime";
import type { Player, Room, SeatedPlayer } from "@/lib/types";

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard blocked (e.g. insecure context) — fail quietly.
    }
  }

  return (
    <Button variant="quiet" size="md" onClick={copy} aria-live="polite">
      {copied ? "Copied ✓" : label}
    </Button>
  );
}

const STATUS_STYLES: Record<ChannelStatus, { dot: string; text: string }> = {
  connecting: { dot: "bg-brass animate-pulse", text: "Connecting…" },
  connected: { dot: "bg-emerald-400", text: "Live" },
  demo: { dot: "bg-cream/40", text: "Table demo" },
  error: { dot: "bg-ember", text: "Reconnecting…" },
};

function StatusPill({ status }: { status: ChannelStatus }) {
  const s = STATUS_STYLES[status];
  return (
    <span className="inline-flex items-center gap-2 text-xs text-cream/55">
      <span className={`h-2 w-2 rounded-full ${s.dot}`} />
      {s.text}
    </span>
  );
}

export function Lobby({ code }: { code: string }) {
  const [player, setPlayer] = useState<Player | null>(null);
  // undefined = still looking up · null = no such table · Room = found
  const [room, setRoom] = useState<Room | null | undefined>(undefined);
  const [players, setPlayers] = useState<SeatedPlayer[]>([]);
  const [status, setStatus] = useState<ChannelStatus>("connecting");
  const [shareUrl, setShareUrl] = useState("");
  // Distinct from a null room (which means "no such table"): the lookup itself
  // failed (network/service), so we offer a retry rather than a dead end.
  const [lookupFailed, setLookupFailed] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setShareUrl(`${window.location.origin}/room/${code}`);
    }

    const p = getPlayer();
    setPlayer(p);

    // Reset per-code state so navigating between tables shows loading, not stale.
    setRoom(undefined);
    setPlayers([]);
    setLookupFailed(false);

    let channel: RoomChannel | null = null;
    let cancelled = false;

    (async () => {
      let found: Room | null;
      try {
        found = await getRoomByCode(code, p.id);
      } catch (err) {
        console.error(err);
        if (!cancelled) setLookupFailed(true);
        return;
      }
      if (cancelled) return;
      if (!found) {
        setRoom(null);
        return;
      }
      setRoom(found);
      channel = joinRoomChannel({
        code,
        player: p,
        onPlayers: setPlayers,
        onStatus: setStatus,
      });
    })();

    return () => {
      cancelled = true;
      void channel?.destroy();
    };
  }, [code]);

  // ── Lookup failed (network / service) — offer a retry, not a dead end ────────
  if (lookupFailed) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
        <p className="font-display text-5xl text-brass">Trouble reaching the table</p>
        <p className="max-w-sm text-cream/70">
          We couldn&apos;t look up table{" "}
          <span className="tabular font-display tracking-widest text-cream">{code}</span>{" "}
          just now. It&apos;s probably a hiccup — give it another shuffle.
        </p>
        <Button size="lg" onClick={() => window.location.reload()}>
          Try again
        </Button>
      </main>
    );
  }

  // ── Table not found ─────────────────────────────────────────────────────────
  if (room === null) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
        <p className="font-display text-5xl text-brass">No table here</p>
        <p className="max-w-sm text-cream/70">
          Nobody&apos;s dealt a game at{" "}
          <span className="tabular font-display tracking-widest text-cream">
            {code}
          </span>
          . The code might be mistyped, or the table may have folded.
        </p>
        <ButtonLink href="/" size="lg">
          Start your own table
        </ButtonLink>
      </main>
    );
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (room === undefined || !player) {
    return (
      <main className="flex flex-1 items-center justify-center px-6">
        <p className="font-display text-2xl text-cream/60">Pulling up a chair…</p>
      </main>
    );
  }

  const isHost = room.hostId === player.id;

  return (
    <>
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <Wordmark size="sm" />
        <Link
          href="/"
          className="text-sm text-cream/55 no-underline transition-colors hover:text-cream"
        >
          Leave table
        </Link>
      </header>

      <main className="flex flex-1 flex-col gap-8 px-5 pb-16 sm:px-8">
        {/* Room code + sharing */}
        <section className="flex flex-col items-center gap-4 text-center">
          <div className="flex flex-col items-center gap-1">
            <span className="text-xs uppercase tracking-[0.3em] text-cream/45">
              Table code
            </span>
            <span className="tabular font-display text-6xl font-semibold tracking-[0.2em] text-brass sm:text-7xl">
              {code}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <CopyButton value={code} label="Copy code" />
            {shareUrl && <CopyButton value={shareUrl} label="Copy invite link" />}
          </div>
          <StatusPill status={status} />
        </section>

        {/* The table + the plaque */}
        <section className="mx-auto flex w-full max-w-5xl flex-col items-center gap-10 lg:flex-row lg:items-start lg:justify-center">
          <div className="w-full flex-1">
            <FeltTable players={players} />
            <p className="mt-2 text-center text-sm text-cream/50">
              {players.length === 1
                ? "You're the only one at the table."
                : `${players.length} players at the table.`}
            </p>
          </div>

          <div className="flex w-full flex-col items-center gap-6 lg:w-auto">
            <HouseRulesPlaque />

            {isHost ? (
              <div className="flex flex-col items-center gap-2">
                <Button size="lg" disabled className="w-full">
                  Deal the first hand
                </Button>
                <p className="max-w-xs text-center text-xs text-cream/45">
                  Games arrive in the next deal — War, Go Fish, Crazy Eights and
                  more are Phase 1.
                </p>
              </div>
            ) : (
              <p className="max-w-xs text-center text-sm text-cream/50">
                Waiting for the host to deal the first hand.
              </p>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
