const stage = document.querySelector(".overlay-stage");
const panelSubline = document.getElementById("panel-subline");

const panelLines = [
  "OBSERVER CHANNEL STABILIZING",
  "SIGNAL INTEGRITY NOMINAL",
  "LIVE CONVERSATION INDEXED",
  "ATTENTION VECTOR ACTIVE",
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

setInterval(rotatePanelLine, 4600);
setInterval(spawnSpark, 420);
