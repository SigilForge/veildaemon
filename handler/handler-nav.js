(function () {
  const api = window.HandlerState;

  const ROUTES = [
    { key: "overview", label: "Overview", segment: "" },
    { key: "live", label: "Live", segment: "live" },
    { key: "cases", label: "Cases", segment: "cases" },
    { key: "clocks", label: "Clocks", segment: "clocks" },
    { key: "entities", label: "Entities", segment: "entities" },
    { key: "npcs", label: "NPCs", segment: "npcs" },
    { key: "operators", label: "Operators", segment: "operators" },
    { key: "residue", label: "Residue", segment: "residue" },
    { key: "player-view", label: "Player View", segment: "player-view" }
  ];

  function currentModuleKey() {
    if (document.body.classList.contains("overview-surface")) return "overview";
    if (document.body.classList.contains("live-surface")) return "live";
    return document.body.dataset.handlerModule || "overview";
  }

  function pageDepth() {
    if (document.body.classList.contains("overview-surface")) return "overview";
    if (document.body.classList.contains("live-surface")) return "live";
    return "module";
  }

  function hrefFor(segment) {
    const depth = pageDepth();
    if (depth === "overview") return segment ? `./${segment}/` : "./";
    if (depth === "live") {
      if (!segment) return "../";
      if (segment === "live") return "./";
      return `../${segment}/`;
    }
    if (!segment) return "../";
    if (segment === "live") return "../live/";
    if (segment === document.body.dataset.handlerModule) return "./";
    return `../${segment}/`;
  }

  function mountPoint() {
    return document.getElementById("handler-module-nav-mount")
      || document.querySelector(".handler-shell .status-strip");
  }

  function ensureChrome() {
    const anchor = mountPoint();
    if (!anchor) return { nav: null, strip: null };

    let nav = document.getElementById("handler-module-nav");
    let strip = document.getElementById("handler-session-strip");

    if (!nav) {
      nav = document.createElement("nav");
      nav.id = "handler-module-nav";
      nav.className = "handler-module-nav no-print";
      nav.setAttribute("aria-label", "Handler modules");
      anchor.insertAdjacentElement("afterend", nav);
    }

    if (!strip) {
      strip = document.createElement("section");
      strip.id = "handler-session-strip";
      strip.className = "handler-session-strip no-print";
      strip.setAttribute("aria-label", "Active case context");
      nav.insertAdjacentElement("afterend", strip);
    }

    return { nav, strip };
  }

  function renderNav() {
    const { nav } = ensureChrome();
    if (!nav) return;

    const active = currentModuleKey();
    nav.textContent = "";

    ROUTES.forEach((route) => {
      const link = document.createElement("a");
      link.className = "module-link";
      link.href = hrefFor(route.segment);
      link.textContent = route.label;
      if (route.key === active) link.classList.add("is-active");
      link.setAttribute("aria-current", route.key === active ? "page" : "false");
      nav.append(link);
    });

    const home = document.createElement("a");
    home.className = "module-link module-link-home";
    home.href = pageDepth() === "overview" ? "../" : "../../";
    home.textContent = "Home";
    nav.append(home);
  }

  function ensureFieldLockBar() {
    const anchor = document.getElementById("handler-session-strip")
      || document.getElementById("handler-module-nav")
      || mountPoint();
    if (!anchor) return null;

    let bar = document.getElementById("handler-field-lock-bar");
    if (!bar) {
      bar = document.createElement("section");
      bar.id = "handler-field-lock-bar";
      bar.className = "handler-field-lock-bar no-print";
      bar.setAttribute("aria-label", "Field edit lock");
      bar.innerHTML = `
        <p class="handler-field-lock-status" data-handler-field-lock-status>Live play: typing locked. Triggers, clocks, and rolls stay active.</p>
        <button class="button field-edit-toggle" type="button" data-handler-field-edit-toggle aria-pressed="false">Edit Fields: Off</button>
      `;
      anchor.insertAdjacentElement("afterend", bar);
      const toggle = bar.querySelector("[data-handler-field-edit-toggle]");
      if (toggle) {
        toggle.addEventListener("click", () => {
          const next = api.toggleFieldEditMode(api.readState());
          api.writeState(next);
          renderFieldLock();
        });
      }
    }
    return bar;
  }

  function renderFieldLock() {
    if (!api) return;
    const state = api.readState();
    const unlocked = api.fieldEditUnlocked(state);
    document.body.classList.toggle("is-field-edit", unlocked);
    ensureFieldLockBar();
    document.querySelectorAll("[data-handler-field-edit-toggle]").forEach((toggle) => {
      toggle.textContent = unlocked ? "Edit Fields: On" : "Edit Fields: Off";
      toggle.setAttribute("aria-pressed", unlocked ? "true" : "false");
      toggle.classList.toggle("primary", unlocked);
    });
    document.querySelectorAll("[data-handler-field-lock-status]").forEach((node) => {
      node.textContent = unlocked
        ? "Prep mode: form fields unlocked for typing."
        : "Live play: typing locked. Triggers, clocks, and rolls stay active.";
    });
  }

  function renderSessionStrip() {
    const { strip } = ensureChrome();
    if (!strip || !api) return;

    const state = api.readState();
    const needlepoint = state.activeNeedlepoint?.id
      ? api.safeString(state.activeNeedlepoint.id, 80)
      : "Manual / no scaffold";

    const rows = [
      ["Case", state.session.caseTitle || "No case loaded"],
      ["Attention", state.attention.current || "Unseen"],
      ["Clock", api.publicClockLabel(state)],
      ["Needlepoint", needlepoint]
    ];

    strip.textContent = "";
    rows.forEach(([label, value]) => {
      const cell = document.createElement("div");
      const title = document.createElement("span");
      title.textContent = label;
      const strong = document.createElement("strong");
      strong.textContent = api.safeString(value, 140) || "Unset";
      cell.append(title, strong);
      strip.append(cell);
    });
  }

  function render() {
    renderNav();
    renderSessionStrip();
    renderFieldLock();
  }

  render();
  window.addEventListener("veildaemon:handler-state-updated", () => {
    renderSessionStrip();
    renderFieldLock();
  });
  window.HandlerNav = { render, renderSessionStrip, renderNav, renderFieldLock };
}());