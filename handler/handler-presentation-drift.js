/**
 * Handler-only Presentation Drift / Scar award workflow. Loaded only by handler/live/index.html
 * (the one page with an active Cell-sync session) -- Drift has no Operator-facing self-entry
 * point at all, so it can only ever reach the Operator's sheet as a Handler-authored, absolute
 * Cell-sync projection (see cell-sync.js's presentationDriftState). This panel is the only
 * place that projection gets built.
 *
 * One Collapse creates at most one Drift. Every deferred consequence remains resolvable
 * without manufacturing another Collapse. See presentation-drift.js for the full contract.
 */
(function () {
  const api = window.HandlerState;

  function driftApi() {
    return window.PresentationDrift;
  }

  function tierLabelFor(tierId) {
    return driftApi()?.DRIFT_THRESHOLDS.find((entry) => entry.id === tierId)?.label || tierId;
  }

  function noteLine(text, className) {
    const p = document.createElement("p");
    p.className = className || "presentation-drift-panel-note";
    p.textContent = text;
    return p;
  }

  function actionButton(label, className, handler) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className || "button ghost";
    button.textContent = label;
    button.addEventListener("click", handler);
    return button;
  }

  function choiceButton(label, active, title, handler) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "staging-choice-button";
    button.classList.toggle("is-active", Boolean(active));
    if (title) button.title = title;
    button.textContent = label;
    button.addEventListener("click", handler);
    return button;
  }

  function scarOptionButton(candidate, active, onPick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "presentation-drift-option-card";
    button.classList.toggle("is-active", Boolean(active));
    const title = document.createElement("strong");
    title.textContent = candidate.label;
    button.append(title);
    if (candidate.benefit) {
      const benefit = document.createElement("span");
      benefit.textContent = `Benefit: ${candidate.benefit}`;
      button.append(benefit);
    }
    if (candidate.cost) {
      const cost = document.createElement("span");
      cost.textContent = `Cost: ${candidate.cost}`;
      button.append(cost);
    }
    button.addEventListener("click", () => onPick(candidate.id));
    return button;
  }

  function loadAfterField(defaultValue) {
    const label = document.createElement("label");
    label.className = "presentation-drift-field";
    label.textContent = "Load after Collapse (0-5)";
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.max = "5";
    input.value = String(defaultValue ?? 0);
    input.className = "presentation-drift-load-after";
    label.append(input);
    return { field: label, input };
  }

  function noteField(placeholder) {
    const label = document.createElement("label");
    label.className = "presentation-drift-field";
    label.textContent = "Immediate Consequence";
    const textarea = document.createElement("textarea");
    textarea.rows = 2;
    textarea.maxLength = 300;
    if (placeholder) textarea.placeholder = placeholder;
    label.append(textarea);
    return { field: label, input: textarea };
  }

  /** Resolve Collapse -- the picker branches on what Drift value resolving would land on. */
  function buildResolveForm(player, playerIndex, presentation, view, options) {
    const drift = driftApi();
    const nextValue = Math.min(6, view.value + 1);
    const isScarThreshold = nextValue === 1 || nextValue === 3 || nextValue === 5;
    const isDevelopmentPoint = nextValue === 2 || nextValue === 4;
    const isThresholdState = nextValue === 6;
    const nextTier = drift.driftTierForValue(nextValue);

    const wrap = document.createElement("div");
    wrap.className = "presentation-drift-resolve-form";

    wrap.append(noteLine(`Resolving will raise Drift to ${nextValue} (${nextTier ? nextTier.label : "Unmarked"}).`));

    let chosenScarChoice = null;
    let chosenDevelopmentChoice = null;
    let chosenDecisionId = null;

    if (isScarThreshold) {
      const options_ = drift.eligibleScarOptions(presentation.id, nextTier?.id);
      const cardsWrap = document.createElement("div");
      cardsWrap.className = "presentation-drift-option-grid";
      const rerenderActive = () => {
        cardsWrap.querySelectorAll("[data-scar-choice]").forEach((node) => {
          node.classList.toggle("is-active", node.dataset.scarChoice === chosenScarChoice);
        });
      };
      options_.forEach((candidate) => {
        const card = scarOptionButton(candidate, false, (id) => {
          chosenScarChoice = id;
          rerenderActive();
        });
        card.dataset.scarChoice = candidate.id;
        cardsWrap.append(card);
      });
      const deferButton = choiceButton("Defer — decide later", false, "", () => {
        chosenScarChoice = "defer";
        rerenderActive();
      });
      deferButton.dataset.scarChoice = "defer";
      const refuseButton = choiceButton("Refuse — table declines this tier", false, "", () => {
        chosenScarChoice = "refuse";
        rerenderActive();
      });
      refuseButton.dataset.scarChoice = "refuse";
      cardsWrap.append(deferButton, refuseButton);
      wrap.append(cardsWrap);
    }

    if (isDevelopmentPoint) {
      const select = document.createElement("select");
      select.className = "presentation-drift-development-target";
      const scarGroup = document.createElement("optgroup");
      scarGroup.label = "Develop an existing Scar";
      view.scars.forEach((entry) => {
        const opt = document.createElement("option");
        opt.value = `scar:${entry.scarId}`;
        opt.textContent = entry.label;
        scarGroup.append(opt);
      });
      if (scarGroup.children.length) select.append(scarGroup);

      const pendingGroup = document.createElement("optgroup");
      pendingGroup.label = "Attach to a still-deferred tier";
      view.pendingScarChoices.filter((entry) => entry.status === "deferred").forEach((entry) => {
        const opt = document.createElement("option");
        opt.value = `pending:${entry.tier}`;
        opt.textContent = tierLabelFor(entry.tier);
        pendingGroup.append(opt);
      });
      if (pendingGroup.children.length) select.append(pendingGroup);

      const standaloneOpt = document.createElement("option");
      standaloneOpt.value = "standalone";
      standaloneOpt.textContent = "Standalone adaptation (no Scar to attach to)";
      select.append(standaloneOpt);

      const changeTypeSelect = document.createElement("select");
      changeTypeSelect.className = "presentation-drift-change-type";
      drift.SCAR_CHANGE_TYPES.forEach((type) => {
        const opt = document.createElement("option");
        opt.value = type;
        opt.textContent = type.replace("_", " ");
        changeTypeSelect.append(opt);
      });

      chosenDevelopmentChoice = { target: select, changeType: changeTypeSelect };
      const targetLabel = document.createElement("label");
      targetLabel.className = "presentation-drift-field";
      targetLabel.textContent = "Scar Development target";
      targetLabel.append(select);
      const typeLabel = document.createElement("label");
      typeLabel.className = "presentation-drift-field";
      typeLabel.textContent = "Change type";
      typeLabel.append(changeTypeSelect);
      wrap.append(targetLabel, typeLabel);
    }

    if (isThresholdState) {
      const grid = document.createElement("div");
      grid.className = "staging-choice-grid";
      grid.setAttribute("role", "group");
      grid.setAttribute("aria-label", "Threshold Decision");
      drift.THRESHOLD_DECISIONS.forEach((decision) => {
        const button = choiceButton(decision.label, false, decision.description, () => {
          chosenDecisionId = decision.id;
          grid.querySelectorAll("button").forEach((node) => node.classList.remove("is-active"));
          button.classList.add("is-active");
        });
        grid.append(button);
      });
      wrap.append(noteLine("Drift 6 requires a Threshold Decision -- required, no skip."), grid);
    }

    const { field: loadField, input: loadInput } = loadAfterField(0);
    const { field: noteFieldEl, input: noteInput } = noteField("What did the Presentation use to survive?");
    wrap.append(loadField, noteFieldEl);

    const errorLine = noteLine("", "presentation-ability-meta presentation-ability-risk");
    errorLine.hidden = true;
    wrap.append(errorLine);

    const confirm = actionButton("Resolve Collapse", "button primary", () => {
      // Disable synchronously, before any state write -- closes the double-click race window,
      // per the explicit "disable immediately, before Cell sync" requirement.
      confirm.disabled = true;
      errorLine.hidden = true;

      let chosenScarId;
      if (isScarThreshold) chosenScarId = chosenScarChoice;

      const result = drift.applyCollapseDriftResolve(player.operatorStatus, presentation.id, {
        loadAfter: Number(loadInput.value),
        chosenScarId,
        thresholdDecisionId: chosenDecisionId || undefined,
        consequenceNote: noteInput.value
      });

      if (!result.ok) {
        errorLine.textContent = result.reason || "Could not resolve Collapse.";
        errorLine.hidden = false;
        confirm.disabled = false;
        return;
      }

      let nextStatus = result.status;
      if (isDevelopmentPoint && chosenDevelopmentChoice) {
        const targetValue = chosenDevelopmentChoice.target.value;
        const changeType = chosenDevelopmentChoice.changeType.value;
        const devOptions = { driftValue: nextValue, changeType, note: noteInput.value };
        if (targetValue.startsWith("scar:")) {
          devOptions.scarId = targetValue.slice(5);
        } else if (targetValue.startsWith("pending:")) {
          devOptions.tier = targetValue.slice(8);
        }
        const devResult = drift.applyScarDevelopment(nextStatus, presentation.id, devOptions);
        if (devResult.ok) nextStatus = devResult.status;
      }

      options.onStateChange(playerIndex, nextStatus, "Drift recorded — Sync Cell to deliver it to the Operator.");
    });
    wrap.append(confirm);

    return wrap;
  }

  function buildRecognizeButton(player, playerIndex, presentation, options) {
    const drift = driftApi();
    const wrap = document.createElement("div");
    wrap.className = "presentation-drift-legacy-recovery";
    wrap.append(noteLine(
      "This Load 6 state has no eligible Collapse ID -- likely a save from before this workflow existed.",
      "presentation-ability-meta presentation-ability-risk"
    ));
    wrap.append(actionButton("Recognize Existing Unresolved Collapse", "button ghost", (event) => {
      event.currentTarget.disabled = true;
      const result = drift.recognizeExistingCollapse(player.operatorStatus, presentation.id);
      if (!result.ok) {
        event.currentTarget.disabled = false;
        options.setStatusMessage?.(result.reason || "Could not recognize existing Collapse.", true);
        return;
      }
      options.onStateChange(playerIndex, result.status, "Legacy Collapse recognized — Resolve Collapse is now available.");
    }));
    return wrap;
  }

  function buildDeferredScarForm(player, playerIndex, presentation, pending, options) {
    const drift = driftApi();
    const candidates = drift.eligibleScarOptions(presentation.id, pending.tier);
    const wrap = document.createElement("div");
    wrap.className = "presentation-drift-deferred-form";
    wrap.append(noteLine(`Deferred Scar choice — ${tierLabelFor(pending.tier)} (Drift ${pending.unlockedAtDrift})`));

    let chosen = null;
    const cardsWrap = document.createElement("div");
    cardsWrap.className = "presentation-drift-option-grid";
    candidates.forEach((candidate) => {
      const card = scarOptionButton(candidate, false, (id) => {
        chosen = id;
        cardsWrap.querySelectorAll("[data-scar-choice]").forEach((node) => {
          node.classList.toggle("is-active", node.dataset.scarChoice === chosen);
        });
      });
      card.dataset.scarChoice = candidate.id;
      cardsWrap.append(card);
    });
    wrap.append(cardsWrap);

    const errorLine = noteLine("", "presentation-ability-meta presentation-ability-risk");
    errorLine.hidden = true;
    wrap.append(errorLine);

    wrap.append(actionButton("Resolve Deferred Scar", "button ghost", (event) => {
      event.currentTarget.disabled = true;
      errorLine.hidden = true;
      const result = drift.resolveDeferredScar(player.operatorStatus, presentation.id, pending.id, chosen);
      if (!result.ok) {
        errorLine.textContent = result.reason || "Could not resolve deferred Scar.";
        errorLine.hidden = false;
        event.currentTarget.disabled = false;
        return;
      }
      options.onStateChange(playerIndex, result.status, "Deferred Scar resolved — Sync Cell to deliver it to the Operator.");
    }));

    return wrap;
  }

  function renderPanel(mount, player, playerIndex, options = {}) {
    if (!mount) return;
    mount.textContent = "";
    const drift = driftApi();
    const presentation = api.playerLoadPresentation?.(player);
    if (!drift || !presentation) {
      mount.hidden = true;
      return;
    }
    mount.hidden = false;
    mount.className = "presentation-drift-panel";
    mount.setAttribute("data-live-control-zone", "true");

    const status = player.operatorStatus && typeof player.operatorStatus === "object" ? player.operatorStatus : {};
    const view = drift.presentationDriftView(status, presentation.id);
    if (!view) {
      mount.hidden = true;
      return;
    }

    const heading = document.createElement("p");
    heading.className = "pressure-sublabel";
    heading.textContent = `${presentation.label} Drift`;
    mount.append(heading);

    const summary = document.createElement("p");
    summary.className = "presentation-drift-panel-summary";
    summary.innerHTML = `<strong>Drift ${view.value}</strong> · ${view.tier ? view.tier.label : "Unmarked"}`;
    mount.append(summary);

    if (view.thresholdDecision) {
      mount.append(noteLine(
        `Threshold Decision recorded: ${view.thresholdDecision.label.toUpperCase()}`,
        "presentation-ability-meta presentation-ability-risk"
      ));
    }

    const log = drift.presentationDriftLog(status, presentation.id);
    if (log.length) {
      const logWrap = document.createElement("div");
      logWrap.className = "presentation-drift-log-handler";
      const logTitle = document.createElement("p");
      logTitle.className = "presentation-ability-group-label";
      logTitle.textContent = "Collapse Record (Handler only)";
      logWrap.append(logTitle);
      log.slice(0, 4).forEach((entry) => {
        const stamp = entry.resolvedAt ? entry.resolvedAt.replace("T", " ").slice(0, 16) : "—";
        logWrap.append(noteLine(
          `${stamp} — Load 6 → Load ${entry.loadAfter}, Drift ${entry.driftBefore} → ${entry.driftAfter}` +
          (entry.recoveredFromLegacyState ? " (legacy recovery)" : "")
        ));
      });
      mount.append(logWrap);
    }

    if (view.driftEligibleCollapseId) {
      mount.append(buildResolveForm(player, playerIndex, presentation, view, options));
    } else if (view.load >= 6) {
      mount.append(buildRecognizeButton(player, playerIndex, presentation, options));
    }

    view.pendingScarChoices.forEach((pending) => {
      if (pending.status !== "deferred") {
        mount.append(noteLine(`${tierLabelFor(pending.tier)}: refused at Drift ${pending.unlockedAtDrift}.`));
        return;
      }
      mount.append(buildDeferredScarForm(player, playerIndex, presentation, pending, options));
    });
  }

  window.HandlerPresentationDrift = { renderPanel };
}());
