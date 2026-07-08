import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/env";

// Only public, indexable pages belong here. Room lobbies (/room/<code>) are
// private, ephemeral, and code-gated - deliberately kept out of the sitemap and
// out of the index (see robots.ts).
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
