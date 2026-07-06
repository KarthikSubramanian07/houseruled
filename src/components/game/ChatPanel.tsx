"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/realtime";

/** A quiet, collapsible table-chat pinned to the corner. */
export function ChatPanel({
  messages,
  selfId,
  onSend,
}: {
  messages: ChatMessage[];
  selfId: string;
  onSend: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastSeen = useRef(0);
  const unread = open ? 0 : messages.length - lastSeen.current;

  useEffect(() => {
    if (open) {
      lastSeen.current = messages.length;
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    }
  }, [messages, open]);

  function submit() {
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText("");
  }

  return (
    <div className="fixed bottom-4 right-4 z-20 flex flex-col items-end gap-2" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      {open && (
        <div className="flex h-80 w-72 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-brass/25 bg-felt-dark/95 shadow-2xl backdrop-blur">
          <div className="flex items-center justify-between border-b border-brass/15 px-3 py-2">
            <span className="plaque-header text-xs text-brass/70">Table chat</span>
            <button onClick={() => setOpen(false)} className="text-cream/40 hover:text-cream">✕</button>
          </div>
          <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-3 py-2">
            {messages.length === 0 ? (
              <p className="pt-4 text-center text-xs text-cream/35">Say hello 👋</p>
            ) : (
              messages.map((m, i) => (
                <div key={i} className="text-sm">
                  <span className={m.id === selfId ? "text-brass" : "text-cream/60"}>{m.from}: </span>
                  <span className="text-cream/90">{m.text}</span>
                </div>
              ))
            )}
          </div>
          <div className="flex gap-2 border-t border-brass/15 p-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="Message…"
              maxLength={300}
              className="min-w-0 flex-1 rounded-full bg-felt/60 px-3 py-1.5 text-sm text-cream placeholder:text-cream/30"
            />
            <button onClick={submit} className="text-sm text-brass hover:text-brass-bright">Send</button>
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        className="btn-brass relative grid h-12 w-12 place-items-center rounded-full text-lg shadow-lg"
        aria-label="Toggle chat"
      >
        💬
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-ember px-1 text-[10px] text-cream">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
    </div>
  );
}
