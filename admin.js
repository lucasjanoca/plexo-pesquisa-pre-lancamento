"use strict";

const CONFIG = window.PLEXO_CONFIG || {};
const SESSION_KEY = "plexoSurveyAdminSessionV2";
const PAGE_SIZE = 1000;
const MAX_ROWS = 10000;
const CARD_PAGE_SIZE = 20;
const SESSION_ABSOLUTE_MS = 8 * 60 * 60 * 1000;

const questionDetails = [
  {
    key: "discovery",
    title: "Quando você quer descobrir algo para fazer na cidade, onde procura primeiro?"
  },
  {
    key: "promotions",
    title: "Você costuma descobrir promoções antes de fazer suas compras?"
  },
  {
    key: "services",
    title: "Você precisa de um profissional. O que faz primeiro?"
  },
  {
    key: "events",
    title: "Quando acontece algo legal na cidade, como você costuma ficar sabendo?"
  },
  {
    key: "priority",
    title: "Se você pudesse organizar UMA dessas coisas em um só lugar, qual escolheria?"
  },
  {
    key: "open_feedback",
    title: "O que mais faz falta em uma experiência digital da sua cidade?",
    open: true
  },
  {
    key: "interest",
    title: "Você testaria uma nova plataforma feita especialmente para a sua cidade?"
  }
];

const choiceQuestions = [
  {
    key: "discovery",
    title: "Onde a pessoa procura algo para fazer?",
    options: ["Instagram", "WhatsApp", "Google", "Amigos / conhecidos", "Nem sei onde procurar"]
  },
  {
    key: "promotions",
    title: "Costuma descobrir promoções antes de comprar?",
    options: ["Sempre procuro", "Às vezes", "Só quando vejo por acaso", "Quase nunca"]
  },
  {
    key: "services",
    title: "Como procura um profissional?",
    options: ["Pergunto para conhecidos", "Procuro nas redes sociais", "Pesquiso no Google", "Procuro em grupos / WhatsApp", "Normalmente dá trabalho encontrar"]
  },
  {
    key: "events",
    title: "Como fica sabendo de eventos?",
    options: ["Normalmente já sei antes", "Descubro em cima da hora", "Às vezes descubro depois", "Quase nunca fico sabendo"]
  },
  {
    key: "priority",
    title: "O que a pessoa organizaria em um só lugar?",
    options: ["Promoções", "Serviços e profissionais", "Eventos", "Compra e venda", "Informações da cidade"]
  },
  {
    key: "interest",
    title: "Testaria uma plataforma feita para a cidade?",
    options: ["Com certeza", "Quero conhecer primeiro", "Talvez", "Provavelmente não"]
  }
];

let allResponses = [];
let activeSession = null;
let loading = false;
let visibleLimit = CARD_PAGE_SIZE;
let detailRows = [];
let activeDetailIndex = -1;
let hiddenAt = 0;

const loginView = document.getElementById("loginView");
const dashboardView = document.getElementById("dashboardView");
const loginForm = document.getElementById("loginForm");
const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const loginBtn = document.getElementById("loginBtn");
const authMessage = document.getElementById("authMessage");
const sessionUser = document.getElementById("sessionUser");
const refreshBtn = document.getElementById("refreshBtn");
const exportBtn = document.getElementById("exportBtn");
const logoutBtn = document.getElementById("logoutBtn");
const periodFilter = document.getElementById("periodFilter");
const interestFilter = document.getElementById("interestFilter");
const sortFilter = document.getElementById("sortFilter");
const responseSearch = document.getElementById("responseSearch");
const panelMessage = document.getElementById("panelMessage");
const dashboardSubtitle = document.getElementById("dashboardSubtitle");
const totalResponses = document.getElementById("totalResponses");
const responsePeriodLabel = document.getElementById("responsePeriodLabel");
const positiveInterest = document.getElementById("positiveInterest");
const topPriority = document.getElementById("topPriority");
const topPriorityShare = document.getElementById("topPriorityShare");
const averageDuration = document.getElementById("averageDuration");
const responseCount = document.getElementById("responseCount");
const responseCards = document.getElementById("responseCards");
const loadMoreWrap = document.getElementById("loadMoreWrap");
const loadMoreBtn = document.getElementById("loadMoreBtn");
const breakdownGrid = document.getElementById("breakdownGrid");
const feedbackList = document.getElementById("feedbackList");
const feedbackCount = document.getElementById("feedbackCount");
const detailOverlay = document.getElementById("detailOverlay");
const detailCloseBtn = document.getElementById("detailCloseBtn");
const detailTitle = document.getElementById("detailTitle");
const detailMeta = document.getElementById("detailMeta");
const detailAnswers = document.getElementById("detailAnswers");
const detailPrevBtn = document.getElementById("detailPrevBtn");
const detailNextBtn = document.getElementById("detailNextBtn");
const detailPosition = document.getElementById("detailPosition");

