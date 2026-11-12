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

// Founderhall's sign-up form: five fields checked in the browser, then posted as JSON to the form's data-endpoint.
// With no endpoint set (this folder has no server), nothing leaves the browser and the page says so.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAXIMUM_MEMBERS = 1000000;
const GROWTH_FROM_MEMBERS = 500;
const REPLY_LINE = "Village replies from a person within 1 business day.";
const NEXT_STEPS = {
  managed: [
    `${REPLY_LINE} You get a date for your 45-minute kickoff call.`,
    "Week 1, done with you: your domain and mail records, your portfolio's domains in and every profile filled in.",
    "Your first 20 to 50 founders get one email with one thing to do.",
  ],
  "self-host": [
    `${REPLY_LINE} You get the install guide.`,
    "One command and one database (Docker + Postgres) on your own server, and a sign-in link for your first admin.",
    "Village features (network search, intro paths, fresh profiles) use your own Village account; everything else runs without a key.",
  ],
};
const FIELDS = { name: "f-name", email: "f-email", community: "f-fund", members: "f-members" };

function setUpSignup() {
  const form = document.getElementById("signup-form");
  const confirmBox = document.getElementById("signup-confirm");
  const formError = document.getElementById("form-error");
  if (!form || !confirmBox || !formError) return;
  form.hidden = false;
  const input = (id) => document.getElementById(id);

  function readValues() {
    const plan = form.querySelector('input[name="plan"]:checked');
    return {
      name: input(FIELDS.name).value.trim(),
      email: input(FIELDS.email).value.trim(),
      community: input(FIELDS.community).value.trim(),
      members: input(FIELDS.members).value.trim(),
      plan: plan ? plan.value : "managed",
      website: input("f-website").value,
    };
  }

  function mark(id, isValid) {
    const field = input(id).closest(".field");
    field.classList.toggle("is-invalid", !isValid);
    input(id).setAttribute("aria-invalid", String(!isValid));
    if (isValid) input(id).removeAttribute("aria-describedby");
    else input(id).setAttribute("aria-describedby", `e-${id.slice(2)}`);
    return isValid;
  }

  function check(only) {
    const values = readValues();
    const members = Number(values.members);
    const rules = {
      [FIELDS.name]: values.name.length > 1,
      [FIELDS.email]: EMAIL_PATTERN.test(values.email),
      [FIELDS.community]: values.community.length > 1,
      [FIELDS.members]: /^\d+$/.test(values.members) && members >= 1 && members <= MAXIMUM_MEMBERS,
    };
    const checked = Object.keys(rules).filter((id) => !only || only === id);
    const isValid = checked.map((id) => mark(id, rules[id])).every(Boolean);
    return { isValid, values };
  }

  Object.values(FIELDS).forEach((id) => {
    input(id).addEventListener("input", () => {
      if (input(id).closest(".field").classList.contains("is-invalid")) check(id);
    });
  });

  const submitLabel = form.querySelector("[data-submit-label]");
  const planPrice = form.querySelector("[data-plan-price]");
  function syncPlan() {
    submitLabel.textContent = readValues().plan === "self-host" ? "Send me the install guide" : "Get Founderhall managed";
  }
  // Above 500 members the managed choice names the plan that fits: Managed Growth.
  function syncPrice() {
    planPrice.textContent =
      Number(input(FIELDS.members).value) > GROWTH_FROM_MEMBERS ? "From $2,500/mo (Managed Growth, up to 2,000 members)" : "From $1,000/mo";
  }
  form.querySelectorAll('input[name="plan"]').forEach((radio) => radio.addEventListener("change", syncPlan));
  input(FIELDS.members).addEventListener("input", syncPrice);
  document.querySelectorAll('[data-plan="growth"]').forEach((link) => {
    link.addEventListener("click", () => {
      form.querySelector('input[name="plan"][value="managed"]').checked = true;
      syncPlan();
      if (!input(FIELDS.members).value) input(FIELDS.members).value = "1000";
      syncPrice();
    });
  });

  function showError(message) {
    formError.textContent = message;
    formError.hidden = !message;
  }

  function showConfirm(title, bodyParts, steps) {
    confirmBox.querySelector("[data-confirm-title]").textContent = title;
    const body = confirmBox.querySelector("[data-confirm-body]");
    body.replaceChildren(...bodyParts);
    const list = confirmBox.querySelector("[data-confirm-steps]");
    list.replaceChildren(
      ...steps.map((step) => {
        const item = document.createElement("li");
        item.textContent = step;
        return item;
      }),
    );
    list.hidden = steps.length === 0;
    form.hidden = true;
    confirmBox.hidden = false;
    confirmBox.focus({ preventScroll: true });
    confirmBox.scrollIntoView({ block: "center" });
  }

  function bold(text) {
    const element = document.createElement("b");
    element.textContent = text;
    return element;
  }

  async function send(values) {
    const endpoint = form.dataset.endpoint;
    const first = values.name.split(/\s+/)[0];
    if (!endpoint) {
      showConfirm(`Thanks, ${first}. Nothing was sent.`, ["This copy of the page has no sign-up address yet, so your details stayed in your browser. Nobody will write to ", bold(values.email), "."], []);
      return;
    }
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(values) });
      const answer = await response.json().catch(() => ({}));
      if (response.status === 201 && answer.ok) {
        const steps = Array.isArray(answer.next) && answer.next.length > 0 ? answer.next : NEXT_STEPS[values.plan] || NEXT_STEPS.managed;
        showConfirm(`Thanks, ${first}. Request received for ${values.community}.`, [answer.emailSent ? "A confirmation is on its way to " : "We saved your request and will write to ", bold(values.email), ". What happens next:"], steps);
        return;
      }
      if (response.status === 400 && answer.errors) {
        Object.entries(answer.errors).forEach(([key, message]) => {
          if (!FIELDS[key]) return;
          mark(FIELDS[key], false);
          document.getElementById(`e-${FIELDS[key].slice(2)}`).textContent = message;
        });
        form.querySelector(".is-invalid input")?.focus();
        return;
      }
      showError(answer.error || "Something went wrong on our side. Please try again in a minute.");
    } catch {
      showError("We could not reach the server. Check your connection and try again.");
    } finally {
      button.disabled = false;
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    showError("");
    const { isValid, values } = check();
    if (!isValid) {
      form.querySelector(".is-invalid input")?.focus();
      return;
    }
    // The hidden field only a robot fills in: thank it and send nothing.
    if (values.website.trim()) {
      showConfirm("Request received.", [], []);
      return;
    }
    send(values);
  });

  document.getElementById("signup-again").addEventListener("click", () => {
    confirmBox.hidden = true;
    form.hidden = false;
    input(FIELDS.name).focus();
  });
}

setUpMenu();
setUpCopy();
setUpPrint();
setUpSignup();
