(function () {
  const api = window.HandlerState;

  function renderAnchorBlock(card, npc, npcIndex, onStateChange) {
    const anchor = npc.anchor;
    if (!anchor || !anchor.enabled) return;

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
        onStateChange(npcIndex, entry.id);
      });
      states.append(button);
    });

    const guidance = document.createElement("p");
    guidance.className = "npc-anchor-guidance";
    guidance.textContent = api.anchorGuidanceForState(anchor.state);

    block.append(label, states, guidance);
    card.append(block);
  }

  window.HandlerNpcAnchor = {
    renderAnchorBlock
  };
}());