import { ImageResponse } from "next/og";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/brand";

export const alt = `${SITE_NAME}: ${SITE_TAGLINE}`;
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
          background: "#141414",
          color: "#f2f2f2",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 28, color: "#4d8dff", letterSpacing: 2, textTransform: "uppercase" }}>
          Free design references
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 120, fontWeight: 700, letterSpacing: -4, lineHeight: 1 }}>{SITE_NAME}</div>
          <div style={{ fontSize: 40, color: "#a3a3a3", maxWidth: 900, lineHeight: 1.3 }}>
            {`${SITE_TAGLINE} Thousands of sites picked by 13 design galleries, curated, no paywall.`}
          </div>
        </div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          {GALLERIES.map((g) => (
            <div
              key={g}
              style={{ display: "flex", fontSize: 24, padding: "8px 18px", borderRadius: 999, border: "2px solid #333333", color: "#f2f2f2" }}
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
