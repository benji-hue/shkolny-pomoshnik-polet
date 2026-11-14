/* deck.js — навигация и хореография: базовое движение одно — камера летит вперёд
   сквозь облачную завесу; особые переходы — там, где меняется история. */
(function () {
  "use strict";
  var W = window.World || { ok: false }, G = window.gsap;
  var stage = document.getElementById("stage");
  var slides = Array.prototype.slice.call(stage.querySelectorAll(".slide"));
  var N = slides.length, cur = -1, tl = null, busy = false, enterTl = null, kb = null;
  var land = document.getElementById("land"), mist = document.getElementById("mist");
  var hudFill = document.querySelector(".hud-fill"), hudPlane = document.querySelector(".hud-plane");
  var hudCur = document.getElementById("hudCur"), hud = document.getElementById("hud");
  document.getElementById("hudAll").textContent = String(N).padStart(2, "0");
  var hasWorld = !!(W.ok && W.build);
  if (/[?&]shot/.test(location.search)) { // покадровая проверка: пауза и перемотка общей шкалы времени
    G.ticker.lagSmoothing(0);
    window.__shot = { t0: 0, pause: function () { G.globalTimeline.pause(); this.t0 = G.globalTimeline.time(); },
      at: function (t) { G.globalTimeline.time(this.t0 + t); return G.globalTimeline.time(); } };
  }
  if (!hasWorld) document.documentElement.classList.add("no-webgl");

  /* ---------- масштаб сцены ---------- */
  var view = {};
  function layout() {
    var w = window.innerWidth, h = window.innerHeight, s = Math.min(w / 1920, h / 1080);
    view = { W: w, H: h, s: s, ox: (w - 1920 * s) / 2, oy: (h - 1080 * s) / 2 };
    stage.style.transform = "translate(" + view.ox + "px," + view.oy + "px) scale(" + s + ")";
    hud.style.left = view.ox + 120 * s + "px"; hud.style.bottom = view.oy + 46 * s + "px";
    hud.style.transform = "scale(" + Math.max(0.6, s) + ")";
    if (hasWorld) W.setView(view);
  }
  window.addEventListener("resize", layout); layout();

  /* ---------- параметры слайда ---------- */
  function tod(i) { return parseFloat(slides[i].dataset.tod || "0"); }
  function isLand(i) { return slides[i] && slides[i].dataset.scene === "land"; }
  function camZ(i) { return -i * (W.SPACING || 60); }
  function camY(i) { return isLand(i) ? -26 : (slides[i].classList.contains("s-final") || slides[i].classList.contains("s-src") ? 5 : 0); }

  /* ---------- позы самолётика ---------- */
  var POSES = {
    goal:    { x: 1640, y: 214, d: 10, s: 0.82 },
    corner:  { x: 1748, y: 150, d: 12, s: 0.5 },
    arch:    { x: 905, y: 452, d: 11, s: 0.46 },
    route:   { x: 1262, y: 300, d: 11, s: 0.5 },
    day:     { x: 1350, y: 150, d: 11, s: 0.55 },
    teacher: { x: 1352, y: 150, d: 11, s: 0.55 },
    study:   { x: 1360, y: 140, d: 11, s: 0.55 },
    cover:   { x: 1585, y: 330, d: 11, s: 1.08 }
  };
  var PATHS = {
    arch:    [{ x: 960, y: 420, d: 30, s: 0.5 }, { x: 245, y: 560, d: 11, s: 0.46 }, { x: 905, y: 570, d: 11, s: 0.46 }, { x: 1575, y: 400, d: 11, s: 0.46 }, { x: 1290, y: 470, d: 11, s: 0.46 }, { x: 905, y: 452, d: 11, s: 0.46 }],
    route:   [{ x: 960, y: 420, d: 30, s: 0.5 }, { x: 160, y: 470, d: 11, s: 0.5 }, { x: 530, y: 320, d: 11, s: 0.5 }, { x: 890, y: 470, d: 11, s: 0.5 }, { x: 1262, y: 300, d: 11, s: 0.5 }],
    teacher: [{ x: 960, y: 420, d: 30, s: 0.5 }, { x: 760, y: 560, d: 11, s: 0.5 }, { x: 1180, y: 420, d: 11, s: 0.55 }, { x: 1352, y: 150, d: 11, s: 0.55 }],
    final:   [{ x: 960, y: 420, d: 30, s: 0.5 }, { x: 1000, y: 700, d: 12, s: 0.8 }, { x: 1420, y: 430, d: 11, s: 0.9 }, { x: 1780, y: 120, d: 16, s: 0.8 }, { x: 2100, y: -260, d: 28, s: 0.6 }]
  };
  function planeEnter(t, i, at) {
    if (!hasWorld) return;
    var key = slides[i].dataset.plane, P = W.plane;
    if (!key || key === "hide") { t.to(P, { show: 0, duration: 0.4 }, at); return; }
    t.add(function () { W.setLayer("front"); P.face = 0; P.fold = 1; P.trail = 1; }, at);
    if (PATHS[key]) {
      var f = W.path(PATHS[key]), o = { t: 0 };
      t.set(P, { show: 1, idle: 0 }, at);
      t.to(o, { t: 1, duration: key === "final" ? 3.6 : 2.6, ease: "sine.inOut", onUpdate: function () { f(o.t); } }, at);
      if (key === "final") t.to(P, { show: 0, duration: 0.6 }, at + 3.0);
      else t.to(P, { idle: 1, duration: 0.8 }, ">-0.3");
    } else {
      var p = POSES[key] || POSES.corner;
      t.set(P, { x: 960, y: 420, d: 32, s: p.s, idle: 0 }, at);
      t.to(P, { show: 1, duration: 0.3 }, at);
      t.to(P, { x: p.x, y: p.y, d: p.d, s: p.s, duration: 1.6, ease: "power3.out" }, at);
      t.to(P, { idle: 1, duration: 0.8 }, at + 1.2);
    }
  }
  function planeLeave(t, at) {
    if (!hasWorld || W.plane.show < 0.05) return;
    t.to(W.plane, { x: 980, y: 400, d: 38, idle: 0, duration: 1.1, ease: "power2.in" }, at);
  }

  /* ---------- появление содержимого ---------- */
  function fmt(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " "); }
  function reveal(el) {
    var t = G.timeline(), items = el.querySelectorAll("[data-r]"), k = 0;
    items.forEach(function (it) {
      var kind = it.dataset.r, at = 0.08 + k * 0.085;
      if (kind === "mask" || kind === "title") {
        var lines = it.querySelectorAll(".tw > span");
        t.fromTo(lines, { yPercent: 112 }, { yPercent: 0, duration: kind === "title" ? 1.3 : 1.0, ease: "power4.out", stagger: kind === "title" ? 0.14 : 0.09 }, at);
        G.set(it, { opacity: 1 });
      } else if (kind === "pop") {
        t.fromTo(it, { opacity: 0, scale: 0.92 }, { opacity: 1, scale: 1, duration: 0.75, ease: "back.out(1.5)" }, at + 0.15);
      } else if (kind === "img") {
        t.fromTo(it, { opacity: 0, y: 46 }, { opacity: 1, y: 0, duration: 1.1, ease: "power3.out" }, at + 0.1);
      } else if (kind === "sheet") {
        t.fromTo(it, { opacity: 0, y: -90, rotation: "+=10" }, { opacity: 1, y: 0, rotation: "-=10", duration: 1.1, ease: "power3.out" }, at + 0.1);
      } else {
        t.fromTo(it, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.85, ease: "power3.out" }, at);
      }
      k++;
    });
    el.querySelectorAll("svg.arch-lines, svg.route-line").forEach(function (svg) {
      t.fromTo(svg, { clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)", duration: 1.6, ease: "power2.inOut" }, 0.5);
    });
    el.querySelectorAll("[data-count]").forEach(function (c) {
      var o = { v: 0 }, to = parseFloat(c.dataset.count), pre = c.dataset.prefix || "", suf = c.dataset.suffix || "";
      t.to(o, { v: to, duration: 1.8, ease: "power2.out", onUpdate: function () { c.textContent = pre + fmt(o.v) + suf; } }, 0.35);
    });
    return t;
  }
  function resetSlide(el) {
    el.querySelectorAll(".sheet").forEach(function (s) { G.set(s, { clearProps: "all" }); });
    el.querySelectorAll(".kicker, .h, .p-out").forEach(function (s) { G.set(s, { clearProps: "transform" }); });
    G.set(el.querySelectorAll("[data-r]"), { opacity: 0 });
    G.set(el.querySelectorAll(".tw > span"), { yPercent: 112 });
  }

  /* ---------- HUD, тон, заметки ---------- */
  function hudTo(i) {
    var f = N > 1 ? i / (N - 1) : 0;
    G.to(hudFill, { width: f * 300, duration: 1.2, ease: "power2.inOut" });
    G.to(hudPlane, { x: f * 300, duration: 1.2, ease: "power2.inOut" });
    hudCur.textContent = String(i + 1).padStart(2, "0");
    document.body.classList.toggle("tone-dark", slides[i].dataset.tone === "dark");
    document.body.classList.toggle("tone-light", slides[i].dataset.tone !== "dark");
    var n = slides[i].querySelector(".notes");
    document.getElementById("notesText").textContent = n ? n.textContent.trim() : "";
    if (history.replaceState) history.replaceState(null, "", "#" + (i + 1));
  }

  /* ---------- фоны «внутри облака» и «над посёлком» ---------- */
  function scenery(t, i, at, dur) {
    var inCloud = slides[i].dataset.enter === "cloud";
    t.to(mist, { opacity: inCloud ? 0.62 : 0, duration: dur, ease: "sine.inOut" }, at);
    if (isLand(i)) {
      t.to(land, { opacity: 1, duration: dur * 0.6, ease: "sine.inOut" }, at + dur * 0.35);
      t.add(function () {
        if (kb) kb.kill();
        kb = G.fromTo(land.querySelector("img"), { scale: 1.02 }, { scale: 1.12, duration: 26, ease: "none" });
      }, at + dur * 0.35);
    } else {
      t.to(land, { opacity: 0, duration: dur * 0.5, ease: "sine.inOut" }, at + dur * 0.2);
    }
  }

  /* ---------- складывание: листки → самолётик ---------- */
  function foldOut(t, el) {
    var sheets = el.querySelectorAll(".sheet"), P = W.plane;
    t.to(el.querySelectorAll(".kicker, .h, .p-out"), { opacity: 0, y: -20, duration: 0.5, ease: "power2.in" }, 0);
    sheets.forEach(function (s, j) {
      var r = s.getBoundingClientRect(), cx = (r.left + r.width / 2 - view.ox) / view.s, cy = (r.top + r.height / 2 - view.oy) / view.s;
      t.to(s, { x: "+=" + (960 - cx), y: "+=" + (520 - cy), rotation: 0, scale: 0.55, duration: 0.85, ease: "power3.inOut" }, 0.05 + j * 0.06);
    });
    if (!hasWorld) { t.to(sheets, { opacity: 0, duration: 0.3 }, 1.0); return 1.2; }
    t.add(function () {
      W.setLayer("front");
      var s = (330 * 0.55) / (1.24 * W.pxPerUnit(8));
      G.set(P, { x: 960, y: 520, d: 8, s: s, fold: 0, face: 1, idle: 0, trail: 0, show: 1 });
    }, 1.02);
    t.to(sheets, { opacity: 0, duration: 0.18 }, 1.02);
    t.to(P, { fold: 1, duration: 1.0, ease: "power2.inOut" }, 1.15);
    t.to(P, { face: 0, duration: 0.6, ease: "power2.inOut" }, 1.85);
    t.to(P, { x: 1120, y: 380, d: 36, s: 0.8, trail: 1, duration: 1.2, ease: "power2.in" }, 2.2);
    return 2.3;
  }

  /* ---------- переход ---------- */
  function go(n, instant) {
    n = Math.max(0, Math.min(N - 1, n));
    if (n === cur) return;
    if (tl) tl.progress(1);
    if (enterTl) enterTl.progress(1);
    document.body.classList.add("used");
    var from = cur, dir = n > from ? 1 : -1, el = slides[n];
    cur = n; hudTo(n); resetSlide(el);
    if (instant || from < 0) {
      slides.forEach(function (s, j) { G.set(s, { visibility: j === n ? "visible" : "hidden", opacity: j === n ? 1 : 0, scale: 1 }); });
      if (hasWorld) G.set(W.state, { z: camZ(n), y: camY(n), tod: tod(n) });
      G.set(mist, { opacity: el.dataset.enter === "cloud" ? 0.62 : 0 });
      G.set(land, { opacity: isLand(n) ? 1 : 0 });
      enterTl = reveal(el); var t0 = G.timeline(); planeEnter(t0, n, 0.2);
      return;
    }
    var old = slides[from];
    busy = true;
    tl = G.timeline({ onComplete: function () { busy = false; G.set(old, { visibility: "hidden" }); } });
    var start = 0;
    if (dir > 0 && old.dataset.leave === "fold") start = foldOut(tl, old);
    else planeLeave(tl, 0);
    var landToLand = isLand(from) && isLand(n);
    tl.to(old, { scale: dir > 0 ? 1.18 : 0.86, opacity: 0, duration: 0.85, ease: "power2.in" }, start);
    if (hasWorld) {
      var fc = W.frontClouds.material.uniforms.uOpacity;
      tl.set(fc, { value: landToLand ? 0 : 1 }, start);
      tl.to(W.state, { z: camZ(n), y: camY(n), tod: tod(n), duration: 2.0, ease: "power2.inOut" }, start + 0.05);
    }
    scenery(tl, n, start + 0.25, 1.4);
    if (landToLand) tl.to(land.querySelector("img"), { scale: "+=0.04", duration: 2, ease: "power2.inOut" }, start);
    tl.set(el, { visibility: "visible" }, start + 1.05);
    tl.fromTo(el, { opacity: 0, scale: dir > 0 ? 0.86 : 1.16 }, { opacity: 1, scale: 1, duration: 1.0, ease: "power2.out" }, start + 1.1);
    tl.add(function () { enterTl = reveal(el); }, start + 1.15);
    planeEnter(tl, n, start + 1.25);
  }

  /* ---------- открытие: влёт сквозь облака ---------- */
  function opening() {
    var el = slides[0], P = W.plane;
    cur = 0; hudTo(0);
    G.set(slides, { visibility: "hidden", opacity: 0 });
    G.set(el, { visibility: "visible", opacity: 1 });
    G.set(el.querySelectorAll("[data-r]"), { opacity: 0 });
    G.set(el.querySelectorAll(".tw > span"), { yPercent: 112 });
    var t = G.timeline();
    if (hasWorld) {
      G.set(W.state, { z: 64, y: 0, tod: 0 });
      t.to(W.state, { z: 0, duration: 3.4, ease: "power2.out" }, 0);
      var f = W.path([{ x: -260, y: 1000, d: 15, s: 0.95 }, { x: 330, y: 790, d: 12, s: 1 }, { x: 860, y: 560, d: 11, s: 1.04 }, { x: 1300, y: 420, d: 10.6, s: 1.08 }, POSES.cover]), o = { t: 0 };
      t.add(function () { W.setLayer("back"); G.set(P, { show: 1, idle: 0, trail: 1, fold: 1, face: 0 }); }, 1.6);
      t.to(o, { t: 1, duration: 3.4, ease: "sine.inOut", onUpdate: function () { f(o.t); if (o.t > 0.62 && P.layer === "back") W.setLayer("front"); } }, 1.6);
      t.to(P, { idle: 1, duration: 0.8 }, 4.7);
    }
    t.add(function () { enterTl = reveal(el); }, 1.9);
  }

  /* ---------- управление ---------- */
  function next() { go(cur + 1); }
  function prev() { go(cur - 1); }
  document.addEventListener("keydown", function (e) {
    var k = e.key;
    if (k === "ArrowRight" || k === "PageDown" || k === " " || k === "Enter") { e.preventDefault(); next(); }
    else if (k === "ArrowLeft" || k === "PageUp" || k === "Backspace") { e.preventDefault(); prev(); }
    else if (k === "Home") go(0); else if (k === "End") go(N - 1);
    else if (k === "f" || k === "F" || k === "а" || k === "А") {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
      else document.exitFullscreen && document.exitFullscreen();
    } else if (k === "n" || k === "N" || k === "т" || k === "Т") {
      var nb = document.getElementById("notes"); nb.hidden = !nb.hidden;
    }
  });
  document.addEventListener("click", function (e) {
    if (e.target.closest("a, .qr, #notes")) return;
    if (e.clientX < window.innerWidth * 0.18) prev(); else next();
  });
  var tx = null;
  document.addEventListener("touchstart", function (e) { tx = e.touches[0].clientX; }, { passive: true });
  document.addEventListener("touchend", function (e) {
    if (tx == null) return; var dx = e.changedTouches[0].clientX - tx; tx = null;
    if (Math.abs(dx) > 50) { if (dx < 0) next(); else prev(); }
  });

  /* ---------- старт ---------- */
  function boot() {
    if (hasWorld) { W.build(N); W.start(); }
    var h = parseInt((location.hash || "").slice(1), 10);
    if (h > 1 && h <= N) go(h - 1, true); else opening();
  }
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(boot);
  window.Deck = { go: go, next: next, prev: prev, get cur() { return cur; }, N: N };
})();
