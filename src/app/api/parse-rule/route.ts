import { getCloudflareContext } from "@opennextjs/cloudflare";
import { parseWithCache, type AIEnv } from "@/lib/ai/groq";

// POST { text, game } → { ok, rule } | { ok:false, error }. Server-side only; the
// Groq key stays on the Worker. Used by the pre-game setup to parse free-text
// house rules (live in-game parsing goes through the Durable Object).
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  let body: { text?: unknown; game?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Bad request." }, { status: 400 });
  }
  const text = typeof body.text === "string" ? body.text : "";
  const game = typeof body.game === "string" ? body.game : "crazyeights";

  let env: AIEnv = {};
  try {
    env = getCloudflareContext().env as unknown as AIEnv;
  } catch {
    /* not in the Cloudflare runtime (e.g. next dev) */
  }

  const result = await parseWithCache(text, game, env);
  return Response.json(result);
}
