"use client";

import { useEffect, useMemo, useState } from "react";
import { publicPathUrl, publicSubdomainUrl } from "@/lib/config";
import type { QrArtOption, QrFrameStyleOption, RedirectRecord, RoutingMode } from "@/lib/types";
import { generateArtisticQrSvg } from "@/lib/qr-generator";

type FormState = {
  id: string;
  name: string;
  slug: string;
  routingMode: RoutingMode;
  destinationUrl: string;
  active: boolean;
  expiresAt: string;
  notes: string;
  qrForeground: string;
  qrBackground: string;
  qrEcc: "L" | "M" | "Q" | "H";
  qrArt: QrArtOption;
  qrCustomArtUrl: string;
  qrAccent: string;
  qrAccentRate: number;
  qrEyeColor: string;
  qrFrameStyle: QrFrameStyleOption;
  qrFrameTitle: string;
  qrFrameSubtitle: string;
  qrNode: string;
  qrClearance: string;
  qrFooter: string;
};

const emptyForm: FormState = {
  id: "",
  name: "",
  slug: "",
  routingMode: "path",
  destinationUrl: "",
  active: true,
  expiresAt: "",
  notes: "",
  qrForeground: "#c9b8d0",
  qrBackground: "#0f0f15",
  qrEcc: "H",
  qrArt: "emblem",
  qrCustomArtUrl: "",
  qrAccent: "#9a3cff",
  qrAccentRate: 0.025,
  qrEyeColor: "#9a3cff",
  qrFrameStyle: "badge",
  qrFrameTitle: "VEILCORP ARCHIVES",
  qrFrameSubtitle: "ACCESS NODE // VERIFIED",
  qrNode: "PUBLIC INTAKE",
  qrClearance: "OBSERVER",
  qrFooter: "HUMAN AUTHORIZATION PARTIAL. SURVIVAL AUTHORIZATION ACTIVE.",
};

type Props = {
  initialRedirects: RedirectRecord[];
  usage: { activeRedirects: number; limit: number };
  analytics: {
    total: number;
    today: number;
    last7: number;
    last30: number;
    daily: { label: string; scans: number }[];
    devices: { label: string; count: number }[];
  };
};

const colorPresets = [
  { name: "VeilCorp Purple", fg: "#c9b8d0", bg: "#0f0f15", accent: "#9a3cff", eye: "#9a3cff" },
  { name: "Obsidian Tech", fg: "#e0e6ed", bg: "#0d1117", accent: "#00f0ff", eye: "#00f0ff" },
  { name: "Crimson Glitch", fg: "#ff3b3b", bg: "#0d0607", accent: "#ff9900", eye: "#ff3b3b" },
  { name: "Archival Parchment", fg: "#161817", bg: "#efebe4", accent: "#7c2d12", eye: "#161817" },
  { name: "Emerald Cathode", fg: "#7eb8a8", bg: "#070d0b", accent: "#10b981", eye: "#7eb8a8" },
  { name: "Cyber Neon", fg: "#00f0ff", bg: "#050b14", accent: "#ff007f", eye: "#00f0ff" },
  { name: "Gold Foil", fg: "#f59e0b", bg: "#111111", accent: "#fbbf24", eye: "#f59e0b" },
  { name: "High Contrast", fg: "#111827", bg: "#ffffff", accent: "", eye: "" },
];

const centerArtOptions: { id: QrArtOption; label: string }[] = [
  { id: "none", label: "None (Standard QR)" },
  { id: "emblem", label: "VeilCorp Emblem (Vector)" },
  { id: "seal", label: "Cradlepoint Seal (Vector)" },
  { id: "mark", label: "Studio Crest (Vector)" },
  { id: "book-one", label: "Book One Cover Art" },
  { id: "studio-seal", label: "Cradlepoint Studio Seal (Duality)" },
  { id: "custom", label: "Custom Image / Data URI" },
];

