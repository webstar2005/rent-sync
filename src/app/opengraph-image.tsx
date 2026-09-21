import { ImageResponse } from "next/og";

// Route segment config
export const runtime = "edge";
export const alt = "Rent Sync — Run Your Rental Portfolio Without the Spreadsheet Chaos";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "56px",
          background: "#FFFFFF",
          fontFamily: "sans-serif",
        }}
      >
        {/* Top bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: "#7A1428",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#FFFFFF",
              fontSize: 16,
              fontWeight: 800,
              letterSpacing: 1,
            }}
          >
            RS
          </div>
          <span style={{ fontSize: 22, fontWeight: 800, color: "#0D0D0D", letterSpacing: -0.5 }}>
            Rent Sync
          </span>
          <span style={{ marginLeft: 12, fontSize: 13, color: "#6B6B6B" }}>
            for landlords &amp; property managers
          </span>
        </div>

        {/* Center */}
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 860 }}>
          <h1
            style={{
              fontSize: 56,
              lineHeight: 1.05,
              fontWeight: 800,
              color: "#0D0D0D",
              letterSpacing: -1.2,
              margin: 0,
            }}
          >
            Run Your Rental Portfolio
            <br />
            <span style={{ color: "#7A1428" }}>Without the Spreadsheet Chaos</span>
          </h1>
          <p style={{ marginTop: 18, fontSize: 20, lineHeight: 1.5, color: "#6B6B6B", maxWidth: 680 }}>
            Track rent, tenants, and payments — all in one place.
          </p>
        </div>

        {/* Bottom */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 14, color: "#6B6B6B" }}>rentsync.co.ke · Start Free</span>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ width: 80, height: 8, borderRadius: 999, background: "#7A1428" }} />
            <div style={{ width: 80, height: 8, borderRadius: 999, background: "#F7E9EB" }} />
            <div style={{ width: 80, height: 8, borderRadius: 999, background: "#F5F5F5" }} />
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
