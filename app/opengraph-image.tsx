import { ImageResponse } from "next/og";

export const alt = "Unit 20 — DJ practice studio, gear hire & venue in Christchurch";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background:
            "radial-gradient(60% 80% at 18% 95%, rgba(61,220,151,0.22), transparent 60%), #0a0a0a",
          padding: "76px",
          color: "#f5f1ea",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 18, height: 18, background: "#3ddc97" }} />
          <div style={{ fontSize: 26, letterSpacing: 8, textTransform: "uppercase" }}>
            Unit 20
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 88, lineHeight: 1.0, fontWeight: 700, letterSpacing: -3 }}>
            Studio · Hire · Venue
          </div>
          <div style={{ fontSize: 30, color: "#8a8580", letterSpacing: -0.5 }}>
            Practice on real club gear. Christchurch, Aotearoa.
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
