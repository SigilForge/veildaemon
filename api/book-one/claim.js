const EXPECTED_PRICE_ID = process.env.BOOK_ONE_STRIPE_PRICE_ID || "price_1TwE0oFht6uPr4mz4thEHLpN";
const DEFAULT_BUCKET = "paid-downloads";
const DEFAULT_PDF_PATH = "book-one/the-cradlepoint-archive-book-one-v47-2b-print-edition-verified.pdf";
const DEFAULT_EPUB_PATH = "book-one/the-cradlepoint-archive-book-one-v47-2b.epub";
const DEFAULT_MOBI_PATH = "book-one/the-cradlepoint-archive-book-one-v47-2b.mobi";
const DEFAULT_WALLPAPER_PATH = "book-one/book-one-wallpaper-pack.zip";
const DEFAULT_TTL_SECONDS = 900;

function sendHtml(res, statusCode, title, message) {
  res.statusCode = statusCode;
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(title)} | Cradlepoint Studio</title>
  <style>
    :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #070a0b; color: #f3eee5; }
    body { min-height: 100vh; display: grid; place-items: center; margin: 0; padding: 24px; }
    main { max-width: 560px; border: 1px solid rgba(243,238,229,.22); padding: 28px; background: rgba(17,24,23,.92); }
    h1 { margin: 0 0 12px; font-size: 1.5rem; line-height: 1.15; }
    p { margin: 0 0 18px; color: rgba(243,238,229,.78); line-height: 1.55; }
    a { color: #f4c56f; }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
    <a href="https://veildaemon.app/studio/shelf/book-one/">Return to Book One</a>
  </main>
</body>
</html>`);
}

function sendClaimPage(res, downloads) {
  const items = downloads.map((item) => {
    const note = item.note ? `<small>${escapeHtml(item.note)}</small>` : "";
    if (item.url) {
      return `<li class="ready">
        <div>
          <strong>${escapeHtml(item.label)}</strong>
          <span>${escapeHtml(item.filename)}</span>
          ${note}
        </div>
        <a class="dl" href="${escapeHtml(item.url)}">Download</a>
      </li>`;
    }
    return `<li class="pending">
      <div>
        <strong>${escapeHtml(item.label)}</strong>
        <span>${escapeHtml(item.filename)}</span>
        <small>${escapeHtml(item.note || "Not available yet.")}</small>
      </div>
    </li>`;
  }).join("\n");

  res.statusCode = 200;
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Book One downloads | Cradlepoint Studio</title>
  <style>
    :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #070a0b; color: #f3eee5; }
    body { min-height: 100vh; display: grid; place-items: center; margin: 0; padding: 24px; }
    main { width: min(640px, 100%); border: 1px solid rgba(243,238,229,.22); padding: 28px; background: rgba(17,24,23,.92); }
    h1 { margin: 0 0 10px; font-size: 1.55rem; line-height: 1.15; }
    p { margin: 0 0 18px; color: rgba(243,238,229,.78); line-height: 1.55; }
    ul { list-style: none; margin: 0 0 22px; padding: 0; display: grid; gap: 12px; }
    li { display: flex; gap: 14px; justify-content: space-between; align-items: center; border: 1px solid rgba(243,238,229,.16); padding: 14px 16px; background: rgba(8,12,12,.55); }
    li strong { display: block; margin-bottom: 4px; }
    li span, li small { display: block; color: rgba(243,238,229,.68); font-size: .9rem; line-height: 1.4; }
    li small { margin-top: 4px; color: rgba(243,238,229,.5); }
    li.pending { opacity: .72; }
    a { color: #f4c56f; }
    a.dl {
      flex: 0 0 auto;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 40px;
      padding: 0 14px;
      border: 1px solid rgba(244,197,111,.55);
      background: rgba(244,197,111,.12);
      color: #f4c56f;
      text-decoration: none;
      font-weight: 600;
      font-size: .92rem;
    }
    a.dl:hover { background: rgba(244,197,111,.2); }
    .foot { margin: 0; font-size: .92rem; }
  </style>
</head>
<body>
  <main>
    <h1>Book One files ready</h1>
    <p>Payment verified. Private links expire shortly — download both files now. Direct buyers keep access when the shelf receives updated editions.</p>
    <ul aria-label="Book One download files">
      ${items}
    </ul>
    <p class="foot"><a href="https://veildaemon.app/studio/shelf/book-one/">Return to Book One</a> · <a href="https://veildaemon.app/studio/shelf/digital/#wallpapers">Wallpaper previews</a></p>
  </main>
</body>
</html>`);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function queryFrom(req) {
  if (req.query) return req.query;
  return Object.fromEntries(new URL(req.url || "/", "https://api.veildaemon.app").searchParams);
}

