(function () {
  const api = window.HandlerState;

  function statusClass(status) {
    const key = api.safeString(status, 40).toLowerCase();
    return `track-prompt-status is-${key}`;
  }

  function trackLabel(track) {
    const pp = typeof window !== "undefined" ? window.PresentationPressure : null;
    if (pp && String(track || "").endsWith("_load")) {
      const presentation = pp.presentationForLoadTrackKind(track);
      return presentation?.trackLabel || String(track).replace(/_/g, " ");
    }
    return track === "harm" ? "Harm" : "Stability";
  }

  function afterChangeLabel(prompt) {
    if (String(prompt.track || "").endsWith("_load")) {
      return `${prompt.projectedValue}/6 — ${api.safeString(prompt.projectedBand, 40)}`;
    }
    if (prompt.track === "harm") {
      return `${prompt.projectedValue}/5 — ${api.safeString(prompt.projectedCondition, 40)}`;
    }
    return `${prompt.projectedValue}/10 — ${api.safeString(prompt.projectedBand, 40)}`;
  }

  function deltaLabel(prompt) {
    const delta = Number(prompt.delta) || 0;
    const sign = delta > 0 ? "+" : "";
    return `${sign}${delta}`;
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_error) {
      return false;
    }
  }

  function renderPromptCard(prompt, onChange, setStatusMessage) {
    const card = document.createElement("article");
    card.className = "track-prompt-card";
    card.dataset.promptId = prompt.id;

    const head = document.createElement("div");
    head.className = "track-prompt-head";
    head.innerHTML = `
      <div>
        <strong>${api.safeString(prompt.operatorName, 80)}</strong>
        <span>${trackLabel(prompt.track)} ${deltaLabel(prompt)}</span>
      </div>
      <span class="${statusClass(prompt.status)}">${api.safeString(prompt.status, 40)}</span>
    `;

    const meta = document.createElement("dl");
    meta.className = "track-prompt-meta";
    meta.innerHTML = `
      <div><dt>Source</dt><dd>${api.safeString(prompt.source, 80)}</dd></div>
      <div><dt>Reason</dt><dd>${api.safeString(prompt.reason, 240) || "—"}</dd></div>
      <div><dt>After change</dt><dd>${afterChangeLabel(prompt)}</dd></div>
    `;

    const copyBlock = document.createElement("pre");
    copyBlock.className = "track-prompt-copy";
    copyBlock.textContent = prompt.suggestedCopy || api.buildTrackPromptCopy(prompt);

    const note = document.createElement("p");
    note.className = "track-prompt-note";
    note.textContent = prompt.handlerNote ? `Note: ${prompt.handlerNote}` : "";

    const actions = document.createElement("div");
    actions.className = "track-prompt-actions";

    const announce = document.createElement("button");
    announce.type = "button";
    announce.className = "button";
    announce.textContent = "Announce to Operator";
    announce.addEventListener("click", async () => {
      const copied = await copyText(copyBlock.textContent);
      onChange(
        api.updateTrackPromptStatus(api.readState(), prompt.id, "Announced"),
        copied ? "Prompt copied. Tell the Operator to update their sheet." : "Prompt marked Announced."
      );
    });

    const markAnnounced = document.createElement("button");
    markAnnounced.type = "button";
    markAnnounced.className = "button ghost";
    markAnnounced.textContent = "Mark Announced";
    markAnnounced.addEventListener("click", () => {
      onChange(api.updateTrackPromptStatus(api.readState(), prompt.id, "Announced"), "Prompt marked Announced.");
    });

    const resolve = document.createElement("button");
    resolve.type = "button";
    resolve.className = "button primary";
    resolve.textContent = "Resolve";
    resolve.addEventListener("click", () => {
      onChange(api.resolveTrackPrompt(api.readState(), prompt.id, { applySummary: true }), "Prompt resolved. Handler summary updated.");
    });

    const undo = document.createElement("button");
    undo.type = "button";
    undo.className = "button danger ghost";
    undo.textContent = "Undo";
    undo.addEventListener("click", () => {
      onChange(api.undoTrackPrompt(api.readState(), prompt.id), "Prompt removed.");
    });

    actions.append(announce, markAnnounced, resolve, undo);
    card.append(head, meta, copyBlock);
    if (prompt.handlerNote) card.append(note);
    card.append(actions);
    return card;
  }

  function renderGlobalQueueForm(mount, state, onChange, setStatusMessage) {
    const players = Array.isArray(state.players) ? state.players : [];
    if (!players.length) return;

    const form = document.createElement("div");
    form.className = "track-prompt-global-form";
    form.setAttribute("data-live-control-zone", "true");
    form.innerHTML = `
      <p class="pressure-sublabel">Queue Operator Update</p>
      <div class="track-prompt-quick-grid">
        <label>Operator<select data-queue-operator>
          ${players.map((player, index) => `<option value="${index}">${api.safeString(player.name, 80) || `Operator ${index + 1}`}</option>`).join("")}
        </select></label>
        <label>Track<select data-queue-track>
          <option value="stability">Stability</option>
          <option value="harm">Harm</option>
        </select></label>
        <label>Change<select data-queue-delta>
          <option value="-3">-3</option>
          <option value="-2">-2</option>
          <option value="-1">-1</option>
          <option value="1">+1</option>
          <option value="2">+2</option>
        </select></label>
        <label>Source<select data-queue-source>
          ${api.trackPromptSources.map((source) => `<option>${source}</option>`).join("")}
        </select></label>
      </div>
      <label>Reason<input data-queue-reason maxlength="240" placeholder="Failed Stability Defense inside Echoed Zone." /></label>
      <label>Handler note<input data-queue-note maxlength="300" placeholder="The room remembers your voice." /></label>
      <button type="button" class="button" data-queue-submit>Queue Update</button>
    `;

    form.querySelector("[data-queue-submit]")?.addEventListener("click", () => {
      const operatorIndex = Number(form.querySelector("[data-queue-operator]")?.value || 0);
      const track = form.querySelector("[data-queue-track]")?.value || "stability";
      const delta = Number(form.querySelector("[data-queue-delta]")?.value || -1);
      const source = form.querySelector("[data-queue-source]")?.value || "Manual";
      const reason = form.querySelector("[data-queue-reason]")?.value || "";
      const handlerNote = form.querySelector("[data-queue-note]")?.value || "";
      const next = api.createTrackPrompt(api.readState(), {
        operatorIndex,
        track,
        delta,
        source,
        reason,
        handlerNote
      });
      onChange(next);
      if (setStatusMessage) {
        const created = next.trackPromptQueue?.[0];
        setStatusMessage(created
          ? `Queued ${trackLabel(created.track)} ${deltaLabel(created)} for ${created.operatorName}.`
          : "Prompt queued.");
      }
      const reasonInput = form.querySelector("[data-queue-reason]");
      const noteInput = form.querySelector("[data-queue-note]");
      if (reasonInput) reasonInput.value = "";
      if (noteInput) noteInput.value = "";
    });

    mount.append(form);
  }

  function renderQueue(mount, state, onChange, setStatusMessage) {
    if (!mount) return;
    mount.textContent = "";
    mount.className = "track-prompt-queue";
    mount.setAttribute("data-live-control-zone", "true");

    const queue = Array.isArray(state.trackPromptQueue) ? state.trackPromptQueue : [];
    const pending = queue.filter((item) => item.status !== "Resolved");
    const resolved = queue.filter((item) => item.status === "Resolved");

    if (pending.length) {
      const alert = document.createElement("div");
      alert.className = "track-prompt-pending-alert";
      alert.setAttribute("role", "alert");
      const unannounced = pending.filter((item) => item.status === "Pending").length;
      alert.textContent = unannounced
        ? `${pending.length} pending — ${unannounced} still need announcement at the table before Operators update their sheets.`
        : `${pending.length} pending — announced, waiting on Operator sheet updates.`;
      mount.append(alert);
    }

    const summary = document.createElement("div");
    summary.className = "track-prompt-summary";
    summary.innerHTML = `
      <span><strong>${pending.length}</strong> pending</span>
      <span><strong>${resolved.length}</strong> resolved</span>
    `;
    mount.append(summary);

    if (!queue.length) {
      const empty = document.createElement("p");
      empty.className = "track-prompt-empty";
      empty.textContent = "No queued Operator track updates. Table triggers auto-queue Stability damage — tap Operators in the trigger preview to choose who was in the blast radius.";
      mount.append(empty);
      return;
    }

    const list = document.createElement("div");
    list.className = "track-prompt-list";
    queue.forEach((prompt) => {
      list.append(renderPromptCard(prompt, (nextState, message) => {
        onChange(nextState);
        if (setStatusMessage && message) setStatusMessage(message);
      }, setStatusMessage));
    });
    mount.append(list);
  }

  function renderQuickQueueForm(mount, state, operatorIndex, onChange, setStatusMessage) {
    if (!mount) return;
    const player = state.players?.[operatorIndex];
    if (!player) return;

    mount.className = "track-prompt-quick-form";
    mount.setAttribute("data-live-control-zone", "true");
    mount.innerHTML = `
      <p class="pressure-sublabel">Queue Operator Update</p>
      <div class="track-prompt-quick-grid">
        <label>Track<select data-queue-track>
          <option value="stability">Stability</option>
          <option value="harm">Harm</option>
        </select></label>
        <label>Change<select data-queue-delta>
          <option value="-3">-3</option>
          <option value="-2">-2</option>
          <option value="-1">-1</option>
          <option value="1">+1</option>
          <option value="2">+2</option>
        </select></label>
        <label>Source<select data-queue-source>
          ${api.trackPromptSources.map((source) => `<option>${source}</option>`).join("")}
        </select></label>
      </div>
      <label>Reason<input data-queue-reason maxlength="240" placeholder="Failed Stability Defense inside Echoed Zone." /></label>
      <label>Handler note<input data-queue-note maxlength="300" placeholder="The room remembers your voice." /></label>
      <button type="button" class="button" data-queue-submit>Queue Update</button>
    `;

    const submit = mount.querySelector("[data-queue-submit]");
    if (!submit) return;
    submit.addEventListener("click", () => {
      const track = mount.querySelector("[data-queue-track]")?.value || "stability";
      const delta = Number(mount.querySelector("[data-queue-delta]")?.value || -1);
      const source = mount.querySelector("[data-queue-source]")?.value || "Manual";
      const reason = mount.querySelector("[data-queue-reason]")?.value || "";
      const handlerNote = mount.querySelector("[data-queue-note]")?.value || "";
      const next = api.createTrackPrompt(api.readState(), {
        operatorIndex,
        track,
        delta,
        source,
        reason,
        handlerNote
      });
      onChange(next);
      if (setStatusMessage) {
        const created = next.trackPromptQueue?.[0];
        setStatusMessage(created
          ? `Queued ${trackLabel(created.track)} ${deltaLabel(created)} for ${created.operatorName}.`
          : "Prompt queued.");
      }
      mount.querySelector("[data-queue-reason]").value = "";
      mount.querySelector("[data-queue-note]").value = "";
    });
  }

  window.HandlerTrackPromptQueue = {
    renderQueue,
    renderQuickQueueForm
  };
}());