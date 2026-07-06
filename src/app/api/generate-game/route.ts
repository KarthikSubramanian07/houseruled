import { getCloudflareContext } from "@opennextjs/cloudflare";
import { generateGame } from "@/lib/ai/gamegen";
import type { AIEnv } from "@/lib/ai/groq";

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
  return Response.json(await generateGame(description, env));
}
