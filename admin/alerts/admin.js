(function () {
  const tokenInput = document.getElementById("token");
  const saveToken = document.getElementById("save-token");
  const userInput = document.getElementById("user");
  const countInput = document.getElementById("count");
  const statusLine = document.getElementById("status-line");
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

  saveToken.addEventListener("click", () => {
    window.localStorage.setItem(storageKey, tokenInput.value.trim());
    setStatus("Access token held locally.");
  });

  document.querySelectorAll("[data-type]").forEach((button) => {
    button.addEventListener("click", () => sendAlert(button.dataset.type));
  });
})();
