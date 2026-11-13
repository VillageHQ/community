// Runs in <head>, before the first paint: pre-animation states (CSS under html.motion) exist only when motion will
// run. Reduced motion never gets the class; if GSAP has not loaded after 4 s, the class goes again and the page
// shows every stroke drawn.
(function () {
  var root = document.documentElement;
  root.classList.add("js");
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  root.classList.add("motion");
  setTimeout(function () {
    if (!window.gsap || !window.ScrollTrigger) root.classList.remove("motion");
  }, 4000);
})();
