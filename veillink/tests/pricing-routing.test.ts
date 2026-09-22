import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("pricing namespace: umbrella vs product-specific", () => {
  it("/pricing is the SigilForge-wide catalog, not QR-only", () => {
    const source = readSource("app/pricing/page.tsx");
    // Every product family is represented.
    expect(source).toMatch(/Book One/);
    expect(source).toMatch(/Creator Rights/);
    expect(source).toMatch(/QR/);
    expect(source).toMatch(/Web Design/);
    // The detailed QR plan comparison table lives at /links/pricing now, not here.
    expect(source).not.toMatch(/Wildcard subdomain links/);
    expect(source).not.toMatch(/Plain-English limits for dynamic redirects/);
  });

  it("/pricing reuses the shared QR plans config and Creator Rights constants instead of hardcoding their numbers", () => {
    const source = readSource("app/pricing/page.tsx");
    expect(source).toMatch(/from "@\/lib\/config"/);
    expect(source).toMatch(/\bplans\b/);
    expect(source).toMatch(/RIGHTS_PRICE_CENTS/);
    expect(source).toMatch(/RIGHTS_PRICE_LABEL/);
  });

  it("/links/pricing contains the detailed QR plan comparison", () => {
    const source = readSource("app/links/pricing/page.tsx");
    expect(source).toMatch(/Wildcard subdomain links/);
    expect(source).toMatch(/Plain-English limits for dynamic redirects/);
    expect(source).toMatch(/from "@\/lib\/config"/);
    expect(source).toMatch(/\bplans\b/);
  });

  it("QR & Links CTAs on /links route to /links/pricing, not the global /pricing", () => {
    const source = readSource("app/links/page.tsx");
    expect(source).not.toMatch(/href="\/pricing"/);
    const matches = source.match(/href="\/links\/pricing"/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it("the portal's QR & Links pricing CTA routes to /links/pricing", () => {
    const source = readSource("app/page.tsx");
    expect(source).toMatch(/href="\/links\/pricing"/);
  });

  it("global nav Pricing link continues to route to /pricing", () => {
    const source = readSource("app/layout.tsx");
    const navMatches = source.match(/<Link href="\/pricing">Pricing<\/Link>/g) || [];
    expect(navMatches.length).toBeGreaterThanOrEqual(1);
  });

  it("structured data for QR plans points at /links/pricing, not /pricing", () => {
    const source = readSource("lib/seo.ts");
    expect(source).not.toMatch(/absoluteUrl\("\/pricing"\)/);
    expect(source).toMatch(/absoluteUrl\("\/links\/pricing"\)/);
  });

  it("product-specific checkout/auth entry points are untouched", () => {
    // Book One purchase flow still posts to its own checkout endpoint.
    expect(readSource("app/book-one/page.tsx")).toMatch(/\/api\/book-one\/checkout/);
    // Creator Rights create flow is still the authoritative path.
    expect(readSource("app/pricing/page.tsx")).toMatch(/RIGHTS_PRODUCT_CREATE_PATH/);
    // QR signup CTAs still land users on their own dashboard, not the umbrella hub.
    expect(readSource("app/links/page.tsx")).toMatch(/next=%2Fdashboard/);
  });
});
