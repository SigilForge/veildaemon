import { describe, expect, it } from "vitest";
import { browserFamily, deviceCategory, operatingSystem } from "@/lib/analytics";
import { parseRedirectRequest } from "@/lib/host";
import { canCreateActiveRedirect, requireAdminRole, userOwnsRedirect } from "@/lib/policy";
import { redirectState } from "@/lib/resolve";
import { contrastRatio, validateDestinationUrl, validateSlug } from "@/lib/validation";
import type { RedirectRecord } from "@/lib/types";

function redirectRecord(overrides: Partial<RedirectRecord> = {}): RedirectRecord {
  return {
    id: "redirect-1",
    user_id: "user-1",
    name: "Menu",
    slug: "menu",
    routing_mode: "path",
    destination_url: "https://example.com/menu",
    active: true,
    expires_at: null,
    notes: "",
    qr_foreground: "#111827",
    qr_background: "#ffffff",
    qr_ecc: "H",
    qr_art: "emblem",
    qr_custom_art_url: "",
    qr_accent: "",
    qr_accent_rate: 0.025,
    qr_eye_color: "",
    qr_frame_style: "badge",
    qr_frame_title: "",
    qr_frame_subtitle: "",
    qr_node: "",
    qr_clearance: "",
    qr_footer: "",
    total_scans: 0,
    suspended_at: null,
    suspension_reason: null,
    created_at: "2026-07-22T00:00:00.000Z",
    updated_at: "2026-07-22T00:00:00.000Z",
    ...overrides,
  };
}

describe("slug and destination validation", () => {
  it("normalizes valid slugs", () => {
    expect(validateSlug("Menu-Board")).toEqual({ ok: true, slug: "menu-board" });
  });

  it("rejects duplicate-unsafe/reserved slugs before persistence", () => {
    expect(validateSlug("admin")).toMatchObject({ ok: false });
    expect(validateSlug("bad slug")).toMatchObject({ ok: false });
  });

  it("rejects unsafe destination schemes", () => {
    expect(validateDestinationUrl("javascript:alert(1)")).toMatchObject({ ok: false });
    expect(validateDestinationUrl("data:text/html,hi")).toMatchObject({ ok: false });
    expect(validateDestinationUrl("https://example.com")).toMatchObject({ ok: true });
  });

  it("requires reliable QR color contrast", () => {
    expect(contrastRatio("#111827", "#ffffff")).toBeGreaterThan(4.5);
  });
});

describe("authorization and plan policy", () => {
  it("enforces redirect ownership", () => {
    expect(userOwnsRedirect("user-1", redirectRecord())).toBe(true);
    expect(userOwnsRedirect("user-2", redirectRecord())).toBe(false);
  });

  it("enforces free plan active redirect limits server-side", () => {
    expect(canCreateActiveRedirect("free", 2)).toBe(true);
    expect(canCreateActiveRedirect("free", 3)).toBe(false);
  });

  it("separates admin and non-admin access", () => {
    expect(requireAdminRole("admin", "a@example.com", "")).toBe(true);
    expect(requireAdminRole("user", "owner@example.com", "owner@example.com")).toBe(true);
    expect(requireAdminRole("user", "nope@example.com", "owner@example.com")).toBe(false);
  });
});

describe("redirect resolution", () => {
  it("resolves active redirects", () => {
    expect(redirectState(redirectRecord())).toBe("active");
  });

  it("classifies paused, expired, suspended, and unknown redirects", () => {
    expect(redirectState(redirectRecord({ active: false }))).toBe("inactive");
    expect(redirectState(redirectRecord({ expires_at: "2026-01-01T00:00:00.000Z" }), new Date("2026-07-22T00:00:00.000Z"))).toBe("expired");
    expect(redirectState(redirectRecord({ suspended_at: "2026-07-22T00:00:00.000Z" }))).toBe("suspended");
    expect(redirectState(null)).toBe("unknown");
  });

  it("parses production path and wildcard subdomain slugs safely", () => {
    expect(parseRedirectRequest("go.veildaemon.app", "/menu")).toEqual({ type: "path", slug: "menu" });
    expect(parseRedirectRequest("menu.veildaemon.app", "/anything")).toEqual({ type: "subdomain", slug: "menu" });
    expect(parseRedirectRequest("app.veildaemon.app", "/pricing")).toEqual({ type: "none" });
    expect(parseRedirectRequest("deep.menu.veildaemon.app", "/")).toEqual({ type: "none" });
    expect(parseRedirectRequest("localhost:3000", "/dashboard")).toEqual({ type: "none" });
    expect(parseRedirectRequest("localhost:3000", "/r/menu")).toEqual({ type: "path", slug: "menu" });
  });
});

describe("analytics classification", () => {
  it("extracts non-invasive device basics", () => {
    const ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Version/17.0 Mobile/15E148 Safari/604.1";
    expect(deviceCategory(ua)).toBe("mobile");
    expect(browserFamily(ua)).toBe("Safari");
    expect(operatingSystem(ua)).toBe("iOS");
  });
});
