"use strict";

const CONFIG = window.PLEXO_CONFIG || {};
const SESSION_KEY = "plexoSurveyAdminSessionV1";
const PAGE_SIZE = 1000;
const MAX_ROWS = 10000;

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
const feedbackSearch = document.getElementById("feedbackSearch");
const panelMessage = document.getElementById("panelMessage");
const dashboardSubtitle = document.getElementById("dashboardSubtitle");
const totalResponses = document.getElementById("totalResponses");
const responsePeriodLabel = document.getElementById("responsePeriodLabel");
const positiveInterest = document.getElementById("positiveInterest");
const topPriority = document.getElementById("topPriority");
const topPriorityShare = document.getElementById("topPriorityShare");
const averageDuration = document.getElementById("averageDuration");
const breakdownGrid = document.getElementById("breakdownGrid");
const feedbackList = document.getElementById("feedbackList");
const feedbackCount = document.getElementById("feedbackCount");
const latestCount = document.getElementById("latestCount");
const responsesTableBody = document.getElementById("responsesTableBody");

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
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function safeSessionWrite(session) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // O painel continua funcionando durante a aba atual, mesmo sem sessionStorage.
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
  loginBtn.disabled = isLoading;
  refreshBtn.disabled = isLoading;
  exportBtn.disabled = isLoading;
  periodFilter.disabled = isLoading;
  feedbackSearch.disabled = isLoading;
}

function normalizeSession(payload) {
  const expiresIn = Number(payload.expires_in) || 3600;
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt: Date.now() + expiresIn * 1000,
    email: payload.user && payload.user.email ? payload.user.email : "Administrador",
    user: payload.user || null
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
    const detail = payload && (payload.msg || payload.message || payload.error_description);
    throw new Error(detail || "E-mail ou senha inválidos.");
  }

  return normalizeSession(payload);
}

async function refreshSession() {
  if (!activeSession || !activeSession.refreshToken) throw new Error("Sessão expirada.");

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

  activeSession = normalizeSession(payload);
  safeSessionWrite(activeSession);
  return activeSession;
}

async function ensureFreshSession() {
  if (!activeSession) throw new Error("Sessão ausente.");
  if (Number(activeSession.expiresAt) - Date.now() < 60_000) await refreshSession();
  return activeSession;
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
      const payload = await readJsonSafely(response);
      const detail = payload && (payload.message || payload.hint || payload.details);
      throw new Error(detail || `Não foi possível carregar as respostas (${response.status}).`);
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

function filteredResponses() {
  const period = periodFilter.value;
  if (period === "all") return allResponses.slice();

  const days = Number(period);
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return allResponses.filter((item) => {
    const time = new Date(item.created_at).getTime();
    return Number.isFinite(time) && time >= cutoff;
  });
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

function renderKpis(rows) {
  totalResponses.textContent = new Intl.NumberFormat("pt-BR").format(rows.length);
  responsePeriodLabel.textContent = responsePeriodText();

  const positive = rows.filter((row) => row.interest === "Com certeza" || row.interest === "Quero conhecer primeiro").length;
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
  topPriorityShare.textContent = leadingPriority ? `${leadingCount} respostas · ${percent(leadingCount, rows.length)}%` : "sem respostas no período";

  const durations = rows.map((row) => Number(row.duration_seconds)).filter((value) => Number.isFinite(value) && value > 0);
  const average = durations.length ? durations.reduce((sum, value) => sum + value, 0) / durations.length : null;
  averageDuration.textContent = average ? formatDuration(average) : "—";
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

      const row = document.createElement("div");
      row.className = "choice-row";

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

      row.append(label, value, progress);
      card.appendChild(row);
    });

    breakdownGrid.appendChild(card);
  });
}