function isConfigured() {
  const validUrl = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(String(CONFIG.supabaseUrl || ""));
  const validKey = typeof CONFIG.publishableKey === "string" && CONFIG.publishableKey.startsWith("sb_publishable_");
  return validUrl && validKey;
}

function authBaseUrl() {
  return `${String(CONFIG.supabaseUrl).replace(/\/$/, "")}/auth/v1`;
}

function restBaseUrl() {
  return `${String(CONFIG.supabaseUrl).replace(/\/$/, "")}/rest/v1`;
}

function safeSessionRead() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (!Number(parsed.startedAt) || Date.now() - Number(parsed.startedAt) > SESSION_ABSOLUTE_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function safeSessionWrite(session) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // A aba atual continua funcionando mesmo se o navegador bloquear sessionStorage.
  }
}

function safeSessionClear() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Sem ação necessária.
  }
}

function showAuthMessage(message) {
  authMessage.textContent = message;
  authMessage.classList.remove("hidden-display");
}

function clearAuthMessage() {
  authMessage.textContent = "";
  authMessage.classList.add("hidden-display");
}

function showPanelMessage(message, isError = false) {
  panelMessage.textContent = message;
  panelMessage.classList.remove("hidden-display");
  panelMessage.setAttribute("role", isError ? "alert" : "status");
}

function clearPanelMessage() {
  panelMessage.textContent = "";
  panelMessage.classList.add("hidden-display");
}

function setLoading(isLoading) {
  loading = isLoading;
  [loginBtn, refreshBtn, exportBtn, periodFilter, interestFilter, sortFilter, responseSearch, loadMoreBtn].forEach((control) => {
    if (control) control.disabled = isLoading;
  });
}

function normalizeSession(payload, previousStartedAt) {
  const expiresIn = Number(payload.expires_in) || 3600;
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt: Date.now() + expiresIn * 1000,
    startedAt: Number(previousStartedAt) || Date.now(),
    email: payload.user && payload.user.email ? payload.user.email : "Administrador"
  };
}

function hasAdminClaim(user) {
  if (!user || !user.app_metadata) return false;
  const value = user.app_metadata.plexo_survey_admin;
  return value === true || value === "true";
}

