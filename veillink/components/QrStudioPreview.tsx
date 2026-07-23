"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { generateArtisticQrSvg } from "@/lib/qr-generator";
import type { QrArtOption, QrFrameStyleOption } from "@/lib/types";

const colorPresets = [
  { name: "VeilCorp Purple", fg: "#c9b8d0", bg: "#0f0f15", accent: "#9a3cff", eye: "#9a3cff" },
  { name: "Obsidian Tech", fg: "#e0e6ed", bg: "#0d1117", accent: "#00f0ff", eye: "#00f0ff" },
  { name: "Crimson Glitch", fg: "#ff3b3b", bg: "#0d0607", accent: "#ff9900", eye: "#ff3b3b" },
  { name: "Archival Parchment", fg: "#161817", bg: "#efebe4", accent: "#7c2d12", eye: "#161817" },
  { name: "Emerald Cathode", fg: "#7eb8a8", bg: "#070d0b", accent: "#10b981", eye: "#7eb8a8" },
  { name: "Cyber Neon", fg: "#00f0ff", bg: "#050b14", accent: "#ff007f", eye: "#00f0ff" },
];

const centerArtOptions: { id: QrArtOption; label: string }[] = [
  { id: "emblem", label: "VeilCorp Emblem (Vector)" },
  { id: "seal", label: "Cradlepoint Seal (Vector)" },
  { id: "mark", label: "Studio Crest (Vector)" },
  { id: "book-one", label: "Book One Cover Art" },
  { id: "studio-seal", label: "Cradlepoint Studio Seal" },
  { id: "none", label: "None (Standard QR)" },
  { id: "custom", label: "Custom Logo Upload" },
];

const frameStyleOptions: { id: QrFrameStyleOption; label: string }[] = [
  { id: "badge", label: "Clean QR Badge" },
  { id: "poster", label: "VeilCorp Archive Poster (1200x1600)" },
  { id: "tech-card", label: "Archival Tech Card (900x1200)" },
  { id: "neon", label: "Glossy Cyber Neon (800x960)" },
];