function cleanCheckoutSessionId(value) {
  const sessionId = String(value || "").trim();
  return /^cs_(test|live)_[A-Za-z0-9_]+$/.test(sessionId) ? sessionId : "";
}

function storageBucket() {
  return process.env.BOOK_ONE_SUPABASE_BUCKET || DEFAULT_BUCKET;
}

function pdfObjectPath() {
  return (process.env.BOOK_ONE_SUPABASE_PATH || DEFAULT_PDF_PATH).replace(/^\/+/, "");
}

function epubObjectPath() {
  return (process.env.BOOK_ONE_EPUB_PATH || DEFAULT_EPUB_PATH).replace(/^\/+/, "");
}

function mobiObjectPath() {
  return (process.env.BOOK_ONE_MOBI_PATH || DEFAULT_MOBI_PATH).replace(/^\/+/, "");
}

function wallpaperObjectPath() {
  return (process.env.BOOK_ONE_WALLPAPER_PATH || DEFAULT_WALLPAPER_PATH).replace(/^\/+/, "");
}

function signedUrlTtlSeconds() {
  const ttl = Number(process.env.BOOK_ONE_SIGNED_URL_TTL_SECONDS || DEFAULT_TTL_SECONDS);
  if (!Number.isFinite(ttl)) return DEFAULT_TTL_SECONDS;
  return Math.min(Math.max(Math.trunc(ttl), 60), 3600);
}

function cleanUuid(value) {
  const uuid = String(value || "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid) ? uuid : null;
}

function encodedObjectPath(path) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function filenameFromPath(path) {
  const parts = String(path || "").split("/").filter(Boolean);
  return parts[parts.length - 1] || path;
}

async function stripeGet(path) {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    const error = new Error("Stripe verification is not configured.");
    error.statusCode = 503;
    throw error;
  }

  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: {
      Authorization: `Bearer ${secret}`,
    },
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(payload.error && payload.error.message ? payload.error.message : "Stripe verification failed.");
    error.statusCode = response.status;
    throw error;
  }

  return payload;
}

async function checkoutHasExpectedPrice(sessionId) {
  const lineItems = await stripeGet(`/checkout/sessions/${encodeURIComponent(sessionId)}/line_items?limit=20`);
  return Array.isArray(lineItems.data) && lineItems.data.some((item) => {
    const price = item.price || {};
    return price.id === EXPECTED_PRICE_ID;
  });
}