async function readJsonSafely(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function friendlyAuthError(payload) {
  const raw = String(payload && (payload.msg || payload.message || payload.error_description || ""));
  const normalized = raw.toLocaleLowerCase("pt-BR");
  if (normalized.includes("invalid login") || normalized.includes("invalid credentials")) return "E-mail ou senha inválidos.";
  if (normalized.includes("email not confirmed")) return "Este e-mail ainda não foi confirmado.";
  if (normalized.includes("rate limit") || normalized.includes("too many")) return "Muitas tentativas. Aguarde um pouco e tente novamente.";
  return "Não foi possível entrar agora. Confira os dados e tente novamente.";
}

async function signIn(email, password) {
  const response = await fetch(`${authBaseUrl()}/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: CONFIG.publishableKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
    referrerPolicy: "no-referrer"
  });

  const payload = await readJsonSafely(response);
  if (!response.ok || !payload || !payload.access_token) {
    throw new Error(friendlyAuthError(payload));
  }

  return normalizeSession(payload);
}

async function refreshSession() {
  if (!activeSession || !activeSession.refreshToken) throw new Error("Sessão expirada.");
  if (Date.now() - Number(activeSession.startedAt || 0) > SESSION_ABSOLUTE_MS) throw new Error("Sessão expirada.");

  const response = await fetch(`${authBaseUrl()}/token?grant_type=refresh_token`, {
    method: "POST",
    headers: {
      apikey: CONFIG.publishableKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ refresh_token: activeSession.refreshToken }),
    cache: "no-store",
    referrerPolicy: "no-referrer"
  });

  const payload = await readJsonSafely(response);
  if (!response.ok || !payload || !payload.access_token) throw new Error("Sessão expirada.");

  activeSession = normalizeSession(payload, activeSession.startedAt);
  safeSessionWrite(activeSession);
  return activeSession;
}

async function ensureFreshSession() {
  if (!activeSession) throw new Error("Sessão ausente.");
  if (Date.now() - Number(activeSession.startedAt || 0) > SESSION_ABSOLUTE_MS) throw new Error("Sessão expirada.");
  if (Number(activeSession.expiresAt) - Date.now() < 60_000) await refreshSession();
  return activeSession;
}

async function fetchCurrentUser() {
  await ensureFreshSession();
  const response = await fetch(`${authBaseUrl()}/user`, {
    headers: {
      apikey: CONFIG.publishableKey,
      Authorization: `Bearer ${activeSession.accessToken}`
    },
    cache: "no-store",
    referrerPolicy: "no-referrer"
  });

  const payload = await readJsonSafely(response);
  if (!response.ok || !payload || !payload.id) throw new Error("Sessão inválida.");
  return payload;
}

async function verifyAdminSession() {
  const user = await fetchCurrentUser();
  if (!hasAdminClaim(user)) throw new Error("Esta conta não possui permissão administrativa da pesquisa.");
  activeSession.email = user.email || activeSession.email || "Administrador";
  safeSessionWrite(activeSession);
  return user;
}

async function authorizedFetch(url, options = {}, retry = true) {
  await ensureFreshSession();
  const headers = Object.assign({}, options.headers || {}, {
    apikey: CONFIG.publishableKey,
    Authorization: `Bearer ${activeSession.accessToken}`
  });

  const response = await fetch(url, Object.assign({}, options, {
    headers,
    cache: "no-store",
    referrerPolicy: "no-referrer"
  }));

  if (response.status === 401 && retry) {
    await refreshSession();
    return authorizedFetch(url, options, false);
  }

  return response;
}

async function fetchResponses() {
  const columns = [
    "id",
    "created_at",
    "survey_version",
    "discovery",
    "promotions",
    "services",
    "events",
    "priority",
    "open_feedback",
    "interest",
    "duration_seconds"
  ].join(",");

  const rows = [];
  let offset = 0;

  while (offset < MAX_ROWS) {
    const url = `${restBaseUrl()}/plexo_survey_responses?select=${encodeURIComponent(columns)}&order=created_at.desc&limit=${PAGE_SIZE}&offset=${offset}`;
    const response = await authorizedFetch(url);

    if (response.status === 403) {
      throw new Error("Sua conta entrou, mas não possui a permissão administrativa da pesquisa.");
    }

    if (!response.ok) {
      throw new Error(`Não foi possível carregar as respostas (${response.status}).`);
    }

    const batch = await readJsonSafely(response);
    if (!Array.isArray(batch)) throw new Error("O banco retornou uma resposta inesperada.");

    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return rows;
}

function showDashboard() {
  loginView.classList.add("hidden-display");
  dashboardView.classList.remove("hidden-display");
  sessionUser.textContent = activeSession && activeSession.email ? activeSession.email : "Administrador";
  sessionUser.classList.remove("hidden-display");
}

function showLogin() {
  dashboardView.classList.add("hidden-display");
  loginView.classList.remove("hidden-display");
  sessionUser.classList.add("hidden-display");
  passwordInput.value = "";
  closeDetail();
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}

function formatDuration(value) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
}

function percent(part, total) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

function normalizeSearch(value) {
  return String(value || "").trim().toLocaleLowerCase("pt-BR");
}

function rowSearchText(row) {
  return normalizeSearch([
    row.discovery,
    row.promotions,
    row.services,
    row.events,
    row.priority,
    row.open_feedback,
    row.interest,
    formatDate(row.created_at)
  ].filter(Boolean).join(" "));
}

function matchesInterest(row) {
  switch (interestFilter.value) {
    case "positive":
      return row.interest === "Com certeza" || row.interest === "Quero conhecer primeiro";
    case "maybe":
      return row.interest === "Talvez";
    case "negative":
      return row.interest === "Provavelmente não";
    default:
      return true;
  }
}

function matchesPeriod(row) {
  const period = periodFilter.value;
  if (period === "all") return true;

  const time = new Date(row.created_at).getTime();
  if (!Number.isFinite(time)) return false;

  if (period === "1") {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return time >= startOfToday;
  }

  const days = Number(period);
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return time >= cutoff;
}

function filteredResponses() {
  const term = normalizeSearch(responseSearch.value);
  const rows = allResponses.filter((row) => {
    if (!matchesPeriod(row) || !matchesInterest(row)) return false;
    return !term || rowSearchText(row).includes(term);
  });

  rows.sort((a, b) => {
    const timeA = new Date(a.created_at).getTime() || 0;
    const timeB = new Date(b.created_at).getTime() || 0;
    return sortFilter.value === "oldest" ? timeA - timeB : timeB - timeA;
  });

  return rows;
}

function responsePeriodText() {
  switch (periodFilter.value) {
    case "1": return "hoje";
    case "7": return "nos últimos 7 dias";
    case "30": return "nos últimos 30 dias";
    default: return "em todo o período";
  }
}

function countValues(rows, key) {
  const counts = new Map();
  rows.forEach((row) => {
    const value = row[key];
    if (!value) return;
    counts.set(value, (counts.get(value) || 0) + 1);
  });
  return counts;
}

function responseOrdinal(row) {
  const index = allResponses.findIndex((item) => item.id === row.id);
  if (index < 0) return "—";
  return String(allResponses.length - index).padStart(3, "0");
}

function isPositiveInterest(value) {
  return value === "Com certeza" || value === "Quero conhecer primeiro";
}

function renderKpis(rows) {
  totalResponses.textContent = new Intl.NumberFormat("pt-BR").format(rows.length);
  responsePeriodLabel.textContent = responsePeriodText();

  const positive = rows.filter((row) => isPositiveInterest(row.interest)).length;
  positiveInterest.textContent = rows.length ? `${percent(positive, rows.length)}%` : "—";

  const priorities = countValues(rows, "priority");
  let leadingPriority = null;
  let leadingCount = 0;
  priorities.forEach((count, label) => {
    if (count > leadingCount) {
      leadingPriority = label;
      leadingCount = count;
    }
  });
  topPriority.textContent = leadingPriority || "—";
  topPriorityShare.textContent = leadingPriority ? `${leadingCount} respostas · ${percent(leadingCount, rows.length)}%` : "sem respostas no filtro";

  const durations = rows.map((row) => Number(row.duration_seconds)).filter((value) => Number.isFinite(value) && value > 0);
  const average = durations.length ? durations.reduce((sum, value) => sum + value, 0) / durations.length : null;
  averageDuration.textContent = average ? formatDuration(average) : "—";
}

function createSummaryItem(label, value) {
  const item = document.createElement("div");
  item.className = "response-summary-item";

  const labelNode = document.createElement("span");
  labelNode.textContent = label;

  const valueNode = document.createElement("strong");
  valueNode.textContent = value || "—";

  item.append(labelNode, valueNode);
  return item;
}

function renderResponseCards(rows) {
  responseCards.replaceChildren();
  responseCount.textContent = `${rows.length} ${rows.length === 1 ? "resposta" : "respostas"}`;

  if (!rows.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Nenhuma resposta corresponde aos filtros selecionados.";
    responseCards.appendChild(empty);
    loadMoreWrap.classList.add("hidden-display");
    return;
  }

  const visibleRows = rows.slice(0, visibleLimit);
  visibleRows.forEach((row) => {
    const card = document.createElement("article");
    card.className = "response-card";

    const top = document.createElement("div");
    top.className = "response-card-top";

    const titleWrap = document.createElement("div");
    const title = document.createElement("h3");
    title.className = "response-number";
    title.textContent = `Resposta #${responseOrdinal(row)}`;
    const date = document.createElement("p");
    date.className = "response-date";
    date.textContent = formatDate(row.created_at);
    titleWrap.append(title, date);

    const badge = document.createElement("span");
    badge.className = `response-badge${isPositiveInterest(row.interest) ? " positive" : ""}`;
    badge.textContent = row.interest || "Sem interesse informado";
    top.append(titleWrap, badge);

    const summary = document.createElement("div");
    summary.className = "response-summary";
    summary.append(
      createSummaryItem("Prioridade", row.priority),
      createSummaryItem("Tempo", formatDuration(row.duration_seconds))
    );

    card.append(top, summary);

    if (row.open_feedback) {
      const comment = document.createElement("p");
      comment.className = "response-comment-preview";
      comment.textContent = `“${String(row.open_feedback).trim()}”`;
      card.appendChild(comment);
    }

    const openButton = document.createElement("button");
    openButton.type = "button";
    openButton.className = "response-open-btn";
    openButton.dataset.responseId = row.id;
    openButton.textContent = "Ver resposta completa →";
    card.appendChild(openButton);

    responseCards.appendChild(card);
  });

  if (rows.length > visibleLimit) {
    loadMoreWrap.classList.remove("hidden-display");
    loadMoreBtn.textContent = `Mostrar mais (${rows.length - visibleLimit})`;
  } else {
    loadMoreWrap.classList.add("hidden-display");
  }
}

