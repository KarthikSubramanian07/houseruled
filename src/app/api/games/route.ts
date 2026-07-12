import { getCloudflareContext } from "@opennextjs/cloudflare";
import { saveCustomGame, listCustomGames, favoriteSlugs, authorizeWrite, type LibraryEnv } from "@/lib/library";
import { authorizeResponse } from "@/lib/auth";

export const dynamic = "force-dynamic";

function env(): LibraryEnv {
  try {
    return getCloudflareContext().env as unknown as LibraryEnv;
  } catch {
    return {};
  }
}

// GET /api/games?search=&base=&sort=plays|new&user=<id>
//   → { games, favorites } (favorites = this user's favorited slugs, for hearts)
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const e = env();
  const games = await listCustomGames(e, {
    search: url.searchParams.get("search") ?? undefined,
    base: url.searchParams.get("base") ?? undefined,
    sort: (url.searchParams.get("sort") as "plays" | "new" | null) ?? undefined,
  });
  const user = url.searchParams.get("user");
  const favorites = user ? await favoriteSlugs(e, user) : [];
  return Response.json({ games, favorites });
}

// POST { name, baseGame, ruleTexts, explanation, creatorId?, creatorName? } → { ok, slug }
export async function POST(request: Request): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Bad request." }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name : "";
  const baseGame = typeof body.baseGame === "string" ? body.baseGame : "";
  const explanation = typeof body.explanation === "string" ? body.explanation : "";
  const ruleTexts = Array.isArray(body.ruleTexts) ? (body.ruleTexts as unknown[]).filter((r): r is string => typeof r === "string") : [];
  const creatorId = typeof body.creatorId === "string" ? body.creatorId : undefined;
  const creatorName = typeof body.creatorName === "string" ? body.creatorName : undefined;
  const secret = typeof body.secret === "string" ? body.secret : "";
  if (!name || !baseGame) return Response.json({ ok: false, error: "Missing name or base game." }, { status: 400 });
  const e = env();
  // If the game claims a creator, the caller must own that id.
  if (creatorId) {
    const denied = authorizeResponse(await authorizeWrite(e, creatorId, secret));
    if (denied) return denied;
  }
  return Response.json(await saveCustomGame(e, { name, baseGame, ruleTexts, explanation, creatorId, creatorName }));
}
