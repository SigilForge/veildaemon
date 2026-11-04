import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { bookOneClaimPath } from "@/lib/book-one";

describe("Book One re-download surface", () => {
  it("re-downloads go through the canonical claim with the stored session id", () => {
    expect(bookOneClaimPath("cs_live_a1/b")).toBe("/api/book-one/claim?session_id=cs_live_a1%2Fb");
  });

  it("/book-one lists the signed-in buyer's purchases and stops offering checkout once owned", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "app/book-one/page.tsx"), "utf8");
    expect(source).toMatch(/listBookOnePurchases\(supabase\)/);
    expect(source).toMatch(/Your Book One downloads/);
    expect(source).toMatch(/purchases\.length \? null : \(/);
  });
});
