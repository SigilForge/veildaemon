"use client";

import { useEffect, useMemo, useState } from "react";
import { generateArtisticQrSvg } from "@/lib/qr-generator";
import {
  RIGHTS_QR_MIN_CONTRAST,
  defaultRightsQrPreferences,
  parseRightsQrPreferences,
  rightsQrArtOptions,
  rightsQrFrameStyles,
  toGeneratorOptions,
  type RightsQrPreferences,
} from "@/lib/rights/qr-options";
import { contrastRatio } from "@/lib/validation";

const colorPresets = [
  { name: "Archive Violet", fg: "#c9b8d0", bg: "#0f0f15", accent: "#9a3cff" },
  { name: "Obsidian", fg: "#e0e6ed", bg: "#0d1117", accent: "#00f0ff" },
  { name: "Parchment", fg: "#161817", bg: "#efebe4", accent: "#7c2d12" },
  { name: "Cathode", fg: "#7eb8a8", bg: "#070d0b", accent: "#10b981" },
];

type Props = {
  recordId: string;
  slug: string;
  title: string;
  recordCode: string | null;
  status: string;
  entitlementActive: boolean;
  durableUrl: string;
  initialPreferences?: Partial<RightsQrPreferences> | null;
  qrAssetVersion?: number | null;
};

function optionLabel(value: string) {
  return value.replace(/_/g, " ").replace(/^./, (first) => first.toUpperCase());
}

