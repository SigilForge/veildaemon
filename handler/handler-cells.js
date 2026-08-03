/**
 * Handler Cells dashboard -- lists every Cell the signed-in Handler owns via GET /api/cell/
 * list. Account-level only: never reads/writes per-Cell local storage (HandlerState), never
 * calls attachToCell/switchToCell itself. "Resume" and a freshly "Create"d Cell both navigate
 * to handler/live/index.html?cell=<id> -- the Live page's own deep-link bootstrap owns the
 * actual attach. The one exception is Suspend/Archive/Close, shown only on the card matching
 * the currently-restored connection (see restoreConnection below), since those act on
 * "whatever's currently attached" -- not a Cells-dashboard concept, just surfaced here so a
 * Handler doesn't have to jump to Live to end a session they're already looking at.
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

  function setListStatus(message, isError) {
    const node = document.getElementById("cells-list-status");
    if (!node) return;
    node.textContent = message || "";
    node.classList.toggle("is-error", Boolean(isError));
  }

  function setCreateStatus(message, isError) {
    const node = document.getElementById("cells-create-status");
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

  function statusLabel(cell) {
    const map = { open: "OPEN", active_operation: "ACTIVE OPERATION", post_operation: "POST-OPERATION", closed: "CLOSED" };
    return map[cell.status] || (cell.status || "").toUpperCase() || "UNKNOWN";
  }

  function operationSummary(cell) {
    const op = cell.operation;
    if (!op) return "No Operation started yet.";
    const parts = [`Operation ${op.sequence}`, op.status.toUpperCase(), `Round ${op.round || 0}`];
    if (op.unresolvedRewards) parts.push("UNRESOLVED REWARDS");
    return parts.join(" · ");
  }

  let cellsCache = [];

  async function renderCells() {
    const listEl = document.getElementById("cells-list");
    const headingEl = document.getElementById("cells-list-heading");
    if (!listEl) return;
    try {
      const data = await remote.listCells(getToken);
      cellsCache = Array.isArray(data.cells) ? data.cells : [];
    } catch (error) {
      if (headingEl) headingEl.textContent = "Could not load Cells.";
      setListStatus(error?.message || "Could not load Cells.", true);
      return;
    }
    if (headingEl) headingEl.textContent = cellsCache.length ? `${cellsCache.length} Cell${cellsCache.length === 1 ? "" : "s"}` : "No Cells yet.";
    setListStatus("");

    const activeCellId = remote.getActiveContext?.().activeCellId || "";

    if (!cellsCache.length) {
      listEl.innerHTML = `<li class="cells-list-empty">No Cells yet -- create one above to open your first table.</li>`;
      return;
    }

    listEl.innerHTML = cellsCache.map((cell) => {
      const isActive = cell.id === activeCellId;
      const canManage = isActive && remote.isConnected() && remote.currentConnection()?.role === "handler";
      const opStatus = cell.operation?.status;
      return `
        <li class="cells-list-item ${isActive ? "is-active-cell" : ""}" data-cell-id="${escapeHtml(cell.id)}">
          <div class="cells-list-item-header">
            <strong class="cells-list-item-name" data-cell-name>${escapeHtml(cell.cellName || "Untitled Cell")}</strong>
            <span class="cells-list-item-code">${escapeHtml(cell.joinCode || "")}</span>
            <span class="cells-list-item-status">${escapeHtml(statusLabel(cell))}</span>
            ${isActive ? `<span class="cells-list-item-connected">ATTACHED IN THIS BROWSER</span>` : ""}
          </div>
          <p class="cells-list-item-operation">${escapeHtml(operationSummary(cell))}</p>
          <p class="cells-list-item-meta">
            ${cell.seatedCount || 0} seated ·
            Updated ${escapeHtml(formatStamp(cell.updatedAt))}
            ${opStatus === "suspended" ? " · <strong>SUSPENDED</strong> (checkpoint saved)" : ""}
          </p>
          <div class="cells-list-item-actions">
            <a class="button primary small" href="../live/?cell=${encodeURIComponent(cell.id)}">Resume Cell</a>
            <button class="button ghost small" type="button" data-action="rename" data-cell-id="${escapeHtml(cell.id)}">Rename</button>
            <button class="button ghost small" type="button" data-action="history" data-cell-id="${escapeHtml(cell.id)}">Prior Operations</button>
            ${canManage && (opStatus === "active" || opStatus === "resolving") ? `<button class="button ghost small" type="button" data-action="suspend">Suspend Operation</button>` : ""}
            ${canManage && cell.status !== "closed" ? `<button class="button danger small" type="button" data-action="close">Close Cell</button>` : ""}
          </div>
        </li>
      `;
    }).join("");

    listEl.querySelectorAll("[data-action]").forEach((btn) => {
      btn.addEventListener("click", () => handleCardAction(btn.getAttribute("data-action"), btn.getAttribute("data-cell-id")));
    });
  }

  async function handleCardAction(action, cellId) {
    const cell = cellsCache.find((item) => item.id === cellId);
    try {
      if (action === "rename") {
        const nextName = window.prompt("Rename Cell", cell?.cellName || "");
        if (nextName == null) return;
        const trimmed = nextName.trim();
        if (!trimmed) return;
        await remote.renameCell(getToken, { cellId, cellName: trimmed });
        await renderCells();
        return;
      }
      if (action === "history") {
        await showHistory(cellId, cell?.cellName || "Cell");
        return;
      }
      if (action === "suspend") {
        if (!window.confirm("Suspend Operation? Writes a checkpoint and leaves the Cell intact.")) return;
        await remote.suspendOperation();
        await renderCells();
        return;
      }
      if (action === "close") {
        if (!window.confirm("Close this Cell? Ends the lobby for every Operator. This cannot be undone. (Archive the active Operation first if one is running.)")) return;
        await remote.closeCell();
        await renderCells();
        return;
      }
    } catch (error) {
      setListStatus(error?.message || "That action failed.", true);
    }
  }

  async function showHistory(cellId, cellName) {
    const dialog = document.getElementById("cells-history-dialog");
    const title = document.getElementById("cells-history-title");
    const list = document.getElementById("cells-history-list");
    if (!dialog || !list) return;
    if (title) title.textContent = cellName;
    list.textContent = "Loading...";
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "true");
    try {
      const data = await remote.operationsHistory(getToken, { cellId });
      const operations = Array.isArray(data.operations) ? data.operations : [];
      list.innerHTML = operations.length
        ? operations.map((op) => `
            <div class="cells-history-item">
              <strong>Operation ${op.sequence}</strong> -- ${escapeHtml(op.needlepoint || op.mission || "Untitled")}
              <span>Round ${op.round || 0} · Archived ${escapeHtml(formatStamp(op.archived_at))}</span>
            </div>
          `).join("")
        : `<p class="local-note">No archived Operations yet for this Cell.</p>`;
    } catch (error) {
      list.innerHTML = `<p class="local-note is-error">${escapeHtml(error?.message || "Could not load Operation history.")}</p>`;
    }
  }

  function bindHistoryDialog() {
    const dialog = document.getElementById("cells-history-dialog");
    const closeBtn = document.getElementById("cells-history-close");
    if (closeBtn) closeBtn.addEventListener("click", () => {
      if (dialog && typeof dialog.close === "function") dialog.close();
      else if (dialog) dialog.removeAttribute("open");
    });
  }

  function bindCreateForm() {
    const form = document.getElementById("cells-create-form");
    if (!form) return;
    form.addEventListener("submit", async (evt) => {
      evt.preventDefault();
      const nameInput = document.getElementById("cells-create-name");
      const missionInput = document.getElementById("cells-create-mission");
      const needlepointInput = document.getElementById("cells-create-needlepoint");
      const cellName = (nameInput?.value || "").trim();
      if (!cellName) {
        setCreateStatus("Cell Name is required.", true);
        return;
      }
      const submitBtn = form.querySelector("button[type=submit]");
      if (submitBtn) submitBtn.disabled = true;
      setCreateStatus("Creating Cell...");
      try {
        const session = await remote.createSession(getToken, {
          cellName,
          mission: (missionInput?.value || "").trim(),
          needlepoint: (needlepointInput?.value || "").trim(),
          maxOperators: null,
        });
        // "Create Cell" IS "Open Cell" -- the new Cell is opened immediately by navigating
        // to the Live page's own deep-link bootstrap, exactly the same path "Resume" uses,
        // rather than duplicating attach/subscribe orchestration on this page.
        window.location.href = `../live/?cell=${encodeURIComponent(session.id)}`;
      } catch (error) {
        setCreateStatus(error?.message || "Could not create Cell.", true);
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  async function init() {
    bindCreateForm();
    bindHistoryDialog();
    const auth = await waitForVeilAuth(8000);
    if (!auth) {
      setListStatus("Could not load sign-in. Refresh to try again.", true);
      return;
    }
    if (!auth.getSession()) await auth.init();
    if (!auth.getUser()) {
      const headingEl = document.getElementById("cells-list-heading");
      if (headingEl) headingEl.textContent = "Sign in to see your Cells.";
      auth.showModal();
      auth.onChange?.(async (user) => {
        if (user) await renderCells();
      });
      return;
    }
    const handlerId = auth.getUser().id;
    remote.setActiveHandlerId?.(handlerId);
    // Best-effort: picks up whatever Cell is currently attached in THIS browser (from an
    // earlier Live page visit), purely so Suspend/Archive/Close can be surfaced on that one
    // matching card. Never attaches to anything new, never fails closed -- if nothing was
    // attached, every card just shows "Resume" only, exactly as if this were a fresh browser.
    remote.restoreConnection?.(getToken, "handler");
    await renderCells();
  }

  init();
}());
