import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/seo";

export const alt = `${siteConfig.name} — ${siteConfig.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function TwitterImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background:
            "radial-gradient(ellipse 70% 55% at 80% 10%, rgba(181,117,104,0.28), transparent 55%), radial-gradient(ellipse 50% 45% at 10% 80%, rgba(126,184,168,0.18), transparent 50%), linear-gradient(160deg, #0c0e0f 0%, #07090a 55%, #050709 100%)",
          color: "#f3f0ea",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "#d4a89a",
          }}
        >
          {siteConfig.name}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 900 }}>
          <div style={{ fontSize: 60, lineHeight: 1.02, letterSpacing: "-0.04em", fontWeight: 500 }}>
            Editable QR codes without the ransom note.
          </div>
          <div style={{ fontSize: 26, lineHeight: 1.4, color: "#c4c0b8" }}>
            Print once. Change the destination forever.
          </div>
        </div>
        <div style={{ fontSize: 18, color: "#8f8b84" }}>go.veildaemon.app · Cradlepoint Studio</div>
      </div>
    ),
    { ...size },
  );
}