export function RightsQrStudio({
  recordId,
  slug,
  title,
  recordCode,
  status,
  entitlementActive,
  durableUrl,
  initialPreferences,
  qrAssetVersion,
}: Props) {
  const defaults = useMemo(
    () => ({
      ...defaultRightsQrPreferences({ record_id: recordCode, record_status: status, title }),
      ...(initialPreferences || {}),
    }),
    [recordCode, status, title, initialPreferences]
  );

  const [preferences, setPreferences] = useState<RightsQrPreferences>(defaults as RightsQrPreferences);
  const [previewSvg, setPreviewSvg] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(qrAssetVersion || 0);

  const contrast = contrastRatio(preferences.foreground, preferences.background);
  const contrastOk = contrast >= RIGHTS_QR_MIN_CONTRAST;

  useEffect(() => {
    let canceled = false;
    async function update() {
      const safety = parseRightsQrPreferences(preferences);
      if (!safety.ok) {
        if (!canceled) {
          setError(safety.error);
          setPreviewSvg("");
        }
        return;
      }
      try {
        const svg = await generateArtisticQrSvg(toGeneratorOptions(safety.preferences, durableUrl));
        if (!canceled) {
          setPreviewSvg(svg);
          setError("");
        }
      } catch (err) {
        if (!canceled) setError(err instanceof Error ? err.message : "Preview failed.");
      }
    }
    update();
    return () => {
      canceled = true;
    };
  }, [preferences, durableUrl]);

  function patch(partial: Partial<RightsQrPreferences>) {
    setPreferences((current) => ({ ...current, ...partial }));
  }

  async function download(format: "svg" | "png") {
    if (!entitlementActive) {
      setError("Publish this Rights Record to unlock branded QR downloads. Preview is free; downloadable assets require an issued record.");
      return;
    }
    const safety = parseRightsQrPreferences(preferences);
    if (!safety.ok) {
      setError(safety.error);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/rights/${recordId}/qr`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ format, preferences: safety.preferences, save: true }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || `Download failed (${response.status}).`);
      }
      const headerVersion = response.headers.get("x-rights-qr-version");
      if (headerVersion) setVersion(Number(headerVersion) || version + 1);
      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = `creator-rights-${slug}${headerVersion ? `-v${headerVersion}` : ""}.${format}`;
      anchor.click();
      URL.revokeObjectURL(href);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rights-qr-studio panel">
      <div className="rights-qr-studio-head">
        <div>
          <p className="panel-kicker">Branded QR provenance</p>
          <h3>Custom QR for {title}</h3>
          <p className="muted">
            Payload is locked to the durable public record URL. ECC H, quiet zone, contrast, center obstruction, and
            server-side decode verification are enforced on download.
          </p>
        </div>
        <div className="proof-row">
          <span className={`proof-chip ${entitlementActive ? "status-chip" : ""}`}>
            {entitlementActive ? "Issued · Active" : "Not issued yet"}
          </span>
          <span className="proof-chip">QR asset v{version || 0}</span>
        </div>
      </div>

      <p className="rights-qr-url mono">
        <strong>Public record URL</strong> {durableUrl}
      </p>

      {!entitlementActive ? (
        <p className="notice">
          Preview styles on the draft for free. After you publish, this becomes a managed QR asset you can regenerate
          anytime — the Rights Record is what you bought, not a single PNG.
        </p>
      ) : (
        <p className="muted">
          Regenerating updates the QR asset version only. The Rights Record and public slug stay the same.
        </p>
      )}

      <div className="rights-qr-grid">
        <div className="rights-qr-controls">
          <label>
            Theme presets
            <div className="rights-qr-presets">
              {colorPresets.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  className="button secondary"
                  onClick={() => patch({ foreground: preset.fg, background: preset.bg, accent: preset.accent })}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </label>

          <div className="rights-qr-colors">
            <label>
              Foreground
              <input type="color" value={preferences.foreground} onChange={(e) => patch({ foreground: e.target.value })} />
            </label>
            <label>
              Background
              <input type="color" value={preferences.background} onChange={(e) => patch({ background: e.target.value })} />
            </label>
            <label>
              Accent
              <input type="color" value={preferences.accent || "#9a3cff"} onChange={(e) => patch({ accent: e.target.value })} />
            </label>
          </div>
          <p className={`muted ${contrastOk ? "" : "rights-qr-warn"}`}>
            Contrast {contrast.toFixed(2)}:1 {contrastOk ? "(ok)" : `(need ≥ ${RIGHTS_QR_MIN_CONTRAST}:1)`}
          </p>

          <label>
            Center mark
            <select
              value={preferences.art}
              onChange={(e) => {
                const art = e.target.value as RightsQrPreferences["art"];
                patch({ art, customArtUrl: art === "custom" ? preferences.customArtUrl : "" });
              }}
            >
              {rightsQrArtOptions.map((art) => (
                <option key={art} value={art}>
                  {art === "custom" ? "Custom upload" : optionLabel(art)}
                </option>
              ))}
            </select>
          </label>

          {preferences.art === "custom" ? (
            <label>
              Upload center logo
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 150_000) {
                    setError("Center art should be under about 150KB so the QR still scans cleanly.");
                    return;
                  }
                  const reader = new FileReader();
                  reader.onload = () => {
                    const dataUri = String(reader.result || "");
                    if (!dataUri.startsWith("data:image/")) {
                      setError("Could not read that image.");
                      return;
                    }
                    patch({ art: "custom", customArtUrl: dataUri });
                    setError("");
                  };
                  reader.onerror = () => setError("Could not read that image.");
                  reader.readAsDataURL(file);
                }}
              />
              <span className="muted" style={{ display: "block", marginTop: "0.35rem", fontSize: "0.78rem" }}>
                PNG, JPEG, WebP, or SVG. Center obstruction stays capped; download still runs ECC H + decode verification.
              </span>
              {preferences.customArtUrl ? (
                <span className="muted" style={{ display: "block", marginTop: "0.25rem", fontSize: "0.78rem" }}>
                  Custom mark loaded{preferences.customArtUrl.startsWith("data:") ? " from upload" : ""}.
                </span>
              ) : null}
            </label>
          ) : null}

          <label>
            Frame style
            <select
              value={preferences.frameStyle}
              onChange={(e) => patch({ frameStyle: e.target.value as RightsQrPreferences["frameStyle"] })}
            >
              {rightsQrFrameStyles.map((frame) => (
                <option key={frame} value={frame}>
                  {optionLabel(frame)}
                </option>
              ))}
            </select>
          </label>

          {preferences.frameStyle !== "badge" ? (
            <div className="rights-qr-labels">
              <label>
                Title
                <input value={preferences.frameTitle} maxLength={80} onChange={(e) => patch({ frameTitle: e.target.value })} />
              </label>
              <label>
                Subtitle
                <input
                  value={preferences.frameSubtitle}
                  maxLength={80}
                  onChange={(e) => patch({ frameSubtitle: e.target.value })}
                />
              </label>
              <label>
                Node
                <input value={preferences.node} maxLength={80} onChange={(e) => patch({ node: e.target.value })} />
              </label>
              <label>
                Clearance
                <input value={preferences.clearance} maxLength={80} onChange={(e) => patch({ clearance: e.target.value })} />
              </label>
              <label className="full">
                Footer
                <input value={preferences.footer} maxLength={120} onChange={(e) => patch({ footer: e.target.value })} />
              </label>
            </div>
          ) : null}

          <div className="toolbar">
            <button type="button" className="button" disabled={busy || !entitlementActive || !contrastOk} onClick={() => download("svg")}>
              Download SVG
            </button>
            <button
              type="button"
              className="button secondary"
              disabled={busy || !entitlementActive || !contrastOk}
              onClick={() => download("png")}
            >
              Download PNG
            </button>
          </div>
          {error ? <p className="rights-qr-warn">{error}</p> : null}
        </div>

        <aside className="rights-qr-preview">
          <p className="panel-kicker">Live preview</p>
          <div className="rights-qr" style={{ background: preferences.background }} dangerouslySetInnerHTML={{ __html: previewSvg }} />
          <p className="muted">Server re-validates colors, forces ECC H, and decode-checks the durable URL before every download.</p>
        </aside>
      </div>
    </div>
  );
}
