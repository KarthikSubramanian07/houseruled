import { ImageResponse } from "next/og";

// iOS home-screen icon, generated at build time (no static PNG to maintain).
// Built from boxes rather than text so Satori needs no embedded font.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const BRASS = "#C9A24B";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0F3D2E",
        }}
      >
        {/* Monogram H */}
        <div style={{ position: "relative", display: "flex", width: 84, height: 104 }}>
          <div style={{ position: "absolute", left: 0, top: 0, width: 22, height: 104, borderRadius: 5, background: BRASS }} />
          <div style={{ position: "absolute", right: 0, top: 0, width: 22, height: 104, borderRadius: 5, background: BRASS }} />
          <div style={{ position: "absolute", left: 0, top: 41, width: 84, height: 22, borderRadius: 5, background: BRASS }} />
        </div>
      </div>
    ),
    { ...size },
  );
}