async function createSupabaseSignedUrl(objectPath) {
  const supabaseUrl = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const bucket = storageBucket();
  const path = String(objectPath || "").replace(/^\/+/, "");

  if (!supabaseUrl || !serviceRoleKey) {
    const error = new Error("Private download storage is not configured.");
    error.statusCode = 503;
    throw error;
  }

  if (!path) {
    const error = new Error("Private download path is not configured.");
    error.statusCode = 503;
    throw error;
  }

  const response = await fetch(`${supabaseUrl}/storage/v1/object/sign/${encodeURIComponent(bucket)}/${encodedObjectPath(path)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      apikey: serviceRoleKey,
    },
    body: JSON.stringify({
      expiresIn: signedUrlTtlSeconds(),
    }),
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(payload.message || payload.error || "Private download link could not be created.");
    error.statusCode = response.status;
    throw error;
  }

  const signedUrl = payload.signedURL || payload.signedUrl || payload.signed_url;
  if (!signedUrl) {
    const error = new Error("Private download link response was incomplete.");
    error.statusCode = 502;
    throw error;
  }

  const signedPath = signedUrl.startsWith("/object/") ? `/storage/v1${signedUrl}` : signedUrl;
  const absoluteSignedUrl = signedPath.startsWith("http") ? signedPath : `${supabaseUrl}${signedPath}`;
  const downloadUrl = new URL(absoluteSignedUrl);
  downloadUrl.searchParams.set("download", "");
  return downloadUrl.toString();
}

async function callSupabaseRpc(functionName, payload) {
  const supabaseUrl = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!supabaseUrl || !serviceRoleKey) {
    const error = new Error("Purchase ledger is not configured.");
    error.statusCode = 503;
    throw error;
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${functionName}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      apikey: serviceRoleKey,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    const error = new Error(errorPayload.message || errorPayload.error || "Purchase ledger could not be updated.");
    error.statusCode = response.status;
    throw error;
  }

  return response.json().catch(() => null);
}

async function upsertPurchaseEntitlement(session) {
  const customerEmail = session.customer_details && session.customer_details.email
    ? session.customer_details.email
    : session.customer_email || "";
  const payload = {
    session_id_input: session.id,
    stripe_customer_id_input: session.customer ? String(session.customer) : "",
    customer_email_input: customerEmail,
    amount_total_input: Number.isInteger(session.amount_total) ? session.amount_total : null,
    currency_input: session.currency || "usd",
    payment_status_input: session.payment_status || "",
    price_id_input: EXPECTED_PRICE_ID,
    purchased_at_input: session.created ? new Date(session.created * 1000).toISOString() : null,
    storage_bucket_input: storageBucket(),
    storage_path_input: pdfObjectPath(),
    auth_user_id_input: cleanUuid(session.metadata && session.metadata.user_id),
  };

  return callSupabaseRpc("upsert_book_one_purchase_entitlement", payload);
}

async function recordPurchaseClaim(purchaseId) {
  await callSupabaseRpc("record_book_one_purchase_claim", {
    purchase_id_input: purchaseId,
  });
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "GET, OPTIONS");
    res.statusCode = 204;
    return res.end();
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendHtml(res, 405, "Claim route rejected", "This download claim only accepts a completed Stripe checkout redirect.");
  }

  const sessionId = cleanCheckoutSessionId(queryFrom(req).session_id);
  if (!sessionId) {
    return sendHtml(res, 400, "Checkout session missing", "The download claim needs a completed Stripe checkout session before a private file can be issued.");
  }

  try {
    const session = await stripeGet(`/checkout/sessions/${encodeURIComponent(sessionId)}`);
    if (session.payment_status !== "paid") {
      return sendHtml(res, 402, "Payment not verified", "Stripe has not marked this checkout session as paid.");
    }

    const hasExpectedPrice = await checkoutHasExpectedPrice(sessionId);
    if (!hasExpectedPrice) {
      return sendHtml(res, 403, "Shelf item mismatch", "This checkout session does not match the Book One digital edition.");
    }

    const purchaseId = await upsertPurchaseEntitlement(session);

    const pdfPath = pdfObjectPath();
    const epubPath = epubObjectPath();
    const mobiPath = mobiObjectPath();
    const wallpaperPath = wallpaperObjectPath();

    // PDF is primary. EPUB, MOBI, and Wallpaper pack are included when present in private storage.
    const pdfUrl = await createSupabaseSignedUrl(pdfPath);

    let epubUrl = "";
    let epubNote = "Reflowable digital ebook edition";
    try {
      epubUrl = await createSupabaseSignedUrl(epubPath);
    } catch {
      epubNote = "EPUB edition rebuild pending staging.";
    }

    let mobiUrl = "";
    let mobiNote = "Kindle digital ebook edition";
    try {
      mobiUrl = await createSupabaseSignedUrl(mobiPath);
    } catch {
      mobiNote = "MOBI edition rebuild pending staging.";
    }

    let wallpaperUrl = "";
    let wallpaperNote = "10 plates · clean + title · PNG pack";
    try {
      wallpaperUrl = await createSupabaseSignedUrl(wallpaperPath);
    } catch {
      wallpaperNote = "Wallpaper pack is not staged in private storage yet. PDF is still available.";
    }

    await recordPurchaseClaim(purchaseId);

    const downloads = [
      {
        label: "PDF",
        filename: filenameFromPath(pdfPath),
        url: pdfUrl,
        note: "Verified print edition · DRM-free",
      },
      {
        label: "EPUB",
        filename: filenameFromPath(epubPath),
        url: epubUrl,
        note: epubNote,
      },
      {
        label: "MOBI",
        filename: filenameFromPath(mobiPath),
        url: mobiUrl,
        note: mobiNote,
      },
      {
        label: "Wallpapers",
        filename: filenameFromPath(wallpaperPath),
        url: wallpaperUrl,
        note: wallpaperNote,
      },
    ];

    return sendClaimPage(res, downloads);
  } catch (error) {
    const statusCode = error.statusCode && error.statusCode >= 400 && error.statusCode < 600 ? error.statusCode : 500;
    return sendHtml(res, statusCode, "Download claim unavailable", "The private download could not be issued yet. Purchase records remain with Stripe.");
  }
};
