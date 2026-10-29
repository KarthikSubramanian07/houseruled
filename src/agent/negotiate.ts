// RFC 9110 proactive negotiation (Accept) for the two representations we serve
// for pages: HTML for browsers, Markdown for agents (acceptmarkdown.com).

export const HTML = "text/html";
export const MARKDOWN = "text/markdown";
export const MARKDOWN_CONTENT_TYPE = "text/markdown; charset=utf-8";

interface AcceptEntry {
  type: string;
  q: number;
  /** 2 = exact type, 1 = type/*, 0 = *\/* - the most specific match wins. */
  specificity: number;
}

export function parseAccept(header: string): AcceptEntry[] {
  const entries: AcceptEntry[] = [];
  for (const raw of header.split(",")) {
    const [typePart, ...params] = raw.split(";").map((s) => s.trim());
    const type = typePart?.toLowerCase();
    if (!type || !type.includes("/")) continue;
    let q = 1;
    for (const param of params) {
      const [name, value] = param.split("=").map((s) => s.trim());
      if (name?.toLowerCase() === "q") {
        const parsed = Number(value);
        q = Number.isNaN(parsed) ? 1 : Math.max(0, Math.min(1, parsed));
      }
    }
    const specificity = type === "*/*" ? 0 : type.endsWith("/*") ? 1 : 2;
    entries.push({ type, q, specificity });
  }
  return entries;
}

function matches(entry: AcceptEntry, candidate: string): boolean {
  if (entry.type === "*/*") return true;
  if (entry.type.endsWith("/*")) return candidate.startsWith(entry.type.slice(0, -1));
  return entry.type === candidate;
}

/**
 * Best of `produces` for an Accept header, or null if none is acceptable.
 * Missing headers and bare `*\/*` resolve to `produces[0]` (HTML), so browsers
 * and generic clients never notice the Markdown representation exists.
 */
export function preferredType(header: string | null, produces: readonly string[]): string | null {
  const entries = header ? parseAccept(header) : [];
  if (entries.length === 0) return produces[0] ?? null;

  let best: string | null = null;
  let bestQ = 0;
  let bestPos = Infinity;
  for (const candidate of produces) {
    // The most specific matching range decides this candidate's q (RFC 9110 §12.5.1).
    let match: AcceptEntry | null = null;
    let pos = Infinity;
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      if (matches(e, candidate) && (!match || e.specificity > match.specificity)) {
        match = e;
        pos = i;
      }
    }
    const q = match?.q ?? 0;
    // Equal q: the type the client listed first wins; a shared range (e.g. */*)
    // falls back to our `produces` order.
    if (q > bestQ || (q > 0 && q === bestQ && pos < bestPos)) {
      best = candidate;
      bestQ = q;
      bestPos = pos;
    }
  }
  return best;
}

/** True when the client explicitly prefers Markdown over HTML. */
export function wantsMarkdown(header: string | null): boolean {
  return preferredType(header, [HTML, MARKDOWN]) === MARKDOWN;
}

/** Add `Accept` to Vary without clobbering what's there (Next sets its own). */
export function appendVaryAccept(headers: Headers): void {
  const existing = headers.get("vary");
  if (!existing) {
    headers.set("Vary", "Accept");
    return;
  }
  const tokens = existing.split(",").map((s) => s.trim().toLowerCase());
  if (!tokens.includes("accept") && !tokens.includes("*")) headers.set("Vary", `${existing}, Accept`);
}

/** Trailing slash off (except root) so `/about/` and `/about` route the same. */
export function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.slice(0, -1);
  return pathname || "/";
}
