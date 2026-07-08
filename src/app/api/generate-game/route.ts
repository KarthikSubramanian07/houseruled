import { getCloudflareContext } from "@opennextjs/cloudflare";
import { generateGame } from "@/lib/ai/gamegen";
import type { AIEnv } from "@/lib/ai/groq";
import { rateLimit, clientIp, tooMany } from "@/lib/ratelimit";

// POST { description } → { ok, game } | { ok:false, error }. Invents a custom game
// (base + house rules + name + explanation) via Groq. Server-side only.
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  let body: { description?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Bad request." }, { status: 400 });
  }
  const description = typeof body.description === "string" ? body.description : "";
  let env: AIEnv = {};
  try {
    env = getCloudflareContext().env as unknown as AIEnv;
  } catch {
    /* not in the Cloudflare runtime */
  }
  // This endpoint is uncached and spends Groq tokens per call - throttle hard
  // per IP, plus a global daily ceiling to cap the bill against IP rotation.
  const rl = await rateLimit(env.RULE_CACHE, "gen", clientIp(request), 8, 60, 500);
  if (!rl.ok) return tooMany(rl.retryAfter);
  return Response.json(await generateGame(description, env));
}
