(function () {
  const consoleStorageKey = "veildaemon.operatorConsole.v1";
  const recordStorageKey = "veildaemon.operatorRecord.v2";
  const legacyRecordStorageKey = "veildaemon.operatorRecord.v1";

  function readJson(key) {
    try {
      const raw = window.localStorage && window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function safe(value, fallback = "UNRECORDED") {
    const text = String(value || "").trim();
    return text || fallback;
  }

  function escapeHtml(value) {
    return safe(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function compactMap(value, fallback) {
    if (!value || typeof value !== "object") return fallback;
    const entries = Object.entries(value)
      .filter(([, entryValue]) => String(entryValue || "").trim() && String(entryValue) !== "0")
      .map(([key, entryValue]) => `${key} ${entryValue}`);
    return entries.length ? entries.join(" // ") : fallback;
  }

  function readIntakeRecord() {
    return readJson(recordStorageKey) || readJson(legacyRecordStorageKey);
  }

  function renderOperatorPreviewState() {
    const preview = document.getElementById("operator-preview");
    if (!preview || document.getElementById("operator-preview-primary-action")) return;

    const intakeRecord = readIntakeRecord();
    const tabStatus = document.querySelector('.surface-tab[aria-controls="operator-preview"] strong');
    const panel = preview.querySelector(".operator-preview-panel");
    const screen = panel && Array.from(panel.children).find((child) => child.classList && child.classList.contains("operator-preview-screen"));
    const actions = preview.querySelector('.drawer-actions[aria-label="Operator file routes"]');

    if (tabStatus) tabStatus.textContent = intakeRecord ? "LOCAL NODE" : "START INTAKE";
    if (screen) {
      screen.innerHTML = intakeRecord ? `
        <p class="kicker">LOCAL NODE</p>
        <h2>PERSONAL OPERATIONS RECORD</h2>
        <div class="preview-entry"><span>STATUS</span><strong>DEVICE-HELD</strong></div>
        <div class="preview-entry"><span>CONTENTS</span><strong>ATTRIBUTES // SKILLS // FREQUENCY // CASE NOTES</strong></div>
        <div class="preview-entry"><span>TRANSFER</span><strong>MANUAL ONLY</strong></div>
        <p class="local-note"><span class="prompt">&gt;</span> Observation can be recorded without upstream transfer. The node will not volunteer a file for you.</p>
      ` : `
        <p class="kicker">ACCESS UNQUALIFIED</p>
        <h2>LOCAL NODE SEALED</h2>
        <div class="preview-entry"><span>STATUS</span><strong>INTAKE REQUIRED</strong></div>
        <div class="preview-entry"><span>CONTENTS</span><strong>OPERATOR FILE WITHHELD</strong></div>
        <div class="preview-entry"><span>TRANSFER</span><strong>NONE</strong></div>
        <p class="local-note"><span class="prompt">&gt;</span> Intake must classify the observer before local node contents are exposed.</p>
      `;
    }
    if (actions) {
      actions.innerHTML = intakeRecord
        ? '<a class="button primary" href="/operator/"><span>Enter Node</span></a>'
        : '<a class="button primary" href="/#intake-node"><span>Start Intake</span></a>';
    }
  }

  function renderCaseFileRecord() {
    const screens = document.querySelectorAll("#casefile-drawer .operator-preview-screen");
    if (!screens.length) return;

    const consoleRecord = readJson(consoleStorageKey);
    const intakeRecord = readIntakeRecord();
    if (!consoleRecord && !intakeRecord) {
      screens.forEach((screen) => {
        screen.dataset.surfaceKind = "operator";
        screen.innerHTML = `
          <p class="kicker">NO OPERATOR RECORD FOUND</p>
          <h2>INTAKE REQUIRED</h2>
          <div class="preview-entry"><span>STATUS</span><strong>LOCAL FILE UNINITIALIZED</strong></div>
          <p class="local-note"><span class="prompt">&gt;</span> Complete intake to initialize the local case file.</p>
          <nav class="route-actions drawer-actions" aria-label="Case file intake route">
            <a class="button primary" href="/#intake-node"><span>Complete Intake</span></a>
          </nav>
        `;
      });
      return;
    }
    const status = consoleRecord && consoleRecord.operatorStatus || {};
    const operatorName = safe(status.operatorName, "UNNAMED OPERATOR");
    const designation = safe(status.designation || intakeRecord?.designation, "UNINITIALIZED");
    const frequency = safe(intakeRecord?.primaryFrequency || status.selectedLotusPetal, "UNASSIGNED");
    const stability = safe(status.stability ? `${status.stability}/10` : "", "UNMEASURED");
    const harm = safe(status.harmBoxes ? `${status.harmBoxes}/5` : status.harm, "NONE RECORDED");
    const attention = safe(status.attentionState || intakeRecord?.attentionStatus, "UNMEASURED");
    const misfire = safe(status.activeMisfire || status.misfires || status.misfireSeverity, "NONE");
    const voidMarks = safe(status.voidMarks, "0");
    const breachPoints = safe(status.breachPoints, "0");
    const needlepoint = safe(status.activeNeedlepoint, "NO ACTIVE CASE");
    const attributes = compactMap(status.attributes, "BASELINE UNRECORDED");
    const skills = compactMap(status.skills, "NO SKILLS TRACKED");

    screens.forEach((screen) => {
      screen.dataset.surfaceKind = "operator";
      screen.innerHTML = `
        <p class="kicker">LOCAL OPERATOR RECORD</p>
        <h2>${escapeHtml(operatorName)}</h2>
        <div class="preview-entry"><span>DESIGNATION</span><strong>${escapeHtml(designation)}</strong></div>
        <div class="preview-entry"><span>PRIMARY FREQUENCY</span><strong>${escapeHtml(frequency)}</strong></div>
        <div class="preview-entry"><span>ACTIVE CASE</span><strong>${escapeHtml(needlepoint)}</strong></div>
        <div class="preview-entry"><span>STABILITY</span><strong>${escapeHtml(stability)}</strong></div>
        <div class="preview-entry"><span>HARM</span><strong>${escapeHtml(harm)}</strong></div>
        <div class="preview-entry"><span>ATTENTION</span><strong>${escapeHtml(attention)}</strong></div>
        <div class="preview-entry"><span>MISFIRE</span><strong>${escapeHtml(misfire)}</strong></div>
        <div class="preview-entry"><span>VOID / BREACH</span><strong>${escapeHtml(`${voidMarks} / ${breachPoints}`)}</strong></div>
        <div class="preview-entry"><span>ATTRIBUTES</span><strong>${escapeHtml(attributes)}</strong></div>
        <div class="preview-entry"><span>TRACKED SKILLS</span><strong>${escapeHtml(skills)}</strong></div>
        <p class="local-note"><span class="prompt">&gt;</span> Local browser record only. Edit the personal file to change this snapshot.</p>
      `;
    });
  }

  function bindDirectTabShortcuts() {
    document.addEventListener("click", (event) => {
      const tab = event.target && event.target.closest && event.target.closest(".surface-tab[data-direct-href]");
      if (!tab || !event.shiftKey) return;

      const href = tab.getAttribute("data-direct-href");
      if (!href) return;

      event.preventDefault();
      event.stopImmediatePropagation();

      if (tab.getAttribute("data-direct-target") === "_blank") {
        window.open(href, "_blank", "noopener,noreferrer");
        return;
      }

      window.location.href = href;
    }, true);
  }

  function drawerIds() {
    return ["casefile-drawer", "operator-preview", "recovered-reports-drawer"];
  }

  function closeSurfaceDrawers() {
    drawerIds().forEach((id) => {
      const drawer = document.getElementById(id);
      if (!drawer) return;
      drawer.classList.remove("is-open");
      drawer.setAttribute("aria-hidden", "true");
    });

    document.body.classList.remove(
      "has-casefile-drawer-open",
      "has-operator-preview-open",
      "has-reports-drawer-open"
    );

    document.querySelectorAll(".surface-tab[aria-expanded], .surface-tab[aria-controls]").forEach((tab) => {
      tab.setAttribute("aria-expanded", "false");
    });

    if (drawerIds().some((id) => window.location.hash === `#${id}`) || window.location.hash === "#surface-files") {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }
  }

  function bodyClassForDrawer(id) {
    return {
      "casefile-drawer": "has-casefile-drawer-open",
      "operator-preview": "has-operator-preview-open",
      "recovered-reports-drawer": "has-reports-drawer-open"
    }[id];
  }

  function openSurfaceDrawer(id) {
    const drawer = document.getElementById(id);
    if (!drawer) return;

    closeSurfaceDrawers();
    drawer.classList.add("is-open");
    drawer.setAttribute("aria-hidden", "false");

    const bodyClass = bodyClassForDrawer(id);
    if (bodyClass) {
      document.body.classList.add(bodyClass);
    }

    document.querySelectorAll(`.surface-tab[aria-controls="${id}"]`).forEach((tab) => {
      tab.setAttribute("aria-expanded", "true");
    });
  }

  function bindDrawerControls() {
    document.addEventListener("click", (event) => {
      const close = event.target && event.target.closest && event.target.closest('.drawer-route[href="#surface-files"]');
      if (close) {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeSurfaceDrawers();
        return;
      }

      const tab = event.target && event.target.closest && event.target.closest(".surface-tab[aria-controls]");
      if (!tab || event.shiftKey) return;

      const targetId = tab.getAttribute("aria-controls");
      if (!drawerIds().includes(targetId)) return;

      const target = document.getElementById(targetId);
      const isOpen = target && (target.matches(":target") || target.classList.contains("is-open"));

      event.preventDefault();
      event.stopImmediatePropagation();

      if (isOpen) {
        closeSurfaceDrawers();
        return;
      }

      openSurfaceDrawer(targetId);
    }, true);
  }

  function restoreHashDrawer() {
    const targetId = window.location.hash && window.location.hash.slice(1);
    if (!drawerIds().includes(targetId)) return;
    openSurfaceDrawer(targetId);
  }

  document.addEventListener("DOMContentLoaded", () => {
    renderOperatorPreviewState();
    renderCaseFileRecord();
    restoreHashDrawer();
  });
  bindDirectTabShortcuts();
  bindDrawerControls();
  window.addEventListener("veildaemon:operator-record-updated", () => {
    renderOperatorPreviewState();
    renderCaseFileRecord();
  });
  window.addEventListener("storage", () => {
    renderOperatorPreviewState();
    renderCaseFileRecord();
  });
})();
