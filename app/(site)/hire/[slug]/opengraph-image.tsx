import { ImageResponse } from "next/og";
import { getHireService } from "@/lib/hire";

export const alt = "Unit 20 — Gear hire in Christchurch";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function HireOgImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const service = getHireService(slug);
  const title = service?.title ?? "Gear hire";
  const lede = service?.lede ?? "Audio and lighting hire in Christchurch.";
  const fromLabel = service?.fromLabel ?? "";

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
            Unit 20 · Hire
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              fontSize: 84,
              lineHeight: 1.0,
              fontWeight: 700,
              letterSpacing: -3,
              maxWidth: 980,
            }}
          >
            {title}
          </div>
          <div style={{ fontSize: 28, color: "#8a8580", letterSpacing: -0.5, maxWidth: 900 }}>
            {lede}
          </div>
          {fromLabel ? (
            <div
              style={{
                fontSize: 22,
                color: "#3ddc97",
                letterSpacing: 4,
                textTransform: "uppercase",
                marginTop: 8,
              }}
            >
              {fromLabel}
            </div>
          ) : null}
        </div>
      </div>
    ),
    { ...size },
  );
}
