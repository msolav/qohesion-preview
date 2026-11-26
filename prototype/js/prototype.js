/* Qohesion ballot prototype: template switch, colour scheme with a contrast guard,
   language display, and a light submit flow. Voting itself works without this file. */
(function () {
  "use strict";
  var root = document.documentElement;
  var query = new URLSearchParams(location.search);
  var DEFAULTS = {
    "seed-packet": { brand: "#1F5C46", accent: "#C63A22" },
    "ballot-paper": { brand: "#1F5C46", accent: "#14151A" }
  };
  var WHITE = "#FFFFFF", INK = "#14151A";

  /* ---- contrast maths (WCAG 2.x relative luminance) ---- */
  function toRgb(h) { return [1, 3, 5].map(function (i) { return parseInt(h.slice(i, i + 2), 16); }); }
  function lin(c) { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function lum(h) { var c = toRgb(h).map(lin); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
  function ratio(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  function toHex(a) { return "#" + a.map(function (v) { return Math.round(v).toString(16).padStart(2, "0"); }).join("").toUpperCase(); }
  function darken(h, f) { return toHex(toRgb(h).map(function (v) { return v * (1 - f); })); }
  function bestOn(c) { return ratio(c, WHITE) >= ratio(c, INK) ? WHITE : INK; }

  /* The brand colour carries white text and is used as text on light surfaces, so it must reach 4.5:1 against white. */
  function guardBrand(h) {
    var out = h, adjusted = false;
    while (ratio(out, WHITE) < 4.5 && out !== "#000000") { out = darken(out, 0.06); adjusted = true; }
    return { color: out, on: WHITE, ratio: ratio(out, WHITE), adjusted: adjusted };
  }
  /* The button colour may take light or dark text, whichever reads best, and is darkened only if neither reaches 4.5:1. */
  function guardAccent(h) {
    var out = h, adjusted = false;
    while (ratio(out, bestOn(out)) < 4.5 && out !== "#000000") { out = darken(out, 0.06); adjusted = true; }
    var on = bestOn(out);
    return { color: out, on: on, ratio: ratio(out, on), adjusted: adjusted };
  }

  var el = {
    brand: document.getElementById("brand"), accent: document.getElementById("accent"),
    brandNote: document.getElementById("brand-check"), accentNote: document.getElementById("accent-check"),
    reset: document.getElementById("reset"), themes: document.querySelectorAll('input[name="theme"]')
  };

  function note(node, g) {
    node.textContent = "Contraste " + g.ratio.toFixed(1) + ":1, AA ✓" +
      (g.adjusted ? " · assombrie pour rester lisible / darkened to stay readable" : "");
    node.className = "check" + (g.adjusted ? " warn" : "");
  }
  function applyColours() {
    var b = guardBrand(el.brand.value.toUpperCase()), a = guardAccent(el.accent.value.toUpperCase());
    root.style.setProperty("--brand", b.color); root.style.setProperty("--on-brand", b.on);
    root.style.setProperty("--focus", b.color);
    root.style.setProperty("--accent", a.color); root.style.setProperty("--on-accent", a.on);
    note(el.brandNote, b); note(el.accentNote, a);
  }
  function setTheme(name, resetColours) {
    if (!DEFAULTS[name]) name = "seed-packet";
    root.setAttribute("data-theme", name);
    Array.prototype.forEach.call(el.themes, function (r) { r.checked = r.value === name; });
    if (resetColours) { el.brand.value = DEFAULTS[name].brand.toLowerCase(); el.accent.value = DEFAULTS[name].accent.toLowerCase(); }
    applyColours(); syncUrl();
  }
  function setLang(lang) {
    if (["fr", "en", "both"].indexOf(lang) < 0) lang = "both";
    root.setAttribute("data-lang", lang);
    root.setAttribute("lang", lang === "en" ? "en" : "fr");
    Array.prototype.forEach.call(document.querySelectorAll("[data-lang-link]"), function (a) {
      if (a.getAttribute("data-lang-link") === lang) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current");
    });
    syncUrl();
  }
  function syncUrl() {
    var u = new URL(location.href);
    u.searchParams.set("theme", root.getAttribute("data-theme"));
    u.searchParams.set("lang", root.getAttribute("data-lang"));
    history.replaceState(null, "", u.pathname + u.search + u.hash);
  }

  /* ---- initial state from the URL ---- */
  var startTheme = query.get("theme") || "seed-packet";
  el.brand.value = (query.get("brand") ? "#" + query.get("brand").replace("#", "") : DEFAULTS[startTheme] ? DEFAULTS[startTheme].brand : "#1F5C46").toLowerCase();
  el.accent.value = (query.get("accent") ? "#" + query.get("accent").replace("#", "") : DEFAULTS[startTheme] ? DEFAULTS[startTheme].accent : "#C63A22").toLowerCase();
  setTheme(startTheme, false);
  /* No language in the URL: follow the browser. French or English if preferred, both when it is neither. */
  function detectLang() {
    var list = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ""];
    for (var i = 0; i < list.length; i++) {
      var c = String(list[i]).toLowerCase();
      if (c.indexOf("fr") === 0) return "fr";
      if (c.indexOf("en") === 0) return "en";
    }
    return "both";
  }
  setLang(query.get("lang") || detectLang());

  /* ---- controls ---- */
  Array.prototype.forEach.call(el.themes, function (r) { r.addEventListener("change", function () { setTheme(r.value, true); }); });
  el.brand.addEventListener("input", applyColours);
  el.accent.addEventListener("input", applyColours);
  el.reset.addEventListener("click", function () { setTheme(root.getAttribute("data-theme"), true); });
  Array.prototype.forEach.call(document.querySelectorAll("[data-lang-link]"), function (a) {
    a.addEventListener("click", function (e) { e.preventDefault(); setLang(a.getAttribute("data-lang-link")); });
  });

  /* ---- ballot: friendly validation and a light submit ---- */
  var form = document.querySelector("form.ballot"), error = document.getElementById("choice-error");
  if (form) {
    form.addEventListener("invalid", function (e) {
      e.preventDefault(); error.hidden = false;
      var first = form.querySelector('input[name="q1"]'); if (first) first.focus();
    }, true);
    form.addEventListener("change", function () { error.hidden = true; });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      location.hash = "done";
      var done = document.getElementById("done"); if (done) { done.focus({ preventScroll: true }); window.scrollTo(0, 0); }
    });
  }
})();
