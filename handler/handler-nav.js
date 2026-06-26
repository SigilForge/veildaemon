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
        <p class="handler-field-lock-status" data-handler-field-lock-status>Live play: scaffold fields locked. Notes and Stability/Harm stay editable. Only this button changes the lock.</p>
        <button class="button field-edit-toggle" type="button" data-handler-field-edit-toggle aria-pressed="false">Edit Fields: Off</button>
      `;
      anchor.insertAdjacentElement("afterend", bar);
      const toggle = bar.querySelector("[data-handler-field-edit-toggle]");
      if (toggle) {
        toggle.addEventListener("click", () => {
          api.toggleFieldEditMode();
          renderFieldLock();
        });
      }
    }
    return bar;
  }

  function fieldEditSafe(el) {
    if (!el || el.matches("[type='button'], [type='file'], [type='checkbox'], [type='radio']")) return false;
    if (el.hasAttribute("data-live-control") || el.closest("[data-live-control-zone]")) return true;

    const name = el.getAttribute("name") || "";
    const dataField = el.getAttribute("data-field") || "";

    if (dataField === "stability" || dataField === "harm" || dataField === "notes") return true;
    if (el.hasAttribute("data-residue") || el.hasAttribute("data-entity-notes")) return true;
    if (name === "attention.current") return true;
    if (/^handlerNotes\./.test(name)) return true;
    if (name === "caseFile.notes" || name === "caseFile.nextClue" || name === "caseFile.nextPressureBeat") return true;
    if (name === "unresolvedConsequences" || name === "activeEntity.notes" || name === "note") return true;
    if (name === "attention.residue" || name === "attention.followsHome") return true;
    return false;
  }

  function applyFieldEditLock() {
    const unlocked = api.fieldEditUnlocked();
    document.querySelectorAll(".handler-shell input, .handler-shell textarea, .handler-shell select").forEach((el) => {
      if (el.matches("[type='button'], [type='file']")) return;
      const safe = fieldEditSafe(el);
      const editable = unlocked || safe;
      el.toggleAttribute("data-field-edit-safe", safe);
      el.classList.toggle("is-field-locked", !editable);
      if (el.tagName === "SELECT" || el.type === "checkbox" || el.type === "radio") {
        el.disabled = !editable;
        return;
      }
      el.readOnly = !editable;
    });
  }

  function renderFieldLock() {
    if (!api) return;
    const unlocked = api.fieldEditUnlocked();
    document.body.classList.toggle("is-field-edit", unlocked);
    ensureFieldLockBar();
    applyFieldEditLock();
    document.querySelectorAll("[data-handler-field-edit-toggle]").forEach((toggle) => {
      toggle.textContent = unlocked ? "Edit Fields: On" : "Edit Fields: Off";
      toggle.setAttribute("aria-pressed", unlocked ? "true" : "false");
      toggle.classList.toggle("primary", unlocked);
    });
    document.querySelectorAll("[data-handler-field-lock-status]").forEach((node) => {
      node.textContent = unlocked
        ? "Prep mode: scaffold and case fields unlocked for typing."
        : "Live play: scaffold fields locked. Notes and Stability/Harm stay editable. Only this button changes the lock.";
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
  window.addEventListener("veildaemon:handler-field-edit-toggled", renderFieldLock);
  window.HandlerNav = { render, renderSessionStrip, renderNav, renderFieldLock, applyFieldEditLock };
}());