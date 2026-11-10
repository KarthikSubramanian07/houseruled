"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./Button";
import { getPlayer } from "@/lib/identity";
import { createRoom } from "@/lib/room";
import { normalizeCode, isValidCode, CODE_LENGTH } from "@/lib/code";

export function HomeActions() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setError(null);
    setCreating(true);
    try {
      const room = await createRoom(getPlayer());
      router.push(`/room/${room.code}`);
    } catch (err) {
      console.error(err);
      setError("Couldn't deal you a new table. Try again in a moment.");
      setCreating(false);
    }
  }

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidCode(code)) return;
    router.push(`/room/${code}`);
  }

  return (
    <div className="flex w-full max-w-md flex-col items-stretch gap-6">
      <Button
        size="lg"
        onClick={handleCreate}
        disabled={creating}
        className="w-full"
      >
        {creating ? "Dealing you in…" : "Start a table"}
      </Button>

      <div className="flex items-center gap-3 text-xs uppercase tracking-widest text-cream/75">
        <span className="h-px flex-1 bg-cream/15" aria-hidden />
        or join one
        <span className="h-px flex-1 bg-cream/15" aria-hidden />
      </div>

      <form onSubmit={handleJoin} className="flex flex-col gap-3" aria-describedby={error ? "join-error" : undefined}>
        <label htmlFor="code" className="sr-only">
          Room code
        </label>
        <div className="flex gap-2">
          <input
            id="code"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            placeholder="ENTER CODE"
            value={code}
            onChange={(e) => {
              setCode(normalizeCode(e.target.value));
              if (error) setError(null);
            }}
            maxLength={CODE_LENGTH}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "join-error" : undefined}
            className="tabular felt-panel min-w-0 flex-1 rounded-full px-5 py-3.5 text-center font-display text-2xl tracking-[0.35em] text-cream placeholder:text-cream/50 placeholder:tracking-[0.2em] placeholder:text-base"
          />
          <Button
            type="submit"
            variant="quiet"
            size="lg"
            disabled={!isValidCode(code)}
          >
            Join
          </Button>
        </div>
      </form>

      {error && (
        <p id="join-error" role="alert" className="text-center text-sm text-ember">
          {error}
        </p>
      )}
    </div>
  );
}
