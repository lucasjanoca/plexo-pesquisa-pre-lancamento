"use strict";

(function () {
  const responseCards = document.getElementById("responseCards");
  const toolbar = document.querySelector(".toolbar");
  const detailOverlay = document.getElementById("detailOverlay");
  const periodFilter = document.getElementById("periodFilter");
  const interestFilter = document.getElementById("interestFilter");
  const sortFilter = document.getElementById("sortFilter");
  const responseSearch = document.getElementById("responseSearch");
  const panelMessage = document.getElementById("panelMessage");
  const detailFooter = document.querySelector(".detail-footer");

  let lastDetailTrigger = null;

  function getResponseById(id) {
    try {
      if (typeof allResponses !== "undefined" && Array.isArray(allResponses)) {
        return allResponses.find((row) => row && row.id === id) || null;
      }
    } catch {
      return null;
    }
    return null;
  }

  function makeExtraItem(label, value) {
    const item = document.createElement("div");
    item.className = "response-extra-item";

    const labelNode = document.createElement("span");
    labelNode.textContent = label;

    const valueNode = document.createElement("strong");
    valueNode.textContent = value || "—";

    item.append(labelNode, valueNode);
    return item;
  }

  function polishCards() {
    if (!responseCards) return;

    responseCards.querySelectorAll(".response-card").forEach((card) => {
      const button = card.querySelector("[data-response-id]");
      if (!button) return;

      const row = getResponseById(button.dataset.responseId);
      if (!row) return;

      const badge = card.querySelector(".response-badge");
      if (badge) {
        badge.classList.remove("maybe", "negative");
        if (row.interest === "Talvez") badge.classList.add("maybe");
        if (row.interest === "Provavelmente não") badge.classList.add("negative");
      }

      if (card.querySelector(".response-extra-summary")) return;

      const extra = document.createElement("div");
      extra.className = "response-extra-summary";
      extra.append(
        makeExtraItem("Onde procura", row.discovery),
        makeExtraItem("Profissional", row.services),
        makeExtraItem("Eventos", row.events)
      );

      const comment = card.querySelector(".response-comment-preview");
      const openButton = card.querySelector(".response-open-btn");
      if (comment) card.insertBefore(extra, comment);
      else if (openButton) card.insertBefore(extra, openButton);
      else card.appendChild(extra);
    });
  }

  function showQuickMessage(message) {
    if (!panelMessage) return;
    panelMessage.textContent = message;
    panelMessage.setAttribute("role", "status");
    panelMessage.classList.remove("hidden-display");
    window.setTimeout(() => {
      if (panelMessage.textContent === message) panelMessage.classList.add("hidden-display");
    }, 2600);
  }

  function addToolbarActions() {
    if (!toolbar || toolbar.querySelector(".toolbar-quick-actions")) return;

    const actions = document.createElement("div");
    actions.className = "toolbar-quick-actions";

    const clearButton = document.createElement("button");
    clearButton.type = "button";
    clearButton.className = "soft-btn toolbar-clear-btn";
    clearButton.textContent = "Limpar filtros";
    clearButton.addEventListener("click", () => {
      periodFilter.value = "all";
      interestFilter.value = "all";
      sortFilter.value = "newest";
      responseSearch.value = "";
      periodFilter.dispatchEvent(new Event("change", { bubbles: true }));
      showQuickMessage("Filtros limpos.");
    });

    const latestButton = document.createElement("button");
    latestButton.type = "button";
    latestButton.className = "soft-btn toolbar-latest-btn";
    latestButton.textContent = "Abrir mais recente";
    latestButton.addEventListener("click", () => {
      sortFilter.value = "newest";
      sortFilter.dispatchEvent(new Event("change", { bubbles: true }));
      window.requestAnimationFrame(() => {
        const first = responseCards && responseCards.querySelector(".response-open-btn");
        if (first) first.click();
        else showQuickMessage("Nenhuma resposta disponível neste filtro.");
      });
    });

    actions.append(clearButton, latestButton);
    toolbar.appendChild(actions);
  }

  function addDetailHint() {
    if (!detailFooter || detailFooter.querySelector(".detail-shortcut-hint")) return;
    const hint = document.createElement("span");
    hint.className = "detail-shortcut-hint";
    hint.textContent = "← → navegam · Esc fecha";
    detailFooter.appendChild(hint);
  }

  function focusableDetailElements() {
    if (!detailOverlay || detailOverlay.classList.contains("hidden-display")) return [];
    return Array.from(detailOverlay.querySelectorAll("button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])"))
      .filter((element) => element.offsetParent !== null);
  }

  document.addEventListener("click", (event) => {
    const trigger = event.target.closest && event.target.closest("[data-response-id]");
    if (trigger) lastDetailTrigger = trigger;
  }, true);

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Tab" || !detailOverlay || detailOverlay.classList.contains("hidden-display")) return;
    const focusable = focusableDetailElements();
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  if (responseCards) {
    new MutationObserver(polishCards).observe(responseCards, { childList: true, subtree: true });
  }

  if (detailOverlay) {
    let wasOpen = !detailOverlay.classList.contains("hidden-display");
    new MutationObserver(() => {
      const isOpen = !detailOverlay.classList.contains("hidden-display");
      if (wasOpen && !isOpen && lastDetailTrigger && document.contains(lastDetailTrigger)) {
        window.setTimeout(() => lastDetailTrigger.focus(), 0);
      }
      wasOpen = isOpen;
    }).observe(detailOverlay, { attributes: true, attributeFilter: ["class"] });
  }

  addToolbarActions();
  addDetailHint();
  polishCards();
})();
