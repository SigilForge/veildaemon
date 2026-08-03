/**
 * Live-page "Weave & Threads" dock -- collapsible reference/pull-in panel for whatever
 * Operation is currently attached. Shows the active Weave/Needlepoint, Threads already
 * linked to this Operation (with Unlink), a picker to pull in more from the Weave's full
 * Thread list, and a read-only Published Clues reference. This is deliberately a REFERENCE
 * panel, not a management one -- creating/renaming Weaves, editing Thread status/notes, and
 * drafting/publishing Clues stay on the separate Weave dashboard (handler/weave/), which is
 * where between-session curation belongs. This panel only ever calls `render(operation)`,
 * driven by handler-cell-sync.js's renderOperationLifecycle -- it never polls or pulls state
 * on its own.
 */
(function () {
  function getToken() {
    return async () => (window.VeilAuth?.getSession()?.access_token || null);
  }
  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[<>&"]/g, (ch) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[ch]));
  }

  let lastOperationId = "";
  let lastWeaveId = "";

  async function renderThreadsAndClues(cellId, weaveId, operationId) {
    const remote = window.VeilDaemonCellRemote;
    const linksList = document.getElementById("cell-weave-threads-list");
    const cluesList = document.getElementById("cell-weave-clues-list");
    const picker = document.getElementById("cell-weave-thread-picker");
    if (!remote || !linksList || !cluesList || !picker) return;

    let links = [];
    let allThreads = [];
    let clues = [];
    try {
      const [linksRes, threadsRes, cluesRes] = await Promise.all([
        remote.listOperationThreads(getToken(), { cellId, operationId }),
        remote.listThreads(getToken(), { cellId, weaveId }),
        remote.listClues(getToken(), { cellId, weaveId }),
      ]);
      links = Array.isArray(linksRes.links) ? linksRes.links : [];
      allThreads = Array.isArray(threadsRes.threads) ? threadsRes.threads : [];
      clues = Array.isArray(cluesRes.clues) ? cluesRes.clues : [];
    } catch (_error) {
      // Best-effort -- a failed reference-panel fetch never blocks the rest of the render.
      return;
    }

    const linkedIds = new Set(links.map((link) => link.thread.id));
    linksList.innerHTML = links.length
      ? links.map((link) => `
          <li class="cells-list-item" data-thread-id="${escapeHtml(link.thread.id)}">
            <div class="cells-list-item-header">
              <strong class="cells-list-item-name">${escapeHtml(link.thread.title)}</strong>
              <span class="cells-list-item-status">${escapeHtml((link.thread.status || "").toUpperCase())}</span>
            </div>
            <p class="cells-list-item-meta">${escapeHtml(link.note || "")}</p>
            <div class="cells-list-item-actions">
              <button class="button ghost small" type="button" data-unlink-thread="${escapeHtml(link.thread.id)}">Unlink</button>
            </div>
          </li>
        `).join("")
      : `<li class="cells-list-empty">No Threads pulled into this Operation yet.</li>`;
    linksList.querySelectorAll("[data-unlink-thread]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          await remote.unlinkThreadOperation(getToken(), { cellId, threadId: btn.getAttribute("data-unlink-thread"), operationId });
          await renderThreadsAndClues(cellId, weaveId, operationId);
        } catch (_error) {
          // Best-effort.
        }
      });
    });

    const pullable = allThreads.filter((thread) => !linkedIds.has(thread.id));
    picker.innerHTML = `<option value="">-- pull in a Thread --</option>` +
      pullable.map((thread) => `<option value="${escapeHtml(thread.id)}">${escapeHtml(thread.title)}</option>`).join("");

    cluesList.innerHTML = clues.length
      ? clues.map((clue) => `<li class="cells-list-item"><strong class="cells-list-item-name">${escapeHtml(clue.title)}</strong><p class="cells-list-item-operation">${escapeHtml(clue.body)}</p></li>`).join("")
      : `<li class="cells-list-empty">No Clues published yet.</li>`;
  }

  function bindPullInPicker() {
    const btn = document.getElementById("cell-weave-thread-link");
    if (!btn || btn.dataset.bound) return;
    btn.dataset.bound = "true";
    btn.addEventListener("click", async () => {
      const remote = window.VeilDaemonCellRemote;
      const picker = document.getElementById("cell-weave-thread-picker");
      const threadId = picker?.value;
      if (!remote || !threadId || !lastOperationId) return;
      const cellId = remote.currentConnection()?.sessionId;
      if (!cellId) return;
      try {
        await remote.linkThreadOperation(getToken(), { cellId, threadId, operationId: lastOperationId });
        await renderThreadsAndClues(cellId, lastWeaveId, lastOperationId);
      } catch (_error) {
        // Best-effort.
      }
    });
  }

  /** operation may be null (not connected / no active Operation) -- dock hides entirely.
   * Otherwise expects operation.needlepoint.weave_id (embedded by GET state -- see
   * api/cell/[action].js's handleState comment) to resolve which Weave this Operation
   * belongs to. */
  async function render(operation) {
    const dock = document.getElementById("cell-weave-dock");
    const summary = document.getElementById("cell-weave-summary");
    if (!dock) return;
    const remote = window.VeilDaemonCellRemote;
    const weaveId = operation?.needlepoint?.weave_id || "";
    const cellId = remote?.currentConnection()?.sessionId || "";
    if (!operation || !weaveId || !cellId) {
      dock.hidden = true;
      lastOperationId = "";
      lastWeaveId = "";
      return;
    }
    dock.hidden = false;
    bindPullInPicker();
    if (summary) {
      summary.textContent = `Needlepoint: ${operation.needlepoint.title || "Untitled"}${operation.needlepoint.published_at ? "" : " (draft -- players can't see this title yet)"}`;
    }
    // Re-fetch only when the Operation (and therefore possibly the Weave) actually changed --
    // renderOperationLifecycle polls every few seconds, and this panel shouldn't re-hit the
    // network on every one of those ticks for data that hasn't moved.
    if (operation.id === lastOperationId && weaveId === lastWeaveId) return;
    lastOperationId = operation.id;
    lastWeaveId = weaveId;
    await renderThreadsAndClues(cellId, weaveId, operation.id);
  }

  /** Forces a re-fetch of the Threads/Clues lists regardless of whether the Operation/Weave
   * changed -- for callers that just mutated something THIS panel displays from elsewhere
   * (e.g. the Promote-to-Thread dialog's onDone), where render()'s own dedup guard would
   * otherwise treat it as a no-op. */
  async function refresh() {
    const remote = window.VeilDaemonCellRemote;
    const cellId = remote?.currentConnection()?.sessionId;
    if (!cellId || !lastWeaveId || !lastOperationId) return;
    await renderThreadsAndClues(cellId, lastWeaveId, lastOperationId);
  }

  window.HandlerWeaveLivePanel = { render, refresh };
}());