function renderBreakdowns(rows) {
  breakdownGrid.replaceChildren();

  choiceQuestions.forEach((question) => {
    const card = document.createElement("article");
    card.className = "breakdown-card";

    const title = document.createElement("h3");
    title.textContent = question.title;
    card.appendChild(title);

    const counts = countValues(rows, question.key);
    question.options.forEach((option) => {
      const count = counts.get(option) || 0;
      const pct = percent(count, rows.length);

      const rowNode = document.createElement("div");
      rowNode.className = "choice-row";

      const label = document.createElement("span");
      label.className = "choice-label";
      label.textContent = option;

      const value = document.createElement("span");
      value.className = "choice-value";
      value.textContent = `${count} · ${pct}%`;

      const progress = document.createElement("progress");
      progress.max = 100;
      progress.value = pct;
      progress.setAttribute("aria-label", `${option}: ${pct}%`);

      rowNode.append(label, value, progress);
      card.appendChild(rowNode);
    });

    breakdownGrid.appendChild(card);
  });
}

function renderFeedback(rows) {
  feedbackList.replaceChildren();
  const feedbackRows = rows.filter((row) => String(row.open_feedback || "").trim());
  feedbackCount.textContent = `${feedbackRows.length} ${feedbackRows.length === 1 ? "comentário" : "comentários"}`;

  if (!feedbackRows.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Nenhum comentário aberto neste filtro.";
    feedbackList.appendChild(empty);
    return;
  }

  feedbackRows.slice(0, 100).forEach((row) => {
    const card = document.createElement("article");
    card.className = "feedback-card";

    const text = document.createElement("p");
    text.textContent = String(row.open_feedback).trim();

    const footer = document.createElement("footer");
    const date = document.createElement("span");
    date.textContent = formatDate(row.created_at);
    const priority = document.createElement("span");
    priority.textContent = row.priority || "—";
    footer.append(date, priority);

    const openButton = document.createElement("button");
    openButton.type = "button";
    openButton.className = "soft-btn";
    openButton.dataset.responseId = row.id;
    openButton.textContent = "Abrir resposta completa";

    card.append(text, footer, openButton);
    feedbackList.appendChild(card);
  });

  if (feedbackRows.length > 100) {
    const more = document.createElement("div");
    more.className = "empty-state";
    more.textContent = `Exibindo os 100 comentários mais recentes de ${feedbackRows.length}. Use o CSV para ver todos.`;
    feedbackList.appendChild(more);
  }
}

