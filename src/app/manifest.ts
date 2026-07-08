import type { MetadataRoute } from "next";

// Web App Manifest - makes Houseruled installable to an iOS/Android home screen
// as a standalone, full-screen app (no browser chrome). This is the free,
// zero-store-fee path to "an app"; a native Capacitor shell can wrap the same
// build later (see README → Native apps).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Houseruled",
    short_name: "Houseruled",
    description: "Your rules. Your game. Any deck.",
    id: "/",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0F3D2E",
    theme_color: "#0F3D2E",
    categories: ["games", "entertainment"],
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
