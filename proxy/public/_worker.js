// playhouseruled.pages.dev front door (Cloudflare Pages, advanced mode).
//
// The app itself is the `houseruled` Worker: Next.js via OpenNext plus the
// RoomDO Durable Objects, which Pages can't host. This Pages project only
// gives it the clean playhouseruled.pages.dev hostname: every request,
// WebSocket upgrades included, is handed to the Worker over a service binding
// with its URL untouched, so the app sees playhouseruled.pages.dev as its host.

const proxy = {
  async fetch(request, env) {
    if (!env.APP) {
      return new Response("Houseruled is briefly unavailable (service binding missing).\n", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8", "Retry-After": "30" },
      });
    }
    return env.APP.fetch(request);
  },
};

export default proxy;
