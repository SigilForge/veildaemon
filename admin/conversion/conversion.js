(function () {
  const storageKey = "veildaemon.conversionLedger.v1";
  const form = document.getElementById("daily-form");
  const entryDate = document.getElementById("entry-date");
  const clearForm = document.getElementById("clear-form");
  const deleteEntry = document.getElementById("delete-entry");
  const exportJson = document.getElementById("export-json");
  const importJson = document.getElementById("import-json");
  const statusLine = document.getElementById("status-line");
  const fields = [
    "vdVisits",
    "instagramViews",
    "instagramReach",
    "facebookViews",
    "facebookViewers",
    "socialEngagements",
    "xImpressions",
    "xEngagements",
    "xFollowers",
    "archiveClicks",
    "itchClicks",
    "youtubeClicks",
    "intakeCompletions",
    "wikiViews",
    "wikiTopPage",
    "wikiReturns",
    "wikiItchExits",
    "itchViews",
    "itchPlays",
    "itchDownloads",
    "youtubeViews",
    "watchHours",
    "subscribers",
    "topVideo",
    "notes",
  ];

  if (!form || !entryDate || !statusLine) return;

  let ledger = readLedger();

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function readLedger() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(storageKey) || "[]");
      return Array.isArray(parsed) ? parsed.map(normalizeEntry).filter(Boolean) : [];
    } catch (error) {
      return [];
    }
  }

  function writeLedger() {
    ledger.sort((a, b) => a.date.localeCompare(b.date));
    window.localStorage.setItem(storageKey, JSON.stringify(ledger));
  }

  function setStatus(message, isError) {
    statusLine.textContent = message;
    statusLine.classList.toggle("is-error", Boolean(isError));
  }

  function numberOrNull(value) {
    if (value === "" || value === null || value === undefined) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function textOrNull(value) {
    const text = String(value || "").trim();
    return text ? text : null;
  }

  function normalizeEntry(entry) {
    if (!entry || !entry.date) return null;
    const normalized = { date: String(entry.date).slice(0, 10) };
    fields.forEach((field) => {
      if (["wikiTopPage", "topVideo", "notes"].includes(field)) {
        normalized[field] = textOrNull(entry[field]);
      } else {
        normalized[field] = numberOrNull(entry[field]);
      }
    });
    return normalized;
  }

  function value(entry, key) {
    return entry && typeof entry[key] === "number" ? entry[key] : null;
  }

  function sumValues(entry, keys) {
    const known = keys.map((key) => value(entry, key)).filter((item) => item !== null);
    if (known.length === 0) return null;
    return known.reduce((total, item) => total + item, 0);
  }

  function rate(numerator, denominator) {
    if (numerator === null || denominator === null || denominator <= 0) return null;
    return numerator / denominator;
  }

  function pct(valueToFormat) {
    if (valueToFormat === null || Number.isNaN(valueToFormat)) return "--";
    return `${Math.round(valueToFormat * 100)}%`;
  }

  function num(valueToFormat) {
    if (valueToFormat === null || valueToFormat === undefined || Number.isNaN(valueToFormat)) return "--";
    return new Intl.NumberFormat().format(valueToFormat);
  }

  function delta(current, prior) {
    if (current === null || prior === null || prior === 0) return null;
    return (current - prior) / prior;
  }

  function latestEntries() {
    return [...ledger].sort((a, b) => b.date.localeCompare(a.date));
  }

  function currentEntry() {
    return latestEntries()[0] || null;
  }

  function priorEntry() {
    return latestEntries()[1] || null;
  }

  function metrics(entry) {
    const vdVisits = value(entry, "vdVisits");
    const deepActions = sumValues(entry, ["archiveClicks", "itchClicks", "youtubeClicks", "intakeCompletions"]);
    const caseActions = sumValues(entry, ["itchPlays", "itchDownloads"]);
    const itchViews = value(entry, "itchViews");
    return {
      reach: sumValues(entry, ["vdVisits", "instagramViews", "facebookViews", "xImpressions", "wikiViews", "itchViews", "youtubeViews"]),
      deepActions,
      deepeningRate: rate(deepActions, vdVisits),
      caseActions,
      caseRate: rate(caseActions, itchViews),
    };
  }

  function formEntry() {
    const raw = { date: entryDate.value || today() };
    fields.forEach((field) => {
      const node = form.elements[field];
      raw[field] = node ? node.value : "";
    });
    return normalizeEntry(raw);
  }

  function fillForm(entry) {
    entryDate.value = entry ? entry.date : today();
    fields.forEach((field) => {
      const node = form.elements[field];
      if (!node) return;
      node.value = entry && entry[field] !== null && entry[field] !== undefined ? entry[field] : "";
    });
  }

  function clearFormValues() {
    fillForm({ date: entryDate.value || today() });
  }

  function saveEntry(entry) {
    const index = ledger.findIndex((item) => item.date === entry.date);
    if (index >= 0) {
      ledger[index] = entry;
    } else {
      ledger.push(entry);
    }
    writeLedger();
    render();
    setStatus(`Snapshot held for ${entry.date}.`);
  }

  function removeEntry(date) {
    const before = ledger.length;
    ledger = ledger.filter((entry) => entry.date !== date);
    writeLedger();
    render();
    fillForm({ date: today() });
    setStatus(before === ledger.length ? "No snapshot found for selected day." : `Snapshot deleted for ${date}.`);
  }

  function setText(id, text) {
    const node = document.getElementById(id);
    if (node) node.textContent = text;
  }

  function renderSummary() {
    const current = currentEntry();
    const prior = priorEntry();
    const currentMetrics = metrics(current);
    const priorMetrics = metrics(prior);
    setText("metric-reach", num(currentMetrics.reach));
    setText("metric-reach-note", current ? `Latest snapshot: ${current.date}` : "Awaiting signal.");
    setText("metric-deepening", pct(currentMetrics.deepeningRate));
    setText("metric-casefile", pct(currentMetrics.caseRate));
    const lift = delta(currentMetrics.reach, priorMetrics.reach);
    setText("metric-lift", lift === null ? "--" : `${lift > 0 ? "+" : ""}${Math.round(lift * 100)}%`);
    setText("metric-lift-note", prior ? `Compared with ${prior.date}.` : "Compared with prior logged day.");
  }

  function createEl(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function renderFunnel() {
    const node = document.getElementById("funnel");
    if (!node) return;
    node.textContent = "";
    const entry = currentEntry();
    if (!entry) {
      node.append(createEl("p", "empty", "No snapshots logged."));
      return;
    }

    const rows = [
      ["Archive exit", value(entry, "archiveClicks"), value(entry, "vdVisits")],
      ["Case-file exit", value(entry, "itchClicks"), value(entry, "vdVisits")],
      ["YouTube exit", value(entry, "youtubeClicks"), value(entry, "vdVisits")],
      ["Intake completion", value(entry, "intakeCompletions"), value(entry, "vdVisits")],
      ["Wiki to case file", value(entry, "wikiItchExits"), value(entry, "wikiViews")],
      ["Itch play/download", sumValues(entry, ["itchPlays", "itchDownloads"]), value(entry, "itchViews")],
    ];

    rows.forEach(([label, numerator, denominator]) => {
      const step = createEl("div", "funnel-step");
      const head = createEl("div", "funnel-head");
      head.append(createEl("strong", "", label));
      head.append(createEl("span", "", pct(rate(numerator, denominator))));
      const detail = createEl("p", "hint", `${num(numerator)} / ${num(denominator)}`);
      const bar = createEl("div", "bar");
      const fill = document.createElement("i");
      fill.style.setProperty("--value", `${Math.min(100, Math.round((rate(numerator, denominator) || 0) * 100))}%`);
      bar.append(fill);
      step.append(head, detail, bar);
      node.append(step);
    });
  }

  function renderTrend() {
    const node = document.getElementById("trend");
    if (!node) return;
    node.textContent = "";
    const days = latestEntries().slice(0, 7).reverse();
    if (days.length === 0) {
      node.append(createEl("p", "empty", "No trend yet."));
      return;
    }
    const reaches = days.map((entry) => metrics(entry).reach || 0);
    const maxReach = Math.max(...reaches, 1);
    days.forEach((entry) => {
      const day = createEl("div", "trend-day");
      const bar = createEl("div", "trend-bar");
      bar.style.setProperty("--height", `${Math.max(6, Math.round(((metrics(entry).reach || 0) / maxReach) * 100))}%`);
      day.append(bar, createEl("span", "", entry.date.slice(5)), createEl("small", "", num(metrics(entry).reach)));
      node.append(day);
    });
  }

  function renderQuality() {
    const node = document.getElementById("quality-table");
    if (!node) return;
    node.textContent = "";
    const entry = currentEntry();
    if (!entry) {
      node.append(createEl("p", "empty", "No channel data logged."));
      return;
    }
    const rows = [
      ["Social discovery", sumValues(entry, ["instagramViews", "facebookViews", "xImpressions"]), sumValues(entry, ["socialEngagements", "xEngagements"]), rate(sumValues(entry, ["socialEngagements", "xEngagements"]), sumValues(entry, ["instagramViews", "facebookViews", "xImpressions"]))],
      ["VeilDaemon", value(entry, "vdVisits"), sumValues(entry, ["archiveClicks", "itchClicks", "youtubeClicks", "intakeCompletions"]), rate(sumValues(entry, ["archiveClicks", "itchClicks", "youtubeClicks", "intakeCompletions"]), value(entry, "vdVisits"))],
      ["Archive", value(entry, "wikiViews"), sumValues(entry, ["wikiReturns", "wikiItchExits"]), rate(sumValues(entry, ["wikiReturns", "wikiItchExits"]), value(entry, "wikiViews"))],
      ["Itch", value(entry, "itchViews"), sumValues(entry, ["itchPlays", "itchDownloads"]), rate(sumValues(entry, ["itchPlays", "itchDownloads"]), value(entry, "itchViews"))],
      ["YouTube", value(entry, "youtubeViews"), value(entry, "watchHours"), rate(value(entry, "watchHours"), value(entry, "youtubeViews"))],
    ];
    rows.forEach(([name, reach, action, quality]) => {
      const row = createEl("div", "quality-row");
      row.append(metricCell(name, "Surface"));
      row.append(metricCell(num(reach), "Reach"));
      row.append(metricCell(num(action), "Action"));
      row.append(metricCell(name === "YouTube" ? `${quality === null ? "--" : quality.toFixed(2)} hr/view` : pct(quality), "Quality"));
      node.append(row);
    });
  }

  function metricCell(valueText, label) {
    const wrap = createEl("div");
    wrap.append(createEl("span", "", label));
    wrap.append(createEl("strong", "", valueText));
    return wrap;
  }

  function renderEntries() {
    const node = document.getElementById("entry-list");
    if (!node) return;
    node.textContent = "";
    const entries = latestEntries();
    if (entries.length === 0) {
      node.append(createEl("p", "empty", "No signal ledger entries."));
      return;
    }
    entries.forEach((entry) => {
      const row = createEl("div", "ledger-row");
      const main = createEl("div", "ledger-main");
      main.append(createEl("span", "", entry.date));
      main.append(createEl("strong", "", `${num(metrics(entry).reach)} total reach // ${pct(metrics(entry).deepeningRate)} deepening`));
      main.append(createEl("p", "", entry.notes || "No note recorded."));
      const edit = createEl("button", "", "Edit");
      edit.type = "button";
      edit.addEventListener("click", () => {
        fillForm(entry);
        setStatus(`Loaded ${entry.date} for review.`);
      });
      row.append(main, edit);
      node.append(row);
    });
  }

  function renderInsights() {
    const node = document.getElementById("insight-list");
    if (!node) return;
    node.textContent = "";
    const entry = currentEntry();
    if (!entry) {
      node.append(createEl("p", "empty", "No read available until a snapshot is logged."));
      return;
    }
    const current = metrics(entry);
    const prior = metrics(priorEntry());
    const insights = [];
    if (current.deepeningRate !== null && current.deepeningRate < 0.08) {
      insights.push(["Low deepening", "Public traffic is not moving deeper. Check top-fold routes, social post promise, and archive/case-file CTA clarity."]);
    }
    if (current.caseRate !== null && current.caseRate < 0.12) {
      insights.push(["Weak case-file conversion", "Itch visitors are not becoming plays/downloads. Review page copy, screenshots, and first visible download/play path."]);
    }
    const lift = delta(current.reach, prior.reach);
    if (lift !== null && lift > 0.3) {
      insights.push(["Spike detected", "Capture the source today: post, video, Discord mention, wiki page, or stream event. Do not let the attribution evaporate."]);
    }
    if (value(entry, "wikiViews") !== null && value(entry, "archiveClicks") !== null && value(entry, "archiveClicks") > 0 && value(entry, "wikiViews") === 0) {
      insights.push(["Archive data mismatch", "VeilDaemon reports archive exits, but wiki views are logged as zero. Treat one side as missing before drawing conclusions."]);
    }
    if (entry.wikiTopPage) {
      insights.push(["Archive lead", `${entry.wikiTopPage} is the current top archive page. Use it as the next breadcrumb source if quality is holding.`]);
    }
    if (entry.topVideo) {
      insights.push(["Echo lead", `${entry.topVideo} is the current top video. Link it back into the surface if it is pulling new observers.`]);
    }
    if (insights.length === 0) {
      insights.push(["Stable", "No automatic warning from the latest snapshot. Keep collecting daily data until a pattern emerges."]);
    }
    insights.forEach(([title, body]) => {
      const item = createEl("div", "insight");
      item.innerHTML = `<strong>${escapeHtml(title)}:</strong> ${escapeHtml(body)}`;
      node.append(item);
    });
  }

  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;",
    }[char]));
  }

  function render() {
    renderSummary();
    renderFunnel();
    renderTrend();
    renderQuality();
    renderEntries();
    renderInsights();
  }

  function downloadJson() {
    const blob = new Blob([JSON.stringify(ledger, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `veildaemon-conversion-${today()}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatus("Conversion ledger exported.");
  }

  function importFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      try {
        const parsed = JSON.parse(String(reader.result || "[]"));
        if (!Array.isArray(parsed)) throw new Error("Import must be an array of daily snapshots.");
        ledger = parsed.map(normalizeEntry).filter(Boolean);
        writeLedger();
        render();
        setStatus(`Imported ${ledger.length} snapshot records.`);
      } catch (error) {
        setStatus(error.message, true);
      }
    });
    reader.readAsText(file);
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const entry = formEntry();
    if (!entry || !entry.date) {
      setStatus("Snapshot rejected. Date required.", true);
      return;
    }
    saveEntry(entry);
  });

  clearForm.addEventListener("click", clearFormValues);
  deleteEntry.addEventListener("click", () => removeEntry(entryDate.value));
  exportJson.addEventListener("click", downloadJson);
  importJson.addEventListener("change", () => importFile(importJson.files && importJson.files[0]));

  entryDate.addEventListener("change", () => {
    const existing = ledger.find((entry) => entry.date === entryDate.value);
    if (existing) {
      fillForm(existing);
      setStatus(`Loaded ${existing.date}.`);
    }
  });

  fillForm(ledger.find((entry) => entry.date === today()) || { date: today() });
  render();
}());
