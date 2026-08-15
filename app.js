"use strict";

const questions = [
  {
    key: "discovery",
    tag: "DESCOBERTA",
    title: "Quando você quer descobrir algo para fazer na cidade, onde procura primeiro?",
    help: "Escolha o que mais representa seu comportamento.",
    answers: [
      ["📱", "Instagram"],
      ["💬", "WhatsApp"],
      ["🔎", "Google"],
      ["👥", "Amigos / conhecidos"],
      ["🤷", "Nem sei onde procurar"]
    ]
  },
  {
    key: "promotions",
    tag: "COMPRAS",
    title: "Você costuma descobrir promoções antes de fazer suas compras?",
    help: "Pense principalmente em mercados e comércio local.",
    answers: [
      ["🔥", "Sempre procuro"],
      ["👀", "Às vezes"],
      ["🛒", "Só quando vejo por acaso"],
      ["❌", "Quase nunca"]
    ]
  },
  {
    key: "services",
    tag: "SERVIÇOS",
    title: "Você precisa de um profissional. O que faz primeiro?",
    help: "Ex.: eletricista, fotógrafo, personal, manutenção, aulas...",
    answers: [
      ["💬", "Pergunto para conhecidos"],
      ["📱", "Procuro nas redes sociais"],
      ["🔎", "Pesquiso no Google"],
      ["🟢", "Procuro em grupos / WhatsApp"],
      ["😵", "Normalmente dá trabalho encontrar"]
    ]
  },
  {
    key: "events",
    tag: "EVENTOS",
    title: "Quando acontece algo legal na cidade, como você costuma ficar sabendo?",
    help: "",
    answers: [
      ["🎟️", "Normalmente já sei antes"],
      ["😮", "Descubro em cima da hora"],
      ["😭", "Às vezes descubro depois"],
      ["🤷", "Quase nunca fico sabendo"]
    ]
  },
  {
    key: "priority",
    tag: "PRIORIDADE",
    title: "Se você pudesse organizar UMA dessas coisas em um só lugar, qual escolheria?",
    help: "Sem pensar muito. Qual resolveria algo para você hoje?",
    answers: [
      ["🛒", "Promoções"],
      ["🔧", "Serviços e profissionais"],
      ["🎪", "Eventos"],
      ["🏷️", "Compra e venda"],
      ["📰", "Informações da cidade"]
    ]
  },
  {
    key: "open_feedback",
    tag: "SUA VEZ",
    title: "Agora vale tudo. O que mais faz falta em uma experiência digital da sua cidade?",
    help: "Pode escrever pouco. Essa resposta é opcional.",
    type: "text"
  },
  {
    key: "interest",
    tag: "ÚLTIMA",
    title: "Você testaria uma nova plataforma feita especialmente para a sua cidade?",
    help: "Última. Prometemos 😅",
    answers: [
      ["🚀", "Com certeza"],
      ["👀", "Quero conhecer primeiro"],
      ["🤔", "Talvez"],
      ["❌", "Provavelmente não"]
    ]
  }
];

const CONFIG = window.PLEXO_CONFIG || {};
const STORAGE = Object.freeze({
  token: "plexoSurveyClientTokenV1",
  completed: "plexoSurveyCompletedV1"
});

let current = 0;
let navigationLocked = false;
let submitting = false;
let startedAt = 0;
const responses = {};

const intro = document.getElementById("intro");
const survey = document.getElementById("survey");
const final = document.getElementById("final");
const startBtn = document.getElementById("startBtn");
const backBtn = document.getElementById("backBtn");
const skipBtn = document.getElementById("skipBtn");
const host = document.getElementById("questionHost");
const template = document.getElementById("questionTemplate");
const progressText = document.getElementById("progressText");
const progressPercent = document.getElementById("progressPercent");
const progressBar = document.getElementById("progressBar");
const progressTrack = document.getElementById("progressTrack");
const stepIndicator = document.getElementById("stepIndicator");
const submitError = document.getElementById("submitError");
const submitErrorText = document.getElementById("submitErrorText");
const retryBtn = document.getElementById("retryBtn");
const setupWarning = document.getElementById("setupWarning");

function safeStorageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // A pesquisa continua funcionando mesmo se o navegador bloquear localStorage.
  }
}

function isConfigured() {
  const validUrl = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(String(CONFIG.supabaseUrl || ""));
  const validKey = typeof CONFIG.publishableKey === "string" && CONFIG.publishableKey.startsWith("sb_publishable_");
  return validUrl && validKey && Number.isInteger(CONFIG.surveyVersion);
}

function showOnly(section) {
  [intro, survey, final].forEach((el) => el.classList.remove("active"));
  section.classList.add("active");
}

function showFinal() {
  showOnly(final);
  stepIndicator.textContent = "CONCLUÍDO";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function updateProgress() {
  const pct = Math.round(((current + 1) / questions.length) * 100);
  progressText.textContent = `${String(current + 1).padStart(2, "0")} / ${String(questions.length).padStart(2, "0")}`;
  progressPercent.textContent = `${pct}%`;
  progressBar.style.width = `${pct}%`;
  progressTrack.setAttribute("aria-valuenow", String(pct));
  stepIndicator.textContent = `PULSO ${String(current + 1).padStart(2, "0")}`;
}

function clearSubmitError() {
  submitError.classList.add("hidden-display");
}

function showSubmitFailure(message) {
  submitErrorText.textContent = message;
  submitError.classList.remove("hidden-display");
  submitError.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function setSurveyBusy(isBusy) {
  survey.setAttribute("aria-busy", String(isBusy));
  backBtn.disabled = isBusy;
  skipBtn.disabled = isBusy;
  host.querySelectorAll("button, textarea").forEach((control) => {
    control.disabled = isBusy;
  });
  stepIndicator.textContent = isBusy ? "ENVIANDO" : `PULSO ${String(current + 1).padStart(2, "0")}`;
}

function renderTextAnswer(answers, q) {
  const wrapper = document.createElement("div");
  wrapper.className = "text-answer";

  const textarea = document.createElement("textarea");
  textarea.maxLength = 220;
  textarea.placeholder = "Escreva aqui...";
  textarea.value = responses[q.key] || "";
  textarea.setAttribute("aria-label", q.title);
  textarea.autocomplete = "off";

  const meta = document.createElement("div");
  meta.className = "text-meta";

  const counter = document.createElement("span");
  counter.className = "char-counter";
  counter.textContent = `${textarea.value.length}/220`;

  const nextButton = document.createElement("button");
  nextButton.type = "button";
  nextButton.className = "small-next";
  nextButton.textContent = "Continuar →";

  textarea.addEventListener("input", () => {
    counter.textContent = `${textarea.value.length}/220`;
  });

  nextButton.addEventListener("click", () => {
    if (navigationLocked || submitting) return;
    responses[q.key] = textarea.value.trim();
    nextQuestion();
  });

  meta.append(counter, nextButton);
  wrapper.append(textarea, meta);
  answers.appendChild(wrapper);
  skipBtn.classList.remove("hidden");
}

function renderChoiceAnswers(answers, q) {
  q.answers.forEach(([icon, label]) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "answer-btn";
    if (responses[q.key] === label) btn.classList.add("selected");

    const iconSpan = document.createElement("span");
    iconSpan.className = "answer-icon";
    iconSpan.setAttribute("aria-hidden", "true");
    iconSpan.textContent = icon;

    const labelSpan = document.createElement("span");
    labelSpan.className = "answer-label";
    labelSpan.textContent = label;

    btn.append(iconSpan, labelSpan);
    btn.addEventListener("click", () => {
      if (navigationLocked || submitting) return;
      navigationLocked = true;
      responses[q.key] = label;

      answers.querySelectorAll(".answer-btn").forEach((item) => {
        item.disabled = true;
        item.classList.toggle("selected", item === btn);
      });

      window.setTimeout(() => {
        navigationLocked = false;
        nextQuestion();
      }, 170);
    });

    answers.appendChild(btn);
  });

  skipBtn.classList.add("hidden");
}

function renderQuestion() {
  clearSubmitError();
  updateProgress();
  host.replaceChildren();

  const q = questions[current];
  const node = template.content.cloneNode(true);
  node.querySelector(".question-tag").textContent = q.tag;
  node.querySelector(".question-title").textContent = q.title;
  node.querySelector(".question-help").textContent = q.help || "";

  const answers = node.querySelector(".answers");
  if (q.type === "text") {
    renderTextAnswer(answers, q);
  } else {
    renderChoiceAnswers(answers, q);
  }

  host.appendChild(node);
  backBtn.style.visibility = current === 0 ? "hidden" : "visible";
  backBtn.disabled = false;
  skipBtn.disabled = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function nextQuestion() {
  if (current < questions.length - 1) {
    current += 1;
    renderQuestion();
    return;
  }
  void finishSurvey();
}

function getOrCreateClientToken() {
  const existing = safeStorageGet(STORAGE.token);
  if (existing) return existing;

  const token = typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;

  safeStorageSet(STORAGE.token, token);
  return token;
}

async function sha256Hex(value) {
  if (crypto.subtle && typeof TextEncoder !== "undefined") {
    const data = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  // Fallback determinístico apenas para deduplicação em navegadores antigos.
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const chunk = (hash >>> 0).toString(16).padStart(8, "0");
  return chunk.repeat(8);
}

function buildPayload(submissionHash) {
  const duration = startedAt > 0 ? Math.min(3600, Math.max(1, Math.round((Date.now() - startedAt) / 1000))) : null;
  return {
    survey_version: CONFIG.surveyVersion,
    submission_hash: submissionHash,
    discovery: responses.discovery,
    promotions: responses.promotions,
    services: responses.services,
    events: responses.events,
    priority: responses.priority,
    open_feedback: responses.open_feedback || null,
    interest: responses.interest,
    duration_seconds: duration
  };
}

async function submitResponse(payload) {
  const endpoint = `${String(CONFIG.supabaseUrl).replace(/\/$/, "")}/rest/v1/plexo_survey_responses`;
  return fetch(endpoint, {
    method: "POST",
    headers: {
      apikey: CONFIG.publishableKey,
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    },
    body: JSON.stringify(payload),
    cache: "no-store",
    referrerPolicy: "no-referrer"
  });
}

async function finishSurvey() {
  if (submitting) return;
  if (!responses.interest) return;

  clearSubmitError();
  submitting = true;
  setSurveyBusy(true);

  try {
    const submissionHash = await sha256Hex(getOrCreateClientToken());
    const response = await submitResponse(buildPayload(submissionHash));

    if (response.ok || response.status === 409) {
      safeStorageSet(STORAGE.completed, "1");
      showFinal();
      return;
    }

    console.error("Plexo survey submission failed", response.status);
    showSubmitFailure("Não conseguimos registrar sua resposta agora. Confira sua conexão e tente novamente.");
  } catch (error) {
    console.error("Plexo survey submission error", error);
    showSubmitFailure("Não conseguimos registrar sua resposta agora. Confira sua conexão e tente novamente.");
  } finally {
    submitting = false;
    if (!final.classList.contains("active")) setSurveyBusy(false);
  }
}

startBtn.addEventListener("click", () => {
  if (!isConfigured()) return;
  showOnly(survey);
  current = 0;
  startedAt = Date.now();
  renderQuestion();
});

backBtn.addEventListener("click", () => {
  if (submitting || navigationLocked || current === 0) return;
  current -= 1;
  renderQuestion();
});

skipBtn.addEventListener("click", () => {
  if (submitting || navigationLocked) return;
  responses[questions[current].key] = "";
  nextQuestion();
});

retryBtn.addEventListener("click", () => {
  void finishSurvey();
});

if (safeStorageGet(STORAGE.completed) === "1") {
  showFinal();
} else if (!isConfigured()) {
  startBtn.disabled = true;
  setupWarning.classList.remove("hidden-display");
}
