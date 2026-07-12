import type { AuthorizeResult } from "./library";

export function authorizeResponse(result: AuthorizeResult): Response | null {
  switch (result.status) {
    case "ok":
      return null;
    case "invalid_credentials":
      return Response.json({ ok: false, error: "Not authorized." }, { status: 403 });
    case "auth_unavailable":
      return Response.json(
        { ok: false, error: "Authorization is temporarily unavailable. Try again shortly." },
        { status: 503 },
      );
    default: {
      const _exhaustive: never = result;
      return _exhaustive;
    }
  }
}
