(function () {
  const tokenInput = document.getElementById("token");
  const saveToken = document.getElementById("save-token");
  const userInput = document.getElementById("user");
  const countInput = document.getElementById("count");
  const statusLine = document.getElementById("status-line");
  const refreshEventsubConfig = document.getElementById("refresh-eventsub-config");
  const eventsubWarning = document.getElementById("eventsub-warning");
  const diagnostics = {
    callbackPresent: document.getElementById("diag-callback-present"),
    callbackLooksLikeUrl: document.getElementById("diag-callback-url"),
    secretPresent: document.getElementById("diag-secret-present"),
    secretLooksLikeUrl: document.getElementById("diag-secret-url"),
    secretLength: document.getElementById("diag-secret-length"),
  };
  const storageKey = "veildaemon.alertConsole.token";

  tokenInput.value = window.localStorage.getItem(storageKey) || "";

  function setStatus(message) {
    statusLine.textContent = message;
  }

  async function sendAlert(type) {
    const token = tokenInput.value.trim();
    if (!token) {
      setStatus("Access token missing. Console declines theatrical failure.");
      return;
    }

    const payload = {
      type,
      user: userInput.value.trim() || "SomeWitness",
      count: Number(countInput.value || 1),
      months: Number(countInput.value || 1),
      level: Number(countInput.value || 1),
      amount: "$13.13",
    };

    setStatus(`Transmitting ${type.replace("_", " ")} event.`);

    try {
      const response = await fetch("/api/alerts/test", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Event rejected.");
      setStatus(`Event accepted: ${result.alert.type} / ${result.alert.user}`);
    } catch (error) {
      setStatus(`Event rejected: ${error.message}`);
    }
  }

  function setDiagnosticValue(element, value) {
    element.textContent = String(value);
    element.dataset.state = value === true ? "ok" : value === false ? "warn" : "neutral";
  }

  async function loadEventsubConfig() {
    const token = tokenInput.value.trim();
    if (!token) {
      setStatus("Access token required before EventSub diagnostics.");
      return;
    }

    try {
      const response = await fetch("/api/twitch/eventsub-config", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "EventSub diagnostics rejected.");

      const data = result.diagnostics || {};
      setDiagnosticValue(diagnostics.callbackPresent, Boolean(data.callbackPresent));
      setDiagnosticValue(diagnostics.callbackLooksLikeUrl, Boolean(data.callbackLooksLikeUrl));
      setDiagnosticValue(diagnostics.secretPresent, Boolean(data.secretPresent));
      setDiagnosticValue(diagnostics.secretLooksLikeUrl, Boolean(data.secretLooksLikeUrl));
      diagnostics.secretLength.textContent = String(Number(data.secretLength || 0));
      diagnostics.secretLength.dataset.state = data.secretLength > 0 ? "ok" : "warn";
      eventsubWarning.hidden = !data.secretLooksLikeUrl;
      setStatus("EventSub configuration checked.");
    } catch (error) {
      setStatus(`EventSub diagnostics rejected: ${error.message}`);
    }
  }

  saveToken.addEventListener("click", () => {
    window.localStorage.setItem(storageKey, tokenInput.value.trim());
    setStatus("Access token held locally.");
    loadEventsubConfig();
  });

  refreshEventsubConfig.addEventListener("click", loadEventsubConfig);

  document.querySelectorAll("[data-type]").forEach((button) => {
    button.addEventListener("click", () => sendAlert(button.dataset.type));
  });

  if (tokenInput.value.trim()) {
    loadEventsubConfig();
  }
})();
