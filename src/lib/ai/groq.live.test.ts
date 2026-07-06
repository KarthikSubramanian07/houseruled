// Live prompt-quality suite (Phase 3b). Hits the real Groq API, so it only runs
// when GROQ_API_KEY is set:  GROQ_API_KEY=... npx vitest run src/lib/ai/groq.live.test.ts
// Treat prompt edits like code: this must stay green before shipping them.

import { describe, it, expect } from "vitest";
import { parseRuleText, type AIEnv } from "./groq";

const KEY = process.env.GROQ_API_KEY;
const env: AIEnv = { GROQ_API_KEY: KEY };

interface Case {
  text: string;
  rank?: number;
  suit?: string;
  kinds?: string[]; // effect kinds that must be present
  unsupported?: boolean;
}

const CASES: Case[] = [
  { text: "twos are wild", rank: 2, kinds: ["wild"] },
  { text: "eights are wild", rank: 8, kinds: ["wild"] },
  { text: "playing a 2 makes the next player draw two", rank: 2, kinds: ["draw"] },
  { text: "twos draw two", rank: 2, kinds: ["draw"] },
  { text: "queens reverse the direction of play", rank: 12, kinds: ["reverse"] },
  { text: "a queen reverses", rank: 12, kinds: ["reverse"] },
  { text: "jacks skip the next player", rank: 11, kinds: ["skip"] },
  { text: "playing a jack skips the next person", rank: 11, kinds: ["skip"] },
  { text: "aces reverse direction", rank: 1, kinds: ["reverse"] },
  { text: "kings skip", rank: 13, kinds: ["skip"] },
  { text: "playing a 10 lets you go again", rank: 10, kinds: ["play_again"] },
  { text: "if you play a 7 you take another turn", rank: 7, kinds: ["play_again"] },
  { text: "fours make the next player draw four", rank: 4, kinds: ["draw"] },
  { text: "nines skip two players", rank: 9, kinds: ["skip"] },
  { text: "threes are wild", rank: 3, kinds: ["wild"] },
  { text: "spades reverse the direction", suit: "S", kinds: ["reverse"] },
  { text: "playing a heart makes the next player draw one", suit: "H", kinds: ["draw"] },
  { text: "clubs skip the next player", suit: "C", kinds: ["skip"] },
  { text: "any diamond is wild", suit: "D", kinds: ["wild"] },
  { text: "sixes reverse direction for the next 3 rounds", rank: 6, kinds: ["reverse"] },
  { text: "fives make everyone after you draw 2", rank: 5, kinds: ["draw"] },
  { text: "a king lets the player go again", rank: 13, kinds: ["play_again"] },
  { text: "the loser buys everyone a round of drinks", unsupported: true },
  { text: "oldest player goes first", unsupported: true },
  { text: "the winner picks the music", unsupported: true },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Throttle + retry to stay under Groq's free-tier rate limit (bursting 429s).
async function parseThrottled(text: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await parseRuleText(text, "crazyeights", env);
    if (r.ok || !r.error.includes("429")) return r;
    await sleep(6000);
  }
  return parseRuleText(text, "crazyeights", env);
}

describe.skipIf(!KEY)("groq rule parser (live)", () => {
  it(
    "parses the rule suite with high accuracy",
    async () => {
      let pass = 0;
      const failures: string[] = [];
      for (const c of CASES) {
        await sleep(2200); // spacing to respect the rate limit
        const r = await parseThrottled(c.text);
        if (c.unsupported) {
          if (!r.ok) pass++;
          else failures.push(`"${c.text}" → expected unsupported, got a rule`);
          continue;
        }
        if (!r.ok) {
          failures.push(`"${c.text}" → error: ${r.error}`);
          continue;
        }
        const okRank = c.rank === undefined || r.rule.match.rank === c.rank;
        const okSuit = c.suit === undefined || r.rule.match.suit === c.suit;
        const kinds: string[] = r.rule.effects.map((e) => e.kind);
        const okKinds = (c.kinds ?? []).every((k) => kinds.includes(k));
        if (okRank && okSuit && okKinds) pass++;
        else failures.push(`"${c.text}" → ${JSON.stringify(r.rule.match)} ${JSON.stringify(kinds)}`);
      }
      const rate = pass / CASES.length;
      console.log(`\nRule suite: ${pass}/${CASES.length} (${Math.round(rate * 100)}%)`);
      if (failures.length) console.log("Misses:\n  " + failures.join("\n  "));
      expect(rate).toBeGreaterThanOrEqual(0.9); // ≥90% on the suite
    },
    300_000,
  );
});
