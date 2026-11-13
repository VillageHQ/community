// Common Hall by Village: every behaviour on the landing page. The sign-up form, the copy button, the founders'
// labels and the sticky bar work without GSAP; the pen, the plan's drawing and the founders' walks need GSAP 3.13 +
// ScrollTrigger (vendored in assets/vendor/) and never run under reduced motion.
(function () {
  const html = document.documentElement;
  const hasGsap = Boolean(window.gsap && window.ScrollTrigger);
  if (!hasGsap) html.classList.remove("motion");
  const motionOn = () => hasGsap && html.classList.contains("motion");

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
        window.gsap.fromTo(confirmBox.children, { y: 8, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: "power3.out", stagger: 0.06 });
        window.gsap.fromTo(tick, { strokeDasharray: length, strokeDashoffset: length }, { strokeDashoffset: 0, duration: 0.5, ease: "power2.out", delay: 0.1 });
      }
      if (hasGsap) window.ScrollTrigger.refresh();
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
      if (hasGsap) window.ScrollTrigger.refresh();
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
     THE PEN. One drawing runs down the page: every sheet frame, the room schedule's dimension line, each room's
     hatch, the ledger rules and the two entrance doors. Each stroke gets a "key" on one scroll axis. The pen's tip
     is scroll + 65% of the viewport, scrubbed. A sheet's strokes are keyed so the whole sheet is drawn by the time
     the sheet rests (its top at the top of the screen): no resting frame is ever half drawn. Without motion (reduced
     motion, no GSAP) every stroke is simply drawn.
     ================================================================================================================= */
  const NS = "http://www.w3.org/2000/svg";
  const penSvg = document.getElementById("pen");
  const sheets = Array.from(document.querySelectorAll(".sheet"));
  const TIP = 0.65; // where the tip rides in the viewport
  const LEAD = 70; // short strokes draw over 70 px of scroll
  const BAR_IN = 72; // phone frame bottom inset on sheets the sticky bar covers
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

  const drawAll = () => {
    build();
    render(1e9);
  };

  if (!hasGsap) {
    drawAll();
    window.addEventListener("resize", drawAll);
    return;
  }
  const { gsap, ScrollTrigger } = window;
  gsap.registerPlugin(ScrollTrigger);

  const mm = gsap.matchMedia();
  mm.add({ motion: "(prefers-reduced-motion: no-preference)", reduce: "(prefers-reduced-motion: reduce)" }, (context) => {
    if (context.conditions.reduce) {
      html.classList.remove("motion");
      drawAll();
      window.addEventListener("resize", drawAll);
      return () => window.removeEventListener("resize", drawAll);
    }
    html.classList.add("motion");

    /* ----- the pen's tip: load (draws sheet 1) + scroll (scrubbed) ----- */
    const state = { sy: 0, load: 0 };
    const tipV = () => {
      const H = window.innerHeight;
      return state.sy + TIP * H - (1 - state.load) * (TIP * H + 90);
    };
    const draw = () => render(tipV());
    build();
    draw();
    gsap.to(state, {
      sy: () => ScrollTrigger.maxScroll(window),
      ease: "none",
      onUpdate: draw,
      scrollTrigger: { id: "pen", start: 0, end: "max", scrub: 0.45, invalidateOnRefresh: true },
    });
    const onRefresh = () => {
      build();
      draw();
    };
    ScrollTrigger.addEventListener("refresh", onRefresh);

    /* ----- sheet 1: the plan draws itself, labels type in, the stamp lands ----- */
    function prep(targets) {
      gsap.utils.toArray(targets).forEach((p) => {
        const length = p.getTotalLength ? p.getTotalLength() : 0;
        gsap.set(p, { strokeDasharray: `${length} ${length + 1}`, strokeDashoffset: length });
      });
    }
    const walls = gsap.utils.toArray(".plan .wall");
    const doors = gsap.utils.toArray(".plan .door");
    const dims = gsap.utils.toArray(".plan .dim-l");
    const dimTexts = gsap.utils.toArray(".plan .dim-t");
    const table = document.querySelector(".plan .table");
    const chairs = gsap.utils.toArray(".plan .chair");
    const labels = gsap.utils.toArray(".plan .rl");
    const icons = gsap.utils.toArray(".plan .ric path, .plan .ric circle, .plan .ric rect");
    prep(walls);
    prep(dims);
    prep(table);
    prep(icons);
    gsap.set(".plan .fm", { opacity: 0 });
    gsap.set(doors, { opacity: 0 });
    gsap.set(chairs, { scale: 0, transformOrigin: "50% 50%" });
    gsap.set(dimTexts, { opacity: 0 });
    labels.forEach((t) => { t.textContent = ""; });
    gsap.set(".stamp", { opacity: 0, scale: 1.6, rotation: -14 });
    gsap.set(".facts li", { opacity: 0, y: 6 });
    gsap.set(".pre", { visibility: "visible" });

    const tl = gsap.timeline({ delay: 0.2 });
    tl.to(state, { load: 1, duration: 2.2, ease: "power2.inOut", onUpdate: draw }, 0)
      .to(walls, { strokeDashoffset: 0, duration: 1.5, ease: "power2.inOut", stagger: 0.05 }, 0.1)
      .to(doors, { opacity: 1, duration: 0.4, ease: "power2.out", stagger: 0.02 }, 1.0)
      .to(dims, { strokeDashoffset: 0, duration: 0.7, ease: "power2.out", stagger: 0.1 }, 1.05)
      .to(dimTexts, { opacity: 1, duration: 0.4, stagger: 0.1 }, 1.45)
      .to(table, { strokeDashoffset: 0, duration: 0.6, ease: "power2.inOut" }, 1.25)
      .to(chairs, { scale: 1, duration: 0.35, ease: "power3.out", stagger: 0.025 }, 1.5);
    labels.forEach((t, i) => {
      const full = t.dataset.text;
      const typed = { n: 0 };
      tl.to(typed, {
        n: full.length,
        duration: Math.max(0.25, full.length * 0.045),
        ease: "none",
        onUpdate: () => { t.textContent = full.slice(0, Math.round(typed.n)); },
        onComplete: () => { t.textContent = full; },
      }, 1.1 + i * 0.08);
    });
    tl.to(icons, { strokeDashoffset: 0, duration: 0.9, ease: "power2.inOut", stagger: 0.02 }, 0.9)
      .to(".plan .fm", { opacity: 1, duration: 0.5, ease: "power2.out", stagger: 0.08 }, 2.2)
      .to(".facts li", { opacity: 1, y: 0, duration: 0.45, ease: "power2.out", stagger: 0.1 }, 2.0)
      .to(".stamp", { opacity: 1, scale: 1, rotation: -6, duration: 0.5, ease: "power3.out" }, 2.5);

    /* ----- sheet 2: each room lights its room on the key plan; the stamp lands once ----- */
    gsap.set(".room .lit", { opacity: 0 });
    gsap.set(".rm-top .stp", { opacity: 0, scale: 1.4, transformOrigin: "50% 50%" });
    ScrollTrigger.batch(".room", {
      start: "top 88%",
      once: true,
      interval: 0.08,
      onEnter: (rows) => {
        gsap.to(rows.map((r) => r.querySelector(".lit")), { opacity: 1, duration: 0.5, ease: "power2.out", stagger: 0.06 });
        gsap.to(rows.map((r) => r.querySelector(".rm-top .stp")), { opacity: 1, scale: 1, duration: 0.45, ease: "power3.out", stagger: 0.06, delay: 0.1 });
      },
    });

    /* ----- sheet 3: rows rule in, the revision triangles place (the sample figures stay still) ----- */
    const rows = gsap.utils.toArray(".ledger .lg");
    const triangles = gsap.utils.toArray(".ledger .tri");
    gsap.set(rows, { opacity: 0, x: -12 });
    gsap.set(triangles, { opacity: 0, y: -7, scale: 0.7, transformOrigin: "50% 60%" });
    gsap.timeline({ scrollTrigger: { trigger: ".ledger", start: "top 82%", once: true } })
      .to(rows, { opacity: 1, x: 0, duration: 0.45, ease: "power3.out", stagger: 0.05 }, 0)
      .to(triangles, { opacity: 1, y: 0, scale: 1, duration: 0.4, ease: "power3.out", stagger: 0.08 }, 0.15);

    /* ----- sheet 4: both door leaves swing open 25 degrees in plan view ----- */
    const leaves = gsap.utils.toArray(".door-plan .leaf");
    gsap.set(leaves, { attr: { x2: 52, y2: 40 } });
    const doorsTimeline = gsap.timeline({ scrollTrigger: { trigger: "#doors", start: "top 55%", once: true } });
    leaves.forEach((leaf, i) => {
      const swing = { d: 0 };
      doorsTimeline.to(swing, {
        d: 25,
        duration: 0.9,
        ease: "power2.inOut",
        onUpdate: () => {
          const r = (swing.d * Math.PI) / 180;
          leaf.setAttribute("x2", (12 + 40 * Math.cos(r)).toFixed(2));
          leaf.setAttribute("y2", (40 - 40 * Math.sin(r)).toFixed(2));
        },
      }, i * 0.15);
    });

    /* ----- sheet 1: founders walk between rooms (only while the plan is in view; never on reduced motion) ----- */
    const stopFounders = setUpWalks(tl);

    return () => {
      stopFounders();
      ScrollTrigger.removeEventListener("refresh", onRefresh);
      labels.forEach((t) => { t.textContent = t.dataset.text; });
      leaves.forEach((leaf) => {
        leaf.setAttribute("x2", "48.25");
        leaf.setAttribute("y2", "23.1");
      });
    };
  });

  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());

  // The six founders: polylines along the real corridors and through the door openings, about 40 px a second on
  // screen, at most two walking at once, each resting 6 to 10 s. The loop runs only while the plan is in view.
  function setUpWalks(openingTimeline) {
    const planSvg = document.querySelector(".plan");
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
    const START = [["asks", 0], ["intros", 1], ["members", 2], ["feed", 0], ["messages", 0], ["network", 0]];
    const people = gsap.utils.toArray(".plan .fm").map((el, i) => ({ el, place: START[i][0], spot: START[i][1], moving: false, restUntil: 0 }));
    const taken = (place, spot) => people.some((p) => p.place === place && p.spot === spot);
    function put(person, point) {
      person.el.setAttribute("transform", `translate(${point[0].toFixed(2)} ${point[1].toFixed(2)})`);
      if (tipOwner === person.el) placeTip();
    }
    // drop points that sit on a straight line (or repeat) so a walk has no needless stops
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
    let live = [];
    let alive = false;
    let moving = 0;
    const track = (tween) => {
      live.push(tween);
      if (!alive) tween.pause();
      return tween;
    };
    const clean = () => { live = live.filter((t) => t.isActive() || t.paused() || t.progress() < 1); };
    const pxPerUnit = () => planSvg.getBoundingClientRect().width / 384;

    function walk(person, place, spot) {
      const from = PLACES[person.place].via(PLACES[person.place].spots[person.spot]).slice().reverse();
      const to = PLACES[place].via(PLACES[place].spots[spot]);
      const points = simplify(from.concat(to.slice(1)));
      const segments = [];
      let total = 0;
      for (let i = 1; i < points.length; i++) {
        const d = Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
        segments.push(d);
        total += d;
      }
      person.place = place;
      person.spot = spot;
      person.moving = true;
      moving++;
      const progress = { d: 0 };
      const speed = 40 / pxPerUnit(); // about 40 px a second on screen
      track(gsap.to(progress, {
        d: total,
        duration: Math.max(1.2, total / speed),
        ease: "sine.inOut",
        onUpdate: () => {
          let d = progress.d;
          let k = 0;
          while (k < segments.length - 1 && d > segments[k]) {
            d -= segments[k];
            k++;
          }
          const f = segments[k] ? Math.min(1, d / segments[k]) : 1;
          const a = points[k];
          const b = points[k + 1];
          put(person, [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
        },
        onComplete: () => {
          person.moving = false;
          moving--;
          person.restUntil = performance.now() + 6000 + Math.random() * 4000;
          arrive(person);
          clean();
        },
      }));
    }
    // what each visit means, shown once and small: a "?" in Asks, a line between two founders meeting in Intros
    function arrive(person) {
      if (person.place === "asks") {
        const mark = document.querySelector(".plan .fm-q");
        track(gsap.timeline().set(mark, { opacity: 0 }).to(mark, { opacity: 1, duration: 0.3, ease: "power2.out" }).to(mark, { opacity: 0, duration: 0.45, ease: "power2.in" }, "+=.6"));
      } else if (person.place === "intros" && taken("intros", 1 - person.spot)) {
        const line = document.querySelector(".plan .meet");
        const length = line.getTotalLength();
        track(gsap.timeline()
          .set(line, { opacity: 1, strokeDasharray: length, strokeDashoffset: length })
          .to(line, { strokeDashoffset: 0, duration: 0.5, ease: "power2.out" })
          .to(line, { opacity: 0, duration: 0.5, ease: "power2.in" }, "+=1.6"));
      }
    }
    function pickDestination(person) {
      const options = [];
      Object.keys(PLACES).filter((n) => n !== person.place).forEach((n) => {
        PLACES[n].spots.forEach((s, i) => { if (!taken(n, i)) options.push([n, i]); });
      });
      // keep the long table from taking every visit: pick a room first, then one free spot in it
      const byPlace = {};
      options.forEach((o) => { (byPlace[o[0]] = byPlace[o[0]] || []).push(o); });
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
      track(gsap.delayedCall(1.6 + Math.random() * 1.6, tick));
    }
    function startFounders() {
      const now = performance.now();
      people.forEach((p, i) => { p.restUntil = now + 5000 + i * 1200; });
      // the first two visits are fixed so the opening always shows them: Priya joins Marcus in Intros, then Tomás
      // leaves Feed for a chair at the long table
      walk(people[0], "intros", 0);
      track(gsap.delayedCall(2.2, () => { if (!people[3].moving) walk(people[3], "members", 3); }));
      track(gsap.delayedCall(4.5, tick));
    }
    function setAlive(on) {
      if (on === alive) return;
      alive = on;
      live.forEach((t) => (on ? t.resume() : t.pause()));
    }
    let toggle = null;
    openingTimeline.call(() => {
      alive = ScrollTrigger.isInViewport(planSvg, 0.1);
      startFounders();
      toggle = ScrollTrigger.create({ trigger: planSvg, start: "top bottom", end: "bottom top", onToggle: (self) => setAlive(self.isActive) });
    }, null, 3.0);
    return () => {
      live.forEach((t) => t.kill());
      live = [];
      if (toggle) toggle.kill();
    };
  }
})();
