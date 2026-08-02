/**
 * Session-End Rewards: per-Operator resolution of the three things a completed Needlepoint
 * can promise (a lasting Mark/Scar, a recovered clue, a trust/distrust record) before
 * Archive Session is allowed to actually close the Cell -- see sessionRewardsResolved /
 * unresolvedSessionRewardPlayerNames in handler-state.js, which Archive Session's own click
 * handler in handler.js checks before proceeding.
 *
 * Mark vs Scar: an ontology-eligible Operator's real Scar is awarded through the existing
 * Presentation Drift panel (this module never bypasses that) -- this panel just confirms it
 * happened. An Operator with no eligible Presentation gets a Handler-authored "Lasting Mark"
 * instead, which may itself propose (never assign) an ontology grant; the Operator alone
 * accepts it, client-side, before it ever touches their ontologyPresentation.
 */
(function () {
  const api = window.HandlerState;

  function playersMount() {
    return document.getElementById("session-rewards-players");
  }

  function statusNode() {
    return document.getElementById("session-rewards-status");
  }

  function setStatus(message) {
    const node = statusNode();
    if (node) node.textContent = message || "";
  }

  function presentationOptionList() {
    const options = typeof api.presentationAssignableOptions === "function"
      ? api.presentationAssignableOptions()
      : Object.entries(api.presentationCatalog || {})
        .map(([key, entry]) => ({ key, ...entry }))
        .filter((entry) => entry.category === "presentation" && !entry.legacyAlias);
    return options.map((entry) => ({
      key: entry.key,
      label: entry.displayName || entry.label || entry.key
    }));
  }

  function field(labelText, inputEl) {
    const label = document.createElement("label");
    label.className = "session-reward-field";
    const span = document.createElement("span");
    span.textContent = labelText;
    label.append(span, inputEl);
    return label;
  }

  function statusBadge(status) {
    const badge = document.createElement("span");
    badge.className = `session-reward-status is-${status}`;
    badge.textContent = { pending: "PENDING", awarded: "AWARDED", declined: "DECLINED", na: "N/A" }[status] || status;
    return badge;
  }

  function resolutionButtons(onAward, { award = "Award", decline = "Decline", na = "N/A" } = {}) {
    const row = document.createElement("div");
    row.className = "session-reward-actions";
    const awardBtn = document.createElement("button");
    awardBtn.type = "button";
    awardBtn.className = "button primary";
    awardBtn.textContent = award;
    awardBtn.addEventListener("click", onAward);
    const declineBtn = document.createElement("button");
    declineBtn.type = "button";
    declineBtn.className = "button ghost";
    declineBtn.textContent = decline;
    declineBtn.dataset.declineAction = "true";
    const naBtn = document.createElement("button");
    naBtn.type = "button";
    naBtn.className = "button ghost";
    naBtn.textContent = na;
    naBtn.dataset.naAction = "true";
    row.append(awardBtn, declineBtn, naBtn);
    return { row, declineBtn, naBtn };
  }

  function commit(result, okMessage) {
    if (result && result.ok === false) {
      setStatus(result.message || "Could not apply.");
      return;
    }
    const nextState = result && result.state ? result.state : result;
    api.writeState(nextState, "SESSION REWARDS UPDATED");
    setStatus(okMessage);
    render();
  }

  function renderMarkSection(state, player, decision) {
    const section = document.createElement("div");
    section.className = "session-reward-category";
    const heading = document.createElement("div");
    heading.className = "session-reward-category-heading";
    const presentation = api.playerLoadPresentation ? api.playerLoadPresentation(player) : null;
    const kind = presentation ? "scar" : "mark";

    const title = document.createElement("h4");
    title.textContent = kind === "scar" ? "Scar (Presentation Drift)" : "Lasting Mark";
    heading.append(title, statusBadge(decision.mark.status));
    section.append(heading);

    if (kind === "scar") {
      const note = document.createElement("p");
      note.className = "tracker-note";
      note.textContent = `${player.name || "Operator"} has an eligible Presentation (${presentation.displayName || presentation.id}). Award the real Scar through the Presentation Drift panel above, then confirm it here -- this never awards a second, separate scar.`;
      section.append(note);
      const { row, declineBtn, naBtn } = resolutionButtons(() => {
        commit(api.awardSessionRewardMark(state, player.id, { label: `Scar confirmed via Presentation Drift (${presentation.displayName || presentation.id})` }),
          `${player.name}: Scar confirmed.`);
      }, { award: "Confirm Scar Awarded" });
      declineBtn.addEventListener("click", () => commit(api.declineSessionReward(state, player.id, "mark"), `${player.name}: Scar declined (none earned this session).`));
      naBtn.addEventListener("click", () => commit(api.markSessionRewardNotApplicable(state, player.id, "mark"), `${player.name}: Scar marked N/A.`));
      section.append(row);
      return section;
    }

    const labelInput = document.createElement("input");
    labelInput.type = "text";
    labelInput.maxLength = 120;
    labelInput.placeholder = "Mark label";
    labelInput.value = decision.mark.label || "";
    const benefitInput = document.createElement("textarea");
    benefitInput.rows = 2;
    benefitInput.placeholder = "Benefit";
    benefitInput.value = decision.mark.benefit || "";
    const costInput = document.createElement("textarea");
    costInput.rows = 2;
    costInput.placeholder = "Cost";
    costInput.value = decision.mark.cost || "";
    section.append(field("Label", labelInput), field("Benefit", benefitInput), field("Cost", costInput));

    const ontologyToggle = document.createElement("label");
    ontologyToggle.className = "session-reward-ontology-toggle";
    const ontologyCheckbox = document.createElement("input");
    ontologyCheckbox.type = "checkbox";
    ontologyCheckbox.checked = Boolean(decision.mark.ontologyGrant);
    ontologyToggle.append(ontologyCheckbox, document.createTextNode(" This Mark is the event that classifies them -- propose an ontology grant"));
    section.append(ontologyToggle);

    const ontologyFields = document.createElement("div");
    ontologyFields.className = "session-reward-ontology-fields";
    ontologyFields.hidden = !ontologyCheckbox.checked;
    const presentationSelect = document.createElement("select");
    presentationOptionList().forEach(({ key, label: optLabel }) => {
      const option = document.createElement("option");
      option.value = key;
      option.textContent = optLabel;
      presentationSelect.append(option);
    });
    if (decision.mark.ontologyGrant?.presentationKey) presentationSelect.value = decision.mark.ontologyGrant.presentationKey;
    const startingDriftInput = document.createElement("input");
    startingDriftInput.type = "number";
    startingDriftInput.min = "0";
    startingDriftInput.max = "6";
    startingDriftInput.value = String(decision.mark.ontologyGrant?.startingDrift ?? 1);
    const justificationInput = document.createElement("textarea");
    justificationInput.rows = 2;
    justificationInput.placeholder = "What specifically happened that this ontology answers -- not a random class pick.";
    justificationInput.value = decision.mark.ontologyGrant?.justification || "";
    ontologyFields.append(
      field("Ontology", presentationSelect),
      field("Starting Drift", startingDriftInput),
      field("Justification", justificationInput)
    );
    section.append(ontologyFields);
    ontologyCheckbox.addEventListener("change", () => { ontologyFields.hidden = !ontologyCheckbox.checked; });

    const { row, declineBtn, naBtn } = resolutionButtons(() => {
      const ontologyGrant = ontologyCheckbox.checked
        ? { presentationKey: presentationSelect.value, startingDrift: Number(startingDriftInput.value), justification: justificationInput.value }
        : null;
      commit(api.awardSessionRewardMark(state, player.id, {
        label: labelInput.value, benefit: benefitInput.value, cost: costInput.value, ontologyGrant
      }), `${player.name}: Mark awarded.`);
    });
    declineBtn.addEventListener("click", () => commit(api.declineSessionReward(state, player.id, "mark"), `${player.name}: Mark declined.`));
    naBtn.addEventListener("click", () => commit(api.markSessionRewardNotApplicable(state, player.id, "mark"), `${player.name}: Mark marked N/A.`));
    section.append(row);
    return section;
  }

  function renderClueSection(state, player, decision) {
    const section = document.createElement("div");
    section.className = "session-reward-category";
    const heading = document.createElement("div");
    heading.className = "session-reward-category-heading";
    const title = document.createElement("h4");
    title.textContent = "Recovered Clue";
    heading.append(title, statusBadge(decision.clue.status));
    section.append(heading);

    const clues = state.clueIntegrity?.clues || [];
    const select = document.createElement("select");
    const blank = document.createElement("option");
    blank.value = "";
    blank.textContent = clues.length ? "Select a clue..." : "No core clues loaded for this Needlepoint.";
    select.append(blank);
    clues.forEach((clue) => {
      const option = document.createElement("option");
      option.value = clue.id;
      option.textContent = `${api.clueIntegrityStateLabel(clue.state)} — ${api.safeString(clue.clue, 160)}`;
      if (clue.id === decision.clue.clueId) option.selected = true;
      select.append(option);
    });
    section.append(field("Clue", select));

    const { row, declineBtn, naBtn } = resolutionButtons(() => {
      if (!select.value) { setStatus("Select a clue first."); return; }
      commit(api.recoverSessionRewardClue(state, player.id, select.value), `${player.name}: clue recovered.`);
    });
    declineBtn.addEventListener("click", () => commit(api.declineSessionReward(state, player.id, "clue"), `${player.name}: clue reward declined.`));
    naBtn.addEventListener("click", () => commit(api.markSessionRewardNotApplicable(state, player.id, "clue"), `${player.name}: clue reward marked N/A.`));
    section.append(row);
    return section;
  }

  function renderTrustSection(state, player, decision) {
    const section = document.createElement("div");
    section.className = "session-reward-category";
    const heading = document.createElement("div");
    heading.className = "session-reward-category-heading";
    const title = document.createElement("h4");
    title.textContent = "Trust / Distrust";
    heading.append(title, statusBadge(decision.trust.status));
    section.append(heading);

    const targetInput = document.createElement("input");
    targetInput.type = "text";
    targetInput.maxLength = 120;
    targetInput.placeholder = "Who or what (e.g. VeilCorp)";
    targetInput.value = decision.trust.target || "";
    const stanceSelect = document.createElement("select");
    ["trust", "distrust"].forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value === "trust" ? "Trust" : "Distrust";
      if (decision.trust.stance === value) option.selected = true;
      stanceSelect.append(option);
    });
    const noteInput = document.createElement("textarea");
    noteInput.rows = 2;
    noteInput.placeholder = "Note / reason";
    noteInput.value = decision.trust.note || "";
    const sourceInput = document.createElement("input");
    sourceInput.type = "text";
    sourceInput.maxLength = 200;
    sourceInput.placeholder = "Source (e.g. Alex's human override)";
    sourceInput.value = decision.trust.source || "";
    section.append(field("Target", targetInput), field("Stance", stanceSelect), field("Note", noteInput), field("Source", sourceInput));

    const { row, declineBtn, naBtn } = resolutionButtons(() => {
      if (!targetInput.value.trim()) { setStatus("Enter a target first."); return; }
      commit(api.recordSessionRewardTrust(state, player.id, {
        target: targetInput.value, stance: stanceSelect.value, note: noteInput.value, source: sourceInput.value
      }), `${player.name}: ${stanceSelect.value} recorded.`);
    });
    declineBtn.addEventListener("click", () => commit(api.declineSessionReward(state, player.id, "trust"), `${player.name}: trust/distrust declined.`));
    naBtn.addEventListener("click", () => commit(api.markSessionRewardNotApplicable(state, player.id, "trust"), `${player.name}: trust/distrust marked N/A.`));
    section.append(row);
    return section;
  }

  function render() {
    const mount = playersMount();
    if (!mount) return;
    const state = api.readState();
    mount.textContent = "";
    const players = Array.isArray(state.players) ? state.players : [];
    if (!players.length) {
      const empty = document.createElement("p");
      empty.className = "session-reward-empty";
      empty.textContent = "No Operators seated.";
      mount.append(empty);
      return;
    }
    const decisions = state.sessionRewardDecisions || {};
    players.forEach((player) => {
      const decision = decisions[player.id];
      if (!decision) return;
      const card = document.createElement("article");
      card.className = "session-reward-player-card";
      const heading = document.createElement("h3");
      heading.textContent = player.name || "Operator";
      card.append(heading);
      card.append(renderMarkSection(state, player, decision));
      card.append(renderClueSection(state, player, decision));
      card.append(renderTrustSection(state, player, decision));
      mount.append(card);
    });
  }

  window.HandlerSessionRewards = { render };
  window.addEventListener("veildaemon:handler-state-updated", () => render());
  if (playersMount()) render();
}());
