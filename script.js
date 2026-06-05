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

const intakeQuestions = [
  {
    id: "noticed",
    step: "01 // SIGNAL ORIGIN",
    prompt: "What did you notice first?",
    options: [
      { label: "A reflection moved wrong.", value: "Dream", warning: "Do not correct delayed reflections." },
      { label: "A voice or signal answered back.", value: "Empyrean", warning: "Do not answer voices using your name twice." },
      { label: "Time hesitated.", value: "Stillness", warning: "Do not trust clocks that agree too perfectly." },
      { label: "Something wanted something from me.", value: "Hunger", warning: "Do not follow warmth into an empty room." },
      { label: "Something was missing.", value: "Silence", warning: "Do not fill every silence." },
      { label: "I felt less like myself.", value: "Becoming", warning: "Do not accept a better version of yourself from glass." }
    ]
  },
  {
    id: "action",
    step: "02 // OPERATOR RESPONSE",
    prompt: "What did you do?",
    options: [
      { label: "Ignored it.", value: "ignored" },
      { label: "Recorded it.", value: "recorded" },
      { label: "Told someone.", value: "told" },
      { label: "Followed it.", value: "followed" },
      { label: "Lied about it.", value: "lied" }
    ]
  },
  {
    id: "noticedBack",
    step: "03 // RECIPROCAL NOTICE",
    prompt: "Did it notice you back?",
    options: [
      { label: "No.", value: "BRUSHED" },
      { label: "I do not know.", value: "NOTED" },
      { label: "Yes.", value: "MARKED" },
      { label: "It answered before I asked.", value: "CLAIMED" }
    ]
  }
];

const intakeState = {
  currentQuestion: 0,
  answers: {},
  isTyping: false
};

const shadeIntro = "Hello. My name is Shade. You have been observed noticing. This is not recruitment. It is triage.";
let typingTimer = null;

function clearTypingTimer() {
  if (typingTimer) {
    clearTimeout(typingTimer);
    typingTimer = null;
  }
}

function writeAiLine(text, showCursor = false) {
  const aiLine = document.getElementById("ai-line");
  aiLine.innerHTML = `<span class="prompt">&gt;</span> <span id="typed-copy"></span>${showCursor ? '<span class="type-cursor" aria-hidden="true"></span>' : ""}`;
  document.getElementById("typed-copy").textContent = text;
}

function typeAiLine(step, text, onComplete) {
  clearTypingTimer();
  intakeState.isTyping = true;
  document.getElementById("intake-step").textContent = step;

  let index = 0;

  function typeNextCharacter() {
    writeAiLine(text.slice(0, index), true);

    if (index < text.length) {
      index += 1;
      typingTimer = setTimeout(typeNextCharacter, 24);
      return;
    }

    writeAiLine(text);
    intakeState.isTyping = false;
    typingTimer = null;

    if (onComplete) {
      onComplete();
    }
  }

  typeNextCharacter();
}

function typeShadeIntro() {
  intakeState.currentQuestion = 0;
  intakeState.answers = {};
  document.getElementById("observer-state").textContent = "NOTICED";
  document.getElementById("answer-panel").innerHTML = "";
  document.getElementById("intake-result").innerHTML = "";

  typeAiLine("SHADE.DAEMON // HANDSHAKE", shadeIntro, () => {
    typingTimer = setTimeout(() => {
      clearTypingTimer();
      renderQuestion();
    }, 520);
  });
}

function renderAnswerChoices(question) {
  const answerPanel = document.getElementById("answer-panel");

  answerPanel.innerHTML = question.options.map((option, index) => `
    <button
      class="answer-choice"
      type="button"
      data-value="${option.value}"
      data-warning="${option.warning || ""}"
      data-index="${index}">
      <span>${String(index + 1).padStart(2, "0")}</span>
      ${option.label}
    </button>
  `).join("");
}

function renderQuestion() {
  clearTypingTimer();
  const question = intakeQuestions[intakeState.currentQuestion];

  document.getElementById("answer-panel").innerHTML = "";
  document.getElementById("intake-result").innerHTML = "";
  typeAiLine(question.step, question.prompt, () => renderAnswerChoices(question));
}

