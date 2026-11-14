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

  /* ---------- самолётик = сообщение бота ----------
     Сложить лист — отправить, раскрыть — прочитать. Ярлык рядом говорит, что и кому
     летит. Где самолётик ничего не доставляет, его нет. */
  var P = W.plane || {};
  var POSES = {
    goal:  { x: 1640, y: 178, d: 10, s: 0.82 },
    cover: { x: 1585, y: 330, d: 11, s: 1.08 }
  };
  var TAG = { on: 0 }, mt = document.getElementById("mailtag"), ping = document.getElementById("ping");
  function stagePos(el, fx, fy) { // координаты на сцене 1920×1080 без учёта анимаций появления
    var x = 0, y = 0, e = el;
    while (e && e !== stage) { x += e.offsetLeft; y += e.offsetTop; e = e.offsetParent; }
    return { x: x + el.offsetWidth * (fx == null ? 0.5 : fx), y: y + el.offsetHeight * (fy == null ? 0.5 : fy) };
  }
  function pt(el, fx, fy, d, s) { var p = stagePos(el, fx, fy); return { x: p.x, y: p.y, d: d || 11, s: s == null ? 0.5 : s }; }
  function tag(t, at, text) {
    if (text) t.add(function () { mt.textContent = text; }, at);
    t.to(TAG, { on: text ? 1 : 0, duration: 0.3, ease: "power1.out" }, at);
  }
  function fly(t, at, pts, dur, ease) {
    var f = W.path(pts), o = { t: 0 };
    t.to(o, { t: 1, duration: dur, ease: ease || "sine.inOut", onUpdate: function () { f(o.t); } }, at);
    return at + dur;
  }
  function arrive(t, at, from) { // самолётик выходит из облачной глубины
    t.add(function () { W.setLayer("front"); }, at);
    t.set(P, { face: 0, fold: 1, trail: 1, idle: 0 }, at);
    if (from) t.set(P, from, at);
    t.to(P, { show: 1, duration: 0.35 }, at);
    return at;
  }
  function refold(t, at, x, y, s) { // у отправителя лист складывается в самолётик
    t.add(function () { W.setLayer("front"); }, at);
    t.set(P, { x: x, y: y, d: 10, s: s || 0.5, fold: 0, face: 1, idle: 0, trail: 0, show: 0 }, at);
    t.to(P, { show: 1, duration: 0.2 }, at);
    t.to(P, { fold: 1, duration: 0.6, ease: "power2.inOut" }, at + 0.1);
    t.to(P, { face: 0, duration: 0.4, ease: "power2.inOut" }, at + 0.5);
    t.set(P, { trail: 1 }, at + 0.9);
    return at + 0.9;
  }
  function pingAt(x, y) {
    G.set(ping, { left: x, top: y });
    G.fromTo(ping, { scale: 0.4, opacity: 0.95 }, { scale: 1.9, opacity: 0, duration: 1.0, ease: "power2.out" });
  }
  function touchdown(t, at, x, y, open) { // у получателя самолётик раскрывается в лист — сообщение прочитано
    tag(t, at - 0.15, null);
    t.to(P, { fold: 0, face: 1, trail: 0, idle: 0, duration: 0.55, ease: "power2.inOut" }, at);
    t.to(P, { show: 0, s: function () { return P.s * 0.6; }, duration: 0.32, ease: "power2.in" }, at + 0.5);
    t.add(function () { pingAt(x, y); }, at + 0.55);
    if (open) open(t, at + 0.5);
    return at + 0.85;
  }
  function lightPhone(fig) { return function (t, at) { t.to(fig.querySelector("img"), { filter: "brightness(1) saturate(1)", duration: 0.6, ease: "power2.out" }, at); }; }
  function showMsg(fig) { return function (t, at) { t.fromTo(fig.querySelector(".msg"), { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" }, at); }; }
  function screen(fig) { return pt(fig, 0.5, 0.45); }

  /* ---------- сквозной телефон главы: переезжает между слайдами, экран меняется ---------- */
  var phA = document.getElementById("phoneA"), phB = document.getElementById("phoneB"), loupe = document.getElementById("loupe");
  var DIM = "brightness(0.07) saturate(0.4)";
  function poseOf(el, key) { var v = el.dataset[key]; if (!v) return null; var a = v.split(",").map(Number); return { x: a[0], y: a[1], w: a[2], r: a[3] }; }
  function srcOf(el, cls) { var im = el.querySelector("img." + cls); return im ? im.src : null; }
  function screenOf(pose) { return { x: pose.x + pose.w / 2, y: pose.y + (pose.w * 2.164 + 22) * 0.45, d: 11, s: 0.55 }; }
  function phoneTo(t, at, fig, pose, src, dim, dur) {
    var s1 = fig.querySelector(".scr"), s2 = fig.querySelector(".scr2");
    if (!pose) { t.to(fig, { opacity: 0, y: 40, duration: 0.45, ease: "power2.in" }, at); return; }
    var shown = parseFloat(G.getProperty(fig, "opacity")) > 0.05;
    if (!shown) { // появляется на месте
      t.set(s1, { attr: { src: src }, filter: dim ? DIM : "none" }, at);
      t.set(s2, { opacity: 0 }, at);
      t.set(fig, { left: pose.x, top: pose.y, width: pose.w, rotation: pose.r, x: 0, y: 70, opacity: 0 }, at);
      t.to(fig, { opacity: 1, y: 0, duration: 0.9, ease: "power3.out" }, at + 0.05);
      return;
    }
    t.to(fig, { left: pose.x, top: pose.y, width: pose.w, rotation: pose.r, x: 0, y: 0, opacity: 1, duration: dur, ease: "power3.inOut" }, at);
    if (s1.getAttribute("src") === src) { t.to(s1, { filter: dim ? DIM : "none", duration: 0.5 }, at); return; }
    var mid = at + dur * 0.35;
    t.set(s2, { attr: { src: src }, opacity: 0, filter: dim ? DIM : "none" }, at);
    t.to(s2, { opacity: 1, duration: 0.5, ease: "power1.inOut" }, mid);
    t.set(s1, { attr: { src: src }, filter: dim ? DIM : "none" }, mid + 0.55);
    t.set(s2, { opacity: 0 }, mid + 0.56);
  }
  function setPhone(fig, pose, src, dim) {
    if (!pose) { G.set(fig, { opacity: 0 }); return; }
    var s1 = fig.querySelector(".scr"); s1.src = src;
    G.set(s1, { filter: dim ? DIM : "none" }); G.set(fig.querySelector(".scr2"), { opacity: 0 });
    G.set(fig, { left: pose.x, top: pose.y, width: pose.w, rotation: pose.r, x: 0, y: 0, opacity: 1 });
  }
  function phonesFor(t, at, el, dur) {
    phoneTo(t, at, phA, poseOf(el, "pose"), srcOf(el, "phone-src"), el.dataset.mail === "dim", dur);
    phoneTo(t, at + 0.08, phB, poseOf(el, "pose2"), srcOf(el, "phone-src2"), false, dur);
  }
  function lightPP() { return function (t, at) { t.to(phA.querySelectorAll("img"), { filter: "brightness(1) saturate(1)", duration: 0.6, ease: "power2.out" }, at); }; }
  function then(a, b) { return function (t, at) { a(t, at); b(t, at); }; }

  /* видоискатель на нужной строке скриншота и лупа с этой строкой крупно */
  function natural(img) {
    if (img && img.naturalWidth) return [img.naturalWidth, img.naturalHeight];
    return /bot-(study|books|admissions)/.test(img && img.getAttribute("src") || "") ? [588, 1280] : [780, 1688];
  }
  function focusShot(el, fig, img, figW) {
    return function (t, at) {
      var f = el.dataset.focus, L = el.dataset.loupe; if (!f || !L || !img) return;
      var r = f.split(",").map(Number), l = L.split(",").map(Number);
      var vf = fig.querySelector(".vf");
      if (!vf) { vf = document.createElement("span"); vf.className = "vf"; vf.innerHTML = "<i></i><i></i><i></i><i></i>"; fig.appendChild(vf); }
      var nn = natural(img), nw = nn[0], nh = nn[1], iw = (figW || fig.offsetWidth) - 22, ih = iw * nh / nw;
      var k = l[2] / ((r[2] - r[0]) * nw);
      t.set(vf, { left: 11 + r[0] * iw, top: 11 + r[1] * ih, width: (r[2] - r[0]) * iw, height: (r[3] - r[1]) * ih }, at);
      t.set(loupe, { left: l[0], top: l[1], width: l[2], height: (r[3] - r[1]) * nh * k,
        backgroundImage: "url(" + img.src + ")", backgroundSize: (nw * k) + "px auto", backgroundPosition: (-r[0] * nw * k) + "px " + (-r[1] * nh * k) + "px" }, at);
      t.fromTo(vf, { opacity: 0, scale: 1.3 }, { opacity: 1, scale: 1, duration: 0.45, ease: "power3.out", immediateRender: false }, at + 0.02);
      t.fromTo(loupe, { opacity: 0, scale: 0.55 }, { opacity: 1, scale: 1, duration: 0.6, ease: "back.out(1.5)", immediateRender: false }, at + 0.35);
    };
  }
  function hideFocus(t, at) { t.to([loupe].concat(Array.prototype.slice.call(document.querySelectorAll(".vf"))), { opacity: 0, duration: 0.3 }, at); }

  /* карта маршрута на титулах глав: самолётик долетает до текущей главы */
  var CHAPTERS = ["Идея", "Как работает", "Учебный день", "Моя родина", "Проверка"];
  var SVGNS = "http://www.w3.org/2000/svg";
  function svgEl(name, attrs, parent) { var e = document.createElementNS(SVGNS, name); for (var k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
  function buildRoute(box) {
    var cur = +box.dataset.chi, W0 = box.offsetWidth || 1680, svg = svgEl("svg", { viewBox: "0 0 " + W0 + " 120" }, box);
    var d = "M 30 78 Q " + (W0 / 2) + " -14 " + (W0 - 30) + " 78";
    svgEl("path", { d: d, "class": "rm-line" }, svg);
    var done = svgEl("path", { d: d, "class": "rm-done" }, svg);
    var len = done.getTotalLength(), fr = [0.03, 0.27, 0.5, 0.73, 0.97];
    CHAPTERS.forEach(function (name, i) {
      var p = done.getPointAtLength(len * fr[i]);
      svgEl("circle", { cx: p.x, cy: p.y, r: i === cur ? 11 : 8, "class": "rm-dot" + (i < cur ? " is-done" : i === cur ? " is-cur" : "") }, svg);
      var tx = svgEl("text", { x: p.x, y: p.y + 44, "text-anchor": i === 0 ? "start" : i === 4 ? "end" : "middle", "class": "rm-label" + (i === cur ? " is-cur" : "") }, svg);
      tx.textContent = name;
    });
    var pl = svgEl("g", { "class": "rm-plane" }, svg);
    svgEl("path", { d: "M -16 -9 L 18 0 L -16 9 L -9 0 Z" }, pl);
    box._route = { done: done, len: len, from: fr[Math.max(0, cur - 1)], to: fr[cur], plane: pl };
  }
  function routeAnim(t, at, box) {
    var R = box._route; if (!R) return;
    var o = { f: R.from };
    function draw() {
      R.done.setAttribute("stroke-dasharray", R.len); R.done.setAttribute("stroke-dashoffset", R.len * (1 - o.f));
      var p = R.done.getPointAtLength(R.len * o.f), q = R.done.getPointAtLength(Math.min(R.len, R.len * o.f + 2));
      R.plane.setAttribute("transform", "translate(" + p.x + "," + (p.y - 1) + ") rotate(" + (Math.atan2(q.y - p.y, q.x - p.x) * 180 / Math.PI) + ")");
    }
    t.add(function () { o.f = R.from; draw(); }, 0);
    t.to(o, { f: R.to, duration: 1.8, ease: "power2.inOut", onUpdate: draw }, at);
  }
  slides.forEach(function (el) { var b = el.querySelector(".route-map"); if (b) buildRoute(b); });

  var MAIL = {
    cover: function (t, at) {
      var p = POSES.cover;
      arrive(t, at, { x: 960, y: 420, d: 32, s: p.s });
      t.to(P, { x: p.x, y: p.y, d: p.d, s: p.s, duration: 1.6, ease: "power3.out" }, at);
      t.to(P, { idle: 1, duration: 0.8 }, at + 1.2);
    },
    goal: function (t, at) { // правило показа: вот так выглядит сообщение
      var p = POSES.goal;
      arrive(t, at, { x: 960, y: 420, d: 32, s: p.s });
      t.to(P, { x: p.x, y: p.y, d: p.d, s: p.s, duration: 1.6, ease: "power3.out" }, at);
      t.to(P, { idle: 1, duration: 0.8 }, at + 1.2);
      tag(t, at + 1.5, "так выглядит сообщение бота");
    },
    arch: function (t, at, el) { // вопрос из Telegram в облако к модели, ответ обратно
      var tg = el.querySelector(".n-tg"), cf = el.querySelector(".n-cf"), m1 = el.querySelector(".n-m1");
      var a = pt(tg, 0.5, 0.45), b = pt(cf, 0.5, 0.5), c = pt(m1, 0.12, 0.5);
      var e = refold(t, at + 1.0, a.x, a.y, 0.5);
      tag(t, e, "вопрос → модели");
      e = fly(t, e, [a, { x: (a.x + b.x) / 2, y: a.y - 70, d: 11, s: 0.5 }, b, c], 2.2);
      tag(t, e + 0.05, null); tag(t, e + 0.4, "ответ → ученику");
      e = fly(t, e + 0.4, [c, { x: (b.x + c.x) / 2, y: b.y + 60, d: 11, s: 0.5 }, b, { x: (a.x + b.x) / 2, y: a.y + 70, d: 11, s: 0.5 }, a], 2.2);
      touchdown(t, e, a.x, a.y);
    },
    route: function (t, at, el) { // заявка → администратору, «одобрено» → ученику
      var n = el.querySelectorAll(".wp .num"), ph = el.querySelector(".phone"), st = el.querySelector(".stamp");
      var w1 = pt(n[0]), w2 = pt(n[1]), w3 = pt(n[2]), w4 = pt(n[3]), ps = screen(ph);
      var e = refold(t, at + 1.0, w1.x, w1.y, 0.5);
      tag(t, e, "заявка → администратору");
      e = fly(t, e, [w1, w2, w3, w4], 2.4);
      e = touchdown(t, e, w4.x, w4.y, function (tt, a2) {
        tt.fromTo(st, { opacity: 0, scale: 1.7, rotation: -16 }, { opacity: 1, scale: 1, rotation: -8, duration: 0.45, ease: "back.out(2)" }, a2 + 0.1);
      });
      e = refold(t, e + 0.35, w4.x, w4.y, 0.5);
      tag(t, e, "одобрено → ученику");
      e = fly(t, e, [w4, { x: (w4.x + ps.x) / 2, y: Math.min(w4.y, ps.y) - 110, d: 11, s: 0.5 }, ps], 1.4);
      touchdown(t, e, ps.x, ps.y, then(showMsg(ph), function (tt, a2) { focusShot(el, ph, ph.querySelector('.msg'))(tt, a2 + 0.7); }));
    },
    day: function (t, at, el) { // в 07:30 расписание прилетает на телефон
      var pose = poseOf(el, "pose"), clk = el.querySelector(".clock-t"), ps = screenOf(pose), o = { m: 0 };
      var a = at + 0.6;
      arrive(t, a, { x: 960, y: 420, d: 30, s: 0.55 });
      tag(t, a + 0.5, "расписание → ученику");
      var e = fly(t, a, [{ x: 960, y: 420, d: 30, s: 0.55 }, { x: 780, y: 330, d: 12, s: 0.55 }, { x: 1160, y: 210, d: 11, s: 0.55 }, ps], 2.6);
      t.fromTo(o, { m: 0 }, { m: 30, duration: 2.6, ease: "none", onUpdate: function () { clk.textContent = "07:" + String(Math.round(o.m)).padStart(2, "0"); } }, a);
      touchdown(t, e, ps.x, ps.y, then(lightPP(), function (tt, a2) { focusShot(el, phA, el.querySelector('img.phone-src'), pose.w)(tt, a2 + 0.75); }));
    },
    teacher: function (t, at, el) { // учитель отправил отметку — она у ученика
      var fl = el.querySelectorAll(".flow")[1], pose = poseOf(el, "pose");
      var s0 = pt(fl, 0.06, 0.5), ps = screenOf(pose);
      var e = refold(t, at + 1.0, s0.x, s0.y, 0.5);
      tag(t, e, "отметка → ученику");
      e = fly(t, e, [s0, { x: (s0.x + ps.x) / 2, y: Math.min(s0.y, ps.y) - 150, d: 11, s: 0.55 }, ps], 1.6);
      touchdown(t, e, ps.x, ps.y, then(lightPP(), function (tt, a2) { focusShot(el, phA, el.querySelector('img.phone-src'), pose.w)(tt, a2 + 0.75); }));
    },
    study: function (t, at, el) { // вопрос улетает в облако, бот ищет по учебникам, ответ возвращается
      var chip = el.querySelector(".chips li"), pose = poseOf(el, "pose"), big = el.querySelector("[data-mail-count]");
      var s0 = pt(chip), ps = screenOf(pose), o = { v: 0 };
      var e = refold(t, at + 1.0, s0.x, s0.y, 0.5);
      tag(t, e, "вопрос → в облако");
      e = fly(t, e, [s0, { x: 860, y: 300, d: 14, s: 0.5 }, { x: 960, y: 150, d: 34, s: 0.5 }], 1.3, "power1.in");
      tag(t, e - 0.45, null);
      t.to(P, { show: 0, duration: 0.3 }, e - 0.3);
      t.fromTo(o, { v: 0 }, { v: 25622, duration: 1.6, ease: "power2.out", onUpdate: function () { big.textContent = fmt(o.v); } }, e - 0.3);
      var back = e + 1.1;
      t.to(P, { show: 1, duration: 0.3 }, back);
      tag(t, back + 0.5, "ответ + страница учебника → ученику");
      e = fly(t, back, [{ x: 1160, y: 130, d: 34, s: 0.55 }, { x: 1290, y: 210, d: 12, s: 0.55 }, ps], 1.7, "power1.out");
      touchdown(t, e, ps.x, ps.y, then(lightPP(), function (tt, a2) { focusShot(el, phA, el.querySelector('img.phone-src'), pose.w)(tt, a2 + 0.75); }));
    },
    next: function (t, at) { // следующий маршрут проекта
      var a = at + 0.8;
      arrive(t, a, { x: 1720, y: 430, d: 11, s: 0.6 });
      tag(t, a + 0.4, "проект → другие школы");
      fly(t, a, [{ x: 1720, y: 430, d: 11, s: 0.6 }, { x: 1520, y: 340, d: 14, s: 0.6 }, { x: 1260, y: 300, d: 26, s: 0.6 }, { x: 1110, y: 290, d: 50, s: 0.6 }], 6.0, "sine.in");
      tag(t, a + 4.6, null);
      t.to(P, { show: 0, duration: 0.8 }, a + 5.2);
    },
    hero: function (t, at) { // огромный самолётик пролетает перед заголовком главы
      arrive(t, at + 0.2, { x: -420, y: 560, d: 9, s: 2.5 });
      fly(t, at + 0.2, [{ x: -420, y: 560, d: 9, s: 2.5 }, { x: 480, y: 380, d: 9, s: 2.5 }, { x: 1250, y: 300, d: 9, s: 2.4 }, { x: 2450, y: 170, d: 10, s: 2.2 }], 7.0, "sine.inOut");
      t.to(P, { show: 0, duration: 0.2 }, at + 7.1);
    },
    letter: function (t, at, el) { // письмо из истории посёлка раскрывается в лист с фото памятника
      var lt = el.querySelector(".letter"), q = pt(lt, 0.5, 0.48);
      arrive(t, at + 0.9, { x: 960, y: 300, d: 30, s: 0.6 });
      tag(t, at + 1.3, "история Мухавца → ученику");
      var e = fly(t, at + 0.9, [{ x: 960, y: 300, d: 30, s: 0.6 }, { x: 1180, y: 420, d: 13, s: 0.85 }, { x: q.x, y: q.y, d: 8, s: 1.35 }], 2.2);
      touchdown(t, e, q.x, q.y, function (tt, a2) { tt.fromTo(lt, { opacity: 0, scale: 0.28, rotation: -18 }, { opacity: 1, scale: 1, rotation: -6, duration: 0.9, ease: "power3.out" }, a2); });
    },
    digits: function (t, at, el) { // самолётик пролетает сквозь контурные цифры «15»
      var a = pt(el.querySelector(".d1"), 0.35, 0.62), b = pt(el.querySelector(".d2"), 0.7, 0.42);
      t.add(function () { W.setLayer("back"); }, at + 0.8);
      t.set(P, { face: 0, fold: 1, trail: 1, idle: 0, x: a.x - 560, y: a.y + 230, d: 12, s: 1.25 }, at + 0.8);
      t.to(P, { show: 1, duration: 0.3 }, at + 0.8);
      var e = fly(t, at + 0.8, [{ x: a.x - 560, y: a.y + 230, d: 12, s: 1.25 }, { x: a.x, y: a.y, d: 11, s: 1.25 }, { x: b.x, y: b.y, d: 11, s: 1.2 }, { x: b.x + 520, y: b.y - 260, d: 14, s: 1.1 }], 3.4);
      t.to(P, { show: 0, duration: 0.3 }, e - 0.2);
      t.add(function () { W.setLayer("front"); }, e + 0.15);
    },
    final: function (t, at, el) { // последнее сообщение — жюри: раскрывается в QR-код
      var qr = el.querySelector(".qr"), q = pt(qr, 0.5, 0.55);
      var a = at + 1.2;
      arrive(t, a, { x: 960, y: 380, d: 34, s: 0.6 });
      tag(t, a + 0.6, "ссылка на бота → вам");
      var e = fly(t, a, [{ x: 960, y: 380, d: 34, s: 0.6 }, { x: 1180, y: 560, d: 14, s: 0.8 }, { x: q.x, y: q.y, d: 8, s: 1.35 }], 2.4);
      touchdown(t, e, q.x, q.y, function (tt, a2) { tt.fromTo(qr, { opacity: 0, scale: 0.86 }, { opacity: 1, scale: 1, duration: 0.6, ease: "back.out(1.6)" }, a2); });
    }
  };
  function showMail(el) { // без WebGL: всё доставлено сразу
    G.set(phA.querySelectorAll("img"), { filter: "none" });
    G.set(el.querySelectorAll("[data-deliver], .phone .msg"), { opacity: 1 });
    el.querySelectorAll('.phone[data-mail="dim"] img').forEach(function (im) { G.set(im, { filter: "none" }); });
    var clk = el.querySelector(".clock-t"); if (clk) clk.textContent = "07:30";
    el.querySelectorAll("[data-mail-count]").forEach(function (c) { c.textContent = fmt(parseFloat(c.dataset.count)); });
  }
  function planeEnter(t, i, at) {
    var el = slides[i], key = el.dataset.plane;
    if (!hasWorld) { showMail(el); return; }
    if (MAIL[key]) { MAIL[key](t, at, el); return; }
    tag(t, at, null);
    t.to(P, { show: 0, duration: 0.4 }, at);
  }
  function planeLeave(t, at) {
    if (!hasWorld) return;
    tag(t, at, null);
    if (P.show < 0.05) return;
    t.to(P, { x: 980, y: 400, d: 38, idle: 0, duration: 1.1, ease: "power2.in" }, at);
    t.to(P, { show: 0, duration: 0.3 }, at + 0.9);
  }
  if (hasWorld) G.ticker.add(function () { // ярлык держится рядом с самолётиком
    var vis = TAG.on * Math.min(1, P.show * 1.5) * Math.max(0, Math.min(1, (17 - P.d) / 5)) * (1 - Math.min(1, P.face * 3));
    if (vis < 0.01) { if (mt.style.opacity !== "0") mt.style.opacity = "0"; return; }
    var bob = P.idle * Math.sin((W.state.time || 0) * 1.25) * 7, w = mt.offsetWidth;
    var x = P.x + 20 + 50 * P.s, y = P.y + bob + 14 + 40 * P.s;
    if (x + w > 1890) x = P.x - 20 - 50 * P.s - w;
    mt.style.opacity = vis.toFixed(3);
    mt.style.transform = "translate(" + x.toFixed(1) + "px," + y.toFixed(1) + "px)";
  });

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
    var rb = el.querySelector(".route-map"); if (rb) routeAnim(t, 0.7, rb);
    el.querySelectorAll("[data-count]:not([data-mail-count])").forEach(function (c) {
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
    // сообщения ещё не доставлены
    G.set(el.querySelectorAll("[data-deliver], .phone .msg"), { opacity: 0 });
    el.querySelectorAll('.phone[data-mail="dim"] img').forEach(function (im) { G.set(im, { filter: "brightness(0.07) saturate(0.4)" }); });
    var clk = el.querySelector(".clock-t"); if (clk) clk.textContent = "07:00";
    el.querySelectorAll("[data-mail-count]").forEach(function (c) { c.textContent = "0"; });
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
      setPhone(phA, poseOf(el, "pose"), srcOf(el, "phone-src"), el.dataset.mail === "dim");
      setPhone(phB, poseOf(el, "pose2"), srcOf(el, "phone-src2"), false);
      G.set(loupe, { opacity: 0 });
      enterTl = reveal(el); tl = G.timeline(); planeEnter(tl, n, 0.2);
      return;
    }
    var old = slides[from];
    var glide = !!old.dataset.ch && old.dataset.ch === el.dataset.ch && !(dir > 0 && old.dataset.leave === "fold");
    var T = glide ? { out: 0.6, cam: 1.5, vis: 0.45, inn: 0.5, rev: 0.6, plane: 0.7, ph: 0.1, phDur: 1.3, sc: 1.4 }
                  : { out: 0.85, cam: 2.0, vis: 1.05, inn: 1.1, rev: 1.15, plane: 1.25, ph: 0.95, phDur: 0.9, sc: 1.4 };
    busy = true;
    tl = G.timeline({ onComplete: function () { busy = false; G.set(old, { visibility: "hidden" }); } });
    var start = 0;
    hideFocus(tl, 0);
    if (dir > 0 && old.dataset.leave === "fold") start = foldOut(tl, old);
    else planeLeave(tl, 0);
    var landToLand = isLand(from) && isLand(n);
    tl.to(old, { scale: dir > 0 ? (glide ? 1.05 : 1.18) : (glide ? 0.95 : 0.86), opacity: 0, duration: T.out, ease: "power2.in" }, start);
    if (hasWorld) {
      var fc = W.frontClouds.material.uniforms.uOpacity;
      tl.set(fc, { value: (landToLand || glide) ? 0 : 1 }, start);
      tl.to(W.state, { z: camZ(n), y: camY(n), tod: tod(n), duration: T.cam, ease: "power2.inOut" }, start + 0.05);
    }
    scenery(tl, n, start + 0.25, 1.4);
    if (landToLand) tl.to(land.querySelector("img"), { scale: "+=0.04", duration: 2, ease: "power2.inOut" }, start);
    phonesFor(tl, start + (poseOf(el, "pose") ? T.ph : 0.1), el, T.phDur);
    tl.set(el, { visibility: "visible" }, start + T.vis);
    tl.fromTo(el, { opacity: 0, scale: dir > 0 ? (glide ? 0.96 : 0.86) : (glide ? 1.04 : 1.16) }, { opacity: 1, scale: 1, duration: glide ? 0.8 : 1.0, ease: "power2.out" }, start + T.inn);
    tl.add(function () { enterTl = reveal(el); }, start + T.rev);
    planeEnter(tl, n, start + T.plane);
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
