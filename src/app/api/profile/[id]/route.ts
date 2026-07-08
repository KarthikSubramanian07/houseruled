import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getProfile, type LibraryEnv } from "@/lib/library";

export const dynamic = "force-dynamic";

// GET /api/profile/<id> → { ok, profile } - a public profile (name, created games,
// favorites, stats). 404 if the id has no footprint yet.
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await ctx.params;
  let env: LibraryEnv = {};
  try {
    env = getCloudflareContext().env as unknown as LibraryEnv;
  } catch {
    /* not in the Cloudflare runtime */
  }
  const profile = await getProfile(env, id);
  if (!profile) return Response.json({ ok: false, error: "not_found" }, { status: 404 });
  return Response.json({ ok: true, profile });
}
