const TOUR_STEPS = ["join", "feed", "network", "ask"];
const TOUR_STEP_LABELS = { join: "Join", feed: "Feed", network: "Find a way in", ask: "Ask" };
const SEARCH_DELAY_MS = 900;
const COPIED_LABEL_RESET_MS = 2200;
const COPY_LABEL = "Copy the command";
const COPIED_LABEL = "Copied";
const COPY_FAILED_LABEL = "Select the command to copy it";
const SEARCHING_MESSAGE = "Searching your network…";
const SEARCH_DONE_MESSAGE = "Found 3 people.";

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function setUpMenu() {
  const toggle = document.querySelector(".menu-toggle");
  const menu = document.getElementById("mobile-nav");
  toggle.hidden = false;

  function setMenuOpen(isOpen) {
    toggle.setAttribute("aria-expanded", String(isOpen));
    menu.hidden = !isOpen;
  }

  toggle.addEventListener("click", () => setMenuOpen(menu.hidden));
  menu.addEventListener("click", (event) => {
    if (event.target.closest("a")) setMenuOpen(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || menu.hidden) return;
    setMenuOpen(false);
    toggle.focus();
  });
}

function setUpTour() {
  const tour = document.querySelector("[data-tour]");
  const frame = tour.querySelector("[data-tour-frame]");
  const tabs = [...tour.querySelectorAll("[data-tour-tab]")];
  const panels = [...tour.querySelectorAll("[data-tour-panel]")];
  const navigationItems = [...tour.querySelectorAll("[data-nav]")];
  const previousButton = tour.querySelector("[data-tour-previous]");
  const nextButton = tour.querySelector("[data-tour-next]");
  const nextLabel = tour.querySelector("[data-tour-next-label]");
  let currentIndex = 0;

  function focusHeading(panel) {
    const heading = [...panel.querySelectorAll(".frame-title")].find((title) => !title.closest("[hidden]"));
    heading?.focus();
  }

  function showStep(index) {
    currentIndex = index;
    const step = TOUR_STEPS[index];
    frame.dataset.step = step;

    tabs.forEach((tab, tabIndex) => {
      const isSelected = tabIndex === index;
      tab.setAttribute("aria-selected", String(isSelected));
      tab.tabIndex = isSelected ? 0 : -1;
    });
    panels.forEach((panel) => {
      panel.hidden = panel.dataset.tourPanel !== step;
    });
    navigationItems.forEach((item) => {
      item.classList.toggle("is-current", item.dataset.nav === step);
    });

    previousButton.disabled = index === 0;
    const nextStep = TOUR_STEPS[index + 1];
    nextButton.hidden = !nextStep;
    if (nextStep) nextLabel.textContent = `Next: ${TOUR_STEP_LABELS[nextStep]}`;
  }

  function goToStep(index) {
    showStep(index);
    focusHeading(panels[index]);
  }

  function selectPerson(person) {
    tour.querySelectorAll("[data-person]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.person === person));
    });
    tour.querySelectorAll("[data-person-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.personPanel !== person;
    });
  }

  function revealSearchResults() {
    tour.querySelector("[data-search-results]").hidden = false;
    tour.querySelector("[data-search-status]").textContent = SEARCH_DONE_MESSAGE;
    tour.querySelector("[data-search]").disabled = false;
    selectPerson("clara");
  }

  function runSearch() {
    if (reducedMotion.matches) {
      revealSearchResults();
      return;
    }
    tour.querySelector("[data-search]").disabled = true;
    tour.querySelector("[data-search-status]").textContent = SEARCHING_MESSAGE;
    window.setTimeout(revealSearchResults, SEARCH_DELAY_MS);
  }

  function sendAsk() {
    tour.querySelector("[data-ask-draft]").hidden = true;
    tour.querySelector("[data-ask-sent]").hidden = false;
    tour.querySelector("[data-ask-sent-title]").focus();
  }

  function restart() {
    tour.querySelector("[data-ask-draft]").hidden = false;
    tour.querySelector("[data-ask-sent]").hidden = true;
    tour.querySelector("[data-search-results]").hidden = true;
    tour.querySelector("[data-search-status]").textContent = "";
    goToStep(0);
  }

  function toggleReaction(button) {
    const isPressed = button.getAttribute("aria-pressed") === "true";
    const baseCount = Number(button.dataset.count);
    button.setAttribute("aria-pressed", String(!isPressed));
    button.querySelector("[data-reaction-count]").textContent = String(isPressed ? baseCount : baseCount + 1);
  }

  function moveTabFocus(event) {
    const lastIndex = tabs.length - 1;
    const targets = {
      ArrowRight: currentIndex === lastIndex ? 0 : currentIndex + 1,
      ArrowLeft: currentIndex === 0 ? lastIndex : currentIndex - 1,
      Home: 0,
      End: lastIndex,
    };
    const target = targets[event.key];
    if (target === undefined) return;
    event.preventDefault();
    showStep(target);
    tabs[target].focus();
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => showStep(index));
    tab.addEventListener("keydown", moveTabFocus);
  });
  previousButton.addEventListener("click", () => goToStep(currentIndex - 1));
  nextButton.addEventListener("click", () => goToStep(currentIndex + 1));

  tour.querySelectorAll("[data-tour-go]").forEach((button) => {
    button.addEventListener("click", () => goToStep(TOUR_STEPS.indexOf(button.dataset.tourGo)));
  });
  tour.querySelectorAll("[data-person]").forEach((button) => {
    button.addEventListener("click", () => selectPerson(button.dataset.person));
  });
  tour.querySelectorAll("[data-reaction]").forEach((button) => {
    button.addEventListener("click", () => toggleReaction(button));
  });
  tour.querySelector("[data-search]").addEventListener("click", runSearch);
  tour.querySelector("[data-ask-send]").addEventListener("click", sendAsk);
  tour.querySelector("[data-tour-restart]").addEventListener("click", restart);

  showStep(0);
}

function setUpCopyButton() {
  const button = document.querySelector("[data-copy]");
  const label = button.querySelector("[data-copy-label]");
  const status = document.querySelector("[data-copy-status]");
  const command = document.querySelector("[data-command]").textContent;
  button.hidden = false;

  function announce(message) {
    label.textContent = message;
    status.textContent = message;
    window.setTimeout(() => {
      label.textContent = COPY_LABEL;
      status.textContent = "";
    }, COPIED_LABEL_RESET_MS);
  }

  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(command);
      announce(COPIED_LABEL);
    } catch {
      announce(COPY_FAILED_LABEL);
    }
  });
}

setUpMenu();
setUpTour();
setUpCopyButton();
