import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Room lobbies are private and ephemeral - never index them.
      disallow: "/room/",
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    // The Host directive expects a bare hostname, not a scheme-prefixed URL.
    host: new URL(SITE_URL).host,
  };
}
