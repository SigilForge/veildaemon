"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { publicPathUrl, publicSubdomainUrl } from "@/lib/config";
import type { RedirectRecord, RoutingMode } from "@/lib/types";

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
  qrArt: "none" | "emblem" | "seal" | "mark";
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
};
import { contrastRatio } from "@/lib/validation";

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
  { name: "High Contrast", fg: "#111827", bg: "#ffffff" },
  { name: "Obsidian Tech", fg: "#e0e6ed", bg: "#0d1117" },
  { name: "Crimson Glitch", fg: "#ff4d4d", bg: "#0d0607" },
  { name: "VeilCorp Purple", fg: "#c9b8d0", bg: "#0f0f15" },
  { name: "Archival Paper", fg: "#161817", bg: "#efebe4" },
  { name: "Sage Cathode", fg: "#7eb8a8", bg: "#070d0b" },
];

const centerArtOptions = [
  { id: "none", label: "None (Standard)" },
  { id: "emblem", label: "VeilCorp Emblem" },
  { id: "seal", label: "Cradlepoint Seal" },
  { id: "mark", label: "Studio Crest" },
];

const EMBLEM_SVG = `<path d="M50 14 L82 50 L50 86 L18 50 Z" fill="none" stroke="CURRENT_FG" stroke-width="6" stroke-linejoin="round"/><circle cx="50" cy="50" r="10" fill="CURRENT_FG"/><path d="M50 28 V72 M28 50 H72" stroke="CURRENT_BG" stroke-width="4"/>`;

const SEAL_SVG = `<circle cx="50" cy="50" r="44" fill="none" stroke="CURRENT_FG" stroke-width="5"/><circle cx="50" cy="50" r="35" fill="none" stroke="CURRENT_FG" stroke-width="2.5" stroke-dasharray="5 3"/><polygon points="50,20 57,36 74,36 60,47 65,64 50,53 35,64 40,47 26,36 43,36" fill="CURRENT_FG"/>`;

const MARK_SVG = `<path d="M20 25 L50 82 L80 25 H64 L50 56 L36 25 Z" fill="CURRENT_FG"/>`;

function embedCenterArt(svgString: string, artType: string, foreground: string, background: string) {
  if (!artType || artType === "none") return svgString;

  const viewBoxMatch = svgString.match(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/i);
  const width = viewBoxMatch ? parseFloat(viewBoxMatch[1]) : 100;

  const badgeSize = Math.round(width * 0.22);
  const x = (width - badgeSize) / 2;
  const y = (width - badgeSize) / 2;
  const rx = Math.round(badgeSize * 0.22);
  const strokeWidth = Math.max(1.5, Math.round(width / 120));

  let artPath = "";
  if (artType === "emblem") {
    artPath = EMBLEM_SVG.replaceAll("CURRENT_FG", foreground).replaceAll("CURRENT_BG", background);
  } else if (artType === "seal") {
    artPath = SEAL_SVG.replaceAll("CURRENT_FG", foreground).replaceAll("CURRENT_BG", background);
  } else if (artType === "mark") {
    artPath = MARK_SVG.replaceAll("CURRENT_FG", foreground).replaceAll("CURRENT_BG", background);
  } else {
    return svgString;
  }

  const artGroup = `
  <g id="qr-center-art">
    <rect x="${x}" y="${y}" width="${badgeSize}" height="${badgeSize}" rx="${rx}" fill="${background}" stroke="${foreground}" stroke-width="${strokeWidth}"/>
    <g transform="translate(${x} ${y}) scale(${badgeSize / 100})">
      ${artPath}
    </g>
  </g>
</svg>`;

  return svgString.replace("</svg>", artGroup);
}



