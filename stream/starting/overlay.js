const stage = document.querySelector(".starting-stage");
const ticker = document.querySelector(".ticker");
const tickerTrack = document.getElementById("ticker-track");

const tickerLines = [
  "OBSERVATION CREATES RELEVANCE",
  "INITIALIZATION NODE ACTIVE",
  "OPERATOR SIGNAL NOT YET STABLE",
  "HUMAN AUTHORIZATION PENDING",
  "VEILCORP ARCHIVES // KANSAS CITY FIELD OFFICE",
  "ACQUIRING APERTURE",
  "SIGNAL INTEGRITY NOMINAL",
  "SYNCHRONIC CHAT TERMINAL SEALED"
];

function shuffleLines(lines) {
  const shuffled = [...lines];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function refreshTicker() {
  if (!tickerTrack) {
    return;
  }

  const sequence = shuffleLines(tickerLines).slice(0, 7);
  const doubled = [...sequence, ...sequence];
  tickerTrack.replaceChildren(...doubled.map((line) => {
    const item = document.createElement("span");
    item.textContent = line;
    return item;
  }));
}

function glitchTicker() {
  if (!ticker) {
    return;
  }

  ticker.classList.add("ticker-burst");
  window.setTimeout(() => ticker.classList.remove("ticker-burst"), 260);
}

function spawnSpark() {
  if (!stage || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  const spark = document.createElement("span");
  spark.className = "spark";
  spark.style.left = `${24 + Math.random() * 52}%`;
  spark.style.top = `${18 + Math.random() * 54}%`;
  spark.style.setProperty("--spark-size", `${2 + Math.random() * 3}px`);
  spark.style.setProperty("--spark-drift", `${18 + Math.random() * 30}px`);
  stage.appendChild(spark);
  spark.addEventListener("animationend", () => spark.remove(), { once: true });
}

refreshTicker();
setInterval(refreshTicker, 8200);
setInterval(glitchTicker, 3200 + Math.random() * 1600);
setInterval(spawnSpark, 130);
