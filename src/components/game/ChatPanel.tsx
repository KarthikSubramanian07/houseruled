"use client";

import { useEffect, useId, useRef, useState } from "react";
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
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputId = useId();
  const titleId = useId();
  const [lastSeen, setLastSeen] = useState(0);
  const unread = open ? 0 : Math.max(0, messages.length - lastSeen);
  const latest = messages[messages.length - 1];

  useEffect(() => {
    if (!open) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, open]);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = triggerRef.current;
    panelRef.current?.querySelector<HTMLElement>("input,button")?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previouslyFocused?.focus();
    };
  }, [open]);

  function toggleOpen() {
    if (!open) setLastSeen(messages.length);
    setOpen((wasOpen) => !wasOpen);
  }

  function submit() {
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText("");
  }

  return (
    <div className="fixed bottom-4 right-4 z-20 flex flex-col items-end gap-2" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {!open && latest ? `New chat from ${latest.from}: ${latest.text}` : ""}
      </div>
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
          className="flex h-80 w-72 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-brass/25 bg-felt-dark/95 shadow-2xl backdrop-blur"
        >
          <div className="flex items-center justify-between border-b border-brass/15 px-3 py-2">
            <span id={titleId} className="plaque-header text-xs text-brass">Table chat</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="grid h-8 w-8 place-items-center text-cream/80 hover:text-cream"
            >
              ✕
            </button>
          </div>
          <div
            ref={scrollRef}
            tabIndex={0}
            role="log"
            aria-label="Chat messages"
            aria-live="polite"
            className="flex-1 space-y-2 overflow-y-auto px-3 py-2"
          >
            {messages.length === 0 ? (
              <p className="pt-4 text-center text-xs text-cream/75">Say hello</p>
            ) : (
              messages.map((m, i) => (
                <div key={i} className="text-sm">
                  <span className={m.id === selfId ? "text-brass" : "text-cream/85"}>{m.from}: </span>
                  <span className="text-cream">{m.text}</span>
                </div>
              ))
            )}
          </div>
          <div className="flex gap-2 border-t border-brass/15 p-2">
            <label htmlFor={inputId} className="sr-only">Message</label>
            <input
              id={inputId}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="Message…"
              maxLength={300}
              className="min-h-8 min-w-0 flex-1 rounded-full bg-felt/60 px-3 py-1.5 text-sm text-cream placeholder:text-cream/50"
            />
            <button type="button" onClick={submit} className="min-h-8 px-2 text-sm text-brass hover:text-brass-bright">Send</button>
          </div>
        </div>
      )}
      <button
        ref={triggerRef}
        type="button"
        onClick={toggleOpen}
        className="btn-brass relative grid h-12 w-12 place-items-center rounded-full text-lg shadow-lg"
        aria-label={open ? "Close chat" : unread > 0 ? `Open chat, ${unread} unread` : "Open chat"}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span aria-hidden>💬</span>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-ember px-1 text-[10px] text-cream" aria-hidden>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
    </div>
  );
}
