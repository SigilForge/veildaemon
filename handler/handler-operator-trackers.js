(function () {
  const api = window.HandlerState;

  function queueTrackerChange(players, index, key, delta, onQueuePrompt) {
    const player = players[index];
    if (!player || !onQueuePrompt) return;
    const track = key === "harmBoxes" ? "harm" : "stability";
    onQueuePrompt({
      operatorIndex: index,
      track,
      delta,
      source: track === "harm" ? "Scene pressure" : "Manual",
      reason: track === "harm"
        ? "Harm changed at the table."
        : "Handler adjustment at the table.",
      handlerNote: ""
    });
  }

  function renderTracker(article, tracker, player, playerIndex, players, onQueuePrompt) {
    const value = api.normalizeTrackerValue(
      player[tracker.key],
      tracker.max,
      tracker.key === "stabilityPoints" ? 10 : 0
    );
    article.className = `line-tracker handler-line-tracker ${tracker.kind}`;

    const header = document.createElement("div");
    header.className = "pip-header";
    const title = document.createElement("strong");
    title.textContent = tracker.label;
    const count = document.createElement("span");
    count.textContent = `${value}/${tracker.max}`;
    header.append(title, count);

    const pips = document.createElement("div");
    pips.className = `line-pips ${tracker.kind}-pips`;
    pips.setAttribute("aria-label", `${tracker.label} summary`);
    for (let pipIndex = 1; pipIndex <= tracker.max; pipIndex += 1) {
      const pip = document.createElement("span");
      pip.className = "pip";
      pip.classList.toggle("is-filled", pipIndex <= value);
      pip.setAttribute("aria-hidden", "true");
      pips.append(pip);
    }

    const derived = document.createElement("p");
    derived.className = "pip-derived";
    derived.textContent = tracker.key === "harmBoxes"
      ? `Condition: ${api.harmConditionFromBoxes(value)}`
      : `Band: ${api.stabilityBandFromPoints(value)}`;

    const controls = document.createElement("div");
    controls.className = "pip-controls handler-prompt-controls";
    const minus = document.createElement("button");
    minus.type = "button";
    minus.textContent = "−";
    minus.setAttribute("aria-label", `Queue ${tracker.label} -1`);
    minus.addEventListener("click", () => {
      queueTrackerChange(players, playerIndex, tracker.key, -1, onQueuePrompt);
    });
    const plus = document.createElement("button");
    plus.type = "button";
    plus.textContent = "+";
    plus.setAttribute("aria-label", `Queue ${tracker.label} +1`);
    plus.addEventListener("click", () => {
      queueTrackerChange(players, playerIndex, tracker.key, 1, onQueuePrompt);
    });
    controls.append(minus, plus);

    const hint = document.createElement("p");
    hint.className = "handler-tracker-hint";
    hint.textContent = "Queue only — Operator updates their sheet.";

    article.append(header, pips, derived, controls, hint);
  }

  function renderBoard(mount, player, playerIndex, players, options = {}) {
    if (!mount) return;
    const onQueuePrompt = typeof options.onQueuePrompt === "function" ? options.onQueuePrompt : null;
    mount.textContent = "";
    mount.className = "handler-operator-trackers";
    mount.setAttribute("data-live-control-zone", "true");
    const trackers = [
      { key: "stabilityPoints", label: "Stability", max: 10, kind: "stability" },
      { key: "harmBoxes", label: "Harm", max: 5, kind: "harm" }
    ];
    trackers.forEach((tracker) => {
      const article = document.createElement("article");
      renderTracker(article, tracker, player, playerIndex, players, onQueuePrompt);
      mount.append(article);
    });

    if (options.showQuickForm && window.HandlerTrackPromptQueue) {
      const formMount = document.createElement("div");
      formMount.className = "handler-track-prompt-form-mount";
      mount.append(formMount);
      window.HandlerTrackPromptQueue.renderQuickQueueForm(
        formMount,
        options.state || api.readState(),
        playerIndex,
        options.onStateChange,
        options.setStatusMessage
      );
    }
  }

  window.HandlerOperatorTrackers = { renderBoard };
}());