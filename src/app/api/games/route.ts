import { getCloudflareContext } from "@opennextjs/cloudflare";
import { saveCustomGame, listCustomGames, type LibraryEnv } from "@/lib/library";

export const dynamic = "force-dynamic";

function env(): LibraryEnv {
  try {
    return getCloudflareContext().env as unknown as LibraryEnv;
  } catch {
    return {};
  }
}

// GET → the community library (public games, most-played first).
export async function GET(): Promise<Response> {
  return Response.json({ games: await listCustomGames(env()) });
}

// POST { name, baseGame, ruleTexts, explanation, creatorId? } → { ok, slug }.
export async function POST(request: Request): Promise<Response> {
  let body: {
    name?: unknown;
    baseGame?: unknown;
    ruleTexts?: unknown;
    explanation?: unknown;
    creatorId?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Bad request." }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name : "";
  const baseGame = typeof body.baseGame === "string" ? body.baseGame : "";
  const explanation = typeof body.explanation === "string" ? body.explanation : "";
  const ruleTexts = Array.isArray(body.ruleTexts)
    ? (body.ruleTexts as unknown[]).filter((r): r is string => typeof r === "string")
    : [];
  const creatorId = typeof body.creatorId === "string" ? body.creatorId : undefined;
  if (!name || !baseGame) return Response.json({ ok: false, error: "Missing name or base game." }, { status: 400 });
  return Response.json(await saveCustomGame(env(), { name, baseGame, ruleTexts, explanation, creatorId }));
}
