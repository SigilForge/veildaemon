const profiles = {
  Dream: {
    title: "DREAM BLEED",
    route: "Needlepoint / Reflection-Adjacent Case Files",
    summary: "Symbol, reflection, memory, and route certainty are behaving as active terrain."
  },
  Hunger: {
    title: "HUNGER PRESSURE",
    route: "Sanguine / Desire-Vector Records",
    summary: "Appetite, need, warmth, pursuit, or escalation may be routing the event."
  },
  Silence: {
    title: "SILENCE GAP",
    route: "Redacted Records / Missing-Data Events",
    summary: "Absence is carrying pressure. Missing names, sounds, records, or context are not neutral."
  },
  Stillness: {
    title: "STILLNESS LOOP",
    route: "Time Drift / Suspended-Choice Reports",
    summary: "Delay, repetition, restraint, or frozen decision pressure may be stabilizing the anomaly."
  },
  Empyrean: {
    title: "EMPYREAN SIGNAL",
    route: "Transmission / Witness-Line Records",
    summary: "Connection, awe, audience, signal, or emotional synchronization may be amplifying contact."
  },
  Becoming: {
    title: "BECOMING EVENT",
    route: "Identity Drift / Mirror Claim Reports",
    summary: "Role pressure, self-rewrite, adaptation, or identity mismatch may be shaping the event."
  }
};

const actionCosts = {
  ignored: "Residual pressure likely remained local. Monitor for recurrence.",
  recorded: "Recording may have created a witness channel. Do not replay alone.",
  told: "Secondary witness created. Compare memories before assuming agreement.",
  followed: "Route contamination possible. Mark exits before returning.",
  lied: "Concealment increased pressure. Correct the lie before the room does."
};

const stateCopy = {
  BRUSHED: "BRUSHED // indirect contact only",
  NOTED: "NOTED // pattern registered",
  MARKED: "MARKED // observer relevance confirmed",
  CLAIMED: "CLAIMED // disengage and seek live Operators"
};

function getChecked(name) {
  return document.querySelector(`input[name="${name}"]:checked`);
}

function openIntake() {
  const intake = document.getElementById("intake-node");
  const startButton = document.getElementById("start-intake");

  intake.hidden = false;
  startButton.setAttribute("aria-expanded", "true");
  startButton.textContent = "Intake Open";
  intake.scrollIntoView({ behavior: "smooth", block: "start" });
  intake.focus({ preventScroll: true });
}

function runIntake() {
  const noticed = getChecked("noticed");
  const action = getChecked("action");
  const noticedBack = getChecked("noticedBack");
  const result = document.getElementById("intake-result");
  const observerState = document.getElementById("observer-state");

  if (!noticed || !action || !noticedBack) {
    result.innerHTML = `<p><span class="prompt">&gt;</span> INTAKE ERROR: incomplete response set.</p><p><span class="prompt">&gt;</span> Select one answer from each question.</p>`;
    return;
  }

  const profile = profiles[noticed.value];
  const warning = noticed.dataset.warning;
  const risk = noticedBack.value;
  observerState.textContent = risk;

  result.innerHTML = `
    <p><span class="prompt">&gt;</span> OBSERVER STATE: <strong>${stateCopy[risk]}</strong></p>
    <p><span class="prompt">&gt;</span> LIKELY FREQUENCY BLEED: <strong>${profile.title}</strong></p>
    <p><span class="prompt">&gt;</span> SUMMARY: ${profile.summary}</p>
    <p><span class="prompt">&gt;</span> RESPONSE NOTE: ${actionCosts[action.value]}</p>
    <p><span class="prompt">&gt;</span> RECOMMENDED ROUTE: <strong>${profile.route}</strong></p>
    <p class="risk"><span class="prompt">&gt;</span> WARNING: ${warning}</p>
  `;
}

function resetIntake() {
  document.querySelectorAll(".intake input").forEach(input => { input.checked = false; });
  document.getElementById("observer-state").textContent = "NOTICED";
  document.getElementById("intake-result").innerHTML = `<p><span class="prompt">&gt;</span> INTAKE STATUS: WAITING FOR OPERATOR INPUT</p>`;
}

document.getElementById("start-intake").addEventListener("click", openIntake);
document.getElementById("run-intake").addEventListener("click", runIntake);
document.getElementById("reset-intake").addEventListener("click", resetIntake);
