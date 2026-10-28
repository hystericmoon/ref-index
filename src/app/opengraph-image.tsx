import { ImageResponse } from "next/og";

export const alt = "Ref Index: design gallery picks and one search box for 21 galleries";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const GALLERIES = ["Land-book", "Godly", "SiteInspire", "Minimal Gallery", "Httpster", "Awwwards", "One Page Love"];

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "#111613",
          color: "#e8ece9",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 28, color: "#4fc7a5", letterSpacing: 2, textTransform: "uppercase" }}>
          Design reference index
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 120, fontWeight: 700, letterSpacing: -4, lineHeight: 1 }}>Ref Index</div>
          <div style={{ fontSize: 40, color: "#9ba7a0", maxWidth: 900, lineHeight: 1.3 }}>
            414 sites and apps picked by 13 design galleries, and one search box for 21 galleries.
          </div>
        </div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          {GALLERIES.map((g) => (
            <div
              key={g}
              style={{ display: "flex", fontSize: 24, padding: "8px 18px", borderRadius: 999, border: "2px solid #2a332e", color: "#e8ece9" }}
            >
              {g}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
