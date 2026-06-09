const stage = document.querySelector(".overlay-stage");
const panelSubline = document.getElementById("panel-subline");
const ticker = document.querySelector(".ticker");
const tickerTrack = document.getElementById("ticker-track");

const panelLines = [
  "OBSERVER CHANNEL STABILIZING",
  "SIGNAL INTEGRITY NOMINAL",
  "LIVE CONVERSATION INDEXED",
  "ATTENTION VECTOR ACTIVE",
  "ROUTING PROCEDURE STANDING BY"
];

const tickerLines = [
  "HUMAN AUTHORIZATION PARTIAL",
  "SURVIVAL AUTHORIZATION ACTIVE",
  "OBSERVATION CREATES RELEVANCE",
  "CONTINUED ATTENTION MAY REQUIRE CLASSIFICATION",
  "INFRASTRUCTURE BEFORE PERMISSION",
  "SIGNAL INTEGRITY NOMINAL",
  "ARCHIVE FEED LIVE",
  "OPERATOR ATTENTION INDEXED",
  "PUBLIC NODE STABILIZING",
  "FILTER LEVEL HOLDING",
  "CROSSROADS RELAY OPEN",
  "ROUTING PROCEDURE STANDING BY"
];

let panelLineIndex = 0;

function rotatePanelLine() {
  if (!panelSubline) {
    return;
  }

  panelLineIndex += 1;
  panelSubline.textContent = panelLines[panelLineIndex % panelLines.length];
}

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

  const sequence = shuffleLines(tickerLines).slice(0, 8);
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
  spark.style.left = `${8 + Math.random() * 86}%`;
  spark.style.top = `${8 + Math.random() * 82}%`;
  spark.style.setProperty("--spark-size", `${3 + Math.random() * 4}px`);
  spark.style.setProperty("--spark-drift", `${24 + Math.random() * 36}px`);
  stage.appendChild(spark);
  spark.addEventListener("animationend", () => spark.remove(), { once: true });
}

refreshTicker();
setInterval(rotatePanelLine, 4600);
setInterval(refreshTicker, 7600);
setInterval(glitchTicker, 2900 + Math.random() * 1400);
setInterval(spawnSpark, 90);
