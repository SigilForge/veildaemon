/**
 * Shared "Promote to Thread" dialog -- a single self-mounting <dialog>, injected into
 * document.body on first use, callable from any Live-page render point (clue-integrity
 * chips, NPC roster rows) via `window.HandlerWeavePromote.open({...})`. Prefills from the
 * caller's own real data (the actual clue text, the actual NPC fields) rather than asking
 * the Handler to retype anything into a blank form -- that retyping friction is exactly what
 * kept promotion confined to the separate Weave dashboard before this pass.
 *
 * Resolves cellId/weaveId itself from the live connection + the current Operation's own
 * Needlepoint (every Operation has one -- see 20260803140000_cell_operations_needlepoint_id
 * .sql -- so this never needs a Weave picker of its own; promoting into a DIFFERENT Weave
 * than the one currently in play is a Weave-dashboard job, not a live-play one). Requires
 * `window.HandlerCellSync.getLatestOperation()` (handler-cell-sync.js) and a live
 * `window.VeilDaemonCellRemote` connection -- silently unavailable (callers should not even
 * render their own "Promote" button) when either is missing, matching this file's own
 * degrade-gracefully convention on pages that never loaded cell-sync-remote.js at all.
 */
(function () {
  let dialog = null;
  let onDoneCallback = null;

  function getToken() {
    return async () => (window.VeilAuth?.getSession()?.access_token || null);
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[<>&"]/g, (ch) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[ch]));
  }

  function setError(message) {
    const node = document.getElementById("weave-promote-error");
    if (!node) return;
    node.textContent = message || "";
    node.hidden = !message;
  }

  function toggleEntityRow() {
    const kind = document.getElementById("weave-promote-kind")?.value;
    const row = document.getElementById("weave-promote-entity-row");
    if (row) row.hidden = kind !== "npc_entity";
  }

  async function populateEntityPicker(cellId) {
    const select = document.getElementById("weave-promote-entity");
    if (!select) return;
    select.innerHTML = `<option value="">-- none --</option>`;
    const remote = window.VeilDaemonCellRemote;
    if (!remote?.listCellEntities) return;
    try {
      const data = await remote.listCellEntities(getToken(), { cellId });
      const entities = Array.isArray(data.entities) ? data.entities : [];
      select.innerHTML += entities.map((e) => `<option value="${escapeHtml(e.id)}">${escapeHtml(e.name)} (${escapeHtml(e.kind)})</option>`).join("");
    } catch (_error) {
      // Best-effort -- the picker just stays at "-- none --" if this fails.
    }
  }

  function ensureDialog() {
    if (dialog) return dialog;
    dialog = document.createElement("dialog");
    dialog.id = "weave-promote-dialog";
    dialog.className = "cells-history-dialog";
    dialog.innerHTML = `
      <p class="kicker">PROMOTE TO THREAD</p>
      <h2>Campaign continuity (Handler-only)</h2>
      <p class="panel-note" id="weave-promote-error" hidden></p>
      <form id="weave-promote-form" data-live-control-zone>
        <label>Kind
          <select id="weave-promote-kind">
            <option value="clue">Clue</option>
            <option value="npc_entity">NPC / Entity</option>
            <option value="faction_pressure">Faction Pressure</option>
            <option value="consequence">Consequence</option>
            <option value="evidence">Evidence</option>
            <option value="discovery">Discovery</option>
            <option value="question">Unresolved Question</option>
          </select>
        </label>
        <label>Title<input type="text" id="weave-promote-title" maxlength="120" required /></label>
        <label>Notes<textarea id="weave-promote-notes" rows="3" maxlength="4000"></textarea></label>
        <div id="weave-promote-entity-row" hidden>
          <label>Link to Cell Entity (optional)
            <select id="weave-promote-entity"><option value="">-- none --</option></select>
          </label>
        </div>
        <div class="cells-list-item-actions">
          <button class="button primary" type="submit">Promote</button>
          <button class="button ghost" type="button" id="weave-promote-cancel">Cancel</button>
        </div>
      </form>
    `;
    document.body.append(dialog);

    document.getElementById("weave-promote-kind").addEventListener("change", toggleEntityRow);
    document.getElementById("weave-promote-cancel").addEventListener("click", () => closeDialog());
    document.getElementById("weave-promote-form").addEventListener("submit", async (evt) => {
      evt.preventDefault();
      const remote = window.VeilDaemonCellRemote;
      const cellId = dialog.dataset.cellId;
      const weaveId = dialog.dataset.weaveId;
      if (!remote || !cellId || !weaveId) {
        setError("Not connected to a Cell with an active Weave-tagged Operation.");
        return;
      }
      const kind = document.getElementById("weave-promote-kind").value;
      const title = document.getElementById("weave-promote-title").value.trim();
      const notes = document.getElementById("weave-promote-notes").value;
      const entityId = document.getElementById("weave-promote-entity").value || null;
      if (!title) return;
      const submitBtn = dialog.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;
      try {
        await remote.promoteThread(getToken(), {
          cellId, weaveId, kind, title, notes, entityId,
          sourceOperationId: dialog.dataset.sourceOperationId || null,
          sourceRef: dialog.dataset.sourceRef || "",
        });
        closeDialog();
        if (typeof onDoneCallback === "function") onDoneCallback();
      } catch (error) {
        setError(error?.message || "Could not promote to Thread.");
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });

    return dialog;
  }

  function closeDialog() {
    if (!dialog) return;
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  }

  /** kind/title/notes prefill from the caller's own real data (a clue's actual text, an
   * NPC's actual fields) -- editable in the dialog before submit, never required to be typed
   * from scratch. sourceOperationId/sourceRef are provenance only. */
  async function open({ kind, title, notes, sourceRef, sourceOperationId, onDone } = {}) {
    ensureDialog();
    setError("");
    const remote = window.VeilDaemonCellRemote;
    const cellSync = window.HandlerCellSync;
    const cellId = remote?.currentConnection()?.sessionId;
    const weaveId = cellSync?.getLatestOperation?.()?.needlepoint?.weave_id;
    if (!cellId || !weaveId) {
      setError("Connect to a Cell with an active Operation before promoting -- every Operation now belongs to a Needlepoint/Weave.");
    }
    dialog.dataset.cellId = cellId || "";
    dialog.dataset.weaveId = weaveId || "";
    dialog.dataset.sourceOperationId = sourceOperationId || "";
    dialog.dataset.sourceRef = sourceRef || "";
    document.getElementById("weave-promote-kind").value = kind || "evidence";
    document.getElementById("weave-promote-title").value = title || "";
    document.getElementById("weave-promote-notes").value = notes || "";
    onDoneCallback = onDone || null;
    toggleEntityRow();
    if (kind === "npc_entity" && cellId) await populateEntityPicker(cellId);
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "true");
  }

  window.HandlerWeavePromote = { open };
}());