function openIntake() {
  const intake = document.getElementById("intake-node");
  const startButton = document.getElementById("start-intake");

  intake.hidden = false;
  startButton.setAttribute("aria-expanded", "true");
  startButton.textContent = "Intake Open";
  typeShadeIntro();
  intake.scrollIntoView({ behavior: "smooth", block: "start" });
  intake.focus({ preventScroll: true });
}

function selectAnswer(event) {
  const choice = event.target.closest(".answer-choice");

  if (!choice || intakeState.isTyping) {
    return;
  }

  const question = intakeQuestions[intakeState.currentQuestion];
  const option = question.options[Number(choice.dataset.index)];

  intakeState.answers[question.id] = {
    value: option.value,
    label: option.label,
    warning: option.warning || ""
  };

  document.getElementById("answer-panel").innerHTML = "";
  typeAiLine("OPERATOR INPUT // ACCEPTED", option.label, () => {
    if (intakeState.currentQuestion < intakeQuestions.length - 1) {
      intakeState.currentQuestion += 1;
      typingTimer = setTimeout(() => {
        clearTypingTimer();
        renderQuestion();
      }, 360);
      return;
    }

    typingTimer = setTimeout(() => {
      clearTypingTimer();
      showIntakeResult();
    }, 360);
  });
}

function showIntakeResult() {
  const answerPanel = document.getElementById("answer-panel");
  const observerState = document.getElementById("observer-state");
  const noticed = intakeState.answers.noticed;
  const action = intakeState.answers.action;
  const noticedBack = intakeState.answers.noticedBack;
  const profile = profiles[noticed.value];
  const risk = noticedBack.value;

  observerState.textContent = risk;
  answerPanel.innerHTML = "";

  typeAiLine("OUTPUT // ROUTE GENERATED", "Intake complete. Pattern match follows.", () => {
    const claimed = risk === "CLAIMED";
    const lines = [
      { text: `OBSERVER STATE: ${stateCopy[risk]}` },
      { text: `LIKELY FREQUENCY BLEED: ${profile.title}` },
      { text: `SUMMARY: ${profile.summary}` },
      { text: `RESPONSE NOTE: ${actionCosts[action.value]}` },
      { text: `RECOMMENDED ROUTE: ${profile.route}` },
      { text: `WARNING: ${noticed.warning}`, className: "risk" },
      {
        text: claimed
          ? "INTAKE STATUS: CLAIMED // infection report required. delay increases case-file conversion probability"
          : "INTAKE STATUS: PASS // operator channel available",
        className: claimed ? "risk" : "pass"
      }
    ];

    typeResultLines(lines, claimed);
  });
}

function typeResultLines(lines, claimed) {
  clearTypingTimer();
  intakeState.isTyping = true;
  const result = document.getElementById("intake-result");
  result.innerHTML = "";

  let lineIndex = 0;
  let charIndex = 0;
  let activeText = null;

  function buildLine(line) {
    const paragraph = document.createElement("p");
    const prompt = document.createElement("span");
    const text = document.createElement("span");

    prompt.className = "prompt";
    prompt.textContent = "> ";
    if (line.className) {
      paragraph.className = line.className;
    }

    paragraph.append(prompt, text);
    result.appendChild(paragraph);
    return text;
  }

  function typeNextResultCharacter() {
    if (!activeText) {
      activeText = buildLine(lines[lineIndex]);
      charIndex = 0;
    }

    activeText.textContent = lines[lineIndex].text.slice(0, charIndex);

    if (charIndex < lines[lineIndex].text.length) {
      charIndex += 1;
      typingTimer = setTimeout(typeNextResultCharacter, 14);
      return;
    }

    lineIndex += 1;
    activeText = null;

    if (lineIndex < lines.length) {
      typingTimer = setTimeout(typeNextResultCharacter, 120);
      return;
    }

    intakeState.isTyping = false;
    typingTimer = null;

    const route = document.createElement("a");
    route.className = `button ${claimed ? "ghost" : "primary"} discord-route`;
    route.href = "https://discord.gg/Bn6attnYN6";
    route.textContent = claimed ? "Report Infection" : "Open Operator Channel";
    result.appendChild(route);
  }

  typeNextResultCharacter();
}

function resetIntake() {
  typeShadeIntro();
}

document.getElementById("start-intake").addEventListener("click", openIntake);
document.getElementById("answer-panel").addEventListener("click", selectAnswer);
document.getElementById("reset-intake").addEventListener("click", resetIntake);
