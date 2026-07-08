// Phase 4 - invent a game from a sentence. The model designs a custom game as a
// variant of one of the five base games plus a set of plain-English house rules
// (which then flow through the Phase 3 parser). Server only.

import type { AIEnv } from "./groq";

export interface GeneratedGame {
  name: string;
  baseGame: string; // one of the five engine games
  ruleTexts: string[]; // plain-English rules (only crazyeights executes these today)
  explanation: string;
}
export type GenResult = { ok: true; game: GeneratedGame } | { ok: false; error: string };

const BASE_GAMES = ["war", "gofish", "oldmaid", "crazyeights", "blackjack"];
const DEFAULT_MODEL = "llama-3.3-70b-versatile";

const SYSTEM_PROMPT = `You are a card-game designer. Turn a short description into a custom game built on ONE of these base games:
- "war": highest card wins, ties mean war (2 players)
- "gofish": ask for ranks, collect books of four
- "oldmaid": discard pairs, don't hold the odd Queen
- "crazyeights": match suit/rank or play a wild 8; first to empty their hand wins
- "blackjack": beat the dealer to 21

Only "crazyeights" can take custom house rules. Those rules must be expressible as card-played effects: a card of some rank/suit causes skip / reverse / draw N / becomes wild / play again. For any other base game, "ruleTexts" MUST be an empty array.

Pick the base game that best fits the description, then (for crazyeights) write 1–6 short plain-English house rules that shape it.

Output EXACTLY one JSON object:
{ "name": "<short catchy name>", "baseGame": "<one of the five>", "ruleTexts": ["twos are wild", "queens reverse direction"], "explanation": "<1-2 sentences a player can read before starting>" }

If it can't be built from these, output: { "unsupported": true, "reason": "<short reason>" }

Examples:
"get rid of all your cards, but eights let you change the suit" -> {"name":"Wild Eights","baseGame":"crazyeights","ruleTexts":["eights are wild"],"explanation":"Standard Crazy Eights - empty your hand first; eights are wild and change the suit."}
"a fast game where twos attack and queens turn the tables" -> {"name":"Counterclockwise","baseGame":"crazyeights","ruleTexts":["twos make the next player draw two","queens reverse direction"],"explanation":"Crazy Eights with bite: a 2 stings the next player, a queen flips the direction."}
"closest to twenty-one wins" -> {"name":"House 21","baseGame":"blackjack","ruleTexts":[],"explanation":"Classic Blackjack against the dealer - get close to 21 without busting."}`;

export async function generateGame(description: string, env: AIEnv): Promise<GenResult> {
  if (!env.GROQ_API_KEY) return { ok: false, error: "AI isn't configured on this server." };
  const desc = description.trim();
  if (desc.length < 4) return { ok: false, error: "Describe the game you want." };
  if (desc.length > 400) return { ok: false, error: "Keep the description under 400 characters." };

  let res: Response;
  try {
    res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${env.GROQ_API_KEY}` },
      body: JSON.stringify({
        model: env.GROQ_MODEL || DEFAULT_MODEL,
        temperature: 0.4,
        max_tokens: 500,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: desc },
        ],
      }),
    });
  } catch {
    return { ok: false, error: "Couldn't reach the game designer - try again." };
  }
  if (!res.ok) return { ok: false, error: `Game designer error (${res.status}).` };

  let parsed: Record<string, unknown>;
  try {
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "");
  } catch {
    return { ok: false, error: "Couldn't design that game." };
  }

  if (parsed.unsupported) {
    return { ok: false, error: `Can't build that: ${String(parsed.reason ?? "not supported yet")}.` };
  }

  const baseGame = String(parsed.baseGame ?? "");
  if (!BASE_GAMES.includes(baseGame)) return { ok: false, error: "The designer picked an unknown base game." };

  const name = String(parsed.name ?? "Custom Game").slice(0, 40);
  const explanation = String(parsed.explanation ?? "").slice(0, 300);
  // Only Crazy Eights executes free-text rules today; strip them for other bases.
  let ruleTexts: string[] = [];
  if (baseGame === "crazyeights" && Array.isArray(parsed.ruleTexts)) {
    ruleTexts = (parsed.ruleTexts as unknown[])
      .filter((r): r is string => typeof r === "string" && r.trim().length > 0)
      .map((r) => r.trim().slice(0, 200))
      .slice(0, 6);
  }

  return { ok: true, game: { name, baseGame, ruleTexts, explanation } };
}
