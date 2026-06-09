const statusLines = [
  "INFRASTRUCTURE BEFORE PERMISSION",
  "HUMAN AUTHORIZATION PARTIAL",
  "SURVIVAL AUTHORIZATION ACTIVE",
  "OBSERVATION CREATES RELEVANCE",
  "CONTINUED ATTENTION MAY REQUIRE CLASSIFICATION"
];

const panelLines = [
  "OBSERVER CHANNEL STABILIZING",
  "SIGNAL INTEGRITY NOMINAL",
  "LIVE CONVERSATION INDEXED",
  "ATTENTION VECTOR ACTIVE",
  "ROUTING PROCEDURE STANDING BY"
];

const rightLines = [
  "WE NOTICE WHAT OTHERS REFUSE TO SEE.",
  "OBSERVER RELEVANCE INCREASING.",
  "PLEASE REMAIN WHERE REALITY CAN FIND YOU.",
  "THE CHANNEL IS NOT EMPTY."
];

const statusLine = document.getElementById("status-line");
const panelSubline = document.getElementById("panel-subline");
const rightStatus = document.getElementById("right-status");
const clock = document.getElementById("clock");
const stage = document.querySelector(".overlay-stage");

let lineIndex = 0;

function updateClock() {
  const now = new Date();
  clock.textContent = now.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function rotateLines() {
  lineIndex += 1;
  statusLine.textContent = statusLines[lineIndex % statusLines.length];
  panelSubline.textContent = panelLines[lineIndex % panelLines.length];
  rightStatus.textContent = rightLines[lineIndex % rightLines.length];
}

function spawnSpark() {
  if (!stage || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  const spark = document.createElement("span");
  spark.className = "spark";
  spark.style.left = `${8 + Math.random() * 86}%`;
  spark.style.top = `${8 + Math.random() * 82}%`;
  stage.appendChild(spark);
  spark.addEventListener("animationend", () => spark.remove(), { once: true });
}

updateClock();
setInterval(updateClock, 1000);
setInterval(rotateLines, 4600);
setInterval(spawnSpark, 420);
