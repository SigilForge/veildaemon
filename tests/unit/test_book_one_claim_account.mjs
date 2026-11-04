/**
 * Book One claim delivers files only to purchases bound to a VeilLink account.
 * Run: node --test tests/unit/test_book_one_claim_account.mjs
 *
 * No network: Stripe, Supabase REST/RPC and Storage are a faked global fetch.
 */
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const PRICE = "price_1TwE0oFht6uPr4mz4thEHLpN";

function fakeEnvironment({ accountId }) {
  const calls = [];
  globalThis.fetch = async (url) => {
    const href = String(url);
    calls.push(href);
    const json = (body) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
    if (href.includes("/line_items")) return json({ data: [{ price: { id: PRICE } }] });
    if (href.includes("api.stripe.com/v1/checkout/sessions/")) {
      return json({ id: "cs_live_test", payment_status: "paid", customer_details: { email: "buyer@example.com" }, metadata: {} });
    }
    if (href.includes("/rpc/upsert_book_one_purchase_entitlement")) return json("11111111-1111-4111-8111-111111111111");
    if (href.includes("/rest/v1/book_one_purchases")) return json([{ auth_user_id: accountId }]);
    if (href.includes("/rpc/record_book_one_purchase_claim")) return json(null);
    if (href.includes("/storage/v1/object/sign/")) return json({ signedURL: "/object/sign/paid-downloads/x?token=t" });
    throw new Error(`unexpected fetch ${href}`);
  };
  return calls;
}

async function claim() {
  const handler = require("../../api/book-one/claim.js");
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      headers: {},
      setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
      end(body) { resolve({ status: this.statusCode, body: String(body || "") }); },
    };
    handler({ method: "GET", query: { session_id: "cs_live_test" }, url: "/api/book-one/claim?session_id=cs_live_test" }, res);
  });
}

describe("Book One claim account binding", () => {
  const original = { fetch: globalThis.fetch, env: { ...process.env } };
  beforeEach(() => {
    Object.assign(process.env, {
      STRIPE_SECRET_KEY: "sk_test_fake",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-fake",
    });
  });
  afterEach(() => {
    globalThis.fetch = original.fetch;
    process.env = { ...original.env };
  });

  it("a paid purchase with no account gets a sign-in page and no download links", async () => {
    const calls = fakeEnvironment({ accountId: null });
    const { status, body } = await claim();
    assert.equal(status, 200);
    assert.match(body, /Payment verified for buyer@example\.com/);
    assert.match(body, /signup\?next=%2Fbook-one/);
    assert.equal(calls.some((href) => href.includes("/storage/v1/object/sign/")), false);
    assert.equal(calls.some((href) => href.includes("record_book_one_purchase_claim")), false);
  });

  it("a purchase bound to an account gets its download page", async () => {
    const calls = fakeEnvironment({ accountId: "22222222-2222-4222-8222-222222222222" });
    const { status, body } = await claim();
    assert.equal(status, 200);
    assert.match(body, /Book One files ready/);
    assert.ok(calls.some((href) => href.includes("/storage/v1/object/sign/")));
    assert.ok(calls.some((href) => href.includes("record_book_one_purchase_claim")));
  });
});
