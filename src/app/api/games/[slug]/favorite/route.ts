import { getCloudflareContext } from "@opennextjs/cloudflare";
import { toggleFavorite, type LibraryEnv } from "@/lib/library";

export const dynamic = "force-dynamic";

// POST { userId } → { ok, favorited } — toggles this user's favorite for the game.
export async function POST(request: Request, ctx: { params: Promise<{ slug: string }> }): Promise<Response> {
  const { slug } = await ctx.params;
  let body: { userId?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Bad request." }, { status: 400 });
  }
  const userId = typeof body.userId === "string" ? body.userId : "";
  if (!userId) return Response.json({ ok: false, error: "Missing user." }, { status: 400 });
  let env: LibraryEnv = {};
  try {
    env = getCloudflareContext().env as unknown as LibraryEnv;
  } catch {
    /* not in the Cloudflare runtime */
  }
  const result = await toggleFavorite(env, userId, slug);
  return Response.json({ ok: true, ...result });
}
