import { ImageResponse } from "next/og";

// ─────────────────────────────────────────────────────────────────
// Dynamic OG image generator. Next.js renders this server-side and
// serves a 1200×630 PNG at /opengraph-image. Used by:
//   - LinkedIn / X / iMessage / Slack / Discord link previews
//   - Google's "About this result" panel
//   - Schema.org image fields referenced in layout.tsx
// ─────────────────────────────────────────────────────────────────

export const runtime = "edge";
export const alt = "Reverb — Enterprise Marketing Intelligence";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "space-between",
          backgroundColor: "#faf8f5",
          backgroundImage:
            "radial-gradient(circle at 18% 8%, rgba(216, 89, 58, 0.18) 0%, transparent 45%), radial-gradient(circle at 88% 78%, rgba(139, 92, 246, 0.12) 0%, transparent 50%)",
          padding: "70px 80px",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        {/* Top — brand row */}
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 76,
              height: 76,
              borderRadius: 22,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background:
                "linear-gradient(135deg, #d8593a 0%, #b03e21 100%)",
              boxShadow: "0 8px 22px rgba(193, 74, 42, 0.25)",
              fontSize: 46,
              fontWeight: 800,
              color: "white",
              letterSpacing: -2,
            }}
          >
            d
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                fontSize: 32,
                fontWeight: 700,
                color: "#1f1b16",
                letterSpacing: -1,
              }}
            >
              Reverb
            </div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: "#c14a2a",
                letterSpacing: 2.5,
                textTransform: "uppercase",
                marginTop: 4,
              }}
            >
              Marketing Intelligence · Live
            </div>
          </div>
        </div>

        {/* Middle — headline */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            maxWidth: 1040,
          }}
        >
          <div
            style={{
              fontSize: 72,
              fontWeight: 700,
              color: "#1f1b16",
              lineHeight: 1.05,
              letterSpacing: -2,
            }}
          >
            Marketing intelligence,
          </div>
          <div
            style={{
              fontSize: 72,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: -2,
              background:
                "linear-gradient(135deg, #d8593a 0%, #b03e21 100%)",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            fine-tuned for your brand.
          </div>
          <div
            style={{
              fontSize: 26,
              fontWeight: 400,
              color: "#5b524a",
              lineHeight: 1.4,
              marginTop: 24,
            }}
          >
            Brand Agent · Live site scraping · File analysis · Multi-format export
          </div>
        </div>

        {/* Bottom — feature pills */}
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {[
            "130+ topics × 13 asset types",
            "scraped every 6h",
            "4 specialized models",
            "free tier · no card",
          ].map((label, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 18px",
                borderRadius: 999,
                background: "rgba(255, 255, 255, 0.85)",
                border: "1px solid rgba(193, 74, 42, 0.15)",
                fontSize: 17,
                fontWeight: 600,
                color: "#3a332b",
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: "#10b981",
                }}
              />
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
