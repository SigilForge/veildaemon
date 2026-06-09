const stage = document.querySelector(".overlay-stage");
const panelCycle = document.getElementById("panel-cycle");

const cycleLines = [
  "INTERMISSION NODE ACTIVE",
  "OPERATOR TEMPORARILY AWAY",
  "CHANNEL HOLD // REMAIN IN OBSERVATION",
  "RETURN WINDOW UNDISCLOSED",
  "SIGNAL INTEGRITY MAINTAINED"
];

let cycleIndex = 0;

function rotateCycle() {
  if (!panelCycle) {
    return;
  }

  cycleIndex += 1;
  panelCycle.textContent = cycleLines[cycleIndex % cycleLines.length];
}

function spawnTrace() {
  if (!stage || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  const trace = document.createElement("span");
  trace.className = "trace";
  trace.style.left = `${10 + Math.random() * 80}%`;
  trace.style.top = `${8 + Math.random() * 78}%`;
  stage.appendChild(trace);
  trace.addEventListener("animationend", () => trace.remove(), { once: true });
}

setInterval(rotateCycle, 4400);
setInterval(spawnTrace, 520);
