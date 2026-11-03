// Cloudflare Pages front for app.veildaemon.app.
// Workers custom domains need the zone active on Cloudflare, but Porkbun
// stays DNS authority; Pages accepts an external CNAME. This forwards every
// request unchanged (same URL, host, method, headers, body) to the
// veillink-app Worker over the APP service binding.
//
// One exception: /api/book-one/claim runs the canonical
// api/book-one/claim.js here, so the paid Book One download claim leaves
// Vercel without a second copy of its logic (the Book One release scripts
// edit and verify that file). Supabase Edge Functions cannot serve its HTML
// download page, so it runs on Cloudflare with Supabase as storage/ledger.
import claimHandler from "../../../api/book-one/claim.js";

const CLAIM_PATH = "/api/book-one/claim";

// Minimal Node-style (req, res) adapter for the Vercel handler signature.
async function runNodeHandler(handler, request) {
  const url = new URL(request.url);
  const req = {
    method: request.method,
    url: url.pathname + url.search,
    query: Object.fromEntries(url.searchParams),
    headers: Object.fromEntries(request.headers),
  };
  return new Promise((resolve, reject) => {
    const headers = new Headers();
    const res = {
      statusCode: 200,
      setHeader(name, value) {
        headers.set(name, String(value));
      },
      end(body) {
        resolve(new Response(body ?? null, { status: res.statusCode, headers }));
      },
    };
    Promise.resolve(handler(req, res)).catch(reject);
  });
}

export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname === CLAIM_PATH) {
      return runNodeHandler(claimHandler, request);
    }
    if (!env.APP) return new Response("App unavailable.", { status: 503 });
    return env.APP.fetch(request);
  },
};
