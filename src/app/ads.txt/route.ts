import { ADSENSE_CLIENT, isAdsenseConfigured } from "@/lib/env";

// Serves /ads.txt for AdSense verification, derived from the publisher id.
// AdSense wants: "google.com, pub-XXXX, DIRECT, f08c47fec0942fa0"
// (the client id minus its "ca-" prefix). Returns 404 until configured.
export const dynamic = "force-static";

export function GET() {
  if (!isAdsenseConfigured()) {
    return new Response("Not found", { status: 404 });
  }
  const publisherId = ADSENSE_CLIENT.replace(/^ca-/, "");
  const body = `google.com, ${publisherId}, DIRECT, f08c47fec0942fa0\n`;
  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