function renderDashboard() {
  const rows = filteredResponses();
  visibleLimit = Math.max(CARD_PAGE_SIZE, Math.min(visibleLimit, rows.length || CARD_PAGE_SIZE));
  renderKpis(rows);
  renderResponseCards(rows);
  renderBreakdowns(rows);
  renderFeedback(rows);

  if (allResponses.length) {
    const newest = formatDate(allResponses[0].created_at);
    dashboardSubtitle.textContent = `${new Intl.NumberFormat("pt-BR").format(allResponses.length)} respostas carregadas · última em ${newest}`;
  } else {
    dashboardSubtitle.textContent = "Nenhuma resposta registrada ainda.";
  }
}

async function loadDashboardData() {
  if (loading) return;
  setLoading(true);
  clearPanelMessage();
  dashboardSubtitle.textContent = "Carregando respostas…";

  try {
    await verifyAdminSession();
    allResponses = await fetchResponses();
    visibleLimit = CARD_PAGE_SIZE;
    showDashboard();
    renderDashboard();
    if (allResponses.length >= MAX_ROWS) {
      showPanelMessage(`O painel carregou as ${MAX_ROWS} respostas mais recentes. Exporte periodicamente se o volume crescer além desse limite.`);
    }
  } catch (error) {
    console.error("Plexo admin load error", error);
    const message = error && error.message ? error.message : "Não foi possível carregar o painel.";
    if (/sessão|permissão|conta/i.test(message)) {
      activeSession = null;
      safeSessionClear();
      showLogin();
      showAuthMessage(message);
    } else {
      showPanelMessage(message, true);
      dashboardSubtitle.textContent = "Falha ao carregar as respostas.";
    }
  } finally {
    setLoading(false);
  }
}

