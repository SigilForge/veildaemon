(function () {
  const api = window.HandlerState;

  function renderAnchorBlock(card, npc, npcIndex, onApply) {
    const anchor = npc.anchor;
    if (!anchor || !anchor.enabled) return;
    let pendingStateId = "";

    const block = document.createElement("div");
    block.className = "npc-anchor-block";
    block.setAttribute("data-live-control-zone", "true");

    const label = document.createElement("p");
    label.className = "npc-anchor-label";
    label.textContent = anchor.label || "Anchor NPC";

    const states = document.createElement("div");
    states.className = "npc-anchor-states";
    states.setAttribute("role", "group");
    states.setAttribute("aria-label", `${anchor.label || "Anchor NPC"} state`);

    api.anchorNpcStates.forEach((entry) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "npc-anchor-button";
      button.classList.toggle("is-active", anchor.state === entry.id);
      button.classList.toggle("is-pending", pendingStateId === entry.id);
      button.textContent = entry.label;
      button.addEventListener("click", () => openPreview(entry.id));
      states.append(button);
    });

    const guidance = document.createElement("p");
    guidance.className = "npc-anchor-guidance";
    guidance.textContent = api.anchorGuidanceForState(anchor.state);

    const preview = document.createElement("div");
    preview.className = "npc-anchor-preview";
    preview.hidden = true;

    const previewTitle = document.createElement("p");
    previewTitle.className = "trigger-preview-title";

    const previewLines = document.createElement("ul");
    previewLines.className = "trigger-preview-lines";

    const actions = document.createElement("div");
    actions.className = "trigger-preview-actions";

    const apply = document.createElement("button");
    apply.type = "button";
    apply.className = "button primary";
    apply.textContent = "Apply";
    apply.addEventListener("click", () => {
      if (!pendingStateId) return;
      const result = api.applyAnchorNpcState(api.readState(), npcIndex, pendingStateId);
      if (!result.ok) return;
      if (typeof onApply === "function") onApply(result);
      window.dispatchEvent(new CustomEvent("veildaemon:handler-anchor-updated", {
        detail: { state: result.state, message: result.message, npcIndex, stateId: pendingStateId }
      }));
      closePreview();
    });

    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "button ghost";
    cancel.textContent = "Cancel";
    cancel.addEventListener("click", closePreview);

    actions.append(apply, cancel);
    preview.append(previewTitle, previewLines, actions);

    function openPreview(stateId) {
      const previewData = api.previewAnchorNpcState(api.readState(), npcIndex, stateId);
      if (!previewData) return;

      pendingStateId = stateId;
      states.querySelectorAll(".npc-anchor-button").forEach((button) => {
        button.classList.toggle("is-pending", button.textContent === previewData.entry.label);
      });
      previewTitle.textContent = `Apply Anchor State: ${previewData.entry.label}?`;
      previewLines.textContent = "";
      previewData.lines.forEach((row) => {
        const item = document.createElement("li");
        if (row.before === "") {
          item.innerHTML = `<span>${api.safeString(row.label, 80)}</span><strong>${api.safeString(row.after, 220)}</strong>`;
        } else if (row.before === row.after) {
          return;
        } else {
          item.innerHTML = `<span>${api.safeString(row.label, 80)}</span><strong>${api.safeString(row.before, 80)} -> ${api.safeString(row.after, 80)}</strong>`;
        }
        previewLines.append(item);
      });
      preview.hidden = false;
    }

    function closePreview() {
      pendingStateId = "";
      states.querySelectorAll(".npc-anchor-button").forEach((button) => {
        button.classList.remove("is-pending");
      });
      preview.hidden = true;
    }

    block.append(label, states, guidance, preview);
    card.append(block);
  }

  window.HandlerNpcAnchor = {
    renderAnchorBlock
  };
}());