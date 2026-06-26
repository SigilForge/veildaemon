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
  }

  render();
  window.addEventListener("veildaemon:handler-state-updated", renderSessionStrip);
  window.HandlerNav = { render, renderSessionStrip, renderNav };
}());