"use client";

import { useMemo, useState } from "react";
import { publicPathUrl, publicSubdomainUrl } from "@/lib/config";
import type { RedirectRecord } from "@/lib/types";

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

const emptyForm = {
  id: "",
  name: "",
  slug: "",
  routingMode: "path",
  destinationUrl: "",
  active: true,
  expiresAt: "",
  notes: "",
  qrForeground: "#111827",
  qrBackground: "#ffffff",
  qrEcc: "H",
};

export function DashboardClient({ initialRedirects, usage, analytics }: Props) {
  const [redirects, setRedirects] = useState(initialRedirects);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState("");
  const maxScan = Math.max(...analytics.daily.map((day) => day.scans), 1);

  const activeCount = useMemo(() => redirects.filter((item) => item.active && !item.suspended_at).length, [redirects]);

  function updateField(name: string, value: string | boolean) {
    setForm((current) => ({ ...current, [name]: value }));
  }

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
    });
  }

  function publicUrl(item: RedirectRecord) {
    return item.routing_mode === "subdomain" ? publicSubdomainUrl(item.slug) : publicPathUrl(item.slug);
  }

  return (
    <div className="grid">
      <section className="panel">
        <h2>{form.id ? "Edit redirect" : "Create redirect"}</h2>
        <p className="muted">Active redirects: {activeCount} / {usage.limit}</p>
        {message ? <p className="error" role="alert">{message}</p> : null}
        <form className="form" onSubmit={submit}>
          <label>Name<input value={form.name} onChange={(event) => updateField("name", event.target.value)} required maxLength={120} /></label>
          <label>Slug<input value={form.slug} onChange={(event) => updateField("slug", event.target.value)} required maxLength={63} pattern="[A-Za-z0-9-]+" /></label>
          <label>Routing mode
            <select value={form.routingMode} onChange={(event) => updateField("routingMode", event.target.value)}>
              <option value="path">go.veildaemon.app/slug</option>
              <option value="subdomain">slug.veildaemon.app</option>
            </select>
          </label>
          <label>Destination URL<input value={form.destinationUrl} onChange={(event) => updateField("destinationUrl", event.target.value)} type="url" required maxLength={2048} /></label>
          <label>Expiration<input value={form.expiresAt} onChange={(event) => updateField("expiresAt", event.target.value)} type="datetime-local" /></label>
          <label>Notes<textarea value={form.notes} onChange={(event) => updateField("notes", event.target.value)} maxLength={1000} /></label>
          <div className="toolbar">
            <label>Foreground<input value={form.qrForeground} onChange={(event) => updateField("qrForeground", event.target.value)} type="color" /></label>
            <label>Background<input value={form.qrBackground} onChange={(event) => updateField("qrBackground", event.target.value)} type="color" /></label>
            <label>ECC<select value={form.qrEcc} onChange={(event) => updateField("qrEcc", event.target.value)}><option>H</option><option>Q</option><option>M</option><option>L</option></select></label>
          </div>
          <label><span><input checked={form.active} onChange={(event) => updateField("active", event.target.checked)} type="checkbox" /> Active</span></label>
          <div className="toolbar">
            <button type="submit">Save redirect</button>
            {form.id ? <button className="secondary" type="button" onClick={() => setForm(emptyForm)}>Cancel edit</button> : null}
          </div>
        </form>
      </section>

      <section className="panel">
        <h2>Analytics</h2>
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
                    <button className="secondary" type="button" onClick={() => navigator.clipboard.writeText(publicUrl(item))}>Copy</button>
                    <a className="button secondary" href={`/api/qr/${item.id}?format=svg`}>SVG</a>
                    <a className="button secondary" href={`/api/qr/${item.id}?format=png`}>PNG</a>
                    <button className="secondary" type="button" onClick={() => edit(item)}>Edit</button>
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
