import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/seo";

export const alt = `${siteConfig.name} — ${siteConfig.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

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
          padding: "64px 72px",
          background:
            "radial-gradient(ellipse 70% 55% at 80% 10%, rgba(181,117,104,0.28), transparent 55%), radial-gradient(ellipse 50% 45% at 10% 80%, rgba(126,184,168,0.18), transparent 50%), linear-gradient(160deg, #0c0e0f 0%, #07090a 55%, #050709 100%)",
          color: "#f3f0ea",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
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
            <div style={{ fontSize: 18, color: "#8f8b84", letterSpacing: "0.08em" }}>
              go.veildaemon.app · Cradlepoint Studio
            </div>
          </div>
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 18,
              border: "2px solid rgba(243,240,234,0.18)",
              background:
                "linear-gradient(135deg, #f6f3ed 0 25%, #111314 0 50%, #f6f3ed 0 75%, #111314 0), #efebe4",
              backgroundSize: "16px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#161817",
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: "0.12em",
            }}
          >
            VL
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 900 }}>
          <div
            style={{
              fontSize: 64,
              lineHeight: 1.02,
              letterSpacing: "-0.04em",
              fontWeight: 500,
            }}
          >
            Editable QR codes without the ransom note.
          </div>
          <div style={{ fontSize: 28, lineHeight: 1.4, color: "#c4c0b8", maxWidth: 820 }}>
            Print once. Change the destination forever. Short links, PNG/SVG downloads, scan counts—honest tools for
            real businesses.
          </div>
        </div>

        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {["Dynamic redirects", "Stable printed QR", "Free to start"].map((label) => (
            <div
              key={label}
              style={{
                padding: "10px 16px",
                borderRadius: 999,
                border: "1px solid rgba(243,240,234,0.14)",
                background: "rgba(255,255,255,0.04)",
                fontSize: 18,
                color: "#c4c0b8",
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
