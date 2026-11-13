// Common Hall by Village: every behaviour on the landing page, with no library. The sign-up form, the copy button,
// the founders' labels and the sticky bar always work; the pen, the plan's drawing, the reveals and the founders'
// walks run on the small motion engine below and never run under reduced motion.
(function () {
  const html = document.documentElement;
  const reduceQuery = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  const motionOn = () => html.classList.contains("motion") && !(reduceQuery && reduceQuery.matches);

  /* ---------- the self-host door: copy the install line ---------- */
  const COPY_LABEL = "Copy";
  const COPIED_LABEL = "Copied";
  const COPIED_LABEL_RESET_MS = 2200;

  function copyText(text) {
    function fallback() {
      const buffer = document.createElement("textarea");
      buffer.value = text;
      buffer.className = "copy-buffer";
      buffer.setAttribute("readonly", "");
      document.body.appendChild(buffer);
      buffer.select();
      let copied = false;
      try {
        copied = document.execCommand("copy");
      } catch {
        copied = false;
      }
      buffer.remove();
      return copied ? Promise.resolve() : Promise.reject(new Error("copy failed"));
    }
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).catch(fallback);
    return fallback();
  }

  function setUpCopy() {
    const button = document.querySelector("[data-copy]");
    const command = document.querySelector("[data-command]");
    const status = document.querySelector("[data-copy-status]");
    if (!button || !command || !status) return;
    button.hidden = false;
    let resetTimer;
    button.addEventListener("click", async () => {
      clearTimeout(resetTimer);
      try {
        await copyText(command.dataset.full);
        button.textContent = COPIED_LABEL;
        status.textContent = "Install line copied. Paste it on your own server.";
      } catch {
        status.textContent = "Select the line to copy it.";
      }
      resetTimer = setTimeout(() => {
        button.textContent = COPY_LABEL;
        status.textContent = "";
      }, COPIED_LABEL_RESET_MS);
    });
  }

  /* ---------- the managed door: the sign-up form ---------- */
  // Five fields checked in the browser, then posted as JSON to the form's data-endpoint (201 { ok, emailSent, next }
  // or 400 { errors }). With no endpoint set (this folder has no server), nothing leaves the browser and the page
  // says so.
  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const MAXIMUM_MEMBERS = 1000000;
  const GROWTH_FROM_MEMBERS = 500;
  const QUOTE_FROM_MEMBERS = 2000;
  const REPLY_LINE = "Village replies from a person within 1 business day.";
  const NEXT_STEPS = [
    `${REPLY_LINE} You get a date for your 45-minute kickoff call.`,
    "Week 1, done with you: your domain and mail records, your portfolio's domains in and every profile filled in.",
    "Your first 20 to 50 founders get one email with one thing to do.",
  ];
  const FIELDS = { name: "f-name", email: "f-email", community: "f-fund", members: "f-members" };

  // The price line names the plan that fits: Managed up to 500 members, Managed Growth up to 2,000, and above that a
  // plan Village prices for the size.
  function readPlanPrice(members) {
    if (members > QUOTE_FROM_MEMBERS) return "above 2,000 members, Village quotes a plan with you";
    if (members > GROWTH_FROM_MEMBERS) return "$2,500 a month, billed yearly (Managed Growth, up to 2,000 members)";
    return "$1,000 a month, billed yearly";
  }

  function setUpSignup() {
    const form = document.getElementById("signup-form");
    const confirmBox = document.getElementById("signup-confirm");
    const formError = document.getElementById("form-error");
    if (!form || !confirmBox || !formError) return;
    form.hidden = false;
    const input = (id) => document.getElementById(id);

    function readValues() {
      const plan = form.querySelector('input[name="plan"]');
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

    const planPrice = document.querySelector("[data-plan-price]");
    input(FIELDS.members).addEventListener("input", () => {
      if (planPrice) planPrice.textContent = readPlanPrice(Number(input(FIELDS.members).value));
    });

    function showError(message) {
      formError.textContent = message;
      formError.hidden = !message;
    }

    function showConfirm(title, bodyParts, steps) {
      confirmBox.querySelector("[data-confirm-title]").textContent = title;
      const body = confirmBox.querySelector("[data-confirm-body]");
      body.replaceChildren(...bodyParts);
      body.hidden = bodyParts.length === 0;
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
      if (motionOn()) {
        const tick = confirmBox.querySelector(".confirm-title svg path");
        const length = tick.getTotalLength();
        const rise = (el, v) => { el.style.opacity = String(v); el.style.transform = `translateY(${8 * (1 - v)}px)`; };
        Array.from(confirmBox.children).forEach((el) => rise(el, 0));
        each(confirmBox.children, { stagger: 0.06, duration: 0.45, ease: EASE.power3Out, apply: rise });
        tick.style.strokeDasharray = String(length);
        tick.style.strokeDashoffset = String(length);
        tween({ delay: 0.1, duration: 0.5, ease: EASE.power2Out, apply: (v) => { tick.style.strokeDashoffset = String(length * (1 - v)); } });
      }
      refreshPen();
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
          const steps = Array.isArray(answer.next) && answer.next.length > 0 ? answer.next : NEXT_STEPS;
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
      refreshPen();
    });
  }

  /* ---------- founders on the plan: hover, focus or tap shows who they are ---------- */
  const tip = document.querySelector(".fm-tip");
  const planWrap = document.querySelector(".plan-wrap");
  let tipOwner = null;
  function placeTip() {
    if (!tipOwner) return;
    const box = planWrap.getBoundingClientRect();
    const dot = tipOwner.querySelector("circle").getBoundingClientRect();
    const width = tip.offsetWidth;
    const height = tip.offsetHeight;
    const centre = dot.left + dot.width / 2 - box.left;
    const x = Math.max(0, Math.min(box.width - width, centre - width / 2));
    let y = dot.top - box.top - height - 6;
    if (y < 0) y = dot.bottom - box.top + 6;
    tip.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  }
  function showTip(marker) {
    tipOwner = marker;
    tip.querySelector("b").textContent = marker.dataset.name;
    tip.querySelector("span").textContent = marker.dataset.line;
    tip.classList.add("on");
    placeTip();
  }
  function hideTip(marker) {
    if (marker && tipOwner !== marker) return;
    tipOwner = null;
    tip.classList.remove("on");
  }
  function setUpFounderLabels() {
    if (!tip || !planWrap) return;
    document.querySelectorAll(".plan .fm").forEach((marker) => {
      marker.addEventListener("pointerenter", (event) => { if (event.pointerType === "mouse") showTip(marker); });
      marker.addEventListener("pointerleave", (event) => { if (event.pointerType === "mouse") hideTip(marker); });
      marker.addEventListener("focus", () => showTip(marker));
      marker.addEventListener("blur", () => hideTip(marker));
      // A tap focuses the marker before its click, so the click toggles from the state before the tap.
      let openBeforeTap = false;
      marker.addEventListener("pointerdown", () => { openBeforeTap = tipOwner === marker; });
      marker.addEventListener("click", (event) => {
        event.stopPropagation();
        if (openBeforeTap && event.pointerType !== "mouse") hideTip(marker);
        else showTip(marker);
        openBeforeTap = false;
      });
      marker.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        if (tipOwner === marker) hideTip(marker);
        else showTip(marker);
      });
    });
    document.addEventListener("click", () => hideTip());
    document.addEventListener("keydown", (event) => { if (event.key === "Escape") hideTip(); });
  }

  /* ---------- sticky bar on phones: after the opening's buttons, never over the doors ---------- */
  function setUpBar() {
    const bar = document.getElementById("bar");
    if (!bar || !("IntersectionObserver" in window)) return;
    const link = bar.querySelector("a");
    let heroOut = false;
    let doorsIn = false;
    const update = () => {
      const on = heroOut && !doorsIn;
      bar.classList.toggle("on", on);
      bar.setAttribute("aria-hidden", on ? "false" : "true");
      link.tabIndex = on ? 0 : -1;
    };
    new IntersectionObserver((entries) => {
      heroOut = !entries[0].isIntersecting && entries[0].boundingClientRect.top < 0;
      update();
    }).observe(document.querySelector(".hero .acts"));
    new IntersectionObserver((entries) => {
      doorsIn = entries[0].isIntersecting;
      update();
    }, { rootMargin: "0px 0px -12% 0px" }).observe(document.getElementById("doors"));
  }

  setUpCopy();
  setUpSignup();
  setUpFounderLabels();
  setUpBar();


  /* =================================================================================================================
     THE MOTION ENGINE. A few lines instead of a library: every animation is a tween on one requestAnimationFrame
     loop. A tween has a delay, a duration, an easing and an apply(v) for v from 0 to 1; it can be paused, resumed and
     killed. Easing names: power2 = cubic, power3 = quartic, as the design's motion notes call them.
     ================================================================================================================= */
  const EASE = {
    linear: (t) => t,
    power1Out: (t) => 1 - (1 - t) ** 2,
    power2In: (t) => t ** 3,
    power2Out: (t) => 1 - (1 - t) ** 3,
    power2InOut: (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
    power3Out: (t) => 1 - (1 - t) ** 4,
    sineInOut: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  };
  const tweens = new Set();
  let tickerFrame = 0;
  let tickerLast = 0;
  function tickerStep(now) {
    const dt = tickerLast ? Math.min(0.1, (now - tickerLast) / 1000) : 0;
    tickerLast = now;
    let running = false;
    for (const t of Array.from(tweens)) {
      if (t.paused || !tweens.has(t)) continue;
      running = true;
      t.time += dt;
      if (t.time < t.delay) continue;
      const p = t.duration > 0 ? Math.min(1, (t.time - t.delay) / t.duration) : 1;
      if (t.apply) t.apply(t.ease(p));
      if (p >= 1) {
        tweens.delete(t);
        if (t.done) t.done();
      }
    }
    if (running && tweens.size) tickerFrame = requestAnimationFrame(tickerStep);
    else { tickerFrame = 0; tickerLast = 0; }
  }
  function wake() {
    if (!tickerFrame) { tickerLast = 0; tickerFrame = requestAnimationFrame(tickerStep); }
  }
  function tween({ delay = 0, duration = 0, ease = EASE.linear, apply = null, done = null }) {
    const t = {
      delay, duration, ease, apply, done, time: 0, paused: false,
      pause() { this.paused = true; },
      resume() { this.paused = false; wake(); },
      kill() { tweens.delete(this); },
      get active() { return tweens.has(this); },
    };
    tweens.add(t);
    wake();
    return t;
  }
  // the same tween on a list of elements, each starting `stagger` seconds after the one before
  function each(elements, { at = 0, stagger = 0, duration, ease, apply, done }) {
    return Array.from(elements).map((el, i) => tween({ delay: at + i * stagger, duration, ease, apply: (v) => apply(el, v), done: done && (() => done(el)) }));
  }
  const touched = new Set(); // every element the motion styled, so reduced motion can put it all back
  function style(el, props) {
    touched.add(el);
    Object.assign(el.style, props);
  }
  const strokeLengths = new WeakMap();
  function prepStroke(el) {
    const length = el.getTotalLength ? el.getTotalLength() : 0;
    strokeLengths.set(el, length);
    style(el, { strokeDasharray: `${length} ${length + 1}`, strokeDashoffset: String(length) });
  }
  const drawStroke = (el, v) => { el.style.strokeDashoffset = String(strokeLengths.get(el) * (1 - v)); };
  const fadeIn = (el, v) => { el.style.opacity = String(v); };

  /* =================================================================================================================
     THE PEN. One drawing runs down the page: every sheet frame, the room schedule's dimension line, each room's
     hatch, the ledger rules and the two entrance doors. Each stroke gets a "key" on one scroll axis. The pen's tip
     is scroll + 65% of the viewport; the scroll it follows is smoothed (it catches up in about half a second, like
     a scrub). A sheet's strokes are keyed so the whole sheet is drawn by the time the sheet rests (its top at the top
     of the screen): no resting frame is ever half drawn. Without motion every stroke is simply drawn.
     ================================================================================================================= */
  const NS = "http://www.w3.org/2000/svg";
  const penSvg = document.getElementById("pen");
  const sheets = Array.from(document.querySelectorAll(".sheet"));
  const TIP = 0.65; // where the tip rides in the viewport
  const LEAD = 70; // short strokes draw over 70 px of scroll
  const BAR_IN = 72; // phone frame bottom inset on sheets the sticky bar covers
  const SCRUB = 0.15; // the smoothing time constant, in seconds
  let items = []; // { el, svg, len, k0, k1 }
  let frameCount = 0; // the frame strokes come first; the nib rides the tip of the newest one
  let nib = null;

  const docTop = (el) => el.getBoundingClientRect().top + window.scrollY;

  function build() {
    penSvg.style.height = "0px";
    const H = window.innerHeight;
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - H);
    const inset = parseFloat(getComputedStyle(html).getPropertyValue("--inset")) || 8;
    const W = document.documentElement.clientWidth;
    penSvg.replaceChildren();
    items = [];
    // key map per sheet: its own y range is laid onto [k0, k1] of the tip's travel
    const maps = sheets.map((sheet, i) => {
      const T = docTop(sheet);
      const B = T + sheet.offsetHeight;
      const rest = i === 0 ? 0 : Math.min(T, maxScroll);
      const k0 = i === 0 ? 0 : T;
      const k1 = Math.max(rest + TIP * H, k0 + 120);
      return { T, B, k0, k1 };
    });
    function key(y) {
      for (let i = maps.length - 1; i >= 0; i--) {
        const m = maps[i];
        if (y < m.T) continue;
        if (y >= m.B) return i < maps.length - 1 ? Math.min(maps[i + 1].k0, m.k1 + (y - m.B)) : m.k1 + (y - m.B);
        return m.k0 + ((y - m.T) / (m.B - m.T)) * (m.k1 - m.k0);
      }
      return maps[0].k0 - (maps[0].T - y);
    }
    function add(el, k0, k1, isSvg) {
      const start = k1 - k0 < LEAD ? k1 - LEAD : k0;
      const len = isSvg && el.getTotalLength ? el.getTotalLength() : 0;
      items.push({ el, svg: isSvg, len, k0: start, k1 });
    }
    function path(d, k0, k1) {
      const p = document.createElementNS(NS, "path");
      p.setAttribute("d", d);
      penSvg.appendChild(p);
      add(p, k0, k1, true);
    }

    // 1. the frames: one line in, along the top, down both sides, back along the bottom, then on to the next sheet
    maps.forEach((m, i) => {
      const bottomInset = W < 900 && sheets[i].classList.contains("barred") ? BAR_IN : inset; // phones: above the bar
      const L = inset + 0.5;
      const R = W - inset - 0.5;
      const T = m.T + inset + 0.5;
      const B = m.B - bottomInset - 0.5;
      const kT = key(T);
      const kB = key(B);
      path(`M${L} ${T}H${R}`, kT - LEAD, kT); // top, left to right
      path(`M${R} ${T}V${B}`, kT, kB); // right side
      path(`M${L} ${T}V${B}`, kT, kB); // left side
      path(`M${R} ${B}H${L}`, kB - LEAD, kB); // bottom, right to left, closing the sheet
      const next = maps[i + 1];
      if (next) path(`M${L} ${B}V${next.T + inset + 0.5}`, kB - LEAD / 2, kB); // on to the next sheet
    });
    frameCount = items.length;
    nib = document.createElementNS(NS, "circle");
    nib.setAttribute("r", "3.4");
    nib.setAttribute("class", "nib");
    penSvg.appendChild(nib);
    if (!motionOn()) nib.style.display = "none";
    // 2. strokes inside the sheets (dimension line, hatch, door walls and swings) and the ledger / schedule rules
    document.querySelectorAll("main .pen").forEach((el) => {
      const r = el.getBoundingClientRect();
      add(el, key(r.top + window.scrollY), key(r.bottom + window.scrollY), true);
    });
    document.querySelectorAll("main .pen-r").forEach((el) => {
      const k = key(el.getBoundingClientRect().bottom + window.scrollY);
      add(el, k - LEAD, k, false);
    });
    penSvg.style.height = `${document.documentElement.scrollHeight}px`;
    html.classList.add("pen-on");
    // dashes only while the pen moves
    items.forEach((it) => {
      if (!it.svg) return;
      if (motionOn()) it.el.style.strokeDasharray = `${it.len} ${it.len + 2}`;
      else {
        it.el.style.strokeDasharray = "";
        it.el.style.strokeDashoffset = "";
      }
    });
  }

  function render(V) {
    let newest = -1;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const f = Math.min(1, Math.max(0, (V - it.k0) / (it.k1 - it.k0)));
      if (i < frameCount && f > 0) newest = i;
      if (it.svg) it.el.style.strokeDashoffset = (it.len * (1 - f)).toFixed(2);
      else it.el.style.setProperty("--p", f.toFixed(4));
    }
    if (!nib || !motionOn()) return;
    const stroke = newest < 0 ? null : items[newest];
    const f = stroke ? Math.min(1, Math.max(0, (V - stroke.k0) / (stroke.k1 - stroke.k0))) : 0;
    if (!stroke || f >= 1) {
      nib.style.opacity = "0"; // parked: the stroke is finished, so the tip is gone
      return;
    }
    const point = stroke.el.getPointAtLength(stroke.len * f);
    nib.setAttribute("cx", point.x.toFixed(1));
    nib.setAttribute("cy", point.y.toFixed(1));
    nib.style.opacity = "1";
  }

  // the tip: `load` pulls it down from above the page on the first visit; `followed` is the smoothed scroll
  const pen = { load: 1, followed: window.scrollY, target: window.scrollY, frame: 0, last: 0 };
  function tipV() {
    const H = window.innerHeight;
    return pen.followed + TIP * H - (1 - pen.load) * (TIP * H + 90);
  }
  const draw = () => render(motionOn() ? tipV() : 1e9);
  function followStep(now) {
    const dt = pen.last ? Math.min(0.1, (now - pen.last) / 1000) : 1 / 60;
    pen.last = now;
    const gap = pen.target - pen.followed;
    pen.followed = Math.abs(gap) < 0.5 ? pen.target : pen.followed + gap * (1 - Math.exp(-dt / SCRUB));
    draw();
    if (pen.followed !== pen.target) pen.frame = requestAnimationFrame(followStep);
    else { pen.frame = 0; pen.last = 0; }
  }
  function onScroll() {
    pen.target = Math.max(0, Math.min(window.scrollY, document.documentElement.scrollHeight - window.innerHeight));
    if (!motionOn()) return;
    if (!pen.frame) pen.frame = requestAnimationFrame(followStep);
  }
  let refreshFrame = 0;
  // re-measure after anything changes the page's height (resize, fonts, the form's confirmation)
  function refreshPen() {
    if (refreshFrame) return;
    refreshFrame = requestAnimationFrame(() => {
      refreshFrame = 0;
      build();
      onScroll();
      if (!motionOn()) pen.followed = pen.target;
      draw();
    });
  }

  build();
  draw();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", refreshPen);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(refreshPen);
  if (!motionOn()) {
    html.classList.remove("motion");
    return;
  }

  /* ----- sheet 1: the plan draws itself, labels type in, the stamp lands ----- */
  const walls = document.querySelectorAll(".plan .wall");
  const doors = document.querySelectorAll(".plan .door");
  const dims = document.querySelectorAll(".plan .dim-l");
  const dimTexts = document.querySelectorAll(".plan .dim-t");
  const table = document.querySelector(".plan .table");
  const chairs = document.querySelectorAll(".plan .chair");
  const labels = document.querySelectorAll(".plan .rl");
  const icons = document.querySelectorAll(".plan .ric path, .plan .ric circle, .plan .ric rect");
  const markers = document.querySelectorAll(".plan .fm");
  const facts = document.querySelectorAll(".facts li");
  const stamp = document.querySelector(".stamp");
  [...walls, ...dims, table, ...icons].forEach(prepStroke);
  [...doors, ...dimTexts, ...markers].forEach((el) => style(el, { opacity: "0" }));
  chairs.forEach((el) => style(el, { transform: "scale(0)" }));
  labels.forEach((t) => { t.textContent = ""; });
  style(stamp, { opacity: "0", transform: "rotate(-14deg) scale(1.6)" });
  facts.forEach((el) => style(el, { opacity: "0", transform: "translateY(6px)" }));
  document.querySelectorAll(".pre").forEach((el) => style(el, { visibility: "visible" }));

  const START = 0.2; // the opening's delay, as on the design
  pen.load = 0;
  draw();
  tween({ delay: START, duration: 2.2, ease: EASE.power2InOut, apply: (v) => { pen.load = v; draw(); } });
  each(walls, { at: START + 0.1, stagger: 0.05, duration: 1.5, ease: EASE.power2InOut, apply: drawStroke });
  each(doors, { at: START + 1.0, stagger: 0.02, duration: 0.4, ease: EASE.power2Out, apply: fadeIn });
  each(dims, { at: START + 1.05, stagger: 0.1, duration: 0.7, ease: EASE.power2Out, apply: drawStroke });
  each(dimTexts, { at: START + 1.45, stagger: 0.1, duration: 0.4, ease: EASE.power1Out, apply: fadeIn });
  each([table], { at: START + 1.25, duration: 0.6, ease: EASE.power2InOut, apply: drawStroke });
  each(chairs, { at: START + 1.5, stagger: 0.025, duration: 0.35, ease: EASE.power3Out, apply: (el, v) => { el.style.transform = `scale(${v})`; } });
  labels.forEach((t, i) => {
    const full = t.dataset.text;
    tween({ delay: START + 1.1 + i * 0.08, duration: Math.max(0.25, full.length * 0.045), apply: (v) => { t.textContent = full.slice(0, Math.round(v * full.length)); } });
  });
  each(icons, { at: START + 0.9, stagger: 0.02, duration: 0.9, ease: EASE.power2InOut, apply: drawStroke });
  each(markers, { at: START + 2.2, stagger: 0.08, duration: 0.5, ease: EASE.power2Out, apply: fadeIn });
  each(facts, { at: START + 2.0, stagger: 0.1, duration: 0.45, ease: EASE.power2Out, apply: (el, v) => { el.style.opacity = String(v); el.style.transform = `translateY(${(1 - v) * 6}px)`; } });
  tween({ delay: START + 2.5, duration: 0.5, ease: EASE.power3Out, apply: (v) => { stamp.style.opacity = String(v); stamp.style.transform = `rotate(${-14 + 8 * v}deg) scale(${1.6 - 0.6 * v})`; } });

  /* ----- sheets 2 to 4: one reveal each, when the section comes into view (once) ----- */
  // `edge` is how far from the bottom of the screen the element's top must come, so 12 means "top at 88% of the screen"
  // An IntersectionObserver plays it when it comes into view; a jump past it (an anchor link, a fast fling) is caught
  // on the next scroll, since the observer never sees an element it skipped.
  const pendingReveals = new Set();
  function reveal(elements, edge, onEnter) {
    const group = { elements: new Set(elements), edge, onEnter, io: null };
    const play = (targets) => {
      const fresh = targets.filter((el) => group.elements.delete(el));
      fresh.forEach((el) => group.io.unobserve(el));
      if (!group.elements.size) { group.io.disconnect(); pendingReveals.delete(group); }
      if (fresh.length) onEnter(fresh);
    };
    group.play = play;
    group.io = new IntersectionObserver((entries) => play(entries.filter((e) => e.isIntersecting).map((e) => e.target)), { rootMargin: `0px 0px -${edge}% 0px` });
    group.elements.forEach((el) => group.io.observe(el));
    pendingReveals.add(group);
  }
  function revealPassed() {
    const line = window.innerHeight * 0.12; // above this, the observer has had its chance: the element was skipped
    pendingReveals.forEach((group) => group.play(Array.from(group.elements).filter((el) => el.getBoundingClientRect().top < line)));
  }
  window.addEventListener("scroll", revealPassed, { passive: true });
  // rooms: each row lights its room on the key plan; its stamp lands
  document.querySelectorAll(".room .lit").forEach((el) => style(el, { opacity: "0" }));
  document.querySelectorAll(".rm-top .stp").forEach((el) => style(el, { opacity: "0", transform: "scale(1.4)" }));
  reveal(document.querySelectorAll(".room"), 12, (rows) => {
    each(rows.map((r) => r.querySelector(".lit")), { stagger: 0.06, duration: 0.5, ease: EASE.power2Out, apply: fadeIn });
    each(rows.map((r) => r.querySelector(".rm-top .stp")), { at: 0.1, stagger: 0.06, duration: 0.45, ease: EASE.power3Out, apply: (el, v) => { el.style.opacity = String(v); el.style.transform = `scale(${1.4 - 0.4 * v})`; } });
  });
  // record: rows rule in, the revision triangles place (the sample figures stay still, as on the design)
  const ledgerRows = document.querySelectorAll(".ledger .lg");
  const triangles = document.querySelectorAll(".ledger .tri");
  ledgerRows.forEach((el) => style(el, { opacity: "0", transform: "translateX(-12px)" }));
  triangles.forEach((el) => style(el, { opacity: "0", transform: "translateY(-7px) scale(0.7)" }));
  reveal([document.querySelector(".ledger")], 18, () => {
    each(ledgerRows, { stagger: 0.05, duration: 0.45, ease: EASE.power3Out, apply: (el, v) => { el.style.opacity = String(v); el.style.transform = `translateX(${-12 * (1 - v)}px)`; } });
    each(triangles, { at: 0.15, stagger: 0.08, duration: 0.4, ease: EASE.power3Out, apply: (el, v) => { el.style.opacity = String(v); el.style.transform = `translateY(${-7 * (1 - v)}px) scale(${0.7 + 0.3 * v})`; } });
  });
  // entrances: both door leaves swing open 25 degrees in plan view
  const leaves = document.querySelectorAll(".door-plan .leaf");
  const swingTo = (leaf, degrees) => {
    const r = (degrees * Math.PI) / 180;
    leaf.setAttribute("x2", (12 + 40 * Math.cos(r)).toFixed(2));
    leaf.setAttribute("y2", (40 - 40 * Math.sin(r)).toFixed(2));
  };
  leaves.forEach((leaf) => swingTo(leaf, 0));
  reveal([document.getElementById("doors")], 45, () => {
    each(leaves, { stagger: 0.15, duration: 0.9, ease: EASE.power2InOut, apply: (leaf, v) => swingTo(leaf, 25 * v) });
  });

  /* ----- sheet 1: founders walk between rooms (only while the plan is in view; never on reduced motion) ----- */
  const stopFounders = setUpWalks(START + 3.0);

  // Reduced motion switched on while the page is open: stop everything and show the finished drawing.
  if (reduceQuery) {
    reduceQuery.addEventListener("change", () => {
      if (!reduceQuery.matches) return;
      stopFounders();
      tweens.clear();
      html.classList.remove("motion");
      touched.forEach((el) => {
        ["opacity", "transform", "strokeDasharray", "strokeDashoffset", "visibility"].forEach((p) => { el.style[p] = ""; });
      });
      labels.forEach((t) => { t.textContent = t.dataset.text; });
      leaves.forEach((leaf) => swingTo(leaf, 25));
      markers.forEach((m) => m.setAttribute("transform", m.dataset.home));
      refreshPen();
    });
  }

  // The six founders: paths along the real corridors and through the door openings, walked with
  // SVGPathElement.getPointAtLength at about 40 px a second on screen (sine in-out per trip), at most two walking at
  // once, each resting 6 to 10 s. Every walk and timer pauses while the plan is off screen.
  function setUpWalks(startAt) {
    const planSvg = document.querySelector(".plan");
    const layer = planSvg.querySelector(".founders").parentNode;
    const HUB = [240, 142.5];
    // every place a founder can rest, with the walk from the hub (corridors, door openings) to it
    const PLACES = {
      asks: { spots: [[60, 66]], via: (s) => [HUB, [240, 102], [60, 102], s] },
      intros: { spots: [[140, 68], [180, 68]], via: (s) => [HUB, [240, 102], [160, 102], [160, 84], s] },
      network: { spots: [[270, 66]], via: (s) => [HUB, [259, 142.5], [268, 120], s] },
      members: { spots: [62, 88, 114, 140, 166, 192, 218].map((x) => [x, 178]), via: (s) => [HUB, [240, 189], [s[0], 189], s] },
      messages: { spots: [[330, 118]], via: (s) => [HUB, [259, 142.5], [268, 120], s] },
      feed: { spots: [[45, 226]], via: (s) => [HUB, [240, 189], [45, 189], s] },
      jobs: { spots: [[125, 226]], via: (s) => [HUB, [240, 189], [125, 189], s] },
      perks: { spots: [[205, 226]], via: (s) => [HUB, [240, 189], [205, 189], s] },
      chat: { spots: [[267, 226]], via: (s) => [HUB, [259, 142.5], [259, 184], [267, 192], s] },
      admin: { spots: [[322, 226]], via: (s) => [HUB, [259, 142.5], [259, 184], [322, 184], s] },
    };
    const HOME = [["asks", 0], ["intros", 1], ["members", 2], ["feed", 0], ["messages", 0], ["network", 0]];
    const people = Array.from(markers).map((el, i) => {
      el.dataset.home = el.getAttribute("transform");
      const route = document.createElementNS(NS, "path");
      route.setAttribute("class", "route");
      layer.insertBefore(route, layer.querySelector(".founders"));
      return { el, route, place: HOME[i][0], spot: HOME[i][1], moving: false, restUntil: 0 };
    });
    const taken = (place, spot) => people.some((p) => p.place === place && p.spot === spot);
    function put(person, point) {
      person.el.setAttribute("transform", `translate(${point.x.toFixed(2)} ${point.y.toFixed(2)})`);
      if (tipOwner === person.el) placeTip();
    }
    // drop points that sit on a straight line (or repeat) so a walk has no needless corners
    function simplify(points) {
      let again = true;
      while (again) {
        again = false;
        for (let i = 1; i < points.length - 1; i++) {
          const [a, b, c] = [points[i - 1], points[i], points[i + 1]];
          if ((a[0] === b[0] && b[0] === c[0]) || (a[1] === b[1] && b[1] === c[1]) || (a[0] === c[0] && a[1] === c[1]) || (a[0] === b[0] && a[1] === b[1])) {
            points.splice(i, 1);
            again = true;
            break;
          }
        }
      }
      return points;
    }
    const live = new Set();
    let alive = false;
    let started = false;
    let moving = 0;
    // every walk and timer goes through track(), so the pause rule reaches all of them
    function track(options) {
      const done = options.done;
      const t = tween({ ...options, done: () => { live.delete(t); if (done) done(); } });
      live.add(t);
      if (!alive) t.pause();
      return t;
    }
    const later = (seconds, fn) => track({ duration: seconds, done: fn });
    const pxPerUnit = () => planSvg.getBoundingClientRect().width / 384;

    function walk(person, place, spot) {
      const from = PLACES[person.place].via(PLACES[person.place].spots[person.spot]).slice().reverse();
      const to = PLACES[place].via(PLACES[place].spots[spot]);
      const points = simplify(from.concat(to.slice(1)));
      person.route.setAttribute("d", "M" + points.map((p) => `${p[0]} ${p[1]}`).join("L"));
      const total = person.route.getTotalLength();
      person.place = place;
      person.spot = spot;
      person.moving = true;
      moving++;
      const speed = 40 / pxPerUnit(); // about 40 px a second on screen
      track({
        duration: Math.max(1.2, total / speed),
        ease: EASE.sineInOut,
        apply: (v) => put(person, person.route.getPointAtLength(total * v)),
        done: () => {
          person.moving = false;
          moving--;
          person.restUntil = performance.now() + 6000 + Math.random() * 4000;
          arrive(person);
        },
      });
    }
    // what each visit means, shown once and small: a "?" in Asks, a line between two founders meeting in Intros
    function arrive(person) {
      if (person.place === "asks") {
        const mark = planSvg.querySelector(".fm-q");
        track({ duration: 0.3, ease: EASE.power2Out, apply: (v) => { mark.style.opacity = String(v); } });
        track({ delay: 0.9, duration: 0.45, ease: EASE.power2In, apply: (v) => { mark.style.opacity = String(1 - v); } });
      } else if (person.place === "intros" && taken("intros", 1 - person.spot)) {
        const line = planSvg.querySelector(".meet");
        const length = line.getTotalLength();
        line.style.strokeDasharray = String(length);
        line.style.strokeDashoffset = String(length);
        line.style.opacity = "1";
        track({ duration: 0.5, ease: EASE.power2Out, apply: (v) => { line.style.strokeDashoffset = String(length * (1 - v)); } });
        track({ delay: 2.1, duration: 0.5, ease: EASE.power2In, apply: (v) => { line.style.opacity = String(1 - v); } });
      }
    }
    // pick a room first, then one free spot in it, so the long table's seven chairs don't take every visit
    function pickDestination(person) {
      const byPlace = {};
      Object.keys(PLACES).filter((n) => n !== person.place).forEach((n) => {
        PLACES[n].spots.forEach((s, i) => { if (!taken(n, i)) (byPlace[n] = byPlace[n] || []).push([n, i]); });
      });
      const names = Object.keys(byPlace);
      if (!names.length) return null;
      const list = byPlace[names[Math.floor(Math.random() * names.length)]];
      return list[Math.floor(Math.random() * list.length)];
    }
    function tick() {
      if (moving < 2) {
        const now = performance.now();
        const idle = people.filter((p) => !p.moving && now >= p.restUntil);
        if (idle.length) {
          const person = idle[Math.floor(Math.random() * idle.length)];
          const destination = pickDestination(person);
          if (destination) walk(person, destination[0], destination[1]);
        }
      }
      later(1.6 + Math.random() * 1.6, tick);
    }
    function setAlive(on) {
      if (on === alive) return;
      alive = on;
      live.forEach((t) => (on ? t.resume() : t.pause()));
      if (on) people.forEach((p) => { if (!p.moving) p.restUntil = Math.max(p.restUntil, performance.now() + 1500); });
    }
    const io = new IntersectionObserver((entries) => {
      const visible = entries[entries.length - 1].isIntersecting;
      if (started) setAlive(visible);
      else alive = visible;
    });
    io.observe(planSvg);
    const starter = tween({
      delay: startAt,
      done: () => {
        started = true;
        const now = performance.now();
        people.forEach((p, i) => { p.restUntil = now + 5000 + i * 1200; });
        // the first two visits are fixed so the opening always shows them: Priya joins Marcus in Intros, then
        // Tomás leaves Feed for a chair at the long table
        walk(people[0], "intros", 0);
        later(2.2, () => { if (!people[3].moving) walk(people[3], "members", 3); });
        later(4.5, tick);
      },
    });
    return () => {
      starter.kill();
      io.disconnect();
      live.forEach((t) => t.kill());
      live.clear();
    };
  }
})();
