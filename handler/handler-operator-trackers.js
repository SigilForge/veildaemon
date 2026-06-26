(function () {
  const api = window.HandlerState;

  function setTrackerValue(players, index, key, value, max, onChange) {
    const player = players[index];
    if (!player) return;
    const next = api.normalizeTrackerValue(value, max, key === "stabilityPoints" ? 10 : 0);
    if (key === "stabilityPoints") {
      player.stabilityPoints = next;
      player.stabilityBand = api.stabilityBandFromPoints(next);
      player.stability = api.formatPlayerStability(next, player.stabilityBand);
    } else {
      player.harmBoxes = next;
      player.harm = api.formatPlayerHarm(next);
    }
    onChange();
  }

  function renderTracker(article, tracker, player, playerIndex, players, onChange) {
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
    for (let pipIndex = 1; pipIndex <= tracker.max; pipIndex += 1) {
      const pip = document.createElement("button");
      pip.type = "button";
      pip.className = "pip";
      pip.classList.toggle("is-filled", pipIndex <= value);
      pip.setAttribute("aria-label", `${tracker.label} ${pipIndex}`);
      pip.addEventListener("click", () => {
        setTrackerValue(players, playerIndex, tracker.key, pipIndex === value ? pipIndex - 1 : pipIndex, tracker.max, onChange);
      });
      pips.append(pip);
    }

    const derived = document.createElement("p");
    derived.className = "pip-derived";
    derived.textContent = tracker.key === "harmBoxes"
      ? `Condition: ${api.harmConditionFromBoxes(value)}`
      : `Band: ${api.stabilityBandFromPoints(value)}`;

    const controls = document.createElement("div");
    controls.className = "pip-controls";
    const minus = document.createElement("button");
    minus.type = "button";
    minus.textContent = "-";
    minus.setAttribute("aria-label", `Decrease ${tracker.label}`);
    minus.addEventListener("click", () => {
      setTrackerValue(players, playerIndex, tracker.key, value - 1, tracker.max, onChange);
    });
    const plus = document.createElement("button");
    plus.type = "button";
    plus.textContent = "+";
    plus.setAttribute("aria-label", `Increase ${tracker.label}`);
    plus.addEventListener("click", () => {
      setTrackerValue(players, playerIndex, tracker.key, value + 1, tracker.max, onChange);
    });
    controls.append(minus, plus);

    article.append(header, pips, derived, controls);
  }

  function renderBoard(mount, player, playerIndex, players, onChange) {
    if (!mount) return;
    mount.textContent = "";
    mount.className = "handler-operator-trackers";
    mount.setAttribute("data-live-control-zone", "true");
    const trackers = [
      { key: "stabilityPoints", label: "Stability", max: 10, kind: "stability" },
      { key: "harmBoxes", label: "Harm", max: 5, kind: "harm" }
    ];
    trackers.forEach((tracker) => {
      const article = document.createElement("article");
      renderTracker(article, tracker, player, playerIndex, players, onChange);
      mount.append(article);
    });
  }

  window.HandlerOperatorTrackers = { renderBoard, setTrackerValue };
}());