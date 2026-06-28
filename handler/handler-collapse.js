(function () {
  const api = window.HandlerState;

  function mountNode() {
    return document.getElementById("collapse-rewrite-mount");
  }

  function shouldShow(state) {
    const collapse = state.collapse || {};
    const rewrite = state.rewrite || {};
    return Boolean(
      collapse.ready
      || collapse.active
      || rewrite.ready
      || rewrite.active
      || collapse.breakType
      || rewrite.overwriteType
    );
  }

  function emitState(nextState, statusText) {
    window.dispatchEvent(new CustomEvent("veildaemon:handler-collapse-updated", {
      detail: { state: nextState, statusText }
    }));
  }

  function choiceGrid(values, activeValue, datasetKey, handler) {
    const grid = document.createElement("div");
    grid.className = "staging-choice-grid";
    grid.setAttribute("role", "group");
    values.forEach((value) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "staging-choice-button";
      button.classList.toggle("is-active", value === activeValue);
      button.dataset[datasetKey] = value;
      button.textContent = value;
      button.addEventListener("click", handler);
      grid.append(button);
    });
    return grid;
  }

  function stagingFieldsEditable() {
    return api.fieldEditUnlocked();
  }

  function stagingField(label, name, value, rows = 2) {
    const wrap = document.createElement("label");
    wrap.className = "staging-field";
    wrap.textContent = label;
    const input = document.createElement("textarea");
    const editable = stagingFieldsEditable();
    input.name = name;
    input.rows = rows;
    input.maxLength = 500;
    input.value = value || "";
    input.readOnly = !editable;
    input.classList.toggle("is-field-locked", !editable);
    input.setAttribute("aria-readonly", editable ? "false" : "true");
    wrap.append(input);
    return wrap;
  }

  function bindStagingFieldEdits(mount) {
    if (!stagingFieldsEditable()) return;
    mount.querySelectorAll("textarea[name^='collapse.'], textarea[name^='rewrite.']").forEach((input) => {
      input.addEventListener("change", () => {
        const current = api.readState();
        api.setPath(current, input.name, api.safeString(input.value, 500));
        const next = input.name.startsWith("collapse.")
          ? api.markCollapseFieldsEdited(current)
          : api.normalizeState(current);
        emitState(next, "STAGING SAVED");
      });
    });
  }

  function applyStagingFieldLock() {
    if (window.HandlerNav) window.HandlerNav.applyFieldEditLock();
  }

  function selectCollapseBreakType(breakType) {
    const current = api.readState();
    if (api.collapseBreakTypeChangeNeedsConfirm(current, breakType)) {
      const confirmed = window.confirm(
        `Replace manually edited collapse staging with ${breakType} text?`
      );
      if (!confirmed) return;
      emitState(api.populateCollapseOverlay(current, breakType, { forceReplace: true }), "COLLAPSE STAGED");
      return;
    }
    emitState(api.populateCollapseOverlay(current, breakType), "COLLAPSE STAGED");
  }

  function actionButton(label, className, handler) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className || "button ghost";
    button.textContent = label;
    button.addEventListener("click", handler);
    return button;
  }

  function render(state) {
    const mount = mountNode();
    if (!mount) return;
    const current = api.readState();
    mount.textContent = "";
    if (!shouldShow(current)) {
      mount.hidden = true;
      return;
    }
    mount.hidden = false;

    const stagingOnly = document.createElement("p");
    stagingOnly.className = "staging-only-label";
    stagingOnly.textContent = "STAGING ONLY — HANDLER RESOLVES";
    mount.append(stagingOnly);

    const collapse = current.collapse || {};
    const rewrite = current.rewrite || {};

    if (collapse.ready && !collapse.active) {
      const banner = document.createElement("div");
      banner.className = "staging-banner collapse-ready-banner";
      banner.innerHTML = "<strong>COLLAPSE READY</strong><span>WHAT BREAKS FIRST?</span>";
      if (collapse.trigger) {
        const trigger = document.createElement("p");
        trigger.className = "staging-trigger-note";
        trigger.textContent = collapse.trigger;
        banner.append(trigger);
      }
      mount.append(banner);
    }

    if (collapse.ready || collapse.active || collapse.breakType) {
      const breakGrid = choiceGrid(api.collapseBreakTypes, collapse.breakType, "breakType", (event) => {
        selectCollapseBreakType(event.currentTarget.dataset.breakType);
      });
      breakGrid.setAttribute("aria-label", "Collapse break type");
      mount.append(breakGrid);
    }

    if (collapse.ready && !collapse.active) {
      const readyActions = document.createElement("div");
      readyActions.className = "staging-actions";
      readyActions.append(actionButton("Activate Collapse", "button primary", () => {
        emitState(api.activateCollapseMode(api.readState()), "COLLAPSE ACTIVE");
      }));
      mount.append(readyActions);
    }

    if (collapse.active || collapse.breakType) {
      const mode = document.createElement("div");
      mode.className = "staging-mode collapse-mode";
      const heading = document.createElement("p");
      heading.className = "staging-mode-title";
      heading.innerHTML = collapse.active
        ? "<strong>COLLAPSE MODE</strong>"
        : "<strong>COLLAPSE STAGING</strong>";
      mode.append(heading);

      if (collapse.active && collapse.breakType) {
        const tag = document.createElement("p");
        tag.className = "staging-type-tag";
        tag.textContent = `Break: ${collapse.breakType}`;
        mode.append(tag);
      }

      mode.append(
        stagingField("Current Broken Law", "collapse.brokenLaw", collapse.brokenLaw, 2),
        stagingField("Operator Choice", "collapse.operatorChoice", collapse.operatorChoice, 2),
        stagingField("Exit Condition", "collapse.exitCondition", collapse.exitCondition, 2)
      );

      const actions = document.createElement("div");
      actions.className = "staging-actions";
      if (collapse.active) {
        actions.append(
          actionButton("Mark Exit Failed", "button", () => {
            emitState(api.markCollapseExitFailed(api.readState()), "EXIT FAILED STAGED");
          }),
          actionButton("Deactivate Collapse", "button ghost", () => {
            emitState(api.deactivateCollapseMode(api.readState()), "COLLAPSE DEACTIVATED");
          })
        );
      }
      actions.append(actionButton("Clear Staging", "button ghost", () => {
        emitState(api.clearCollapseStaging(api.readState()), "COLLAPSE CLEARED");
      }));
      mode.append(actions);
      mount.append(mode);
    }

    if (collapse.active && (rewrite.ready || rewrite.active || rewrite.overwriteType)) {
      if (rewrite.ready && !rewrite.active) {
        const banner = document.createElement("div");
        banner.className = "staging-banner rewrite-ready-banner";
        banner.innerHTML = "<strong>REWRITE READY</strong><span>WHAT GETS OVERWRITTEN?</span>";
        if (rewrite.trigger) {
          const trigger = document.createElement("p");
          trigger.className = "staging-trigger-note";
          trigger.textContent = rewrite.trigger;
          banner.append(trigger);
        }
        mount.append(banner);

        const overwriteGrid = choiceGrid(api.rewriteOverwriteTypes, rewrite.overwriteType, "overwriteType", (event) => {
          const overwriteType = event.currentTarget.dataset.overwriteType;
          const next = api.populateRewriteOverlay(api.readState(), overwriteType);
          emitState(next, "REWRITE STAGED");
        });
        overwriteGrid.setAttribute("aria-label", "Rewrite overwrite type");
        mount.append(overwriteGrid);
      }

      if (rewrite.active || rewrite.overwriteType) {
        const mode = document.createElement("div");
        mode.className = "staging-mode rewrite-mode";
        const heading = document.createElement("p");
        heading.className = "staging-mode-title";
        heading.innerHTML = rewrite.active
          ? "<strong>REWRITE MODE</strong>"
          : "<strong>REWRITE STAGING</strong>";
        mode.append(heading);

        if (rewrite.active && rewrite.overwriteType) {
          const tag = document.createElement("p");
          tag.className = "staging-type-tag";
          tag.textContent = `Overwrite: ${rewrite.overwriteType}`;
          mode.append(tag);
        }

        mode.append(
          stagingField("Rewrite Law", "rewrite.rewriteLaw", rewrite.rewriteLaw, 2),
          stagingField("Lock-In Risk", "rewrite.lockInRisk", rewrite.lockInRisk, 2),
          stagingField("Counteraction Window", "rewrite.counteractionWindow", rewrite.counteractionWindow, 2)
        );

        const actions = document.createElement("div");
        actions.className = "staging-actions";
        if (!rewrite.active) {
          actions.append(actionButton("Activate Rewrite", "button primary", () => {
            emitState(api.activateRewriteMode(api.readState()), "REWRITE ACTIVE");
          }));
        } else {
          actions.append(actionButton("Deactivate Rewrite", "button ghost", () => {
            emitState(api.deactivateRewriteMode(api.readState()), "REWRITE DEACTIVATED");
          }));
        }
        mode.append(actions);
        mount.append(mode);
      }
    }

    bindStagingFieldEdits(mount);
    applyStagingFieldLock();
  }

  window.HandlerCollapse = { render, shouldShow };
  window.addEventListener("veildaemon:handler-state-updated", () => render(api.readState()));
  window.addEventListener("veildaemon:handler-field-edit-toggled", () => {
    render(api.readState());
  });
}());