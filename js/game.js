(function () {
  "use strict";

  const TAU = Math.PI * 2;
  const WORLD_W = 1600, WORLD_H = 1000;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => t * t * (3 - 2 * t);
  const outCubic = (t) => 1 - Math.pow(1 - t, 3);
  const outBack = (t) => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  const outElastic = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1);
  const Sim = () => window.OrchardSim;
  const DT = (typeof window !== "undefined" && window.OrchardSim && window.OrchardSim.DT) || 1 / 120;
  const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashSeed(s) {
    const str = String(s);
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  const rgbCache = new Map();
  function rgb(hex) {
    let c = rgbCache.get(hex);
    if (!c) {
      let h = String(hex).replace("#", "");
      if (h.length === 3) h = h.split("").map((x) => x + x).join("");
      const n = parseInt(h, 16) || 0;
      c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      rgbCache.set(hex, c);
    }
    return c;
  }
  function mix(a, b, t) {
    const x = rgb(a), y = rgb(b);
    return "#" + [0, 1, 2].map((i) => Math.round(lerp(x[i], y[i], t)).toString(16).padStart(2, "0")).join("");
  }
  const rgbaCache = new Map();
  function rgba(hex, a) {
    const q = Math.round(clamp(a, 0, 1) * 100), k = hex + q;
    let s = rgbaCache.get(k);
    if (!s) {
      const c = rgb(hex);
      s = "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + q / 100 + ")";
      if (rgbaCache.size > 6000) rgbaCache.clear();
      rgbaCache.set(k, s);
    }
    return s;
  }

  const THEMES = {
    1: { ambience: "fireflies", flora: "daisy", bg: ["#1f2350", "#2b1f4f", "#0e1128"], nebula: "#ff9ec4", accent: "#8fc79a", glow: "#ffd9a8" },
    2: { ambience: "aurora", flora: "fern", bg: ["#0f2e40", "#0f2440", "#06121d"], nebula: "#7ef0d8", accent: "#bfe6f0", glow: "#d8fff6" },
    3: { ambience: "nebula", flora: "spiral", bg: ["#2c1046", "#3a1352", "#12071f"], nebula: "#c77dff", accent: "#a99be6", glow: "#f0c6ff" },
    4: { ambience: "clockwork", flora: "sunflower", bg: ["#221d33", "#2e2438", "#0d0b16"], nebula: "#f3c677", accent: "#f3d67a", glow: "#ffe7b0" },
    5: { ambience: "horizon", flora: "ember", bg: ["#1c0d12", "#2a0f16", "#060305"], nebula: "#ff7a45", accent: "#ff9e6b", glow: "#ffd0a8" },
  };

  const FLORA = {
    daisy: { stem: "#6fb487", stemDark: "#4f8f66", leaf: "#9fd6a6", bloom: ["#ff79b0", "#f29e7a", "#f3d67a", "#ffffff", "#c9a8ff"], core: "#2a1f3d" },
    fern: { stem: "#4fa08c", stemDark: "#2f7a6a", leaf: "#7fd6b8", bloom: ["#e8fbff", "#bfe6f0", "#9ff5e0", "#d8fff6"], core: "#ffffff" },
    spiral: { stem: "#c9b4ff", stemDark: "#9d82f0", leaf: "#7ef0d8", bloom: ["#f0c6ff", "#7ef0d8", "#ff9ec4", "#c77dff"], core: "#ffffff" },
    sunflower: { stem: "#7d9a45", stemDark: "#5a7430", leaf: "#a3bf5c", bloom: ["#f3c677", "#e8a93a", "#ffd76b", "#d9933a"], core: "#5a3a1c" },
    ember: { stem: "#7a3024", stemDark: "#4a1a14", leaf: "#ff7a45", bloom: ["#ffd0a8", "#ff4d2e", "#ffb347", "#ff7a45"], core: "#fff1c9" },
  };

  const TRAILS = [
    { id: "classic", name: "Classic" }, { id: "comet", name: "Comet" }, { id: "petal", name: "Petal Drift" },
    { id: "ember", name: "Ember Wake" }, { id: "prism", name: "Prism" },
  ];

  const TOAST = {
    sown: "Sown", sated: "Soil sated", full: "Already in bloom", burn: "Scorched", crash: "Barren rock", repel: "Repelled",
    swallow: "Swallowed by the dark", shield: "Shield held", lost: "Drifted into the dark", pollen: "Pollen gathered",
  };

  const S = {
    canvas: null, ctx: null, W: 0, H: 0, DPR: 1, last: 0,
    insets: { top: 0, right: 0, bottom: 0, left: 0 }, hudAnchor: null,
    fit: { s: 1, cx: 0, cy: 0 }, view: { s: 1, ox: 0, oy: 0, a: 1, b: 0, c: 0, d: 1, th: 0 }, rot: 0,
    cam: { z: 1, x: 800, y: 500 },
    settings: { skin: "nocturne", grid: true, shake: true, reducedMotion: false, assist: false, colorblind: false, fastForward: false, trail: "classic" },
    mode: "idle", ctxMode: "journey", world: null, theme: THEMES[1], def: null, lv: null, P: [],
    T: 0, step: 0, seedT: 0, acc: 0, time: 0, ambT: 0, phase: "none", phaseT: 0, introT: 0, introDur: 1,
    seed: null, near: { arm: -1, fired: true, th: 0, min: 0 }, trail: [], parts: [], sparts: [], rings: [],
    aim: { ang: -0.3, pow: 0.55 }, drag: null, keys: new Set(), inputEnabled: true, paused: false,
    seeds: 0, seedsLeft: 0, used: 0, pollenGot: [], hitstop: 0, shake: 0, fade: 0, fadeIn: 0, flash: 0,
    recoil: 0, fast: false, pv: null, lastHud: "", aimSfxT: 0, startedAt: 0, bot: null, handlers: {},
    pal: null, bgC: null, stars: [], amb: null, sprites: new Map(), pats: {}, emitted: false,
    demo: null, guides: null,
  };

  const mq = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  const rm = () => !!(S.settings.reducedMotion || (mq && mq.matches));

  function on(name, fn) { (S.handlers[name] = S.handlers[name] || []).push(fn); }
  function off(name, fn) { const a = S.handlers[name]; if (a) S.handlers[name] = a.filter((f) => f !== fn); }
  function emit(name, payload) {
    const a = S.handlers[name];
    if (!a) return;
    for (const fn of a.slice()) { try { fn(payload); } catch (e) { console.error(e); } }
  }
  const DEMO_MUTE = { launch: 1, event: 1, win: 1, lose: 1, zenComplete: 1 };
  function playEmit(name, payload) { if (S.mode === "play" && !(S.demo && DEMO_MUTE[name])) emit(name, payload); }
  function toast(key, tone) { if (!(S.demo && S.demo.quiet)) playEmit("toast", { text: TOAST[key] || key, tone: tone || "info" }); }
  function sfx(name, opts) {
    if (S.mode !== "play" || (S.demo && S.demo.quiet)) return;
    try { if (window.OrchardAudio) window.OrchardAudio.sfx(name, opts || {}); } catch (e) { return; }
  }

  function mkCanvas(w, h) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function buildPalette() {
    const th = S.theme, sk = S.settings.skin;
    const fl = FLORA[th.flora] || FLORA.daisy;
    const p = { skin: sk, flora: th.flora, fl: fl, neon: sk === "synthwave", mono: sk === "inkwell", light: sk === "daylight" || sk === "inkwell" };
    if (sk === "daylight") {
      const ink = "#2b2238";
      Object.assign(p, {
        bg: [mix("#f7f1e5", th.bg[0], 0.07), mix("#efe6d3", th.bg[1], 0.09), mix("#e2d6c0", th.bg[2], 0.1)],
        stars: [ink, mix(ink, th.nebula, 0.5)], starA: 0.35, ink: ink, paper: "#f7f1e5", outline: ink, riso: mix("#ff5a8a", th.nebula, 0.35),
        fert: "#4fa06a", fertDark: "#2d6e48", fertDeep: "#2f6b47", fertSated: "#6cc08a",
        barren: "#8f8aa8", barrenDark: "#5f5a7c", crater: "#6f6a8e",
        sun: "#ff8a3d", sunCore: "#ffd04d", sunDark: "#c2452a",
        ice: "#6cc0dc", iceDark: "#2f7f9c",
        bh: "#1b1424", bhDisk: mix("#ff6a3d", th.nebula, 0.3), bhRing: "#ff9a3d",
        rep: "#e0356b", repDark: "#8a1a3e",
        shield: mix("#3b6fd6", th.accent, 0.2), wind: mix(th.accent, ink, 0.35), boost: "#e09a00", pollen: "#e9a800",
        portals: [mix(th.nebula, ink, 0.3), mix(th.accent, ink, 0.35), mix(th.glow, ink, 0.45)],
        preview: "#d2462a", trail: "#ff5a8a", seed: "#ffb84d", seed2: "#d2462a", launcher: "#ff6f59", launcherDark: "#a8392a",
        grid: ink, gridA: 0.22, glowOp: "multiply", glowK: 0.5, amb: [mix(th.nebula, ink, 0.1), mix(th.accent, ink, 0.2), mix(th.glow, ink, 0.25)],
      });
    } else if (sk === "synthwave") {
      const mg = "#ff3df2", cy = "#5ef2ff";
      Object.assign(p, {
        bg: [mix("#1c0438", th.bg[0], 0.25), mix("#12002a", th.bg[1], 0.2), "#040006"],
        stars: ["#ffffff", cy, mix(mg, th.nebula, 0.4)], starA: 0.9, ink: "#07000f", paper: "#07000f",
        fert: mix("#39ffb0", th.accent, 0.2), fertDark: "#0f5a40", fertDeep: "#39ffb0", fertSated: "#9dffd6",
        barren: "#8f7bff", barrenDark: "#2a1f66", crater: "#8f7bff",
        sun: "#ff8a3d", sunCore: "#ffe45e", sunDark: "#ff3d6e",
        ice: cy, iceDark: "#1a7a8a",
        bh: "#000000", bhDisk: mix(mg, th.nebula, 0.3), bhRing: "#ffffff",
        rep: "#ff3d6e", repDark: "#5a0020",
        shield: mix(cy, th.accent, 0.25), wind: mix(cy, th.accent, 0.3), boost: "#ffe45e", pollen: "#ffe45e",
        portals: [mix(mg, th.nebula, 0.35), mix(cy, th.accent, 0.3), mix("#ffe45e", th.glow, 0.3)],
        preview: "#ffe45e", trail: mg, seed: "#ffffff", seed2: mg, launcher: mg, launcherDark: "#5a0055",
        grid: mix(mg, th.nebula, 0.3), gridA: 0.35, glowOp: "lighter", glowK: 1, amb: [mix(mg, th.nebula, 0.5), mix(cy, th.accent, 0.5), mix("#ffe45e", th.glow, 0.5)],
      });
    } else if (sk === "inkwell") {
      const ink = "#141414", pap = "#efe9dc";
      Object.assign(p, {
        bg: ["#f4efe4", "#ece5d6", "#ddd4c2"], stars: [ink], starA: 0.4, ink: ink, paper: pap, outline: ink,
        fert: pap, fertDark: ink, fertDeep: ink, fertSated: pap, barren: pap, barrenDark: ink, crater: ink,
        sun: pap, sunCore: pap, sunDark: ink, ice: pap, iceDark: ink, bh: ink, bhDisk: ink, bhRing: ink, rep: pap, repDark: ink,
        shield: ink, wind: ink, boost: ink, pollen: ink, portals: [ink, ink, ink], preview: ink, trail: ink, seed: pap, seed2: ink,
        launcher: pap, launcherDark: ink, grid: ink, gridA: 0.25, glowOp: "source-over", glowK: 0, amb: [ink, ink, ink],
      });
    } else {
      Object.assign(p, {
        bg: th.bg.slice(), stars: ["#f4ead8", "#ffd8c2", "#cfc6ff"], starA: 1, ink: "#10142a", paper: "#f4ead8",
        fert: mix("#8fc79a", th.accent, 0.2), fertDark: "#4f7f63", fertDeep: "#3b624d", fertSated: "#a6dcae",
        barren: "#5b5f82", barrenDark: "#3a3d5c", crater: "#4a4d6e",
        sun: "#f6b56f", sunCore: "#ffe29a", sunDark: "#b0563e",
        ice: "#bfe6f0", iceDark: "#6e9fb3",
        bh: "#07040c", bhDisk: mix("#ffb36b", th.nebula, 0.35), bhRing: "#fff2d6",
        rep: "#ff6f91", repDark: "#7a2a4a",
        shield: mix("#cfe8ff", th.accent, 0.3), wind: th.accent, boost: "#f3d67a", pollen: "#ffd35a",
        portals: [th.nebula === "#a99be6" ? "#a99be6" : mix("#a99be6", th.nebula, 0.5), th.glow, th.accent],
        preview: "#f3d67a", trail: "#f29e7a", seed: "#ffe8b0", seed2: "#f29e7a", launcher: "#f29e7a", launcherDark: "#8a4f3d",
        grid: "#cfc6ff", gridA: 0.4, glowOp: "lighter", glowK: 1, amb: [th.nebula, th.accent, th.glow],
      });
    }
    p.shadow = p.skin === "nocturne";
    S.pal = p;
    S.sprites.clear();
    S.pats = {};
  }

  function tint(hex) {
    const p = S.pal;
    if (p.mono) return p.ink;
    if (p.skin === "daylight") return mix(hex, p.ink, 0.28);
    return hex;
  }

  function lw(n) { return n * clamp(0.9 / S.view.s, 0.85, 2.6); }

  function glowSprite(hex) {
    const key = "g" + hex;
    let c = S.sprites.get(key);
    if (!c) {
      c = mkCanvas(128, 128);
      const g = c.getContext("2d"), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, rgba(hex, 1)); gr.addColorStop(0.22, rgba(hex, 0.5)); gr.addColorStop(0.55, rgba(hex, 0.12)); gr.addColorStop(1, rgba(hex, 0));
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
      S.sprites.set(key, c);
    }
    return c;
  }

  function drawGlow(x, y, rad, hex, a) {
    const p = S.pal;
    if (p.mono || a <= 0.004 || rad <= 0) return;
    const c = S.ctx;
    c.globalCompositeOperation = p.glowOp;
    c.globalAlpha = clamp(a * p.glowK, 0, 1);
    c.drawImage(glowSprite(hex), x - rad, y - rad, rad * 2, rad * 2);
    c.globalAlpha = 1;
    c.globalCompositeOperation = "source-over";
  }

  function sunSprite() {
    let c = S.sprites.get("sun");
    if (!c) {
      const p = S.pal;
      c = mkCanvas(256, 256);
      const g = c.getContext("2d"), gr = g.createRadialGradient(92, 92, 10, 128, 128, 128);
      gr.addColorStop(0, p.neon ? "#ffffff" : p.sunCore); gr.addColorStop(0.55, p.sunCore); gr.addColorStop(1, p.sun);
      g.fillStyle = gr; g.beginPath(); g.arc(128, 128, 127, 0, TAU); g.fill();
      S.sprites.set("sun", c);
    }
    return c;
  }

  function pattern(kind) {
    if (S.pats[kind]) return S.pats[kind];
    const ink = S.pal.ink, n = 12, c = mkCanvas(n, n), g = c.getContext("2d");
    g.strokeStyle = ink; g.fillStyle = ink; g.lineWidth = 1.1; g.lineCap = "square";
    const line = (x0, y0, x1, y1) => { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); };
    if (kind === "hatch" || kind === "cross") { line(-2, n + 2, n + 2, -2); line(-2, 2, 2, -2); line(n - 2, n + 2, n + 2, n - 2); }
    if (kind === "cross") { line(-2, -2, n + 2, n + 2); line(n - 2, -2, n + 2, 2); line(-2, n - 2, 2, n + 2); }
    if (kind === "dense") { for (let i = 0; i < n; i += 4) line(i + 0.5, 0, i + 0.5, n); }
    if (kind === "stipple") { const r = mulberry32(7); for (let i = 0; i < 7; i++) g.fillRect(Math.floor(r() * n), Math.floor(r() * n), 1.2, 1.2); }
    if (kind === "light") { line(0, n / 2 + 0.5, n, n / 2 + 0.5); }
    S.pats[kind] = S.ctx.createPattern(c, "repeat");
    return S.pats[kind];
  }

  function buildGrain() {
    const n = 160, c = mkCanvas(n, n), g = c.getContext("2d"), img = g.createImageData(n, n), r = mulberry32(99);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = r(), on = v < 0.18 || v > 0.82;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v > 0.5 ? 255 : 0; img.data[i + 3] = on ? 10 + Math.abs(v - 0.5) * 22 : 0;
    }
    g.putImageData(img, 0, 0);
    S.grain = S.ctx.createPattern(c, "repeat");
    const s = mkCanvas(4, 4), sg = s.getContext("2d");
    sg.fillStyle = "rgba(0,0,0,0.28)"; sg.fillRect(0, 0, 4, 1); sg.fillRect(0, 2, 4, 0.6);
    S.scan = S.ctx.createPattern(s, "repeat");
  }

  function buildBg() {
    const W = S.W, H = S.H, D = S.DPR, p = S.pal, th = S.theme;
    const c = mkCanvas(W * D, H * D), g = c.getContext("2d");
    g.scale(D, D);
    const gr = g.createRadialGradient(W * 0.3, H * 0.2, 0, W * 0.5, H * 0.5, Math.max(W, H) * 0.9);
    gr.addColorStop(0, p.bg[0]); gr.addColorStop(0.55, p.bg[1]); gr.addColorStop(1, p.bg[2]);
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const r = mulberry32(42);
    if (!p.mono) {
      g.globalCompositeOperation = p.light ? "multiply" : "lighter";
      const cols = [th.nebula, th.accent, th.glow, th.nebula];
      for (let i = 0; i < 6; i++) {
        const x = r() * W, y = r() * H, rad = Math.max(W, H) * (0.25 + r() * 0.35), col = p.light ? mix(cols[i % 4], "#ffffff", 0.35) : cols[i % 4];
        const ng = g.createRadialGradient(x, y, 0, x, y, rad);
        ng.addColorStop(0, rgba(col, p.light ? 0.07 : 0.09)); ng.addColorStop(1, rgba(col, 0));
        g.fillStyle = ng; g.fillRect(0, 0, W, H);
      }
      g.globalCompositeOperation = "source-over";
    }
    if (th.ambience === "horizon" && !p.mono) {
      g.save(); g.translate(W * 0.5, H * 1.08); g.scale(1, 0.35);
      const hg = g.createRadialGradient(0, 0, 0, 0, 0, W * 0.75), hc = p.light ? mix(th.nebula, "#ffffff", 0.3) : th.nebula;
      hg.addColorStop(0, rgba(hc, p.light ? 0.35 : 0.5)); hg.addColorStop(0.4, rgba(hc, 0.15)); hg.addColorStop(1, rgba(hc, 0));
      g.globalCompositeOperation = p.light ? "multiply" : "lighter"; g.fillStyle = hg; g.fillRect(-W, -W * 3, W * 2, W * 6);
      g.restore();
    }
    if (p.neon) {
      const hy = H * 0.68, hg = g.createLinearGradient(0, hy - H * 0.25, 0, hy + 4);
      hg.addColorStop(0, "rgba(255,61,242,0)"); hg.addColorStop(0.8, rgba(p.grid, 0.18)); hg.addColorStop(1, rgba("#ffb36b", 0.35));
      g.fillStyle = hg; g.fillRect(0, hy - H * 0.25, W, H * 0.25 + 4);
      g.fillStyle = "rgba(4,0,8,0.82)"; g.fillRect(0, hy, W, H - hy);
      g.fillStyle = rgba(p.grid, 0.9); g.fillRect(0, hy - 1, W, 2);
    }
    const n = Math.round((W * H) / 2400);
    for (let i = 0; i < n; i++) {
      const x = r() * W, y = r() * H, s = r() < 0.06 ? 1.5 : 0.5 + r() * 0.6;
      if (p.neon && y > H * 0.66) continue;
      g.globalAlpha = (p.light ? 0.2 : 0.35) * (0.3 + r() * 0.7);
      g.fillStyle = p.stars[i % p.stars.length];
      g.fillRect(x, y, s, s);
    }
    g.globalAlpha = 1;
    if (p.skin === "daylight") {
      g.strokeStyle = rgba(p.ink, 0.05); g.lineWidth = 0.6;
      for (let i = 0; i < 260; i++) {
        const x = r() * W, y = r() * H, a = r() * TAU, l = 4 + r() * 14;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
      }
    }
    if (p.mono) {
      g.fillStyle = rgba(p.ink, 0.12);
      for (let i = 0; i < (W * H) / 900; i++) g.fillRect(r() * W, r() * H, 0.8, 0.8);
    }
    const vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.78);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, p.light ? rgba(p.ink, 0.06) : "rgba(0,0,0,0.42)");
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
    S.bgC = c;

    const rs = mulberry32(7), ns = Math.round((W * H) / 5200);
    S.stars = [];
    for (let i = 0; i < ns; i++) {
      const y = rs() * H;
      if (p.neon && y > H * 0.66) continue;
      S.stars.push({ x: rs() * W, y: y, r: rs() < 0.08 ? 1.7 : 0.5 + rs() * 0.8, tw: rs() * 6, d: 0.2 + rs() * 0.8, c: p.stars[Math.floor(rs() * p.stars.length)] });
    }
  }

  function stripSprite(hex) {
    const key = "strip" + hex;
    let c = S.sprites.get(key);
    if (!c) {
      c = mkCanvas(4, 256);
      const g = c.getContext("2d"), gr = g.createLinearGradient(0, 0, 0, 256);
      gr.addColorStop(0, rgba(hex, 0)); gr.addColorStop(0.6, rgba(hex, 0.35)); gr.addColorStop(0.93, rgba(hex, 0.9)); gr.addColorStop(1, rgba(hex, 0));
      g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
      S.sprites.set(key, c);
    }
    return c;
  }

  function cloudSprite(i, hexes, mono) {
    const n = 320, c = mkCanvas(n, n), g = c.getContext("2d"), r = mulberry32(300 + i * 17);
    if (mono) {
      g.fillStyle = S.pal.ink;
      for (let k = 0; k < 2600; k++) {
        const a = r() * TAU, d = Math.pow(r(), 0.7) * n * 0.48, sw = Math.sin(a * 3 + d * 0.04) * 20;
        g.globalAlpha = 0.5 * (1 - d / (n * 0.5));
        g.fillRect(n / 2 + Math.cos(a) * d + sw, n / 2 + Math.sin(a) * d * 0.7, 1, 1);
      }
      return c;
    }
    for (let k = 0; k < 9; k++) {
      const x = n * (0.25 + r() * 0.5), y = n * (0.25 + r() * 0.5), rad = n * (0.12 + r() * 0.3), col = hexes[k % hexes.length];
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, rgba(col, 0.28)); gr.addColorStop(0.5, rgba(col, 0.1)); gr.addColorStop(1, rgba(col, 0));
      g.fillStyle = gr; g.fillRect(0, 0, n, n);
    }
    g.globalCompositeOperation = "destination-out";
    for (let k = 0; k < 5; k++) {
      const x = n * r(), y = n * r(), rad = n * (0.05 + r() * 0.12);
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, "rgba(0,0,0,0.5)"); gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr; g.fillRect(0, 0, n, n);
    }
    return c;
  }

  function gearSprite(R, teeth, hex, seed) {
    const D = Math.min(S.DPR, 1.5), n = Math.ceil(R * 2 + 8), c = mkCanvas(n * D, n * D), g = c.getContext("2d"), r = mulberry32(seed);
    g.scale(D, D); g.translate(n / 2, n / 2);
    g.strokeStyle = hex; g.fillStyle = hex; g.lineCap = "round";
    g.globalAlpha = 0.5; g.lineWidth = 2;
    g.beginPath();
    for (let i = 0; i < teeth; i++) {
      const a0 = (i / teeth) * TAU, a1 = ((i + 0.5) / teeth) * TAU, a2 = ((i + 1) / teeth) * TAU;
      g.arc(0, 0, Math.max(0, R - 8), a0, a0 + (a1 - a0) * 0.2);
      g.lineTo(Math.cos(a0 + (a1 - a0) * 0.35) * R, Math.sin(a0 + (a1 - a0) * 0.35) * R);
      g.lineTo(Math.cos(a1 - (a1 - a0) * 0.1) * R, Math.sin(a1 - (a1 - a0) * 0.1) * R);
      g.lineTo(Math.cos(a1 + (a2 - a1) * 0.05) * (R - 8), Math.sin(a1 + (a2 - a1) * 0.05) * (R - 8));
      g.arc(0, 0, Math.max(0, R - 8), a1 + (a2 - a1) * 0.05, a2);
    }
    g.closePath(); g.stroke();
    g.globalAlpha = 0.35; g.lineWidth = 1.2;
    for (const f of [0.86, 0.62, 0.3]) { g.beginPath(); g.arc(0, 0, R * f, 0, TAU); g.stroke(); }
    g.globalAlpha = 0.4;
    for (let i = 0; i < 120; i++) {
      const a = (i / 120) * TAU, l = i % 10 === 0 ? 14 : i % 5 === 0 ? 8 : 4;
      g.beginPath(); g.moveTo(Math.cos(a) * R * 0.86, Math.sin(a) * R * 0.86); g.lineTo(Math.cos(a) * (R * 0.86 - l), Math.sin(a) * (R * 0.86 - l)); g.stroke();
    }
    const spokes = 3 + Math.floor(r() * 4);
    g.globalAlpha = 0.28; g.lineWidth = 3;
    for (let i = 0; i < spokes; i++) {
      const a = (i / spokes) * TAU;
      g.beginPath(); g.moveTo(Math.cos(a) * R * 0.3, Math.sin(a) * R * 0.3); g.lineTo(Math.cos(a) * R * 0.62, Math.sin(a) * R * 0.62); g.stroke();
    }
    g.globalAlpha = 0.3; g.lineWidth = 1;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      g.beginPath(); g.arc(Math.cos(a) * R * 0.74, Math.sin(a) * R * 0.74, 3, 0, TAU); g.stroke();
    }
    return { c: c, n: n };
  }

  function buildAmbience() {
    const th = S.theme, p = S.pal, W = S.W, H = S.H, r = mulberry32(hashSeed(th.ambience + W + "x" + H));
    const cols = p.amb, A = { kind: th.ambience };
    if (A.kind === "fireflies") {
      A.flies = [];
      for (let i = 0; i < 46; i++) A.flies.push({ x: r(), y: r(), sp: 0.08 + r() * 0.18, ph: r() * TAU, ax: 30 + r() * 70, bs: 0.6 + r() * 1.6, c: i % 3 === 0 ? cols[2] : i % 3 === 1 ? mix(cols[1], "#fff6a8", 0.5) : "#fff2b0" });
      A.bokeh = [];
      for (let i = 0; i < 12; i++) A.bokeh.push({ x: r(), y: r(), r: 40 + r() * 110, sp: 0.05 + r() * 0.1, ph: r() * TAU, a: 0.08 + r() * 0.12, c: cols[i % 3] });
    } else if (A.kind === "aurora") {
      A.ribbons = [0, 1, 2].map((i) => ({ c: cols[i], y: 0.14 + i * 0.1, h: 0.2 + r() * 0.12, s1: 0.12 + r() * 0.1, s2: 0.2 + r() * 0.2, s3: 0.4 + r() * 0.5, ph: r() * TAU, a: 0.5 - i * 0.1 }));
      A.snow = [];
      for (let i = 0; i < 40; i++) A.snow.push({ x: r(), y: r(), sp: 8 + r() * 18, ph: r() * TAU, s: 0.8 + r() * 1.4 });
    } else if (A.kind === "nebula") {
      A.clouds = [];
      for (let i = 0; i < 5; i++) A.clouds.push({ spr: cloudSprite(i, [cols[i % 3], cols[(i + 1) % 3]], p.mono), x: r(), y: r(), sz: 0.55 + r() * 0.55, rot: r() * TAU, w: (r() < 0.5 ? -1 : 1) * (0.015 + r() * 0.03), s: 0.03 + r() * 0.04, ph: r() * TAU, a: 0.55 + r() * 0.4 });
      A.dust = [];
      for (let i = 0; i < 60; i++) A.dust.push({ x: r(), y: r(), a: r() * TAU, rr: 0.05 + r() * 0.4, sp: 0.01 + r() * 0.03, c: cols[i % 3] });
    } else if (A.kind === "clockwork") {
      const m = Math.min(W, H), col = p.mono ? p.ink : p.light ? mix(cols[0], p.ink, 0.4) : cols[1];
      A.gears = [
        { g: gearSprite(m * 0.55, 72, col, 1), x: 0.74, y: 0.58, w: 0.035, k: 0 },
        { g: gearSprite(m * 0.3, 40, col, 2), x: 0.16, y: 0.26, w: -0.07, k: 1 },
        { g: gearSprite(m * 0.2, 28, col, 3), x: 0.36, y: 0.86, w: 0.11, k: 2 },
      ];
    } else if (A.kind === "horizon") {
      A.embers = [];
      for (let i = 0; i < 70; i++) A.embers.push({ x: r() * W, y: r() * H, vy: 14 + r() * 40, vx: -6 + r() * 12, s: 0.8 + r() * 2, ph: r() * TAU, c: i % 2 ? cols[0] : cols[2] });
    }
    S.amb = A;
  }

  function rebuildLayers() {
    if (!S.ctx) return;
    buildPalette();
    buildBg();
    buildAmbience();
  }

  const WALL_R = 80, WALL_MIN = 3, WALL_PULL = 280;

  function findWalls(B) {
    const sim = Sim(), slack = sim.SEED_R * 2 + 3, ok = B.map((b) => b.kind === "barren" && !b.orbit && !b.shield && b.r <= WALL_R);
    const up = B.map((_, i) => i), root = (i) => (up[i] === i ? i : (up[i] = root(up[i]))), edges = [];
    for (let i = 0; i < B.length; i++) {
      if (!ok[i]) continue;
      for (let j = i + 1; j < B.length; j++) {
        if (!ok[j]) continue;
        const gap = Math.hypot(B[i].x - B[j].x, B[i].y - B[j].y) - B[i].r - B[j].r;
        if (gap > slack || gap < -Math.min(B[i].r, B[j].r)) continue;
        edges.push([i, j]);
        up[root(i)] = root(j);
      }
    }
    const groups = new Map();
    for (const e of edges) {
      const k = root(e[0]);
      if (!groups.has(k)) groups.set(k, { idx: [], edges: [] });
      groups.get(k).edges.push(e);
    }
    const walls = [];
    groups.forEach((g) => {
      const set = new Set();
      g.edges.forEach((e) => { set.add(e[0]); set.add(e[1]); });
      g.idx = Array.from(set);
      if (g.idx.length < WALL_MIN) return;
      const m = g.idx.reduce((a, i) => a + Math.max(0, sim.massOf(B[i])), 0) / g.idx.length;
      g.halo = clamp(Math.sqrt(m / WALL_PULL), 10, 120);
      g.rm = g.idx.reduce((a, i) => a + B[i].r, 0) / g.idx.length;
      g.idx.forEach((i) => { B[i].wall = walls.length; });
      walls.push(g);
    });
    return walls;
  }

  function prepLevel(def) {
    const lv = JSON.parse(JSON.stringify(def));
    lv.portals = lv.portals || []; lv.winds = lv.winds || []; lv.boosts = lv.boosts || []; lv.pollen = lv.pollen || [];
    lv.par = def.par != null ? def.par : 0;
    lv.stars = def.stars ? def.stars.slice(0, 2) : [lv.par, lv.par + 1];
    lv.preview = def.preview || 1.2;
    lv.bodies.forEach((b, i) => {
      b.need = b.kind === "fertile" ? (b.need || 1) : 0;
      b.got = 0; b.plants = [];
      const rnd = mulberry32(i * 977 + Math.round(b.r * 13) + 7);
      b.spots = [];
      for (let k = 0; k < Math.round(b.r / 7) + 2; k++) {
        const a = rnd() * TAU, d = Math.sqrt(rnd()) * b.r * 0.8;
        b.spots.push([Math.cos(a) * d, Math.sin(a) * d, 2 + rnd() * b.r * 0.12]);
      }
      b.facets = [];
      const nf = 7 + Math.floor(rnd() * 3), off = rnd() * TAU, cx = (rnd() - 0.5) * b.r * 0.4, cy = (rnd() - 0.5) * b.r * 0.4;
      for (let k = 0; k < nf; k++) b.facets.push({ a: off + (k / nf) * TAU + (rnd() - 0.5) * 0.3, s: rnd() });
      b.fc = [cx, cy];
      b.phase = rnd() * 10;
      b.tilt = (rnd() - 0.5) * 1.2;
      b.wob = { t: 9, amp: 0, ang: 0 };
      b.flash = 0; b.shHit = null;
      if (b.kind === "blackhole") {
        b.motes = [];
        for (let k = 0; k < 26; k++) b.motes.push({ a: rnd() * TAU, d: b.r * (1.6 + rnd() * 5), s: 0.6 + rnd() * 1.2 });
      }
    });
    lv.walls = findWalls(lv.bodies);
    lv.fx = { portal: lv.portals.map(() => ({ flare: 0 })), boost: lv.boosts.map(() => ({ flare: 0, dir: 0 })), pollen: lv.pollen.map(() => ({ t: -1 })) };
    lv.winds.forEach((w, k) => {
      const r = mulberry32(k * 31 + 5), n = Math.round(clamp((w.w * w.h) / 6500, 10, 46));
      w.streaks = [];
      for (let i = 0; i < n; i++) w.streaks.push({ u: r(), v: r(), l: 14 + r() * 26, sp: 0.6 + r() * 0.8 });
    });
    return lv;
  }

  function makePlant(flora, r, seed) {
    const rnd = mulberry32(seed), F = FLORA[flora] || FLORA.daisy, pick = () => F.bloom[Math.floor(rnd() * F.bloom.length)];
    const p = { flora: flora, seed: seed, g: 0, bloom: 0, sway: rnd() * TAU, ang: 0 };
    if (flora === "fern") {
      const n = r > 70 ? 3 : 2;
      p.fronds = [];
      for (let i = 0; i < n; i++) {
        p.fronds.push({ a0: (i - (n - 1) / 2) * 0.6 + (rnd() - 0.5) * 0.25, L: r * 0.7 + 46 + rnd() * 14, curl: (rnd() < 0.5 ? -1 : 1) * (1.5 + rnd() * 0.9), cry: [4 + Math.floor(rnd() * 4), 9 + Math.floor(rnd() * 4)] });
      }
      p.color = F.bloom[1];
    } else if (flora === "spiral") {
      const n = 1 + (r > 60 ? 1 : 0) + (rnd() < 0.4 ? 1 : 0);
      p.vines = [];
      for (let i = 0; i < n; i++) {
        const dir = rnd() < 0.5 ? -1 : 1;
        p.vines.push({
          a0: (i - (n - 1) / 2) * 0.6 + (rnd() - 0.5) * 0.3, dir: dir, L: r * 0.95 + 64 + rnd() * 20, coil: 3.2 + rnd() * 1.4, c: pick(),
          tendrils: [{ u: 0.3 + rnd() * 0.15, dir: -dir, L: 0.3, coil: 7, c: pick() }, { u: 0.55 + rnd() * 0.15, dir: -dir, L: 0.22, coil: 8, c: pick() }],
        });
      }
      p.color = p.vines[0].c;
    } else if (flora === "sunflower") {
      const n = r > 65 ? 2 : 1;
      p.stalks = [];
      for (let i = 0; i < n; i++) {
        p.stalks.push({ H: (r * 0.42 + 32) * (i ? 0.68 : 1), lean: (i - (n - 1) / 2) * 0.55 + (rnd() - 0.5) * 0.2, bend: (rnd() - 0.5) * 0.6, hr: (6 + r * 0.07) * (i ? 0.78 : 1), tilt: (rnd() - 0.5) * 0.6, petals: 14 + Math.floor(rnd() * 5), side: rnd() < 0.5 ? -1 : 1 });
      }
      p.color = F.bloom[0];
    } else if (flora === "ember") {
      const H = r * 0.45 + 32, leaves = [];
      for (let i = 0; i < 7; i++) leaves.push({ u: 0.1 + i * 0.115, side: i % 2 ? 1 : -1, s: (1 - i * 0.09) * (11 + r * 0.08), ph: rnd() * TAU });
      p.em = { H: H, lean: (rnd() - 0.5) * 0.4, leaves: leaves, br: 5 + r * 0.06, ph: rnd() * TAU };
      p.color = F.bloom[1];
    } else {
      const segs = [], tips = [], leaves = [], maxD = 3 + Math.floor(rnd() * 2) + (r > 60 ? 1 : 0);
      const br = (x, y, ang, len, d) => {
        const x2 = x + Math.sin(ang) * len, y2 = y - Math.cos(ang) * len;
        segs.push({ x: x, y: y, x2: x2, y2: y2, d: d, w: Math.max(1, (maxD - d + 1) * 1.1) });
        if (d > 0 && d < maxD && rnd() < 0.6) leaves.push({ x: (x + x2) / 2, y: (y + y2) / 2, a: ang + (rnd() < 0.5 ? 1 : -1) * 0.9, d: d, s: 3 + rnd() * 3 });
        if (d >= maxD) { tips.push({ x: x2, y: y2, d: d, c: pick(), s: 3 + rnd() * 3, rot: rnd() * 6 }); return; }
        const n = d === 0 ? 2 : rnd() < 0.72 ? 2 : 3;
        for (let i = 0; i < n; i++) br(x2, y2, ang + (i - (n - 1) / 2) * (0.45 + rnd() * 0.35) + (rnd() - 0.5) * 0.3, len * (0.64 + rnd() * 0.16), d + 1);
      };
      br(0, 0, (rnd() - 0.5) * 0.3, r * 0.28 + 12, 0);
      Object.assign(p, { segs: segs, tips: tips, leaves: leaves, maxD: maxD });
      p.color = tips.length ? tips[0].c : F.bloom[0];
    }
    return p;
  }

  function needTotal() { return S.lv ? S.lv.bodies.reduce((s, b) => s + b.need, 0) : 0; }
  function sownCount() { return S.lv ? S.lv.bodies.reduce((s, b) => s + Math.min(b.got, b.need), 0) : 0; }
  function allSown() { return S.lv.bodies.every((b) => b.got >= b.need); }
  function pollenCount() { return S.pollenGot.filter(Boolean).length; }
  function toScreen(x, y) { const v = S.view; return [v.ox + v.s * (v.a * x + v.c * y), v.oy + v.s * (v.b * x + v.d * y)]; }
  function toWorld(sx, sy) { const v = S.view, x = (sx - v.ox) / v.s, y = (sy - v.oy) / v.s; return [v.a * x + v.b * y, v.c * x + v.d * y]; }
  function scrOff(x, y, u, w) { const v = S.view; return [x + u * v.a + w * v.b, y + u * v.c + w * v.d]; }
  function worldXf() { const v = S.view, D = S.DPR, k = D * v.s; S.ctx.setTransform(k * v.a, k * v.b, k * v.c, k * v.d, D * v.ox, D * v.oy); }

  function burst(x, y, n, colors, speed, life, size, kind, o) {
    o = o || {};
    const cap = rm() ? 220 : 700;
    if (rm()) n = Math.ceil(n / 3);
    for (let i = 0; i < n && S.parts.length < cap; i++) {
      const a = o.ang != null ? o.ang + (Math.random() - 0.5) * (o.spread || 1) : Math.random() * TAU;
      const v = speed * (0.3 + Math.random() * 0.7), l = life * (0.6 + Math.random() * 0.6);
      S.parts.push({
        x: x + (o.jit ? (Math.random() - 0.5) * o.jit : 0), y: y + (o.jit ? (Math.random() - 0.5) * o.jit : 0),
        vx: Math.cos(a) * v + (o.vx || 0), vy: Math.sin(a) * v + (o.vy || 0), life: l, max: l,
        c: colors[i % colors.length], s: size * (0.5 + Math.random()), k: kind || "dot",
        rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 10, g: o.g || 0, dr: o.dr != null ? o.dr : 0.96,
      });
    }
  }

  function ring(x, y, c, o) {
    o = o || {};
    S.rings.push({ x: x, y: y, c: c, t: -(o.delay || 0), dur: o.dur || 0.8, r0: o.r0 != null ? o.r0 : 10, r1: o.r1 != null ? o.r1 : 70, lw: o.lw || 3 });
  }

  function addShake(m) { if (S.settings.shake && !rm() && S.mode === "play") S.shake = Math.min(16, S.shake + m); }

  function wobble(b, ang, amp) { b.wob = { t: 0, amp: rm() ? amp * 0.3 : amp, ang: ang }; }

  function launch() {
    if (!S.lv || S.seed || S.seedsLeft <= 0 || S.paused) return false;
    if (S.phase === "intro") { S.phase = "play"; S.introT = S.introDur; }
    if (S.phase !== "play") return false;
    const p = S.pal, pow = S.aim.pow, lx = S.lv.launch[0], ly = S.lv.launch[1];
    S.seed = Sim().newSeed(S.lv, S.aim.ang, pow);
    S.seedT = S.T;
    S.near = { arm: -1, fired: false, th: 0, min: Infinity };
    S.trail = [];
    if (S.seedsLeft !== Infinity) S.seedsLeft--;
    S.used++;
    S.recoil = 1;
    rememberAim();
    burst(lx, ly, Math.round(8 + pow * 16), [p.seed, p.launcher, p.preview], 120 + pow * 220, 0.5, 2.2, "spark", { ang: S.aim.ang, spread: 1.1 });
    ring(lx, ly, p.launcher, { r0: 14, r1: 40 + pow * 50, dur: 0.5, lw: 2 + pow * 3 });
    addShake(1 + pow * 3);
    playEmit("launch", { used: S.used });
    sfx("launch", { power: pow });
    return true;
  }

  function pollenFly(x, y) {
    const s = toScreen(x, y), a = S.hudAnchor, tx = a ? a[0] : S.insets.left + 96, ty = a ? a[1] : Math.max(26, S.insets.top * 0.55);
    const n = rm() ? 4 : 12;
    for (let i = 0; i < n; i++) {
      S.sparts.push({ x0: s[0], y0: s[1], tx: tx, ty: ty, t: -i * 0.035, dur: 0.75 + Math.random() * 0.25, bx: s[0] + (Math.random() - 0.5) * 220, by: s[1] - 80 - Math.random() * 160, c: i % 3 ? S.pal.pollen : "#ffffff", s: 2 + Math.random() * 2.5 });
    }
  }

  function handleEvent(ev) {
    const lv = S.lv, p = S.pal, B = lv.bodies, t = ev.type;
    playEmit("event", Object.assign({ type: t }, ev));
    if (t === "bounce") {
      const b = B[ev.i], P = S.P[ev.i] || [b.x, b.y];
      sfx("bounce");
      burst(ev.x, ev.y, 12, ["#ffffff", p.ice], 170, 0.45, 2, "spark");
      ring(ev.x, ev.y, p.ice, { r1: 50, dur: 0.5 });
      wobble(b, Math.atan2(ev.y - P[1], ev.x - P[0]), 0.05);
      b.flash = 0.7;
      return;
    }
    if (t === "warp") {
      const c = p.portals[ev.k % 3];
      sfx("warp");
      burst(ev.from[0], ev.from[1], 16, [c, "#ffffff"], 200, 0.5, 2, "spark");
      burst(ev.to[0], ev.to[1], 16, [c, "#ffffff"], 200, 0.5, 2, "spark");
      ring(ev.to[0], ev.to[1], c, { r1: 80, dur: 0.6 });
      ring(ev.from[0], ev.from[1], c, { r0: 60, r1: 4, dur: 0.4 });
      lv.fx.portal[ev.k].flare = 1;
      return;
    }
    if (t === "boost") {
      const f = lv.fx.boost[ev.k], s = S.seed, dir = s ? Math.atan2(s.vy, s.vx) : 0;
      f.flare = 1; f.dir = dir;
      sfx("boost");
      burst(ev.x, ev.y, 18, [p.boost, "#ffffff", p.trail], 260, 0.45, 2.2, "spark", { ang: dir + Math.PI, spread: 0.9 });
      ring(ev.x, ev.y, p.boost, { r0: 20, r1: 70, dur: 0.45, lw: 4 });
      addShake(2);
      return;
    }
    if (t === "pollen") {
      S.pollenGot[ev.k] = true;
      lv.fx.pollen[ev.k].t = 0;
      sfx("pollen", { k: ev.k });
      burst(ev.x, ev.y, 16, [p.pollen, "#ffffff", S.theme.glow], 150, 0.6, 2, "spark");
      ring(ev.x, ev.y, p.pollen, { r1: 46, dur: 0.5, lw: 2 });
      pollenFly(ev.x, ev.y);
      toast("pollen", "good");
      emitHud();
      return;
    }
    S.seed = null; S.tapFast = false; S.ffPress = null;
    if (S.demo) S.demo.res.push(t === "plant" && B[ev.i].got >= B[ev.i].need ? "full" : t);
    if (t === "plant") {
      const b = B[ev.i], counts = b.got < b.need;
      if (counts) b.got++;
      const pl = makePlant(S.theme.flora, b.r, (Math.random() * 1e9) | 0);
      pl.ang = ev.ang;
      b.plants.push(pl);
      if (b.plants.length > 9) b.plants.shift();
      wobble(b, ev.ang, 0.1);
      b.flash = 1;
      if (!rm()) S.hitstop = 0.08;
      addShake(5);
      const F = FLORA[S.theme.flora] || FLORA.daisy;
      burst(ev.x, ev.y, 26, F.bloom, 200, 1, 3, "petal", { dr: 0.95 });
      burst(ev.x, ev.y, 10, [F.leaf, F.stem], 120, 0.8, 2.5, "dot");
      ring(ev.x, ev.y, pl.color, { r1: 95, dur: 0.8 });
      ring(ev.x, ev.y, p.fert, { r1: 55, dur: 0.6, delay: 0.1, lw: 2 });
      const total = B.reduce((s, x) => s + x.plants.length, 0);
      sfx("plant", { count: total });
      toast(counts ? (b.got >= b.need && b.need > 1 ? "sated" : "sown") : "full", counts ? "good" : "info");
    } else if (t === "burn") {
      const b = B[ev.i];
      if (!rm()) S.hitstop = 0.06;
      addShake(8);
      b.flash = 1;
      burst(ev.x, ev.y, 32, [p.sunCore, p.sun, "#ffffff", p.sunDark], 280, 0.7, 2.5, "spark");
      burst(ev.x, ev.y, 10, ["#3a2a2a", "#6a4a3a"], 60, 1.4, 3, "dot", { g: -30, dr: 0.99 });
      ring(ev.x, ev.y, p.sunCore, { r1: 110, dur: 0.7, lw: 5 });
      toast("burn", "bad");
      sfx("burn");
    } else if (t === "crash") {
      const b = B[ev.i];
      addShake(6);
      wobble(b, ev.ang, 0.05);
      b.flash = 0.6;
      const cols = b.kind === "repulsor" ? [p.rep, "#ffffff", p.repDark] : [p.barren, p.crater, p.paper];
      burst(ev.x, ev.y, 18, cols, 170, 0.8, 3, "shard", { ang: ev.ang, spread: 2.2 });
      ring(ev.x, ev.y, cols[0], { r1: 70, dur: 0.6 });
      toast(b.kind === "repulsor" ? "repel" : "crash", "bad");
      sfx("crash");
    } else if (t === "swallow") {
      const b = B[ev.i], P = S.P[ev.i] || [ev.x, ev.y], n = rm() ? 10 : 34;
      addShake(4);
      for (let i = 0; i < n && S.parts.length < 700; i++) {
        const a = Math.random() * TAU, d = b.r * (3 + Math.random() * 3), l = 0.5 + Math.random() * 0.4;
        S.parts.push({ x: P[0] + Math.cos(a) * d, y: P[1] + Math.sin(a) * d, vx: -Math.cos(a) * d / l + Math.sin(a) * 60, vy: -Math.sin(a) * d / l - Math.cos(a) * 60, life: l, max: l, c: i % 2 ? p.bhDisk : p.bhRing, s: 2, k: "spark", rot: 0, vr: 0, g: 0, dr: 1 });
      }
      ring(P[0], P[1], p.bhDisk, { r0: b.r * 7, r1: b.r, dur: 0.6, lw: 4 });
      toast("swallow", "bad");
      sfx("swallow");
    } else if (t === "shield") {
      const b = B[ev.i];
      b.shHit = { ang: ev.ang, t: 0 };
      addShake(4);
      burst(ev.x, ev.y, 22, [p.shield, "#ffffff", S.theme.glow], 200, 0.6, 3, "shard", { ang: ev.ang, spread: 2.6 });
      ring(ev.x, ev.y, p.shield, { r1: 60, dur: 0.5, lw: 3 });
      toast("shield", "bad");
      sfx("shield");
    } else if (t === "lost") {
      toast("lost", "info");
      sfx("lost");
    }
    checkEnd();
    emitHud();
  }

  function checkEnd() {
    if (allSown()) {
      S.phase = "celebrate"; S.phaseT = 0; S.emitted = false;
      const F = FLORA[S.theme.flora] || FLORA.daisy;
      S.lv.bodies.forEach((b, i) => {
        if (b.kind !== "fertile") return;
        const P = S.P[i] || [b.x, b.y];
        ring(P[0], P[1], F.bloom[i % F.bloom.length], { r0: b.r, r1: b.r + 120, dur: 1, delay: 0.1 + i * 0.08, lw: 4 });
        wobble(b, -Math.PI / 2, 0.06);
      });
      S.flash = rm() ? 0 : 0.35;
    } else if (S.seedsLeft <= 0 && !S.demo) {
      S.phase = "lose"; S.phaseT = 0; S.emitted = false;
    }
  }

  function ymd() {
    const d = new Date();
    return "" + d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0");
  }

  function finishWin() {
    const lv = S.lv, def = S.def, plants = [];
    lv.bodies.forEach((b) => b.plants.forEach((pl) => plants.push({ flora: pl.flora, color: pl.color })));
    if (S.mode !== "play" || S.demo) return;
    if (S.ctxMode === "zen") { emit("zenComplete", { seed: def.seed != null ? def.seed : def.id, used: S.used }); return; }
    let id = def.id;
    if (S.ctxMode === "daily" && String(id).indexOf("daily-") !== 0) id = "daily-" + ymd();
    const stars = S.used <= lv.stars[0] ? 3 : S.used <= lv.stars[1] ? 2 : 1;
    emit("win", { levelId: id, used: S.used, par: lv.par, starAt: lv.stars, stars: stars, pollenGot: pollenCount(), pollenTotal: lv.pollen.length, time: Math.round(S.clock * 10) / 10, plants: plants });
  }

  function updatePhase(dt) {
    if (S.phase === "intro") {
      S.introT += dt;
      if (S.introT >= S.introDur) S.phase = "play";
    } else if (S.phase === "celebrate") {
      S.phaseT += dt;
      if (S.phaseT < 1.1) spawnConfetti(dt);
      if (S.phaseT >= 1.5 && !S.emitted) { S.emitted = true; S.phase = "won"; finishWin(); }
    } else if (S.phase === "lose") {
      S.phaseT += dt;
      S.fade = Math.min(1, S.phaseT / 1.1);
      if (S.phaseT >= 1.1 && !S.emitted) {
        S.emitted = true; S.phase = "lost";
        playEmit("lose", { levelId: S.def.id, sown: sownCount(), needTotal: needTotal(), used: S.used, reason: "seeds" });
      }
    }
  }

  function spawnConfetti(dt) {
    const F = FLORA[S.theme.flora] || FLORA.daisy, n = Math.round((rm() ? 20 : 90) * dt * 2), v = S.view, side = Math.abs(v.b) > 0.5;
    const hd = side ? WORLD_W / 2 : WORLD_H / 2, ha = side ? WORLD_H / 2 : WORLD_W / 2;
    for (let i = 0; i < n && S.parts.length < 700; i++) {
      const l = 2.2 + Math.random() * 1.2, u = (Math.random() - 0.5) * 2 * ha, w = -hd - 30 - Math.random() * 60, vu = (Math.random() - 0.5) * 60, vw = 90 + Math.random() * 120;
      S.parts.push({ x: WORLD_W / 2 + u * v.a + w * v.b, y: WORLD_H / 2 + u * v.c + w * v.d, vx: vu * v.a + vw * v.b, vy: vu * v.c + vw * v.d, life: l, max: l, c: F.bloom[i % F.bloom.length], s: 4 + Math.random() * 4, k: "confetti", rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 8, g: 30, dr: 0.995 });
    }
  }

  const ESC_EPS = 20, ESC_K = 1.5, ESC_PAD = 40, ESC_FAR = 400;

  function axisLost(B, P, pos, vel, side, lim, tLeft) {
    const sim = Sim();
    let x = side < 0 ? -pos : pos - lim, v = side * vel;
    if (v <= 0) return false;
    const off = B.map((b, i) => (b.orbit ? 0 : side < 0 ? P[i] : lim - P[i])), ms = B.map((b) => Math.max(0, sim.massOf(b)));
    for (let t = 0; t < tLeft;) {
      const h = clamp(x / 1500, 1 / 60, 0.2);
      let a = 0;
      for (let i = 0; i < B.length; i++) if (ms[i]) { const u = x + off[i]; a += ms[i] / (u * u + ESC_EPS * ESC_EPS); }
      v -= ESC_K * a * h; x += v * h; t += h;
      if (x <= 0) return false;
      if (x >= ESC_FAR) return true;
    }
    return true;
  }

  function escaping(lv, s, T) {
    const outX = s.x < -ESC_PAD ? -1 : s.x > WORLD_W + ESC_PAD ? 1 : 0, outY = s.y < -ESC_PAD ? -1 : s.y > WORLD_H + ESC_PAD ? 1 : 0;
    if (!outX && !outY) return false;
    for (const w of lv.winds || []) if (w.x < 0 || w.y < 0 || w.x + w.w > WORLD_W || w.y + w.h > WORLD_H) return false;
    const sim = Sim(), B = lv.bodies, P = sim.positions(B, T), tLeft = sim.FLIGHT_MAX - s.t;
    if (outX && axisLost(B, P.map((q) => q[0]), s.x, s.vx, outX, WORLD_W, tLeft)) return true;
    if (outY && axisLost(B, P.map((q) => q[1]), s.y, s.vy, outY, WORLD_H, tLeft)) return true;
    if ((s.x - WORLD_W / 2) * s.vx + (s.y - WORLD_H / 2) * s.vy <= 0) return false;
    let bind = 0;
    for (let i = 0; i < B.length; i++) {
      const m = sim.massOf(B[i]);
      if (m > 0) bind += (m / ESC_EPS) * (Math.PI / 2 - Math.atan(Math.hypot(s.x - P[i][0], s.y - P[i][1]) / ESC_EPS));
    }
    return 0.5 * (s.vx * s.vx + s.vy * s.vy) > ESC_K * bind;
  }

  function nearTrack(s) {
    const n = S.near, B = S.lv.bodies;
    for (let i = 0; i < B.length; i++) {
      const b = B[i];
      if (b.kind !== "fertile" || b.got >= b.need || (n.arm >= 0 && n.arm !== i)) continue;
      const p = Sim().bodyPos(B, i, S.seedT), c = Math.hypot(s.x - p[0], s.y - p[1]) - b.r - Sim().SEED_R, th = Math.max(18, b.r * 0.6);
      if (n.arm < 0 && !n.fired && c < th) { n.arm = i; n.th = th; n.min = c; }
      else if (n.arm === i) { n.min = Math.min(n.min, c); if (c > n.th + 24 && !n.fired) nearEmit(); }
    }
  }

  function nearEmit() {
    const n = S.near;
    n.fired = true;
    playEmit("event", { type: "near", i: n.arm, clearance: Math.round(Math.max(0, n.min) * 10) / 10 });
  }

  function stepFlight() {
    S.seedT += DT;
    const s = S.seed, ev = Sim().stepSeed(S.lv, s, S.seedT, DT, S.pollenGot);
    if (ev && ev.type === "warp") { S.trail.push(null); S.trailN++; }
    S.trail.push([s.x, s.y]);
    S.trailN++;
    if (S.trail.length > 110) S.trail.shift();
    if (S.settings.trail === "ember" && !rm() && Math.random() < 0.14 && S.parts.length < 700) {
      const a = Math.random() * TAU, l = 0.5 + Math.random() * 0.5;
      S.parts.push({ x: s.x, y: s.y, vx: Math.cos(a) * 25 - s.vx * 0.05 - 30 * S.view.b, vy: Math.sin(a) * 25 - s.vy * 0.05 - 30 * S.view.d, life: l, max: l, c: Math.random() < 0.5 ? "#ffb347" : "#ff4d2e", s: 1.4, k: "ember", rot: 0, vr: 0, g: -20, dr: 0.98 });
    }
    if (ev && Sim().TERMINAL[ev.type] && S.near.arm >= 0 && !S.near.fired && ev.type !== "plant") nearEmit();
    else if (!ev || !Sim().TERMINAL[ev.type]) nearTrack(s);
    if (ev) handleEvent(ev);
    else if ((S.trailN & 7) === 0 && escaping(S.lv, s, S.seedT)) handleEvent({ type: "lost", x: s.x, y: s.y });
  }

  function updateFx(sdt, dt) {
    const lv = S.lv, F = FLORA[S.theme.flora] || FLORA.daisy, blooming = S.phase === "celebrate" || S.phase === "won";
    lv.bodies.forEach((b, i) => {
      for (const pl of b.plants) {
        pl.g = Math.min(1, pl.g + sdt / 1.8);
        if (blooming) pl.bloom = Math.min(1, pl.bloom + dt / 0.9);
        if (pl.flora === "ember" && pl.g > 0.8 && Math.random() < dt * (rm() ? 0.4 : 1.6) && S.parts.length < 700) {
          const P = S.P[i] || [0, 0], d = b.r + pl.em.H * 0.95, a = pl.ang + pl.em.lean * 0.4;
          S.parts.push({ x: P[0] + Math.cos(a) * d, y: P[1] + Math.sin(a) * d, vx: Math.cos(pl.ang) * 40 + (Math.random() - 0.5) * 20, vy: Math.sin(pl.ang) * 40 + (Math.random() - 0.5) * 20, life: 1.2, max: 1.2, c: F.bloom[Math.floor(Math.random() * 3)], s: 1.6, k: "ember", rot: 0, vr: 0, g: 0, dr: 0.99 });
        }
      }
      b.wob.t += sdt;
      if (b.flash > 0) b.flash = Math.max(0, b.flash - dt * 2.5);
      if (b.shHit) { b.shHit.t += dt; if (b.shHit.t > 0.6) b.shHit = null; }
      if (b.motes) {
        for (const m of b.motes) {
          m.d -= (18 + (b.r * 90) / m.d) * sdt * m.s;
          m.a += (0.6 + (b.r * 9) / m.d) * sdt;
          if (m.d < b.r * 1.15) { m.d = b.r * (4.5 + Math.random() * 2.5); m.a = Math.random() * TAU; }
        }
      }
    });
    for (const f of lv.fx.portal) f.flare = Math.max(0, f.flare - dt * 2);
    for (const f of lv.fx.boost) f.flare = Math.max(0, f.flare - dt * 2.2);
    for (const f of lv.fx.pollen) if (f.t >= 0) f.t += dt;

    const ps = S.parts;
    let w = 0;
    for (let i = 0; i < ps.length; i++) {
      const q = ps[i];
      q.life -= sdt;
      if (q.life <= 0) continue;
      const damp = 1 - (1 - q.dr) * sdt * 60;
      q.vx *= damp; q.vy *= damp; q.vx += q.g * sdt * S.view.b; q.vy += q.g * sdt * S.view.d;
      q.x += q.vx * sdt; q.y += q.vy * sdt; q.rot += q.vr * sdt;
      ps[w++] = q;
    }
    ps.length = w;
    for (const r of S.rings) r.t += sdt;
    S.rings = S.rings.filter((r) => r.t < r.dur);
    for (const q of S.sparts) q.t += dt;
    S.sparts = S.sparts.filter((q) => q.t < q.dur);
    if (!S.seed && S.trail.length) S.trail.splice(0, 3);
    S.recoil = Math.max(0, S.recoil - dt * 2.5);
    S.flash = Math.max(0, S.flash - dt * 1.2);
    S.fadeIn = Math.max(0, S.fadeIn - dt * 2.2);
    if (S.drag && S.drag.moved && S.aim.pow > 0.5 && !rm() && Math.random() < (S.aim.pow - 0.4) * dt * 30 && ps.length < 700) {
      const a = Math.random() * TAU, d = 70 + Math.random() * 30, lx = lv.launch[0], ly = lv.launch[1], l = 0.4;
      ps.push({ x: lx + Math.cos(a) * d, y: ly + Math.sin(a) * d, vx: -Math.cos(a) * d / l, vy: -Math.sin(a) * d / l, life: l, max: l, c: S.aim.pow > 0.85 ? "#ffffff" : S.pal.preview, s: 1.6, k: "spark", rot: 0, vr: 0, g: 0, dr: 1 });
    }
  }

  function updateAmbience(dt) {
    const A = S.amb;
    if (!A) return;
    const k = rm() ? 0.35 : 1;
    if (A.embers) {
      for (const e of A.embers) {
        e.y += e.vy * dt * k; e.x += (e.vx + Math.sin(S.ambT + e.ph) * 8) * dt * k;
        if (e.y > S.H + 10) { e.y = -10; e.x = Math.random() * S.W; }
      }
    }
    if (A.snow) {
      for (const s of A.snow) { s.y += (s.sp * dt * k) / Math.max(1, S.H); if (s.y > 1.02) s.y = -0.02; }
    }
  }

  function updateCamera(dt) {
    let tz = 1, tx = WORLD_W / 2, ty = WORLD_H / 2;
    if (S.mode === "play" && !rm()) {
      if (S.seed) {
        tz = 1.07; tx = lerp(tx, S.seed.x, 0.22); ty = lerp(ty, S.seed.y, 0.22);
      } else if (S.phase === "celebrate" || S.phase === "won") {
        let cx = 0, cy = 0, n = 0;
        S.lv.bodies.forEach((b, i) => { if (b.kind === "fertile") { cx += S.P[i][0]; cy += S.P[i][1]; n++; } });
        if (n) { tx = lerp(tx, cx / n, 0.3); ty = lerp(ty, cy / n, 0.3); }
        tz = 1.06;
      } else if (S.phase === "intro") {
        tz = lerp(0.94, 1, smooth(clamp(S.introT / S.introDur, 0, 1)));
      }
    } else if (S.mode === "showcase") {
      tz = rm() ? 1.03 : 1.04 + Math.sin(S.ambT * 0.1) * 0.02;
      if (!rm()) { tx += Math.sin(S.ambT * 0.07) * 40; ty += Math.cos(S.ambT * 0.05) * 25; }
    }
    tx = clamp(tx, 500, 1100); ty = clamp(ty, 320, 680);
    const k = 1 - Math.exp(-dt * (S.phase === "intro" ? 6 : 2.2)), c = S.cam;
    c.z += (tz - c.z) * k; c.x += (tx - c.x) * k; c.y += (ty - c.y) * k;
    S.shake *= Math.exp(-dt * 9);
    computeView();
  }

  const ROT_ON = 1.12, ROT_OFF = 1.04;
  const ROT_M = { "0": [1, 0, 0, 1], "1": [0, -1, 1, 0], "-1": [0, 1, -1, 0] };

  function computeView() {
    const s = S.fit.s * S.cam.z, m = ROT_M[S.rot];
    let ox = S.fit.cx - s * (m[0] * S.cam.x + m[2] * S.cam.y), oy = S.fit.cy - s * (m[1] * S.cam.x + m[3] * S.cam.y);
    if (S.shake > 0.05) { ox += (Math.random() - 0.5) * 2 * S.shake; oy += (Math.random() - 0.5) * 2 * S.shake; }
    S.view = { s: s, ox: ox, oy: oy, a: m[0], b: m[1], c: m[2], d: m[3], th: S.rot ? -S.rot * Math.PI / 2 : 0 };
  }

  function rotFor(aw, ah) {
    const wide = Math.min(aw / WORLD_W, ah / WORLD_H), tall = Math.min(aw / WORLD_H, ah / WORLD_W);
    if (!(tall > wide * (S.rot ? ROT_OFF : ROT_ON))) return 0;
    return S.lv && S.lv.launch[0] > WORLD_W * 0.6 ? -1 : 1;
  }

  function refit() {
    const r = S.mode === "play" ? S.insets : { top: 0, right: 0, bottom: 0, left: 0 }, pad = S.W < 560 ? 6 : 14;
    const aw = Math.max(40, S.W - r.left - r.right - pad * 2), ah = Math.max(40, S.H - r.top - r.bottom - pad * 2);
    const rot = S.mode === "play" ? rotFor(aw, ah) : rotFor(S.W, S.H);
    if (rot !== S.rot) { S.rot = rot; S.drag = null; emit("view", { rotated: rot !== 0, rot: rot }); }
    const fw = rot ? WORLD_H : WORLD_W, fh = rot ? WORLD_W : WORLD_H;
    let s = Math.min(aw / fw, ah / fh);
    if (S.mode !== "play") s = Math.min(S.W / fw, S.H / fh) * 1.02;
    S.fit = { s: s, cx: r.left + pad + aw / 2, cy: r.top + pad + ah / 2 };
    computeView();
  }

  function aimSfx() { if (S.time - S.aimSfxT > 0.09) { S.aimSfxT = S.time; sfx("aim"); } }

  function canAim() {
    return S.mode === "play" && !S.demo && S.inputEnabled && !S.paused && S.lv && (S.phase === "play" || S.phase === "intro") && !S.seed && S.seedsLeft > 0;
  }

  function keyAim(dt) {
    if (!canAim() || S.drag) return;
    const k = S.keys, fine = k.has("Shift") ? 0.25 : 1;
    let ch = false;
    if (k.has("ArrowLeft")) { S.aim.ang -= 1.6 * dt * fine; ch = true; }
    if (k.has("ArrowRight")) { S.aim.ang += 1.6 * dt * fine; ch = true; }
    if (k.has("ArrowUp")) { S.aim.pow = clamp(S.aim.pow + 0.5 * dt * fine, 0.05, 1); ch = true; }
    if (k.has("ArrowDown")) { S.aim.pow = clamp(S.aim.pow - 0.5 * dt * fine, 0.05, 1); ch = true; }
    if (!ch) return;
    if (S.aim.ang > Math.PI) S.aim.ang -= TAU;
    if (S.aim.ang < -Math.PI) S.aim.ang += TAU;
    rememberAim();
    aimSfx();
  }

  function hudPayload() {
    const lv = S.lv, deg = (((-(S.aim.ang + S.view.th) * 180) / Math.PI) % 360 + 360) % 360;
    return {
      seedsLeft: S.seedsLeft, seeds: S.seeds, used: S.used, par: lv ? lv.par : 0, starAt: lv ? lv.stars : null, pollenGot: pollenCount(), pollenTotal: lv ? lv.pollen.length : 0,
      sown: sownCount(), needTotal: needTotal(), aimDeg: Math.round(deg * 10) / 10, power: Math.round(S.aim.pow * 100) / 100, fast: S.fast, flying: !!S.seed, demo: !!S.demo,
    };
  }

  function emitHud(force) {
    if (S.mode !== "play" || !S.lv) return;
    const h = hudPayload(), key = [h.seedsLeft, h.used, h.pollenGot, h.sown, h.aimDeg, h.power, h.fast, h.flying].join("|");
    if (force || key !== S.lastHud) { S.lastHud = key; emit("hud", h); }
  }

  function computePreview() {
    S.pv = null;
    const lv = S.lv;
    if (!lv || S.seed || S.seedsLeft <= 0) return;
    if (!(S.phase === "play" || S.phase === "intro")) return;
    if (S.mode === "showcase" && !(S.bot && S.bot.state === "aim")) return;
    if (S.demo && S.demo.state !== "aim") return;
    const sim = Sim(), secs = lv.preview * (S.settings.assist ? 1.6 : 1), steps = Math.round(secs / DT);
    const s = sim.newSeed(lv, S.aim.ang, S.aim.pow), pg = S.pollenGot.slice(), pts = [], marks = [];
    let T = S.T, end = null;
    for (let i = 1; i <= steps; i++) {
      T += DT;
      const ev = sim.stepSeed(lv, s, T, DT, pg);
      if (ev) {
        if (ev.type === "warp") { pts.push(null); marks.push({ t: "warp", x: s.x, y: s.y }); continue; }
        if (ev.type === "pollen") { pg[ev.k] = true; marks.push({ t: "pollen", x: ev.x, y: ev.y }); }
        if (ev.type === "bounce" || ev.type === "boost") marks.push({ t: ev.type, x: s.x, y: s.y });
        if (sim.TERMINAL[ev.type]) { end = { type: ev.type, x: s.x, y: s.y }; pts.push([s.x, s.y, i / steps]); break; }
      }
      if (i % 4 === 0) pts.push([s.x, s.y, i / steps]);
    }
    S.pv = { pts: pts, end: end, marks: marks };
  }

  function update(dt) {
    S.time += dt;
    S.ambT += dt * (rm() ? 0.35 : 1);
    updateAmbience(dt);
    if (!S.lv) return;
    const playing = S.mode === "play", show = S.mode === "showcase", demo = playing ? S.demo : null;
    if (!(S.paused && playing)) {
      const gdt = demo ? dt * demo.speed : dt;
      if (playing && !demo) keyAim(dt);
      if (show) botThink(dt);
      if (demo) demoThink(gdt);
      const ff = playing && !demo && S.inputEnabled && (S.keys.has("f") || S.tapFast);
      const rate = demo ? demoRate() : ff || (playing && S.settings.fastForward && S.seed) ? 3 : 1;
      S.fast = rate > 1.05;
      const sdt = gdt * rate;
      if (S.hitstop > 0) S.hitstop -= gdt;
      else {
        S.acc += sdt;
        let n = 0;
        while (S.acc >= DT && n++ < 480) {
          if (show) botLaunchCheck();
          if (demo && !demoGate()) { S.acc = 0; break; }
          S.acc -= DT;
          S.step++;
          S.T = S.step * DT;
          if (S.seed) stepFlight();
          if (S.hitstop > 0) { S.acc = 0; break; }
        }
        updateFx(sdt, gdt);
      }
      if (S.fast && !S.seed && !demo && !S.keys.has("f")) S.fast = false;
      if (playing && S.phase !== "won" && S.phase !== "lost") S.clock += dt;
      updatePhase(gdt);
      if (demo && S.demo === demo) demoAfter(gdt);
    }
    S.P = Sim().positions(S.lv.bodies, S.T);
    updateCamera(dt);
    computePreview();
    emitHud();
  }

  function circ(x, y, r) { const c = S.ctx; c.beginPath(); c.arc(x, y, Math.max(0, r), 0, TAU); }
  const wrapMod = (a, m) => ((a % m) + m) % m;

  function fillPath(hex, w) {
    const c = S.ctx, p = S.pal;
    if (p.mono) { c.fillStyle = p.paper; c.fill(); c.strokeStyle = p.ink; c.lineWidth = w || 1.1; c.stroke(); }
    else if (p.neon) { c.fillStyle = rgba(hex, 0.28); c.fill(); c.strokeStyle = hex; c.lineWidth = w || 1.1; c.stroke(); }
    else if (p.outline) { c.fillStyle = hex; c.fill(); c.strokeStyle = p.outline; c.lineWidth = w || 0.8; c.stroke(); }
    else { c.fillStyle = hex; c.fill(); }
  }

  function introScale(i) {
    if (S.phase !== "intro") return 1;
    if (rm()) return clamp(S.introT / S.introDur, 0, 1);
    return outElastic(clamp((S.introT - 0.1 - i * 0.08) / 0.7, 0, 1));
  }
  function elemAlpha() { return S.phase === "intro" ? clamp((S.introT - 0.15) / 0.6, 0, 1) : 1; }
  function launcherScale() {
    if (S.phase !== "intro") return 1;
    return rm() ? clamp(S.introT / S.introDur, 0, 1) : outBack(clamp((S.introT - (S.introDur - 0.45)) / 0.4, 0, 1));
  }

  function discBase(r, fill, dark, pat) {
    const c = S.ctx, p = S.pal;
    if (p.shadow) { c.fillStyle = dark; circ(6, 6, r); c.fill(); c.fillStyle = fill; circ(0, 0, r); c.fill(); }
    else if (p.skin === "daylight") { c.globalAlpha = 0.45; c.fillStyle = p.riso; circ(4, 3, r); c.fill(); c.globalAlpha = 1; c.fillStyle = fill; circ(0, 0, r); c.fill(); }
    else if (p.neon) { drawGlow(0, 0, r * 1.9, fill, 0.3); c.fillStyle = mix("#07000f", fill, 0.1); circ(0, 0, r); c.fill(); }
    else { c.fillStyle = p.paper; circ(0, 0, r); c.fill(); if (pat) { c.fillStyle = pattern(pat); c.fill(); } }
  }

  function discEdge(r, col) {
    const c = S.ctx, p = S.pal;
    if (p.neon) { c.strokeStyle = rgba(col, 0.3); c.lineWidth = lw(7); circ(0, 0, r); c.stroke(); c.strokeStyle = col; c.lineWidth = lw(2); c.stroke(); }
    else if (p.outline) { c.strokeStyle = p.outline; c.lineWidth = lw(p.mono ? 2.4 : 2); circ(0, 0, r); c.stroke(); }
  }

  function shade(r) {
    const c = S.ctx, p = S.pal;
    if (p.neon) return;
    c.save(); circ(0, 0, r); c.clip();
    if (p.mono) {
      c.beginPath(); c.arc(0, 0, r, 0, TAU); c.arc(-r * 0.3, -r * 0.3, r * 0.98, 0, TAU);
      c.fillStyle = pattern("hatch"); c.fill("evenodd");
    } else {
      c.fillStyle = p.light ? rgba(p.ink, 0.1) : "rgba(16,20,42,0.24)"; circ(r * 0.35, r * 0.35, r * 0.95); c.fill();
    }
    c.restore();
  }

  function inkSoil(b) {
    const c = S.ctx, p = S.pal, r = b.r;
    c.fillStyle = p.ink; circ(0, 0, r); c.fill();
    c.save(); circ(0, 0, r); c.clip();
    c.strokeStyle = rgba(p.paper, 0.55); c.lineWidth = lw(1.3); c.setLineDash([3, 5]);
    for (const f of [0.32, 0.56, 0.8]) { circ(0, 0, r * f); c.stroke(); }
    c.setLineDash([]);
    c.fillStyle = p.paper; c.beginPath();
    for (const s of b.spots) { c.moveTo(s[0] + 1.6, s[1]); c.arc(s[0], s[1], 1.6, 0, TAU); }
    c.fill();
    c.restore();
  }

  function needRing(b, rr, ringCol) {
    const c = S.ctx, p = S.pal, F = p.fl, n = b.need, span = TAU / n, gap = Math.min(0.5, 0.2 + 1.6 / rr);
    const full = p.mono ? p.ink : tint(F.bloom[0]), hole = p.light ? p.paper : p.neon ? "#07000f" : "#0f1328";
    c.save(); c.lineCap = "butt";
    for (let k = 0; k < n; k++) {
      const a0 = -Math.PI / 2 - span / 2 + k * span + gap / 2, a1 = a0 + span - gap, got = k < b.got;
      c.beginPath(); c.arc(0, 0, rr, a0, a1);
      c.strokeStyle = got ? full : rgba(ringCol, 0.8); c.lineWidth = lw(7); c.stroke();
      if (!got) { c.strokeStyle = hole; c.lineWidth = lw(3.6); c.stroke(); }
      else if (!rm()) { const m = (a0 + a1) / 2; drawGlow(Math.cos(m) * rr, Math.sin(m) * rr, 16, full, 0.25 + 0.15 * Math.sin(S.ambT * 4 + k)); }
    }
    c.restore();
  }

  function drawFertile(b) {
    const c = S.ctx, p = S.pal, r = b.r, t = S.ambT, sated = b.got >= b.need, F = p.fl;
    const fill = sated ? p.fertSated : p.fert;
    if (p.mono) inkSoil(b);
    else {
      discBase(r, fill, p.fertDark, "stipple");
      c.save(); circ(0, 0, r); c.clip();
      if (p.neon) {
        c.strokeStyle = rgba(fill, 0.35); c.lineWidth = lw(1);
        for (const f of [0.42, 0.7]) { circ(0, 0, r * f); c.stroke(); }
      } else {
        c.fillStyle = rgba(p.fertDeep, 0.35); c.beginPath();
        for (const s of b.spots) { c.moveTo(s[0] + s[2] * 0.6, s[1]); c.arc(s[0], s[1], s[2] * 0.6, 0, TAU); }
        c.fill();
      }
      c.restore();
      shade(r);
    }
    discEdge(r, fill);
    const rr = r + 16, ringCol = p.mono ? p.ink : p.light ? p.fertDark : p.neon ? fill : p.fert;
    c.lineWidth = lw(p.mono ? 3 : 2);
    if (b.need > 1) needRing(b, rr, ringCol);
    else if (sated) {
      c.strokeStyle = rgba(p.mono ? p.ink : tint(F.bloom[0]), p.mono ? 0.9 : 0.6); circ(0, 0, rr); c.stroke();
    } else {
      c.save(); c.rotate(rm() ? 0 : t * 0.3); c.setLineDash([6, 8]);
      c.strokeStyle = rgba(ringCol, p.mono ? 0.75 + 0.2 * Math.sin(t * 3 + b.phase) : 0.55 + 0.3 * Math.sin(t * 3 + b.phase)); circ(0, 0, rr); c.stroke();
      c.setLineDash([]); c.restore();
    }
  }

  function drawBarren(b) {
    const c = S.ctx, p = S.pal, r = b.r;
    discBase(r, p.barren, p.barrenDark, "cross");
    c.save(); circ(0, 0, r); c.clip();
    for (const s of b.spots) {
      if (p.neon || p.mono) {
        c.strokeStyle = p.mono ? p.ink : rgba(p.crater, 0.7); c.lineWidth = lw(1.2); circ(s[0], s[1], s[2]); c.stroke();
        if (p.mono) { c.fillStyle = p.paper; c.fill(); c.stroke(); }
      } else {
        c.fillStyle = p.crater; circ(s[0], s[1], s[2]); c.fill();
        c.fillStyle = p.light ? rgba(p.ink, 0.12) : "rgba(255,255,255,0.08)"; circ(s[0] - s[2] * 0.25, s[1] - s[2] * 0.25, s[2] * 0.55); c.fill();
      }
    }
    c.restore();
    shade(r); discEdge(r, p.barren);
  }

  function drawIce(b) {
    const c = S.ctx, p = S.pal, r = b.r, t = S.ambT, fs = b.facets, n = fs.length;
    discBase(r, p.ice, p.iceDark, "light");
    c.save(); circ(0, 0, r); c.clip();
    for (let k = 0; k < n; k++) {
      const a0 = fs[k].a, a1 = fs[(k + 1) % n].a + (k === n - 1 ? TAU : 0);
      c.beginPath(); c.moveTo(b.fc[0], b.fc[1]); c.lineTo(Math.cos(a0) * r * 1.2, Math.sin(a0) * r * 1.2); c.lineTo(Math.cos(a1) * r * 1.2, Math.sin(a1) * r * 1.2); c.closePath();
      if (p.neon || p.mono) { c.strokeStyle = p.mono ? p.ink : rgba(p.ice, 0.6); c.lineWidth = lw(1); c.stroke(); }
      else { c.fillStyle = fs[k].s > 0.5 ? rgba("#ffffff", 0.08 + fs[k].s * 0.18) : rgba(p.iceDark, 0.1 + fs[k].s * 0.25); c.fill(); }
    }
    if (!p.neon && !p.mono) {
      c.strokeStyle = "rgba(255,255,255,0.55)"; c.lineWidth = lw(1.2); c.beginPath();
      for (let k = 0; k < n; k++) { c.moveTo(b.fc[0], b.fc[1]); c.lineTo(Math.cos(fs[k].a) * r, Math.sin(fs[k].a) * r); }
      c.stroke();
      c.fillStyle = "rgba(255,255,255,0.35)"; c.beginPath(); c.ellipse(-r * 0.35, -r * 0.42, r * 0.26, r * 0.14, -0.6, 0, TAU); c.fill();
    }
    c.restore();
    shade(r); discEdge(r, p.ice);
    const sa = fs[Math.floor(t * 0.5 + b.phase) % n].a, tw = Math.max(0, Math.sin(t * 3 + b.phase));
    if (tw > 0.05) {
      const x = Math.cos(sa) * r * 0.7, y = Math.sin(sa) * r * 0.7, l = 7 * tw;
      c.strokeStyle = p.mono ? p.ink : p.light ? p.iceDark : "#ffffff"; c.lineWidth = lw(1.2);
      c.beginPath(); c.moveTo(x - l, y); c.lineTo(x + l, y); c.moveTo(x, y - l); c.lineTo(x, y + l); c.stroke();
      drawGlow(x, y, 14 * tw, "#ffffff", 0.5);
    }
  }

  function drawSun(b) {
    const c = S.ctx, p = S.pal, r = b.r, t = S.ambT, pulse = rm() ? 0 : Math.sin(t * 2 + b.phase) * 4;
    drawGlow(0, 0, r * 3 + pulse, p.sun, p.light ? 0.35 : 0.6);
    const rays = 16, rot = t * 0.2, cb = S.settings.colorblind;
    c.beginPath();
    for (let i = 0; i < rays; i++) {
      const a = (i / rays) * TAU + rot, l = r + 14 + Math.sin(t * 3 + i * 1.7) * 5 + (i % 2 ? 0 : 6), w = cb ? 0.09 : 0.05;
      c.moveTo(Math.cos(a - w) * (r + 3), Math.sin(a - w) * (r + 3)); c.lineTo(Math.cos(a) * l, Math.sin(a) * l); c.lineTo(Math.cos(a + w) * (r + 3), Math.sin(a + w) * (r + 3));
    }
    if (p.mono) { c.fillStyle = p.ink; c.fill(); }
    else { c.fillStyle = rgba(p.neon ? p.sunCore : p.light ? p.sun : p.sunCore, p.light ? 0.8 : 0.5); c.fill(); }
    c.lineWidth = lw(2);
    for (let i = 0; i < 3; i++) {
      const a = t * (0.4 + i * 0.3) + i * 2.1 + b.phase, l = 0.5 + 0.4 * Math.sin(t * 1.7 + i);
      c.strokeStyle = p.mono ? p.ink : rgba(p.sunCore, 0.5); c.beginPath(); c.arc(0, 0, r + 6 + i * 3, a, a + l); c.stroke();
    }
    if (p.shadow) { c.fillStyle = p.sunDark; circ(5, 5, r); c.fill(); }
    if (p.skin === "daylight") { c.globalAlpha = 0.45; c.fillStyle = p.riso; circ(4, 3, r); c.fill(); c.globalAlpha = 1; }
    if (p.mono) {
      c.fillStyle = p.paper; circ(0, 0, r); c.fill();
      c.strokeStyle = p.ink; c.lineWidth = lw(0.9); c.beginPath();
      for (let i = 0; i < 36; i++) { const a = (i / 36) * TAU + rot * 0.5; c.moveTo(Math.cos(a) * r * 0.25, Math.sin(a) * r * 0.25); c.lineTo(Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.95); }
      c.stroke();
      c.lineWidth = lw(3); circ(0, 0, r); c.stroke();
      return;
    }
    if (p.neon) {
      c.fillStyle = "#12000c"; circ(0, 0, r); c.fill();
      c.save(); circ(0, 0, r); c.clip();
      const sp = sunSprite(); c.globalAlpha = 0.9; c.drawImage(sp, -r, -r, r * 2, r * 2); c.globalAlpha = 1;
      c.fillStyle = "#12000c";
      for (let k = 0; k < 6; k++) { const y = r * (0.1 + k * 0.16) + ((t * 6) % (r * 0.16)); c.fillRect(-r, y, r * 2, 2 + k * 1.2); }
      c.restore();
      discEdge(r, p.sun);
      return;
    }
    c.drawImage(sunSprite(), -r, -r, r * 2, r * 2);
    c.save(); circ(0, 0, r); c.clip();
    c.fillStyle = rgba(p.sunDark, 0.18); c.beginPath();
    for (const s of b.spots) { const x = s[0] + Math.sin(t * 0.3 + s[1]) * 3; c.moveTo(x + s[2] * 0.5, s[1]); c.arc(x, s[1], s[2] * 0.5, 0, TAU); }
    c.fill();
    c.restore();
    discEdge(r, p.sun);
  }

  function drawBlackHole(b) {
    const c = S.ctx, p = S.pal, r = b.r, t = S.ambT;
    drawGlow(0, 0, r * 8, p.bhDisk, p.light ? 0.3 : 0.5);
    const disk = (front) => {
      c.save(); c.rotate(b.tilt); c.scale(1, 0.36);
      for (let k = 0; k < 5; k++) {
        const R = r * (1.8 + k * 0.72), sp = 3 / (1 + k * 0.6);
        c.strokeStyle = p.mono ? p.ink : rgba(mix(p.bhDisk, p.bhRing, 1 - k / 5), p.mono ? 0.7 : 0.75 - k * 0.12);
        c.lineWidth = r * (0.44 - k * 0.05);
        c.setLineDash([r * (0.8 + k * 0.3), r * (0.35 + k * 0.1)]);
        c.lineDashOffset = -t * sp * r;
        c.beginPath(); c.arc(0, 0, R, front ? 0 : Math.PI, front ? Math.PI : TAU); c.stroke();
      }
      c.setLineDash([]);
      c.fillStyle = p.mono ? p.ink : p.bhRing;
      for (const m of b.motes) {
        const a = m.a, s = (m.a % TAU + TAU) % TAU < Math.PI;
        if (s !== front) continue;
        const f = clamp((m.d - r) / (r * 5), 0, 1);
        c.globalAlpha = (1 - f) * 0.9;
        c.fillRect(Math.cos(a) * m.d - 1.5, Math.sin(a) * m.d - 1.5, 3, 3);
      }
      c.globalAlpha = 1;
      c.restore();
    };
    disk(false);
    c.fillStyle = p.mono ? p.ink : p.bh; circ(0, 0, r * 1.18); c.fill();
    c.strokeStyle = p.mono ? p.paper : rgba(p.bhRing, 0.9); c.lineWidth = lw(1.6); circ(0, 0, r * 1.3); c.stroke();
    if (!p.mono) { c.strokeStyle = rgba(p.bhDisk, 0.35); c.lineWidth = lw(4); circ(0, 0, r * 1.42); c.stroke(); }
    disk(true);
    if (p.mono) { c.strokeStyle = p.ink; c.lineWidth = lw(2); circ(0, 0, r * 1.3); c.stroke(); }
  }

  function drawRepulsor(b) {
    const c = S.ctx, p = S.pal, r = b.r, t = S.ambT, col = p.mono ? p.ink : p.rep;
    for (let k = 0; k < 3; k++) {
      const ph = wrapMod(t * 0.6 + k / 3, 1), R = r * (1.15 + ph * 2.3);
      c.strokeStyle = rgba(col, (1 - ph) * (p.light ? 0.6 : 0.5)); c.lineWidth = lw(2 + (1 - ph) * 2);
      circ(0, 0, R); c.stroke();
    }
    drawGlow(0, 0, r * 2.6, p.rep, 0.4);
    const N = 30;
    c.strokeStyle = rgba(col, 0.8); c.lineWidth = lw(1.5); c.beginPath();
    for (let i = 0; i < N; i++) {
      const a = (i / N) * TAU + t * 0.3, l = r * (0.22 + 0.16 * Math.sin(t * 6 + i * 2.3) + (i % 2 ? 0.1 : 0));
      c.moveTo(Math.cos(a) * r * 1.03, Math.sin(a) * r * 1.03); c.lineTo(Math.cos(a) * (r * 1.03 + l), Math.sin(a) * (r * 1.03 + l));
    }
    c.stroke();
    discBase(r, p.rep, p.repDark, "dense");
    c.save(); circ(0, 0, r); c.clip();
    c.lineWidth = lw(1.5);
    for (let k = 0; k < 3; k++) {
      const ph = wrapMod(t * 0.9 + k / 3, 1);
      c.strokeStyle = p.mono ? p.ink : rgba(p.neon ? p.rep : "#ffffff", (1 - ph) * 0.5); circ(0, 0, r * (0.15 + ph * 0.85)); c.stroke();
    }
    c.restore();
    shade(r); discEdge(r, p.rep);
    c.fillStyle = p.mono ? p.ink : p.neon ? "#ffffff" : p.repDark; circ(0, 0, r * 0.18); c.fill();
  }

  function wallPath(wl, grow, sc, ox, oy) {
    const c = S.ctx, B = S.lv.bodies, P = S.P;
    ox = ox || 0; oy = oy || 0;
    c.beginPath();
    for (const i of wl.idx) {
      const r = B[i].r * sc[i] + grow;
      if (r > 0) { c.moveTo(P[i][0] + ox + r, P[i][1] + oy); c.arc(P[i][0] + ox, P[i][1] + oy, r, 0, TAU); }
    }
    for (const e of wl.edges) {
      const a = P[e[0]], b = P[e[1]], w = Math.min(B[e[0]].r * sc[e[0]], B[e[1]].r * sc[e[1]]) * 0.72 + grow;
      if (w <= 0) continue;
      const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = (-dy / l) * w, ny = (dx / l) * w;
      c.moveTo(a[0] + ox - nx, a[1] + oy - ny); c.lineTo(b[0] + ox - nx, b[1] + oy - ny); c.lineTo(b[0] + ox + nx, b[1] + oy + ny); c.lineTo(a[0] + ox + nx, a[1] + oy + ny); c.closePath();
    }
  }

  function drawWall(wl) {
    const c = S.ctx, p = S.pal, B = S.lv.bodies, P = S.P, sc = {};
    let vis = 0;
    for (const i of wl.idx) { sc[i] = Math.max(0, introScale(i)); vis = Math.max(vis, sc[i]); }
    if (vis <= 0.01) return;
    const H = wl.halo, rm0 = wl.rm, hc = p.light ? p.barrenDark : p.neon ? p.barren : mix(p.barren, S.theme.glow, 0.45);
    if (p.mono) {
      wallPath(wl, H * 0.55, sc); c.globalAlpha = 0.6; c.fillStyle = pattern("stipple"); c.fill();
      c.globalAlpha = 1; c.setLineDash([2, 6]); c.strokeStyle = rgba(p.ink, 0.25); c.lineWidth = lw(1.2); c.stroke(); c.setLineDash([]);
    } else {
      c.globalCompositeOperation = p.light ? "source-over" : "lighter";
      for (const h of [[1, 0.024], [0.8, 0.026], [0.6, 0.028], [0.42, 0.03], [0.24, 0.034]]) { wallPath(wl, H * h[0], sc); c.fillStyle = rgba(hc, h[1] * (p.light ? 1.4 : p.neon ? 1.5 : 1)); c.fill(); }
      c.globalCompositeOperation = "source-over";
    }
    const so = scrOff(0, 0, 6, 6), ro = scrOff(0, 0, 4, 3);
    if (p.shadow) { wallPath(wl, 0, sc, so[0], so[1]); c.fillStyle = p.barrenDark; c.fill(); }
    if (p.skin === "daylight") { wallPath(wl, 0, sc, ro[0], ro[1]); c.globalAlpha = 0.45; c.fillStyle = p.riso; c.fill(); c.globalAlpha = 1; }
    wallPath(wl, 0, sc);
    c.lineJoin = "round";
    if (p.neon) { c.strokeStyle = rgba(p.barren, 0.3); c.lineWidth = lw(9); c.stroke(); c.strokeStyle = p.barren; c.lineWidth = lw(3.4); c.stroke(); }
    else if (p.outline) { c.strokeStyle = p.outline; c.lineWidth = lw(p.mono ? 4.4 : 3.6); c.stroke(); }
    c.fillStyle = p.mono ? p.paper : p.neon ? mix("#07000f", p.barren, 0.1) : p.barren; c.fill();
    c.save(); c.clip();
    if (p.mono) { c.globalAlpha = 0.4; c.fillStyle = pattern("cross"); c.fill(); c.globalAlpha = 1; }
    else if (!p.neon) {
      const k = rm0 * 0.32, sh = scrOff(0, 0, k, k);
      wallPath(wl, -rm0 * 0.06, sc, sh[0], sh[1]);
      c.fillStyle = p.light ? rgba(p.ink, 0.08) : "rgba(16,20,42,0.2)"; c.fill();
    }
    c.lineWidth = lw(1);
    for (const i of wl.idx) {
      const b = B[i], q = P[i], k = sc[i];
      c.strokeStyle = p.mono ? rgba(p.ink, 0.28) : p.neon ? rgba(p.barren, 0.22) : p.light ? rgba(p.ink, 0.12) : "rgba(255,255,255,0.06)";
      circ(q[0], q[1], b.r * k * 0.97); c.stroke();
      for (let n = 0; n < Math.min(3, b.spots.length); n++) {
        const s = b.spots[n], x = q[0] + s[0] * k, y = q[1] + s[1] * k, r = s[2] * k * 0.8;
        if (p.mono || p.neon) { c.strokeStyle = p.mono ? rgba(p.ink, 0.5) : rgba(p.crater, 0.4); circ(x, y, r); c.stroke(); }
        else { c.fillStyle = rgba(p.crater, 0.55); circ(x, y, r); c.fill(); }
      }
      if (b.flash > 0 && !p.mono) { c.globalCompositeOperation = p.light ? "source-over" : "lighter"; c.fillStyle = rgba(p.light ? "#ffffff" : S.theme.glow, b.flash * 0.45); circ(q[0], q[1], b.r * k); c.fill(); c.globalCompositeOperation = "source-over"; }
      else if (b.flash > 0) { c.strokeStyle = rgba(p.ink, b.flash); c.lineWidth = lw(2.5); circ(q[0], q[1], b.r * k * 0.9); c.stroke(); c.lineWidth = lw(1); }
    }
    if (S.settings.colorblind) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const i of wl.idx) { const q = P[i], r = B[i].r; x0 = Math.min(x0, q[0] - r); y0 = Math.min(y0, q[1] - r); x1 = Math.max(x1, q[0] + r); y1 = Math.max(y1, q[1] + r); }
      const L = Math.max(x1 - x0, y1 - y0);
      c.strokeStyle = rgba(p.light ? p.ink : "#ffffff", 0.45); c.lineWidth = lw(1.4); c.beginPath();
      for (let d = -L; d < L * 2; d += 11) { c.moveTo(x0 + d - L, y0); c.lineTo(x0 + d + L, y0 + 2 * L); c.moveTo(x0 + d + L, y0); c.lineTo(x0 + d - L, y0 + 2 * L); }
      c.stroke();
    }
    c.restore();
  }

  const BODY = { fertile: drawFertile, barren: drawBarren, ice: drawIce, sun: drawSun, blackhole: drawBlackHole, repulsor: drawRepulsor };

  function cbMarker(b) {
    const c = S.ctx, p = S.pal, r = b.r, ink = p.light ? p.ink : "#ffffff";
    if (b.kind === "fertile") {
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * TAU + Math.PI / 6, x = Math.cos(a) * (r + 30), y = Math.sin(a) * (r + 30);
        c.save(); c.translate(x, y); c.rotate(a + Math.PI / 2);
        c.beginPath(); c.moveTo(0, 5); c.quadraticCurveTo(5, 0, 0, -6); c.quadraticCurveTo(-5, 0, 0, 5);
        c.fillStyle = p.mono ? p.paper : p.fert; c.fill(); c.strokeStyle = ink; c.lineWidth = lw(1); c.stroke();
        c.beginPath(); c.moveTo(0, 5); c.lineTo(0, -4); c.stroke();
        c.restore();
      }
    } else if (b.kind === "barren" || b.kind === "blackhole" || b.kind === "repulsor") {
      const R = b.kind === "blackhole" ? r * 1.15 : r;
      c.save(); circ(0, 0, R); c.clip();
      c.strokeStyle = rgba(b.kind === "blackhole" ? "#ffffff" : ink, 0.45); c.lineWidth = lw(1.4); c.beginPath();
      for (let d = -R * 2; d < R * 2; d += 11) { c.moveTo(d - R, -R); c.lineTo(d + R, R); c.moveTo(d + R, -R); c.lineTo(d - R, R); }
      c.stroke(); c.restore();
    } else if (b.kind === "ice") {
      c.strokeStyle = ink; c.lineWidth = lw(2); c.beginPath();
      for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI; c.moveTo(Math.cos(a) * r * 0.35, Math.sin(a) * r * 0.35); c.lineTo(-Math.cos(a) * r * 0.35, -Math.sin(a) * r * 0.35); }
      c.stroke();
    } else if (b.kind === "sun") {
      c.strokeStyle = p.light ? p.ink : "#2a1400"; c.lineWidth = lw(2); circ(0, 0, r * 0.35); c.stroke();
      c.beginPath();
      for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU; c.moveTo(Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.45); c.lineTo(Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62); }
      c.stroke();
    }
  }

  function drawShield(b, i, sc) {
    const c = S.ctx, p = S.pal, sim = Sim(), P = S.P[i], R = sim.shieldRadius(b) * sc, gc = sim.shieldGapCenter(b, S.T), gap = b.shield.gap;
    const a0 = gc + gap / 2, span = TAU - gap, n = Math.max(4, Math.round(span / 0.45)), col = p.mono ? p.ink : p.light ? tint(p.shield) : p.shield;
    c.save(); c.translate(P[0], P[1]);
    if (!p.mono) { c.strokeStyle = rgba(p.shield, p.neon ? 0.3 : 0.14); c.lineWidth = lw(10); c.beginPath(); c.arc(0, 0, R, a0, a0 + span); c.stroke(); }
    c.lineWidth = lw(p.mono ? 4 : 3.5); c.lineCap = "butt"; c.strokeStyle = col; c.beginPath();
    for (let k = 0; k < n; k++) {
      const s0 = a0 + (k * span) / n + 0.035, s1 = a0 + ((k + 1) * span) / n - 0.035;
      c.moveTo(Math.cos(s0) * R, Math.sin(s0) * R); c.arc(0, 0, R, s0, s1);
    }
    c.stroke();
    c.lineWidth = lw(1); c.strokeStyle = rgba(col, 0.4); c.beginPath(); c.arc(0, 0, Math.max(0, R - 6), a0, a0 + span); c.stroke();
    if (b.shield.w) {
      const dir = Math.sign(b.shield.w), am = a0 + span / 2;
      c.fillStyle = rgba(col, 0.7);
      for (let k = -1; k <= 1; k++) {
        const a = am + k * 0.5, x = Math.cos(a) * (R + 9), y = Math.sin(a) * (R + 9), tx = -Math.sin(a) * dir, ty = Math.cos(a) * dir;
        c.beginPath(); c.moveTo(x + tx * 5, y + ty * 5); c.lineTo(x - tx * 3 + Math.cos(a) * 4, y - ty * 3 + Math.sin(a) * 4); c.lineTo(x - tx * 3 - Math.cos(a) * 4, y - ty * 3 - Math.sin(a) * 4); c.fill();
      }
    }
    const edge = p.mono ? p.ink : p.neon ? "#ffffff" : S.theme.glow;
    c.lineCap = "round"; c.lineWidth = lw(2.4); c.strokeStyle = p.light ? col : edge;
    for (const e of [a0, a0 + span]) {
      const ex = Math.cos(e), ey = Math.sin(e);
      drawGlow(ex * R, ey * R, 18 + Math.sin(S.ambT * 5) * 3, p.neon ? p.shield : S.theme.glow, 0.8);
      c.beginPath(); c.moveTo(ex * (R - 8), ey * (R - 8)); c.lineTo(ex * (R + 8), ey * (R + 8)); c.stroke();
    }
    if (b.shHit) {
      const f = 1 - b.shHit.t / 0.6, a = b.shHit.ang;
      c.strokeStyle = p.light ? rgba(p.ink, f) : rgba("#ffffff", f); c.lineWidth = lw(6 * f + 1);
      c.beginPath(); c.arc(0, 0, R, a - 0.45 * (1 + (1 - f)), a + 0.45 * (1 + (1 - f))); c.stroke();
      drawGlow(Math.cos(a) * R, Math.sin(a) * R, 40 * f, p.shield, f);
    }
    c.restore();
  }

  function drawBodies() {
    const lv = S.lv, c = S.ctx, p = S.pal;
    if (lv.walls) lv.walls.forEach(drawWall);
    lv.bodies.forEach((b, i) => {
      if (b.wall != null) return;
      const sc = introScale(i);
      if (sc <= 0.01) return;
      const P = S.P[i], w = b.wob, wv = w.amp * Math.exp(-w.t * 6) * Math.sin(w.t * 28);
      c.save(); c.translate(P[0], P[1]);
      if (Math.abs(wv) > 0.0008) { c.rotate(w.ang); c.scale(1 + wv, 1 - wv); c.rotate(-w.ang); }
      if (sc !== 1) c.scale(sc, sc);
      c.save(); if (S.view.th) c.rotate(-S.view.th);
      (BODY[b.kind] || drawBarren)(b);
      if (b.flash > 0 && !p.mono) {
        c.globalCompositeOperation = p.light ? "source-over" : "lighter";
        c.fillStyle = rgba(p.light ? "#ffffff" : S.theme.glow, b.flash * 0.45); circ(0, 0, b.r); c.fill();
        c.globalCompositeOperation = "source-over";
      }
      c.restore();
      if (b.plants.length) drawPlants(b);
      if (S.settings.colorblind) cbMarker(b);
      c.restore();
      if (b.shield) drawShield(b, i, sc);
    });
  }

  function drawPlants(b) {
    const c = S.ctx, still = rm();
    for (const pl of b.plants) {
      c.save();
      c.translate(Math.cos(pl.ang) * (b.r - 2), Math.sin(pl.ang) * (b.r - 2));
      c.rotate(pl.ang + Math.PI / 2 + (still ? 0 : Math.sin(S.ambT * 1.3 + pl.sway) * 0.05));
      const pop = pl.bloom > 0 && pl.bloom < 1 && !still ? 1 + Math.sin(pl.bloom * Math.PI) * 0.18 : 1;
      if (pop !== 1) c.scale(pop, pop);
      c.lineCap = "round"; c.lineJoin = "round";
      if (pl.flora === "fern") drawFern(pl);
      else if (pl.flora === "spiral") drawSpiral(pl);
      else if (pl.flora === "sunflower") drawSunflower(pl);
      else if (pl.flora === "ember") drawEmber(pl);
      else drawDaisy(pl);
      c.restore();
    }
  }

  function drawDaisy(pl) {
    const c = S.ctx, p = S.pal, F = FLORA.daisy, prog = pl.g * (pl.maxD + 2.2), bl = pl.bloom;
    for (const s of pl.segs) {
      const f = clamp(prog - s.d, 0, 1);
      if (f <= 0) continue;
      c.strokeStyle = tint(s.d < 2 ? F.stemDark : F.stem); c.lineWidth = s.w;
      c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(s.x + (s.x2 - s.x) * f, s.y + (s.y2 - s.y) * f); c.stroke();
    }
    for (const l of pl.leaves) {
      const f = clamp(prog - l.d - 0.6, 0, 1);
      if (f <= 0) continue;
      c.save(); c.translate(l.x, l.y); c.rotate(l.a);
      c.beginPath(); c.ellipse(0, -l.s * f, l.s * 0.45 * f, l.s * f, 0, 0, TAU); fillPath(F.leaf, 0.6);
      c.restore();
    }
    for (const tip of pl.tips) {
      const f = clamp(prog - tip.d - 1, 0, 1);
      if (f <= 0) continue;
      const s = tip.s * f * (1 + 0.6 * bl);
      c.save(); c.translate(tip.x, tip.y); c.rotate(tip.rot + S.ambT * 0.2);
      if (bl > 0.05) {
        c.save(); c.rotate(Math.PI / 5); c.beginPath();
        for (let i = 0; i < 5; i++) { c.rotate(TAU / 5); c.moveTo(s * 0.5, -s * 1.5 * bl); c.ellipse(0, -s * 1.5 * bl, s * 0.5, s * 1.1 * bl, 0, 0, TAU); }
        fillPath(mix(tip.c, "#ffffff", 0.35), 0.6); c.restore();
      }
      c.beginPath();
      for (let i = 0; i < 5; i++) { c.rotate(TAU / 5); c.moveTo(s * 0.55, -s); c.ellipse(0, -s, s * 0.55, s, 0, 0, TAU); }
      fillPath(tip.c, 0.6);
      circ(0, 0, s * 0.45); c.fillStyle = p.mono ? p.ink : F.core; c.fill();
      c.restore();
    }
  }

  function drawFern(pl) {
    const c = S.ctx, p = S.pal, F = FLORA.fern, bl = pl.bloom, t = S.ambT;
    pl.fronds.forEach((f, fi) => {
      const grow = clamp(pl.g * 1.3 - fi * 0.12, 0, 1);
      if (grow <= 0) return;
      const N = 18, curl = f.curl * (2.2 - 1.2 * grow) * (1 - 0.4 * bl), pts = [[0, 0, f.a0]];
      let x = 0, y = 0;
      for (let k = 1; k <= N; k++) {
        const u = k / N, a = f.a0 + curl * Math.pow(u, 2.6), len = ((f.L * grow) / N) * (1 - 0.45 * u);
        x += Math.sin(a) * len; y -= Math.cos(a) * len; pts.push([x, y, a]);
      }
      c.strokeStyle = tint(F.stemDark); c.lineWidth = 2.2; c.beginPath(); c.moveTo(0, 0);
      for (const q of pts) c.lineTo(q[0], q[1]);
      c.stroke();
      c.beginPath();
      for (let k = 2; k < N - 2; k++) {
        const q = pts[k], u = k / N, side = k % 2 ? 1 : -1, len = f.L * 0.26 * (1 - u) * grow + 2;
        const ang = q[2] + side * (1.2 - u * 0.4), th = ang - Math.PI / 2, mx = q[0] + Math.sin(ang) * len * 0.5, my = q[1] - Math.cos(ang) * len * 0.5;
        c.moveTo(mx + Math.cos(th) * len * 0.5, my + Math.sin(th) * len * 0.5);
        c.ellipse(mx, my, len * 0.5, len * 0.17, th, 0, TAU);
      }
      fillPath(F.leaf, 0.5);
      if (grow > 0.85) {
        for (const idx of f.cry) {
          if (idx >= pts.length) continue;
          const q = pts[idx], sz = (2.6 + 2.8 * bl) * (0.8 + 0.2 * Math.sin(t * 3 + idx)) * (grow - 0.85) / 0.15;
          drawGlow(q[0], q[1], sz * 4, F.bloom[2], 0.55);
          c.strokeStyle = p.mono ? p.ink : p.light ? mix(F.bloom[1], p.ink, 0.5) : F.bloom[0]; c.lineWidth = 0.9; c.beginPath();
          for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI + t * 0.3; c.moveTo(q[0] + Math.cos(a) * sz, q[1] + Math.sin(a) * sz); c.lineTo(q[0] - Math.cos(a) * sz, q[1] - Math.sin(a) * sz); }
          c.stroke();
        }
      }
    });
  }

  function spiralPts(a0, dir, L, coil, grow, N) {
    const pts = [[0, 0, a0]];
    let x = 0, y = 0;
    for (let k = 1; k <= N; k++) {
      const u = k / N, a = a0 + dir * coil * Math.pow(u, 2.6), len = ((L * grow) / N) * (1 - 0.5 * u);
      x += Math.sin(a) * len; y -= Math.cos(a) * len; pts.push([x, y, a]);
    }
    return pts;
  }

  function strokePts(pts, from, to, ox, oy) {
    const c = S.ctx;
    c.beginPath(); c.moveTo(ox + pts[from][0], oy + pts[from][1]);
    for (let k = from + 1; k <= to && k < pts.length; k++) c.lineTo(ox + pts[k][0], oy + pts[k][1]);
    c.stroke();
  }

  function drawSpiral(pl) {
    const c = S.ctx, p = S.pal, F = FLORA.spiral, t = S.ambT, bl = pl.bloom;
    pl.vines.forEach((v, vi) => {
      const grow = clamp(pl.g * 1.25 - vi * 0.15, 0, 1);
      if (grow <= 0) return;
      const N = 28, pts = spiralPts(v.a0 + Math.sin(t * 0.8 + pl.sway + vi) * 0.06, v.dir, v.L, v.coil * (0.7 + 0.3 * grow) * (1 + 0.15 * bl), grow, N);
      c.strokeStyle = tint(F.stemDark);
      c.lineWidth = 3; strokePts(pts, 0, 10, 0, 0);
      c.lineWidth = 2; strokePts(pts, 10, 20, 0, 0);
      c.strokeStyle = tint(F.stem); c.lineWidth = 1.3; strokePts(pts, 20, N, 0, 0);
      for (const k of [6, 14]) {
        if (grow < k / N + 0.1) continue;
        const q = pts[k], side = k === 6 ? 1 : -1, s = 5 + bl * 2;
        c.save(); c.translate(q[0], q[1]); c.rotate(q[2] + side * 1.1);
        c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(s, -s * 0.4, s * 0.6, -s * 1.6, 0, -s * 1.8); c.bezierCurveTo(-s * 0.6, -s * 1.6, -s, -s * 0.4, 0, 0);
        fillPath(F.leaf, 0.5); c.restore();
      }
      for (const td of v.tendrils) {
        const k0 = Math.floor(td.u * N), tg = clamp((grow - td.u) * 2, 0, 1);
        if (tg <= 0 || k0 >= pts.length) continue;
        const b = pts[k0], tp = spiralPts(b[2] + td.dir * 0.9, td.dir, v.L * td.L, td.coil, tg, 14);
        c.strokeStyle = tint(F.leaf); c.lineWidth = 1; strokePts(tp, 0, 14, b[0], b[1]);
        if (tg > 0.9) {
          const e = tp[tp.length - 1], x = b[0] + e[0], y = b[1] + e[1], rr = 1.8 + bl * 1.5;
          drawGlow(x, y, 8 + bl * 6, td.c, 0.5);
          circ(x, y, rr); fillPath(td.c, 0.5);
        }
      }
      if (grow > 0.93) {
        const e = pts[pts.length - 1], pu = 0.75 + 0.25 * Math.sin(t * 2.2 + pl.sway + vi), rr = (3.4 + 2.2 * bl) * clamp((grow - 0.93) / 0.07, 0, 1);
        drawGlow(e[0], e[1], (16 + bl * 14) * pu, v.c, 0.7);
        circ(e[0], e[1], rr); fillPath(v.c, 0.7);
        if (!p.mono) { c.fillStyle = "rgba(255,255,255,0.8)"; circ(e[0] - rr * 0.3, e[1] - rr * 0.3, rr * 0.35); c.fill(); }
      }
    });
  }

  function drawSunflower(pl) {
    const c = S.ctx, p = S.pal, F = FLORA.sunflower, t = S.ambT, bl = pl.bloom;
    pl.stalks.forEach((s, si) => {
      const g1 = clamp(pl.g * 1.6 - si * 0.15, 0, 1);
      if (g1 <= 0) return;
      const H = s.H * g1, tx = Math.sin(s.lean) * H, ty = -Math.cos(s.lean) * H, cx = tx * 0.5 + s.bend * H * 0.3, cy = ty * 0.55;
      const q = (u) => [2 * (1 - u) * u * cx + u * u * tx, 2 * (1 - u) * u * cy + u * u * ty];
      const sw = 3 + s.H * 0.035;
      c.strokeStyle = tint(F.stemDark); c.lineWidth = sw;
      c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(cx, cy, tx, ty); c.stroke();
      if (!p.mono) { c.strokeStyle = tint(F.stem); c.lineWidth = sw * 0.4; c.beginPath(); c.moveTo(-sw * 0.15, 0); c.quadraticCurveTo(cx - sw * 0.15, cy, tx - sw * 0.15, ty); c.stroke(); }
      for (const lf of [[0.35, s.side], [0.6, -s.side]]) {
        const g2 = clamp((pl.g - 0.25 - lf[0] * 0.3) * 3, 0, 1);
        if (g2 <= 0) continue;
        const pt = q(lf[0]), L = s.H * 0.27;
        c.save(); c.translate(pt[0], pt[1]); c.rotate(s.lean + lf[1] * (1.05 + Math.sin(t * 1.4 + pl.sway) * 0.05)); c.scale(g2, g2);
        c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(L * 0.5, -L * 0.4, 0, -L); c.quadraticCurveTo(-L * 0.5, -L * 0.4, 0, 0);
        fillPath(F.leaf, 0.6);
        c.strokeStyle = tint(F.stemDark); c.lineWidth = 0.8; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -L * 0.85); c.stroke();
        c.restore();
      }
      const g3 = clamp((pl.g - 0.45) / 0.55, 0, 1);
      if (g3 <= 0) return;
      c.save(); c.translate(tx, ty);
      c.rotate(s.lean + s.tilt + Math.sin(t * 1.1 + pl.sway) * 0.06 + bl * t * 0.4);
      const hs = outBack(g3) * (1 + 0.25 * bl), n = s.petals, pLen = s.hr * 1.15 * (1 + 0.3 * bl);
      c.scale(hs, hs);
      if (bl > 0.05) {
        c.save(); c.beginPath();
        for (let i = 0; i < n; i++) { c.rotate(TAU / n); const d = s.hr + pLen * 0.75 * bl; c.moveTo(pLen * 0.18, -d); c.ellipse(0, -d, pLen * 0.18, pLen * 0.7 * bl, 0, 0, TAU); }
        fillPath(F.bloom[2], 0.5); c.restore();
      }
      c.beginPath();
      for (let i = 0; i < n; i++) { c.rotate(TAU / n); const d = s.hr + pLen * 0.45; c.moveTo(pLen * 0.22, -d); c.ellipse(0, -d, pLen * 0.22, pLen * 0.55, 0, 0, TAU); }
      fillPath(F.bloom[1], 0.5);
      c.rotate(Math.PI / n); c.beginPath();
      for (let i = 0; i < n; i++) { c.rotate(TAU / n); const d = s.hr + pLen * 0.35; c.moveTo(pLen * 0.2, -d); c.ellipse(0, -d, pLen * 0.2, pLen * 0.45, 0, 0, TAU); }
      fillPath(F.bloom[0], 0.5);
      circ(0, 0, s.hr); c.fillStyle = p.mono ? p.ink : p.neon ? "#1a0a00" : tint(F.core); c.fill();
      if (p.neon) { c.strokeStyle = F.bloom[1]; c.lineWidth = 1; c.stroke(); }
      c.fillStyle = p.mono ? p.paper : p.neon ? F.bloom[2] : mix(F.core, F.bloom[1], 0.45);
      for (let k = 1; k < 34; k++) {
        const rr = s.hr * 0.88 * Math.sqrt(k / 34), a = k * 2.39996;
        c.fillRect(Math.cos(a) * rr - 0.6, Math.sin(a) * rr - 0.6, 1.2, 1.2);
      }
      c.restore();
    });
  }

  function flame(size, flick) {
    const c = S.ctx;
    c.beginPath(); c.moveTo(0, 0);
    c.bezierCurveTo(size * 0.55, -size * 0.3, size * (0.3 + flick * 0.5), -size * 0.8, flick * size * 0.6, -size * 1.25);
    c.bezierCurveTo(-size * 0.3 + flick * size * 0.3, -size * 0.8, -size * 0.5, -size * 0.3, 0, 0);
  }

  function drawEmber(pl) {
    const c = S.ctx, p = S.pal, F = FLORA.ember, t = S.ambT, bl = pl.bloom, e = pl.em, still = rm() ? 0.3 : 1;
    const g1 = clamp(pl.g * 1.5, 0, 1);
    if (g1 <= 0) return;
    const H = e.H * g1, tx = Math.sin(e.lean) * H, ty = -Math.cos(e.lean) * H, cx = tx * 0.3 + Math.sin(t * 1.5 + e.ph) * 2 * still, cy = ty * 0.5;
    const q = (u) => [2 * (1 - u) * u * cx + u * u * tx, 2 * (1 - u) * u * cy + u * u * ty];
    c.strokeStyle = tint(p.neon ? F.leaf : F.stem); c.lineWidth = 3;
    c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(cx, cy, tx, ty); c.stroke();
    for (const lf of e.leaves) {
      const g2 = clamp((pl.g - lf.u * 0.5) * 2.5, 0, 1);
      if (g2 <= 0) continue;
      const pt = q(lf.u), size = lf.s * g2 * (1 + 0.4 * bl), fl = (Math.sin(t * 7 + lf.ph) * 0.25 + Math.sin(t * 11.3 + lf.ph * 2) * 0.12) * still;
      c.save(); c.translate(pt[0], pt[1]); c.rotate(e.lean + lf.side * (0.95 - lf.u * 0.4));
      flame(size, fl); fillPath(F.leaf, 0.6);
      if (!p.mono) { c.scale(0.55, 0.6); flame(size, fl * 1.3); c.fillStyle = p.neon ? rgba(F.bloom[2], 0.6) : F.bloom[2]; c.fill(); }
      c.restore();
    }
    const g3 = clamp((pl.g - 0.55) / 0.45, 0, 1);
    if (g3 <= 0) return;
    const fl = 0.85 + (0.15 * Math.sin(t * 9 + e.ph) + 0.08 * Math.sin(t * 23)) * still, br = e.br * outBack(g3) * (1 + 0.6 * bl);
    drawGlow(tx, ty, br * 5 * fl * (1 + bl), F.bloom[1], 0.75);
    c.save(); c.translate(tx, ty);
    if (bl > 0.05) { c.save(); c.translate(0, -br * 0.5); flame(br * 1.8 * bl, Math.sin(t * 8) * 0.2 * still); fillPath(F.bloom[2], 0.5); c.restore(); }
    circ(0, 0, br); fillPath(F.bloom[1], 0.7);
    if (!p.mono) { c.globalAlpha = fl; c.fillStyle = F.bloom[0]; circ(-br * 0.2, -br * 0.2, br * 0.55); c.fill(); c.globalAlpha = 1; }
    c.strokeStyle = p.mono ? p.ink : tint(F.stemDark); c.lineWidth = 0.7; c.beginPath();
    for (let k = 0; k < 3; k++) { const a = e.ph + k * 2.1; c.moveTo(0, 0); c.lineTo(Math.cos(a) * br * 0.9, Math.sin(a) * br * 0.9); }
    c.stroke();
    c.restore();
  }

  function drawGrid() {
    if (!S.settings.grid) return;
    const B = S.lv.bodies, P = S.P, sim = Sim(), c = S.ctx, p = S.pal, step = 50, M = B.map((b) => sim.massOf(b));
    c.fillStyle = rgba(p.grid, p.gridA * elemAlpha());
    for (let gx = step / 2; gx < WORLD_W; gx += step) {
      for (let gy = step / 2; gy < WORLD_H; gy += step) {
        let dx = 0, dy = 0, inside = false;
        for (let i = 0; i < B.length; i++) {
          const ex = P[i][0] - gx, ey = P[i][1] - gy, d2 = ex * ex + ey * ey, d = Math.sqrt(d2) || 1;
          if (d < B[i].r + 6) { inside = true; break; }
          const f = (M[i] / (d2 + 2000)) * 0.09;
          dx += (ex / d) * f; dy += (ey / d) * f;
        }
        if (inside) continue;
        const m = Math.hypot(dx, dy), cap = 22;
        if (m > cap) { dx *= cap / m; dy *= cap / m; }
        const sz = 1.6 + (Math.min(m, cap) / cap) * 1.6;
        c.fillRect(gx + dx - sz / 2, gy + dy - sz / 2, sz, sz);
      }
    }
  }

  function drawOrbits() {
    const c = S.ctx, p = S.pal, B = S.lv.bodies;
    if (!B.some((b) => b.orbit)) return;
    c.strokeStyle = rgba(p.light ? p.ink : p.neon ? p.grid : p.paper, (p.light ? 0.22 : p.neon ? 0.3 : 0.22) * elemAlpha());
    c.lineWidth = lw(1.5); c.setLineDash([3, 9]); c.lineDashOffset = -S.ambT * 5;
    B.forEach((b) => {
      if (!b.orbit) return;
      const o = b.orbit, ctr = o.p != null ? S.P[o.p] : [o.cx, o.cy];
      circ(ctr[0], ctr[1], o.R); c.stroke();
    });
    c.setLineDash([]);
  }

  function drawWinds() {
    const c = S.ctx, p = S.pal, t = S.ambT, al = elemAlpha();
    for (const w of S.lv.winds) {
      const mag = Math.hypot(w.ax, w.ay);
      if (mag < 1e-6) continue;
      const ux = w.ax / mag, uy = w.ay / mag, col = p.wind;
      c.fillStyle = rgba(col, (p.light ? 0.07 : 0.045) * al); c.fillRect(w.x, w.y, w.w, w.h);
      c.setLineDash([3, 9]); c.strokeStyle = rgba(col, 0.2 * al); c.lineWidth = lw(1); c.strokeRect(w.x, w.y, w.w, w.h); c.setLineDash([]);
      c.save(); c.beginPath(); c.rect(w.x, w.y, w.w, w.h); c.clip();
      const travel = t * (40 + mag * 1.6);
      c.beginPath();
      for (const s of w.streaks) {
        const x = w.x + wrapMod(s.u * w.w + ux * travel * s.sp, w.w), y = w.y + wrapMod(s.v * w.h + uy * travel * s.sp, w.h), len = s.l * (0.6 + mag / 150);
        c.moveTo(x, y); c.lineTo(x - ux * len, y - uy * len);
      }
      c.strokeStyle = rgba(col, (p.neon ? 0.6 : 0.38) * al); c.lineWidth = lw(1.6); c.lineCap = "round"; c.stroke();
      c.restore();
      c.save(); c.translate(w.x + w.w / 2, w.y + w.h / 2); c.rotate(Math.atan2(uy, ux));
      c.lineWidth = lw(3); c.lineCap = "round";
      for (let k = 0; k < 3; k++) {
        const ph = wrapMod(t * 0.8 + k / 3, 1), x = -24 + ph * 48;
        c.strokeStyle = rgba(col, Math.sin(ph * Math.PI) * 0.35 * al);
        c.beginPath(); c.moveTo(x - 8, -12); c.lineTo(x + 4, 0); c.lineTo(x - 8, 12); c.stroke();
      }
      c.restore();
    }
  }

  function drawSwirl(x, y, col, dir, fl) {
    const c = S.ctx, p = S.pal, t = S.ambT, R = Sim().PORTAL_R * (1 + fl * 0.4);
    drawGlow(x, y, R * 2.4, col, 0.5 + fl * 0.5);
    c.save(); c.translate(x, y);
    circ(0, 0, R * 0.95); c.fillStyle = p.mono ? p.paper : p.light ? rgba(col, 0.15) : rgba(p.bg[2], 0.75); c.fill();
    c.strokeStyle = col; c.lineWidth = lw(2.4); c.lineCap = "round";
    for (let j = 0; j < 3; j++) {
      c.beginPath();
      for (let k = 0; k <= 12; k++) {
        const u = k / 12, rr = R * (1 - u * 0.85), a = (j * TAU) / 3 + dir * (u * 3.2 + t * 2.2);
        if (k === 0) c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      c.stroke();
    }
    c.setLineDash([5, 6]); c.lineDashOffset = t * 20 * dir; circ(0, 0, R); c.stroke(); c.setLineDash([]);
    circ(0, 0, 3.5); c.fillStyle = p.mono ? p.ink : p.light ? col : "#ffffff"; c.fill();
    c.restore();
  }

  function drawPortals() {
    const c = S.ctx, p = S.pal, t = S.ambT, lv = S.lv, al = elemAlpha();
    if (!lv.portals.length) return;
    c.globalAlpha = al;
    lv.portals.forEach((pt, k) => {
      const col = p.portals[k % 3], fl = lv.fx.portal[k].flare;
      c.setLineDash([2, 12]); c.lineDashOffset = -t * 30; c.strokeStyle = rgba(col, p.light ? 0.4 : 0.25); c.lineWidth = lw(2);
      c.beginPath(); c.moveTo(pt.a[0], pt.a[1]); c.lineTo(pt.b[0], pt.b[1]); c.stroke(); c.setLineDash([]);
      c.fillStyle = rgba(col, 0.6);
      for (let j = 0; j < 3; j++) {
        const u = wrapMod(t * 0.12 + j / 3, 1), e = u < 0.5 ? u * 2 : 2 - u * 2;
        circ(lerp(pt.a[0], pt.b[0], e), lerp(pt.a[1], pt.b[1], e), 2.2); c.fill();
      }
      drawSwirl(pt.a[0], pt.a[1], col, 1, fl);
      drawSwirl(pt.b[0], pt.b[1], col, -1, fl);
    });
    c.globalAlpha = 1;
  }

  function drawBoosts() {
    const c = S.ctx, p = S.pal, t = S.ambT, lv = S.lv, al = elemAlpha();
    lv.boosts.forEach((g, k) => {
      const f = lv.fx.boost[k], col = p.boost, R = Sim().BOOST_R * (1 + f.flare * 0.5), mult = g.mult != null ? g.mult : 1.4;
      let dir = null;
      if (g.ang != null) dir = g.ang;
      else if (S.seed) dir = Math.atan2(S.seed.vy, S.seed.vx);
      else if (f.flare > 0) dir = f.dir;
      c.globalAlpha = al;
      drawGlow(g.x, g.y, R * 2.3, col, 0.3 + f.flare * 0.7);
      c.save(); c.translate(g.x, g.y);
      c.strokeStyle = col; c.lineWidth = lw(2.5); circ(0, 0, R); c.stroke();
      c.save(); c.rotate(t * 0.9); c.setLineDash([3, 5]); c.lineWidth = lw(1.2); circ(0, 0, R * 0.72); c.stroke(); c.setLineDash([]); c.restore();
      c.lineCap = "round"; c.lineJoin = "round";
      if (dir == null) {
        c.rotate(t * 0.6); c.lineWidth = lw(2);
        for (let j = 0; j < 4; j++) {
          c.rotate(TAU / 4); const x = R + 5 + Math.sin(t * 3 + j) * 2;
          c.beginPath(); c.moveTo(x, -5); c.lineTo(x + 5, 0); c.lineTo(x, 5); c.stroke();
        }
      } else {
        c.rotate(dir);
        const n = mult >= 1.35 ? 3 : mult >= 1.05 ? 2 : 1, back = mult < 1 ? -1 : 1;
        c.lineWidth = lw(3);
        for (let j = 0; j < n; j++) {
          const ph = wrapMod(t * 1.6 + j / n, 1), x = (-R * 0.55 + ph * R * 1.1) * back;
          c.strokeStyle = rgba(col, Math.sin(ph * Math.PI) * 0.9 + 0.1);
          c.beginPath(); c.moveTo(x - 5 * back, -8); c.lineTo(x + 3 * back, 0); c.lineTo(x - 5 * back, 8); c.stroke();
        }
        if (g.ang != null) { c.fillStyle = col; c.beginPath(); c.moveTo(R + 9, 0); c.lineTo(R + 1, -5); c.lineTo(R + 1, 5); c.fill(); }
      }
      c.restore();
      c.globalAlpha = 1;
    });
  }

  function drawPollen() {
    const c = S.ctx, p = S.pal, t = S.ambT, lv = S.lv, al = elemAlpha();
    lv.pollen.forEach((q, k) => {
      const f = lv.fx.pollen[k];
      if (S.pollenGot[k] && (f.t < 0 || f.t > 0.5)) return;
      const pop = f.t >= 0 ? f.t / 0.5 : 0, sc = 1 + pop * 1.6, a = (1 - pop) * al;
      const x = q[0] + Math.cos(t * 1.3 + k) * 2, y = q[1] + Math.sin(t * 2 + k * 1.7) * 5;
      drawGlow(x, y, 30 * sc, p.pollen, 0.6 * a);
      c.globalAlpha = a;
      c.save(); c.translate(x, y); c.scale(sc, sc);
      c.fillStyle = rgba(p.pollen, 0.8);
      for (let j = 0; j < 3; j++) { const b = t * 1.4 + (j * TAU) / 3 + k; c.fillRect(Math.cos(b) * 12 - 0.9, Math.sin(b) * 12 - 0.9, 1.8, 1.8); }
      c.rotate(t * 0.8 + k);
      c.strokeStyle = p.mono ? p.ink : p.light ? tint(p.pollen) : p.pollen; c.lineWidth = lw(1.3); c.beginPath();
      for (let j = 0; j < 8; j++) { const b = (j / 8) * TAU; c.moveTo(Math.cos(b) * 5, Math.sin(b) * 5); c.lineTo(Math.cos(b) * 8.5, Math.sin(b) * 8.5); }
      c.stroke();
      circ(0, 0, 5.2); fillPath(p.pollen, lw(1));
      if (!p.mono) { c.fillStyle = "rgba(255,255,255,0.85)"; circ(-1.6, -1.6, 1.6); c.fill(); }
      c.restore();
      c.globalAlpha = 1;
    });
  }

  function endMarker(type, x, y, alpha) {
    const c = S.ctx, p = S.pal, F = p.fl;
    const col = p.mono ? p.ink : type === "plant" ? tint(F.bloom[0]) : type === "burn" ? p.sun : type === "swallow" ? p.bhDisk : type === "shield" ? p.shield : type === "lost" ? p.preview : p.light ? p.barrenDark : "#b8bbdd";
    const shape = () => {
      c.beginPath();
      if (type === "plant") {
        for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU - Math.PI / 2; c.moveTo(x + Math.cos(a) * 12, y + Math.sin(a) * 12); c.arc(x + Math.cos(a) * 9, y + Math.sin(a) * 9, 3.2, 0, TAU); }
        c.moveTo(x + 3.5, y); c.arc(x, y, 3.5, 0, TAU);
      } else if (type === "burn") {
        for (let k = 0; k < 16; k++) { const a = (k / 16) * TAU, r = k % 2 ? 5 : 12; if (k) c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); else c.moveTo(x + r, y); }
        c.closePath();
      } else if (type === "swallow") {
        for (let k = 0; k <= 24; k++) { const u = k / 24, a = u * TAU * 1.6, r = 11 * (1 - u * 0.85); if (k) c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); else c.moveTo(x + r, y); }
      } else if (type === "shield") {
        c.moveTo(x - 9, y - 9); c.lineTo(x - 9, y + 9); c.moveTo(x - 3, y - 9); c.lineTo(x - 3, y + 9); c.moveTo(x + 4, y - 6); c.lineTo(x + 10, y); c.lineTo(x + 4, y + 6);
      } else if (type === "lost") {
        c.arc(x, y, 9, 0, TAU); c.moveTo(x - 4, y); c.lineTo(x + 4, y); c.moveTo(x + 1, y - 3); c.lineTo(x + 4, y); c.lineTo(x + 1, y + 3);
      } else {
        c.moveTo(x - 8, y - 8); c.lineTo(x + 8, y + 8); c.moveTo(x + 8, y - 8); c.lineTo(x - 8, y + 8);
      }
    };
    c.save(); c.translate(x, y); if (S.view.th) c.rotate(-S.view.th);
    x = 0; y = 0;
    c.globalAlpha = alpha; c.lineCap = "round"; c.lineJoin = "round";
    shape();
    c.strokeStyle = p.light ? p.paper : p.neon ? "#000000" : "#0b0e20"; c.lineWidth = lw(S.settings.colorblind ? 6 : 4.5); c.stroke();
    c.strokeStyle = col; c.lineWidth = lw(2.2); c.stroke();
    if (type === "plant" && !p.mono) { c.fillStyle = rgba(col, 0.5); c.fill(); }
    c.globalAlpha = 1;
    c.restore();
  }

  function drawPreview() {
    const pv = S.pv;
    if (!pv) return;
    const c = S.ctx, p = S.pal, lv = S.lv, col = p.preview, k = (S.mode === "showcase" ? 0.55 : 1) * clamp(launcherScale(), 0, 1);
    const sc = clamp(0.9 / S.view.s, 0.9, 2.2);
    for (const q of pv.pts) {
      if (!q) continue;
      const a = 1 - q[2];
      c.fillStyle = rgba(col, (0.15 + a * 0.75) * k); circ(q[0], q[1], (1.4 + a * 2.2) * sc); c.fill();
    }
    for (const m of pv.marks) {
      c.strokeStyle = rgba(m.t === "pollen" ? p.pollen : col, 0.8 * k); c.lineWidth = lw(1.5);
      if (m.t === "warp") { circ(m.x, m.y, 7); c.stroke(); circ(m.x, m.y, 3); c.stroke(); }
      else if (m.t === "pollen") { c.beginPath(); for (let j = 0; j < 4; j++) { const a = (j / 4) * Math.PI; c.moveTo(m.x + Math.cos(a) * 8, m.y + Math.sin(a) * 8); c.lineTo(m.x - Math.cos(a) * 8, m.y - Math.sin(a) * 8); } c.stroke(); }
      else { circ(m.x, m.y, 6); c.stroke(); }
    }
    if (pv.end) endMarker(pv.end.type, pv.end.x, pv.end.y, k);
    if (lv.bodies.some((b) => b.orbit)) {
      const T2 = S.T + Math.min(lv.preview * (S.settings.assist ? 1.6 : 1), 1.2);
      c.strokeStyle = rgba(p.light ? p.ink : p.paper, 0.2 * k); c.setLineDash([4, 6]); c.lineWidth = lw(1.5);
      lv.bodies.forEach((b, i) => {
        if (!b.orbit) return;
        const g = Sim().bodyPos(lv.bodies, i, T2);
        circ(g[0], g[1], b.r); c.stroke();
      });
      c.setLineDash([]);
    }
  }

  function seedShape(a, k, sp) {
    const c = S.ctx, p = S.pal;
    c.rotate(a); c.scale(k * (1 + sp * 0.35), k * (1 - sp * 0.18));
    c.beginPath(); c.ellipse(0, 0, 7, 4.5, 0, 0, TAU);
    if (p.mono) { c.fillStyle = p.ink; c.fill(); c.strokeStyle = p.paper; c.lineWidth = lw(1.2); c.stroke(); }
    else fillPath(p.seed, 1);
    c.beginPath(); c.ellipse(-2, 0, 4, 3.2, 0, 0, TAU); c.fillStyle = p.mono ? p.paper : p.seed2; c.fill();
  }

  function drawLauncher() {
    const lv = S.lv, c = S.ctx, p = S.pal, t = S.ambT, lx = lv.launch[0], ly = lv.launch[1], sc = launcherScale();
    if (sc <= 0.01) return;
    c.save(); c.translate(lx, ly); c.scale(sc, sc);
    c.strokeStyle = rgba(p.light ? p.ink : p.paper, 0.16); c.lineWidth = lw(1.5); c.setLineDash([3, 7]); c.lineDashOffset = t * 6;
    circ(0, 0, 70); c.stroke(); c.setLineDash([]);
    const ready = !S.seed && S.seedsLeft > 0 && (S.phase === "play" || S.phase === "intro") && (S.mode === "showcase" ? !!(S.bot && S.bot.state === "aim") : S.mode === "play" && !(S.demo && S.demo.state === "done"));
    const ang = S.aim.ang, dx = Math.cos(ang), dy = Math.sin(ang);
    if (ready) {
      const pow = S.aim.pow, trem = pow > 0.85 && !rm() && S.drag ? (Math.random() - 0.5) * pow * 3 : 0, pull = 14 + pow * 48 + trem;
      const cc = p.mono ? p.ink : mix(p.preview, p.launcher, pow);
      drawGlow(0, 0, 30 + pow * 55, cc, 0.15 + pow * 0.4);
      c.lineCap = "butt";
      c.strokeStyle = rgba(cc, 0.18); c.lineWidth = lw(5); circ(0, 0, 34); c.stroke();
      c.strokeStyle = cc; c.lineWidth = lw(5);
      c.beginPath(); c.arc(0, 0, 34, ang + Math.PI - pow * Math.PI, ang + Math.PI + pow * Math.PI); c.stroke();
      c.strokeStyle = rgba(p.light ? p.paper : "#000000", 0.5); c.lineWidth = lw(1.2); c.beginPath();
      for (let k = 1; k < 10; k++) { const a = ang + Math.PI + (k / 10 - 0.5) * TAU; c.moveTo(Math.cos(a) * 31, Math.sin(a) * 31); c.lineTo(Math.cos(a) * 37, Math.sin(a) * 37); }
      c.stroke();
      c.lineCap = "round";
      c.strokeStyle = rgba(p.mono ? p.ink : p.launcher, 0.85); c.lineWidth = lw(2);
      c.beginPath(); c.moveTo(-dy * 16, dx * 16); c.lineTo(-dx * pull, -dy * pull); c.lineTo(dy * 16, -dx * 16); c.stroke();
      const tipL = 40 + pow * 62;
      c.strokeStyle = p.mono ? p.ink : p.preview; c.lineWidth = lw(3);
      c.beginPath(); c.moveTo(dx * 40, dy * 40); c.lineTo(dx * tipL, dy * tipL); c.stroke();
      c.beginPath();
      c.moveTo(dx * tipL + Math.cos(ang + 2.6) * 10, dy * tipL + Math.sin(ang + 2.6) * 10); c.lineTo(dx * tipL, dy * tipL);
      c.lineTo(dx * tipL + Math.cos(ang - 2.6) * 10, dy * tipL + Math.sin(ang - 2.6) * 10); c.stroke();
      c.save(); c.translate(-dx * pull * 0.6, -dy * pull * 0.6); seedShape(ang, 1.4, 0); c.restore();
    }
    const rc = S.recoil, sq = rc > 0 && !rm() ? Math.sin(rc * 12) * rc * 0.3 : 0, ch = ready && S.drag ? S.aim.pow * 0.12 : 0, la = ang + S.view.th;
    if (S.view.th) c.rotate(-S.view.th);
    c.save(); c.rotate(la); c.scale(1 + sq - ch, 1 - sq + ch * 0.6); c.rotate(-la);
    if (p.shadow) { c.fillStyle = p.launcherDark; c.beginPath(); c.ellipse(4, 4, 18, 13, 0, 0, TAU); c.fill(); }
    if (p.skin === "daylight") { c.globalAlpha = 0.45; c.fillStyle = p.riso; c.beginPath(); c.ellipse(3, 3, 18, 13, 0, 0, TAU); c.fill(); c.globalAlpha = 1; }
    if (p.neon) drawGlow(0, 0, 36, p.launcher, 0.5);
    c.beginPath(); c.ellipse(0, 0, 18, 13, 0, 0, TAU); fillPath(p.launcher, lw(2));
    if (p.mono) { c.fillStyle = pattern("hatch"); c.beginPath(); c.ellipse(3, 3, 14, 9, 0, 0, TAU); c.fill(); }
    else { c.fillStyle = p.neon ? rgba("#ffffff", 0.5) : rgba("#ffffff", 0.35); c.beginPath(); c.ellipse(-5, -4, 6, 3.5, -0.3, 0, TAU); c.fill(); }
    c.restore();
    const sway = rm() ? 0 : Math.sin(t * 2) * 2;
    c.strokeStyle = tint(p.fl.stem); c.lineWidth = lw(2.5); c.lineCap = "round";
    c.beginPath(); c.moveTo(0, -12); c.quadraticCurveTo(2, -20, sway + 1, -26); c.stroke();
    c.beginPath(); c.ellipse(sway + 6, -25, 6, 3, -0.4, 0, TAU); fillPath(p.fl.leaf, lw(0.8));
    c.restore();
  }

  function drawTrail() {
    const tr = S.trail;
    if (tr.length < 2) return;
    const c = S.ctx, p = S.pal, kind = S.settings.trail;
    c.lineCap = "round"; c.lineJoin = "round";
    if (p.neon) c.globalCompositeOperation = "lighter";
    if (kind === "comet") trailComet(tr);
    else if (kind === "petal") trailPetal(tr);
    else if (kind === "ember") trailEmber(tr);
    else if (kind === "prism") trailPrism(tr);
    else trailClassic(tr);
    c.globalCompositeOperation = "source-over"; c.globalAlpha = 1;
  }

  function seg(a, b, col, w) {
    const c = S.ctx;
    c.strokeStyle = col; c.lineWidth = w;
    c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
  }

  function trailClassic(tr) {
    const p = S.pal;
    for (let i = 1; i < tr.length; i++) {
      const a = tr[i - 1], b = tr[i];
      if (!a || !b) continue;
      const f = i / tr.length;
      seg(a, b, rgba(p.trail, f * (p.mono ? 0.9 : 0.7)), (p.mono ? 0.6 : 1) + f * (p.mono ? 2.5 : 4.5));
    }
  }

  function trailComet(tr) {
    const p = S.pal, n = tr.length;
    if (p.mono) {
      for (let i = 1; i < n; i++) { const a = tr[i - 1], b = tr[i]; if (a && b) seg(a, b, p.ink, 1.6 + (i / n) * 10); }
      for (let i = 1; i < n; i++) { const a = tr[i - 1], b = tr[i], w = (i / n) * 10 - 1.6; if (a && b && w > 0.3) seg(a, b, p.paper, w); }
      return;
    }
    const core = p.light ? p.seed2 : "#ffffff";
    for (let i = 2; i < n; i += 2) { const a = tr[i - 2], b = tr[i], f = i / n; if (a && b) seg(a, b, rgba(p.trail, f * 0.16), 6 + f * 18); }
    for (let i = 1; i < n; i++) { const a = tr[i - 1], b = tr[i], f = i / n; if (a && b) seg(a, b, rgba(mix(p.trail, p.seed, f), f * 0.9), 1 + f * 8); }
    for (let i = Math.floor(n * 0.55); i < n; i++) { const a = tr[i - 1], b = tr[i], f = (i / n - 0.55) / 0.45; if (a && b) seg(a, b, rgba(core, f * 0.9), 0.5 + f * 2.6); }
  }

  function trailPetal(tr) {
    const c = S.ctx, p = S.pal, F = p.fl, n = tr.length, base = S.trailN - n, still = rm();
    for (let i = 1; i < n; i++) {
      const a = tr[i - 1], b = tr[i];
      if (a && b) seg(a, b, rgba(p.mono ? p.ink : tint(F.stem), (i / n) * 0.45), 0.8 + (i / n) * 1.6);
    }
    for (let i = 1; i < n - 1; i++) {
      const id = base + i;
      if (id % 7 !== 0) continue;
      const q = tr[i], a = tr[i - 1] || q, b = tr[i + 1] || q;
      if (!q) continue;
      const f = i / n, side = (id / 7) % 2 ? 1 : -1, dir = Math.atan2(b[1] - a[1], b[0] - a[0]);
      const age = 1 - f, drift = still ? 0 : age * 8, spin = still ? 0 : S.ambT * 1.4 * side;
      const ox = Math.cos(dir + side * Math.PI / 2) * (4 + drift), oy = Math.sin(dir + side * Math.PI / 2) * (4 + drift);
      const sz = 0.55 + f * 0.75;
      c.save(); c.translate(q[0] + ox, q[1] + oy); c.rotate(dir + side * 0.8 + spin); c.scale(sz, sz);
      c.globalAlpha = p.mono ? 0.5 + f * 0.5 : 0.25 + f * 0.75;
      c.beginPath(); c.ellipse(0, 0, 6, 2.8, 0, 0, TAU);
      fillPath(tint(F.bloom[Math.floor(id / 7) % F.bloom.length]), 0.9);
      c.restore();
    }
    c.globalAlpha = 1;
  }

  const EMBER_COLS = ["#7a3024", "#ff4d2e", "#ffb347", "#fff1c9"], EMBER_INK = ["#6a2418", "#b8321c", "#e0561a", "#f08a1c"];

  function trailEmber(tr) {
    const c = S.ctx, p = S.pal, n = tr.length, base = S.trailN - n, still = rm();
    for (let i = 1; i < n; i++) {
      const q = tr[i], id = base + i;
      if (!q || id % 2) continue;
      const f = i / n, h = ((id * 2654435761) >>> 0) / 4294967296, age = 1 - f;
      const fl = still ? 1 : 0.6 + 0.4 * Math.sin(id * 1.7 + S.time * 22);
      const rise = age * age * 16, x = q[0] + (h - 0.5) * age * 12 - rise * S.view.b, y = q[1] - rise * S.view.d + (h - 0.5) * 4, r = (0.7 + f * 2.2) * (0.7 + h * 0.6);
      if (p.mono) { c.fillStyle = rgba(p.ink, 0.25 + f * 0.75); c.fillRect(x - r * 0.6, y - r * 0.6, r * 1.2, r * 1.2); continue; }
      const ci = Math.min(3, Math.floor(f * 3.6 + h * 0.4)), col = EMBER_COLS[ci], cc = p.light ? EMBER_INK[ci] : col;
      if (id % 8 === 0 && f > 0.4) drawGlow(x, y, 10 + f * 10, col, 0.35 * f * fl);
      c.fillStyle = rgba(cc, (0.2 + f * 0.8) * fl); circ(x, y, r); c.fill();
    }
  }

  function trailPrism(tr) {
    const c = S.ctx, p = S.pal, n = tr.length, base = S.trailN - n, still = rm(), L = p.light ? 42 : p.neon ? 62 : 68;
    const shift = still ? 0 : Math.round(S.time * 90);
    for (let k = -1; k <= 1; k++) {
      for (let i = 1; i < n; i++) {
        const a = tr[i - 1], b = tr[i];
        if (!a || !b) continue;
        const f = i / n, d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = -(b[1] - a[1]) / d, ny = (b[0] - a[0]) / d;
        const off = k * (1.2 + (1 - f) * 7), ox = nx * off, oy = ny * off;
        const col = p.mono ? rgba(p.ink, 0.2 + f * 0.7) : "hsla(" + (((base + i) * 6 + shift + k * 120) % 360 + 360) % 360 + ",95%," + L + "%," + (f * 0.85).toFixed(2) + ")";
        c.strokeStyle = col; c.lineWidth = p.mono ? 0.6 + f * 1.1 : 0.8 + f * 2.2;
        c.beginPath(); c.moveTo(a[0] + ox, a[1] + oy); c.lineTo(b[0] + ox, b[1] + oy); c.stroke();
      }
    }
  }

  function guideText(txt, x, y, fs, col, align) {
    const c = S.ctx, p = S.pal;
    c.font = "600 " + fs.toFixed(1) + 'px "Atkinson Hyperlegible Mono", ui-monospace, monospace';
    c.textAlign = align || "center"; c.textBaseline = "middle";
    c.lineJoin = "round"; c.strokeStyle = p.light ? p.paper : p.neon ? "#07000f" : "#0b0e20"; c.lineWidth = fs * 0.32;
    c.save(); c.translate(x, y); if (S.view.th) c.rotate(-S.view.th);
    c.strokeText(txt, 0, 0);
    c.fillStyle = col; c.fillText(txt, 0, 0);
    c.restore();
  }

  function drawGuides() {
    const g = S.guides;
    if (!g || S.demo || S.mode !== "play" || !(S.phase === "play" || S.phase === "intro")) return;
    const k0 = launcherScale();
    if (k0 <= 0.05) return;
    const c = S.ctx, p = S.pal, lx = S.lv.launch[0], ly = S.lv.launch[1], next = S.used, fs = clamp(12 / S.view.s, 10, 56);
    const base = p.light ? p.ink : p.paper, hi = p.mono ? p.ink : p.preview;
    const R = fs * 0.78, spots = [], taken = [], order = g.shots.map((_, j) => j).sort((x, y) => (x === next ? -1 : y === next ? 1 : x - y));
    for (const j of order) {
      const sh = g.shots[j], dx = Math.cos(sh[0]), dy = Math.sin(sh[0]);
      let d = 44 + clamp(sh[1], 0, 1) * 220 + R + 6;
      for (let n = 0; n < 16 && taken.some((o) => Math.hypot(o[0] - (lx + dx * d), o[1] - (ly + dy * d)) < R * 2.1); n++) d += R * 1.2;
      spots[j] = [lx + dx * d, ly + dy * d];
      taken.push(spots[j]);
      if (j === next && S.moving) for (let x = R * 1.6; x < fs * 11; x += R) taken.push(scrOff(spots[j][0], spots[j][1], x, 0));
    }
    c.save(); c.globalAlpha = k0; c.lineCap = "round";
    for (let j = g.shots.length - 1; j >= 0; j--) {
      const sh = g.shots[j], dx = Math.cos(sh[0]), dy = Math.sin(sh[0]), r0 = 44, r1 = r0 + clamp(sh[1], 0, 1) * 220;
      const isNext = j === next, done = j < next, col = isNext ? hi : base;
      c.strokeStyle = rgba(col, isNext ? 0.9 : done ? 0.14 : 0.32); c.lineWidth = lw(isNext ? 2.6 : 1.5);
      c.setLineDash(isNext ? [] : [5, 7]);
      c.beginPath(); c.moveTo(lx + dx * r0, ly + dy * r0); c.lineTo(lx + dx * r1, ly + dy * r1); c.stroke();
      c.setLineDash([]);
      if (isNext) {
        c.beginPath();
        c.moveTo(lx + dx * r1 + Math.cos(sh[0] + 2.6) * 9, ly + dy * r1 + Math.sin(sh[0] + 2.6) * 9); c.lineTo(lx + dx * r1, ly + dy * r1);
        c.lineTo(lx + dx * r1 + Math.cos(sh[0] - 2.6) * 9, ly + dy * r1 + Math.sin(sh[0] - 2.6) * 9); c.stroke();
      }
      const bx = spots[j][0], by = spots[j][1];
      c.globalAlpha = k0 * (isNext ? 1 : done ? 0.35 : 0.7);
      circ(bx, by, R); c.fillStyle = p.light ? p.paper : p.neon ? "#07000f" : "#10142a"; c.fill();
      c.strokeStyle = col; c.lineWidth = lw(isNext ? 2 : 1.2); c.stroke();
      const lp = scrOff(bx, by, 0, fs * 0.04);
      guideText(String(j + 1), lp[0], lp[1], fs * 0.9, col);
      if (isNext && S.moving) {
        const rem = (sh[2] - S.step) * DT, tp = scrOff(bx, by, R + fs * 0.4, 0);
        const txt = rem > 0.1 ? "in " + rem.toFixed(1) + "s" : rem > -0.25 ? "now" : "missed \u2014 R to retry";
        const tc = rem > 0.1 ? base : rem > -0.25 ? hi : p.mono ? p.ink : p.rep;
        guideText(txt, tp[0], tp[1], fs * (rem > 0.1 || rem <= -0.25 ? 0.95 : 1.15), tc, "left");
      }
      c.globalAlpha = k0;
    }
    c.restore();
  }

  function drawFastCue() {
    if (!S.fast || !(S.demo || S.seed)) return;
    const c = S.ctx, p = S.pal, o = scrOff(S.lv.launch[0], S.lv.launch[1], 0, 96), fs = clamp(12 / S.view.s, 10, 56), col = p.light ? p.ink : p.paper;
    const ph = rm() ? 0 : (S.time * 3) % 1;
    c.save(); c.lineCap = "round"; c.lineJoin = "round"; c.lineWidth = lw(2.2);
    for (let k = 0; k < 2; k++) {
      c.strokeStyle = rgba(col, 0.45 + 0.4 * (rm() ? 1 : Math.abs(Math.sin((ph + k * 0.5) * Math.PI))));
      const x = -fs * 0.9 + k * fs * 0.6, q0 = scrOff(o[0], o[1], x, -fs * 0.4), q1 = scrOff(o[0], o[1], x + fs * 0.4, 0), q2 = scrOff(o[0], o[1], x, fs * 0.4);
      c.beginPath(); c.moveTo(q0[0], q0[1]); c.lineTo(q1[0], q1[1]); c.lineTo(q2[0], q2[1]); c.stroke();
    }
    const tp = scrOff(o[0], o[1], fs * 0.4, 0);
    guideText("\u00d7" + (S.demo ? S.demo.speed * demoRate() : 3).toFixed(1).replace(/\.0$/, ""), tp[0], tp[1], fs * 0.9, col, "left");
    c.restore();
  }

  function drawSeed() {
    const s = S.seed;
    if (!s) return;
    const c = S.ctx, p = S.pal, sp = Math.min(1.5, Math.hypot(s.vx, s.vy) / 820);
    drawGlow(s.x, s.y, 30, p.seed, 0.65);
    if (S.demo) {
      const pu = rm() ? 0.5 : 0.5 + 0.5 * Math.sin(S.time * 5);
      drawGlow(s.x, s.y, 46, S.theme.glow, 0.25 + pu * 0.15);
      c.strokeStyle = rgba(p.light ? p.ink : p.paper, 0.35 + pu * 0.25); c.lineWidth = lw(1.3); c.setLineDash([3, 4]);
      circ(s.x, s.y, 14 + pu * 3); c.stroke(); c.setLineDash([]);
    }
    c.save(); c.translate(s.x, s.y); seedShape(Math.atan2(s.vy, s.vx), 1.25 * clamp(0.55 / S.view.s, 1, 1.6), sp); c.restore();
  }

  function drawFx() {
    const c = S.ctx, p = S.pal;
    for (const r of S.rings) {
      if (r.t < 0) continue;
      const f = r.t / r.dur, e = outCubic(f);
      c.strokeStyle = rgba(p.mono ? p.ink : r.c, 1 - f); c.lineWidth = lw(r.lw * (1 - f) + 0.5);
      circ(r.x, r.y, lerp(r.r0, r.r1, e)); c.stroke();
    }
    if (p.neon) c.globalCompositeOperation = "lighter";
    for (const q of S.parts) {
      const a = clamp(q.life / q.max, 0, 1), col = p.mono ? p.ink : q.c;
      c.globalAlpha = q.k === "confetti" ? Math.min(1, a * 3) : a;
      if (q.k === "spark") {
        c.strokeStyle = col; c.lineWidth = q.s * 0.7; c.lineCap = "round";
        c.beginPath(); c.moveTo(q.x, q.y); c.lineTo(q.x - q.vx * 0.03, q.y - q.vy * 0.03); c.stroke();
      } else if (q.k === "petal" || q.k === "confetti" || q.k === "shard") {
        const cs = Math.cos(q.rot), sn = Math.sin(q.rot), fl = q.k === "confetti" ? Math.cos(q.rot * 1.7) : 1;
        const v = S.view, D = S.DPR * v.s, xa = cs * fl, xb = sn * fl;
        c.fillStyle = col;
        c.beginPath();
        c.setTransform(D * (v.a * xa + v.c * xb), D * (v.b * xa + v.d * xb), D * (v.c * cs - v.a * sn), D * (v.d * cs - v.b * sn), S.DPR * (v.ox + v.s * (v.a * q.x + v.c * q.y)), S.DPR * (v.oy + v.s * (v.b * q.x + v.d * q.y)));
        if (q.k === "shard") { c.moveTo(-q.s, -q.s * 0.6); c.lineTo(q.s, 0); c.lineTo(-q.s * 0.4, q.s * 0.7); c.closePath(); }
        else c.ellipse(0, 0, q.s, q.s * 0.5, 0, 0, TAU);
        c.fill();
        worldXf();
      } else if (q.k === "ember") {
        c.globalAlpha = 1;
        drawGlow(q.x, q.y, 7, q.c, a * 0.8);
        if (p.neon) c.globalCompositeOperation = "lighter";
        c.globalAlpha = a; c.fillStyle = col; c.fillRect(q.x - 0.9, q.y - 0.9, 1.8, 1.8);
      } else {
        c.fillStyle = col; circ(q.x, q.y, q.s); c.fill();
      }
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = "source-over";
  }

  function drawStars() {
    const c = S.ctx, p = S.pal, t = S.ambT, still = rm();
    const v = S.view, ex = (WORLD_W / 2 - S.cam.x) * v.s * 0.05, ey = (WORLD_H / 2 - S.cam.y) * v.s * 0.05, px = v.a * ex + v.c * ey, py = v.b * ex + v.d * ey;
    for (const s of S.stars) {
      const a = still ? 0.6 : 0.35 + 0.5 * (0.5 + 0.5 * Math.sin(t * (0.6 + s.d) + s.tw));
      c.globalAlpha = a * s.d * p.starA; c.fillStyle = s.c;
      c.fillRect(s.x + px * s.d, s.y + py * s.d, s.r * 1.4, s.r * 1.4);
    }
    c.globalAlpha = 1;
  }

  function drawSynthGrid() {
    const c = S.ctx, p = S.pal, W = S.W, H = S.H, t = S.ambT, hy = H * 0.68, vx = W / 2;
    c.save(); c.globalCompositeOperation = "lighter"; c.lineWidth = 1;
    c.strokeStyle = rgba(p.grid, 0.4); c.beginPath();
    for (let i = -18; i <= 18; i++) { c.moveTo(vx + i * W * 0.006, hy); c.lineTo(vx + i * W * 0.09, H); }
    c.stroke();
    const off = wrapMod(t * 0.35, 1);
    for (let k = 0; k < 14; k++) {
      const z = (k + off) / 14, y = hy + (H - hy) * z * z;
      c.strokeStyle = rgba(p.grid, 0.1 + 0.5 * z); c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke();
    }
    c.restore();
  }

  function drawLensing() {
    const lv = S.lv, c = S.ctx, p = S.pal;
    lv.bodies.forEach((b, i) => {
      if (b.kind !== "blackhole") return;
      const sc = introScale(i);
      if (sc < 0.05) return;
      const s = toScreen(S.P[i][0], S.P[i][1]), R = b.r * S.view.s * 6 * sc;
      for (let k = 0; k < 2; k++) {
        const rf = k ? 0.55 : 1, zf = k ? 1.9 : 1.35;
        c.save(); circ(s[0], s[1], R * rf); c.clip();
        c.translate(s[0], s[1]); c.rotate(S.ambT * 0.05 * (k ? -1 : 1) + k * 0.5); c.scale(zf, zf); c.translate(-s[0], -s[1]);
        c.drawImage(S.bgC, 0, 0, S.W, S.H);
        c.restore();
      }
      c.strokeStyle = rgba(p.light ? p.ink : "#ffffff", 0.1); c.lineWidth = 1; circ(s[0], s[1], R * 0.55); c.stroke();
    });
  }

  const BUF_SCALE = { aurora: 0.25, nebula: 0.25, clockwork: 0.5 };

  function drawAmbienceBack() {
    const A = S.amb;
    if (!A) return;
    const k = BUF_SCALE[A.kind], p = S.pal;
    if (!k) { ambienceBack(S.ctx, S.pal.mono ? "source-over" : p.light ? "multiply" : "lighter"); return; }
    const hf = A.kind === "aurora" ? 0.62 : 1, bw = Math.ceil(S.W * k), bh = Math.ceil(S.H * hf * k);
    if (!S.ambBuf || S.ambBuf.width !== bw || S.ambBuf.height !== bh) { S.ambBuf = mkCanvas(bw, bh); S.ambKey = ""; }
    const key = A.kind === "clockwork" ? A.gears.map((g) => gearAngle(g).toFixed(3)).join(",") + (S.ambT * 0.05).toFixed(2) : null;
    if (key === null || key !== S.ambKey) {
      S.ambKey = key;
      const b = S.ambBuf.getContext("2d");
      b.setTransform(1, 0, 0, 1, 0, 0); b.clearRect(0, 0, bw, bh); b.setTransform(k, 0, 0, k, 0, 0);
      ambienceBack(b, p.mono || p.light ? "source-over" : "lighter");
    }
    const c = S.ctx;
    c.globalCompositeOperation = p.mono || A.kind === "clockwork" ? "source-over" : p.light ? "multiply" : "lighter";
    c.drawImage(S.ambBuf, 0, 0, S.W, S.H * hf);
    c.globalCompositeOperation = "source-over";
  }

  function gearAngle(g) {
    const tt = S.ambT * (0.5 + g.k * 0.3), tick = Math.floor(tt) + outBack(Math.min(1, (tt % 1) * 3));
    return tick * g.w * 3;
  }

  function ambienceBack(c, op) {
    const A = S.amb, p = S.pal, W = S.W, H = S.H, t = S.ambT, D = S.DPR;
    if (A.kind === "fireflies") {
      for (const b of A.bokeh) {
        const x = b.x * W + Math.sin(t * b.sp + b.ph) * 40, y = b.y * H + Math.cos(t * b.sp * 0.7 + b.ph) * 30;
        if (!p.mono) drawGlow(x, y, b.r, b.c, b.a * (0.6 + 0.4 * Math.sin(t * 0.5 + b.ph)) * (p.light ? 0.6 : 1));
      }
    } else if (A.kind === "aurora") {
      const step = Math.max(10, W / 130);
      for (const rb of A.ribbons) {
        const h = rb.h * H, base = rb.y * H;
        if (p.mono) {
          c.strokeStyle = rgba(p.ink, 0.1); c.lineWidth = 1; c.beginPath();
          for (let x = 0; x < W; x += 7) {
            const y = base + Math.sin(x * 0.004 + t * rb.s1 + rb.ph) * H * 0.05 + Math.sin(x * 0.011 - t * rb.s2) * H * 0.02;
            const a = 0.5 + 0.5 * Math.sin(x * 0.02 + t * rb.s3 + rb.ph);
            c.moveTo(x, y - h * 0.5 * a); c.lineTo(x, y);
          }
          c.stroke();
          continue;
        }
        const spr = stripSprite(rb.c);
        c.globalCompositeOperation = op;
        for (let x = -step; x < W + step; x += step) {
          const y = base + Math.sin(x * 0.004 + t * rb.s1 + rb.ph) * H * 0.05 + Math.sin(x * 0.011 - t * rb.s2) * H * 0.02;
          const f = 0.5 + 0.5 * Math.sin(x * 0.017 + t * rb.s3 + rb.ph) * Math.sin(x * 0.0061 - t * rb.s1 * 1.7), hh = h * (0.45 + 0.55 * f);
          c.globalAlpha = rb.a * 0.5 * (0.15 + 0.85 * f * f) * (p.light ? 0.6 : 1);
          c.drawImage(spr, x, y - hh, step + 1, hh);
        }
        c.globalAlpha = 1; c.globalCompositeOperation = "source-over";
      }
    } else if (A.kind === "nebula") {
      c.globalCompositeOperation = op;
      for (const cl of A.clouds) {
        const size = cl.sz * Math.max(W, H), x = cl.x * W + Math.sin(t * cl.s + cl.ph) * W * 0.04, y = cl.y * H + Math.cos(t * cl.s * 0.8 + cl.ph) * H * 0.04;
        c.save(); c.translate(x, y); c.rotate(cl.rot + t * cl.w);
        c.globalAlpha = cl.a * (p.mono ? 1 : p.light ? 0.3 : 0.32);
        c.drawImage(cl.spr, -size / 2, -size / 2, size, size);
        c.restore();
      }
      c.globalAlpha = 1; c.globalCompositeOperation = "source-over";
    } else if (A.kind === "clockwork") {
      A.gears.forEach((g) => {
        c.save(); c.translate(g.x * W, g.y * H); c.rotate(gearAngle(g));
        c.globalAlpha = p.light ? 0.55 : 0.5;
        c.drawImage(g.g.c, -g.g.n / 2, -g.g.n / 2, g.g.n, g.g.n);
        c.restore();
      });
      const g0 = A.gears[0], cx = g0.x * W, cy = g0.y * H, R = g0.g.n * 0.42, a = t * 0.05;
      c.strokeStyle = rgba(p.amb[1], p.light ? 0.25 : 0.18); c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); c.stroke();
      c.beginPath(); c.ellipse(cx, cy, R * 1.25, R * 0.4, -0.35, 0, TAU); c.stroke();
      c.beginPath(); c.arc(cx + Math.cos(a) * R, cy + Math.sin(a) * R, 5, 0, TAU); c.stroke();
      const ea = t * 0.12, ex = cx + Math.cos(ea) * R * 1.25, ey = cy + Math.sin(ea) * R * 0.4;
      c.beginPath(); c.arc(cx + (ex - cx) * Math.cos(-0.35) - (ey - cy) * Math.sin(-0.35), cy + (ex - cx) * Math.sin(-0.35) + (ey - cy) * Math.cos(-0.35), 4, 0, TAU);
      c.fillStyle = rgba(p.amb[2], 0.35); c.fill();
    } else if (A.kind === "horizon") {
      c.strokeStyle = rgba(p.mono ? p.ink : p.amb[2], 0.08); c.lineWidth = 14;
      c.beginPath(); c.ellipse(W * 0.5, H * 1.02, W * 0.62, H * 0.16, 0, Math.PI, TAU); c.stroke();
      c.strokeStyle = rgba(p.mono ? p.ink : p.amb[2], 0.3); c.lineWidth = 2; c.stroke();
      if (!p.mono && !rm()) {
        const n = 12, y0 = H * 0.72, hS = (H * 0.28) / n;
        for (let i = 0; i < n; i++) {
          const y = y0 + i * hS, off = Math.sin(t * 2.3 + i * 0.9) * 2.5 * (i / n);
          c.drawImage(S.bgC, 0, Math.floor(y * D), Math.floor(W * D), Math.ceil(hS * D) + 1, off, y, W, hS + 1 / D);
        }
      }
    }
  }

  function drawAmbienceFront() {
    const A = S.amb;
    if (!A) return;
    const c = S.ctx, p = S.pal, W = S.W, H = S.H, t = S.ambT;
    if (A.kind === "fireflies") {
      for (const f of A.flies) {
        const x = f.x * W + Math.sin(t * f.sp + f.ph) * f.ax + Math.sin(t * f.sp * 2.3 + f.ph * 2) * f.ax * 0.3;
        const y = f.y * H + Math.cos(t * f.sp * 0.8 + f.ph) * f.ax * 0.7 + Math.sin(t * f.sp * 1.7) * 12;
        const blink = Math.pow(Math.max(0, Math.sin(t * f.bs + f.ph)), 2);
        if (p.mono) { c.fillStyle = rgba(p.ink, 0.2 + 0.5 * blink); c.fillRect(x - 1, y - 1, 2, 2); continue; }
        drawGlow(x, y, 9 + 7 * blink, f.c, 0.12 + 0.7 * blink);
        c.fillStyle = rgba(p.light ? p.ink : "#fffbe0", 0.3 + 0.6 * blink); c.fillRect(x - 0.9, y - 0.9, 1.8, 1.8);
      }
    } else if (A.kind === "aurora") {
      c.fillStyle = rgba(p.light ? p.ink : "#ffffff", p.light ? 0.3 : 0.55);
      for (const s of A.snow) {
        const x = s.x * W + Math.sin(t * 0.6 + s.ph) * 20, y = s.y * H;
        c.fillRect(x, y, s.s, s.s);
      }
    } else if (A.kind === "nebula") {
      for (const d of A.dust) {
        const a = d.a + t * d.sp, x = W * 0.5 + Math.cos(a) * d.rr * W, y = H * 0.5 + Math.sin(a) * d.rr * H * 0.7;
        c.fillStyle = rgba(p.mono ? p.ink : d.c, 0.35 + 0.3 * Math.sin(t + d.a * 5));
        c.fillRect(x, y, 1.5, 1.5);
      }
    } else if (A.kind === "horizon") {
      for (const e of A.embers) {
        const fl = 0.5 + 0.5 * Math.sin(t * 5 + e.ph);
        if (p.mono) { c.fillStyle = rgba(p.ink, 0.3 * fl + 0.1); c.fillRect(e.x, e.y, 1.5, 1.5); continue; }
        drawGlow(e.x, e.y, e.s * 5, e.c, 0.25 + 0.4 * fl);
        c.fillStyle = rgba(p.light ? p.sunDark : "#fff1c9", 0.4 + 0.5 * fl); c.fillRect(e.x - e.s * 0.4, e.y - e.s * 0.4, e.s * 0.8, e.s * 0.8);
      }
    }
  }

  function drawScreenFx() {
    const c = S.ctx, p = S.pal;
    for (const q of S.sparts) {
      if (q.t < 0) continue;
      const f = clamp(q.t / q.dur, 0, 1), e = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
      const x = (1 - e) * (1 - e) * q.x0 + 2 * (1 - e) * e * q.bx + e * e * q.tx, y = (1 - e) * (1 - e) * q.y0 + 2 * (1 - e) * e * q.by + e * e * q.ty;
      drawGlow(x, y, q.s * 5, p.pollen, 0.8 * (1 - f * 0.5));
      c.fillStyle = p.mono ? p.ink : q.c; circ(x, y, q.s * (1 - f * 0.4)); c.fill();
      if (f > 0.92) { c.strokeStyle = rgba(p.mono ? p.ink : p.pollen, (1 - f) * 8); c.lineWidth = 1.5; circ(q.tx, q.ty, 6 + (f - 0.92) * 200); c.stroke(); }
    }
    const d = S.drag;
    if (d && S.mode === "play") drawCancelZone(d);
    if (d && d.moved && d.out && S.mode === "play") {
      const dx = d.x - d.sx, dy = d.y - d.sy, l = Math.hypot(dx, dy) || 1;
      c.strokeStyle = rgba(p.light ? p.ink : p.paper, 0.25); c.lineWidth = 1.2; c.setLineDash([4, 6]);
      c.beginPath(); c.moveTo(d.sx + (dx / l) * CANCEL_R, d.sy + (dy / l) * CANCEL_R); c.lineTo(d.x, d.y); c.stroke(); c.setLineDash([]);
      c.fillStyle = rgba(p.mono ? p.ink : p.preview, 0.5); circ(d.x, d.y, 4 + S.aim.pow * 6); c.fill();
    }
  }

  function drawCancelZone(d) {
    const c = S.ctx, p = S.pal, inside = d.moved && !d.out, ink = p.light ? p.ink : p.neon ? "#5ef2ff" : p.paper;
    const a = inside ? 0.85 : d.moved ? 0.4 : 0.22, k = CANCEL_R * 0.32;
    c.save(); c.lineCap = "round";
    circ(d.sx, d.sy, CANCEL_R);
    c.fillStyle = rgba(p.light ? p.paper : "#000000", inside ? 0.35 : 0.15); c.fill();
    c.strokeStyle = rgba(ink, a); c.lineWidth = inside ? 2 : 1.3; c.setLineDash(inside ? [] : [3, 5]); c.stroke(); c.setLineDash([]);
    c.lineWidth = inside ? 2.2 : 1.4; c.beginPath();
    c.moveTo(d.sx - k, d.sy - k); c.lineTo(d.sx + k, d.sy + k); c.moveTo(d.sx + k, d.sy - k); c.lineTo(d.sx - k, d.sy + k); c.stroke();
    c.restore();
  }

  function drawOverlays() {
    const c = S.ctx, p = S.pal, W = S.W, H = S.H;
    if (S.flash > 0) {
      c.globalCompositeOperation = p.light ? "source-over" : "lighter";
      c.fillStyle = rgba(p.light ? "#ffffff" : S.theme.glow, S.flash * 0.35); c.fillRect(0, 0, W, H);
      c.globalCompositeOperation = "source-over";
    }
    if (p.neon) { c.fillStyle = S.scan; c.fillRect(0, 0, W, H); }
    else if (S.grain) {
      c.save();
      if (!rm()) c.translate(Math.floor(Math.random() * 160), Math.floor(Math.random() * 160));
      c.fillStyle = S.grain;
      c.fillRect(-160, -160, W + 160, H + 160);
      c.restore();
    }
    if (S.fade > 0) {
      c.globalCompositeOperation = "saturation"; c.fillStyle = rgba("#808080", S.fade * 0.9); c.fillRect(0, 0, W, H);
      c.globalCompositeOperation = "source-over"; c.fillStyle = rgba(p.light ? p.paper : "#05060d", S.fade * 0.35); c.fillRect(0, 0, W, H);
    }
    if (S.fadeIn > 0) { c.fillStyle = rgba(p.bg[2], S.fadeIn * 0.7); c.fillRect(0, 0, W, H); }
  }

  function draw() {
    const c = S.ctx;
    if (!c || !S.pal || !S.bgC) return;
    const D = S.DPR, p = S.pal;
    c.setTransform(D, 0, 0, D, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = "source-over";
    c.drawImage(S.bgC, 0, 0, S.W, S.H);
    drawStars();
    drawAmbienceBack();
    if (p.neon) drawSynthGrid();
    if (S.lv && S.P.length === S.lv.bodies.length) {
      drawLensing();
      worldXf();
      drawGrid(); drawOrbits(); drawWinds(); drawPortals(); drawBoosts(); drawBodies(); drawPollen();
      drawPreview(); drawGuides(); drawLauncher(); drawFastCue(); drawTrail(); drawSeed(); drawFx();
      c.setTransform(D, 0, 0, D, 0, 0);
    }
    drawAmbienceFront();
    drawScreenFx();
    drawOverlays();
  }

  function frame(t) {
    const dt = Math.min(0.05, Math.max(0, (t - S.last) / 1000));
    S.last = t;
    try { update(dt); draw(); } catch (e) { console.error(e); }
    requestAnimationFrame(frame);
  }

  const NAME_A = ["Quiet", "Amber", "Hollow", "Velvet", "Drifting", "Silver", "Tangled", "Sleepy", "Glass", "Ember", "Mossy", "Lantern", "Hushed", "Copper", "Wandering", "Dewy"];
  const NAME_B = ["Meadow", "Orchard", "Furrow", "Hollow", "Trellis", "Grove", "Arbor", "Terrace", "Garden", "Thicket", "Bower", "Paddock", "Glade", "Allotment"];
  const HINTS = [
    "A gentle patch of sky. Take your time.",
    "Ice glances seeds aside, and some soil hides behind a shield.",
    "Moons keep moving while you aim. Time the throw.",
    "Folds, winds and boost gates bend the path while the moons turn.",
    "Black holes swallow, repulsors push. Everything is in play.",
  ];
  const r2 = (v) => Math.round(v * 100) / 100;
  const FERT_R = [null, [58, 92], [48, 78], [38, 62], [32, 54], [22, 40]];

  function buildCandidate(rnd, d) {
    const R = (a, b) => a + rnd() * (b - a), chance = (x) => rnd() < x;
    const launch = [Math.round(R(140, 230)), Math.round(R(220, 780))];
    const bodies = [], occ = [];
    const free = (x, y, rr, m) => x - rr >= 30 && x + rr <= 1570 && y - rr >= 30 && y + rr <= 940 &&
      Math.hypot(x - launch[0], y - launch[1]) >= rr + 150 && !(x - rr < 370 && y - rr < 95) &&
      occ.every((o) => Math.hypot(o.x - x, o.y - y) >= o.r + rr + m);
    const spot = (rr, m, xr) => {
      for (let k = 0; k < 80; k++) {
        const x = R(xr ? xr[0] : 420, xr ? xr[1] : 1530), y = R(60, 940);
        if (free(x, y, rr, m)) return [Math.round(x), Math.round(y)];
      }
      return null;
    };
    const add = (b, outer, m, xr) => {
      const s = spot(outer, m, xr);
      if (!s) return false;
      b.x = s[0]; b.y = s[1]; bodies.push(b); occ.push({ x: b.x, y: b.y, r: outer });
      return true;
    };
    if (d >= 3 && chance(0.75)) {
      const host = { kind: chance(0.5) ? "sun" : "barren", r: Math.round(R(42, 64)) };
      if (host.kind === "sun") host.dens = 3000;
      const mr = Math.round(R(26, 36)), OR = Math.round(host.r + mr + R(50, 85));
      if (!add(host, OR + mr, 30, [700, 1250])) return null;
      bodies.push({ kind: chance(0.75) ? "fertile" : "barren", r: mr, orbit: { p: bodies.length - 1, R: OR, w: r2((chance(0.5) ? -1 : 1) * R(0.35, 0.7)), ph: r2(R(0, TAU)) } });
    }
    if (d >= 5 && chance(0.7)) add({ kind: "blackhole", r: Math.round(R(14, 20)) }, 20, 130);
    if (d >= 5 && chance(0.55)) add({ kind: "repulsor", r: Math.round(R(28, 42)) }, 42, 60);
    const nf = 2 + (chance(0.65 - d * 0.1) ? 1 : 0) - (bodies.some((b) => b.kind === "fertile") ? 1 : 0);
    for (let i = 0; i < nf; i++) {
      const r = Math.round(R(FERT_R[d][0], FERT_R[d][1])), b = { kind: "fertile", r: r };
      if (d >= 2 && chance(0.2 + d * 0.05)) b.need = 2;
      let sh = null;
      if (d >= 2 && chance(d >= 4 ? 0.45 : 0.35)) {
        sh = { gap: r2(R(1.4, 2.2)), w: 0, ph: 0 };
        if (d >= 3 && chance(0.55)) sh.w = r2((chance(0.5) ? -1 : 1) * R(0.4, 0.8));
      }
      if (!add(b, r + (sh ? 20 : 0), 40)) continue;
      if (sh) { sh.ph = r2(Math.atan2(launch[1] - b.y, launch[0] - b.x) + R(-1, 1)); b.shield = sh; }
    }
    if (!bodies.some((b) => b.kind === "fertile")) return null;
    const pool = ["barren", "sun"].concat(d >= 2 ? ["ice", "ice"] : []);
    const nh = (d >= 4 ? 2 : 1) + Math.floor(rnd() * (d >= 3 ? 3 : 2));
    for (let i = 0; i < nh; i++) {
      const kind = pool[Math.floor(rnd() * pool.length)];
      const r = Math.round(kind === "sun" ? R(40, 68) : kind === "ice" ? R(45, 85) : R(48, 100));
      const b = { kind: kind, r: r };
      if (kind === "sun" && chance(0.5)) b.dens = 3000;
      add(b, r, 40);
    }
    const portals = [], winds = [], boosts = [], pollen = [];
    if (d >= 4 && chance(0.45)) {
      const a = spot(36, 20), bb = a && (occ.push({ x: a[0], y: a[1], r: 30 }), spot(36, 20));
      if (a && bb && Math.hypot(a[0] - bb[0], a[1] - bb[1]) > 400) { portals.push({ a: a, b: bb }); occ.push({ x: bb[0], y: bb[1], r: 30 }); }
    }
    if (d >= 4 && chance(0.4)) {
      const w = Math.round(R(180, 340)), full = chance(0.5), h = full ? 1000 : Math.round(R(300, 600));
      const ang = R(0, TAU), mag = R(35, 80);
      winds.push({ x: Math.round(R(380, 1500 - w)), y: full ? 0 : Math.round(R(0, 1000 - h)), w: w, h: h, ax: Math.round(Math.cos(ang) * mag), ay: Math.round(Math.sin(ang) * mag) });
    }
    if (d >= 4 && chance(0.45)) {
      const n = 1 + (chance(0.35) ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const s = spot(32, 25);
        if (!s) continue;
        const g = { x: s[0], y: s[1], mult: r2(R(1.15, 1.5)) };
        if (chance(0.45)) g.ang = r2(R(-1.4, 1.4));
        boosts.push(g); occ.push({ x: s[0], y: s[1], r: 28 });
      }
    }
    if (chance(0.3 + 0.1 * d)) {
      const n = 1 + (chance(0.4) ? 1 : 0);
      for (let i = 0; i < n; i++) { const s = spot(26, 30); if (s) { pollen.push(s); occ.push({ x: s[0], y: s[1], r: 22 }); } }
    }
    return { launch: launch, bodies: bodies, portals: portals, winds: winds, boosts: boosts, pollen: pollen };
  }

  function solveReach(lv, maxSteps, hit, pol) {
    const sim = Sim(), fert = [], lx = lv.launch[0], ly = lv.launch[1];
    hit = hit || {}; pol = pol || lv.pollen.map(() => false);
    lv.bodies.forEach((b, i) => { if (b.kind === "fertile" && !hit[i]) fert.push(i); });
    const moving = lv.bodies.some((b) => b.orbit || (b.shield && b.shield.w));
    const T0s = moving ? [0, 2.2] : [0], pows = [0.55, 0.4, 0.7, 0.85, 0.3, 1, 0.62, 0.47, 0.2, 0.77];
    const P0 = sim.positions(lv.bodies, 0), dirs = fert.map((i) => Math.atan2(P0[i][1] - ly, P0[i][0] - lx));
    const order = [];
    for (let a = 0; a < 72; a++) {
      const ang = (a / 72) * TAU - Math.PI;
      order.push({ ang: ang, sc: Math.min.apply(null, dirs.map((d) => Math.abs(sim.wrapAngle(ang - d)))) + (a % 2) * 0.01 });
    }
    order.sort((x, y) => x.sc - y.sc);
    let left = fert.length, extra = 0, steps = 0;
    if (!left && pol.every(Boolean)) return { ok: true, pol: pol, used: 0 };
    for (const T0 of T0s) {
      for (const pw of pows) {
        for (const o of order) {
          if (steps > maxSteps) return { ok: false, pol: pol, used: steps };
          const pg = pol.map(() => false), res = sim.simulateShot(lv, o.ang, pw, T0, 6, pg);
          steps += Math.round(res.seed.t / DT);
          for (let k = 0; k < pg.length; k++) if (pg[k]) pol[k] = true;
          const e = res.end;
          if (e && e.type === "plant" && !hit[e.i]) { hit[e.i] = 1; left--; }
          if (left === 0 && (pol.every(Boolean) || ++extra > 120)) return { ok: true, pol: pol, used: steps };
        }
      }
    }
    return { ok: left === 0, pol: pol, used: steps };
  }

  const BANDS = [null, [0.15, 0.5], [0.1, 0.16], [0.065, 0.1], [0.045, 0.068], [0.02, 0.045]];
  const GEN_BUDGET = 550000, GEN_SPARE = 200000, RATE_SHOTS = 200, RATE_CAP = Math.round(14 / DT);

  function shotRate(lv, rnd, band, maxSteps) {
    const sim = Sim(), u0 = rnd(), v0 = rnd(), hit = {}, pol = lv.pollen.map(() => false);
    let plants = 0, n = 0, steps = 0;
    while (n < RATE_SHOTS && steps < maxSteps) {
      const s = sim.newSeed(lv, ((u0 + n * 0.7548776662) % 1) * TAU - Math.PI, 0.05 + ((v0 + n * 0.5698402910) % 1) * 0.95);
      let T = rnd() * 8;
      for (let j = 0; j < RATE_CAP; j++) {
        T += DT; steps++;
        const ev = sim.stepSeed(lv, s, T, DT, pol);
        if (ev) {
          if (ev.type === "pollen") pol[ev.k] = true;
          else if (sim.TERMINAL[ev.type]) { if (ev.type === "plant") { plants++; hit[ev.i] = 1; } break; }
        } else if ((j & 7) === 7 && escaping(lv, s, T)) break;
      }
      n++;
      if (n % 40 === 0) {
        const p = plants / n, k = 1.2 + 24 / n;
        if (p > band[1] * k || p < band[0] / k) break;
      }
    }
    return { p: plants / Math.max(1, n), n: n, used: steps, hit: hit, pol: pol };
  }

  function bandMiss(p, band) { return p < band[0] ? (band[0] - p) / band[0] : p > band[1] ? (p - band[1]) / band[1] : 0; }

  function generateLevel(seed, opts) {
    const d = clamp(Math.round((opts && opts.difficulty) || 1), 1, 5), base = hashSeed(seed == null ? "orchard" : seed);
    let band = opts && opts.anyRate ? null : BANDS[d], budget = band ? GEN_BUDGET : GEN_SPARE, lv = null, best = null, att = 0;
    while (!lv && att < 600) {
      if (budget <= 0) {
        if (best || !band) break;
        band = null; budget = GEN_SPARE;
      }
      const cand = buildCandidate(mulberry32((base + att * 7919) >>> 0), d);
      att++;
      if (!cand) continue;
      let miss = 0, m = null;
      if (band) {
        m = shotRate(cand, mulberry32((base ^ 0x2545f491) + att), band, budget);
        budget -= m.used;
        miss = bandMiss(m.p, band);
        if (miss > 0 && best && miss >= best.miss) continue;
      }
      const r = solveReach(cand, Math.min(budget, 30000), m && m.hit, m && m.pol);
      budget -= r.used;
      if (!r.ok) continue;
      cand.pollen = cand.pollen.filter((_, k) => r.pol[k]);
      if (miss === 0) lv = cand;
      else best = { lv: cand, miss: miss };
    }
    S.genInfo = { att: att, left: budget, inBand: !!lv, nearest: !lv && !!best };
    lv = lv || (best && best.lv) || { launch: [200, 500], bodies: [{ kind: "barren", x: 780, y: 500, r: 110 }, { kind: "fertile", x: 1330, y: 520, r: 70 }], portals: [], winds: [], boosts: [], pollen: [] };
    const nr = mulberry32(base ^ 0x5bd1e995), par = lv.bodies.reduce((s, b) => s + (b.kind === "fertile" ? b.need || 1 : 0), 0);
    const slack = d <= 2 ? 3 : d === 3 ? 2 : 1;
    return Object.assign({
      id: "gen-" + base.toString(36), name: NAME_A[Math.floor(nr() * NAME_A.length)] + " " + NAME_B[Math.floor(nr() * NAME_B.length)],
      hint: HINTS[d - 1], seeds: par + slack + 2, par: par, stars: [par + slack, par + slack + 1], preview: r2(1.7 - 0.18 * (d - 1)), seed: seed, difficulty: d,
    }, lv);
  }

  function botThink(dt) {
    const b = S.bot;
    if (!b) return;
    if (S.phase === "won") { b.next = (b.next == null ? 2.6 : b.next) - dt; if (b.next <= 0) showcase(b.world); return; }
    if (S.phase !== "play" && S.phase !== "intro") return;
    if (S.seed) { b.state = "wait"; b.t = 1.1; return; }
    if (b.state === "flying") { b.state = "wait"; b.t = 1.1; }
    if (b.state === "wait") { b.t -= dt; if (b.t <= 0) { b.state = "think"; b.plan = null; } return; }
    if (b.state === "think") {
      const sim = Sim(), lv = S.lv, k = S.step + Math.round(1.3 / DT), T0 = k * DT, lx = lv.launch[0], ly = lv.launch[1];
      const targets = [];
      lv.bodies.forEach((x, i) => { if (x.got < x.need) targets.push(i); });
      for (let i = 0; i < 24; i++) {
        b.tries++;
        let ang = Math.random() * TAU - Math.PI;
        if (targets.length && Math.random() < 0.6) {
          const tp = sim.bodyPos(lv.bodies, targets[Math.floor(Math.random() * targets.length)], T0 + 0.8);
          ang = Math.atan2(tp[1] - ly, tp[0] - lx) + (Math.random() - 0.5) * 1.6;
        }
        const pow = 0.2 + Math.random() * 0.8, res = sim.simulateShot(lv, ang, pow, T0, 7, null), e = res.end;
        if (e && e.type === "plant" && lv.bodies[e.i].got < lv.bodies[e.i].need) {
          b.plan = { ang: ang, pow: pow, k: k, T0: T0, a0: S.aim.ang, p0: S.aim.pow, s0: S.T };
          b.state = "aim";
          break;
        }
      }
      if (b.state === "think" && b.tries > 1600) showcase(b.world);
      return;
    }
    if (b.state === "aim") {
      const pl = b.plan, f = smooth(clamp((S.T - pl.s0) / Math.max(0.1, pl.T0 - pl.s0 - 0.2), 0, 1));
      S.aim.ang = pl.a0 + Sim().wrapAngle(pl.ang - pl.a0) * f;
      S.aim.pow = lerp(pl.p0, pl.pow, f);
    }
  }

  function botLaunchCheck() {
    const b = S.bot;
    if (!b || b.state !== "aim" || S.seed) return;
    if (S.step > b.plan.k) { b.state = "think"; return; }
    if (S.step === b.plan.k) {
      S.aim.ang = b.plan.ang; S.aim.pow = b.plan.pow;
      if (launch()) b.state = "flying";
    }
  }

  const DEMO_AIM = 0.6;

  function validShots(sol) {
    const a = sol && Array.isArray(sol.shots) ? sol.shots : null;
    if (!a || !a.length) return null;
    const out = [];
    for (const q of a) {
      if (!q || !isFinite(q[0]) || !isFinite(q[1]) || !isFinite(q[2])) return null;
      out.push([+q[0], +q[1], Math.max(0, Math.round(+q[2]))]);
    }
    return out;
  }

  function demoRate() {
    const d = S.demo;
    if (d.state !== "wait" || S.phase === "intro") return 1;
    return clamp(1 + ((d.shots[d.i][2] - S.step) * DT - DEMO_AIM) * 1.5, 1, 4);
  }

  function demoThink(gdt) {
    const d = S.demo;
    if (d.state !== "aim" || S.phase === "intro") return;
    d.aimT = Math.min(DEMO_AIM, d.aimT + gdt);
    const sh = d.shots[d.i], f = smooth(d.aimT / DEMO_AIM);
    S.aim.ang = d.a0 + Sim().wrapAngle(sh[0] - d.a0) * f;
    S.aim.pow = lerp(d.p0, sh[1], f);
  }

  function demoGate() {
    const d = S.demo;
    if (d.state === "fly") {
      if (S.seed) return true;
      d.i++;
      if (d.i >= d.n || S.phase !== "play") { d.state = "finish"; d.t = 0; return true; }
      d.state = "wait";
    }
    if (d.state === "wait") {
      if ((d.shots[d.i][2] - S.step) * DT > DEMO_AIM) return true;
      d.state = "aim"; d.aimT = 0; d.a0 = S.aim.ang; d.p0 = S.aim.pow;
    }
    if (d.state !== "aim") return true;
    const sh = d.shots[d.i], k = sh[2];
    if (S.step < k) return (k - S.step) * DT >= DEMO_AIM - d.aimT - 1e-9;
    if (d.aimT < DEMO_AIM) return false;
    S.aim.ang = sh[0]; S.aim.pow = sh[1];
    const late = S.step !== k;
    if (!launch()) { d.state = "finish"; d.t = 0; return true; }
    if (late) d.late++;
    d.state = "fly";
    emit("demo", { phase: "shot", i: d.i, n: d.n });
    return true;
  }

  function demoAfter(gdt) {
    const d = S.demo;
    if (d.state === "fly" && !S.seed && S.phase === "celebrate") { d.state = "finish"; d.t = 0; }
    if (d.state !== "finish") return;
    d.t += gdt;
    if (S.phase === "won" || (S.phase !== "celebrate" && d.t > 1)) {
      d.state = "done"; S.fast = false;
      const ok = d.res.length >= d.n && d.res.slice(0, d.n).every((r) => r === "plant");
      emit("demo", { phase: "end", ok: ok, completed: allSown(), n: d.n, results: d.res.slice(), late: d.late, levelId: S.def.id });
      emitHud(true);
    }
  }

  function playDemo(sol, opts) {
    opts = opts || {};
    const shots = validShots(sol);
    if (!shots || !S.def || S.mode !== "play") return false;
    const n = clamp(opts.upTo == null ? shots.length : Math.floor(+opts.upTo) || 0, 0, shots.length);
    if (n < 1) return false;
    startLevel(S.def, S.world, S.ctxMode, false);
    if (S.seeds < n) { S.seeds = n; S.seedsLeft = n; }
    S.keys.clear(); S.drag = null;
    S.demo = { shots: shots, n: n, i: 0, state: "wait", speed: clamp(+opts.speed || 1, 0.25, 64), aimT: 0, a0: 0, p0: 0, t: 0, res: [], late: 0 };
    emit("demo", { phase: "start", n: n, levelId: S.def.id });
    emitHud(true);
    if (opts.instant) {
      const d = S.demo;
      d.speed = 32; d.quiet = true;
      for (let i = 0; i < 20000 && S.demo === d && d.state !== "done" && !S.paused; i++) update(1 / 60);
      d.speed = clamp(+opts.speed || 1, 0.25, 64); d.quiet = false;
      S.parts = []; S.rings = []; S.sparts = []; S.shake = 0; S.flash = 0;
      draw();
    }
    return true;
  }

  function stopDemo() {
    if (!S.demo || !S.def) return false;
    startLevel(S.def, S.world, S.ctxMode, false);
    return true;
  }

  function setGuides(sol) {
    const shots = sol ? validShots(sol) : null;
    if (sol && !shots) return false;
    S.guides = shots ? { shots: shots } : null;
    return true;
  }

  function snapToGuide() {
    const sh = S.guides && S.guides.shots[S.used];
    if (!sh || !canAim()) return false;
    S.aim.ang = sh[0]; S.aim.pow = sh[1];
    rememberAim();
    sfx("aim");
    emitHud();
    return true;
  }

  function addSeeds(n) {
    n = Math.floor(+n);
    if (!(n > 0) || !S.lv || S.mode !== "play" || S.demo || S.seeds === Infinity) return false;
    if (S.phase === "celebrate" || S.phase === "won") return false;
    S.seeds += n; S.seedsLeft += n;
    if (S.phase === "lose" || S.phase === "lost") { S.phase = "play"; S.phaseT = 0; S.fade = 0; S.emitted = false; }
    emitHud(true);
    return true;
  }

  function layerKey() { return [S.settings.skin, JSON.stringify(S.theme), S.W, S.H, S.DPR].join("|"); }
  function ensureLayers() {
    if (!S.ctx) return;
    const k = layerKey();
    if (k !== S.layerKey) { S.layerKey = k; rebuildLayers(); }
  }

  function themeOf(world) {
    if (world && world.theme) return world.theme;
    if (world && THEMES[world.id]) return THEMES[world.id];
    return THEMES[1];
  }

  const NEUTRAL_POW = 0.5, NEUTRAL_T = Array.from({ length: 21 }, (_, k) => k * 0.45);

  function aimKey(def) { return String(def.id) + "|" + def.launch.join(","); }

  function neutralAim(lv) {
    const sim = Sim(), lx = lv.launch[0], ly = lv.launch[1], base = Math.atan2(WORLD_H / 2 - ly, WORLD_W / 2 - lx);
    const times = lv.bodies.some((b) => b.orbit || (b.shield && b.shield.w)) ? NEUTRAL_T : [0];
    const plants = (ang, pow) => times.some((T0) => { const e = sim.simulateShot(lv, ang, pow, T0, sim.FLIGHT_MAX, null).end; return !!e && e.type === "plant"; });
    for (let k = 0; k < 24; k++) {
      const ang = sim.wrapAngle(base + (k % 2 ? -1 : 1) * Math.ceil(k / 2) * 0.13);
      for (const pow of [NEUTRAL_POW, NEUTRAL_POW - 0.08, NEUTRAL_POW + 0.08]) if (!plants(ang, pow)) return { ang: ang, pow: pow };
    }
    return { ang: base, pow: NEUTRAL_POW };
  }

  function rememberAim() {
    if (S.mode === "play" && !S.demo && S.def) S.playerAim = { key: aimKey(S.def), ang: S.aim.ang, pow: S.aim.pow };
  }

  function startLevel(def, world, mode, isShow) {
    if (S.demo) {
      const d = S.demo;
      S.demo = null;
      if (d.state !== "done") emit("demo", { phase: "abort" });
    }
    S.def = def; S.world = world || null; S.theme = themeOf(world);
    S.lv = prepLevel(def);
    S.moving = S.lv.bodies.some((b) => b.orbit || (b.shield && b.shield.w));
    S.trailN = 0;
    S.ctxMode = mode || "journey";
    S.mode = isShow ? "showcase" : "play";
    S.T = 0; S.step = 0; S.seedT = 0; S.acc = 0; S.seed = null; S.trail = []; S.parts = []; S.sparts = []; S.rings = [];
    S.seeds = S.ctxMode === "zen" || isShow ? Infinity : def.seeds != null ? def.seeds : S.lv.par + 2;
    S.seedsLeft = S.seeds; S.used = 0; S.pollenGot = S.lv.pollen.map(() => false);
    S.hitstop = 0; S.fade = 0; S.fadeIn = 1; S.flash = 0; S.recoil = 0; S.shake = 0;
    S.phase = "intro"; S.phaseT = 0; S.introT = 0; S.emitted = false; S.clock = 0; S.drag = null;
    S.introDur = rm() ? 0.35 : Math.min(2, 0.1 + S.lv.bodies.length * 0.08 + 0.95);
    const kept = isShow ? { ang: Math.atan2(WORLD_H / 2 - S.lv.launch[1], WORLD_W / 2 - S.lv.launch[0]), pow: NEUTRAL_POW } : S.playerAim && S.playerAim.key === aimKey(def) ? S.playerAim : neutralAim(S.lv);
    S.aim.ang = kept.ang; S.aim.pow = kept.pow;
    S.cam = { z: rm() ? 1 : 0.94, x: WORLD_W / 2, y: WORLD_H / 2 };
    S.P = Sim().positions(S.lv.bodies, 0);
    ensureLayers();
    refit();
    S.lastHud = "";
    if (!isShow) emitHud(true);
  }

  function showcase(world) {
    const w = world || null, d = w && w.id ? clamp(w.order != null ? w.order : w.id, 1, 5) : 2;
    S.bot = { state: "think", t: 0, plan: null, tries: 0, world: w, next: null };
    S.paused = false;
    const lv = generateLevel("showcase-" + Math.floor(Math.random() * 1e9), { difficulty: d, anyRate: true });
    startLevel(lv, w || { id: 1, theme: THEMES[1] }, "zen", true);
  }

  function loadLevel(level, o) {
    o = o || {};
    S.bot = null;
    S.keys.clear();
    if (S.guides && (!S.def || !level || S.def.id !== level.id)) S.guides = null;
    startLevel(level, o.world || null, o.mode || "journey", false);
  }

  function restart() {
    if (S.def && S.mode === "play") startLevel(S.def, S.world, S.ctxMode, false);
  }

  function isTyping(e) {
    const el = e.target;
    return !!(el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName || "")));
  }
  const normKey = (k) => (k.length === 1 ? k.toLowerCase() : k);

  function onKeyDown(e) {
    if (e.defaultPrevented || S.mode !== "play" || S.demo || !S.inputEnabled || S.paused || isTyping(e)) return;
    const k = e.key, tag = (e.target && e.target.tagName) || "", onBtn = tag === "BUTTON" || tag === "A";
    if (/^Arrow/.test(k) || (k === " " && !onBtn)) e.preventDefault();
    S.keys.add(normKey(k));
    if (e.repeat) return;
    const low = k.toLowerCase();
    if (low === "g") {
      S.settings.grid = !S.settings.grid;
      emit("settings", { grid: S.settings.grid });
      toast(S.settings.grid ? "Gravity lattice on" : "Gravity lattice off", "info");
    } else if (low === "r") restart();
    else if (low === "h") snapToGuide();
    else if ((k === " " || k === "Enter") && !onBtn) launch();
  }

  function onKeyUp(e) { S.keys.delete(normKey(e.key)); if (e.key === "Shift") S.keys.delete("Shift"); }

  const CANCEL_R = 28, FF_HOLD = 0.3;

  function canFast() { return S.mode === "play" && !S.demo && S.inputEnabled && !S.paused && !!S.seed; }

  function onPointerDown(e) {
    try { if (window.OrchardAudio) window.OrchardAudio.unlock(); } catch (err) { S.audioErr = err; }
    if (e.button != null && e.button > 0) return;
    if (canFast()) {
      S.tapFast = !S.tapFast;
      S.ffPress = S.tapFast ? { id: e.pointerId, t: S.time } : null;
      e.preventDefault();
      return;
    }
    if (!canAim()) return;
    try { S.canvas.setPointerCapture(e.pointerId); } catch (err) { S.captureErr = err; }
    S.drag = { sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, id: e.pointerId, moved: false, out: false, a0: S.aim.ang, p0: S.aim.pow };
    e.preventDefault();
  }

  function onPointerMove(e) {
    const d = S.drag;
    if (!d || e.pointerId !== d.id) return;
    if (!canAim()) { S.drag = null; return; }
    const dx = d.sx - e.clientX, dy = d.sy - e.clientY, len = Math.hypot(dx, dy);
    d.x = e.clientX; d.y = e.clientY;
    if (len < 6 && !d.moved) return;
    d.moved = true;
    d.out = len > CANCEL_R;
    if (d.out) {
      const span = Math.min(280, Math.max(150, S.W * 0.22));
      const v = S.view;
      S.aim.ang = Math.atan2(v.c * dx + v.d * dy, v.a * dx + v.b * dy);
      S.aim.pow = clamp((len - CANCEL_R) / (span - CANCEL_R), 0.05, 1);
    } else { S.aim.ang = d.a0; S.aim.pow = d.p0; }
    rememberAim();
    aimSfx();
  }

  function onPointerUp(e) {
    const f = S.ffPress;
    if (f && e.pointerId === f.id) { S.ffPress = null; if (S.time - f.t > FF_HOLD) S.tapFast = false; }
    const d = S.drag;
    if (!d || e.pointerId !== d.id) return;
    S.drag = null;
    if (d.moved && d.out && canAim()) launch();
  }

  function resize() {
    if (!S.canvas) return;
    const r = S.canvas.getBoundingClientRect();
    S.W = Math.max(1, Math.round(r.width || window.innerWidth));
    S.H = Math.max(1, Math.round(r.height || window.innerHeight));
    S.DPR = Math.min(window.devicePixelRatio || 1, 2);
    const cw = Math.round(S.W * S.DPR), ch = Math.round(S.H * S.DPR);
    if (S.canvas.width !== cw || S.canvas.height !== ch) { S.canvas.width = cw; S.canvas.height = ch; }
    ensureLayers();
    refit();
    try { draw(); } catch (e) { console.error(e); }
  }

  function init(canvas) {
    if (S.canvas) return;
    S.canvas = canvas; S.ctx = canvas.getContext("2d");
    canvas.style.touchAction = "none";
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", () => { S.drag = null; });
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", () => { S.keys.clear(); S.drag = null; });
    window.addEventListener("resize", resize);
    if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas);
    buildGrain();
    resize();
    S.last = now();
    requestAnimationFrame(frame);
  }

  function setSettings(partial) {
    if (!partial) return;
    const skins = ["nocturne", "daylight", "synthwave", "inkwell"];
    for (const k of Object.keys(partial)) {
      if (!(k in S.settings)) continue;
      if (k === "skin") { if (skins.indexOf(partial.skin) >= 0) S.settings.skin = partial.skin; }
      else if (k === "trail") { if (TRAILS.some((t) => t.id === partial.trail)) S.settings.trail = partial.trail; }
      else S.settings[k] = !!partial[k];
    }
    if (rm()) S.shake = 0;
    ensureLayers();
  }

  function getState() {
    const lv = S.lv;
    return {
      mode: S.mode === "play" ? S.ctxMode : S.mode, levelId: S.def ? S.def.id : null, seedsLeft: S.seedsLeft, seeds: S.seeds, used: S.used,
      par: lv ? lv.par : 0, starAt: lv ? lv.stars : null, pollenGot: lv ? pollenCount() : 0, pollenTotal: lv ? lv.pollen.length : 0, pollenMask: S.pollenGot.slice(),
      sown: sownCount(), needTotal: needTotal(), flying: !!S.seed, fast: S.fast, phase: S.phase, paused: S.paused,
      step: S.step, rotated: S.rot, demo: !!S.demo, demoState: S.demo ? S.demo.state : null, guides: S.guides ? S.guides.shots.length : 0,
    };
  }

  const debug = {
    advance(frames, dt) {
      for (let i = 0; i < (frames | 0); i++) update(dt || 1 / 60);
      draw();
    },
    shoot(ang, pow) {
      if (ang != null) S.aim.ang = ang;
      if (pow != null) S.aim.pow = clamp(pow, 0.05, 1);
      return launch();
    },
    sow(i, ang) {
      const b = S.lv && S.lv.bodies[i];
      if (!b) return;
      const P = S.P[i] || [b.x, b.y];
      handleEvent({ type: "plant", i: i, ang: ang, x: P[0] + Math.cos(ang) * b.r, y: P[1] + Math.sin(ang) * b.r });
    },
    state: S,
    toScreen: toScreen,
    toWorld: toWorld,
    gen: { buildCandidate: buildCandidate, shotRate: shotRate, solveReach: solveReach, escaping: escaping, BANDS: BANDS },
  };

  window.Orchard = {
    init: init,
    setViewInsets(ins) {
      ins = ins || {};
      S.insets = { top: +ins.top || 0, right: +ins.right || 0, bottom: +ins.bottom || 0, left: +ins.left || 0 };
      refit();
    },
    setHudAnchor(x, y) { S.hudAnchor = x == null ? null : [x, y]; },
    showcase: showcase,
    loadLevel: loadLevel,
    restart: restart,
    setPaused(b) { S.paused = !!b; if (S.paused) { S.drag = null; S.keys.clear(); } },
    isPaused: () => S.paused,
    setInputEnabled(b) { S.inputEnabled = !!b; if (!b) { S.drag = null; S.keys.clear(); } },
    setSettings: setSettings,
    getSettings: () => Object.assign({}, S.settings),
    generateLevel: generateLevel,
    getState: getState,
    playDemo: playDemo,
    stopDemo: stopDemo,
    isDemo: () => !!S.demo,
    setGuides: setGuides,
    snapToGuide: snapToGuide,
    addSeeds: addSeeds,
    trails: TRAILS.map((t) => ({ id: t.id, name: t.name })),
    on: on,
    off: off,
    themes: THEMES,
    _debug: debug,
  };
})();
