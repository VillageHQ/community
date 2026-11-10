const COPY_LABEL = "Copy the command";
const COPIED_LABEL = "Copied";
const COPY_FAILED_LABEL = "Select the command to copy it";
const COPIED_LABEL_RESET_MS = 2200;

function setUpMenu() {
  const toggle = document.querySelector(".menu-toggle");
  const menu = document.getElementById("mobile-nav");
  if (!toggle || !menu) return;
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

function setUpCopy() {
  const button = document.querySelector("[data-copy]");
  const command = document.querySelector("[data-command]");
  const label = document.querySelector("[data-copy-label]");
  const status = document.querySelector("[data-copy-status]");
  if (!button || !command || !navigator.clipboard) return;
  button.hidden = false;
  let resetTimer;

  button.addEventListener("click", async () => {
    clearTimeout(resetTimer);
    try {
      await navigator.clipboard.writeText(command.textContent.trim());
      label.textContent = COPIED_LABEL;
      status.textContent = "The command is copied.";
    } catch {
      label.textContent = COPY_FAILED_LABEL;
      status.textContent = COPY_FAILED_LABEL;
    }
    resetTimer = setTimeout(() => {
      label.textContent = COPY_LABEL;
      status.textContent = "";
    }, COPIED_LABEL_RESET_MS);
  });
}

// Printed pages show every answer, since nobody can click to open one on paper.
function setUpPrint() {
  window.addEventListener("beforeprint", () => {
    document.querySelectorAll(".faq details").forEach((details) => {
      details.open = true;
    });
  });
}

setUpMenu();
setUpCopy();
setUpPrint();