export function DashboardClient({ initialRedirects, usage, analytics }: Props) {
  const [redirects, setRedirects] = useState(initialRedirects);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState("");
  const [previewSvg, setPreviewSvg] = useState("");
  const maxScan = Math.max(...analytics.daily.map((day) => day.scans), 1);

  const activeCount = useMemo(() => redirects.filter((item) => item.active && !item.suspended_at).length, [redirects]);

  function updateField(name: string, value: string | boolean) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function applyPreset(fg: string, bg: string) {
    setForm((current) => ({ ...current, qrForeground: fg, qrBackground: bg }));
  }

  // Generate live QR preview SVG
  useEffect(() => {
    let canceled = false;
    async function updatePreview() {
      const targetSlug = form.slug.trim() || "demo-slug";
      const targetUrl = form.routingMode === "subdomain" ? publicSubdomainUrl(targetSlug) : publicPathUrl(targetSlug);
      const safeFg = contrastRatio(form.qrForeground, form.qrBackground) >= 4.5 ? form.qrForeground : "#111827";
      const safeBg = contrastRatio(form.qrForeground, form.qrBackground) >= 4.5 ? form.qrBackground : "#ffffff";
      const ecc = form.qrArt !== "none" ? "H" : form.qrEcc;

      try {
        const raw = await QRCode.toString(targetUrl, {
          type: "svg",
          errorCorrectionLevel: ecc,
          margin: 3,
          color: { dark: safeFg, light: safeBg },
        });
        const styled = embedCenterArt(raw, form.qrArt, safeFg, safeBg);
        if (!canceled) setPreviewSvg(styled);
      } catch {
        // fallback ignored
      }
    }
    updatePreview();
    return () => {
      canceled = true;
    };
  }, [form.slug, form.routingMode, form.qrForeground, form.qrBackground, form.qrEcc, form.qrArt]);

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
      qrArt: "emblem",
    });
  }

  function publicUrl(item: RedirectRecord) {
    return item.routing_mode === "subdomain" ? publicSubdomainUrl(item.slug) : publicPathUrl(item.slug);
  }

  return (
    <div className="grid">
      <section className="panel" style={{ gridColumn: "1 / -1" }}>
        <h2>{form.id ? "Edit redirect & QR Code" : "Create redirect & custom QR Code"}</h2>
        <p className="muted">Active redirects: {activeCount} / {usage.limit}</p>
        {message ? <p className="error" role="alert">{message}</p> : null}

        <div className="qr-maker-layout">
          <form className="form" onSubmit={submit}>
            <label>Name<input value={form.name} onChange={(event) => updateField("name", event.target.value)} required maxLength={120} placeholder="e.g. Campaign Flyer" /></label>
            <label>Slug<input value={form.slug} onChange={(event) => updateField("slug", event.target.value)} required maxLength={63} pattern="[A-Za-z0-9-]+" placeholder="flyer-2026" /></label>
            <label>Routing mode
              <select value={form.routingMode} onChange={(event) => updateField("routingMode", event.target.value)}>
                <option value="path">go.veildaemon.app/slug</option>
                <option value="subdomain">slug.veildaemon.app</option>
              </select>
            </label>
            <label>Destination URL<input value={form.destinationUrl} onChange={(event) => updateField("destinationUrl", event.target.value)} type="url" required maxLength={2048} placeholder="https://example.com" /></label>

            <div>
              <label>Color Presets</label>
              <div className="preset-grid">
                {colorPresets.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    className={`preset-chip ${form.qrForeground === preset.fg && form.qrBackground === preset.bg ? "active" : ""}`}
                    onClick={() => applyPreset(preset.fg, preset.bg)}
                  >
                    <span className="swatch" style={{ background: preset.bg, borderColor: preset.fg }} />
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="toolbar">
              <label>Foreground<input value={form.qrForeground} onChange={(event) => updateField("qrForeground", event.target.value)} type="color" /></label>
              <label>Background<input value={form.qrBackground} onChange={(event) => updateField("qrBackground", event.target.value)} type="color" /></label>
              <label>Center Art
                <select value={form.qrArt} onChange={(event) => updateField("qrArt", event.target.value)}>
                  {centerArtOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                  ))}
                </select>
              </label>
              <label>ECC
                <select value={form.qrEcc} onChange={(event) => updateField("qrEcc", event.target.value)}>
                  <option value="H">H (Highest)</option>
                  <option value="Q">Q (High)</option>
                  <option value="M">M (Medium)</option>
                  <option value="L">L (Standard)</option>
                </select>
              </label>
            </div>

            <label>Expiration<input value={form.expiresAt} onChange={(event) => updateField("expiresAt", event.target.value)} type="datetime-local" /></label>
            <label>Notes<textarea value={form.notes} onChange={(event) => updateField("notes", event.target.value)} maxLength={1000} placeholder="Internal tracking notes..." /></label>
            <label><span><input checked={form.active} onChange={(event) => updateField("active", event.target.checked)} type="checkbox" /> Active</span></label>
            <div className="toolbar">
              <button type="submit">{form.id ? "Update redirect" : "Create redirect"}</button>
              {form.id ? <button className="secondary" type="button" onClick={() => setForm(emptyForm)}>Cancel edit</button> : null}
            </div>
          </form>

          <aside className="qr-preview-box">
            <label>Live QR Preview</label>
            <div className="qr-preview-frame" style={{ backgroundColor: form.qrBackground }} dangerouslySetInnerHTML={{ __html: previewSvg }} />
            <p className="muted" style={{ fontSize: "0.78rem" }}>
              Scanning lands on<br />
              <code>{form.routingMode === "subdomain" ? publicSubdomainUrl(form.slug || "slug") : publicPathUrl(form.slug || "slug")}</code>
            </p>
            {form.id ? (
              <div className="toolbar" style={{ justifyContent: "center" }}>
                <a className="button secondary" href={`/api/qr/${form.id}?format=svg&art=${form.qrArt}&fg=${encodeURIComponent(form.qrForeground)}&bg=${encodeURIComponent(form.qrBackground)}`}>Download SVG</a>
                <a className="button secondary" href={`/api/qr/${form.id}?format=png&art=${form.qrArt}&fg=${encodeURIComponent(form.qrForeground)}&bg=${encodeURIComponent(form.qrBackground)}`}>Download PNG</a>
              </div>
            ) : null}
          </aside>
        </div>
      </section>

      <section className="panel" style={{ gridColumn: "1 / -1" }}>
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

      <section className="panel" style={{ gridColumn: "1 / -1" }}>
        <h2>Your redirects</h2>
        <table className="table">
          <thead><tr><th>Name</th><th>Stable URL</th><th>Destination</th><th>Scans</th><th>Actions</th></tr></thead>
          <tbody>
            {redirects.map((item) => (
              <tr key={item.id}>
                <td>{item.name}<br /><span className="muted">{item.active ? "Active" : "Paused"} {item.suspended_at ? " | Suspended" : ""}</span></td>
                <td><code>{publicUrl(item)}</code></td>
                <td>{item.destination_url}</td>
                <td>{item.total_scans}</td>
                <td>
                  <div className="toolbar">
                    <button className="secondary" type="button" onClick={() => navigator.clipboard.writeText(publicUrl(item))}>Copy URL</button>
                    <a className="button secondary" href={`/api/qr/${item.id}?format=svg&art=${form.qrArt}&fg=${encodeURIComponent(item.qr_foreground)}&bg=${encodeURIComponent(item.qr_background)}`}>SVG</a>
                    <a className="button secondary" href={`/api/qr/${item.id}?format=png&art=${form.qrArt}&fg=${encodeURIComponent(item.qr_foreground)}&bg=${encodeURIComponent(item.qr_background)}`}>PNG</a>
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
