(function () {
  const api = window.HandlerState;

  function renderAnchorBlock(card, npc, npcIndex, onStateChange) {
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
      button.textContent = entry.label;
      button.addEventListener("click", () => {
        openPreview(entry.id);
      });
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
      onStateChange(npcIndex, pendingStateId);
      pendingStateId = "";
    });

    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "button ghost";
    cancel.textContent = "Cancel";
    cancel.addEventListener("click", closePreview);

    actions.append(apply, cancel);
    preview.append(previewTitle, previewLines, actions);

    function openPreview(stateId) {
      pendingStateId = stateId;
      const entry = api.anchorNpcStates.find((item) => item.id === stateId);
      if (!entry) return;

      states.querySelectorAll(".npc-anchor-button").forEach((button) => {
        button.classList.toggle("is-pending", button.textContent === entry.label);
      });
      previewTitle.textContent = `Apply Anchor State: ${entry.label}?`;
      previewLines.textContent = "";
      previewLines.append(
        previewLine("Current", stateLabel(anchor.state)),
        previewLine("Pending", entry.label),
        previewLine("Handler guidance", entry.guidance || "No clock guidance.")
      );
      preview.hidden = false;
    }

    function closePreview() {
      pendingStateId = "";
      states.querySelectorAll(".npc-anchor-button").forEach((button) => {
        button.classList.remove("is-pending");
      });
      preview.hidden = true;
    }

    function stateLabel(stateId) {
      const entry = api.anchorNpcStates.find((item) => item.id === stateId);
      return entry ? entry.label : "Unset";
    }

    function previewLine(name, value) {
      const item = document.createElement("li");
      const label = document.createElement("span");
      label.textContent = name;
      const detail = document.createElement("strong");
      detail.textContent = value;
      item.append(label, detail);
      return item;
    }

    block.append(label, states, guidance, preview);
    card.append(block);
  }

  window.HandlerNpcAnchor = {
    renderAnchorBlock
  };
}());