function detailValue(row, question) {
  const value = row[question.key];
  if (question.key === "open_feedback" && !String(value || "").trim()) return "Não respondeu (opcional)";
  return String(value || "—").trim() || "—";
}

function renderDetail() {
  if (activeDetailIndex < 0 || activeDetailIndex >= detailRows.length) {
    closeDetail();
    return;
  }

  const row = detailRows[activeDetailIndex];
  detailTitle.textContent = `Resposta #${responseOrdinal(row)}`;
  detailMeta.textContent = `${formatDate(row.created_at)} · ${formatDuration(row.duration_seconds)}`;
  detailPosition.textContent = `${activeDetailIndex + 1} de ${detailRows.length}`;
  detailPrevBtn.disabled = activeDetailIndex <= 0;
  detailNextBtn.disabled = activeDetailIndex >= detailRows.length - 1;
  detailAnswers.replaceChildren();

  questionDetails.forEach((question, index) => {
    const item = document.createElement("article");
    item.className = "detail-answer";

    const number = document.createElement("div");
    number.className = "detail-question-number";
    number.textContent = `PERGUNTA ${String(index + 1).padStart(2, "0")}`;

    const title = document.createElement("p");
    title.className = "detail-question";
    title.textContent = question.title;

    const value = document.createElement("p");
    value.className = `detail-value${question.open ? " open-answer" : ""}`;
    value.textContent = detailValue(row, question);

    item.append(number, title, value);
    detailAnswers.appendChild(item);
  });
}

function openDetailById(id) {
  detailRows = filteredResponses();
  activeDetailIndex = detailRows.findIndex((row) => row.id === id);
  if (activeDetailIndex < 0) return;

  detailOverlay.classList.remove("hidden-display");
  detailOverlay.setAttribute("aria-hidden", "false");
  document.body.classList.add("detail-open");
  renderDetail();
  detailCloseBtn.focus();
}

function closeDetail() {
  if (!detailOverlay) return;
  detailOverlay.classList.add("hidden-display");
  detailOverlay.setAttribute("aria-hidden", "true");
  document.body.classList.remove("detail-open");
  detailRows = [];
  activeDetailIndex = -1;
}

