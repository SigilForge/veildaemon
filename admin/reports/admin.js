(function () {
  const tokenInput = document.getElementById("token");
  const saveToken = document.getElementById("save-token");
  const refreshQueue = document.getElementById("refresh-queue");
  const refreshAnomalies = document.getElementById("refresh-anomalies");
  const reportList = document.getElementById("report-list");
  const anomalyList = document.getElementById("anomaly-list");
  const statusLine = document.getElementById("status-line");
  const tokenKey = "veildaemon.reportAdminToken";
  const queryToken = new URLSearchParams(window.location.search).get("token") || "";
  const apiBase = window.location.hostname === "veildaemon.app" || window.location.hostname === "www.veildaemon.app"
    ? "https://api.veildaemon.app"
    : "";

  if (!tokenInput || !reportList || !anomalyList || !statusLine) return;

  let reports = [];
  let anomalyLogs = [];

  function token() {
    return tokenInput.value.trim();
  }

  function setStatus(message, isError) {
    statusLine.textContent = message;
    statusLine.classList.toggle("is-error", Boolean(isError));
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function field(label, value) {
    const wrap = el("div", "field");
    wrap.append(el("span", "", label));
    wrap.append(el("p", "", value || "EMPTY"));
    return wrap;
  }

  function textarea(label, value, name) {
    const wrap = el("label", "draft-field");
    wrap.append(el("span", "", label));
    const input = document.createElement("textarea");
    input.name = name;
    input.rows = name === "recoveredStatement" ? 5 : 2;
    input.value = value || "";
    wrap.append(input);
    return wrap;
  }

  function draftFromCard(card) {
    return {
      role: card.querySelector("[name='role']").value,
      operatorCount: card.querySelector("[name='operatorCount']").value,
      needlepoint: card.querySelector("[name='needlepoint']").value,
      status: card.querySelector("[name='status']").value,
      recoveredStatement: card.querySelector("[name='recoveredStatement']").value,
      archiveNote: card.querySelector("[name='archiveNote']").value,
    };
  }

  async function api(path, options) {
    const response = await fetch(`${apiBase}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token()}`,
        ...(options && options.headers ? options.headers : {}),
      },
    });
    const text = await response.text();
    let result;
    try {
      result = text ? JSON.parse(text) : {};
    } catch (error) {
      throw new Error(`HTTP ${response.status}: ${text.replace(/\s+/g, " ").replace(/[<>{}]/g, "").trim().slice(0, 160) || "Queue request returned non-JSON."}`);
    }
    if (!response.ok || !result.ok) {
      throw new Error(result.error || "Queue request failed.");
    }
    return result;
  }

  async function updateReport(id, action, card) {
    const payload = { id, action };
    if (card && (action === "draft" || action === "approve")) {
      payload.publicDraft = draftFromCard(card);
    }

    const result = await api("/api/reports/admin", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });

    const index = reports.findIndex((report) => report.id === id);
    if (index >= 0) reports[index] = result.report;
    render();
    setStatus(`Report ${id} ${action} accepted.`);
  }

  async function updateAnomalyLog(id, action) {
    const result = await api("/api/reports/anomaly-admin", {
      method: "PATCH",
      body: JSON.stringify({ id, action }),
    });

    if (action === "delete") {
      anomalyLogs = anomalyLogs.filter((log) => log.id !== id);
    } else {
      const index = anomalyLogs.findIndex((log) => log.id === id);
      if (index >= 0) anomalyLogs[index] = result.anomalyLog;
    }
    renderAnomalyLogs();
    setStatus(`Anomaly log ${id} ${action} accepted.`);
  }

  function renderReport(report) {
    const card = el("article", "report-card");
    card.dataset.id = report.id;

    const header = el("div", "report-header");
    header.append(el("h3", "", `REPORT #${report.id}`));
    header.append(el("span", `status status-${report.status}`, report.status.replace("_", " ").toUpperCase()));
    card.append(header);

    const meta = el("div", "meta-grid");
    meta.append(field("ROLE", report.role));
    meta.append(field("NEEDLEPOINT", report.needlepoint));
    meta.append(field("OPERATOR COUNT", report.playerCount));
    meta.append(field("PUBLIC PERMISSION", report.publicDraftApproved ? "GRANTED BY REDACTION APPROVAL" : "NOT GRANTED"));
    meta.append(field("HANDLE", report.handle));
    meta.append(field("EMAIL", report.email));
    meta.append(field("REDACTION APPROVAL", report.publicDraftApproved ? "APPROVED BY SUBMITTER" : "NOT APPROVED"));
    card.append(meta);

    const original = document.createElement("details");
    original.open = report.status === "under_review";
    original.append(el("summary", "", "View Original Submission"));
    original.append(field("BEST MOMENT", report.bestMoment));
    original.append(field("CONFUSING RULE OR SCENE", report.confusingRule));
    original.append(field("SHOULD IMPROVE", report.improve));
    original.append(field("FULL FEEDBACK", report.fullFeedback));
    card.append(original);

    const draft = report.publicDraft || {};
    const draftPanel = el("section", "draft-panel");
    draftPanel.append(el("h4", "", "Public Archive Version"));
    draftPanel.append(textarea("ROLE", draft.role, "role"));
    draftPanel.append(textarea("OPERATOR COUNT", draft.operatorCount, "operatorCount"));
    draftPanel.append(textarea("NEEDLEPOINT", draft.needlepoint, "needlepoint"));
    draftPanel.append(textarea("STATUS", draft.status, "status"));
    draftPanel.append(textarea("RECOVERED STATEMENT", draft.recoveredStatement, "recoveredStatement"));
    draftPanel.append(textarea("ARCHIVE NOTE", draft.archiveNote, "archiveNote"));
    card.append(draftPanel);

    const actions = el("div", "action-row");
    const save = el("button", "", "Save Draft");
    const approve = el("button", "approve", "Approve");
    const reject = el("button", "reject", "Reject");
    const review = el("button", "", "Return To Review");

    save.type = approve.type = reject.type = review.type = "button";
    save.addEventListener("click", () => updateReport(report.id, "draft", card).catch((error) => setStatus(error.message, true)));
    approve.addEventListener("click", () => updateReport(report.id, "approve", card).catch((error) => setStatus(error.message, true)));
    reject.addEventListener("click", () => updateReport(report.id, "reject", card).catch((error) => setStatus(error.message, true)));
    review.addEventListener("click", () => updateReport(report.id, "review", card).catch((error) => setStatus(error.message, true)));

    approve.disabled = !report.publicDraftApproved;
    actions.append(save, approve, reject, review);
    card.append(actions);

    return card;
  }

  function render() {
    reportList.textContent = "";
    if (reports.length === 0) {
      reportList.append(el("p", "empty", "No reports in queue."));
      return;
    }

    reports.forEach((report) => reportList.append(renderReport(report)));
  }

  function renderAnomalyLog(log) {
    const card = el("article", "report-card anomaly-card");
    card.dataset.id = log.id;

    const header = el("div", "report-header");
    header.append(el("h3", "", `ANOMALY #${log.id}`));
    header.append(el("span", `status status-${log.status}`, log.status.replace("_", " ").toUpperCase()));
    card.append(header);

    const meta = el("div", "meta-grid");
    meta.append(field("OPERATOR", log.operatorName || log.designation));
    meta.append(field("FREQUENCY", log.primaryFrequency));
    meta.append(field("NEEDLEPOINT", log.activeNeedlepoint));
    meta.append(field("CLASSIFICATION", log.classification));
    meta.append(field("ATTENTION", log.attentionState));
    meta.append(field("SEVERITY", log.severity));
    card.append(meta);

    const original = document.createElement("details");
    original.open = log.status === "under_review";
    original.append(el("summary", "", "View Volunteered Log"));
    original.append(field("SCENE", log.scene));
    original.append(field("IMPOSSIBLE DETAIL", log.detail));
    original.append(field("TAGS", log.tags));
    original.append(field("NOTES", log.notes));
    card.append(original);

    const actions = el("div", "action-row");
    const hold = el("button", "", "Hold");
    const review = el("button", "", "Return To Review");
    const remove = el("button", "reject", "Delete");
    hold.type = review.type = remove.type = "button";
    hold.addEventListener("click", () => updateAnomalyLog(log.id, "hold").catch((error) => setStatus(error.message, true)));
    review.addEventListener("click", () => updateAnomalyLog(log.id, "review").catch((error) => setStatus(error.message, true)));
    remove.addEventListener("click", () => updateAnomalyLog(log.id, "delete").catch((error) => setStatus(error.message, true)));
    actions.append(hold, review, remove);
    card.append(actions);

    return card;
  }

  function renderAnomalyLogs() {
    anomalyList.textContent = "";
    if (anomalyLogs.length === 0) {
      anomalyList.append(el("p", "empty", "No volunteered anomaly logs."));
      return;
    }

    anomalyLogs.forEach((log) => anomalyList.append(renderAnomalyLog(log)));
  }

  async function loadReports() {
    setStatus("Queue refresh in progress.");
    const result = await api("/api/reports/admin", { method: "GET" });
    reports = result.reports || [];
    render();
    setStatus(`Queue refreshed. ${reports.length} report records present.`);
  }

  async function loadAnomalyLogs() {
    setStatus("Anomaly volunteer refresh in progress.");
    const result = await api("/api/reports/anomaly-admin", { method: "GET" });
    anomalyLogs = result.anomalyLogs || [];
    renderAnomalyLogs();
    setStatus(`Anomaly volunteers refreshed. ${anomalyLogs.length} records present.`);
  }

  async function loadAll() {
    await loadReports();
    await loadAnomalyLogs();
  }

  tokenInput.value = queryToken || window.localStorage.getItem(tokenKey) || "";
  if (queryToken) {
    window.localStorage.setItem(tokenKey, queryToken);
  }
  saveToken.addEventListener("click", () => {
    window.localStorage.setItem(tokenKey, token());
    setStatus("Token held locally.");
    loadAll().catch((error) => setStatus(error.message, true));
  });
  refreshQueue.addEventListener("click", () => loadReports().catch((error) => setStatus(error.message, true)));
  refreshAnomalies.addEventListener("click", () => loadAnomalyLogs().catch((error) => setStatus(error.message, true)));

  if (token()) {
    loadAll().catch((error) => setStatus(error.message, true));
  }
}());
