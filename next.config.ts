import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The felt is CSS, not bitmaps — skipping the image optimizer keeps us off any
  // paid Cloudflare Images path and off the IMAGES binding. Revisit if we ship art.
  images: { unoptimized: true },
  // Pin the workspace root to this project — there's an unrelated lockfile higher
  // up the tree ($HOME), and without this Next infers the wrong root.
  turbopack: { root: import.meta.dirname },
};

export default nextConfig;

// Lets `next dev` talk to the Cloudflare bindings defined in wrangler.jsonc.
// Safe to call unconditionally; it no-ops outside the OpenNext dev context.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
