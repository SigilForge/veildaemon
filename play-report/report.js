(function () {
  const form = document.getElementById("after-action-form");
  const statusLine = document.getElementById("report-status");
  const generateDraft = document.getElementById("generate-draft");
  const draftPreview = document.getElementById("public-draft-preview");
  const draftApproved = document.getElementById("draft-approved");
  const consentPublic = document.getElementById("consent-public");

  if (!form || !statusLine) return;
  let approvedDraft = null;
  const apiBaseStorageKey = "veildaemon.reportApiBase";
  const params = new URLSearchParams(window.location.search);
  const suppliedApiBase = params.get("api") || "";
  const sameOriginApiAvailable = window.location.hostname !== "veildaemon.app" && window.location.hostname !== "www.veildaemon.app";
  const defaultApiBase = window.location.hostname === "veildaemon.app" || window.location.hostname === "www.veildaemon.app"
    ? "https://api.veildaemon.app"
    : "";
  const storedApiBase = window.localStorage.getItem(apiBaseStorageKey) || "";
  const apiBase = normalizeApiBase(suppliedApiBase || storedApiBase || defaultApiBase || (sameOriginApiAvailable ? window.location.origin : ""));

  if (suppliedApiBase && apiBase) {
    window.localStorage.setItem(apiBaseStorageKey, apiBase);
  }

  function setStatus(message, isError) {
    statusLine.textContent = message;
    statusLine.classList.toggle("is-error", Boolean(isError));
  }

  function normalizeApiBase(value) {
    const clean = String(value || "").trim().replace(/\/+$/, "");
    if (!clean) return "";

    try {
      const url = new URL(clean);
      return url.protocol === "https:" || url.hostname === "localhost" || url.hostname === "127.0.0.1"
        ? url.toString().replace(/\/+$/, "")
        : "";
    } catch (error) {
      return "";
    }
  }

  function apiUrl(path) {
    if (!apiBase) {
      throw new Error("Report API route unavailable. Confirm api.veildaemon.app is assigned to the Vercel deployment.");
    }

    return `${apiBase}${path}`;
  }

  if (!apiBase) {
    setStatus("Report API route unavailable. Confirm api.veildaemon.app is assigned to the Vercel deployment.", true);
  }

  function fieldValue(formData, name) {
    return String(formData.get(name) || "").trim();
  }

  function safeSnippet(text) {
    return String(text || "")
      .replace(/\s+/g, " ")
      .replace(/[<>{}]/g, "")
      .trim()
      .slice(0, 180);
  }

  async function readJsonResponse(response, fallbackMessage) {
    const text = await response.text();
    let result = null;

    try {
      result = text ? JSON.parse(text) : {};
    } catch (error) {
      const snippet = safeSnippet(text);
      throw new Error(`HTTP ${response.status}: ${snippet || fallbackMessage}`);
    }

    if (!response.ok || !result.ok) {
      throw new Error(result.error || `HTTP ${response.status}: ${fallbackMessage}`);
    }

    return result;
  }

  function readPayload() {
    const formData = new FormData(form);
    return {
      role: fieldValue(formData, "role"),
      needlepoint: fieldValue(formData, "needlepoint"),
      playerCount: fieldValue(formData, "playerCount"),
      bestMoment: fieldValue(formData, "bestMoment"),
      confusingRule: fieldValue(formData, "confusingRule"),
      improve: fieldValue(formData, "improve"),
      fullFeedback: fieldValue(formData, "fullFeedback"),
      handle: fieldValue(formData, "handle"),
      email: fieldValue(formData, "email"),
      consentPublic: formData.get("consentPublic") === "on" && formData.get("publicDraftApproved") === "on",
      publicDraftApproved: formData.get("publicDraftApproved") === "on",
    };
  }

  function resetDraftApproval() {
    approvedDraft = null;
    if (draftApproved) {
      draftApproved.checked = false;
      draftApproved.disabled = true;
    }
    if (consentPublic) {
      consentPublic.checked = false;
      consentPublic.disabled = true;
    }
    if (draftPreview) {
      draftPreview.hidden = true;
      draftPreview.textContent = "";
    }
  }

  function addDraftLine(parent, label, value) {
    const line = document.createElement("p");
    const strong = document.createElement("strong");
    strong.textContent = `${label}:`;
    line.append(strong, ` ${String(value || "REDACTED")}`);
    parent.append(line);
  }

  function renderDraft(draft) {
    if (!draftPreview) return;
    draftPreview.textContent = "";
    addDraftLine(draftPreview, "IDENTITY", draft.identity);
    addDraftLine(draftPreview, "LOCATION", draft.location);
    addDraftLine(draftPreview, "ROLE", draft.role);
    addDraftLine(draftPreview, "OPERATOR COUNT", draft.operatorCount);
    addDraftLine(draftPreview, "NEEDLEPOINT", draft.needlepoint);
    addDraftLine(draftPreview, "STATUS", draft.status);
    addDraftLine(draftPreview, "RECOVERED STATEMENT", draft.recoveredStatement);
    addDraftLine(draftPreview, "ARCHIVE NOTE", draft.archiveNote);
    draftPreview.hidden = false;
  }

  async function requestDraft() {
    const payload = readPayload();
    setStatus("Redaction pass in progress.");

    const response = await fetch(apiUrl("/api/reports/preview"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const result = await readJsonResponse(response, "Redaction pass failed.");

    approvedDraft = result.publicDraft;
    renderDraft(approvedDraft);
    if (draftApproved) draftApproved.disabled = false;
    if (consentPublic) consentPublic.disabled = false;
    setStatus("Review the redacted version before granting public recovery permission.");
  }

  if (generateDraft) {
    generateDraft.addEventListener("click", () => {
      requestDraft().catch((error) => setStatus(error.message || "Redaction pass failed.", true));
    });
  }

  form.addEventListener("input", (event) => {
    if (event.target === draftApproved || event.target === consentPublic) return;
    resetDraftApproval();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);

    if (fieldValue(formData, "company")) {
      setStatus("Submission refused. False panel detected.", true);
      return;
    }

    const payload = {
      ...readPayload(),
      publicDraft: approvedDraft,
    };

    if (payload.consentPublic && (!payload.publicDraftApproved || !approvedDraft)) {
      setStatus("Public recovery permission requires redaction review approval.", true);
      return;
    }

    setStatus("Report transfer in progress. Hold still in the useful way.");

    try {
      const response = await fetch(apiUrl("/api/reports/submit"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const result = await readJsonResponse(response, "Report transfer failed.");

      form.reset();
      resetDraftApproval();
      setStatus(`Report ${result.id} received. Final archive review required before public recovery.`);
    } catch (error) {
      setStatus(error.message || "Report transfer failed.", true);
    }
  });
}());
