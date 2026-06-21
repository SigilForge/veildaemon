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

  function renderCaseFileRecord() {
    const screens = document.querySelectorAll("#casefile-drawer .operator-preview-screen");
    if (!screens.length) return;

    const consoleRecord = readJson(consoleStorageKey);
    const intakeRecord = readJson(recordStorageKey) || readJson(legacyRecordStorageKey);
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
    const misfire = safe(status.misfireSeverity, "NONE");
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

  document.addEventListener("DOMContentLoaded", renderCaseFileRecord);
  bindDirectTabShortcuts();
  window.addEventListener("veildaemon:operator-record-updated", renderCaseFileRecord);
  window.addEventListener("storage", renderCaseFileRecord);
})();