const frameStyleOptions: { id: QrFrameStyleOption; label: string; desc: string }[] = [
  { id: "badge", label: "Clean QR Badge", desc: "Minimalist high-density barcode with center artwork" },
  { id: "poster", label: "VeilCorp Archive Poster", desc: "Diegetic 1200x1600 industrial poster with node & clearance metadata" },
  { id: "tech-card", label: "Archival Tech Card", desc: "Cyberpunk 900x1200 scanner card with dashed grid marks" },
  { id: "neon", label: "Glossy Cyber Neon", desc: "Futuristic 800x960 panel with glowing corner brackets" },
];

export function DashboardClient({ initialRedirects, usage, analytics }: Props) {
  const [redirects, setRedirects] = useState(initialRedirects);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState("");
  const [previewSvg, setPreviewSvg] = useState("");
  const maxScan = Math.max(...analytics.daily.map((day) => day.scans), 1);

  const activeCount = useMemo(() => redirects.filter((item) => item.active && !item.suspended_at).length, [redirects]);

  function updateField(name: keyof FormState, value: string | boolean | number) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function applyPreset(fg: string, bg: string, accent: string, eye: string) {
    setForm((current) => ({ ...current, qrForeground: fg, qrBackground: bg, qrAccent: accent, qrEyeColor: eye }));
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setMessage("Image file size must be under 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUri = event.target?.result as string;
      if (dataUri) {
        setForm((current) => ({
          ...current,
          qrArt: "custom",
          qrCustomArtUrl: dataUri,
        }));
      }
    };
    reader.readAsDataURL(file);
  }

  // Generate live QR preview SVG using unified generator
  useEffect(() => {
    let canceled = false;
    async function updatePreview() {
      const targetSlug = form.slug.trim() || "demo-slug";
      const targetUrl = form.routingMode === "subdomain" ? publicSubdomainUrl(targetSlug) : publicPathUrl(targetSlug);

      try {
        const svg = await generateArtisticQrSvg({
          url: targetUrl,
          foreground: form.qrForeground,
          background: form.qrBackground,
          accent: form.qrAccent,
          accentRate: form.qrAccentRate,
          eyeColor: form.qrEyeColor,
          art: form.qrArt,
          customArtUrl: form.qrCustomArtUrl,
          frameStyle: form.qrFrameStyle,
          frameTitle: form.qrFrameTitle || form.name || "VEILCORP ARCHIVES",
          frameSubtitle: form.qrFrameSubtitle,
          node: form.qrNode,
          clearance: form.qrClearance,
          footer: form.qrFooter,
          ecc: form.qrEcc,
        });
        if (!canceled) setPreviewSvg(svg);
      } catch (err) {
        console.error("Preview render failed", err);
      }
    }
    updatePreview();
    return () => {
      canceled = true;
    };
  }, [
    form.slug,
    form.routingMode,
    form.qrForeground,
    form.qrBackground,
    form.qrAccent,
    form.qrAccentRate,
    form.qrEyeColor,
    form.qrEcc,
    form.qrArt,
    form.qrCustomArtUrl,
    form.qrFrameStyle,
    form.qrFrameTitle,
    form.qrFrameSubtitle,
    form.qrNode,
    form.qrClearance,
    form.qrFooter,
    form.name,
  ]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const payload = {
      ...form,
      expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : "",
    };
    const url = form.id ? `/api/redirects/${form.id}` : "/api/redirects";
    const response = await fetch(url, {
      method: form.id ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || "Unable to save redirect.");
      return;
    }
    setRedirects((current) => form.id ? current.map((item) => item.id === data.redirect.id ? data.redirect : item) : [data.redirect, ...current]);
    setForm(emptyForm);
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this redirect? Existing QR codes will land on a not-found page.")) return;
    const response = await fetch(`/api/redirects/${id}`, { method: "DELETE" });
    if (!response.ok) {
      const data = await response.json();
      setMessage(data.error || "Unable to delete redirect.");
      return;
    }
    setRedirects((current) => current.filter((item) => item.id !== id));
  }

  function edit(item: RedirectRecord) {
    setForm({
      id: item.id,
      name: item.name,
      slug: item.slug,
      routingMode: item.routing_mode,
      destinationUrl: item.destination_url,
      active: item.active,
      expiresAt: item.expires_at ? item.expires_at.slice(0, 16) : "",
      notes: item.notes,
      qrForeground: item.qr_foreground,
      qrBackground: item.qr_background,
      qrEcc: item.qr_ecc,
      qrArt: item.qr_art || "emblem",
      qrCustomArtUrl: item.qr_custom_art_url || "",
      qrAccent: item.qr_accent || "",
      qrAccentRate: item.qr_accent_rate ?? 0.025,
      qrEyeColor: item.qr_eye_color || "",
      qrFrameStyle: item.qr_frame_style || "badge",
      qrFrameTitle: item.qr_frame_title || item.name || "",
      qrFrameSubtitle: item.qr_frame_subtitle || "",
      qrNode: item.qr_node || "",
      qrClearance: item.qr_clearance || "",
      qrFooter: item.qr_footer || "",
    });
  }

  function publicUrl(item: RedirectRecord) {
    return item.routing_mode === "subdomain" ? publicSubdomainUrl(item.slug) : publicPathUrl(item.slug);
  }

  const buildDownloadUrl = (item: RedirectRecord | FormState, format: "svg" | "png") => {
    const isRecord = "user_id" in item;
    const id = item.id;
    const params = new URLSearchParams();
    params.set("format", format);
    params.set("fg", isRecord ? item.qr_foreground : item.qrForeground);
    params.set("bg", isRecord ? item.qr_background : item.qrBackground);
    params.set("art", (isRecord ? item.qr_art : item.qrArt) || "emblem");
    params.set("frame", (isRecord ? item.qr_frame_style : item.qrFrameStyle) || "badge");

    const accent = isRecord ? item.qr_accent : item.qrAccent;
    if (accent) params.set("accent", accent);

    const eye = isRecord ? item.qr_eye_color : item.qrEyeColor;
    if (eye) params.set("eye", eye);

    const title = isRecord ? item.qr_frame_title : item.qrFrameTitle;
    if (title) params.set("title", title);

    const subtitle = isRecord ? item.qr_frame_subtitle : item.qrFrameSubtitle;
    if (subtitle) params.set("subtitle", subtitle);

    const node = isRecord ? item.qr_node : item.qrNode;
    if (node) params.set("node", node);

    const clearance = isRecord ? item.qr_clearance : item.qrClearance;
    if (clearance) params.set("clearance", clearance);

    const footer = isRecord ? item.qr_footer : item.qrFooter;
    if (footer) params.set("footer", footer);

    if (id) {
      return `/api/qr/${id}?${params.toString()}`;
    }
    return "#";
  };

  return (
    <div className="grid">
      <section className="panel" style={{ gridColumn: "1 / -1" }}>
        <h2>{form.id ? "Edit redirect & Artistic QR Studio" : "Create redirect & Artistic QR Code"}</h2>
        <p className="muted">Active redirects: {activeCount} / {usage.limit}</p>
        {message ? <p className="error" role="alert">{message}</p> : null}

        <div className="qr-maker-layout" style={{ display: "grid", gridTemplateColumns: "1fr 420px", gap: "2rem", alignItems: "start" }}>
          <form className="form" onSubmit={submit}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <label>Name<input value={form.name} onChange={(event) => updateField("name", event.target.value)} required maxLength={120} placeholder="e.g. Campaign Flyer" /></label>
              <label>Slug<input value={form.slug} onChange={(event) => updateField("slug", event.target.value)} required maxLength={63} pattern="[A-Za-z0-9-]+" placeholder="flyer-2026" /></label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "1rem" }}>
              <label>Routing mode
                <select value={form.routingMode} onChange={(event) => updateField("routingMode", event.target.value as RoutingMode)}>
                  <option value="path">go.veildaemon.app/slug</option>
                  <option value="subdomain">slug.veildaemon.app</option>
                </select>
              </label>
              <label>Destination URL<input value={form.destinationUrl} onChange={(event) => updateField("destinationUrl", event.target.value)} type="url" required maxLength={2048} placeholder="https://example.com" /></label>
            </div>

            {/* Presets Gallery */}
            <div style={{ marginTop: "1rem", marginBottom: "1rem" }}>
              <label style={{ fontWeight: 600, display: "block", marginBottom: "0.5rem" }}>Aesthetic Color Presets</label>
              <div className="preset-grid" style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                {colorPresets.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    className={`preset-chip ${form.qrForeground === preset.fg && form.qrBackground === preset.bg && form.qrAccent === preset.accent ? "active" : ""}`}
                    onClick={() => applyPreset(preset.fg, preset.bg, preset.accent, preset.eye)}
                    style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.4rem 0.8rem", background: "#161922", border: "1px solid #2d3342", borderRadius: "6px", cursor: "pointer", color: "#e2e8f0", fontSize: "0.85rem" }}
                  >
                    <span className="swatch" style={{ display: "inline-block", width: "14px", height: "14px", borderRadius: "50%", background: preset.bg, border: `2px solid ${preset.accent || preset.fg}` }} />
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Fine-grain Color & Pattern Controls */}
            <div style={{ background: "#11141d", padding: "1rem", borderRadius: "8px", border: "1px solid #232938", marginBottom: "1rem" }}>
              <h4 style={{ margin: "0 0 0.8rem 0", fontSize: "0.95rem", color: "#a5b4fc" }}>Colors & Module Texture</h4>
              <div className="toolbar" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "0.8rem" }}>
                <label>Foreground<input value={form.qrForeground} onChange={(event) => updateField("qrForeground", event.target.value)} type="color" style={{ width: "100%", height: "36px" }} /></label>
                <label>Background<input value={form.qrBackground} onChange={(event) => updateField("qrBackground", event.target.value)} type="color" style={{ width: "100%", height: "36px" }} /></label>
                <label>Accent Modules<input value={form.qrAccent || form.qrForeground} onChange={(event) => updateField("qrAccent", event.target.value)} type="color" style={{ width: "100%", height: "36px" }} /></label>
                <label>Finder Eyes<input value={form.qrEyeColor || form.qrForeground} onChange={(event) => updateField("qrEyeColor", event.target.value)} type="color" style={{ width: "100%", height: "36px" }} /></label>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "0.8rem" }}>
                <label>Accent Module Density ({Math.round(form.qrAccentRate * 100)}%)
                  <input
                    type="range"
                    min="0"
                    max="0.10"
                    step="0.005"
                    value={form.qrAccentRate}
                    onChange={(event) => updateField("qrAccentRate", Number.parseFloat(event.target.value))}
                  />
                </label>
                <label>ECC Error Correction
                  <select value={form.qrEcc} onChange={(event) => updateField("qrEcc", event.target.value)}>
                    <option value="H">H (Highest - Best for Logos)</option>
                    <option value="Q">Q (High)</option>
                    <option value="M">M (Medium)</option>
                    <option value="L">L (Standard)</option>
                  </select>
                </label>
              </div>
            </div>

            {/* Center Art Embed Options */}
            <div style={{ background: "#11141d", padding: "1rem", borderRadius: "8px", border: "1px solid #232938", marginBottom: "1rem" }}>
              <h4 style={{ margin: "0 0 0.8rem 0", fontSize: "0.95rem", color: "#a5b4fc" }}>Artistic Image & Logo Embed</h4>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <label>Center Artwork Option
                  <select value={form.qrArt} onChange={(event) => updateField("qrArt", event.target.value as QrArtOption)}>
                    {centerArtOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>{opt.label}</option>
                    ))}
                  </select>
                </label>
                <div>
                  <label style={{ display: "block", marginBottom: "0.25rem" }}>Upload Custom Logo / Image</label>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={handleFileUpload}
                    style={{ fontSize: "0.85rem" }}
                  />
                </div>
              </div>

              {form.qrArt === "custom" ? (
                <div style={{ marginTop: "0.8rem" }}>
                  <label>Image URL or Base64 Data URI
                    <input
                      value={form.qrCustomArtUrl}
                      onChange={(event) => updateField("qrCustomArtUrl", event.target.value)}
                      placeholder="https://example.com/logo.png or data:image/png;base64,..."
                    />
                  </label>
                </div>
              ) : null}
            </div>

            {/* Frame Layout & Poster Customization */}
            <div style={{ background: "#11141d", padding: "1rem", borderRadius: "8px", border: "1px solid #232938", marginBottom: "1rem" }}>
              <h4 style={{ margin: "0 0 0.8rem 0", fontSize: "0.95rem", color: "#a5b4fc" }}>Frame & Poster Template</h4>
              <label style={{ marginBottom: "0.8rem", display: "block" }}>Frame Layout
                <select value={form.qrFrameStyle} onChange={(event) => updateField("qrFrameStyle", event.target.value as QrFrameStyleOption)}>
                  {frameStyleOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>{opt.label} — {opt.desc}</option>
                  ))}
                </select>
              </label>

              {form.qrFrameStyle !== "badge" ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.8rem", marginTop: "0.8rem" }}>
                  <label>Frame Title<input value={form.qrFrameTitle} onChange={(event) => updateField("qrFrameTitle", event.target.value)} placeholder="VEILCORP ARCHIVES" /></label>
                  <label>Subtitle<input value={form.qrFrameSubtitle} onChange={(event) => updateField("qrFrameSubtitle", event.target.value)} placeholder="ACCESS NODE // VERIFIED" /></label>
                  <label>Node ID<input value={form.qrNode} onChange={(event) => updateField("qrNode", event.target.value)} placeholder="PUBLIC INTAKE" /></label>
                  <label>Clearance Level<input value={form.qrClearance} onChange={(event) => updateField("qrClearance", event.target.value)} placeholder="OBSERVER" /></label>
                  <label style={{ gridColumn: "1 / -1" }}>Footer Text Line<input value={form.qrFooter} onChange={(event) => updateField("qrFooter", event.target.value)} placeholder="HUMAN AUTHORIZATION PARTIAL..." /></label>
                </div>
              ) : null}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <label>Expiration<input value={form.expiresAt} onChange={(event) => updateField("expiresAt", event.target.value)} type="datetime-local" /></label>
              <label style={{ alignSelf: "end" }}><span><input checked={form.active} onChange={(event) => updateField("active", event.target.checked)} type="checkbox" /> Active</span></label>
            </div>
            <label style={{ marginTop: "0.8rem", display: "block" }}>Notes<textarea value={form.notes} onChange={(event) => updateField("notes", event.target.value)} maxLength={1000} placeholder="Internal tracking notes..." /></label>

            <div className="toolbar" style={{ marginTop: "1rem" }}>
              <button type="submit" style={{ padding: "0.6rem 1.4rem" }}>{form.id ? "Update redirect & style" : "Create redirect & QR"}</button>
              {form.id ? <button className="secondary" type="button" onClick={() => setForm(emptyForm)}>Cancel edit</button> : null}
            </div>
          </form>

          {/* Real-time Artistic QR Preview Side Panel */}
          <aside className="qr-preview-box" style={{ background: "#0b0d14", border: "1px solid #1e2433", borderRadius: "10px", padding: "1.2rem", position: "sticky", top: "1rem" }}>
            <label style={{ display: "block", fontWeight: 700, marginBottom: "0.8rem", fontSize: "1.05rem", color: "#f1f5f9" }}>Real-time Artistic QR Preview</label>

            <div
              className="qr-preview-frame"
              style={{
                backgroundColor: form.qrBackground,
                padding: "0.8rem",
                borderRadius: "8px",
                boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                maxHeight: "520px",
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              dangerouslySetInnerHTML={{ __html: previewSvg }}
            />

            <div style={{ marginTop: "1rem", textAlign: "center" }}>
              <p className="muted" style={{ fontSize: "0.8rem", margin: "0 0 0.8rem 0" }}>
                Target link:<br />
                <code style={{ fontSize: "0.78rem", color: "#38bdf8" }}>
                  {form.routingMode === "subdomain" ? publicSubdomainUrl(form.slug || "slug") : publicPathUrl(form.slug || "slug")}
                </code>
              </p>

              {form.id ? (
                <div className="toolbar" style={{ justifyContent: "center", gap: "0.5rem" }}>
                  <a className="button secondary" download href={buildDownloadUrl(form, "svg")} style={{ fontSize: "0.85rem", padding: "0.4rem 0.8rem" }}>
                    Download SVG
                  </a>
                  <a className="button secondary" download href={buildDownloadUrl(form, "png")} style={{ fontSize: "0.85rem", padding: "0.4rem 0.8rem" }}>
                    Download PNG
                  </a>
                </div>
              ) : (
                <p className="muted" style={{ fontSize: "0.75rem" }}>Save redirect to activate high-res download endpoints.</p>
              )}
            </div>
          </aside>
        </div>
      </section>

      {/* Analytics Overview */}
      <section className="panel" style={{ gridColumn: "1 / -1", marginTop: "1rem" }}>
        <h2>Analytics Overview</h2>
        <div className="grid">
          <div><strong>{analytics.total}</strong><p className="muted">Total scans</p></div>
          <div><strong>{analytics.today}</strong><p className="muted">Today</p></div>
          <div><strong>{analytics.last7}</strong><p className="muted">Last 7 days</p></div>
          <div><strong>{analytics.last30}</strong><p className="muted">Last 30 days</p></div>
        </div>
        <div className="chart" aria-label="Daily scans for the last 7 days">
          {analytics.daily.map((day) => <div className="bar" key={day.label} title={`${day.label}: ${day.scans}`} style={{ height: `${Math.max(8, (day.scans / maxScan) * 110)}px` }} />)}
        </div>
        <p className="muted">{analytics.devices.map((item) => `${item.label}: ${item.count}`).join(" | ") || "No device data yet."}</p>
      </section>

      {/* Redirects Table */}
      <section className="panel" style={{ gridColumn: "1 / -1", marginTop: "1rem" }}>
        <h2>Your redirects ({redirects.length})</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Name & Style</th>
              <th>Stable URL</th>
              <th>Destination</th>
              <th>Scans</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {redirects.map((item) => (
              <tr key={item.id}>
                <td>
                  <strong>{item.name}</strong><br />
                  <span className="muted" style={{ fontSize: "0.8rem" }}>
                    {item.active ? "Active" : "Paused"} | Style: {item.qr_frame_style || "badge"} ({item.qr_art || "emblem"})
                  </span>
                </td>
                <td><code>{publicUrl(item)}</code></td>
                <td><span style={{ wordBreak: "break-all", fontSize: "0.85rem" }}>{item.destination_url}</span></td>
                <td><strong>{item.total_scans}</strong></td>
                <td>
                  <div className="toolbar" style={{ gap: "0.4rem" }}>
                    <button className="secondary" type="button" onClick={() => navigator.clipboard.writeText(publicUrl(item))}>Copy URL</button>
                    <a className="button secondary" download href={buildDownloadUrl(item, "svg")}>SVG</a>
                    <a className="button secondary" download href={buildDownloadUrl(item, "png")}>PNG</a>
                    <button className="secondary" type="button" onClick={() => edit(item)}>Edit / Style</button>
                    <button className="danger" type="button" onClick={() => remove(item.id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
