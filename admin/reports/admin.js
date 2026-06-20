(function () {
  const tokenInput = document.getElementById("token");
  const saveToken = document.getElementById("save-token");
  const refreshQueue = document.getElementById("refresh-queue");
  const reportList = document.getElementById("report-list");
  const statusLine = document.getElementById("status-line");
  const tokenKey = "veildaemon.reportAdminToken";

  if (!tokenInput || !reportList || !statusLine) return;

  let reports = [];

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
    const response = await fetch(path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token()}`,
        ...(options && options.headers ? options.headers : {}),
      },
    });
    const result = await response.json();
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
    meta.append(field("PUBLIC PERMISSION", report.consentPublic ? "GRANTED" : "NOT GRANTED"));
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

    approve.disabled = !report.consentPublic || !report.publicDraftApproved;
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

  async function loadReports() {
    setStatus("Queue refresh in progress.");
    const result = await api("/api/reports/admin", { method: "GET" });
    reports = result.reports || [];
    render();
    setStatus(`Queue refreshed. ${reports.length} report records present.`);
  }

  tokenInput.value = window.localStorage.getItem(tokenKey) || "";
  saveToken.addEventListener("click", () => {
    window.localStorage.setItem(tokenKey, token());
    setStatus("Token held locally.");
    loadReports().catch((error) => setStatus(error.message, true));
  });
  refreshQueue.addEventListener("click", () => loadReports().catch((error) => setStatus(error.message, true)));

  if (token()) {
    loadReports().catch((error) => setStatus(error.message, true));
  }
}());
