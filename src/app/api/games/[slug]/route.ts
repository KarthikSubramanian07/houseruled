import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getCustomGame, bumpPlays, type LibraryEnv } from "@/lib/library";

export const dynamic = "force-dynamic";

function env(): LibraryEnv {
  try {
    return getCloudflareContext().env as unknown as LibraryEnv;
  } catch {
    return {};
  }
}

// GET → a single saved game by slug (404 if missing).
export async function GET(_request: Request, ctx: { params: Promise<{ slug: string }> }): Promise<Response> {
  const { slug } = await ctx.params;
  const game = await getCustomGame(env(), slug);
  if (!game) return Response.json({ ok: false, error: "not_found" }, { status: 404 });
  return Response.json({ ok: true, game });
}

// POST → record a play (bumps the most-played counter).
export async function POST(_request: Request, ctx: { params: Promise<{ slug: string }> }): Promise<Response> {
  const { slug } = await ctx.params;
  await bumpPlays(env(), slug);
  return Response.json({ ok: true });
}
