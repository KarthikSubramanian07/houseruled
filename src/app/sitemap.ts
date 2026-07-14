import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/env";

// Only public, indexable pages belong here. Room lobbies (/room/<code>) are
// private, ephemeral, and code-gated - deliberately kept out of the sitemap and
// out of the index (see robots.ts).
const PUBLIC_PATHS: { path: string; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]; priority: number }[] = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/games", changeFrequency: "daily", priority: 0.8 },
  { path: "/invent", changeFrequency: "weekly", priority: 0.7 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PATHS.map(({ path, changeFrequency, priority }) => ({
    url: `${SITE_URL}${path === "/" ? "" : path}`,
    changeFrequency,
    priority,
  }));
}