function renderFeedback(rows) {
  feedbackList.replaceChildren();
  const term = feedbackSearch.value.trim().toLocaleLowerCase("pt-BR");
  const feedbackRows = rows.filter((row) => {
    const text = String(row.open_feedback || "").trim();
    if (!text) return false;
    return !term || text.toLocaleLowerCase("pt-BR").includes(term);
  });

  feedbackCount.textContent = `${feedbackRows.length} ${feedbackRows.length === 1 ? "comentário" : "comentários"}`;

  if (!feedbackRows.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = term ? "Nenhum comentário corresponde à busca." : "Nenhum comentário aberto neste período.";
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

    card.append(text, footer);
    feedbackList.appendChild(card);
  });

  if (feedbackRows.length > 100) {
    const more = document.createElement("div");
    more.className = "empty-state";
    more.textContent = `Exibindo os 100 comentários mais recentes de ${feedbackRows.length}. Use o CSV para ver todos.`;
    feedbackList.appendChild(more);
  }
}

function renderLatest(rows) {
  responsesTableBody.replaceChildren();
  const visibleRows = rows.slice(0, 100);
  latestCount.textContent = `${rows.length} ${rows.length === 1 ? "resposta" : "respostas"}`;

  if (!visibleRows.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 5;
    td.textContent = "Nenhuma resposta neste período.";
    tr.appendChild(td);
    responsesTableBody.appendChild(tr);
    return;
  }

  visibleRows.forEach((row) => {
    const tr = document.createElement("tr");
    const values = [
      formatDate(row.created_at),
      row.priority || "—",
      row.interest || "—",
      formatDuration(row.duration_seconds),
      row.open_feedback ? String(row.open_feedback).trim() : "—"
    ];

    values.forEach((value, index) => {
      const td = document.createElement("td");
      td.textContent = value;
      if (index === 4) td.className = "table-comment";
      tr.appendChild(td);
    });

    responsesTableBody.appendChild(tr);
  });
}

function renderDashboard() {
  const rows = filteredResponses();
  renderKpis(rows);
  renderBreakdowns(rows);
  renderFeedback(rows);
  renderLatest(rows);

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
    allResponses = await fetchResponses();
    renderDashboard();
    if (allResponses.length >= MAX_ROWS) {
      showPanelMessage(`O painel carregou as ${MAX_ROWS} respostas mais recentes. Exporte periodicamente se o volume crescer além desse limite.`);
    }
  } catch (error) {
    console.error("Plexo admin load error", error);
    const message = error && error.message ? error.message : "Não foi possível carregar o painel.";
    showPanelMessage(message, true);
    dashboardSubtitle.textContent = "Falha ao carregar as respostas.";
  } finally {
    setLoading(false);
  }
}

function csvEscape(value) {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function exportCsv() {
  const rows = filteredResponses();
  if (!rows.length) {
    showPanelMessage("Não há respostas no período selecionado para exportar.", true);
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
    safeSessionWrite(activeSession);

    if (!hasAdminClaim(activeSession.user)) {
      throw new Error("Esta conta ainda não recebeu a permissão de administrador da pesquisa.");
    }

    passwordInput.value = "";
    showDashboard();
    setLoading(false);
    await loadDashboardData();
  } catch (error) {
    activeSession = null;
    safeSessionClear();
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
periodFilter.addEventListener("change", renderDashboard);
feedbackSearch.addEventListener("input", renderDashboard);

(async function bootstrap() {
  if (!isConfigured()) {
    showAuthMessage("O painel ainda não está configurado com o Supabase.");
    loginBtn.disabled = true;
    return;
  }

  activeSession = safeSessionRead();
  if (!activeSession || !activeSession.accessToken || !activeSession.refreshToken) {
    activeSession = null;
    showLogin();
    return;
  }

  try {
    await ensureFreshSession();
    if (activeSession.user && !hasAdminClaim(activeSession.user)) {
      throw new Error("Conta sem permissão administrativa.");
    }
    showDashboard();
    await loadDashboardData();
  } catch (error) {
    console.warn("Plexo admin session restore failed", error);
    activeSession = null;
    safeSessionClear();
    showLogin();
  }
})();
