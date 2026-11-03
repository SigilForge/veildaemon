// Cloudflare Pages front for app.veildaemon.app.
// Workers custom domains need the zone active on Cloudflare, but Porkbun
// stays DNS authority; Pages accepts an external CNAME. This forwards every
// request unchanged (same URL, host, method, headers, body) to the
// veillink-app Worker over the APP service binding.
export default {
  async fetch(request, env) {
    if (!env.APP) return new Response("App unavailable.", { status: 503 });
    return env.APP.fetch(request);
  },
};
