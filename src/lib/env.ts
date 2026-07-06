// Public runtime config. NEXT_PUBLIC_* vars are inlined at build time.

// ── Backend availability ──────────────────────────────────────────────────────
// The room API + WebSockets are served by the Cloudflare Worker + RoomDO Durable
// Object, which only exist in a production build (the deployed Worker, or local
// `wrangler dev` / `opennextjs-cloudflare preview`). Plain `next dev` has no
// Worker, so we fall back to a local single-seat "table demo" and the felt still
// comes up. This build-time flag is the switch.
export const HAS_REMOTE_BACKEND = process.env.NODE_ENV === "production";

// ── Canonical site origin (SEO: canonical URLs, sitemap, OG tags) ─────────────
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://houseruled.karthik-e5e.workers.dev"
).replace(/\/$/, "");

// ── Support the project ───────────────────────────────────────────────────────
export const DONATE_URL =
  process.env.NEXT_PUBLIC_DONATE_URL ?? "https://buymeacoffee.com/winnerkarthik";

// ── Google AdSense ────────────────────────────────────────────────────────────
// Gated on env so nothing renders (no script, no empty boxes) until configured.
export const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? "";
export const ADSENSE_SLOT = process.env.NEXT_PUBLIC_ADSENSE_SLOT ?? "";

// Publisher configured → load the library + serve /ads.txt.
export function isAdsenseConfigured(): boolean {
  return ADSENSE_CLIENT.startsWith("ca-pub-");
}

// The ad unit itself needs BOTH a publisher and a slot id, or it fires a broken
// request with an empty slot. Gate the <ins> on this, not just the publisher.
export function isAdSlotConfigured(): boolean {
  return isAdsenseConfigured() && ADSENSE_SLOT.length > 0;
}