function csvEscape(value) {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function exportCsv() {
  const rows = filteredResponses();
  if (!rows.length) {
    showPanelMessage("Não há respostas nos filtros selecionados para exportar.", true);
    return;
  }

  const columns = [
    ["created_at", "Data"],
    ["discovery", "Descoberta"],
    ["promotions", "Promoções"],
    ["services", "Serviços"],
    ["events", "Eventos"],
    ["priority", "Prioridade"],
    ["open_feedback", "Comentário aberto"],
    ["interest", "Interesse"],
    ["duration_seconds", "Duração (segundos)"]
  ];

  const lines = [columns.map(([, label]) => csvEscape(label)).join(",")];
  rows.forEach((row) => {
    lines.push(columns.map(([key]) => csvEscape(row[key])).join(","));
  });

  const blob = new Blob(["\uFEFF", lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `plexo-pesquisa-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function logout() {
  const token = activeSession && activeSession.accessToken;
  activeSession = null;
  allResponses = [];
  safeSessionClear();
  showLogin();
  clearPanelMessage();

  if (!token) return;
  try {
    await fetch(`${authBaseUrl()}/logout`, {
      method: "POST",
      headers: {
        apikey: CONFIG.publishableKey,
        Authorization: `Bearer ${token}`
      },
      cache: "no-store",
      referrerPolicy: "no-referrer"
    });
  } catch {
    // A sessão local já foi removida; falha de rede no logout remoto não bloqueia a saída.
  }
}

function resetFiltersAndRender() {
  visibleLimit = CARD_PAGE_SIZE;
  closeDetail();
  renderDashboard();
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (loading) return;
  clearAuthMessage();

  if (!isConfigured()) {
    showAuthMessage("O painel ainda não está configurado com o Supabase.");
    return;
  }

  const email = emailInput.value.trim();
  const password = passwordInput.value;
  if (!email || !password) {
    showAuthMessage("Preencha o e-mail e a senha.");
    return;
  }

  setLoading(true);
  try {
    activeSession = await signIn(email, password);
    passwordInput.value = "";
    await verifyAdminSession();
    safeSessionWrite(activeSession);
    showDashboard();
    setLoading(false);
    await loadDashboardData();
  } catch (error) {
    activeSession = null;
    safeSessionClear();
    passwordInput.value = "";
    const message = error && error.message ? error.message : "Não foi possível entrar no painel.";
    showAuthMessage(message);
  } finally {
    setLoading(false);
  }
});

refreshBtn.addEventListener("click", () => {
  void loadDashboardData();
});

exportBtn.addEventListener("click", exportCsv);
logoutBtn.addEventListener("click", () => {
  void logout();
});
periodFilter.addEventListener("change", resetFiltersAndRender);
interestFilter.addEventListener("change", resetFiltersAndRender);
sortFilter.addEventListener("change", resetFiltersAndRender);
responseSearch.addEventListener("input", resetFiltersAndRender);

loadMoreBtn.addEventListener("click", () => {
  visibleLimit += CARD_PAGE_SIZE;
  renderResponseCards(filteredResponses());
});

responseCards.addEventListener("click", (event) => {
  const button = event.target.closest("[data-response-id]");
  if (button) openDetailById(button.dataset.responseId);
});

feedbackList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-response-id]");
  if (button) openDetailById(button.dataset.responseId);
});

detailCloseBtn.addEventListener("click", closeDetail);
detailOverlay.addEventListener("click", (event) => {
  if (event.target && event.target.dataset && event.target.dataset.closeDetail === "true") closeDetail();
});
detailPrevBtn.addEventListener("click", () => {
  if (activeDetailIndex > 0) {
    activeDetailIndex -= 1;
    renderDetail();
  }
});
detailNextBtn.addEventListener("click", () => {
  if (activeDetailIndex < detailRows.length - 1) {
    activeDetailIndex += 1;
    renderDetail();
  }
});

document.addEventListener("keydown", (event) => {
  if (detailOverlay.classList.contains("hidden-display")) return;
  if (event.key === "Escape") closeDetail();
  if (event.key === "ArrowLeft" && activeDetailIndex > 0) {
    activeDetailIndex -= 1;
    renderDetail();
  }
  if (event.key === "ArrowRight" && activeDetailIndex < detailRows.length - 1) {
    activeDetailIndex += 1;
    renderDetail();
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    hiddenAt = Date.now();
    return;
  }

  if (activeSession && hiddenAt && Date.now() - hiddenAt > 15 * 60 * 1000) {
    void loadDashboardData();
  }
  hiddenAt = 0;
});

(async function bootstrap() {
  if (!isConfigured()) {
    showAuthMessage("O painel ainda não está configurado com o Supabase.");
    loginBtn.disabled = true;
    return;
  }

  activeSession = safeSessionRead();
  if (!activeSession || !activeSession.accessToken || !activeSession.refreshToken) {
    activeSession = null;
    safeSessionClear();
    showLogin();
    return;
  }

  try {
    await verifyAdminSession();
    showDashboard();
    await loadDashboardData();
  } catch (error) {
    console.warn("Plexo admin session restore failed", error);
    activeSession = null;
    safeSessionClear();
    showLogin();
  }
})();
