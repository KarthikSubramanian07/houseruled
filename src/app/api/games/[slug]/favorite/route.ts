import { getCloudflareContext } from "@opennextjs/cloudflare";
import { toggleFavorite, authorizeWrite, type LibraryEnv } from "@/lib/library";

export const dynamic = "force-dynamic";

// POST { userId, secret } → { ok, favorited } — toggles this user's favorite.
export async function POST(request: Request, ctx: { params: Promise<{ slug: string }> }): Promise<Response> {
  const { slug } = await ctx.params;
  let body: { userId?: unknown; secret?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Bad request." }, { status: 400 });
  }
  const userId = typeof body.userId === "string" ? body.userId : "";
  const secret = typeof body.secret === "string" ? body.secret : "";
  if (!userId) return Response.json({ ok: false, error: "Missing user." }, { status: 400 });
  let env: LibraryEnv = {};
  try {
    env = getCloudflareContext().env as unknown as LibraryEnv;
  } catch {
    /* not in the Cloudflare runtime */
  }
  if (!(await authorizeWrite(env, userId, secret))) return Response.json({ ok: false, error: "Not authorized." }, { status: 403 });
  const result = await toggleFavorite(env, userId, slug);
  return Response.json({ ok: true, ...result });
}