export function QrStudioPreview() {
  const [url, setUrl] = useState("https://veildaemon.app");
  const [fg, setFg] = useState("#c9b8d0");
  const [bg, setBg] = useState("#0f0f15");
  const [accent, setAccent] = useState("#9a3cff");
  const [accentRate, setAccentRate] = useState(0.03);
  const [eyeColor, setEyeColor] = useState("#9a3cff");
  const [art, setArt] = useState<QrArtOption>("emblem");
  const [customArtUrl, setCustomArtUrl] = useState("");
  const [frameStyle, setFrameStyle] = useState<QrFrameStyleOption>("badge");
  const [frameTitle, setFrameTitle] = useState("VEILCORP ARCHIVES");
  const [frameSubtitle, setFrameSubtitle] = useState("ACCESS NODE // VERIFIED");
  const [node, setNode] = useState("PUBLIC INTAKE");
  const [clearance, setClearance] = useState("OBSERVER");
  const [footer, setFooter] = useState("HUMAN AUTHORIZATION PARTIAL. SURVIVAL AUTHORIZATION ACTIVE.");

  const [previewSvg, setPreviewSvg] = useState("");
  const [inspectModalOpen, setInspectModalOpen] = useState(false);

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUri = event.target?.result as string;
      if (dataUri) {
        setCustomArtUrl(dataUri);
        setArt("custom");
      }
    };
    reader.readAsDataURL(file);
  }

  function applyPreset(presetFg: string, presetBg: string, presetAccent: string, presetEye: string) {
    setFg(presetFg);
    setBg(presetBg);
    setAccent(presetAccent);
    setEyeColor(presetEye);
  }

  useEffect(() => {
    let canceled = false;
    async function update() {
      try {
        const svg = await generateArtisticQrSvg({
          url: url || "https://veildaemon.app",
          foreground: fg,
          background: bg,
          accent,
          accentRate,
          eyeColor,
          art,
          customArtUrl,
          frameStyle,
          frameTitle,
          frameSubtitle,
          node,
          clearance,
          footer,
          ecc: "H",
        });
        if (!canceled) setPreviewSvg(svg);
      } catch {
        // fallback ignored
      }
    }
    update();
    return () => {
      canceled = true;
    };
  }, [url, fg, bg, accent, accentRate, eyeColor, art, customArtUrl, frameStyle, frameTitle, frameSubtitle, node, clearance, footer]);

  return (
    <div className="panel" style={{ background: "#0b0d14", border: "1px solid #1e2433", borderRadius: "12px", padding: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.2rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <p className="panel-kicker" style={{ color: "#38bdf8", margin: 0, textTransform: "uppercase", fontSize: "0.8rem", letterSpacing: "2px" }}>
            Live Interactive Studio Sandbox
          </p>
          <h2 style={{ margin: "0.2rem 0 0 0", fontSize: "1.4rem", color: "#f8fafc" }}>
            Preview Custom QR & Poster Assets Before Generating
          </h2>
        </div>
        <button
          type="button"
          className="button secondary"
          onClick={() => setInspectModalOpen(true)}
          style={{ fontSize: "0.85rem" }}
        >
          🔍 Full Screen Asset Inspector
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 400px", gap: "2rem", alignItems: "start" }}>
        {/* Controls Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label style={{ fontWeight: 600, fontSize: "0.88rem", display: "block", marginBottom: "0.4rem" }}>Target Link URL / Payload</label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://yourwebsite.com/menu"
              style={{ width: "100%", background: "#161922", border: "1px solid #2d3342", color: "#f8fafc", padding: "0.5rem 0.8rem", borderRadius: "6px" }}
            />
          </div>

          {/* Color Presets */}
          <div>
            <label style={{ fontWeight: 600, fontSize: "0.88rem", display: "block", marginBottom: "0.4rem" }}>Aesthetic Color Themes</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
              {colorPresets.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => applyPreset(preset.fg, preset.bg, preset.accent, preset.eye)}
                  style={{
                    padding: "0.35rem 0.7rem",
                    background: fg === preset.fg && bg === preset.bg ? "#1e293b" : "#161922",
                    border: fg === preset.fg && bg === preset.bg ? "1px solid #38bdf8" : "1px solid #2d3342",
                    borderRadius: "6px",
                    color: "#f8fafc",
                    fontSize: "0.8rem",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.4rem",
                  }}
                >
                  <span style={{ width: "12px", height: "12px", borderRadius: "50%", background: preset.bg, border: `2px solid ${preset.accent || preset.fg}` }} />
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          {/* Color Pickers */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: "0.6rem", background: "#11141d", padding: "0.8rem", borderRadius: "8px", border: "1px solid #232938" }}>
            <label style={{ fontSize: "0.8rem" }}>Foreground<input value={fg} onChange={(e) => setFg(e.target.value)} type="color" style={{ width: "100%", height: "32px", cursor: "pointer" }} /></label>
            <label style={{ fontSize: "0.8rem" }}>Background<input value={bg} onChange={(e) => setBg(e.target.value)} type="color" style={{ width: "100%", height: "32px", cursor: "pointer" }} /></label>
            <label style={{ fontSize: "0.8rem" }}>Accent Scatter<input value={accent} onChange={(e) => setAccent(e.target.value)} type="color" style={{ width: "100%", height: "32px", cursor: "pointer" }} /></label>
            <label style={{ fontSize: "0.8rem" }}>Finder Eyes<input value={eyeColor} onChange={(e) => setEyeColor(e.target.value)} type="color" style={{ width: "100%", height: "32px", cursor: "pointer" }} /></label>
          </div>

          {/* Center Art & Custom Logo */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.8rem" }}>
            <div>
              <label style={{ fontWeight: 600, fontSize: "0.85rem", display: "block", marginBottom: "0.3rem" }}>Center Logo / Art</label>
              <select
                value={art}
                onChange={(e) => setArt(e.target.value as QrArtOption)}
                style={{ width: "100%", background: "#161922", border: "1px solid #2d3342", color: "#f8fafc", padding: "0.45rem", borderRadius: "6px" }}
              >
                {centerArtOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontWeight: 600, fontSize: "0.85rem", display: "block", marginBottom: "0.3rem" }}>Upload Image / Logo</label>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={handleFileUpload}
                style={{ fontSize: "0.8rem" }}
              />
            </div>
          </div>

          {/* Frame Style & Poster Metadata */}
          <div style={{ background: "#11141d", padding: "0.8rem", borderRadius: "8px", border: "1px solid #232938" }}>
            <label style={{ fontWeight: 600, fontSize: "0.85rem", display: "block", marginBottom: "0.3rem" }}>Frame & Poster Template</label>
            <select
              value={frameStyle}
              onChange={(e) => setFrameStyle(e.target.value as QrFrameStyleOption)}
              style={{ width: "100%", background: "#161922", border: "1px solid #2d3342", color: "#f8fafc", padding: "0.45rem", borderRadius: "6px", marginBottom: "0.6rem" }}
            >
              {frameStyleOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>

            {frameStyle !== "badge" ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
                <input value={frameTitle} onChange={(e) => setFrameTitle(e.target.value)} placeholder="Title" style={{ fontSize: "0.8rem", padding: "0.35rem" }} />
                <input value={frameSubtitle} onChange={(e) => setFrameSubtitle(e.target.value)} placeholder="Subtitle" style={{ fontSize: "0.8rem", padding: "0.35rem" }} />
                <input value={node} onChange={(e) => setNode(e.target.value)} placeholder="Node" style={{ fontSize: "0.8rem", padding: "0.35rem" }} />
                <input value={clearance} onChange={(e) => setClearance(e.target.value)} placeholder="Clearance" style={{ fontSize: "0.8rem", padding: "0.35rem" }} />
                <input value={footer} onChange={(e) => setFooter(e.target.value)} placeholder="Footer" style={{ gridColumn: "1 / -1", fontSize: "0.8rem", padding: "0.35rem" }} />
              </div>
            ) : null}
          </div>
        </div>

        {/* Live Preview Display Box */}
        <aside style={{ background: "#06080e", border: "1px solid #1e2433", borderRadius: "10px", padding: "1.2rem", textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.8rem" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "1px" }}>
              Real-time Live Preview
            </span>
            <span style={{ fontSize: "0.75rem", background: "#1e293b", color: "#38bdf8", padding: "0.15rem 0.5rem", borderRadius: "4px" }}>
              Scan Test Active
            </span>
          </div>

          <div
            style={{
              backgroundColor: bg,
              padding: "0.8rem",
              borderRadius: "8px",
              boxShadow: "0 10px 30px rgba(0,0,0,0.6)",
              maxHeight: "440px",
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            dangerouslySetInnerHTML={{ __html: previewSvg }}
          />

          <div style={{ marginTop: "1.2rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            <button
              type="button"
              className="button"
              onClick={() => setInspectModalOpen(true)}
              style={{ width: "100%", justifyContent: "center" }}
            >
              Verify & Inspect Print Asset
            </button>
            <Link href="/signup" className="button secondary" style={{ width: "100%", textAlign: "center" }}>
              Create Free Link with This Style →
            </Link>
          </div>
        </aside>
      </div>

      {/* Full Screen Asset Inspector Modal */}
      {inspectModalOpen ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            backgroundColor: "rgba(5, 7, 12, 0.92)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1.5rem",
          }}
          onClick={() => setInspectModalOpen(false)}
        >
          <div
            style={{
              background: "#0d111a",
              border: "1px solid #2d3748",
              borderRadius: "14px",
              padding: "2rem",
              maxWidth: "760px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.8)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.3rem", color: "#f8fafc" }}>Asset Print & Scan Inspector</h3>
                <p style={{ margin: "0.2rem 0 0 0", fontSize: "0.85rem", color: "#94a3b8" }}>
                  Verify high-resolution SVG layout before committing to database or physical print.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectModalOpen(false)}
                style={{ background: "#1e293b", border: "none", color: "#f8fafc", fontSize: "1.2rem", cursor: "pointer", width: "36px", height: "36px", borderRadius: "50%" }}
              >
                ✕
              </button>
            </div>

            <div style={{ backgroundColor: bg, padding: "1.5rem", borderRadius: "10px", display: "flex", justifyContent: "center", marginBottom: "1.5rem" }} dangerouslySetInnerHTML={{ __html: previewSvg }} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", fontSize: "0.85rem", background: "#161d2a", padding: "1rem", borderRadius: "8px", marginBottom: "1.5rem" }}>
              <div><strong>Frame Template:</strong> {frameStyle}</div>
              <div><strong>Center Artwork:</strong> {art}</div>
              <div><strong>Foreground Color:</strong> <code style={{ color: fg }}>{fg}</code></div>
              <div><strong>Background Color:</strong> <code style={{ color: bg }}>{bg}</code></div>
              <div style={{ gridColumn: "1 / -1" }}><strong>Encoded Destination:</strong> <code style={{ color: "#38bdf8" }}>{url}</code></div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.8rem" }}>
              <button type="button" className="button secondary" onClick={() => setInspectModalOpen(false)}>
                Close Inspector
              </button>
              <Link href="/signup" className="button">
                Commit & Create Link →
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
