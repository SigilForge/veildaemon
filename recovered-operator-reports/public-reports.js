(function () {
  const index = document.getElementById("report-index");
  const fields = {
    recoveredReports: document.getElementById("stat-recovered"),
    approvedForPublication: document.getElementById("stat-approved"),
    containmentRestricted: document.getElementById("stat-restricted"),
    underReview: document.getElementById("stat-review"),
    redactedBeyondRecovery: document.getElementById("stat-redacted"),
  };

  if (!index) return;

  function setText(node, value) {
    if (node) node.textContent = String(value || 0);
  }

  function textLine(label, value) {
    const line = document.createElement("p");
    const strong = document.createElement("strong");
    strong.textContent = `${label}:`;
    line.append(strong, ` ${String(value || "REDACTED")}`);
    return line;
  }

  function renderReport(report) {
    const article = document.createElement("article");
    article.className = "public-report";

    const title = document.createElement("h2");
    title.textContent = `REPORT #${report.id}`;
    article.append(title);

    article.append(textLine("IDENTITY", report.identity));
    article.append(textLine("LOCATION", report.location));
    article.append(textLine("ROLE", report.role));
    article.append(textLine("OPERATOR COUNT", report.operatorCount));
    article.append(textLine("NEEDLEPOINT", report.needlepoint));
    article.append(textLine("STATUS", report.status));

    const statement = document.createElement("blockquote");
    const statementLabel = document.createElement("strong");
    statementLabel.textContent = "RECOVERED STATEMENT:";
    statement.append(statementLabel, document.createElement("br"), `"${String(report.recoveredStatement || "No recoverable statement preserved.")}"`);
    article.append(statement);

    const note = document.createElement("p");
    note.className = "archive-note";
    const noteLabel = document.createElement("strong");
    noteLabel.textContent = "ARCHIVE NOTE:";
    note.append(noteLabel, document.createElement("br"), String(report.archiveNote || "Approved for public recovery index."));
    article.append(note);

    return article;
  }

  async function loadReports() {
    try {
      const response = await fetch("/api/reports/public");
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Recovery index unavailable.");
      }

      Object.keys(fields).forEach((key) => setText(fields[key], result.stats && result.stats[key]));
      index.textContent = "";

      if (!result.reports || result.reports.length === 0) {
        const empty = document.createElement("p");
        empty.className = "local-note";
        empty.textContent = "No reports have cleared recovery review.";
        index.append(empty);
        return;
      }

      result.reports.forEach((report) => index.append(renderReport(report)));
    } catch (error) {
      index.innerHTML = "";
      const failed = document.createElement("p");
      failed.className = "local-note is-error";
      failed.textContent = error.message || "Recovery index unavailable.";
      index.append(failed);
    }
  }

  loadReports();
}());
