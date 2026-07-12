import { getCloudflareContext } from "@opennextjs/cloudflare";
import { upsertProfile, authorizeWrite, type LibraryEnv } from "@/lib/library";
import { authorizeResponse } from "@/lib/auth";

export const dynamic = "force-dynamic";

// POST { id, name, secret } → { ok } - upsert this player's public profile name.
export async function POST(request: Request): Promise<Response> {
  let body: { id?: unknown; name?: unknown; secret?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Bad request." }, { status: 400 });
  }
  const id = typeof body.id === "string" ? body.id : "";
  const name = typeof body.name === "string" ? body.name : "";
  const secret = typeof body.secret === "string" ? body.secret : "";
  if (!id || !name) return Response.json({ ok: false, error: "Missing id or name." }, { status: 400 });
  let env: LibraryEnv = {};
  try {
    env = getCloudflareContext().env as unknown as LibraryEnv;
  } catch {
    /* not in the Cloudflare runtime */
  }
  const denied = authorizeResponse(await authorizeWrite(env, id, secret));
  if (denied) return denied;
  await upsertProfile(env, id, name);
  return Response.json({ ok: true });
}
