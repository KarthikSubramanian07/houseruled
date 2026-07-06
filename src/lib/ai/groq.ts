// Phase 3b — plain English → structured rule, via Groq (Llama 3.3 70B). Server
// only (uses the GROQ_API_KEY secret; never runs in the browser). Results are
// cached in KV by normalized text, so a common rule ("twos are wild") hits the
// model once, ever, across all tables.

import { validateAIRule, normalizeText, type AIRule } from "../engine/airules";

// Minimal shapes so this compiles under both the app (DOM) and Worker tsconfigs
// without pulling in @cloudflare/workers-types.
export interface RuleCache {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}
export interface AIEnv {
  GROQ_API_KEY?: string;
  GROQ_MODEL?: string;
  RULE_CACHE?: RuleCache;
}

export type ParseResult = { ok: true; rule: AIRule } | { ok: false; error: string };

const DEFAULT_MODEL = "llama-3.3-70b-versatile";

const SYSTEM_PROMPT = `You translate a plain-English Crazy Eights house rule into a strict JSON object.

Crazy Eights basics: players match the top card's suit or rank, or play a wild 8. You are ONLY adding an effect that triggers when a specific card is played.

Card ranks are numbers: Ace=1, 2..10 as-is, Jack=11, Queen=12, King=13. Suits: "S" (spades), "H" (hearts), "D" (diamonds), "C" (clubs).

Output EXACTLY one JSON object, no prose. Two shapes:

1) A supported rule:
{
  "trigger": "card_played",
  "match": { "rank": <1-13, optional>, "suit": <"S"|"H"|"D"|"C", optional> },
  "effects": [ <one or more effects> ],
  "duration": "permanent"   // or { "rounds": <N> } for a temporary rule
}
At least one of match.rank / match.suit is required.
Allowed effects:
  { "kind": "skip", "n": <1-3> }         // skip the next n players
  { "kind": "reverse" }                   // reverse play direction
  { "kind": "draw", "n": <1-8> }          // the NEXT player draws n cards
  { "kind": "wild" }                      // the played card is wild; player picks a suit
  { "kind": "play_again" }                // the player takes another turn

2) If the rule can't be expressed as a card_played effect from the list above
   (e.g. it needs real-world actions, scoring, or a trigger we don't support):
{ "unsupported": true, "reason": "<short reason>" }

Examples:
"twos are wild" -> {"trigger":"card_played","match":{"rank":2},"effects":[{"kind":"wild"}],"duration":"permanent"}
"playing a 2 makes the next player draw two" -> {"trigger":"card_played","match":{"rank":2},"effects":[{"kind":"draw","n":2}],"duration":"permanent"}
"queens reverse direction" -> {"trigger":"card_played","match":{"rank":12},"effects":[{"kind":"reverse"}],"duration":"permanent"}
"a jack skips the next player" -> {"trigger":"card_played","match":{"rank":11},"effects":[{"kind":"skip","n":1}],"duration":"permanent"}
"playing a 10 lets you go again" -> {"trigger":"card_played","match":{"rank":10},"effects":[{"kind":"play_again"}],"duration":"permanent"}
"spades reverse for the next 3 rounds" -> {"trigger":"card_played","match":{"suit":"S"},"effects":[{"kind":"reverse"}],"duration":{"rounds":3}}
"the loser buys everyone a drink" -> {"unsupported":true,"reason":"needs a real-world action"}`;

/** Call Groq once (no cache) and validate the result. */
export async function parseRuleText(text: string, game: string, env: AIEnv): Promise<ParseResult> {
  if (!env.GROQ_API_KEY) return { ok: false, error: "AI rules aren't configured on this server." };
  const clean = text.trim();
  if (clean.length < 2) return { ok: false, error: "Type a rule first." };
  if (clean.length > 200) return { ok: false, error: "Keep the rule under 200 characters." };

  let res: Response;
  try {
    res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.GROQ_MODEL || DEFAULT_MODEL,
        temperature: 0.1,
        max_tokens: 300,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: clean },
        ],
      }),
    });
  } catch {
    return { ok: false, error: "Couldn't reach the rules engine — try again." };
  }

  if (!res.ok) return { ok: false, error: `Rules engine error (${res.status}).` };

  let parsed: unknown;
  try {
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content ?? "";
    parsed = JSON.parse(content);
  } catch {
    return { ok: false, error: "Couldn't understand that rule." };
  }

  if (parsed && typeof parsed === "object" && (parsed as { unsupported?: boolean }).unsupported) {
    const reason = (parsed as { reason?: string }).reason ?? "that kind of rule isn't supported yet";
    return { ok: false, error: `Can't apply that rule: ${reason}.` };
  }

  const rule = validateAIRule(parsed, clean, game);
  if (!rule) return { ok: false, error: "That rule didn't map to something the game can do." };
  return { ok: true, rule };
}

/** Cache-first parse: hash(normalized text + game) → KV, else Groq, then store. */
export async function parseWithCache(text: string, game: string, env: AIEnv): Promise<ParseResult> {
  const cacheKey = `rule:${game}:${normalizeText(text)}`;
  if (env.RULE_CACHE) {
    try {
      const hit = await env.RULE_CACHE.get(cacheKey);
      if (hit) return { ok: true, rule: JSON.parse(hit) as AIRule };
    } catch {
      /* cache miss/error → fall through to Groq */
    }
  }
  const result = await parseRuleText(text, game, env);
  if (result.ok && env.RULE_CACHE) {
    try {
      // Cache successful parses for 30 days; the id is recomputed per raw text anyway.
      await env.RULE_CACHE.put(cacheKey, JSON.stringify(result.rule), { expirationTtl: 60 * 60 * 24 * 30 });
    } catch {
      /* non-fatal */
    }
  }
  return result;
}
