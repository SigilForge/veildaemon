(function (global) {
  "use strict";

  if (global.VeilAuth) return;

  const STORAGE_CONFIG_KEY = "veildaemon_supabase_config_v1";
  const SUPABASE_CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js";

  let clientInstance = null;
  let currentSession = null;
  let currentUser = null;
  let initPromise = null;
  const listeners = new Set();

  function getSavedConfig() {
    try {
      const raw = localStorage.getItem(STORAGE_CONFIG_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return null;
  }

  function saveConfig(cfg) {
    try {
      if (cfg && cfg.supabaseUrl && cfg.supabaseAnonKey) {
        localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(cfg));
      }
    } catch (_) {}
  }

  let lastInitError = null;

  async function tryFetchEndpoint(url) {
    try {
      const res = await fetch(url, { credentials: "omit" });
      if (res.ok) {
        const text = await res.text();
        try {
          const data = JSON.parse(text);
          if (data && data.ok && data.supabaseUrl && data.supabaseAnonKey) {
            return data;
          }
        } catch (_) {}
      }
    } catch (_) {}
    return null;
  }

  async function fetchConfig() {
    if (global.VEILDAEMON_SUPABASE_URL && global.VEILDAEMON_SUPABASE_ANON_KEY) {
      return {
        supabaseUrl: global.VEILDAEMON_SUPABASE_URL,
        supabaseAnonKey: global.VEILDAEMON_SUPABASE_ANON_KEY
      };
    }

    const saved = getSavedConfig();
    if (saved && saved.supabaseUrl && saved.supabaseAnonKey) {
      setTimeout(() => {
        tryFetchEndpoint("/api/auth/config").then((fresh) => {
          if (!fresh) {
            tryFetchEndpoint("https://api.veildaemon.app/api/auth/config").then((f2) => {
              if (f2) saveConfig(f2);
            });
          } else {
            saveConfig(fresh);
          }
        });
      }, 1000);
      return saved;
    }

    const endpoints = [
      "/api/auth/config",
      "https://api.veildaemon.app/api/auth/config",
      "https://go.veildaemon.app/api/auth/config"
    ];

    for (const ep of endpoints) {
      const data = await tryFetchEndpoint(ep);
      if (data) {
        saveConfig(data);
        return data;
      }
    }

    lastInitError = "Supabase Auth is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel.";
    return null;
  }

  function loadSupabaseSDK() {
    if (global.supabase && global.supabase.createClient) {
      return Promise.resolve(global.supabase);
    }
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${SUPABASE_CDN}"]`);
      if (existing) {
        existing.addEventListener("load", () => resolve(global.supabase));
        existing.addEventListener("error", () => reject(new Error("Failed to load Supabase SDK")));
        return;
      }
      const script = document.createElement("script");
      script.src = SUPABASE_CDN;
      script.async = true;
      script.onload = () => resolve(global.supabase);
      script.onerror = () => reject(new Error("Failed to load Supabase SDK"));
      document.head.appendChild(script);
    });
  }

  async function init() {
    if (initPromise) return initPromise;

    initPromise = (async () => {
      try {
        const config = await fetchConfig();
        if (!config || !config.supabaseUrl || !config.supabaseAnonKey) {
          return null;
        }

        const supabaseSDK = await loadSupabaseSDK();
        if (!supabaseSDK || !supabaseSDK.createClient) {
          lastInitError = "Failed to load Supabase SDK.";
          return null;
        }

        if (!clientInstance) {
          clientInstance = supabaseSDK.createClient(config.supabaseUrl, config.supabaseAnonKey, {
            auth: {
              persistSession: true,
              autoRefreshToken: true,
              detectSessionInUrl: true,
            },
          });

          const { data } = await clientInstance.auth.getSession();
          currentSession = data.session;
          currentUser = data.session ? data.session.user : null;

          clientInstance.auth.onAuthStateChange((event, session) => {
            currentSession = session;
            currentUser = session ? session.user : null;
            notifyListeners(event, session);
            syncCookie(session);
          });
        }

        return clientInstance;
      } catch (err) {
        console.warn("[VeilAuth] Initialization warning:", err.message || err);
        return null;
      }
    })();

    return initPromise;
  }

  function syncCookie(session) {
    try {
      if (session && session.access_token) {
        document.cookie = `sb-access-token=${session.access_token}; path=/; max-age=604800; SameSite=Lax`;
      } else {
        document.cookie = `sb-access-token=; path=/; max-age=0; SameSite=Lax`;
      }
    } catch (_) {}
  }

  function notifyListeners(event, session) {
    listeners.forEach((fn) => {
      try {
        fn(event, session);
      } catch (e) {
        console.error("[VeilAuth] Listener error:", e);
      }
    });
    window.dispatchEvent(
      new CustomEvent("veildaemon:auth-changed", {
        detail: { event, session, user: session ? session.user : null },
      })
    );
  }

  async function signInWithPassword(email, password) {
    const client = await init();
    if (!client) throw new Error(lastInitError || "Auth system unavailable. Could not connect to Supabase Auth service.");
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async function signUp(email, password) {
    const client = await init();
    if (!client) throw new Error(lastInitError || "Auth system unavailable. Could not connect to Supabase Auth service.");
    const { data, error } = await client.auth.signUp({ email, password });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    if (!clientInstance) return;
    const { error } = await clientInstance.auth.signOut();
    if (error) console.warn("[VeilAuth] Sign out warning:", error.message);
    currentSession = null;
    currentUser = null;
    notifyListeners("SIGNED_OUT", null);
  }

  function getSession() {
    return currentSession;
  }

  function getUser() {
    return currentUser;
  }

  function onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function renderModalHTML() {
    return `
      <div class="veil-auth-modal-backdrop" id="veil-auth-modal" hidden>
        <div class="veil-auth-modal-card">
          <div class="veil-auth-modal-header">
            <div>
              <p class="kicker">VEILDAEMON // AUTHENTICATION</p>
              <h3>OPERATOR / HANDLER LOG IN</h3>
            </div>
            <button class="button ghost" type="button" id="veil-auth-modal-close">×</button>
          </div>
          <form class="veil-auth-modal-form" id="veil-auth-form">
            <p class="veil-auth-notice" id="veil-auth-notice">Sign in to maintain session across devices and preserve your identity tier.</p>
            <label>Email
              <input type="email" id="veil-auth-email" required placeholder="operator@veildaemon.app" autocomplete="email" />
            </label>
            <label>Password
              <input type="password" id="veil-auth-password" required minlength="8" placeholder="••••••••" autocomplete="current-password" />
            </label>
            <div class="veil-auth-actions">
              <button class="button primary" type="submit" id="veil-auth-submit">Log In</button>
              <button class="button" type="button" id="veil-auth-signup">Create Account</button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  function ensureModal() {
    if (document.getElementById("veil-auth-modal")) return;
    const container = document.createElement("div");
    container.innerHTML = renderModalHTML();
    document.body.appendChild(container.firstElementChild);

    const modal = document.getElementById("veil-auth-modal");
    const closeBtn = document.getElementById("veil-auth-modal-close");
    const form = document.getElementById("veil-auth-form");
    const emailEl = document.getElementById("veil-auth-email");
    const passEl = document.getElementById("veil-auth-password");
    const noticeEl = document.getElementById("veil-auth-notice");
    const signupBtn = document.getElementById("veil-auth-signup");

    closeBtn.addEventListener("click", () => {
      modal.hidden = true;
    });

    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.hidden = true;
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      noticeEl.textContent = "Authenticating operator session...";
      noticeEl.style.color = "var(--text-soft, #a0aec0)";
      try {
        await signInWithPassword(emailEl.value, passEl.value);
        noticeEl.textContent = "Authenticated successfully.";
        noticeEl.style.color = "#48bb78";
        setTimeout(() => {
          modal.hidden = true;
        }, 500);
      } catch (err) {
        noticeEl.textContent = err.message || "Authentication failed.";
        noticeEl.style.color = "#f56565";
      }
    });

    signupBtn.addEventListener("click", async () => {
      if (!emailEl.value || !passEl.value) {
        noticeEl.textContent = "Please enter an email and password first.";
        noticeEl.style.color = "#f56565";
        return;
      }
      noticeEl.textContent = "Creating account...";
      noticeEl.style.color = "var(--text-soft, #a0aec0)";
      try {
        await signUp(emailEl.value, passEl.value);
        noticeEl.textContent = "Account created! Check email if confirmation is required.";
        noticeEl.style.color = "#48bb78";
      } catch (err) {
        noticeEl.textContent = err.message || "Registration failed.";
        noticeEl.style.color = "#f56565";
      }
    });
  }

  function showModal() {
    ensureModal();
    const modal = document.getElementById("veil-auth-modal");
    if (modal) modal.hidden = false;
  }

  function mountAuthWidget(container) {
    if (!container) return;

    function render() {
      const session = getSession();
      const user = getUser();

      container.classList.add("veil-auth-widget");
      if (session && user) {
        container.innerHTML = `
          <div class="veil-auth-status is-authenticated">
            <span class="auth-dot active"></span>
            <span class="auth-label">AUTHENTICATED</span>
            <strong class="auth-user">${escapeHTML(user.email || "Operator")}</strong>
            <button type="button" class="button ghost compact" id="veil-auth-logout-btn">Log Out</button>
          </div>
        `;
        const logoutBtn = container.querySelector("#veil-auth-logout-btn");
        if (logoutBtn) logoutBtn.addEventListener("click", () => signOut());
      } else {
        container.innerHTML = `
          <div class="veil-auth-status is-local">
            <span class="auth-dot local"></span>
            <span class="auth-label">LOCAL RECORD</span>
            <button type="button" class="button compact primary" id="veil-auth-login-btn">Log In</button>
          </div>
        `;
        const loginBtn = container.querySelector("#veil-auth-login-btn");
        if (loginBtn) loginBtn.addEventListener("click", () => showModal());
      }
    }

    render();
    onChange(() => render());
  }

  function escapeHTML(str) {
    return String(str || "").replace(/[&<>"']/g, (m) => {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m];
    });
  }

  // Inject CSS for Auth Widget & Modal
  function injectStyles() {
    if (document.getElementById("veil-auth-styles")) return;
    const style = document.createElement("style");
    style.id = "veil-auth-styles";
    style.textContent = `
      .veil-auth-status {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        font-family: monospace, monospace;
        font-size: 0.75rem;
        padding: 0.25rem 0.6rem;
        border-radius: 4px;
        background: rgba(15, 23, 42, 0.8);
        border: 1px solid rgba(255, 255, 255, 0.12);
        color: #e2e8f0;
      }
      .veil-auth-status .auth-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        display: inline-block;
      }
      .veil-auth-status .auth-dot.active {
        background: #38bdf8;
        box-shadow: 0 0 8px rgba(56, 189, 248, 0.8);
      }
      .veil-auth-status .auth-dot.local {
        background: #a855f7;
        box-shadow: 0 0 6px rgba(168, 85, 247, 0.6);
      }
      .veil-auth-status .auth-label {
        font-weight: 700;
        letter-spacing: 0.05em;
        color: #94a3b8;
      }
      .veil-auth-status .auth-user {
        color: #f8fafc;
        max-width: 140px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .veil-auth-status button.compact {
        padding: 0.15rem 0.45rem;
        font-size: 0.7rem;
        min-height: auto;
      }
      .veil-auth-modal-backdrop {
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0, 0, 0, 0.75);
        backdrop-filter: blur(4px);
        z-index: 99999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem;
      }
      .veil-auth-modal-backdrop[hidden] {
        display: none !important;
      }
      .veil-auth-modal-card {
        background: #0f172a;
        border: 1px solid rgba(56, 189, 248, 0.3);
        border-radius: 8px;
        width: 100%;
        max-width: 420px;
        padding: 1.5rem;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 0 30px rgba(56, 189, 248, 0.15);
        color: #f8fafc;
        font-family: inherit;
      }
      .veil-auth-modal-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 1rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        padding-bottom: 0.75rem;
      }
      .veil-auth-modal-header .kicker {
        font-size: 0.7rem;
        letter-spacing: 0.1em;
        color: #38bdf8;
        margin: 0;
      }
      .veil-auth-modal-header h3 {
        margin: 0.2rem 0 0 0;
        font-size: 1.1rem;
        font-weight: 700;
        color: #fff;
      }
      .veil-auth-modal-form label {
        display: block;
        margin-bottom: 1rem;
        font-size: 0.85rem;
        color: #cbd5e1;
      }
      .veil-auth-modal-form input {
        width: 100%;
        margin-top: 0.35rem;
        padding: 0.5rem 0.75rem;
        background: #020617;
        border: 1px solid #334155;
        border-radius: 4px;
        color: #fff;
        font-family: inherit;
        box-sizing: border-box;
      }
      .veil-auth-modal-form input:focus {
        outline: none;
        border-color: #38bdf8;
        box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.2);
      }
      .veil-auth-notice {
        font-size: 0.8rem;
        color: #94a3b8;
        margin-bottom: 1rem;
        line-height: 1.4;
      }
      .veil-auth-actions {
        display: flex;
        gap: 0.75rem;
        margin-top: 1.25rem;
      }
      .veil-auth-actions button {
        flex: 1;
      }
    `;
    document.head.appendChild(style);
  }

  // Auto-init on DOMReady
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      injectStyles();
      init();
    });
  } else {
    injectStyles();
    init();
  }

  global.VeilAuth = {
    init,
    signInWithPassword,
    signUp,
    signOut,
    getSession,
    getUser,
    onChange,
    mountAuthWidget,
    showModal,
  };
})(typeof window !== "undefined" ? window : this);
