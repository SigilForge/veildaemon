(function () {
  const frame = document.getElementById("admin-surface");
  const buttons = Array.from(document.querySelectorAll("[data-surface]"));
  const tokenInput = document.getElementById("admin-token");
  const holdToken = document.getElementById("hold-token");
  const status = document.getElementById("admin-status");
  const tokenKey = "veildaemon.reportAdminToken";
  const queryToken = new URLSearchParams(window.location.search).get("token") || "";

  if (!frame || !buttons.length || !tokenInput || !holdToken || !status) return;

  function token() {
    return tokenInput.value.trim();
  }

  function withToken(path) {
    const [base, hash = ""] = path.split("#");
    const url = new URL(base, window.location.origin);
    if (token()) url.searchParams.set("token", token());
    return `${url.pathname}${url.search}${hash ? `#${hash}` : ""}`;
  }

  function activate(button) {
    buttons.forEach((node) => node.classList.toggle("is-active", node === button));
    frame.src = withToken(button.getAttribute("data-surface") || "/admin/reports/");
    status.textContent = `${button.textContent.trim()} loaded.`;
  }

  tokenInput.value = queryToken || window.localStorage.getItem(tokenKey) || "";
  if (queryToken) window.localStorage.setItem(tokenKey, queryToken);

  buttons.forEach((button) => {
    button.addEventListener("click", () => activate(button));
  });

  holdToken.addEventListener("click", () => {
    window.localStorage.setItem(tokenKey, token());
    const active = buttons.find((button) => button.classList.contains("is-active")) || buttons[0];
    activate(active);
    status.textContent = "Token held locally and forwarded to selected surface.";
  });

  frame.src = withToken(buttons[0].getAttribute("data-surface") || "/admin/reports/");
}());
