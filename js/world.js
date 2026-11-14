/* world.js — небо, облака и бумажный самолётик.
   three.js r158 (глобальный THREE, без модулей — работает и с file://).
   Два холста: #sky под текстом (небо, дальние облака) и #fx над текстом
   (самолётик, след, облачная завеса, сквозь которую пролетает камера). */
(function () {
  "use strict";
  var T = window.THREE;
  var World = { ok: false };
  window.World = World;
  if (!T) return;

  var SPACING = 60;            // шаг между слайдами по оси Z
  var FOV = 50, TILT = 0.085;  // наклон камеры вверх: горизонт ниже середины
  var state = World.state = { z: 0, y: 0, tod: 0, look: 0, time: 0 };
  World.SPACING = SPACING;

  /* ---------- палитра времени суток ---------- */
  // t, зенит, горизонт, дымка ниже горизонта, солнце, высота°, азимут°, свет облаков, тень облаков, звёзды
  var TOD = [
    [0.00, "#1c2b58", "#e59f86", "#7f7392", "#ffbe92", -1, 34, "#d9a59d", "#4a5183", 0.30],
    [0.12, "#4a73b0", "#ffd2ae", "#e2bfb2", "#ffd9b2", 7, 30, "#fff0e3", "#a3a9c8", 0.0],
    [0.30, "#5f9fe0", "#e7f1fa", "#cfdff0", "#fff3df", 24, 26, "#ffffff", "#a7bad4", 0.0],
    [0.50, "#5598e0", "#e0edf8", "#c9dbee", "#ffffff", 46, 8, "#ffffff", "#aec1da", 0.0],
    [0.66, "#5f86c0", "#ffd39c", "#e9c39f", "#ffcf8c", 11, -28, "#fff0d6", "#a49ab4", 0.0],
    [0.79, "#33497f", "#f3a582", "#c99090", "#ff9868", 1, -38, "#ffd0b8", "#64649a", 0.08],
    [0.87, "#1a2752", "#b6789a", "#76648c", "#e68aa0", -4, -44, "#d4aec4", "#474a7a", 0.45],
    [0.94, "#0b1736", "#2a3e72", "#25355d", "#7c8bc4", -12, -48, "#98a7d6", "#2c3761", 0.85],
    [1.00, "#060e22", "#1a2a53", "#172447", "#6a77b0", -20, -50, "#8594c6", "#26305a", 1.0]
  ].map(function (k) {
    return { t: k[0], zen: new T.Color(k[1]), hor: new T.Color(k[2]), low: new T.Color(k[3]), sun: new T.Color(k[4]),
      el: k[5], az: k[6], cl: new T.Color(k[7]), cs: new T.Color(k[8]), stars: k[9] };
  });
  var pal = { zen: new T.Color(), hor: new T.Color(), low: new T.Color(), sun: new T.Color(), cl: new T.Color(), cs: new T.Color(), sunDir: new T.Vector3(), stars: 0 };
  function palette(t) {
    t = Math.max(0, Math.min(1, t));
    var i = 0; while (i < TOD.length - 2 && t > TOD[i + 1].t) i++;
    var a = TOD[i], b = TOD[i + 1], f = (t - a.t) / (b.t - a.t);
    f = f * f * (3 - 2 * f);
    ["zen", "hor", "low", "sun", "cl", "cs"].forEach(function (k) { pal[k].lerpColors(a[k], b[k], f); });
    var el = T.MathUtils.degToRad(a.el + (b.el - a.el) * f), az = T.MathUtils.degToRad(a.az + (b.az - a.az) * f);
    pal.sunDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
    pal.stars = a.stars + (b.stars - a.stars) * f;
    return pal;
  }
  World.palette = palette;

  /* ---------- рендереры ---------- */
  var skyCanvas = document.getElementById("sky"), fxCanvas = document.getElementById("fx");
  var rSky, rFx;
  try {
    rSky = new T.WebGLRenderer({ canvas: skyCanvas, antialias: false, powerPreference: "high-performance" });
    rFx = new T.WebGLRenderer({ canvas: fxCanvas, antialias: true, alpha: true, premultipliedAlpha: true, powerPreference: "high-performance" });
  } catch (e) { document.documentElement.classList.add("no-webgl"); return; }
  rFx.setClearColor(0x000000, 0);
  var LQ = /[?&]lq/.test(location.search);
  var camera = new T.PerspectiveCamera(FOV, 16 / 9, 0.1, 2000);
  World.camera = camera;
  var sceneSky = new T.Scene(), sceneFx = new T.Scene();

  /* ---------- небо ---------- */
  var skyMat = new T.ShaderMaterial({
    side: T.BackSide, depthWrite: false,
    uniforms: { uZen: { value: pal.zen }, uHor: { value: pal.hor }, uLow: { value: pal.low }, uSun: { value: pal.sun },
      uSunDir: { value: pal.sunDir }, uStars: { value: 0 }, uTime: { value: 0 } },
    vertexShader: "varying vec3 vDir; void main(){ vDir = normalize((modelMatrix*vec4(position,1.0)).xyz - cameraPosition); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_Position.z = gl_Position.w; }",
    fragmentShader: [
      "uniform vec3 uZen,uHor,uLow,uSun,uSunDir; uniform float uStars,uTime; varying vec3 vDir;",
      "float h3(vec3 p){ p=fract(p*0.3183099+0.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }",
      "void main(){ vec3 d=normalize(vDir); float h=d.y;",
      " vec3 col=mix(uHor,uZen,pow(smoothstep(-0.02,0.9,h),0.6));",
      " col=mix(col,uLow,smoothstep(0.0,-0.22,h));",
      " float s=max(dot(d,uSunDir),0.0);",
      " col+=uSun*(pow(s,900.0)*1.4+pow(s,40.0)*0.22+pow(s,5.0)*0.10);",
      " if(uStars>0.001){ vec3 g=floor(d*360.0); float r=h3(g); float st=step(0.9968,r)*smoothstep(0.02,0.3,h);",
      "  st*=0.55+0.45*sin(uTime*1.7+r*90.0); col+=vec3(st*uStars*(0.6+r*0.6)); }",
      " gl_FragColor=vec4(col,1.0);",
      " #include <colorspace_fragment>",
      "}"].join("\n")
  });
  var dome = new T.Mesh(new T.SphereGeometry(900, 48, 24), skyMat);
  sceneSky.add(dome);

  /* ---------- облака: инстансы-билборды из одного атласа ---------- */
  var tex = new T.TextureLoader().load(window.ASSETS && window.ASSETS.atlas);
  tex.colorSpace = T.SRGBColorSpace; tex.generateMipmaps = true; tex.minFilter = T.LinearMipmapLinearFilter;
  function tileUV(i) { // 0..3 — клубы, 4 — гряда
    if (i === 4) return [0.0605, 0.0288, 0.9395, 0.3467];
    var c = i % 2, r = Math.floor(i / 2), v1 = 1 - r * 0.3125;
    return [c * 0.5 + 0.004, v1 - 0.3125 + 0.004, c * 0.5 + 0.496, v1 - 0.004];
  }
  var cloudVS = [
    "attribute vec3 iPos; attribute vec2 iSize; attribute vec4 iUV; attribute float iA; attribute float iSeed;",
    "uniform float uTime; varying vec2 vUv; varying float vA; varying float vDist;",
    "void main(){ vec3 p=iPos; p.x+=sin(uTime*0.04+iSeed*6.2831)*0.8;",
    " vec4 mv=viewMatrix*vec4(p,1.0); mv.xy+=position.xy*iSize; gl_Position=projectionMatrix*mv;",
    " vUv=mix(iUV.xy,iUV.zw,uv); vA=iA; vDist=-mv.z; }"].join("\n");
  var cloudFS = [
    "uniform sampler2D map; uniform vec3 uLight,uShade,uFog; uniform float uFogNear,uFogFar,uN0,uN1,uF0,uF1,uOpacity;",
    "varying vec2 vUv; varying float vA; varying float vDist;",
    "void main(){ vec4 t=texture2D(map,vUv); float l=dot(t.rgb,vec3(0.333));",
    " vec3 col=mix(uShade,uLight,smoothstep(0.32,0.95,l));",
    " col=mix(col,uLight,(1.0-t.a)*0.85);",
    " float f=smoothstep(uFogNear,uFogFar,vDist); col=mix(col,uFog,f*0.9);",
    " float a=t.a*vA*uOpacity*smoothstep(uN0,uN1,vDist)*(1.0-smoothstep(uF0,uF1,vDist));",
    " if(a<0.004) discard; gl_FragColor=vec4(col,a);",
    " #include <colorspace_fragment>",
    "}"].join("\n");
  function cloudMaterial(n0, n1, f0, f1, fogNear, fogFar) {
    return new T.ShaderMaterial({
      transparent: true, depthWrite: false, vertexShader: cloudVS, fragmentShader: cloudFS,
      uniforms: { map: { value: tex }, uLight: { value: pal.cl }, uShade: { value: pal.cs }, uFog: { value: pal.hor },
        uFogNear: { value: fogNear }, uFogFar: { value: fogFar }, uN0: { value: n0 }, uN1: { value: n1 },
        uF0: { value: f0 }, uF1: { value: f1 }, uOpacity: { value: 1 }, uTime: { value: 0 } }
    });
  }
  function buildClouds(list, material) {
    list.sort(function (a, b) { return a.z - b.z; }); // дальние (меньший z) рисуются первыми
    var g = new T.InstancedBufferGeometry();
    var base = new T.PlaneGeometry(1, 1);
    g.index = base.index; g.attributes.position = base.attributes.position; g.attributes.uv = base.attributes.uv;
    var n = list.length, P = new Float32Array(n * 3), S = new Float32Array(n * 2), U = new Float32Array(n * 4), A = new Float32Array(n), R = new Float32Array(n);
    list.forEach(function (c, i) {
      P.set([c.x, c.y, c.z], i * 3); S.set([c.w, c.h], i * 2); U.set(tileUV(c.tile), i * 4); A[i] = c.a; R[i] = c.seed;
    });
    g.setAttribute("iPos", new T.InstancedBufferAttribute(P, 3)); g.setAttribute("iSize", new T.InstancedBufferAttribute(S, 2));
    g.setAttribute("iUV", new T.InstancedBufferAttribute(U, 4)); g.setAttribute("iA", new T.InstancedBufferAttribute(A, 1));
    g.setAttribute("iSeed", new T.InstancedBufferAttribute(R, 1));
    g.instanceCount = n;
    var m = new T.Mesh(g, material); m.frustumCulled = false;
    return m;
  }
  var seed = 7; function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
  function rr(a, b) { return a + (b - a) * rnd(); }

  World.build = function (nSlides) {
    var back = [], front = [], zEnd = -(nSlides * SPACING + 260);
    var PA = 1.6, BA = 2.77;
    // море облаков внизу: верхушки чуть ниже линии взгляда
    for (var z = 60; z > zEnd; z -= 7) {
      for (var k = 0; k < 2; k++) {
        var w = rr(30, 58);
        back.push({ x: rr(-130, 130), y: rr(-28, -21), z: z + rr(-3, 3), w: w, h: w / PA, tile: Math.floor(rnd() * 4), a: rr(0.9, 1), seed: rnd() });
      }
      if (rnd() < 0.32) { var bw = rr(120, 180); back.push({ x: rr(-100, 100), y: rr(-19.5, -15.5), z: z, w: bw, h: bw / BA, tile: 4, a: 0.92, seed: rnd() }); }
    }
    // облака по краям кадра у каждого слайда
    for (var i = -1; i < nSlides + 2; i++) {
      var zc = -i * SPACING;
      for (var j = 0; j < 6; j++) {
        var side = j % 2 ? 1 : -1, w2 = rr(14, 30);
        back.push({ x: side * rr(32, 80), y: rr(-13, 3), z: zc - rr(40, 115), w: w2, h: w2 / PA, tile: Math.floor(rnd() * 4), a: rr(0.75, 1), seed: rnd() });
      }
      // высокие редкие облака
      if (rnd() < 0.5) { var w3 = rr(30, 60); back.push({ x: rr(-70, 70), y: rr(26, 44), z: zc - rr(120, 220), w: w3, h: w3 / PA, tile: Math.floor(rnd() * 4), a: 0.55, seed: rnd() }); }
      // завеса между слайдами — её камера пролетает насквозь
      var zz = zc - SPACING / 2;
      for (var q = 0; q < 26; q++) {
        var w4 = rr(9, 17);
        front.push({ x: rr(-13, 13), y: rr(-7, 6), z: zz + rr(-6, 6), w: w4, h: w4 / PA, tile: Math.floor(rnd() * 4), a: rr(0.85, 1), seed: rnd() });
      }
    }
    World.backClouds = buildClouds(back, cloudMaterial(9, 18, 160, 330, 40, 330));
    World.frontClouds = buildClouds(front, cloudMaterial(0.8, 3.2, 13, 27, 6, 40));
    sceneSky.add(World.backClouds); sceneFx.add(World.frontClouds);
  };

  /* ---------- свет (самолётик может быть в любой из сцен) ---------- */
  function lights(scene) {
    var hemi = new T.HemisphereLight(0xffffff, 0x888888, 1.6), sun = new T.DirectionalLight(0xffffff, 2.6);
    var fill = new T.DirectionalLight(0xffffff, 0.9);
    scene.add(hemi); scene.add(sun); scene.add(sun.target); scene.add(fill); scene.add(fill.target);
    return { hemi: hemi, sun: sun, fill: fill };
  }
  var L1 = lights(sceneSky), L2 = lights(sceneFx);

  /* ---------- бумажный самолётик: 6 треугольников, складывается из листа ---------- */
  // точки в двух состояниях: плоский лист (m=0) и сложенный самолётик (m=1). Нос смотрит в -Z.
  var FLAT = { N: [0, 0, -0.95], TLc: [-0.62, 0, -0.95], TRc: [0.62, 0, -0.95], TL: [-0.62, 0, 0.62], TR: [0.62, 0, 0.62], C: [0, 0, 0.62], K: [0, 0, 0.62] };
  var MID = { N: [0, 0, -1.2], TLc: [-0.16, 0.35, -0.2], TRc: [0.16, 0.35, -0.2], TL: [-0.62, 0, 0.56], TR: [0.62, 0, 0.56], C: [0, 0, 0.56], K: [0, 0, 0.56] };
  var FOLD = { N: [0, 0, -1.2], TLc: [-0.2, 0.03, -0.24], TRc: [0.2, 0.03, -0.24], TL: [-0.66, 0.2, 0.56], TR: [0.66, 0.2, 0.56], C: [0, 0, 0.56], K: [0, -0.28, 0.56] };
  var TRIS = [["N", "TLc", "TL"], ["N", "TL", "C"], ["N", "C", "TR"], ["N", "TR", "TRc"], ["N", "C", "K"], ["N", "K", "C"]];
  var planeGeo = new T.BufferGeometry();
  var planePos = new Float32Array(TRIS.length * 9);
  planeGeo.setAttribute("position", new T.BufferAttribute(planePos, 3));
  var paper = new T.MeshStandardMaterial({ color: 0xfbf8f2, emissive: 0x000000, roughness: 0.62, metalness: 0, side: T.DoubleSide, flatShading: true });
  var planeMesh = new T.Mesh(planeGeo, paper);
  var plane = new T.Group(); plane.add(planeMesh); plane.visible = false;
  sceneFx.add(plane);
  World.planeObj = plane;
  function setFold(m) {
    var a, b, f;
    if (m < 0.5) { a = FLAT; b = MID; f = m / 0.5; } else { a = MID; b = FOLD; f = (m - 0.5) / 0.5; }
    f = f * f * (3 - 2 * f);
    var k = 0;
    TRIS.forEach(function (tri) {
      tri.forEach(function (p) {
        for (var c = 0; c < 3; c++) planePos[k++] = a[p][c] + (b[p][c] - a[p][c]) * f;
      });
    });
    planeGeo.attributes.position.needsUpdate = true;
    planeGeo.computeVertexNormals();
  }
  setFold(1);

  /* ---------- инверсионный след ---------- */
  var TRAIL_N = 70, trail = [];
  var trailGeo = new T.BufferGeometry();
  var trailPos = new Float32Array(TRAIL_N * 2 * 3), trailA = new Float32Array(TRAIL_N * 2);
  trailGeo.setAttribute("position", new T.BufferAttribute(trailPos, 3));
  trailGeo.setAttribute("aA", new T.BufferAttribute(trailA, 1));
  var idx = []; for (var ti = 0; ti < TRAIL_N - 1; ti++) { var o = ti * 2; idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2); }
  trailGeo.setIndex(idx);
  var trailMat = new T.ShaderMaterial({
    transparent: true, depthWrite: false, side: T.DoubleSide, uniforms: { uCol: { value: new T.Color(0xffffff) } },
    vertexShader: "attribute float aA; varying float vA; void main(){ vA=aA; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
    fragmentShader: "uniform vec3 uCol; varying float vA; void main(){ gl_FragColor=vec4(uCol,vA); \n#include <colorspace_fragment>\n }"
  });
  var trailMesh = new T.Mesh(trailGeo, trailMat); trailMesh.frustumCulled = false;
  sceneFx.add(trailMesh);

  /* ---------- координаты сцены 1920×1080 → мир ---------- */
  var view = { W: 1, H: 1, s: 1, ox: 0, oy: 0 };
  World.setView = function (v) { view = v; };
  var _v = new T.Vector3(), _f = new T.Vector3();
  function stageToWorld(sx, sy, d, out) {
    var wx = view.ox + sx * view.s, wy = view.oy + sy * view.s;
    _v.set(wx / view.W * 2 - 1, -(wy / view.H * 2 - 1), 0.5).unproject(camera).sub(camera.position).normalize();
    camera.getWorldDirection(_f);
    return out.copy(camera.position).addScaledVector(_v, d / Math.max(0.05, _v.dot(_f)));
  }
  World.stageToWorld = stageToWorld;
  World.pxPerUnit = function (d) { return (view.H / 2) / (Math.tan(T.MathUtils.degToRad(FOV / 2)) * d) / view.s; };

  /* ---------- поза самолётика (в координатах сцены) ---------- */
  var P = World.plane = { x: -300, y: 900, d: 12, s: 1, fold: 1, show: 0, layer: "front", face: 0, idle: 1, trail: 1 };
  // face: 0 — летит по направлению движения; 1 — лист смотрит в камеру (для складывания)
  World.setLayer = function (name) {
    if (P.layer === name) return; P.layer = name;
    (name === "back" ? sceneSky : sceneFx).add(plane);
  };
  World.path = function (pts) { // Катмулл — Ром через точки {x,y,d,s}
    var curve = new T.CatmullRomCurve3(pts.map(function (p) { return new T.Vector3(p.x, p.y, p.d); }), false, "centripetal");
    var sc = pts.map(function (p) { return p.s == null ? P.s : p.s; });
    return function (t) {
      var v = curve.getPoint(t), si = t * (sc.length - 1), i0 = Math.floor(si), i1 = Math.min(sc.length - 1, i0 + 1);
      P.x = v.x; P.y = v.y; P.d = v.z; P.s = sc[i0] + (sc[i1] - sc[i0]) * (si - i0);
    };
  };

  var pos = new T.Vector3(), prev = new T.Vector3(), vel = new T.Vector3(), head = new T.Vector3(0.8, 0.1, -0.6).normalize();
  var tgt = new T.Vector3(), tmp = new T.Vector3(), camFwd = new T.Vector3(), lastX = 0, roll = 0, first = true;
  var IDLE = new T.Vector3(0.82, 0.12, -0.56).normalize();

  function updatePlane(dt, t) {
    var bob = P.idle * Math.sin(t * 1.25) * 7, sway = P.idle * Math.sin(t * 0.8) * 0.07;
    stageToWorld(P.x, P.y + bob, P.d, pos);
    plane.position.copy(pos);
    plane.scale.setScalar(P.s);
    plane.visible = P.show > 0.01;
    paper.opacity = P.show; paper.transparent = P.show < 0.999;
    setFold(P.fold);
    if (first) { prev.copy(pos); first = false; }
    vel.copy(pos).sub(prev).divideScalar(Math.max(dt, 1e-3));
    prev.copy(pos);
    var sp = vel.length();
    if (P.face > 0.001) {
      // лист «лицом» к зрителю: нос вверх
      camera.getWorldDirection(camFwd);
      plane.quaternion.copy(camera.quaternion);
      plane.rotateX(Math.PI / 2 * P.face);
      if (P.face < 1) { // плавный выход в полёт
        tmp.copy(pos).sub(IDLE);
        var q = plane.quaternion.clone(); plane.lookAt(tmp); plane.quaternion.slerp(q, P.face);
      }
      lastX = P.x; return;
    }
    tgt.copy(IDLE);
    if (sp > 2) tgt.lerp(vel.clone().normalize(), Math.min(1, (sp - 2) / 8));
    head.lerp(tgt, 1 - Math.exp(-dt * 5)).normalize();
    tmp.copy(pos).sub(head);
    plane.lookAt(tmp);
    var dx = (P.x - lastX) / Math.max(dt, 1e-3); lastX = P.x;
    roll += (T.MathUtils.clamp(-dx / 900, -0.75, 0.75) - roll) * (1 - Math.exp(-dt * 4));
    plane.rotateZ(roll + sway - 0.42 * P.idle);
  }

  function updateTrail(dt, t) {
    var tail = tmp.copy(pos).addScaledVector(head, -0.75 * P.s);
    if (P.show > 0.5 && P.trail > 0.01 && P.face < 0.01) trail.unshift({ p: tail.clone(), t: t });
    while (trail.length > TRAIL_N || (trail.length && t - trail[trail.length - 1].t > 1.3)) trail.pop();
    camera.getWorldDirection(camFwd);
    for (var i = 0; i < TRAIL_N; i++) {
      var e = trail[Math.min(i, trail.length - 1)];
      if (!e) { trailA[i * 2] = trailA[i * 2 + 1] = 0; continue; }
      var n = trail[Math.min(i + 1, trail.length - 1)];
      var age = (t - e.t) / 1.3, w = (0.015 + age * 0.09) * P.s;
      var dir = _v.copy(e.p).sub(n.p); if (dir.lengthSq() < 1e-8) dir.set(1, 0, 0);
      var side = _f.copy(dir).cross(camFwd).normalize().multiplyScalar(w);
      trailPos.set([e.p.x + side.x, e.p.y + side.y, e.p.z + side.z, e.p.x - side.x, e.p.y - side.y, e.p.z - side.z], i * 6);
      var a = i >= trail.length - 1 ? 0 : Math.pow(1 - age, 1.6) * 0.5 * P.trail;
      trailA[i * 2] = trailA[i * 2 + 1] = Math.max(0, a);
    }
    trailGeo.attributes.position.needsUpdate = true; trailGeo.attributes.aA.needsUpdate = true;
  }

  /* ---------- кадр ---------- */
  function resize() {
    var W = window.innerWidth, H = window.innerHeight;
    var dpr = window.devicePixelRatio || 1;
    rSky.setPixelRatio(Math.min(dpr, 1) * (LQ ? 0.6 : 0.85)); rFx.setPixelRatio(Math.min(dpr, LQ ? 1 : 1.5));
    rSky.setSize(W, H, false); rFx.setSize(W, H, false);
    camera.aspect = W / H; camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize); resize();

  var clock = new T.Clock(), lastT = 0;
  function frame() {
    requestAnimationFrame(frame);
    var t = clock.getElapsedTime(), dt = Math.min(0.05, t - lastT); lastT = t; state.time = t;
    camera.position.set(0, state.y, state.z);
    camera.rotation.set(TILT + state.look, 0, 0);
    camera.updateMatrixWorld();
    dome.position.copy(camera.position);
    palette(state.tod);
    skyMat.uniforms.uStars.value = pal.stars; skyMat.uniforms.uTime.value = t;
    [L1, L2].forEach(function (L) {
      L.sun.color.copy(pal.sun); L.sun.position.copy(camera.position).addScaledVector(pal.sunDir, 50); L.sun.target.position.copy(camera.position);
      L.hemi.color.copy(pal.zen).lerp(new T.Color(1, 1, 1), 0.55); L.hemi.groundColor.copy(pal.low);
      L.sun.intensity = 1.2 + Math.max(0, pal.sunDir.y) * 2.4 + 0.6;
      L.fill.position.set(camera.position.x + 3, camera.position.y + 6, camera.position.z + 8); L.fill.target.position.set(0, camera.position.y, camera.position.z - 12);
      L.fill.intensity = 1.5 + pal.stars * 0.8;
    });
    if (World.backClouds) { World.backClouds.material.uniforms.uTime.value = t; World.frontClouds.material.uniforms.uTime.value = t; }
    trailMat.uniforms.uCol.value.copy(pal.cl);
    paper.emissive.copy(pal.cl).multiplyScalar(0.34);
    updatePlane(dt, t); updateTrail(dt, t);
    rSky.render(sceneSky, camera);
    rFx.render(sceneFx, camera);
  }
  World.start = function () { World.ok = true; frame(); };
  World.ok = true;
})();
