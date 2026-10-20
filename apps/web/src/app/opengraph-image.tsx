import { ImageResponse } from "next/og";
import { SITE_NAME } from "@/lib/site";

export const alt = `${SITE_NAME} — practical eBooks you can read anywhere`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The preview shown when the site is shared on WhatsApp, Instagram, X or Facebook. */
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
          padding: 72,
          background: "linear-gradient(135deg, #312e81 0%, #4f46e5 45%, #7c3aed 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ display: "flex", width: 72, height: 72, borderRadius: 18, background: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center" }}>
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 7v14" />
              <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
            </svg>
          </div>
          <div style={{ fontSize: 44, fontWeight: 700 }}>{SITE_NAME}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 72, fontWeight: 800, lineHeight: 1.05, maxWidth: 900 }}>Practical eBooks you can read anywhere</div>
          <div style={{ fontSize: 32, opacity: 0.85 }}>Read a free sample · Pay with UPI · Start reading in seconds</div>
        </div>

        <div style={{ display: "flex", gap: 14 }}>
          {["Instant access", "Online reader", "Hindi & English"].map((t) => (
            <div key={t} style={{ display: "flex", fontSize: 26, padding: "10px 22px", borderRadius: 999, background: "rgba(255,255,255,0.16)" }}>
              {t}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
