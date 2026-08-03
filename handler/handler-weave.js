/**
 * Weave dashboard -- Cell-scoped (?cell=<id>) campaign continuity: Weaves (explicit story
 * arcs), Needlepoints (durable cases within a Weave), Threads (Handler-only promoted
 * continuity), published Clues (Operator-visible), and the Cell's durable Entity roster.
 * Modeled on handler/handler-cells.js's account-level pattern, but ownership is resolved via
 * remote.listCells (no separate "verify this Cell" endpoint needed) rather than RLS alone,
 * since unlike Weaves/Threads a wrong cellId here should fail closed with a clear message,
 * not just render empty lists.
 */
(function () {
  const remote = window.VeilDaemonCellRemote;

  async function waitForVeilAuth(timeoutMs) {
    const start = Date.now();
    while (!window.VeilAuth) {
      if (Date.now() - start > timeoutMs) return null;
      await new Promise((resolve) => window.setTimeout(resolve, 50));
    }
    return window.VeilAuth;
  }
  async function getToken() {
    const auth = window.VeilAuth;
    if (!auth) return null;
    if (!auth.getSession()) await auth.init();
    return auth.getSession()?.access_token || null;
  }

  function setPageStatus(message, isError) {
    const node = document.getElementById("weave-page-status");
    if (!node) return;
    node.textContent = message || "";
    node.classList.toggle("is-error", Boolean(isError));
  }
  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[<>&"]/g, (ch) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[ch]));
  }
  function formatStamp(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString([], { dateStyle: "short", timeStyle: "short" });
  }

  let cellId = "";
  let cellName = "";
  let weaves = [];
  let selectedWeaveId = "";
  let needlepoints = [];
  let threads = [];
  let clues = [];
  let cellEntities = [];

  // --- Weaves ---

  async function renderWeaves() {
    const listEl = document.getElementById("weaves-list");
    const headingEl = document.getElementById("weaves-list-heading");
    if (!listEl) return;
    try {
      const data = await remote.listWeaves(getToken, { cellId });
      weaves = Array.isArray(data.weaves) ? data.weaves : [];
    } catch (error) {
      setPageStatus(error?.message || "Could not load Weaves.", true);
      return;
    }
    if (headingEl) headingEl.textContent = weaves.length ? `${weaves.length} Weave${weaves.length === 1 ? "" : "s"}` : "No Weaves yet.";
    listEl.innerHTML = weaves.length
      ? weaves.map((weave) => `
          <li class="cells-list-item" data-weave-id="${escapeHtml(weave.id)}">
            <div class="cells-list-item-header">
              <strong class="cells-list-item-name">${escapeHtml(weave.title || "Untitled Weave")}</strong>
              <span class="cells-list-item-status">${escapeHtml((weave.status || "").toUpperCase())}</span>
            </div>
            <p class="cells-list-item-operation">${escapeHtml(weave.summary || "No summary.")}</p>
            <p class="cells-list-item-meta">Updated ${escapeHtml(formatStamp(weave.updated_at))}</p>
            <div class="cells-list-item-actions">
              <button class="button primary small" type="button" data-open-weave="${escapeHtml(weave.id)}">Open</button>
            </div>
          </li>
        `).join("")
      : `<li class="cells-list-empty">No Weaves yet -- create one above to start tracking a story arc for this Cell.</li>`;
    listEl.querySelectorAll("[data-open-weave]").forEach((btn) => {
      btn.addEventListener("click", () => openWeave(btn.getAttribute("data-open-weave")));
    });
  }

  function bindWeaveCreateForm() {
    const form = document.getElementById("weave-create-form");
    if (!form) return;
    form.addEventListener("submit", async (evt) => {
      evt.preventDefault();
      const title = document.getElementById("weave-create-title").value.trim();
      const summary = document.getElementById("weave-create-summary").value.trim();
      if (!title) return;
      try {
        await remote.createWeave(getToken, { cellId, title, summary });
        document.getElementById("weave-create-title").value = "";
        document.getElementById("weave-create-summary").value = "";
        setPageStatus("Weave created.");
        await renderWeaves();
      } catch (error) {
        setPageStatus(error?.message || "Could not create Weave.", true);
      }
    });
  }

  function bindWeaveEditForm() {
    const form = document.getElementById("weave-edit-form");
    if (!form) return;
    form.addEventListener("submit", async (evt) => {
      evt.preventDefault();
      const title = document.getElementById("weave-edit-title").value.trim();
      const summary = document.getElementById("weave-edit-summary").value.trim();
      const status = document.getElementById("weave-edit-status").value;
      try {
        await remote.updateWeave(getToken, { cellId, weaveId: selectedWeaveId, patch: { title, summary, status } });
        setPageStatus("Weave saved.");
        await renderWeaves();
        const weave = weaves.find((w) => w.id === selectedWeaveId);
        if (weave) document.getElementById("weave-detail-title").textContent = weave.title;
      } catch (error) {
        setPageStatus(error?.message || "Could not save Weave.", true);
      }
    });
  }

  // --- Needlepoints ---

  async function renderNeedlepoints() {
    const listEl = document.getElementById("needlepoints-list");
    if (!listEl) return;
    try {
      const data = await remote.listNeedlepoints(getToken, { cellId, weaveId: selectedWeaveId });
      needlepoints = Array.isArray(data.needlepoints) ? data.needlepoints : [];
    } catch (error) {
      setPageStatus(error?.message || "Could not load Needlepoints.", true);
      return;
    }
    listEl.innerHTML = needlepoints.length
      ? needlepoints.map((np) => `
          <li class="cells-list-item" data-needlepoint-id="${escapeHtml(np.id)}">
            <div class="cells-list-item-header">
              <strong class="cells-list-item-name">${escapeHtml(np.title)}</strong>
              <span class="cells-list-item-status">${np.published_at ? "PUBLISHED" : "DRAFT"}</span>
            </div>
            <p class="cells-list-item-meta">${np.template_id ? `Template: ${escapeHtml(np.template_id)}` : "Custom Needlepoint"} · Updated ${escapeHtml(formatStamp(np.updated_at))}</p>
            <div class="cells-list-item-actions">
              ${np.published_at ? "" : `<button class="button ghost small" type="button" data-publish-np="${escapeHtml(np.id)}">Publish</button>`}
              <a class="button ghost small" href="../live/?cell=${encodeURIComponent(cellId)}">Start Operation on Live page</a>
            </div>
          </li>
        `).join("")
      : `<li class="cells-list-empty">No Needlepoints yet.</li>`;
    listEl.querySelectorAll("[data-publish-np]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          await remote.publishNeedlepoint(getToken, { cellId, weaveId: selectedWeaveId, needlepointId: btn.getAttribute("data-publish-np") });
          await renderNeedlepoints();
        } catch (error) {
          setPageStatus(error?.message || "Could not publish Needlepoint.", true);
        }
      });
    });
  }

  function bindNeedlepointCreateForm() {
    const form = document.getElementById("needlepoint-create-form");
    if (!form) return;
    form.addEventListener("submit", async (evt) => {
      evt.preventDefault();
      const title = document.getElementById("needlepoint-create-title").value.trim();
      const templateId = document.getElementById("needlepoint-create-template").value.trim();
      if (!title) return;
      try {
        await remote.createNeedlepoint(getToken, { cellId, weaveId: selectedWeaveId, title, templateId: templateId || null });
        document.getElementById("needlepoint-create-title").value = "";
        document.getElementById("needlepoint-create-template").value = "";
        await renderNeedlepoints();
      } catch (error) {
        setPageStatus(error?.message || "Could not create Needlepoint.", true);
      }
    });
  }

  // --- Threads ---

  function threadKindLabel(kind) {
    const map = { clue: "Clue", npc_entity: "NPC / Entity", faction_pressure: "Faction Pressure", consequence: "Consequence", evidence: "Evidence", discovery: "Discovery", question: "Unresolved Question" };
    return map[kind] || kind;
  }

  async function renderThreads() {
    const listEl = document.getElementById("threads-list");
    if (!listEl) return;
    try {
      const data = await remote.listThreads(getToken, { cellId, weaveId: selectedWeaveId });
      threads = Array.isArray(data.threads) ? data.threads : [];
    } catch (error) {
      setPageStatus(error?.message || "Could not load Threads.", true);
      return;
    }
    listEl.innerHTML = threads.length
      ? threads.map((thread) => `
          <li class="cells-list-item" data-thread-id="${escapeHtml(thread.id)}">
            <div class="cells-list-item-header">
              <strong class="cells-list-item-name">${escapeHtml(thread.title)}</strong>
              <span class="cells-list-item-status">${escapeHtml(threadKindLabel(thread.kind))}</span>
              <span class="cells-list-item-status">${escapeHtml((thread.status || "").toUpperCase())}</span>
            </div>
            <p class="cells-list-item-operation">${escapeHtml(thread.notes || "No notes.")}</p>
            <div class="cells-list-item-actions">
              <select data-thread-status="${escapeHtml(thread.id)}">
                ${["active", "confirmed", "suspected", "contaminated", "rerouted", "resolved"].map((s) => `<option value="${s}" ${s === thread.status ? "selected" : ""}>${s}</option>`).join("")}
              </select>
              <button class="button ghost small" type="button" data-publish-clue="${escapeHtml(thread.id)}" data-thread-title="${escapeHtml(thread.title)}">Publish Clue From This</button>
            </div>
          </li>
        `).join("")
      : `<li class="cells-list-empty">No Threads promoted yet in this Weave.</li>`;
    listEl.querySelectorAll("[data-thread-status]").forEach((select) => {
      select.addEventListener("change", async () => {
        try {
          await remote.updateThread(getToken, { cellId, weaveId: selectedWeaveId, threadId: select.getAttribute("data-thread-status"), patch: { status: select.value } });
          setPageStatus("Thread status updated.");
        } catch (error) {
          setPageStatus(error?.message || "Could not update Thread.", true);
          await renderThreads();
        }
      });
    });
    listEl.querySelectorAll("[data-publish-clue]").forEach((btn) => {
      btn.addEventListener("click", () => openCluePublishDialog(btn.getAttribute("data-publish-clue"), btn.getAttribute("data-thread-title")));
    });
  }

  function populateThreadEntityPicker() {
    const select = document.getElementById("thread-create-entity");
    if (!select) return;
    select.innerHTML = `<option value="">-- none --</option>` + cellEntities.map((e) => `<option value="${escapeHtml(e.id)}">${escapeHtml(e.name)} (${escapeHtml(e.kind)})</option>`).join("");
  }

  function bindThreadCreateForm() {
    const form = document.getElementById("thread-create-form");
    if (!form) return;
    form.addEventListener("submit", async (evt) => {
      evt.preventDefault();
      const title = document.getElementById("thread-create-title").value.trim();
      const kind = document.getElementById("thread-create-kind").value;
      const entityId = document.getElementById("thread-create-entity").value || null;
      const notes = document.getElementById("thread-create-notes").value;
      if (!title) return;
      try {
        await remote.promoteThread(getToken, { cellId, weaveId: selectedWeaveId, kind, title, notes, entityId });
        document.getElementById("thread-create-title").value = "";
        document.getElementById("thread-create-notes").value = "";
        await renderThreads();
      } catch (error) {
        setPageStatus(error?.message || "Could not promote Thread.", true);
      }
    });
  }

  // --- Clues ---

  async function renderClues() {
    const listEl = document.getElementById("clues-list");
    if (!listEl) return;
    try {
      const data = await remote.listClues(getToken, { cellId, weaveId: selectedWeaveId });
      clues = Array.isArray(data.clues) ? data.clues : [];
    } catch (error) {
      setPageStatus(error?.message || "Could not load Clues.", true);
      return;
    }
    listEl.innerHTML = clues.length
      ? clues.map((clue) => `
          <li class="cells-list-item" data-clue-id="${escapeHtml(clue.id)}">
            <div class="cells-list-item-header">
              <strong class="cells-list-item-name">${escapeHtml(clue.title)}</strong>
              <span class="cells-list-item-status">${clue.published_at ? "PUBLISHED" : "DRAFT"}</span>
            </div>
            <p class="cells-list-item-operation">${escapeHtml(clue.body)}</p>
            <p class="cells-list-item-meta">${clue.published_at ? `Published ${escapeHtml(formatStamp(clue.published_at))}` : "Not yet published"}</p>
          </li>
        `).join("")
      : `<li class="cells-list-empty">No Clues published yet from this Weave.</li>`;
  }

  function openCluePublishDialog(threadId, threadTitle) {
    const dialog = document.getElementById("clue-publish-dialog");
    if (!dialog) return;
    document.getElementById("clue-publish-thread-title").textContent = threadTitle || "";
    document.getElementById("clue-publish-title").value = "";
    document.getElementById("clue-publish-body").value = "";
    dialog.dataset.threadId = threadId;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "true");
  }

  function bindCluePublishDialog() {
    const dialog = document.getElementById("clue-publish-dialog");
    const form = document.getElementById("clue-publish-form");
    const closeBtn = document.getElementById("clue-publish-close");
    if (closeBtn) closeBtn.addEventListener("click", () => {
      if (dialog && typeof dialog.close === "function") dialog.close();
      else if (dialog) dialog.removeAttribute("open");
    });
    if (!form) return;
    let submitPublish = false;
    form.querySelectorAll("button[type=submit]").forEach((btn) => {
      btn.addEventListener("click", () => { submitPublish = btn.getAttribute("data-publish") === "true"; });
    });
    form.addEventListener("submit", async (evt) => {
      evt.preventDefault();
      const threadId = dialog?.dataset.threadId;
      const title = document.getElementById("clue-publish-title").value.trim();
      const body = document.getElementById("clue-publish-body").value.trim();
      if (!threadId || !title || !body) return;
      try {
        await remote.createClue(getToken, { cellId, weaveId: selectedWeaveId, threadId, title, body, publish: submitPublish });
        if (dialog && typeof dialog.close === "function") dialog.close();
        else if (dialog) dialog.removeAttribute("open");
        setPageStatus(submitPublish ? "Clue published." : "Clue draft saved.");
        await renderClues();
      } catch (error) {
        setPageStatus(error?.message || "Could not save Clue.", true);
      }
    });
  }

  // --- Cell Entities (Cell-scoped, independent of Weave selection) ---

  async function renderCellEntities() {
    const listEl = document.getElementById("entities-list");
    if (!listEl) return;
    try {
      const data = await remote.listCellEntities(getToken, { cellId });
      cellEntities = Array.isArray(data.entities) ? data.entities : [];
    } catch (error) {
      setPageStatus(error?.message || "Could not load Cell Entities.", true);
      return;
    }
    listEl.innerHTML = cellEntities.length
      ? cellEntities.map((entity) => `
          <li class="cells-list-item" data-entity-id="${escapeHtml(entity.id)}">
            <div class="cells-list-item-header">
              <strong class="cells-list-item-name">${escapeHtml(entity.name)}</strong>
              <span class="cells-list-item-status">${escapeHtml((entity.kind || "").toUpperCase())}</span>
            </div>
            <p class="cells-list-item-operation">${escapeHtml(entity.description || "No description.")}</p>
          </li>
        `).join("")
      : `<li class="cells-list-empty">No durable Entities yet.</li>`;
    populateThreadEntityPicker();
  }

  function bindEntityCreateForm() {
    const form = document.getElementById("entity-create-form");
    if (!form) return;
    form.addEventListener("submit", async (evt) => {
      evt.preventDefault();
      const name = document.getElementById("entity-create-name").value.trim();
      const kind = document.getElementById("entity-create-kind").value;
      const description = document.getElementById("entity-create-description").value;
      if (!name) return;
      try {
        await remote.createCellEntity(getToken, { cellId, kind, name, description });
        document.getElementById("entity-create-name").value = "";
        document.getElementById("entity-create-description").value = "";
        await renderCellEntities();
      } catch (error) {
        setPageStatus(error?.message || "Could not create Cell Entity.", true);
      }
    });
  }

  // --- View switching ---

  async function openWeave(weaveId) {
    selectedWeaveId = weaveId;
    const weave = weaves.find((w) => w.id === weaveId);
    if (!weave) return;
    document.getElementById("weaves-list-view").hidden = true;
    document.getElementById("weave-detail-view").hidden = false;
    document.getElementById("weave-detail-title").textContent = weave.title;
    document.getElementById("weave-edit-title").value = weave.title || "";
    document.getElementById("weave-edit-summary").value = weave.summary || "";
    document.getElementById("weave-edit-status").value = weave.status || "planned";
    await Promise.all([renderNeedlepoints(), renderThreads(), renderClues()]);
  }

  function bindBackButton() {
    const btn = document.getElementById("weave-detail-back");
    if (!btn) return;
    btn.addEventListener("click", async () => {
      selectedWeaveId = "";
      document.getElementById("weave-detail-view").hidden = true;
      document.getElementById("weaves-list-view").hidden = false;
      await renderWeaves();
    });
  }

  async function init() {
    bindWeaveCreateForm();
    bindWeaveEditForm();
    bindNeedlepointCreateForm();
    bindThreadCreateForm();
    bindEntityCreateForm();
    bindCluePublishDialog();
    bindBackButton();

    const auth = await waitForVeilAuth(8000);
    if (!auth) {
      setPageStatus("Could not load sign-in. Refresh to try again.", true);
      return;
    }
    if (!auth.getSession()) await auth.init();
    if (!auth.getUser()) {
      auth.showModal();
      auth.onChange?.(async (user) => { if (user) await init(); });
      return;
    }

    const params = new URLSearchParams(window.location.search);
    cellId = (params.get("cell") || "").trim();
    if (!cellId) {
      setPageStatus("No Cell selected -- open a Cell from the Cells dashboard first.", true);
      return;
    }

    const cellsRes = await remote.listCells(getToken).catch(() => null);
    const cell = cellsRes && Array.isArray(cellsRes.cells) ? cellsRes.cells.find((c) => c.id === cellId) : null;
    if (!cell) {
      setPageStatus("Cell not found, or not owned by this account.", true);
      return;
    }
    cellName = cell.cellName || "Cell";
    document.getElementById("weave-cell-title").textContent = cellName.toUpperCase();
    document.getElementById("weave-cell-kicker").textContent = `HANDLER CONSOLE // WEAVE // ${cellName}`;

    await Promise.all([renderWeaves(), renderCellEntities()]);
  }

  init();
}());
