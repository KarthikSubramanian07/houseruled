import { ImageResponse } from "next/og";

// Social share image (1200×630). Built purely from boxes/gradients so it needs
// no embedded font - the build can never fail fetching one. The title/tagline
// ride the OG <meta> text tags; this is the brand mark on felt.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Houseruled - your rules, your game, any deck";

const BRASS = "#C9A24B";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "radial-gradient(120% 100% at 50% 25%, #155038 0%, #0F3D2E 45%, #0A2A1F 100%)",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 40,
            borderRadius: 32,
            border: `3px solid ${BRASS}`,
            opacity: 0.35,
            display: "flex",
          }}
        />
        {/* Monogram H */}
        <div style={{ position: "relative", display: "flex", width: 280, height: 340 }}>
          <div style={{ position: "absolute", left: 0, top: 0, width: 72, height: 340, borderRadius: 14, background: BRASS }} />
          <div style={{ position: "absolute", right: 0, top: 0, width: 72, height: 340, borderRadius: 14, background: BRASS }} />
          <div style={{ position: "absolute", left: 0, top: 134, width: 280, height: 72, borderRadius: 14, background: BRASS }} />
          <div style={{ position: "absolute", left: 0, bottom: -34, width: 280, height: 14, borderRadius: 7, background: BRASS, opacity: 0.8 }} />
        </div>
      </div>
    ),
    { ...size },
  );
}
