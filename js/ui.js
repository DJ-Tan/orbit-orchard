(() => {
  "use strict";

  const KEY = "orbit-orchard-v2";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const mqReduce = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };

  function eng(name, ...args) {
    const o = window.Orchard;
    if (!o || typeof o[name] !== "function") return undefined;
    try { return o[name](...args); } catch (e) { console.warn("Orchard." + name, e); return undefined; }
  }
  function aud(name, ...args) {
    const o = window.OrchardAudio;
    if (!o || typeof o[name] !== "function") return undefined;
    try { return o[name](...args); } catch (e) { console.warn("OrchardAudio." + name, e); return undefined; }
  }
  const hasEng = (name) => !!(window.Orchard && typeof window.Orchard[name] === "function");
  const sfx = (n, o) => aud("sfx", n, o || {});

  const IC = {
    route: '<circle cx="5" cy="18" r="2.2"/><circle cx="19" cy="6" r="2.2"/><circle cx="13.5" cy="14.5" r="1.4"/><path d="M7.2 17.2l4.8-2.2M14.6 13l3.4-5" stroke-dasharray="2 2.6"/>',
    sky: '<circle cx="12" cy="14" r="4"/><path d="M12 4.5v2.2M5.2 7.6l1.6 1.6M18.8 7.6l-1.6 1.6M3 19.5h18"/>',
    zen: '<path d="M18.8 8.2A8 8 0 1 0 20 13.4"/><circle cx="12" cy="12" r="1.4"/>',
    book: '<path d="M4 5.5c3-1 6-1 8 1v13c-2-1.8-5-1.8-8-.8zM20 5.5c-3-1-6-1-8 1v13c2-1.8 5-1.8 8-.8z"/>',
    pot: '<path d="M6 13.5h12l-1.6 6.5H7.6z"/><path d="M12 13.5V8.5M12 10c-2.2 0-4-1.2-4-4 2.8 0 4 1.6 4 4zM12 10.6c0-2.6 1.6-4.6 4.4-4.6 0 2.6-1.6 4.6-4.4 4.6z"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5c0 3 1 4 3 4M16 6h3c0 3-1 4-3 4M12 13v4M8 20h8M10 17h4"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
    pause: '<path d="M9 6v12M15 6v12"/>',
    restart: '<path d="M5.2 12a6.8 6.8 0 1 0 2-4.8"/><path d="M4.5 3.8v4.4h4.4"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    next: '<path d="M9 5l7 7-7 7"/>',
    play: '<path d="M8 5.5l10.5 6.5L8 18.5z"/>',
    ff: '<path d="M3.5 6.5l8 5.5-8 5.5zM12.5 6.5l8 5.5-8 5.5z"/>',
    sound: '<path d="M4 10v4h4l5 4V6L8 10z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/>',
    mute: '<path d="M4 10v4h4l5 4V6L8 10z"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
    sprout: '<path d="M12 20.5v-8"/><path d="M12 13c-4 0-6-2-6-6 4 0 6 2 6 6zM12 11c0-3 2-5 6-5 0 3-2 5-6 5z"/>',
    seed: '<ellipse cx="12" cy="12" rx="7.5" ry="4.6" transform="rotate(-30 12 12)"/><path d="M8.8 14.2c1.3-2 3.3-3.3 5.8-4"/>',
    fertile: '<circle cx="12" cy="12" r="5.8"/><circle cx="12" cy="12" r="9.2" stroke-dasharray="2.6 2.4"/>',
    hungry: '<circle cx="12" cy="12" r="5.2"/><path d="M12 2.6a9.4 9.4 0 0 1 8.1 4.7M21 13.6a9.4 9.4 0 0 1-4.3 6.4M7.3 20.1A9.4 9.4 0 0 1 3 13.6M3.9 7.3A9.4 9.4 0 0 1 9.8 2.9"/>',
    barren: '<circle cx="12" cy="12" r="8.2"/><circle cx="9" cy="10" r="2"/><circle cx="15" cy="15" r="1.4"/><circle cx="15.5" cy="8.5" r=".8"/>',
    sun: '<circle cx="12" cy="12" r="4.4"/><path d="M12 2.5v2.8M12 18.7v2.8M2.5 12h2.8M18.7 12h2.8M5.3 5.3l2 2M16.7 16.7l2 2M5.3 18.7l2-2M16.7 7.3l2-2"/>',
    ice: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.8 4.6L12 6.8l2.2-2.2M9.8 19.4l2.2-2.2 2.2 2.2"/>',
    blackhole: '<circle cx="12" cy="12" r="3.4" fill="currentColor"/><path d="M2.8 12c2.2-3 5.8-4.6 9.2-4.6s7 1.6 9.2 4.6c-2.2 3-5.8 4.6-9.2 4.6S5 15 2.8 12z"/>',
    repulsor: '<circle cx="12" cy="12" r="2.4"/><path d="M7.4 7.4a6.5 6.5 0 0 0 0 9.2M16.6 7.4a6.5 6.5 0 0 1 0 9.2M4.3 4.6a10.5 10.5 0 0 0 0 14.8M19.7 4.6a10.5 10.5 0 0 1 0 14.8"/>',
    shield: '<circle cx="12" cy="12" r="4"/><path d="M12 3a9 9 0 1 1-8.4 5.8"/>',
    portal: '<circle cx="6.8" cy="12" r="4.2"/><circle cx="17.2" cy="12" r="4.2"/><path d="M6.8 12h10.4" stroke-dasharray="1.6 2"/>',
    wind: '<path d="M3 8.5h11a2.8 2.8 0 1 0-2.8-2.8M3 12.5h15a2.8 2.8 0 1 1-2.8 2.8M3 16.5h7"/>',
    boost: '<path d="M5 6l6 6-6 6M12 6l6 6-6 6"/>',
    pollen: '<circle cx="11" cy="13" r="4.2"/><path d="M18.5 3v4.4M16.3 5.2h4.4M5 5.5v2M4 6.5h2"/>',
    orbit: '<circle cx="12" cy="12" r="3"/><ellipse cx="12" cy="12" rx="9.2" ry="4" transform="rotate(-25 12 12)"/><circle cx="19.6" cy="8.4" r="1.6" fill="currentColor"/>',
    flame: '<path d="M12 21c-3.8 0-6.2-2.8-6.2-6 0-4.2 4.2-6 4.2-11 3.2 2 6 5 6 9 .9-.8 1.4-1.9 1.4-3 1.2 1.2 1.8 3 1.8 5 0 3.3-3 6-7.2 6z"/>',
    calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.2 2"/>',
    palette: '<path d="M12 3a9 9 0 1 0 0 18c1 0 1.5-.7 1.5-1.5 0-1.2-1-1.5-1-2.5s.8-1.5 2-1.5h2A4.5 4.5 0 0 0 21 11c0-4.4-4-8-9-8z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7.5" r="1"/>',
    flower: '<circle cx="12" cy="8.5" r="1.8"/><path d="M12 10.5V21M12 16c-2.4 0-4-1.4-4-3.6M12 6.7c-.7-2.2.4-3.7 0-3.7s.7 1.5 0 3.7zM10.2 8.5c-2.2.7-3.7-.4-3.7 0s1.5-.7 3.7 0zM13.8 8.5c2.2-.7 3.7.4 3.7 0s-1.5.7-3.7 0zM12 10.3c.7 2.2-.4 3.7 0 3.7"/>',
    planet: '<circle cx="12" cy="12" r="5.6"/><path d="M5.5 14.8c-2.6 2.2-2.3 3.6.6 3.3 3.2-.3 8.8-3.4 11.8-6.4 2.6-2.6 2.6-4.3-.2-3.8"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".8" fill="currentColor"/>',
    map: '<path d="M3.5 6.5l5-2 7 2.5 5-2v13l-5 2-7-2.5-5 2z"/><path d="M8.5 4.5v13M15.5 7v13"/>',
    nectar: '<path d="M12 3.2c3.6 4.4 6 7.8 6 10.9a6 6 0 0 1-12 0c0-3.1 2.4-6.5 6-10.9z"/><path d="M9.2 14.6a3 3 0 0 0 2.6 2.6"/>',
    cloud: '<path d="M7 18.5h10.2a4.3 4.3 0 0 0 .6-8.6A6 6 0 0 0 6.3 11a3.8 3.8 0 0 0 .7 7.5z"/>',
    cloudoff: '<path d="M7 18.5h10.2M17.8 9.9A6 6 0 0 0 8.4 7.2M6.3 11a3.8 3.8 0 0 0 .7 7.5M20.8 16.4a4.3 4.3 0 0 0-1.6-5.6M4 4l16 16"/>',
    eye: '<path d="M2.8 12c2.4-4 5.6-6 9.2-6s6.8 2 9.2 6c-2.4 4-5.6 6-9.2 6s-6.8-2-9.2-6z"/><circle cx="12" cy="12" r="3"/>',
    down: '<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>',
    up: '<path d="M12 16V5M7 9.5l5-5 5 5M5 20h14"/>',
    sync: '<path d="M19 8.5A7.5 7.5 0 0 0 5.6 7M5 15.5A7.5 7.5 0 0 0 18.4 17"/><path d="M19.5 4v4.8h-4.8M4.5 20v-4.8h4.8"/>',
    shop: '<path d="M4 9.5h16l-1.2 10.5H5.2z"/><path d="M8.5 9.5V7a3.5 3.5 0 0 1 7 0v2.5"/>',
    friends: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19.5c.6-3.4 2.8-5.2 5.5-5.2s4.9 1.8 5.5 5.2"/><circle cx="16.6" cy="9.4" r="2.5"/><path d="M15.6 14.3c2.5-.3 4.4 1.2 4.9 4.4"/>',
    fert: '<path d="M9.5 3h5M10.5 3v4.2L6.6 13.6A5 5 0 0 0 11 21h2a5 5 0 0 0 4.4-7.4L13.5 7.2V3"/><path d="M7.6 14.5h8.8"/>',
    badge: '<circle cx="12" cy="12" r="9"/><path d="M8 9l4 3 4-2M12 12l-1 5"/><circle cx="8" cy="9" r=".9" fill="currentColor"/><circle cx="16" cy="10" r=".9" fill="currentColor"/><circle cx="11" cy="17" r=".9" fill="currentColor"/>'
  };
  const ic = (n, cls) => `<svg class="i${cls ? " " + cls : ""}" viewBox="0 0 24 24" aria-hidden="true">${IC[n] || ""}</svg>`;
  const STAR_PATH = "M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z";
  const star = (on, cls) => `<svg class="star${on ? " on" : ""}${cls ? " " + cls : ""}" viewBox="0 0 24 24" aria-hidden="true"><path d="${STAR_PATH}"/></svg>`;

  const DEFAULT_SETTINGS = { skin: "nocturne", grid: true, shake: true, reducedMotion: false, colorblind: false, assist: false, fastForward: false, unlockAll: false, trail: "classic", master: 0.8, music: 0.6, sfx: 0.8, muted: false };
  const SKINS = [
    { id: "nocturne", name: "Nocturne", note: "Risograph night, the original" },
    { id: "daylight", name: "Daylight", note: "Paper and blue ink" },
    { id: "synthwave", name: "Synthwave", note: "Neon glow on black" },
    { id: "inkwell", name: "Inkwell", note: "Monochrome, high contrast" }
  ];
  const FLORA = [
    { id: "daisy", name: "Star daisy" }, { id: "fern", name: "Frost fern" }, { id: "spiral", name: "Fold spiral" },
    { id: "sunflower", name: "Clock sunflower" }, { id: "ember", name: "Ember bloom" }
  ];

  function freshSave() {
    return {
      v: 2, levels: {}, ach: {}, flora: {}, seen: {}, fails: {}, coach: {}, announced: {}, skins: { nocturne: 1 },
      stats: { sown: 0, plants: 0, pollen: 0, playMs: 0, wins: 0, losses: 0, burn: 0, crash: 0, swallow: 0, bounce: 0, warp: 0, boost: 0, shield: 0, lost: 0, zen: 0, daily: 0, lastSeed: 0, stubborn: 0 },
      settings: Object.assign({}, DEFAULT_SETTINGS),
      daily: { last: null, streak: 0, best: 0, days: {} },
      zen: { diff: 3, seed: null },
      wallet: { earn: {}, spend: {}, frost: {} },
      sync: { dev: newDevId(), gen: 0, others: {}, settingsAt: 0, st: null }
    };
  }
  function newDevId() { return window.OrchardCloud ? window.OrchardCloud.newId() : Math.random().toString(36).slice(2, 14); }
  function loadSave() {
    const s = freshSave();
    let d = null;
    try { d = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { d = null; }
    if (d && typeof d === "object") {
      for (const k of Object.keys(s)) {
        if (d[k] == null) continue;
        if (typeof s[k] === "object" && !Array.isArray(s[k]) && typeof d[k] === "object") s[k] = Object.assign(s[k], d[k]);
        else s[k] = d[k];
      }
      if (!d.sync && d.settings) s.sync.settingsAt = 1;
    }
    return s;
  }
  let S = loadSave();
  const hadSave = (() => { try { return !!localStorage.getItem(KEY); } catch (e) { return false; } })();
  let saveTimer = 0;
  function save(now) {
    clearTimeout(saveTimer);
    const write = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
    if (now) write(); else saveTimer = setTimeout(write, 250);
    if (cloud) cloud.notify(now);
    if (window.OrchardFriends) window.OrchardFriends.notify();
  }

  let WORLDS = [], WORLDS_BY_ID = [];
  const LV = new WeakMap();
  let LVID = {};
  const worldOrder = (w) => (w.order != null ? w.order : w.id);
  function readWorlds() {
    const src = Array.isArray(window.ORCHARD_WORLDS) ? window.ORCHARD_WORLDS : [];
    WORLDS_BY_ID = src.filter((w) => w && Array.isArray(w.levels)).slice().sort((a, b) => a.id - b.id);
    WORLDS = WORLDS_BY_ID.slice().sort((a, b) => worldOrder(a) - worldOrder(b) || a.id - b.id);
    WORLDS.forEach((w) => LV.set(w, w.levels.slice().sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))));
    LVID = {};
    WORLDS.forEach((w, wi) => levelsOf(w).forEach((l, j) => { LVID[l.id] = { wi, j, lv: l }; }));
  }
  const levelsOf = (w) => (w && LV.get(w)) || [];
  const theme = (w) => (w && w.theme) || { bg: ["#1f2350", "#2b1f4f", "#0e1128"], nebula: "#ff9ec4", accent: "#8fc79a", glow: "#ffd9a8", flora: "daisy" };
  const totalLevels = () => WORLDS.reduce((n, w) => n + levelsOf(w).length, 0);
  const rec = (id) => S.levels[id];
  const isCleared = (id) => !!(S.levels[id] && S.levels[id].stars > 0);
  const worldCleared = (w) => levelsOf(w).filter((l) => isCleared(l.id)).length;
  const starAt = (l) => (l && Array.isArray(l.stars) ? l.stars : [l.par, l.par + 1]);
  const worldStars = (w) => levelsOf(w).reduce((n, l) => n + ((rec(l.id) && rec(l.id).stars) || 0), 0);
  const worldGolden = (w) => levelsOf(w).filter((l) => rec(l.id) && rec(l.id).golden).length;
  const worldPollenLevels = (w) => levelsOf(w).filter((l) => l.pollen && l.pollen.length).length;
  const needFor = (w) => Math.min(16, levelsOf(w).length);
  function realUnlocked(i) {
    if (i <= 0 || (WORLDS[i] && S.announced[WORLDS[i].id])) return true;
    const p = WORLDS[i - 1];
    return !!p && levelsOf(p).length > 0 && worldCleared(p) >= needFor(p);
  }
  /** Marks worlds the id-order unlock rule had opened, once per device. */
  function keepIdOrderUnlocks() {
    if (S.sync.wo) return;
    WORLDS_BY_ID.forEach((w, i) => {
      const p = WORLDS_BY_ID[i - 1];
      if (!p || (levelsOf(p).length > 0 && worldCleared(p) >= needFor(p))) S.announced[w.id] = 1;
    });
    S.sync.wo = 1;
  }
  const exploreAll = () => !!(window.ORCHARD_DEV && S.settings.unlockAll);
  const worldUnlocked = (i) => exploreAll() || realUnlocked(i);
  function levelUnlocked(wi, j, real) {
    const all = exploreAll() && !real;
    if (!(all || realUnlocked(wi))) return false;
    if (all || j === 0) return true;
    const L = levelsOf(WORLDS[wi]);
    return isCleared(L[j].id) || isCleared(L[j - 1].id) || (j > 1 && isCleared(L[j - 2].id));
  }
  const perfectOn = (id) => !!S.wallet.earn["par:" + id];
  const worldColorVars = (w) => {
    const t = theme(w);
    return `--w-accent:${t.accent};--w-glow:${t.glow};--w-nebula:${t.nebula};--w-bg1:${t.bg[0]};--w-bg2:${t.bg[2] || t.bg[1]};`;
  };
  function setWorldVars(el, w) {
    const t = theme(w);
    el.style.setProperty("--w-accent", t.accent);
    el.style.setProperty("--w-glow", t.glow);
    el.style.setProperty("--w-nebula", t.nebula);
  }

  function kindsOf(lv) {
    const k = new Set();
    (lv.bodies || []).forEach((b) => {
      if (b.kind) k.add(b.kind);
      if (b.orbit) k.add("orbit");
      if (b.shield) k.add("shield");
      if (b.kind === "fertile" && b.need > 1) k.add("hungry");
    });
    if (lv.portals && lv.portals.length) k.add("portal");
    if (lv.winds && lv.winds.length) k.add("wind");
    if (lv.boosts && lv.boosts.length) k.add("boost");
    if (lv.pollen && lv.pollen.length) k.add("pollen");
    return Array.from(k);
  }

  const ALMANAC = [
    { k: "fertile", name: "Soil", w: 1, text: "Ringed planets are soil. Land a seed anywhere on the surface and it takes root. Sow every one to finish a plot." },
    { k: "hungry", name: "Hungry soil", w: 1, text: "The segments around the ring count how many seeds this soil wants. Each seed fills one segment." },
    { k: "barren", name: "Barren rock", w: 1, text: "Nothing grows on grey rock, but its pull still bends every flight that passes close." },
    { k: "sun", name: "Sun", w: 1, text: "Heavy and hot. Whip around a sun to gain speed; touch it and the seed is scorched." },
    { k: "pollen", name: "Pollen", w: 1, text: "Golden motes adrift. Gather every one in a single attempt to earn the golden badge." },
    { k: "ice", name: "Ice", w: 2, text: "Slick worlds. Seeds glance off like a cue ball and keep flying, so bank your shots." },
    { k: "shield", name: "Shield", w: 2, text: "An arc guards the soil. Only the gap lets seeds through, and some arcs turn." },
    { k: "orbit", name: "Orbit", w: 3, text: "Moons circle their parent while you aim. The preview line shows where they will be." },
    { k: "portal", name: "Fold", w: 4, text: "Two violet rings are joined. Enter one and leave the other at the same speed and heading." },
    { k: "wind", name: "Wind", w: 4, text: "A band of steady current. Anything flying inside it drifts the same way." },
    { k: "boost", name: "Boost gate", w: 4, text: "Speeds a seed up as it passes through. Some gates also turn it to a new heading." },
    { k: "blackhole", name: "Black hole", w: 5, text: "Tiny and ravenous. Its pull reaches across the plot and nothing comes back out." },
    { k: "repulsor", name: "Repulsor", w: 5, text: "Pushes seeds away instead of pulling them in. Touching one still ends the flight." }
  ];
  function firstWorldOf(k) {
    for (let i = 0; i < WORLDS.length; i++) {
      if (levelsOf(WORLDS[i]).some((l) => kindsOf(l).includes(k))) return i;
    }
    const a = ALMANAC.find((x) => x.k === k);
    return a ? a.w - 1 : 0;
  }
  const almanacOpen = (k) => !!S.seen[k] || worldUnlocked(firstWorldOf(k));
  const almanacEarned = (k) => !!S.seen[k] || realUnlocked(firstWorldOf(k));
  function discover(lv) {
    let n = 0;
    kindsOf(lv).forEach((k) => { if (!S.seen[k]) { S.seen[k] = 1; n++; } });
    if (n) save();
  }

  const ACH = [];
  const TIER_PAY = { bronze: 20, silver: 40, gold: 80, platinum: 150 };
  const TIER_NAME = { bronze: "Bronze", silver: "Silver", gold: "Gold", platinum: "Platinum" };
  function achRewards(a) {
    if (!a.nectar) return 0;
    const base = Math.min(a.nectar, NECTAR.ach);
    return earn("ach:" + a.id, base) + (a.nectar > base ? earn("tro:" + a.id, a.nectar - base) : 0);
  }
  function buildAch() {
    ACH.length = 0;
    const tl = Math.max(1, totalLevels());
    const add = (id, name, desc, icon, max, cur, tier, nectar) => ACH.push({ id, name, desc, icon, max, cur, tier, nectar: nectar == null ? TIER_PAY[tier] : nectar });
    add("first-seed", "Sower", "Sow your first seed.", "seed", 1, () => S.stats.sown, "bronze", 0);
    add("first-clear", "First sprout", "Clear a plot.", "sprout", 1, (d) => d.cleared, "bronze");
    add("three-star", "Full bloom", "Earn three stars on a plot.", "target", 1, (d) => d.three, "bronze");
    add("ten-plots", "Allotment", "Clear 10 plots.", "sprout", 10, (d) => d.cleared, "silver");
    add("fifty-plots", "Market garden", "Clear 50 plots.", "pot", 50, (d) => d.cleared, "gold");
    add("three-25", "Green thumb", "Earn three stars on 25 plots.", "target", 25, (d) => d.three, "gold");
    add("all-plots", "Orbit orchard", "Clear every plot in the game.", "trophy", tl, (d) => d.cleared, "platinum");
    const keepers = { 1: "Meadow keeper", 2: "Frost keeper", 3: "Fold keeper", 4: "Clock keeper", 5: "Horizon keeper" };
    const worldTiers = ["silver", "gold", "gold", "gold", "platinum"];
    WORLDS.forEach((w, i) => add("world-" + w.id, keepers[w.id] || w.name + " keeper", `Clear every plot in ${w.name}.`, "planet", Math.max(1, levelsOf(w).length), () => worldCleared(w), worldTiers[i] || "gold"));
    add("perfect-world", "Constellation", "Earn every star in one world.", "sky", 1, (d) => d.perfect, "gold");
    add("golden-1", "Gilded", "Win a golden pollen badge.", "pollen", 1, (d) => d.golden, "bronze");
    add("golden-20", "Pollinator", "Win 20 golden badges.", "pollen", 20, (d) => d.golden, "gold");
    add("pollen-100", "Gold dust", "Gather 100 pollen.", "pollen", 100, () => S.stats.pollen, "silver");
    add("burn-10", "Sunburnt", "Scorch 10 seeds on suns.", "flame", 10, () => S.stats.burn, "bronze");
    add("bounce-25", "Skater", "Bounce off ice 25 times.", "ice", 25, () => S.stats.bounce, "silver");
    add("warp-25", "Folded", "Pass through folds 25 times.", "portal", 25, () => S.stats.warp, "silver");
    add("boost-25", "Slipstream", "Pass through 25 boost gates.", "boost", 25, () => S.stats.boost, "silver");
    add("swallow", "Event horizon", "Lose a seed to a black hole.", "blackhole", 1, () => S.stats.swallow, "bronze");
    add("last-seed", "Last seed", "Clear a plot with your final seed.", "seed", 1, () => S.stats.lastSeed, "silver");
    add("stubborn", "Stubborn bloom", "Clear a plot after failing it three times.", "restart", 1, () => S.stats.stubborn, "silver");
    add("daily-1", "Sky watcher", "Finish a Daily Sky.", "calendar", 1, () => S.stats.daily, "bronze");
    add("streak-7", "Seven skies", "Reach a 7 day Daily Sky streak.", "calendar", 7, () => S.daily.best, "gold");
    add("zen-10", "Stillness", "Sow 10 Zen skies.", "zen", 10, () => S.stats.zen, "silver");
    add("botanist", "Botanist", "Grow all five kinds of flora.", "flower", 5, () => FLORA.filter((f) => S.flora[f.id] > 0).length, "silver");
    add("plants-100", "Glasshouse", "Grow 100 plants.", "pot", 100, () => S.stats.plants, "silver");
    add("hour", "Night shift", "Garden for an hour in total.", "clock", 60, () => Math.floor(S.stats.playMs / 60000), "silver");
    add("skins", "Dressed up", "Try all four skins.", "palette", 4, () => SKINS.filter((s) => S.skins[s.id]).length, "bronze");
    add("almanac", "Field naturalist", "Open every page of the Almanac.", "book", ALMANAC.length, () => ALMANAC.filter((a) => almanacEarned(a.k)).length, "bronze");
  }
  function derive() {
    const d = { cleared: 0, three: 0, golden: 0, perfect: 0, perfects: Object.keys(S.wallet.earn).filter((k) => k.indexOf("par:") === 0).length };
    Object.keys(S.levels).forEach((id) => {
      const r = S.levels[id];
      if (!r || id.indexOf("daily") === 0) return;
      if (r.stars > 0) d.cleared++;
      if (r.stars >= 3) d.three++;
      if (r.golden) d.golden++;
    });
    WORLDS.forEach((w) => { const n = levelsOf(w).length; if (n && worldStars(w) >= n * 3) d.perfect = 1; });
    return d;
  }
  function checkAch(silent) {
    const d = derive();
    let got = 0;
    ACH.forEach((a) => {
      if (S.ach[a.id]) return;
      if ((a.cur(d) || 0) >= a.max) {
        S.ach[a.id] = Date.now();
        achRewards(a);
        got++;
        if (!silent) queueAch(a);
      }
    });
    if (got) save();
  }

  const achQ = [];
  let achBusy = false;
  function queueAch(a) { achQ.push(a); if (!achBusy) nextAch(); }
  function nextAch() {
    const a = achQ.shift();
    if (!a) { achBusy = false; return; }
    achBusy = true;
    sfx("achievement");
    const el = document.createElement("div");
    el.className = "ach";
    el.innerHTML = `<div class="medal">${ic(a.icon)}</div><div><small>${TIER_NAME[a.tier]} trophy${a.nectar ? `, +${a.nectar} nectar` : ""}</small><b>${esc(a.name)}</b></div>`;
    refreshChips();
    $("#achs").appendChild(el);
    setTimeout(() => { el.classList.add("out"); setTimeout(() => { el.remove(); nextAch(); }, 260); }, 3400);
  }

  const root = document.documentElement;
  const reduced = () => !!(S.settings.reducedMotion || mqReduce.matches);
  function applySkin(id) {
    if (!SKINS.some((s) => s.id === id)) id = "nocturne";
    S.settings.skin = id;
    S.skins[id] = 1;
    root.dataset.skin = id;
    eng("setSettings", { skin: id });
  }
  function applyAllSettings() {
    const st = S.settings;
    root.dataset.skin = st.skin;
    root.classList.toggle("rm", !!st.reducedMotion);
    eng("setSettings", { skin: st.skin, grid: !!st.grid, shake: !!st.shake, reducedMotion: reduced(), assist: !!st.assist, colorblind: !!st.colorblind, fastForward: !!st.fastForward, trail: st.trail || "classic" });
    aud("setVolumes", { master: st.master, music: st.music, sfx: st.sfx });
    aud("setMuted", !!st.muted);
  }
  function setSetting(key, val) {
    S.settings[key] = val;
    if (key === "reducedMotion") { root.classList.toggle("rm", !!val); eng("setSettings", { reducedMotion: reduced() }); }
    else if (["grid", "shake", "assist", "colorblind", "fastForward"].includes(key)) eng("setSettings", { [key]: !!val });
    else if (key === "trail") eng("setSettings", { trail: val });
    else if (["master", "music", "sfx"].includes(key)) aud("setVolumes", { [key]: val });
    else if (key === "muted") aud("setMuted", !!val);
    save();
  }
  function syncFast() {
    const b = $("#hFast"), on = !!S.settings.fastForward;
    if (b) { b.setAttribute("aria-pressed", on ? "true" : "false"); b.title = on ? "Fast-forward is on (3×)" : "Fast-forward every flight (3×)"; }
  }
  function toggleMute() {
    setSetting("muted", !S.settings.muted);
    refreshChips();
    toastGame(S.settings.muted ? "Sound off" : "Sound on", "info");
  }

  let unlocked = false;
  function gesture() {
    if (unlocked) return;
    unlocked = true;
    aud("unlock");
    applyAllSettings();
  }

  let screen = "title";
  function showScreen(name) {
    screen = name;
    $$(".screen").forEach((s) => {
      const on = s.dataset.screen === name;
      if (on && s.hidden) { s.hidden = false; s.classList.remove("enter"); void s.offsetWidth; s.classList.add("enter"); }
      else if (!on) s.hidden = true;
    });
    if (name === "game") syncFast();
    if (name !== "game") { closeCoach(); $("#demoBar").hidden = true; eng("setViewInsets", { top: 0, right: 0, bottom: 0, left: 0 }); }
    syncInput();
  }

  const stack = [];
  function syncInput() { eng("setInputEnabled", screen === "game" && stack.length === 0 && !(cur && cur.demo)); }
  function openModal(opts) {
    const back = document.createElement("div");
    back.className = "mback";
    const m = document.createElement("div");
    m.className = "modal " + (opts.cls || "");
    m.setAttribute("role", opts.role || "dialog");
    m.setAttribute("aria-modal", "true");
    if (opts.label) m.setAttribute("aria-label", opts.label);
    if (opts.style) m.setAttribute("style", opts.style);
    m.innerHTML = opts.html;
    back.appendChild(m);
    $("#modals").appendChild(back);
    const prevFocus = document.activeElement;
    const entry = { back, el: m, onKey: opts.onKey, dismissable: opts.dismissable !== false, closed: false };
    entry.close = (reason) => {
      if (entry.closed) return;
      entry.closed = true;
      const i = stack.indexOf(entry);
      if (i >= 0) stack.splice(i, 1);
      back.classList.add("out");
      setTimeout(() => back.remove(), reduced() ? 0 : 170);
      if (!opts.quiet) sfx("close");
      if (opts.onClose) opts.onClose(reason);
      syncInput();
      if (coach && screen === "game" && !stack.length) renderCoach();
      if (prevFocus && document.contains(prevFocus) && prevFocus.focus) { try { prevFocus.focus({ preventScroll: true }); } catch (e) {} }
    };
    back.addEventListener("pointerdown", (e) => { if (e.target === back && entry.dismissable) entry.close("backdrop"); });
    stack.push(entry);
    if (!opts.quiet) sfx("open");
    syncInput();
    closeCoach(true);
    requestAnimationFrame(() => {
      const f = m.querySelector("[autofocus]") || m.querySelector("button, [href], input, textarea");
      if (f) { try { f.focus({ preventScroll: true }); } catch (e) {} }
    });
    return entry;
  }
  function closeAllModals() { while (stack.length) stack[stack.length - 1].close("all"); }
  function trapTab(e, m) {
    const f = $$("button:not([disabled]), [href], input, textarea, select, [tabindex]:not([tabindex='-1'])", m).filter((x) => x.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    else if (!m.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
  }
  function confirmModal(title, text, yes, onYes) {
    const m = openModal({
      cls: "", role: "alertdialog", label: title,
      html: `<h2>${esc(title)}</h2><p>${esc(text)}</p><div class="row"><button class="btn danger" data-a="yes" type="button">${esc(yes)}</button><button class="btn" data-a="no" type="button" autofocus>Cancel</button></div>`
    });
    m.el.addEventListener("click", (e) => {
      const a = e.target.closest("[data-a]");
      if (!a) return;
      m.close(a.dataset.a);
      if (a.dataset.a === "yes") onYes();
    });
  }

  function pushToast(box, cls, text, ms, outMs) {
    const last = box.lastElementChild;
    const fade = (el) => { clearTimeout(el._t); el._t = setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), outMs); }, ms); };
    if (last && !last.classList.contains("out") && last.className === cls && last.dataset.text === text) {
      const n = (+last.dataset.n || 1) + 1;
      last.dataset.n = n;
      const x = $(".x", last);
      x.textContent = "×" + n;
      x.hidden = false;
      x.classList.remove("bump"); void x.offsetWidth; x.classList.add("bump");
      fade(last);
      return last;
    }
    const el = document.createElement("div");
    el.className = cls;
    el.dataset.text = text;
    el.innerHTML = '<span></span><b class="x" hidden></b>';
    $("span", el).textContent = text;
    box.appendChild(el);
    while (box.children.length > 3) box.firstChild.remove();
    fade(el);
    return el;
  }
  function toastGame(text, tone) { pushToast($("#gtoasts"), "gtoast " + (tone || "info"), text, 1700, 220); }

  function buildTitle() {
    const split = (el, off) => {
      const t = el.textContent;
      el.innerHTML = Array.from(t).map((c, i) => `<span class="ch" style="--i:${i + off}" aria-hidden="true">${esc(c)}</span>`).join("");
    };
    const a = $("#logoA"), b = $("#logoB");
    split(a, 0); split(b, 5);
    const o = document.createElement("span");
    o.className = "orbit";
    o.setAttribute("aria-hidden", "true");
    o.innerHTML = "<i></i>";
    a.appendChild(o);
    const touch = matchMedia("(pointer: coarse)").matches;
    $("#pressPrompt").textContent = touch ? "Tap to begin" : "Press any key or click to begin";
    $("#scr-title").addEventListener("click", () => { gesture(); enterHub(); });
    if (web) {
      $("#pressPrompt").insertAdjacentHTML("afterend", `<button class="btn small ghost web-sign" id="webSign" type="button" hidden>${GLOGO}Sign in with Google to save to the cloud</button>`);
      $("#webSign").addEventListener("click", (e) => { e.stopPropagation(); gesture(); webSignIn(); });
      webTitle();
    }
  }
  function toTitle() {
    closeAllModals();
    stopPanelLoops();
    renderFlourish();
    showScreen("title");
    eng("showcase", null);
  }

  const TABS = [
    { id: "journey", label: "Journey", short: "Journey", icon: "route" },
    { id: "daily", label: "Daily Sky", short: "Daily", icon: "sky" },
    { id: "zen", label: "Zen Garden", short: "Zen", icon: "zen" },
    { id: "almanac", label: "Almanac", short: "Almanac", icon: "book" },
    { id: "greenhouse", label: "Greenhouse", short: "Greenhouse", icon: "pot" },
    { id: "trophies", label: "Trophies", short: "Trophies", icon: "trophy" },
    { id: "market", label: "Market", short: "Market", icon: "shop" },
    { id: "settings", label: "Settings", short: "Settings", icon: "gear" },
    { id: "friends", label: "Friends", short: "Friends", icon: "friends" }
  ];
  let tab = "journey";
  let journeyWorld = null;
  function buildTabs() {
    const bar = $("#tabbar");
    bar.insertAdjacentHTML("beforeend", TABS.map((t, i) =>
      `<button class="tab" role="tab" id="tab-${t.id}" data-tab="${t.id}" aria-controls="panels" aria-selected="false" tabindex="-1" aria-label="${t.label}" title="${t.label} (${i + 1})">${ic(t.icon)}<span class="long" aria-hidden="true">${t.label}</span><span class="short" aria-hidden="true">${t.short}</span><span class="n" aria-hidden="true">${i + 1}</span></button>`).join(""));
    bar.addEventListener("click", (e) => {
      const b = e.target.closest(".tab");
      if (b) setTab(b.dataset.tab, { focus: true });
    });
    $("#homeLogo").addEventListener("click", toTitle);
    $("#hubChips").addEventListener("click", (e) => {
      if (e.target.closest("[data-a=mute]")) toggleMute();
      if (e.target.closest("[data-a=market]")) setTab("market", { focus: true });
      if (e.target.closest("[data-a=cloud]")) { setTab("settings", { focus: true }); requestAnimationFrame(() => { const c = $("#cloudCard"); if (c) c.scrollIntoView({ block: "center" }); }); }
    });
  }
  function moveInd() {
    const b = $(`#tab-${tab}`), ind = $("#tabInd");
    if (!b || !ind || !b.offsetWidth) return;
    ind.style.width = b.offsetWidth + "px";
    ind.style.transform = `translateX(${b.offsetLeft}px)`;
  }
  function refreshChips() {
    const tl = totalLevels();
    const stars = WORLDS.reduce((n, w) => n + worldStars(w), 0);
    $("#hubChips").innerHTML =
      `<span class="chip" title="Stars earned">${star(true, "star-ic i")}<b>${stars}</b><span class="lbl muted">of ${tl * 3}</span></span>` +
      `<span class="chip streak" title="Daily Sky streak">${ic("flame", "streak-ic")}<b>${liveStreak()}</b><span class="lbl muted">day streak</span></span>` +
      `<button class="chip nectar" data-a="market" type="button" title="Nectar: spend it in the Market">${ic("nectar")}<b>${nectar()}</b><span class="lbl muted">nectar</span></button>` +
      cloudChip() +
      `<button class="btn icon small" data-a="mute" type="button" aria-label="${S.settings.muted ? "Unmute" : "Mute"} (M)" title="${S.settings.muted ? "Unmute" : "Mute"} (M)">${ic(S.settings.muted ? "mute" : "sound")}</button>`;
  }

  let panelStop = [];
  function stopPanelLoops() { panelStop.forEach((f) => f()); panelStop = []; }
  function setTab(id, o) {
    o = o || {};
    const prev = TABS.findIndex((t) => t.id === tab), next = TABS.findIndex((t) => t.id === id);
    if (next < 0) return;
    if (id === "journey" && tab === "journey" && journeyWorld != null && !o.keepWorld) journeyWorld = null;
    tab = id;
    $$(".tab").forEach((b) => {
      const on = b.dataset.tab === id;
      b.setAttribute("aria-selected", on ? "true" : "false");
      b.tabIndex = on ? 0 : -1;
    });
    const b = $(`#tab-${id}`);
    if (o.focus && b) b.focus({ preventScroll: true });
    if (b && b.scrollIntoView) { try { b.scrollIntoView({ block: "nearest", inline: "nearest" }); } catch (e) {} }
    moveInd();
    renderPanel(o.still ? "" : next > prev ? "in-r" : next < prev ? "in-l" : "in-r");
    if (id !== "journey" || journeyWorld == null) eng("showcase", null);
  }
  function renderPanel(anim) {
    stopPanelLoops();
    const host = $("#panels");
    host.setAttribute("aria-labelledby", "tab-" + tab);
    host.setAttribute("role", "tabpanel");
    const p = document.createElement("div");
    p.className = "panel" + (anim && !reduced() ? " " + anim : "");
    host.innerHTML = "";
    host.appendChild(p);
    host.scrollTop = 0;
    const fn = { journey: renderJourney, daily: renderDaily, zen: renderZen, almanac: renderAlmanac, greenhouse: renderGreenhouse, trophies: renderTrophies, market: renderMarket, settings: (el) => renderSettings(el, false), friends: renderFriends }[tab];
    fn(p);
    refreshChips();
  }
  function rerender() {
    const host = $("#panels"), y = host.scrollTop;
    renderPanel("");
    host.scrollTop = y;
  }
  function enterHub(o) {
    o = o || {};
    closeAllModals();
    showScreen("hub");
    aud("music", "menu");
    if (o.tab) tab = o.tab;
    if ("world" in o) journeyWorld = o.world;
    setTab(tab, { still: true, keepWorld: true });
    if (tab === "journey" && journeyWorld != null) eng("showcase", WORLDS[journeyWorld] || null);
    requestAnimationFrame(moveInd);
    if (pendingWelcome) setTimeout(showWelcome, reduced() ? 0 : 450);
  }

  function planetHtml(w, pct, size) {
    const r = 58, c = 2 * Math.PI * r;
    return `<div class="planet" ${size ? `style="width:${size}px;height:${size}px"` : ""}><svg class="ring" viewBox="0 0 132 132" aria-hidden="true"><circle class="track" cx="66" cy="66" r="${r}"/><circle class="prog" cx="66" cy="66" r="${r}" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - clamp(pct, 0, 1))).toFixed(1)}"/></svg><div class="disc" style="${worldColorVars(w)}"></div></div>`;
  }
  function worldKinds(w) {
    const k = new Set();
    levelsOf(w).forEach((l) => kindsOf(l).forEach((x) => k.add(x)));
    return ALMANAC.map((a) => a.k).filter((x) => k.has(x));
  }

  function renderJourney(p) {
    if (journeyWorld != null && WORLDS[journeyWorld] && worldUnlocked(journeyWorld)) return renderWorld(p, journeyWorld);
    journeyWorld = null;
    if (!WORLDS.length) {
      p.innerHTML = `<div class="ph"><div><h2>Journey</h2><p>No worlds are loaded yet. Check that the level files are next to this page.</p></div></div>`;
      return;
    }
    const cards = WORLDS.map((w, i) => {
      const L = levelsOf(w), open = worldUnlocked(i), cl = worldCleared(w), st = worldStars(w);
      const pct = L.length ? st / (L.length * 3) : 0;
      const prevW = WORLDS[i - 1];
      const need = prevW ? Math.max(0, needFor(prevW) - worldCleared(prevW)) : 0;
      return `<button class="wcard${open ? "" : " locked"}" type="button" data-w="${i}" ${open ? "" : 'aria-disabled="true"'} aria-label="${esc(w.name)}${open ? `, ${cl} of ${L.length} plots cleared` : ", locked"}">
        ${planetHtml(w, pct)}${open ? "" : `<span class="lock-badge" style="top:48px">${ic("lock")}</span>`}${owns("badge:" + w.id) ? `<span class="wbadge" title="${esc(w.name)} constellation">${badgeSvg(i)}</span>` : ""}
        <span class="wnum">World ${i + 1}</span>
        <span class="wn">${esc(w.name)}</span>
        ${open ? `<span class="wstat"><span><b>${cl}</b>/${L.length} plots</span><span><b>${st}</b> stars</span></span>
        <span class="mech" aria-hidden="true">${worldKinds(w).map((k) => ic(k)).join("")}</span>`
        : `<span class="req">Clear ${need} more plot${need === 1 ? "" : "s"} in ${esc(prevW ? prevW.name : "")}</span>`}
      </button>`;
    }).join("");
    const cur = currentWorldIndex(), nx = nextPlot(cur), nl = nx >= 0 ? levelsOf(WORLDS[cur])[nx] : null;
    p.innerHTML = `<div class="ph"><div><h2>Journey</h2><p>Five worlds, each with its own flora. Clear ${needFor(WORLDS[0])} plots in a world to open the next.</p></div>
      <div class="row"><button class="btn primary cont" type="button" data-a="continue">${ic("play")}<span>Continue in ${esc(WORLDS[cur].name)}${nl ? `<small>${levelPlotLabel(nx)}, ${esc(nl.name)}</small>` : ""}</span></button></div></div>
      <div class="route" id="route"><svg class="path" aria-hidden="true"><path class="p-todo"/><path class="p-done"/></svg>${cards}</div>`;
    p.addEventListener("click", (e) => {
      if (e.target.closest("[data-a=continue]")) { if (nx >= 0) playLevel(cur, nx); else openWorld(cur); return; }
      const c = e.target.closest(".wcard");
      if (!c) return;
      const i = +c.dataset.w;
      if (!worldUnlocked(i)) { sfx("lose"); c.animate && !reduced() && c.animate([{ transform: "translateX(0)" }, { transform: "translateX(-6px)" }, { transform: "translateX(6px)" }, { transform: "translateX(0)" }], { duration: 260 }); return; }
      openWorld(i);
    });
    let shown = -1;
    p.addEventListener("pointerover", (e) => {
      const c = e.target.closest(".wcard");
      if (c && +c.dataset.w !== shown && worldUnlocked(+c.dataset.w)) { shown = +c.dataset.w; eng("showcase", WORLDS[shown]); }
    });
    requestAnimationFrame(drawRoute);
  }
  function currentWorldIndex() {
    let top = 0;
    for (let i = WORLDS.length - 1; i >= 0; i--) {
      if (!realUnlocked(i)) continue;
      top = Math.max(top, i);
      if (worldCleared(WORLDS[i]) < levelsOf(WORLDS[i]).length) return i;
    }
    return top;
  }
  function drawRoute() {
    const r = $("#route");
    if (!r) return;
    const box = r.getBoundingClientRect();
    const pts = $$(".wcard .disc", r).map((d) => { const b = d.getBoundingClientRect(); return [b.left + b.width / 2 - box.left, b.top + b.height / 2 - box.top]; });
    const seg = (a, b) => {
      const dx = b[0] - a[0], dy = b[1] - a[1];
      return Math.abs(dx) > Math.abs(dy)
        ? `C${a[0] + dx * 0.5},${a[1]} ${b[0] - dx * 0.5},${b[1]} ${b[0]},${b[1]}`
        : `C${a[0]},${a[1] + dy * 0.5} ${b[0]},${b[1] - dy * 0.5} ${b[0]},${b[1]}`;
    };
    let all = "", done = "";
    for (let i = 0; i < pts.length - 1; i++) {
      const s = `M${pts[i][0]},${pts[i][1]} ` + seg(pts[i], pts[i + 1]);
      if (worldUnlocked(i + 1)) done += s; else all += s;
    }
    $(".p-todo", r).setAttribute("d", all);
    $(".p-done", r).setAttribute("d", done);
  }
  function openWorld(i) {
    journeyWorld = i;
    eng("showcase", WORLDS[i]);
    renderPanel("in-r");
  }

  function levelPlotLabel(j) { return "Plot " + String(j + 1).padStart(2, "0"); }
  function nextPlot(wi) { return levelsOf(WORLDS[wi]).findIndex((l, j) => !isCleared(l.id) && levelUnlocked(wi, j)); }
  function placeLabel() {
    if (!cur) return "";
    if (cur.mode === "journey") return `${cur.w ? cur.w.name : ""}, ${levelPlotLabel(cur.li)}`;
    if (cur.mode === "daily") return `Daily Sky, ${prettyDay(cur.key)}`;
    if (cur.mode === "challenge") return cur.chal.label || `Challenge, seed ${cur.seed}`;
    return `Zen Garden, seed ${cur.seed}`;
  }
  function currentLevelIndex(wi) {
    const L = levelsOf(WORLDS[wi]);
    for (let j = 0; j < L.length; j++) if (!isCleared(L[j].id) && levelUnlocked(wi, j)) return j;
    return Math.max(0, L.length - 1);
  }
  function renderWorld(p, wi) {
    const w = WORLDS[wi], L = levelsOf(w), t = theme(w);
    p.classList.add("wpage");
    p.setAttribute("style", worldColorVars(w));
    const cl = worldCleared(w), st = worldStars(w), gp = worldGolden(w), gpt = worldPollenLevels(w);
    const host = $("#panels");
    const pw = Math.min(1100, host.clientWidth - 40);
    const cw = pw > 900 ? pw - 324 : pw;
    const cols = cw >= 700 ? 7 : cw >= 480 ? 5 : 4;
    const rows = Math.ceil(L.length / cols);
    const rowH = cw >= 480 ? 104 : 94;
    const H = rows * rowH + 20;
    const pos = L.map((_, j) => {
      const r = Math.floor(j / cols), c0 = j % cols, c = r % 2 ? cols - 1 - c0 : c0;
      const jx = Math.sin(j * 2.3 + wi) * (cw / cols) * 0.14, jy = Math.cos(j * 1.7 + wi * 3) * 12;
      return [((c + 0.5) / cols) * cw + jx, 44 + r * rowH + jy];
    });
    const cur = currentLevelIndex(wi);
    let lines = "";
    for (let j = 0; j < L.length - 1; j++) {
      const done = isCleared(L[j].id) && isCleared(L[j + 1].id);
      lines += `<line class="seg${done ? " done" : ""}" x1="${pos[j][0].toFixed(1)}" y1="${pos[j][1].toFixed(1)}" x2="${pos[j + 1][0].toFixed(1)}" y2="${pos[j + 1][1].toFixed(1)}"/>`;
    }
    const nodes = L.map((l, j) => {
      const r = rec(l.id) || {}, open = levelUnlocked(wi, j), boss = j === L.length - 1 && L.length >= 10;
      const cls = ["node", boss ? "boss" : "", r.stars > 0 ? "clear" : "", r.stars >= 3 ? "three" : "", open ? "" : "locked", j === cur && open && !(r.stars > 0) ? "current" : ""].join(" ");
      const hasP = l.pollen && l.pollen.length, pf = open && perfectOn(l.id);
      return `<button class="${cls}" type="button" data-j="${j}" style="left:${pos[j][0].toFixed(1)}px;top:${pos[j][1].toFixed(1)}px" aria-label="${levelPlotLabel(j)}, ${esc(l.name)}${open ? `, ${r.stars || 0} stars${pf ? ", perfect" : ""}` : ", locked"}">
        ${open ? j + 1 : ic("lock")}
        ${hasP && open ? `<span class="gp${r.golden ? " got" : ""}"></span>` : ""}
        ${pf ? `<span class="pf" title="Perfect: cleared in par">${ic("check")}</span>` : ""}
        ${open ? `<span class="st">${star(r.stars >= 1)}${star(r.stars >= 2)}${star(r.stars >= 3)}</span>` : ""}
      </button>`;
    }).join("");
    p.innerHTML = `<div class="row" style="margin-bottom:8px"><button class="btn ghost small" type="button" data-a="back">${ic("back")}World map</button></div>
      <div class="wp-head">${planetHtml(w, L.length ? st / (L.length * 3) : 0)}
        <div><h2>${esc(w.name)}</h2><p>${esc(w.blurb || "")}</p></div>
        <div class="wp-stats"><span class="chip">${ic("sprout")}<b>${cl}</b>/${L.length}</span><span class="chip">${star(true, "star-ic i")}<b>${st}</b>/${L.length * 3}</span>${gpt ? `<span class="chip" title="Golden pollen badges">${ic("pollen")}<b>${gp}</b>/${gpt}</span>` : ""}</div>
      </div>
      <div class="wp-body">
        <div class="constel" style="height:${H}px"><svg aria-hidden="true">${lines}</svg>${nodes}</div>
        <aside class="plate" id="plate" aria-live="polite"></aside>
      </div>`;
    let sel = cur;
    const plate = $("#plate", p);
    const showPlate = (j) => {
      sel = j;
      $$(".node", p).forEach((n) => n.classList.toggle("sel", +n.dataset.j === j));
      const l = L[j], r = rec(l.id) || {}, open = levelUnlocked(wi, j);
      const ks = kindsOf(l);
      plate.innerHTML = `<div class="pn">${levelPlotLabel(j)} of ${L.length}${j === L.length - 1 && L.length >= 10 ? ", showpiece" : ""}</div>
        <h3>${open ? esc(l.name) : "Locked plot"}</h3>
        <p>${open ? esc(l.hint || "") : "Clear one of the two plots before this one to open it."}</p>
        ${open ? `<div class="rstars" style="min-height:0;gap:4px">${star(r.stars >= 1)}${star(r.stars >= 2)}${star(r.stars >= 3)}${perfectOn(l.id) ? `<span class="pf-tag">${ic("check")}Perfect</span>` : ""}</div>
        <dl class="facts"><div><dt>3★</dt><dd>≤ ${starAt(l)[0]}</dd></div><div><dt>Par</dt><dd>${l.par}</dd></div><div><dt>Seeds</dt><dd>${l.seeds}</dd></div><div><dt>Best</dt><dd>${r.best != null ? r.best : "–"}</dd></div></dl>
        <div class="mechs">${ks.map((k) => `<span>${ic(k)}${esc(almanacName(k))}</span>`).join("")}</div>
        <button class="btn primary" type="button" data-a="play">${ic("play")}${r.stars ? "Replant" : "Sow"} this plot <kbd>Enter</kbd></button>` : ""}`;
      $$(".rstars svg", plate).forEach((s) => { s.style.width = "22px"; s.style.height = "22px"; });
    };
    showPlate(sel);
    p.addEventListener("click", (e) => {
      if (e.target.closest("[data-a=back]")) { journeyWorld = null; eng("showcase", null); renderPanel("in-l"); return; }
      if (e.target.closest("[data-a=play]")) { playLevel(wi, sel); return; }
      const n = e.target.closest(".node");
      if (!n) return;
      const j = +n.dataset.j;
      if (!levelUnlocked(wi, j)) { showPlate(j); sfx("lose"); return; }
      playLevel(wi, j);
    });
    const hov = (e) => { const n = e.target.closest(".node"); if (n && +n.dataset.j !== sel) showPlate(+n.dataset.j); };
    p.addEventListener("pointerover", hov);
    p.addEventListener("focusin", hov);
    p.addEventListener("keydown", (e) => {
      const n = e.target.closest(".node");
      if (!n) return;
      const j = +n.dataset.j;
      let k = null;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") k = Math.min(L.length - 1, j + 1);
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") k = Math.max(0, j - 1);
      if (k != null) { e.preventDefault(); e.stopPropagation(); const t2 = $(`.node[data-j="${k}"]`, p); if (t2) t2.focus(); }
    });
    setTimeout(() => { const n = $(`.node[data-j="${cur}"]`, p); if (n && document.activeElement && document.activeElement.classList.contains("tab") === false) n.focus({ preventScroll: true }); }, 0);
  }
  const almanacName = (k) => { const a = ALMANAC.find((x) => x.k === k); return a ? a.name : k; };

  function dayKey(d) { d = d || new Date(); return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`; }
  function dayShift(k, n) { const d = new Date(+k.slice(0, 4), +k.slice(4, 6) - 1, +k.slice(6, 8)); d.setDate(d.getDate() + n); return dayKey(d); }
  function prettyDay(k) { const d = new Date(+k.slice(0, 4), +k.slice(4, 6) - 1, +k.slice(6, 8)); return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }); }
  function liveStreak() {
    const t = dayKey();
    if (S.daily.last === t || S.daily.last === dayShift(t, -1)) return S.daily.streak || 0;
    return 0;
  }
  const DAILY_SLACK = [2, 3, 4];
  function dailyCells(r) {
    const par = r.par || r.used || 1, n = Math.max(r.used || 0, par + DAILY_SLACK[2]);
    return Array.from({ length: n }, (_, i) => (i >= r.used ? "e" : i < par ? "p" : i < par + DAILY_SLACK[0] ? "g" : i < par + DAILY_SLACK[1] ? "o" : "x"));
  }
  const CELL_EMOJI = { p: "🟩", g: "🟨", o: "🟧", x: "🟥", e: "⬛" };
  function shareText(k) {
    const r = S.daily.days[k];
    if (!r) return "";
    const lines = [`🪐 Orbit Orchard · Daily Sky ${k.slice(0, 4)}-${k.slice(4, 6)}-${k.slice(6)}${r.assist ? " (assist)" : ""}`,
      `${"⭐".repeat(r.stars)}${"☆".repeat(3 - r.stars)}  ${r.used} seed${r.used === 1 ? "" : "s"}, par ${r.par}`,
      dailyCells(r).map((c) => CELL_EMOJI[c]).join("")];
    if (r.pollenTotal) lines.push(`${"🟡".repeat(r.pollenGot || 0)}${"⚪".repeat(Math.max(0, r.pollenTotal - (r.pollenGot || 0)))} ${r.pollenGot >= r.pollenTotal ? "golden pollen ✨" : `pollen ${r.pollenGot || 0}/${r.pollenTotal}`}`);
    lines.push(`🔥 ${liveStreak()} day streak`);
    return lines.join("\n");
  }
  function shareCard(k) {
    const r = S.daily.days[k];
    if (!r) return "";
    return `<div class="scard" aria-hidden="true"><div class="sc-stars">${star(r.stars >= 1)}${star(r.stars >= 2)}${star(r.stars >= 3)}</div>
      <div class="sc-cells">${dailyCells(r).map((c) => `<i class="c-${c}"></i>`).join("")}</div>
      ${r.pollenTotal ? `<div class="sc-pollen">${Array.from({ length: r.pollenTotal }, (_, i) => `<i class="${i < (r.pollenGot || 0) ? "on" : ""}"></i>`).join("")}</div>` : ""}
      <div class="sc-legend"><span><i class="c-p"></i>par</span><span><i class="c-g"></i>3★</span><span><i class="c-o"></i>2★</span><span><i class="c-e"></i>spare</span></div></div>`;
  }
  const betterRun = (a, b) => a.stars > (b.stars || 0) || (a.stars === b.stars && (a.used < b.used || (a.used === b.used && (a.pollenGot || 0) > (b.pollenGot || 0))));
  const miniStars = (n) => `<span class="mini-stars">${star(n >= 1)}${star(n >= 2)}${star(n >= 3)}</span>`;
  function copyBox(btn, ta) {
    const label = btn.innerHTML;
    const ok = () => { btn.innerHTML = ic("check") + "Copied"; setTimeout(() => { btn.innerHTML = label; }, 1800); };
    const fallback = () => {
      ta.focus(); ta.select();
      let done = false;
      try { done = document.execCommand && document.execCommand("copy"); } catch (e) { done = false; }
      if (done) ok(); else { btn.textContent = "Selected, press Ctrl+C"; setTimeout(() => { btn.innerHTML = label; }, 2400); }
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value).then(ok, fallback);
      else fallback();
    } catch (e) { fallback(); }
  }
  function renderDaily(p) {
    const fz = applyFrost();
    if (fz) setTimeout(() => note(`A frost charm kept your streak alive`, "info"), 300);
    const k = dayKey(), r = S.daily.days[k], streak = liveStreak();
    const gen = hasEng("generateLevel");
    const week = [];
    for (let i = 6; i >= 0; i--) {
      const d = dayShift(k, -i), dd = new Date(+d.slice(0, 4), +d.slice(4, 6) - 1, +d.slice(6, 8));
      week.push(`<div><i class="${S.daily.days[d] ? "on" : ""}${i === 0 ? " today" : ""}"></i><span>${dd.toLocaleDateString(undefined, { weekday: "narrow" })}</span></div>`);
    }
    p.innerHTML = `<div class="ph"><div><h2>Daily Sky</h2><p>One new sky a day, the same for every gardener. Come back tomorrow to keep your streak growing.</p></div></div>
      <div class="split">
        <div class="sheet">
          <p class="date-big">${esc(prettyDay(k))}<small class="mono">Sky ${k}, steady difficulty</small></p>
          ${r ? `<div class="row" style="gap:14px"><div class="rstars" style="min-height:0">${star(r.stars >= 1)}${star(r.stars >= 2)}${star(r.stars >= 3)}</div><div><b>${r.used} seed${r.used === 1 ? "" : "s"}</b><div class="muted">par ${r.par}${r.pollenTotal ? `, pollen ${r.pollenGot || 0}/${r.pollenTotal}` : ""}</div></div>${r.assist ? `<span class="rtag">Assist</span>` : ""}</div>
          <p class="muted small daily-rule">Your first run of the day is the official one: it sets the streak and the share card. Replays are practice${r.best ? "." : " and keep a best."}</p>
          ${r.best ? `<div class="best-chip">${ic("restart")}<span>Best replay</span>${miniStars(r.best.stars)}<b>${r.best.used} seed${r.best.used === 1 ? "" : "s"}</b></div>` : ""}`
          : `<p class="muted">You haven't sown today's sky yet. Your first completed run is the one that counts for the streak and the share card.</p>`}
          <div class="row">
            <button class="btn${r ? "" : " primary"}" type="button" data-a="play" ${gen ? "" : "disabled"}>${ic(r ? "restart" : "play")}${r ? "Replay for practice" : "Sow today's sky"}</button>
          </div>
          ${gen ? "" : `<p class="muted">The sky generator isn't loaded, so the Daily Sky can't start.</p>`}
        </div>
        <div class="sheet">
          <div class="streak"><span class="num">${streak}</span><div><b>Day streak</b><div class="muted">Best ${S.daily.best || 0}${charmsHeld() ? `, ${charmsHeld()} frost charm${charmsHeld() === 1 ? "" : "s"} held` : ""}</div></div></div>
          <div class="week" aria-label="Last seven days">${week.join("")}</div>
          ${r ? `<div class="share"><label class="muted" for="shareTa">Share your result</label>${shareCard(k)}<textarea id="shareTa" readonly rows="6">${esc(shareText(k))}</textarea><div class="row"><button class="btn small" type="button" data-a="copy">${ic("copy")}Copy result</button></div></div>` : ""}
        </div>
      </div>`;
    $$(".rstars svg", p).forEach((s) => { s.style.width = "40px"; s.style.height = "40px"; });
    p.addEventListener("click", (e) => {
      if (e.target.closest("[data-a=play]")) startDaily();
      const c = e.target.closest("[data-a=copy]");
      if (c) copyBox(c, $("#shareTa", p));
    });
  }
  function startDaily() {
    const k = dayKey(), seed = +k;
    let lv = eng("generateLevel", seed, { difficulty: 3 });
    if (!lv) { toastGame("The Daily Sky needs the game engine", "bad"); return; }
    lv = Object.assign({}, lv, { id: "daily-" + k, name: lv.name || "Daily Sky" });
    const w = skyWorld(seed);
    cur = { mode: "daily", w, level: lv, key: k };
    startCur();
  }

  const DIFF = ["Breeze", "Easy", "Steady", "Tricky", "Wild"];
  const skyWorld = (seed) => (WORLDS_BY_ID.length ? WORLDS_BY_ID[seed % WORLDS_BY_ID.length] : null);
  function renderZen(p) {
    const gen = hasEng("generateLevel");
    if (S.zen.seed == null) S.zen.seed = randSeed();
    p.innerHTML = `<div class="ph"><div><h2>Zen Garden</h2><p>Endless seeds, no par, no stars. Pick how wild the sky should be, or type a seed to share a sky with a friend.</p></div></div>
      <div class="split">
        <div class="sheet">
          <div class="field"><label for="zenDiff">Sky <output id="zenDiffOut">${DIFF[S.zen.diff - 1]}</output></label>
            <input type="range" id="zenDiff" min="1" max="5" step="1" value="${S.zen.diff}" style="--v:${(S.zen.diff - 1) * 25}%">
            <div class="ticks" aria-hidden="true">${DIFF.map((d) => `<span>${d}</span>`).join("")}</div></div>
          <div class="field"><label for="zenSeed">Seed</label><input class="text-in" id="zenSeed" inputmode="numeric" autocomplete="off" value="${S.zen.seed}"></div>
          <div class="row">
            <button class="btn primary" type="button" data-a="sow" ${gen ? "" : "disabled"}>${ic("play")}Sow this sky</button>
            <button class="btn" type="button" data-a="new" ${gen ? "" : "disabled"}>${ic("sky")}New sky</button>
          </div>
          ${gen ? "" : `<p class="muted">The sky generator isn't loaded, so Zen skies can't start.</p>`}
        </div>
        <div class="sheet">
          <div class="streak"><span class="num">${S.stats.zen}</span><div><b>Skies sown</b><div class="muted">in the Zen Garden</div></div></div>
          <div class="zen-pay" id="zenPay">${zenPayHtml(S.zen.diff)}</div>
          <p class="muted">Seeds never run out here. Press <kbd class="k">R</kbd> to clear the sky and start again, or <kbd class="k">Esc</kbd> to step away.</p>
        </div>
      </div>`;
    const rng = $("#zenDiff", p), seedIn = $("#zenSeed", p);
    rng.addEventListener("input", () => {
      S.zen.diff = +rng.value;
      rng.style.setProperty("--v", (S.zen.diff - 1) * 25 + "%");
      $("#zenDiffOut", p).textContent = DIFF[S.zen.diff - 1];
      $("#zenPay", p).innerHTML = zenPayHtml(S.zen.diff);
      sfx("tick");
      save();
    });
    seedIn.addEventListener("change", () => { const v = parseInt(seedIn.value.replace(/\D/g, ""), 10); S.zen.seed = isFinite(v) ? v : randSeed(); seedIn.value = S.zen.seed; save(); });
    p.addEventListener("click", (e) => {
      if (e.target.closest("[data-a=sow]")) { const v = parseInt(seedIn.value.replace(/\D/g, ""), 10); S.zen.seed = isFinite(v) ? v : randSeed(); startZen(); }
      if (e.target.closest("[data-a=new]")) { S.zen.seed = randSeed(); seedIn.value = S.zen.seed; startZen(); }
    });
  }
  const randSeed = () => 1000 + Math.floor(Math.random() * 899000);
  function zenPayHtml(diff) {
    const left = zenLeft(), pay = ZEN_PAY[clamp(diff || 3, 1, 5) - 1];
    return `<div class="zp-top"><b>Zen nectar today</b><span class="drops" role="img" aria-label="${left} of ${ZEN_CAP} left">${Array.from({ length: ZEN_CAP }, (_, i) => `<i class="${i < left ? "on" : ""}">${ic("nectar")}</i>`).join("")}</span></div>
      <span class="muted">${left ? `${left} of ${ZEN_CAP} rewarded skies left. ${DIFF[clamp(diff || 3, 1, 5) - 1]} skies pay ${nectarAmt(pay)}.` : `All ${ZEN_CAP} collected. The Zen Garden pays again tomorrow.`}</span>`;
  }
  function startZen() {
    save();
    const seed = S.zen.seed, diff = S.zen.diff;
    let lv = eng("generateLevel", seed, { difficulty: diff });
    if (!lv) { toastGame("Zen skies need the game engine", "bad"); return; }
    lv = Object.assign({}, lv, { id: lv.id || "zen-" + seed, name: lv.name || "Zen sky" });
    const w = skyWorld(seed);
    cur = { mode: "zen", w, level: lv, seed, diff };
    startCur();
  }
  function startChallenge(o) {
    let lv = eng("generateLevel", o.seed, { difficulty: o.diff });
    if (!lv) { note("Challenge skies need the game engine", "bad"); return false; }
    lv = Object.assign({}, lv, { id: "chal-" + o.seed + "-" + o.diff, name: lv.name || "Challenge sky" });
    cur = { mode: "challenge", w: skyWorld(o.seed), level: lv, seed: o.seed, diff: o.diff, chal: o };
    startCur();
    return true;
  }
  function onChallengeDone(p) {
    if (!cur || cur.finished) return;
    cur.finished = true;
    closeCoach();
    const used = p.used != null ? p.used : hudState.used || 0, at = p.starAt || starAt(cur.level);
    const r = { used, stars: clamp(p.stars || computeStars(used, at), 1, 3), pollen: p.pollenGot || 0, pt: p.pollenTotal || 0, time: p.time || 0, assist: !!(cur.assisted || S.settings.assist) };
    sfx("win", { stars: r.stars });
    if (cur.chal.onDone) cur.chal.onDone(r);
  }
  function renderFriends(el) {
    if (window.OrchardFriends) window.OrchardFriends.render(el);
    else el.innerHTML = `<div class="ph"><div><h2>Friends</h2><p>Friends couldn't load in this view. The rest of the game works as usual.</p></div></div>`;
  }

  function readPal() {
    const cs = getComputedStyle(root), g = (n) => cs.getPropertyValue(n).trim();
    return {
      soil: g("--c-soil"), soilD: g("--c-soil-d"), rock: g("--c-rock"), rockD: g("--c-rock-d"), sun: g("--c-sun"), sunCore: g("--c-sun-core"),
      ice: g("--c-ice"), iceD: g("--c-ice-d"), portal: g("--c-portal"), hole: g("--c-hole"), rep: g("--c-rep"), pollen: g("--c-pollen"),
      seed: g("--c-seed"), line: g("--c-line"), text: g("--text"), dim: g("--dim"), bg: g("--bg-2"), ink2: g("--ink2"), gold: g("--gold"),
      pot: g("--c-pot"), potD: g("--c-pot-d"), shelf: g("--c-shelf"), hard: g("--hard"), mono: root.dataset.skin === "inkwell"
    };
  }
  const TAU = Math.PI * 2;
  function circ(c, x, y, r) { c.beginPath(); c.arc(x, y, Math.max(0, r), 0, TAU); }
  function body(c, P, x, y, r, col, dark) {
    c.fillStyle = dark; circ(c, x + r * 0.1, y + r * 0.1, r); c.fill();
    c.fillStyle = col; circ(c, x, y, r); c.fill();
    c.fillStyle = "rgba(255,255,255,.28)"; circ(c, x - r * 0.35, y - r * 0.38, r * 0.26); c.fill();
    if (P.mono) { c.strokeStyle = "#fff"; c.lineWidth = 1.5; circ(c, x, y, r); c.stroke(); }
  }
  function seedAt(c, P, x, y, a) {
    c.save(); c.translate(x, y); c.rotate(a || 0);
    c.fillStyle = P.seed; c.beginPath(); c.ellipse(0, 0, 6, 4, 0, 0, TAU); c.fill();
    c.restore();
  }
  function trail(c, P, pts) {
    c.save(); c.setLineDash([2, 6]); c.strokeStyle = P.line; c.lineWidth = 1.6; c.lineCap = "round";
    c.beginPath(); pts.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); c.stroke(); c.restore();
  }
  const bez = (a, b, cc, t) => [(1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * cc[0] + t * t * b[0], (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * cc[1] + t * t * b[1]];
  function sprout(c, P, x, y, ang, g) {
    if (g <= 0) return;
    c.save(); c.translate(x, y); c.rotate(ang + Math.PI / 2);
    c.strokeStyle = P.mono ? "#fff" : P.soilD; c.lineWidth = 2.2; c.lineCap = "round";
    c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -16 * g); c.stroke();
    c.fillStyle = P.soil;
    c.beginPath(); c.ellipse(-4 * g, -10 * g, 4 * g, 2 * g, -0.6, 0, TAU); c.fill();
    c.beginPath(); c.ellipse(4 * g, -13 * g, 4 * g, 2 * g, 0.6, 0, TAU); c.fill();
    c.fillStyle = P.mono ? "#fff" : P.ink2; circ(c, 0, -17 * g, 3.4 * g); c.fill();
    c.restore();
  }
  const DRAW = {
    fertile(c, P, t) {
      const x = 200, y = 105, r = 40, ph = (t % 3.2) / 3.2;
      c.save(); c.setLineDash([4, 5]); c.strokeStyle = P.soil; c.globalAlpha = 0.5 + 0.3 * Math.sin(t * 3); c.lineWidth = 2; circ(c, x, y, r + 11); c.stroke(); c.restore();
      body(c, P, x, y, r, P.soil, P.soilD);
      const a = [40, 160], cc = [90, 30], hitA = Math.PI * 1.1, b = [x + Math.cos(hitA) * r, y + Math.sin(hitA) * r];
      if (ph < 0.5) { const k = ph / 0.5; const pts = []; for (let i = 0; i <= 20; i++) pts.push(bez(a, b, cc, (i / 20) * k)); trail(c, P, pts); const q = bez(a, b, cc, k); seedAt(c, P, q[0], q[1], 0.4); }
      else sprout(c, P, b[0], b[1], hitA, clamp((ph - 0.5) / 0.3, 0, 1));
    },
    hungry(c, P, t) {
      const x = 170, y = 100, r = 44, n = Math.floor((t % 4.8) / 1.2);
      body(c, P, x, y, r, P.soil, P.soilD);
      for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + (i * TAU) / 3, px = x + Math.cos(a) * (r + 14), py = y + Math.sin(a) * (r + 14);
        c.fillStyle = i < n ? (P.mono ? "#fff" : P.ink2) : P.bg; circ(c, px, py, 5.5); c.fill();
        c.strokeStyle = P.mono ? "#fff" : P.ink2; c.lineWidth = 1.6; circ(c, px, py, 5.5); c.stroke();
        if (i < n) sprout(c, P, x + Math.cos(a + 0.5) * r, y + Math.sin(a + 0.5) * r, a + 0.5, 0.8);
      }
    },
    barren(c, P, t) {
      const x = 165, y = 115, r = 46;
      body(c, P, x, y, r, P.rock, P.rockD);
      c.fillStyle = P.rockD; circ(c, x - 12, y - 6, 8); c.fill(); circ(c, x + 16, y + 14, 5); c.fill(); circ(c, x + 10, y - 22, 3.5); c.fill();
      const a = [10, 30], b = [310, 40], cc = [165, 170], k = (t % 3) / 3;
      const pts = []; for (let i = 0; i <= 30; i++) pts.push(bez(a, b, cc, i / 30)); trail(c, P, pts);
      const q = bez(a, b, cc, k); seedAt(c, P, q[0], q[1]);
    },
    sun(c, P, t) {
      const x = 170, y = 100, r = 34;
      const g = c.createRadialGradient(x, y, r * 0.5, x, y, r * 2.6);
      g.addColorStop(0, P.sun); g.addColorStop(1, "rgba(0,0,0,0)");
      c.globalAlpha = 0.45; c.fillStyle = g; circ(c, x, y, r * 2.6); c.fill(); c.globalAlpha = 1;
      c.save(); c.translate(x, y); c.rotate(t * 0.4); c.strokeStyle = P.sun; c.lineWidth = 2.5; c.lineCap = "round";
      for (let i = 0; i < 12; i++) { c.rotate(TAU / 12); const l = 8 + 4 * Math.sin(t * 4 + i); c.beginPath(); c.moveTo(r + 6, 0); c.lineTo(r + 6 + l, 0); c.stroke(); }
      c.restore();
      body(c, P, x, y, r, P.sun, P.mono ? "#6b6b6b" : "rgba(176,86,62,.9)");
      c.fillStyle = P.sunCore; circ(c, x - 6, y - 6, r * 0.45); c.fill();
      const ph = (t % 3.4) / 3.4;
      if (ph < 0.8) { const k = ph / 0.8, ang = -2.4 + k * 5.2, rr = 120 - k * (120 - r); seedAt(c, P, x + Math.cos(ang) * rr, y + Math.sin(ang) * rr, ang + 1.6); }
      else { const f = (ph - 0.8) / 0.2; c.globalAlpha = 1 - f; c.fillStyle = P.sunCore; circ(c, x + Math.cos(2.8) * r, y + Math.sin(2.8) * r, 6 + f * 18); c.fill(); c.globalAlpha = 1; }
    },
    ice(c, P, t) {
      const x = 180, y = 128, r = 42;
      body(c, P, x, y, r, P.ice, P.iceD);
      c.strokeStyle = "rgba(255,255,255,.7)"; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x - 20, y - 8); c.lineTo(x - 4, y - 24); c.moveTo(x + 6, y + 10); c.lineTo(x + 20, y - 4); c.stroke();
      const a = [30, 40], hit = [x - r * 0.72, y - r * 0.72], out = [300, 20], k = (t % 2.6) / 2.6;
      trail(c, P, [a, hit, out]);
      const q = k < 0.5 ? [a[0] + (hit[0] - a[0]) * k * 2, a[1] + (hit[1] - a[1]) * k * 2] : [hit[0] + (out[0] - hit[0]) * (k - 0.5) * 2, hit[1] + (out[1] - hit[1]) * (k - 0.5) * 2];
      seedAt(c, P, q[0], q[1]);
      if (Math.abs(k - 0.5) < 0.06) { c.strokeStyle = P.ice; c.lineWidth = 2; circ(c, hit[0], hit[1], 10 + (k - 0.44) * 120); c.stroke(); }
    },
    shield(c, P, t) {
      const x = 170, y = 100, r = 34, R = 56, gc = t * 0.8, gap = 1.1;
      body(c, P, x, y, r, P.soil, P.soilD);
      c.strokeStyle = P.portal; c.lineWidth = 5; c.lineCap = "round";
      c.beginPath(); c.arc(x, y, R, gc + gap / 2, gc + TAU - gap / 2); c.stroke();
      c.globalAlpha = 0.35; c.lineWidth = 1.5; c.setLineDash([2, 5]); c.beginPath(); c.arc(x, y, R, gc - gap / 2, gc + gap / 2); c.stroke(); c.setLineDash([]); c.globalAlpha = 1;
    },
    portal(c, P, t) {
      const A = [85, 100], B = [235, 100];
      [A, B].forEach((p, i) => {
        c.save(); c.translate(p[0], p[1]); c.rotate(t * (i ? -1.2 : 1.2));
        for (let j = 0; j < 3; j++) { c.strokeStyle = P.portal; c.globalAlpha = 1 - j * 0.28; c.lineWidth = 3 - j * 0.6; c.setLineDash([10 - j * 2, 5]); circ(c, 0, 0, 22 + j * 7); c.stroke(); }
        c.restore();
      });
      c.setLineDash([]); c.globalAlpha = 1;
      const k = (t % 2.4) / 2.4;
      if (k < 0.45) seedAt(c, P, 0 + (A[0]) * (k / 0.45), 60 + 40 * (k / 0.45), 0.4);
      else if (k > 0.5) { const f = (k - 0.5) / 0.5; seedAt(c, P, B[0] + 90 * f, B[1] + 40 * f, 0.4); }
      else { c.fillStyle = P.portal; c.globalAlpha = 0.6; circ(c, A[0], A[1], 8); c.fill(); circ(c, B[0], B[1], 8); c.fill(); c.globalAlpha = 1; }
    },
    wind(c, P, t) {
      c.fillStyle = P.line; c.globalAlpha = 0.12; c.fillRect(120, 0, 90, 200); c.globalAlpha = 1;
      c.strokeStyle = P.line; c.lineWidth = 1.5;
      for (let i = 0; i < 9; i++) { const xx = 128 + (i % 5) * 18, yy = ((t * 70 + i * 47) % 240) - 20; c.beginPath(); c.moveTo(xx, yy); c.lineTo(xx, yy + 16); c.stroke(); }
      const pts = [];
      for (let i = 0; i <= 40; i++) { const x = 20 + i * 7; const inW = clamp((x - 120) / 90, 0, 1); pts.push([x, 60 + 70 * inW * inW + (x > 210 ? (x - 210) * 0.9 : 0)]); }
      trail(c, P, pts);
      const q = pts[Math.floor(((t % 2.4) / 2.4) * 40)]; seedAt(c, P, q[0], q[1], 0.5);
    },
    boost(c, P, t) {
      const x = 160, y = 100;
      c.strokeStyle = P.gold; c.lineWidth = 4; c.lineCap = "round"; c.lineJoin = "round";
      for (let i = 0; i < 2; i++) { const o = i * 14 - 7 + Math.sin(t * 6) * 2; c.beginPath(); c.moveTo(x + o - 10, y - 18); c.lineTo(x + o + 4, y); c.lineTo(x + o - 10, y + 18); c.stroke(); }
      c.globalAlpha = 0.35; circ(c, x, y, 28); c.stroke(); c.globalAlpha = 1;
      const k = (t % 2) / 2, sx = k < 0.5 ? 20 + k * 2 * 140 : 160 + (k - 0.5) * 2 * 320;
      const len = k < 0.5 ? 16 : 44;
      c.strokeStyle = P.seed; c.lineWidth = 3; c.globalAlpha = 0.5; c.beginPath(); c.moveTo(sx - len, y); c.lineTo(sx, y); c.stroke(); c.globalAlpha = 1;
      seedAt(c, P, sx, y);
    },
    pollen(c, P, t) {
      for (let i = 0; i < 3; i++) {
        const x = 90 + i * 70, y = 100 + Math.sin(t * 1.6 + i * 2) * 14;
        const g = c.createRadialGradient(x, y, 0, x, y, 30);
        g.addColorStop(0, P.pollen); g.addColorStop(1, "rgba(0,0,0,0)");
        c.globalAlpha = 0.45; c.fillStyle = g; circ(c, x, y, 30); c.fill(); c.globalAlpha = 1;
        c.fillStyle = P.pollen; circ(c, x, y, 6 + Math.sin(t * 3 + i) * 1.2); c.fill();
        for (let j = 0; j < 3; j++) { const a = t * 1.5 + j * 2.1 + i; c.globalAlpha = 0.7; circ(c, x + Math.cos(a) * 14, y + Math.sin(a) * 14, 1.6); c.fill(); }
        c.globalAlpha = 1;
      }
    },
    orbit(c, P, t) {
      const x = 160, y = 100;
      c.save(); c.setLineDash([2, 6]); c.strokeStyle = P.line; c.lineWidth = 1.4; circ(c, x, y, 70); c.stroke(); c.restore();
      body(c, P, x, y, 28, P.rock, P.rockD);
      const mx = x + Math.cos(t * 0.9) * 70, my = y + Math.sin(t * 0.9) * 70;
      body(c, P, mx, my, 12, P.soil, P.soilD);
      c.fillStyle = P.text; circ(c, mx + Math.cos(t * 3) * 20, my + Math.sin(t * 3) * 20, 3); c.fill();
    },
    blackhole(c, P, t) {
      const x = 165, y = 100;
      for (let i = 0; i < 26; i++) {
        const s = ((t * 0.25 + i / 26) % 1), a = i * 2.4 + t * (1 + s * 2), rr = 90 * (1 - s);
        c.globalAlpha = s; c.fillStyle = i % 2 ? P.sun : P.portal; circ(c, x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.45, 1.8); c.fill();
      }
      c.globalAlpha = 1;
      c.save(); c.translate(x, y); c.scale(1, 0.38); c.rotate(t * 0.6);
      c.strokeStyle = P.sun; c.lineWidth = 5; c.setLineDash([22, 10]); circ(c, 0, 0, 44); c.stroke(); c.restore();
      c.fillStyle = P.hole; circ(c, x, y, 18); c.fill();
      c.strokeStyle = P.mono ? "#fff" : P.portal; c.lineWidth = 2; circ(c, x, y, 19); c.stroke();
    },
    repulsor(c, P, t) {
      const x = 170, y = 110;
      for (let i = 0; i < 3; i++) { const f = ((t * 0.7 + i / 3) % 1); c.strokeStyle = P.rep; c.globalAlpha = 1 - f; c.lineWidth = 2; circ(c, x, y, 18 + f * 60); c.stroke(); }
      c.globalAlpha = 1;
      body(c, P, x, y, 16, P.rep, P.mono ? "#555" : "rgba(120,20,60,.8)");
      const pts = []; for (let i = 0; i <= 40; i++) { const xx = 10 + i * 7.5, d = Math.abs(xx - x); pts.push([xx, 90 - 1600 / (d + 30)]); }
      trail(c, P, pts);
      const q = pts[Math.floor(((t % 2.4) / 2.4) * 40)]; seedAt(c, P, q[0], q[1]);
    }
  };
  function fitCanvas(cv) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(cv.clientWidth * dpr)), h = Math.max(1, Math.round(cv.clientHeight * dpr));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    return dpr;
  }
  function renderAlmanac(p) {
    const open = ALMANAC.filter((a) => almanacOpen(a.k)).length;
    p.innerHTML = `<div class="ph"><div><h2>Almanac</h2><p>A field guide to everything in the sky. Pages fill in as you meet new things or open new worlds.</p></div><span class="chip">${ic("book")}<b>${open}</b>/${ALMANAC.length} pages</span></div>
      <div class="specimens">${ALMANAC.map((a) => {
        const on = almanacOpen(a.k), wi = firstWorldOf(a.k), w = WORLDS[wi];
        return `<article class="spec${on ? "" : " locked"}"><canvas data-k="${a.k}" data-on="${on ? 1 : 0}" aria-hidden="true"></canvas>
          <h3>${ic(a.k)}${on ? esc(a.name) : "Undiscovered"}</h3>
          <p>${on ? esc(a.text) : "Something new waits further along the journey."}</p>
          <p class="seen">First seen in World ${wi + 1}${w ? ", " + esc(w.name) : ""}</p></article>`;
      }).join("")}</div>`;
    const cvs = $$("canvas", p);
    let P = readPal(), raf = 0, t0 = performance.now();
    const frame = (now) => {
      const t = (now - t0) / 1000;
      cvs.forEach((cv) => {
        fitCanvas(cv);
        const c = cv.getContext("2d"), s = cv.width / 320;
        c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height);
        c.setTransform(s, 0, 0, s, 0, 0);
        if (cv.dataset.on === "1") DRAW[cv.dataset.k](c, P, reduced() ? 1.4 : t);
        else {
          c.save(); c.setLineDash([4, 6]); c.strokeStyle = P.line; c.lineWidth = 2; circ(c, 160, 100, 40); c.stroke(); c.restore();
          c.fillStyle = P.dim; c.font = "800 34px Unbounded, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("?", 160, 102);
        }
      });
      if (!reduced()) raf = requestAnimationFrame(frame);
    };
    frame(performance.now());
    panelStop.push(() => cancelAnimationFrame(raf));
  }

  function mulberry(a) {
    return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const PCOL = {
    daisy: ["#ff79b0", "#ffffff", "#f3d67a"], fern: ["#7ef0d8", "#bfe6f0", "#d8fff6"], spiral: ["#c77dff", "#f0c6ff", "#a99be6"],
    sunflower: ["#f3d67a", "#ffe7b0", "#6b3f22"], ember: ["#ff7a45", "#ffd0a8", "#ffe29a"], orchid: ["#f3d67a", "#fff1c2", "#e8a900"],
    bonsai: ["#ffb3c7", "#ffffff", "#7a5236"], ivy: ["#7cc4ff", "#e4f3ff", "#3f7fbf"], lotus: ["#ffc2d9", "#fff4f8", "#f3d67a"]
  };
  const GLAZE = {
    daisy: ["#ff9ec4", "#b8507c", "#ffffff"], fern: ["#86cfdc", "#3f7f93", "#e8fbff"], spiral: ["#8a5cc7", "#4f2f7d", "#f0c6ff"],
    sunflower: ["#e0b54a", "#8f6a1c", "#fff3c9"], ember: ["#4a2129", "#1c0d12", "#ff7a45"], orchid: ["#f3d67a", "#a87d17", "#fffbe8"],
    bonsai: ["#5f8f6e", "#335a41", "#e7f3e9"], ivy: ["#4d7fc4", "#294c82", "#e4f3ff"], lotus: ["#f4eee4", "#b3a690", "#f29e7a"]
  };
  const plantVars = (kind) => { const c = PCOL[kind] || PCOL.daisy, g = GLAZE[kind] || GLAZE.daisy; return `--pa:${c[0]};--pb:${c[1]};--pc:${c[2]};--ga:${g[0]};--gb:${g[1]};--gm:${g[2]}`; };
  const PH = [0, 14, 34, 52, 66, 76];
  const r1 = (n) => Math.round(n * 10) / 10;
  const qpt = (a, c, b, t) => [r1((1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0]), r1((1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1])];
  const leafSvg = (x, y, ang, len, w, cls) => `<path class="${cls || "lf"}" d="M0 0Q${r1(len / 2)} ${r1(-w)} ${r1(len)} 0Q${r1(len / 2)} ${r1(w)} 0 0z" transform="translate(${r1(x)} ${r1(y)}) rotate(${r1(ang)})"/>`;
  const stemSvg = (a, c, b, w) => `<path class="st" d="M${a[0]} ${a[1]}Q${r1(c[0])} ${r1(c[1])} ${r1(b[0])} ${r1(b[1])}" stroke-width="${w || 2.4}"/>`;
  const dot = (x, y, r, cls) => `<circle class="${cls}" cx="${r1(x)}" cy="${r1(y)}" r="${r1(r)}"/>`;
  function petals(x, y, n, rx, ry, d, cls, rot) {
    let s = "";
    for (let i = 0; i < n; i++) s += `<ellipse class="${cls}" cx="${r1(x)}" cy="${r1(y - d)}" rx="${r1(rx)}" ry="${r1(ry)}" transform="rotate(${r1((360 / n) * i + (rot || 0))} ${r1(x)} ${r1(y)})"/>`;
    return s;
  }
  function heart(x, y, s, ang) {
    return `<path class="lf" d="M0 0C${r1(-3 * s)} ${r1(-3.4 * s)} ${r1(-6.4 * s)} 0 0 ${r1(5.4 * s)}C${r1(6.4 * s)} 0 ${r1(3 * s)} ${r1(-3.4 * s)} 0 0z" transform="translate(${r1(x)} ${r1(y)}) rotate(${r1(ang)})"/>`;
  }
  function headSvg(kind, x, y, s, open) {
    if (!open) return `<g class="hd"><ellipse class="pa" cx="${r1(x)}" cy="${r1(y)}" rx="${r1(3 * s)}" ry="${r1(4.6 * s)}"/>${leafSvg(x, y + 4 * s, -125, 6 * s, 2.2 * s)}${leafSvg(x, y + 4 * s, -55, 6 * s, 2.2 * s)}</g>`;
    let h = "";
    if (kind === "daisy") h = petals(x, y, 8, 2.6 * s, 5.6 * s, 5.6 * s, "pb", 22.5) + petals(x, y, 8, 2.4 * s, 5.2 * s, 5.4 * s, "pa") + dot(x, y, 3.4 * s, "pc");
    else if (kind === "sunflower") {
      h = petals(x, y, 16, 2.6 * s, 7 * s, 10 * s, "pb", 11) + petals(x, y, 16, 2.6 * s, 7 * s, 9.5 * s, "pa") + dot(x, y, 7.5 * s, "pc");
      for (let i = 0; i < 9; i++) { const a = i * 2.4, rr = Math.sqrt(i) * 2.1 * s; h += dot(x + Math.cos(a) * rr, y + Math.sin(a) * rr, 0.9 * s, "dk"); }
    } else if (kind === "ember") {
      const fl = (dx, ht, w, cls) => { const X = x + dx, B = y + 3 * s; return `<path class="${cls}" d="M${r1(X)} ${r1(B)}C${r1(X - w)} ${r1(y - ht * 0.3)} ${r1(X - w * 0.3)} ${r1(y - ht * 0.7)} ${r1(X)} ${r1(y - ht)}C${r1(X + w * 0.3)} ${r1(y - ht * 0.7)} ${r1(X + w)} ${r1(y - ht * 0.3)} ${r1(X)} ${r1(B)}z"/>`; };
      h = `<g class="flk">${fl(-5 * s, 13 * s, 5 * s, "pa")}${fl(5 * s, 12 * s, 5 * s, "pa")}${fl(0, 18 * s, 7 * s, "pa")}${fl(0, 12 * s, 4.5 * s, "pb")}${fl(0, 7 * s, 2.6 * s, "pc")}</g>`;
    } else if (kind === "orchid") h = petals(x, y, 5, 3.4 * s, 6 * s, 5 * s, "pa") + `<ellipse class="pb" cx="${r1(x)}" cy="${r1(y + 4 * s)}" rx="${r1(3.6 * s)}" ry="${r1(3 * s)}"/>` + dot(x, y, 1.8 * s, "pc");
    else if (kind === "spiral") {
      let d = "";
      for (let i = 0; i <= 40; i++) { const th = i * 0.32, rr = 9 * s * (1 - i / 44); d += (i ? "L" : "M") + r1(x + Math.cos(th) * rr) + " " + r1(y + Math.sin(th) * rr); }
      h = `<path class="sp" d="${d}"/>` + dot(x, y, 1.8 * s, "pb");
    } else if (kind === "lotus") {
      [-165, -135, -105, -75, -45, -15].forEach((a) => { h += leafSvg(x, y, a, 13 * s, 4.6 * s, "pa"); });
      [-125, -90, -55].forEach((a) => { h += leafSvg(x, y, a, 10 * s, 3.6 * s, "pb"); });
      h += dot(x, y - 2 * s, 2.6 * s, "pc");
    } else if (kind === "ivy") h = petals(x, y, 5, 1.8 * s, 3.4 * s, 3.4 * s, "pa") + dot(x, y, 1.6 * s, "pc");
    else if (kind === "bonsai") h = petals(x, y, 5, 1.7 * s, 2.6 * s, 2.6 * s, "pa") + dot(x, y, 1.2 * s, "pb");
    return `<g class="hd">${h}</g>`;
  }
  const STEMS = {
    daisy: [[[2, 1, 4]], [[-12, 0.86, -6], [12, 1, 5]], [[-12, 0.86, -6], [12, 1, 5]], [[-18, 0.8, -8], [2, 1, 2], [20, 0.88, 8]]],
    ember: [[[0, 0.8, 0]], [[-9, 0.82, -4], [9, 0.88, 4]], [[-9, 0.82, -4], [9, 0.88, 4]], [[-16, 0.74, -6], [0, 0.96, 0], [16, 0.8, 6]]],
    sunflower: [[[2, 1.05, 3]], [[2, 1.05, 3]], [[2, 1.05, 3]], [[-10, 1.08, -4], [16, 0.82, 6]]],
    orchid: [[[14, 0.9, -16]], [[16, 0.95, -18]], [[16, 0.95, -18]], [[18, 0.98, -18], [-16, 0.8, 14]]]
  };
  STEMS.spiral = STEMS.daisy;
  const HEAD_S = { daisy: 0.95, spiral: 0.95, ember: 0.9, sunflower: 1, orchid: 0.85 };
  function plantBody(kind, st) {
    const B = [60, 106];
    if (st <= 0) return `<ellipse class="seedmark" cx="60" cy="99" rx="5.5" ry="3.6" transform="rotate(-30 60 99)"/>`;
    if (st === 1) return stemSvg(B, [61, 99], [60, 91], 2.2) + leafSvg(60, 92, -160, 9, 4) + leafSvg(60, 92, -20, 9, 4);
    const H = PH[st];
    let s = "";
    if (STEMS[kind]) {
      const big = kind === "sunflower";
      STEMS[kind][st - 2].forEach((m, i) => {
        const top = [60 + m[0], B[1] - H * m[1]], ctl = [60 + m[0] / 2 + m[2], B[1] - H * m[1] * 0.5];
        s += stemSvg(B, ctl, top, big ? 3.2 : 2.4);
        const l1 = qpt(B, ctl, top, 0.42), l2 = qpt(B, ctl, top, big ? 0.66 : 0.58);
        s += leafSvg(l1[0], l1[1], -158, big ? 15 : 10, big ? 5 : 3.6) + leafSvg(l2[0], l2[1], -24, big ? 14 : 9, big ? 5 : 3.4);
        const sz = HEAD_S[kind] * (st === 5 ? 1.06 : 1) * (i === 1 && big ? 0.8 : 1);
        if (kind === "orchid" && st >= 3) [0.72, 0.86].forEach((t, k) => { const q = qpt(B, ctl, top, t); s += headSvg(kind, q[0], q[1] + 3, sz * (0.7 + k * 0.1), st >= 4); });
        if (st >= 3) s += headSvg(kind, top[0], top[1], sz, st >= 4);
      });
      return s;
    }
    if (kind === "fern") {
      const n = [0, 0, 2, 3, 4, 5][st], len = H * 1.05;
      for (let f = 0; f < n; f++) {
        const sp = (f / (n - 1) - 0.5) * 2, tip = [60 + sp * 30, B[1] - len * (1 - Math.abs(sp) * 0.25)], ctl = [60 + sp * 4, B[1] - len * 0.62];
        s += stemSvg(B, ctl, tip, 2);
        for (let i = 1; i <= 9; i++) {
          const t = i / 10, p = qpt(B, ctl, tip, t), p2 = qpt(B, ctl, tip, t + 0.02);
          const ang = (Math.atan2(p2[1] - p[1], p2[0] - p[0]) * 180) / Math.PI, ll = (1 - t) * 10 + 2.5;
          s += leafSvg(p[0], p[1], ang - 62, ll, 2.2, i % 2 ? "pa" : "pb") + leafSvg(p[0], p[1], ang + 62, ll, 2.2, i % 2 ? "pb" : "pa");
        }
        if (st === 3) s += `<g class="hd"><circle class="sp" cx="${r1(tip[0])}" cy="${r1(tip[1] - 2)}" r="3"/></g>`;
        else s += `<g class="hd">${dot(tip[0], tip[1], 1.8, "pc")}</g>`;
      }
      return s;
    }
    if (kind === "bonsai") {
      const h = [0, 0, 26, 40, 50, 56][st], T = B[1] - h;
      s += `<path class="tr" d="M58 106C52 ${r1(B[1] - h * 0.4)} 70 ${r1(B[1] - h * 0.62)} 60 ${r1(T)}" stroke-width="${3 + st}"/>`;
      if (st >= 3) s += `<path class="tr" d="M61 ${r1(B[1] - h * 0.55)}Q70 ${r1(B[1] - h * 0.7)} 79 ${r1(B[1] - h * 0.7)}" stroke-width="3"/>`;
      if (st >= 4) s += `<path class="tr" d="M60 ${r1(B[1] - h * 0.78)}Q52 ${r1(B[1] - h * 0.88)} 45 ${r1(B[1] - h * 0.86)}" stroke-width="2.6"/>`;
      const blobs = [[60, T - 2, 12]];
      if (st >= 3) blobs.push([80, B[1] - h * 0.7 - 5, 9]);
      if (st >= 4) blobs.push([45, B[1] - h * 0.86 - 5, 9.5]);
      if (st >= 5) blobs.push([68, T - 12, 9]);
      blobs.forEach((b) => { s += dot(b[0], b[1], b[2], "cn") + dot(b[0] - b[2] * 0.5, b[1] + b[2] * 0.3, b[2] * 0.7, "cn") + dot(b[0] + b[2] * 0.55, b[1] + b[2] * 0.25, b[2] * 0.65, "cn"); });
      if (st >= 4) blobs.forEach((b, i) => { s += headSvg(kind, b[0] - 3 + (i % 2) * 6, b[1] - 2, 1, true); if (st >= 5) s += headSvg(kind, b[0] + 5, b[1] + 4, 0.85, true); });
      else if (st === 3) blobs.forEach((b) => { s += `<g class="hd">${dot(b[0] + 2, b[1] - 3, 1.6, "pa")}</g>`; });
      return s;
    }
    if (kind === "ivy") {
      const h = H * 1.05, top = B[1] - h;
      s += `<path class="stake" d="M60 108V${r1(top - 6)}"/>`;
      let d = "";
      for (let i = 0; i <= 24; i++) { const t = i / 24; d += (i ? "L" : "M") + r1(60 + Math.sin(t * Math.PI * 3.2) * 7) + " " + r1(B[1] - h * t); }
      s += `<path class="st" d="${d}" stroke-width="2"/>`;
      const nl = Math.round(h / 9);
      for (let i = 1; i <= nl; i++) { const t = i / (nl + 0.5), x = 60 + Math.sin(t * Math.PI * 3.2) * 7, side = i % 2 ? 1 : -1; s += heart(x + side * 4, B[1] - h * t, 1.05, side * 70 + 180); }
      if (st >= 3) [0.5, 0.78, 1].slice(0, st === 5 ? 3 : 2).forEach((t) => { const x = 60 + Math.sin(t * Math.PI * 3.2) * 7; s += headSvg(kind, x + 5, B[1] - h * t - 3, 1.1, st >= 4); });
      return s;
    }
    if (kind === "lotus") {
      s += `<ellipse class="lf" cx="47" cy="104" rx="13" ry="3.4"/>`;
      if (st >= 3) s += `<ellipse class="lf" cx="75" cy="105" rx="10" ry="2.8"/>`;
      if (st === 2) return s + stemSvg(B, [58, 96], [62, 84], 2.2) + leafSvg(62, 86, -100, 12, 4);
      const top = [60, B[1] - [0, 0, 0, 30, 38, 42][st]];
      s += stemSvg(B, [57, B[1] - 15], top, 2.4);
      if (st >= 5) s += stemSvg(B, [50, 96], [42, 82], 2) + headSvg(kind, 42, 82, 0.7, true);
      s += headSvg(kind, top[0], top[1], st >= 5 ? 1.15 : 1, st >= 4);
      return s;
    }
    return s;
  }
  /** SVG markup for a greenhouse plant at a growth stage, potted or planted in a mound. */
  function plantSvg(kind, st, o) {
    o = o || {};
    const H = PH[st] || 0, cy = 106 - H * 0.72;
    const halo = st >= 5 ? `<circle class="halo" cx="60" cy="${r1(cy)}" r="34"/>` : "";
    const spk = st >= 5 ? [[30, cy - 20, 0], [92, cy - 8, 0.8], [40, cy + 22, 1.6], [86, cy + 26, 2.2]].map((p) => `<path class="spk" style="animation-delay:-${p[2]}s" d="M${r1(p[0])} ${r1(p[1] - 4)}L${r1(p[0] + 1.2)} ${r1(p[1] - 1.2)}L${r1(p[0] + 4)} ${r1(p[1])}L${r1(p[0] + 1.2)} ${r1(p[1] + 1.2)}L${r1(p[0])} ${r1(p[1] + 4)}L${r1(p[0] - 1.2)} ${r1(p[1] + 1.2)}L${r1(p[0] - 4)} ${r1(p[1])}L${r1(p[0] - 1.2)} ${r1(p[1] - 1.2)}z"/>`).join("") : "";
    const base = o.bare ? `<ellipse class="mound" cx="60" cy="108" rx="34" ry="6"/>`
      : `<path class="pot-d" d="M33 117h60l-6 30H40z"/><path class="pot" d="M30 114h60l-6 30H36z"/>${o.glazed ? `<path class="gm2" d="M33 121h54"/>${Array.from({ length: 6 }, (_, i) => dot(41.4 + i * 7.4, 128, 1.7, "gm")).join("")}` : ""}<rect class="rim" x="26" y="105" width="68" height="10" rx="3"/><ellipse class="soil" cx="60" cy="106" rx="30" ry="2.6"/>`;
    return `<svg class="gplant st${st}${o.glazed ? " glazed" : ""}" viewBox="${o.potOnly ? "22 100 76 50" : o.bare ? "0 0 120 116" : "0 0 120 150"}" aria-hidden="true" style="${plantVars(kind)}">${halo}<g class="sway" style="animation-delay:-${r1(o.delay || 0)}s">${o.potOnly ? "" : plantBody(kind, st)}</g>${spk}${base}</svg>`;
  }

  const STAGES = ["Bare soil", "Seedling", "Sprout", "Budding", "In bloom", "Full bloom"];
  const MILESTONE_PLANTS = [
    { id: "orchid", name: "Gilded orchid", where: "Fed by golden pollen", need: [1, 5, 12, 25, 45], val: (d) => d.golden, text: (n) => (n === 1 ? "Win a golden pollen badge" : `Win ${n} golden pollen badges`) },
    { id: "bonsai", name: "Par bonsai", where: "Fed by Perfect clears", need: [1, 5, 15, 35, 70], val: (d) => d.perfects, text: (n) => (n === 1 ? "Earn a Perfect mark" : `Earn ${n} Perfect marks`) },
    { id: "ivy", name: "Sky ivy", where: "Fed by your Daily streak", need: [1, 3, 7, 14, 30], val: () => S.daily.best || 0, text: (n) => (n === 1 ? "Finish a Daily Sky" : `Reach a ${n} day Daily streak`) },
    { id: "lotus", name: "Still lotus", where: "Fed by Zen skies", need: [1, 5, 15, 40, 100], val: () => S.stats.zen || 0, text: (n) => (n === 1 ? "Sow a Zen sky" : `Sow ${n} Zen skies`) }
  ];
  /** Every greenhouse bed with its five growth steps. */
  function plantList() {
    const d = derive();
    const out = WORLDS.map((w, wi) => {
      const L = levelsOf(w), n = L.length, kind = theme(w).flora || (FLORA[w.id - 1] || FLORA[0]).id, f = FLORA.find((x) => x.id === kind);
      const cl = () => worldCleared(w), sts = () => worldStars(w);
      const steps = [
        { need: 1, val: cl, text: `Clear a plot in ${w.name}` },
        { need: Math.min(n, 6), val: cl, text: `Clear ${Math.min(n, 6)} plots in ${w.name}` },
        { need: Math.min(n, 12), val: cl, text: `Clear ${Math.min(n, 12)} plots in ${w.name}` },
        { need: n, val: cl, text: `Clear every plot in ${w.name}` },
        { need: n * 3, val: sts, text: `Earn every star in ${w.name}` }
      ];
      return { id: kind, kind, name: f ? f.name : w.name, where: w.name, grown: S.flora[kind] || 0, world: w, steps };
    });
    MILESTONE_PLANTS.forEach((m) => out.push({ id: m.id, kind: m.id, name: m.name, where: m.where, steps: m.need.map((n) => ({ need: n, val: () => m.val(d), text: m.text(n) })) }));
    return out;
  }
  function naturalStage(p) { let k = 0; while (k < 5 && p.steps[k].val() >= p.steps[k].need) k++; return k; }
  const doses = (id) => Math.min(FERT_MAX, Object.keys(S.wallet.spend).filter((k) => k.indexOf("fert:" + id + ":") === 0).length);
  function plantStage(p) { const n = naturalStage(p); return n >= 1 ? Math.min(5, n + doses(p.id)) : 0; }
  const FERT_MAX = 2, POT_COST = 90, BANNER_KEY = "banner:orchard", BANNER_COST = 300;
  const fertCost = (target) => 50 + 30 * target;
  const badgeCost = (wi) => 120 + 60 * wi;
  const DECOR = [
    { id: "chime", name: "Wind chime", cost: 90, note: "Brass tubes that sway over the beds" },
    { id: "lanterns", name: "Lantern string", cost: 140, note: "Warm lights strung under the glass" },
    { id: "jar", name: "Firefly jar", cost: 180, note: "Meadow fireflies, blinking softly" },
    { id: "orrery", name: "Orrery mobile", cost: 240, note: "Brass rings and planets turning overhead" },
    { id: "chart", name: "Star chart", cost: 320, note: "Constellations etched across the glass" }
  ];
  function decoSvg(id) {
    if (id === "chime") {
      const tubes = [34, 46, 54, 42, 30].map((h, i) => `<line class="dk-l" x1="${18 + i * 6}" y1="22" x2="${18 + i * 6}" y2="30"/><rect class="brass" x="${16 + i * 6}" y="30" width="4" height="${h}" rx="1.5"/>`).join("");
      return `<svg class="deco-svg" viewBox="0 0 60 110" aria-hidden="true"><line class="dk-l" x1="30" y1="0" x2="30" y2="18"/><g class="swing" style="transform-origin:30px 0">${tubes}<ellipse class="brass" cx="30" cy="20" rx="17" ry="3.6"/><line class="dk-l" x1="30" y1="22" x2="30" y2="70"/><circle class="brass" cx="30" cy="72" r="3.2"/><path class="lf" d="M30 76l-5 14h10z"/></g></svg>`;
    }
    if (id === "lanterns") {
      const pts = [];
      for (let i = 0; i <= 24; i++) { const t = i / 24, sw = t < 0.5 ? t * 2 : (t - 0.5) * 2; pts.push([t * 100, 6 + Math.sin(sw * Math.PI) * 30]); }
      const lamps = pts.filter((p, i) => i % 2 === 1).map((p, i) => `<i class="lamp b${i % 3}" style="left:${r1(p[0])}%;top:${r1(p[1])}px;animation-delay:-${r1(i * 0.41)}s"></i>`).join("");
      return `<svg class="deco-svg wire-svg" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true"><path class="wire" d="${pts.map((p, i) => (i ? "L" : "M") + r1(p[0]) + " " + r1(p[1])).join("")}"/></svg>${lamps}`;
    }
    if (id === "jar") {
      const flies = [[24, 64, 0], [36, 78, 0.6], [28, 88, 1.3], [38, 60, 1.9], [22, 80, 2.4]].map((f) => `<circle class="fly" style="animation-delay:-${f[2]}s" cx="${f[0]}" cy="${f[1]}" r="2.4"/>`).join("");
      return `<svg class="deco-svg" viewBox="0 0 60 110" aria-hidden="true"><line class="dk-l" x1="30" y1="0" x2="30" y2="36"/><g class="swing slow" style="transform-origin:30px 0"><path class="dk-l" d="M18 40q12-10 24 0"/><rect class="brass" x="17" y="40" width="26" height="6" rx="2"/><path class="glass" d="M19 46h22c4 4 6 9 6 16v28a8 8 0 0 1-8 8H21a8 8 0 0 1-8-8V62c0-7 2-12 6-16z"/>${flies}</g></svg>`;
    }
    if (id === "orrery") {
      return `<svg class="deco-svg" viewBox="0 0 120 130" aria-hidden="true"><line class="dk-l" x1="60" y1="0" x2="60" y2="16"/><g class="swing slow" style="transform-origin:60px 0"><circle class="ring" cx="60" cy="70" r="22"/><circle class="ring" cx="60" cy="70" r="36"/><circle class="ring" cx="60" cy="70" r="50"/><line class="dk-l" x1="60" y1="16" x2="60" y2="62"/>
        <g class="orb o1"><circle class="brass" cx="60" cy="48" r="4"/></g><g class="orb o2"><circle class="p2" cx="96" cy="70" r="5.5"/></g><g class="orb o3"><circle class="p3" cx="60" cy="120" r="6.5"/><circle class="ring" cx="60" cy="120" r="10"/></g>
        <circle class="sun" cx="60" cy="70" r="9"/></g></svg>`;
    }
    if (id === "chart") {
      const C = [[[90, 80], [160, 60], [230, 95], [300, 70], [350, 120]], [[640, 60], [700, 110], [770, 80], [820, 140], [740, 170]], [[460, 230], [520, 200], [580, 240], [540, 300]], [[120, 330], [190, 300], [250, 350], [210, 400]], [[800, 330], [880, 300], [930, 360]]];
      const lines = C.map((c) => `<path d="${c.map((p, i) => (i ? "L" : "M") + p.join(" ")).join("")}"/>`).join("");
      const stars = C.reduce((a, c) => a.concat(c), []).map((p, i) => `<circle class="cs" style="animation-delay:-${r1(i * 0.53)}s" cx="${p[0]}" cy="${p[1]}" r="${i % 3 ? 1.6 : 2.6}"/>`).join("");
      return `<svg class="deco-svg chart" viewBox="0 0 1000 450" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><g class="cl">${lines}</g>${stars}</svg>`;
    }
    return "";
  }
  const BADGE_SHAPES = [
    { p: [[20, 9], [30, 16], [27, 29], [13, 29], [10, 16], [20, 20]], l: [[5, 0], [5, 1], [5, 2], [5, 3], [5, 4]] },
    { p: [[20, 7], [20, 33], [9, 13], [31, 27], [9, 27], [31, 13]], l: [[0, 1], [2, 3], [4, 5]] },
    { p: [[10, 11], [18, 21], [9, 30], [30, 10], [22, 20], [31, 29]], l: [[0, 1], [1, 2], [3, 4], [4, 5], [1, 4]] },
    { p: [[20, 8], [30, 14], [32, 24], [24, 32], [13, 31], [8, 22], [11, 12], [20, 20]], l: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 0], [7, 0], [7, 2]] },
    { p: [[31, 11], [33, 23], [25, 32], [14, 30], [11, 20], [17, 14], [23, 18], [20, 22]], l: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7]] }
  ];
  /** Constellation badge for a world, drawn in that world's colours. */
  function badgeSvg(wi) {
    const id = WORLDS[wi] ? WORLDS[wi].id : wi + 1, b = BADGE_SHAPES[(id - 1) % BADGE_SHAPES.length];
    return `<svg class="cbadge-svg" viewBox="0 0 40 40" aria-hidden="true" style="${worldColorVars(WORLDS[wi])}"><circle class="bd" cx="20" cy="20" r="18.5"/><g class="bl">${b.l.map((e) => `<line x1="${b.p[e[0]][0]}" y1="${b.p[e[0]][1]}" x2="${b.p[e[1]][0]}" y2="${b.p[e[1]][1]}"/>`).join("")}</g>${b.p.map((q, i) => `<circle class="bs" cx="${q[0]}" cy="${q[1]}" r="${i === b.p.length - 1 && id !== 2 ? 2.2 : 1.6}"/>`).join("")}</svg>`;
  }
  const badgeReady = (wi) => { const w = WORLDS[wi]; return !!w && levelsOf(w).length > 0 && worldCleared(w) >= levelsOf(w).length; };
  function bannerHtml(sample) {
    const ps = sample ? ["daisy", "fern", "sunflower", "spiral", "ember"].map((k) => ({ kind: k, st: 5 })) : plantList().map((p) => ({ kind: p.kind, st: plantStage(p) })).filter((p) => p.st > 0);
    const flies = Array.from({ length: sample ? 5 : 12 }, (_, i) => `<i style="left:${(i * 37 + 11) % 100}%;bottom:${20 + ((i * 53) % 60)}%;animation-delay:-${r1(i * 0.7)}s"></i>`).join("");
    return `<svg class="hill" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true"><path d="M0 58Q160 30 330 48T660 44T1000 50V100H0z"/></svg><div class="bplants">${ps.map((p, i) => plantSvg(p.kind, p.st, { bare: true, delay: i * 0.8 })).join("")}</div><div class="flies">${flies}</div>`;
  }
  /** Draws the title and hub flourishes the player owns. */
  function renderFlourish() {
    const owned = WORLDS.map((w, i) => i).filter((i) => owns("badge:" + WORLDS[i].id));
    const row = owned.map((i) => `<span class="cbadge" title="${esc(WORLDS[i].name)} constellation">${badgeSvg(i)}</span>`).join("");
    ["#titleBadges", "#hubBadges"].forEach((s) => { const el = $(s); if (el) { el.innerHTML = row; el.hidden = !owned.length; } });
    const bn = $("#titleBanner"), on = owns(BANNER_KEY);
    if (bn) { bn.hidden = !on; bn.innerHTML = on ? bannerHtml() : ""; }
    $("#scr-title").classList.toggle("with-banner", on);
  }

  function fmtTime(ms) {
    const m = Math.floor(ms / 60000);
    if (m < 60) return m + "m";
    return Math.floor(m / 60) + "h " + (m % 60) + "m";
  }
  let grewNow = null;
  function bedHtml(x, i) {
    const st = plantStage(x), nat = naturalStage(x), dz = doses(x.id), nx = nat < 5 ? x.steps[nat] : null;
    const v = nx ? Math.min(nx.need, nx.val()) : 0, pot = owns("pot:" + x.id);
    const feed = st < 5 && nat >= 1 && dz < FERT_MAX, glaze = !pot && nat >= 1;
    return `<article class="bed${st >= 5 ? " full" : ""}${grewNow === x.id ? " grew" : ""}" style="${plantVars(x.kind)}">
      <div class="bed-art">${plantSvg(x.kind, st, { glazed: pot, delay: i * 0.9 })}</div>
      <h4>${esc(x.name)}</h4>
      <span class="bw">${esc(x.where)}${x.world ? `<span class="muted">, ${x.grown} grown</span>` : ""}</span>
      <div class="pips" role="img" aria-label="Stage ${st} of 5${st > nat ? `, ${st - nat} from fertilizer` : ""}">${[1, 2, 3, 4, 5].map((k) => `<i class="${k <= Math.min(nat, 5) ? "on" : k <= st ? "fed" : ""}"></i>`).join("")}<b>${STAGES[st]}</b></div>
      ${st >= 5 ? `<p class="nx done">${ic("check")}<span>Fully grown${nat < 5 ? ", with fertilizer" : ""}</span></p>`
        : `<div class="bar"><i style="--p:${nx ? (v / nx.need) * 100 : 0}%"></i></div><p class="nx"><span>${nat === 0 ? "To plant" : "Next"}: ${esc(nx.text)}</span><span class="mono">${v}/${nx.need}</span></p>`}
      ${feed || glaze ? `<div class="bed-act">${feed ? `<button class="btn small" type="button" data-fert="${x.id}" title="Grow one stage now">${ic("fert")}Feed ${nectarAmt(fertCost(st + 1))}</button>` : ""}${!glaze ? "" : `<button class="btn small ghost" type="button" data-pot="${x.id}" title="A glazed pot in this bed's colours">${ic("pot")}Glaze ${nectarAmt(POT_COST)}</button>`}</div>` : ""}
    </article>`;
  }
  function buyFert(p) {
    const st = plantStage(p), cost = fertCost(st + 1);
    buyModal(`Feed the ${p.name}`, `Fertilizer grows it one stage right now, to ${STAGES[st + 1].toLowerCase()}. A bed takes ${FERT_MAX} doses at most, and its milestones keep growing it on top.`, cost, () => {
      if (!spend("fert:" + p.id + ":" + (doses(p.id) + 1), cost)) return;
      grewNow = p.id;
      rerender();
      grewNow = null;
      renderFlourish();
      note(`${p.name} grew: ${STAGES[plantStage(p)].toLowerCase()}`, "good");
    });
  }
  function buyPot(p) {
    buyModal(`Glazed pot for the ${p.name}`, "A hand-glazed pot in this bed's own colours. It stays with the bed as it grows.", POT_COST, () => {
      if (spend("pot:" + p.id, POT_COST)) { rerender(); note(`${p.name} repotted`, "good"); }
    });
  }
  function onBedClick(e) {
    const f = e.target.closest("[data-fert]"), pt = e.target.closest("[data-pot]");
    if (!f && !pt) return false;
    const p = plantList().find((x) => x.id === (f || pt).dataset[f ? "fert" : "pot"]);
    if (p) (f ? buyFert : buyPot)(p);
    return true;
  }
  function renderGreenhouse(p) {
    const d = derive(), tl = totalLevels(), ps = plantList();
    const grown = ps.reduce((n, x) => n + plantStage(x), 0);
    const deco = DECOR.filter((x) => owns("decor:" + x.id));
    const hang = deco.filter((x) => x.id !== "chart");
    p.innerHTML = `<div class="ph"><div><h2>Greenhouse</h2><p>Each bed grows from something you did: worlds cleared, golden pollen, Perfect clears, your Daily streak and Zen skies.</p></div><span class="chip" title="Growth stages across every bed">${ic("sprout")}<b>${grown}</b>/${ps.length * 5} stages</span></div>
      <div class="gh${owns("decor:chart") ? " charted" : ""}">
        ${owns("decor:chart") ? decoSvg("chart") : ""}
        <div class="gh-top${hang.length ? "" : " empty"}">${hang.map((x) => `<div class="deco d-${x.id}" title="${esc(x.name)}">${decoSvg(x.id)}</div>`).join("")}${deco.length ? "" : `<button class="btn ghost small" type="button" data-a="market">${ic("shop")}Decorations from the Market hang here</button>`}</div>
        <h3 class="gh-h">World beds</h3>
        <div class="beds b5">${ps.filter((x) => x.world).map(bedHtml).join("")}</div>
        <h3 class="gh-h">Milestone beds</h3>
        <div class="beds b4">${ps.filter((x) => !x.world).map((x, i) => bedHtml(x, i + 5)).join("")}</div>
      </div>
      <h3 class="sec-h">Ledger</h3>
      <div class="ledger">
        <div><b>${S.stats.sown}</b><span>seeds sown</span></div>
        <div><b>${S.stats.plants}</b><span>plants grown</span></div>
        <div><b>${S.stats.pollen}</b><span>pollen gathered</span></div>
        <div><b>${fmtTime(S.stats.playMs)}</b><span>time in the garden</span></div>
        <div><b>${d.cleared}<small class="muted" style="font-size:14px">/${tl}</small></b><span>plots cleared</span></div>
        <div><b>${d.three}</b><span>three-star plots</span></div>
        <div><b>${d.golden}</b><span>golden badges</span></div>
        <div><b>${d.perfects}</b><span>Perfect marks</span></div>
        <div><b>${S.stats.zen}</b><span>Zen skies sown</span></div>
        <div><b>${S.stats.burn + S.stats.crash + S.stats.swallow + S.stats.lost + S.stats.shield}</b><span>seeds lost to the sky</span></div>
      </div>
      <h3 class="sec-h">Stars by world</h3>
      <div class="wbars">${WORLDS.map((w) => { const n = levelsOf(w).length * 3, s = worldStars(w); return `<div class="wbar" style="${worldColorVars(w)}"><span>${esc(w.name)}</span><div class="bar"><i style="--p:${n ? (s / n) * 100 : 0}%"></i></div><span class="mono">${s}/${n}</span></div>`; }).join("")}</div>`;
    p.addEventListener("click", (e) => {
      if (onBedClick(e)) return;
      if (e.target.closest("[data-a=market]")) setTab("market", { focus: true });
    });
  }

  function renderTrophies(p) {
    const d = derive(), got = ACH.filter((a) => S.ach[a.id]).length;
    p.innerHTML = `<div class="ph"><div><h2>Trophies</h2><p>Milestones from the garden. Progress counts across every mode.</p></div>
      <div class="tro-sum"><b class="mono">${got}/${ACH.length}</b><div class="bar" style="width:200px"><i style="--p:${(got / ACH.length) * 100}%"></i></div></div></div>
      <div class="trophies">${ACH.map((a) => {
        const on = !!S.ach[a.id], v = Math.min(a.max, a.cur(d) || 0);
        return `<div class="tro t-${a.tier}${on ? " got" : ""}"><div class="medal">${ic(a.icon)}</div><div><h3>${esc(a.name)}</h3><p>${esc(a.desc)}</p>
          <span class="tier"><i></i>${TIER_NAME[a.tier]}${a.nectar ? ` · ${nectarAmt(a.nectar)}` : ""}</span>
          <div class="meta">${on ? `${ic("check")}<span>Earned ${new Date(S.ach[a.id]).toLocaleDateString()}</span>` : `<div class="bar"><i style="--p:${(v / a.max) * 100}%"></i></div><span class="mono">${v}/${a.max}</span>`}</div></div></div>`;
      }).join("")}</div>`;
    $$(".meta svg.i", p).forEach((s) => { s.style.width = "14px"; s.style.height = "14px"; });
  }

  const TOGGLES = [
    ["grid", "Gravity lattice", "Show how space bends around each body (G)."],
    ["assist", "Trajectory assist", "Draw a longer, clearer preview line. Results are tagged Assist."],
    ["fastForward", "Auto fast-forward", "Every flight plays at 3× speed. Hold F for a single flight instead."],
    ["shake", "Screen shake", "Shake the sky on crashes and big moments."],
    ["reducedMotion", "Reduced motion", "Calm transitions and stop looping animations."],
    ["colorblind", "Colorblind markers", "Add shapes to bodies so colour isn't the only cue."]
  ];
  function renderSettings(el, compact) {
    const st = S.settings;
    const sw = (k, on) => `<button class="switch" type="button" role="switch" aria-checked="${on ? "true" : "false"}" data-set="${k}" aria-labelledby="lbl-${k}${compact ? "-c" : ""}"></button>`;
    const vol = (k, label) => `<div class="field"><label for="vol-${k}${compact ? "-c" : ""}">${label}<output>${Math.round(st[k] * 100)}%</output></label><input type="range" id="vol-${k}${compact ? "-c" : ""}" min="0" max="100" value="${Math.round(st[k] * 100)}" data-vol="${k}" style="--v:${st[k] * 100}%"></div>`;
    el.innerHTML = `${compact ? "" : `<div class="ph"><div><h2>Settings</h2><p>Changes save as you make them.</p></div></div>`}
      <h3 class="sec-h" style="margin-top:0">Skin</h3>
      <div class="skins" role="radiogroup" aria-label="Skin">${SKINS.map((s) => `<button class="skin" type="button" role="radio" data-skin="${s.id}" data-pick="${s.id}" aria-checked="${st.skin === s.id}"><div class="sw"><i class="a"></i><i class="b"></i><i class="c"></i><i class="d"></i></div><b>${s.name}</b><span>${s.note}</span></button>`).join("")}</div>
      <div class="set-grid">
        <div><h3 class="sec-h">Sound</h3>${vol("master", "Master")}${vol("music", "Music")}${vol("sfx", "Effects")}
          <div class="toggle"><div class="t"><b id="lbl-muted${compact ? "-c" : ""}">Mute everything</b><span>Also on the M key.</span></div>${sw("muted", st.muted)}</div></div>
        <div><h3 class="sec-h">Play</h3>${TOGGLES.map(([k, n, d]) => `<div class="toggle"><div class="t"><b id="lbl-${k}${compact ? "-c" : ""}">${n}</b><span>${d}</span></div>${sw(k, st[k])}</div>`).join("")}</div>
      </div>
      ${compact ? "" : `<h3 class="sec-h">Cloud save</h3>
      <div class="cloud-card" id="cloudCard"></div>
      <h3 class="sec-h">Controls</h3>
      <div class="keys">
        <div><kbd>Drag</kbd>pull back anywhere, release to sow</div>
        <div><kbd>← →</kbd>aim <kbd>↑ ↓</kbd>power</div>
        <div><kbd>Shift</kbd>fine aim with the arrows</div>
        <div><kbd>Space</kbd>sow a seed</div>
        <div><kbd>F</kbd>hold to fast-forward</div>
        <div><kbd>G</kbd>gravity lattice</div>
        <div><kbd>R</kbd>replant <kbd>N</kbd>next plot</div>
        <div><kbd>Esc</kbd><kbd>P</kbd>pause</div>
        <div><kbd>M</kbd>mute</div>
        <div><kbd>H</kbd>snap aim to the Oracle's guide</div>
        <div><kbd>1</kbd>–<kbd>${TABS.length}</kbd>switch menu tabs</div>
      </div>`}`;
    el.addEventListener("click", (e) => {
      const s = e.target.closest("[data-set]");
      if (s) {
        const k = s.dataset.set, v = s.getAttribute("aria-checked") !== "true";
        s.setAttribute("aria-checked", v ? "true" : "false");
        setSetting(k, v);
        if (k === "muted") refreshChips();
        if (k === "fastForward") syncFast();
        checkAch();
        return;
      }
      const pk = e.target.closest("[data-pick]");
      if (pk) {
        applySkin(pk.dataset.pick);
        $$("[data-pick]", el).forEach((b) => b.setAttribute("aria-checked", b.dataset.pick === S.settings.skin ? "true" : "false"));
        save(); checkAch();
        return;
      }
    });
    el.addEventListener("input", (e) => {
      const r = e.target.closest("[data-vol]");
      if (!r) return;
      const v = +r.value / 100;
      r.style.setProperty("--v", r.value + "%");
      const o = r.parentElement.querySelector("output");
      if (o) o.textContent = r.value + "%";
      setSetting(r.dataset.vol, v);
    });
    el.addEventListener("change", (e) => { if (e.target.closest("[data-vol]")) sfx("tick"); });
    const cc = $("#cloudCard", el);
    if (cc) { renderCloudCard(cc); wireCloudCard(cc); }
  }

  const NECTAR = { clear: 10, star2: 5, star3: 10, golden: 10, par: 5, daily: 15, ach: 20 };
  const WEEK_DAYS = 7, WEEK_BONUS = 50;
  const TRAILS = [
    { id: "classic", name: "Classic", cost: 0, note: "The seed's own soft glow" },
    { id: "comet", name: "Comet", cost: 60, note: "A long, tapering tail" },
    { id: "petal", name: "Petal drift", cost: 90, note: "Sheds petals as it flies" },
    { id: "ember", name: "Ember wake", cost: 120, note: "Sparks and warm smoke" },
    { id: "prism", name: "Prism", cost: 160, note: "Splits light into colour" }
  ];
  const CHARM_COST = 40, CHARM_MAX = 2, SEED_COST = 8;
  const ZEN_PAY = [2, 3, 4, 5, 6], ZEN_CAP = 3;
  const CHAL_PAY = 5, CHAL_CAP = 3;
  const zenToday = () => Object.keys(S.wallet.earn).filter((k) => k.indexOf("zen:" + dayKey() + ":") === 0).length;
  const zenLeft = () => Math.max(0, ZEN_CAP - zenToday());
  function zenReward(diff) {
    const t = dayKey();
    for (let n = 1; n <= ZEN_CAP; n++) if (!S.wallet.earn["zen:" + t + ":" + n]) return earn("zen:" + t + ":" + n, ZEN_PAY[clamp(diff || 3, 1, 5) - 1]);
    return 0;
  }
  const oracleCost = (wi) => 25 + 10 * wi;
  const glimpseCost = (wi) => 10 + 2 * wi;
  const walletSum = (o) => Object.keys(o || {}).reduce((n, k) => n + (+o[k] || 0), 0);
  const nectar = () => walletSum(S.wallet.earn) - walletSum(S.wallet.spend);
  const owns = (key) => !!S.wallet.spend[key];
  const nectarAmt = (n) => `<span class="nam">${ic("nectar")}${n}</span>`;
  const solutionFor = (lv) => (lv && window.ORCHARD_SOLUTIONS && window.ORCHARD_SOLUTIONS[lv.id]) || null;
  const trailOwned = (id) => id === "classic" || owns("trail:" + id);

  function earn(key, amt) {
    if (S.wallet.earn[key]) return 0;
    S.wallet.earn[key] = amt;
    return amt;
  }
  function spend(key, amt) {
    if (S.wallet.spend[key]) return true;
    if (nectar() < amt) { note(`You need ${amt - nectar()} more nectar`, "bad"); return false; }
    S.wallet.spend[key] = amt;
    sfx("unlock");
    save(true);
    refreshChips();
    return true;
  }
  function levelRewards(id) {
    const r = S.levels[id];
    if (!r || id.indexOf("daily") === 0) return 0;
    let n = 0;
    if (r.stars >= 1) n += earn("clear:" + id, NECTAR.clear);
    if (r.stars >= 2) n += earn("star2:" + id, NECTAR.star2);
    if (r.stars >= 3) n += earn("star3:" + id, NECTAR.star3);
    if (r.golden) n += earn("golden:" + id, NECTAR.golden);
    const L = LVID[id];
    if (r.stars >= 1 && r.best != null && L && r.best <= L.lv.par) n += earn("par:" + id, NECTAR.par);
    return n;
  }
  function restar() {
    let n = 0;
    WORLDS.forEach((w) => levelsOf(w).forEach((l) => {
      const r = S.levels[l.id];
      if (!r || !(r.stars > 0) || r.best == null) return;
      const s = computeStars(r.best, starAt(l));
      if (s > r.stars) { n += s - r.stars; r.stars = s; }
    }));
    return n;
  }
  function backfillNectar() {
    let n = 0;
    Object.keys(S.levels).forEach((id) => { n += levelRewards(id); });
    Object.keys(S.ach).forEach((id) => { const a = ACH.find((x) => x.id === id); n += a ? achRewards(a) : earn("ach:" + id, NECTAR.ach); });
    Object.keys(S.daily.days || {}).forEach((k) => { n += earn("daily:" + k, NECTAR.daily); });
    return n;
  }
  function visitReward() {
    const t = dayKey();
    if (S.wallet.earn["login:" + t]) return null;
    let run = 1, k = dayShift(t, -1);
    while (S.wallet.earn["login:" + k]) { run++; k = dayShift(k, -1); }
    const amt = 10 + Math.min(10, 2 * (run - 1));
    earn("login:" + t, amt);
    const bonus = run % WEEK_DAYS === 0 ? earn("week:" + t, WEEK_BONUS) : 0;
    return { amt: amt + bonus, run, bonus };
  }
  const visitLabel = (v) => (v.bonus ? `${v.run} days in a row! Weekly bonus +${v.bonus}` : v.run > 1 ? `Daily visit, ${v.run} days in a row` : "Daily visit");
  const charmsHeld = () => Math.max(0, Object.keys(S.wallet.spend).filter((k) => k.indexOf("charm:") === 0).length - Object.keys(S.wallet.frost).length);
  let frostReady = false;
  function applyFrost() {
    if (!frostReady) return 0;
    const t = dayKey(), last = S.daily.last, y = dayShift(t, -1);
    if (!last || !(S.daily.streak > 0) || last >= y) return 0;
    const gap = [];
    for (let k = dayShift(last, 1); k < t && gap.length <= CHARM_MAX; k = dayShift(k, 1)) if (!S.daily.days[k]) gap.push(k);
    if (!gap.length || gap.length > charmsHeld()) return 0;
    gap.forEach((k) => { S.wallet.frost[k] = 1; });
    S.daily.last = y;
    save(true);
    return gap.length;
  }
  function frostCheck() {
    if (frostReady) return;
    frostReady = true;
    if (applyFrost()) { refreshChips(); note("A frost charm kept your Daily Sky streak alive", "info"); }
  }
  function startNectar() {
    const first = !S.coach.nectar;
    const back = backfillNectar();
    const v = visitReward();
    S.coach.nectar = 1;
    if ((first && back > 0) || derive().cleared > 0) S.coach.nectarTip = 1;
    save(true);
    refreshChips();
    pendingWelcome = { first, back, v };
  }
  let pendingWelcome = null;
  function showWelcome() {
    const w = pendingWelcome;
    if (!w || screen !== "hub" || stack.length) return;
    pendingWelcome = null;
    if (w.first && w.back > 0) {
      const m = openModal({
        cls: "welcome", label: "Nectar",
        html: `<div class="eyebrow">${ic("nectar")}New in the orchard</div><h2>Your garden makes nectar</h2>
          <p>Clearing plots, earning stars and golden pollen, trophies, the Daily Sky and simply visiting each day all fill your pouch. Spend it in the Market on the Oracle, spare seeds, frost charms, seed trails and things for your Greenhouse.</p>
          <dl class="rfacts"><div><dt>From past progress</dt><dd>${w.back}</dd></div><div><dt>Today's visit</dt><dd>${w.v ? w.v.amt : 0}</dd></div><div><dt>In your pouch</dt><dd>${nectar()}</dd></div></dl>
          <div class="row"><button class="btn primary" type="button" data-a="market" autofocus>${ic("shop")}Visit the Market</button><button class="btn" type="button" data-a="ok">Later</button></div>`
      });
      m.el.addEventListener("click", (e) => {
        const a = e.target.closest("[data-a]");
        if (!a) return;
        m.close(a.dataset.a);
        if (a.dataset.a === "market") setTab("market", { focus: true });
      });
      sfx("golden");
    } else if (w.v && !w.first) setTimeout(() => nectarPop(w.v.amt, visitLabel(w.v)), 500);
  }

  function nectarPop(n, why) {
    if (!n) return;
    const box = $("#nfx");
    const el = document.createElement("div");
    el.className = "nfx";
    el.innerHTML = `${ic("nectar")}<b>+${n}</b><span></span>`;
    $("span", el).textContent = why || "nectar";
    box.appendChild(el);
    while (box.children.length > 3) box.firstChild.remove();
    sfx("pollen");
    setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 320); }, 2600);
    refreshChips();
    const chip = $("#hubChips .nectar");
    if (chip) { chip.classList.remove("bump"); void chip.offsetWidth; chip.classList.add("bump"); }
  }
  function note(text, tone) {
    if (screen === "game") return toastGame(text, tone);
    pushToast($("#nfx"), "nfx note " + (tone || "info"), text, 2800, 320);
  }
  function buyModal(title, text, cost, onYes) {
    const have = nectar(), ok = have >= cost;
    const m = openModal({
      cls: "buy", label: title,
      html: `<div class="eyebrow">${ic("shop")}Market</div><h2>${esc(title)}</h2><p>${esc(text)}</p>
        <dl class="rfacts"><div><dt>Price</dt><dd>${nectarAmt(cost)}</dd></div><div><dt>In your pouch</dt><dd>${nectarAmt(have)}</dd></div><div><dt>After</dt><dd>${ok ? nectarAmt(have - cost) : "–"}</dd></div></dl>
        ${ok ? "" : `<p class="muted">You need ${cost - have} more. Clear plots, play the Daily Sky, or visit again tomorrow.</p>`}
        <div class="row">${ok ? `<button class="btn primary" type="button" data-a="yes" autofocus>${ic("nectar")}Spend ${cost}</button>` : ""}<button class="btn" type="button" data-a="no" ${ok ? "" : "autofocus"}>${ok ? "Cancel" : "Close"}</button></div>`
    });
    m.el.addEventListener("click", (e) => {
      const a = e.target.closest("[data-a]");
      if (!a || m.closed) return;
      m.close(a.dataset.a);
      if (a.dataset.a === "yes") onYes();
    });
  }

  const canBuySeed = () => !!cur && cur.mode !== "zen" && cur.mode !== "challenge" && hasEng("addSeeds");
  function buySeed() {
    if (nectar() < SEED_COST) { note(`You need ${SEED_COST - nectar()} more nectar`, "bad"); return false; }
    if (!eng("addSeeds", 1)) { note("No seed can be added right now", "bad"); return false; }
    spend("seed:" + newDevId(), SEED_COST);
    toastGame("One more seed", "good");
    return true;
  }

  const isMoving = (lv) => (lv.bodies || []).some((b) => b.orbit || (b.shield && b.shield.w));
  const replants = {};
  const tries = (id) => (S.fails[id] || 0) + (replants[id] || 0);
  const guidesOn = () => { const s = eng("getState"); return !!(s && s.guides); };
  function oracleRow(gated) {
    if (!cur || cur.mode !== "journey" || !hasEng("playDemo")) return "";
    const sol = solutionFor(cur.level);
    if (!sol) return "";
    const id = cur.level.id, full = owns("oracle:" + id), gl = owns("glimpse:" + id);
    if (gated && !full && !gl && !isCleared(id) && tries(id) < 2) return "";
    return `<div class="oracle-row"><div class="ol">${ic("eye")}<div><b>Oracle</b><span>${full ? "You own this plot's optimal clear." : `See the clear in ${sol.shots.length} seed${sol.shots.length === 1 ? "" : "s"}${sol.golden && (cur.level.pollen || []).length ? " with all the pollen" : ""}.`}</span></div></div>
      <div class="ob">${full ? `<button class="btn small primary" type="button" data-o="full">${ic("play")}Watch the clear</button>` :
        `${sol.shots.length > 1 ? `<button class="btn small" type="button" data-o="glimpse">${gl ? `${ic("play")}First shot` : `First shot ${nectarAmt(glimpseCost(cur.wi))}`}</button>` : ""}<button class="btn small primary" type="button" data-o="full">Full clear ${nectarAmt(oracleCost(cur.wi))}</button>`}</div></div>`;
  }
  function onOracleClick(e) {
    const b = e.target.closest("[data-o]");
    if (!b || !cur) return false;
    const kind = b.dataset.o, id = cur.level.id, sol = solutionFor(cur.level);
    const key = (kind === "full" ? "oracle:" : "glimpse:") + id;
    const cost = kind === "full" ? oracleCost(cur.wi) : glimpseCost(cur.wi);
    if (owns(key) || owns("oracle:" + id)) { startDemo(kind); return true; }
    buyModal(kind === "full" ? "Reveal the optimal clear" : "Glimpse the first shot",
      kind === "full" ? `The Oracle plays ${cur.level.name} in ${sol.shots.length} seed${sol.shots.length === 1 ? "" : "s"}, then leaves guides on the field for you. It's yours to rewatch forever.` : `The Oracle plays the opening shot of ${cur.level.name} and leaves its guide on the field. You can rewatch it any time.`,
      cost, () => { if (spend(key, cost)) startDemo(kind); });
    return true;
  }
  function startDemo(kind) {
    const sol = solutionFor(cur && cur.level);
    if (!sol || !hasEng("playDemo")) { note("The Oracle can't play this plot", "bad"); return; }
    closeAllModals();
    closeCoach();
    paused = false;
    eng("setPaused", false);
    cur.demo = { kind, n: kind === "glimpse" ? 1 : sol.shots.length };
    cur.finished = false;
    showDemoBar(0);
    syncInput();
    if (!eng("playDemo", sol, { upTo: cur.demo.n })) { endDemo(false); note("The Oracle can't play this plot", "bad"); }
  }
  function showDemoBar(i) {
    const b = $("#demoBar");
    b.hidden = false;
    b.innerHTML = `${ic("eye")}<b>${cur.demo.kind === "full" ? "Oracle" : "Glimpse"}</b><span class="muted">${i ? `shot ${i} of ${cur.demo.n}` : "watch the aim"}</span><button class="btn small" type="button" data-a="stopdemo">Stop <kbd>Esc</kbd></button>`;
  }
  function onDemo(ev) {
    if (!cur || !cur.demo || !ev) return;
    if (ev.phase === "shot") showDemoBar(Math.min(cur.demo.n, (ev.i || 0) + 1));
    if (ev.phase === "end") setTimeout(() => demoDone(ev), reduced() ? 200 : 1100);
    if (ev.phase === "abort") { cur.demo = null; $("#demoBar").hidden = true; syncInput(); }
  }
  function demoDone(ev) {
    if (!cur || !cur.demo) return;
    if (stack.length) { setTimeout(() => demoDone(ev), 400); return; }
    const kind = cur.demo.kind, sol = solutionFor(cur.level), n = sol.shots.length;
    const moving = isMoving(cur.level);
    $("#demoBar").hidden = true;
    const m = openModal({
      cls: "", label: "Oracle", dismissable: false,
      html: `<div class="eyebrow">${ic("eye")}${kind === "full" ? "Oracle" : "Glimpse"}</div><h2>${kind === "full" ? (ev.completed ? "That's the optimal clear" : "That's the Oracle's line") : "That's the opening shot"}</h2>
        <p>${kind === "full" ? `${n} seed${n === 1 ? "" : "s"} for par ${cur.level.par}${sol.golden && (cur.level.pollen || []).length ? ", with every grain of pollen" : ""}. ` : ""}Guides will mark ${kind === "full" ? "each aim" : "the aim"} on the field. Press <kbd>H</kbd> to snap to the next one.${moving ? " This plot moves, so timing matters: each guide counts down to the moment it was sown." : ""}</p>
        <div class="row"><button class="btn primary" type="button" data-a="guides" autofocus>${ic("play")}Your turn, with guides</button><button class="btn" type="button" data-a="plain">Your turn</button><button class="btn ghost" type="button" data-a="again">${ic("restart")}Watch again</button></div>`,
      onKey: (e) => {
        if (e.key === "Escape") { m.close("plain"); endDemo(false); return true; }
        return false;
      }
    });
    m.el.addEventListener("click", (e) => {
      const a = e.target.closest("[data-a]");
      if (!a) return;
      m.close(a.dataset.a);
      if (a.dataset.a === "again") startDemo(kind);
      else endDemo(a.dataset.a === "guides");
    });
  }
  function endDemo(guides) {
    if (!cur) return;
    const kind = cur.demo ? cur.demo.kind : "full";
    cur.demo = null;
    $("#demoBar").hidden = true;
    if (eng("isDemo")) eng("stopDemo");
    restart();
    const sol = solutionFor(cur.level);
    eng("setGuides", guides && sol ? (kind === "full" ? sol : { shots: sol.shots.slice(0, 1), stars: sol.stars, golden: sol.golden }) : null);
    $("#hGuide").hidden = !(guides && sol && hasEng("snapToGuide"));
    cur.guided = guidesOn();
    syncInput();
    if (guides) toastGame("Press H to line up with the next guide", "info");
  }

  function renderMarket(p) {
    const bal = nectar(), earned = walletSum(S.wallet.earn), spent = walletSum(S.wallet.spend);
    const reveals = Object.keys(S.wallet.spend).filter((k) => k.indexOf("oracle:") === 0).map((k) => k.slice(7));
    const findLv = (id) => { for (let wi = 0; wi < WORLDS.length; wi++) { const j = levelsOf(WORLDS[wi]).findIndex((l) => l.id === id); if (j >= 0) return { wi, j, lv: levelsOf(WORLDS[wi])[j] }; } return null; };
    const held = charmsHeld(), beds = plantList(), potsOwned = beds.filter((b) => owns("pot:" + b.id)).length;
    p.innerHTML = `<div class="ph"><div><h2>Market</h2><p>Nectar is what your orchard produces. Spend it on help when a plot has you stuck, or on a little flair.</p></div></div>
      <div class="mk-top">
        <div class="sheet pouch"><div class="drop">${ic("nectar")}</div><div><span class="muted">In your pouch</span><b class="bal">${bal}</b><span class="muted small">${earned} earned, ${spent} spent</span></div></div>
        <div class="sheet earnlist"><h3>How to earn</h3><ul>
          <li><span>First clear of a plot</span><b>+${NECTAR.clear}</b></li>
          <li><span>Second star, third star</span><b>+${NECTAR.star2}, +${NECTAR.star3}</b></li>
          <li><span>Golden pollen badge</span><b>+${NECTAR.golden}</b></li>
          <li><span>Perfect: clear a plot in par, without guides</span><b>+${NECTAR.par}</b></li>
          <li><span>Daily Sky, once a day</span><b>+${NECTAR.daily}</b></li>
          <li><span>Daily visit, more for a run of days</span><b>+10 to +20</b></li>
          <li><span>Every 7th day in a row</span><b>+${WEEK_BONUS} bonus</b></li>
          <li><span>Zen sky, ${ZEN_CAP} a day, more for wilder skies</span><b>+${ZEN_PAY[0]} to +${ZEN_PAY[4]}</b></li>
          <li><span>Trophies, by tier: bronze, silver, gold, platinum</span><b>+${TIER_PAY.bronze} to +${TIER_PAY.platinum}</b></li>
        </ul></div>
      </div>
      <h3 class="sec-h">${ic("eye")} The Oracle</h3>
      <div class="sheet oracle-info">
        <p>Stuck on a Journey plot? Open its intro card or pause menu. A <b>Glimpse</b> plays the opening shot. The <b>full clear</b> plays the whole plot at par, collecting all the pollen where it can. Either one leaves aim guides on the field, and once bought it's yours to rewatch. A clear sown with guides tops out at two stars, with no golden badge or Perfect.</p>
        <table class="ptable"><thead><tr><th>World</th>${WORLDS.map((w, i) => `<th>${i + 1}</th>`).join("")}</tr></thead><tbody>
          <tr><td>Glimpse</td>${WORLDS.map((w, i) => `<td>${glimpseCost(i)}</td>`).join("")}</tr>
          <tr><td>Full clear</td>${WORLDS.map((w, i) => `<td>${oracleCost(i)}</td>`).join("")}</tr></tbody></table>
        ${reveals.length ? `<div class="owned"><span class="muted">Your reveals</span>${reveals.map((id) => { const f = findLv(id); return f ? `<button class="btn small" type="button" data-play="${f.wi}:${f.j}" title="${esc(WORLDS[f.wi].name)}, ${levelPlotLabel(f.j)}">World ${f.wi + 1}, ${levelPlotLabel(f.j)}: ${esc(f.lv.name)}</button>` : ""; }).join("")}</div>` : ""}
      </div>
      <h3 class="sec-h">${ic("seed")} Seed trails</h3>
      <div class="trails">${TRAILS.map((t) => {
        const own = trailOwned(t.id), on = (S.settings.trail || "classic") === t.id;
        return `<button class="trail${on ? " on" : ""}" type="button" data-trail="${t.id}" aria-pressed="${on}"><div class="tsw" data-t="${t.id}"><i></i></div><b>${t.name}</b><span>${esc(t.note)}</span><em>${on ? "Equipped" : own ? "Owned, tap to equip" : nectarAmt(t.cost)}</em></button>`;
      }).join("")}</div>
      <h3 class="sec-h">${ic("pot")} For the Greenhouse</h3>
      <div class="trails decos">${DECOR.map((x) => { const own = owns("decor:" + x.id); return `<button class="trail deco-card${own ? " have" : ""}" type="button" data-decor="${x.id}"><div class="prev dsw d-${x.id}">${decoSvg(x.id)}</div><b>${x.name}</b><span>${esc(x.note)}</span><em>${own ? `${ic("check")}Owned` : nectarAmt(x.cost)}</em></button>`; }).join("")}</div>
      <div class="set-grid mk-more">
        <div><h4 class="mk-h">Glazed pots <span class="muted mono">${potsOwned}/${beds.length}</span></h4>
          <div class="sheet"><p>Give a bed a hand-glazed pot in its own colours, ${nectarAmt(POT_COST)} each.</p>
          <div class="pots">${beds.map((b) => { const own = owns("pot:" + b.id); return `<button class="potb${own ? " have" : ""}" type="button" data-pot="${b.id}" title="${esc(b.name)}${own ? ", glazed" : ""}" aria-label="Glazed pot for the ${esc(b.name)}${own ? ", owned" : ""}" ${own ? "disabled" : ""}>${plantSvg(b.kind, 0, { glazed: true, potOnly: true })}${own ? ic("check") : ""}</button>`; }).join("")}</div></div></div>
        <div><h4 class="mk-h">Fertilizer</h4>
          <div class="sheet"><p>Grows one bed a stage right away, up to ${FERT_MAX} doses a bed. Feed a bed from the Greenhouse.</p>
          <table class="ptable"><thead><tr><th>To stage</th>${[2, 3, 4, 5].map((k) => `<th>${k}</th>`).join("")}</tr></thead><tbody><tr><td>Price</td>${[2, 3, 4, 5].map((k) => `<td>${fertCost(k)}</td>`).join("")}</tr></tbody></table>
          <div class="row"><button class="btn small" type="button" data-a="greenhouse">${ic("pot")}Open the Greenhouse</button></div></div></div>
      </div>
      <h3 class="sec-h">${ic("badge")} Flourishes</h3>
      <div class="flourish">
        <button class="trail fl-banner${owns(BANNER_KEY) ? " have" : ""}" type="button" data-a="banner"><div class="prev bsw">${bannerHtml(true)}</div><b>Orchard banner</b><span>Your beds sway along the bottom of the title screen, growing as they do.</span><em>${owns(BANNER_KEY) ? `${ic("check")}On the title screen` : nectarAmt(BANNER_COST)}</em></button>
        <div class="badges">${WORLDS.map((w, i) => { const own = owns("badge:" + w.id), ok = badgeReady(i), L = levelsOf(w).length; return `<button class="trail badge-card${own ? " have" : ""}${ok || own ? "" : " locked"}" type="button" data-badge="${i}" ${ok || own ? "" : 'aria-disabled="true"'}><div class="bdg">${badgeSvg(i)}</div><b>${esc(w.name)}</b><em>${own ? `${ic("check")}Shown` : ok ? nectarAmt(badgeCost(i)) : `${ic("lock")}${worldCleared(w)}/${L} plots`}</em></button>`; }).join("")}</div>
      </div>
      <p class="muted small fl-note">A constellation badge opens once every plot of its world is cleared. Badges sit by the logo on the title screen and the menu.</p>
      <div class="set-grid mk-more">
        <div><h3 class="sec-h">${ic("ice")} Frost charms</h3>
          <div class="sheet"><p>Miss a day and a charm keeps your Daily Sky streak alive. It's used automatically. You can hold ${CHARM_MAX}.</p>
          <div class="row"><span class="charms">${Array.from({ length: CHARM_MAX }, (_, i) => `<i class="${i < held ? "on" : ""}">${ic("ice")}</i>`).join("")}</span><button class="btn small" type="button" data-a="charm" ${held >= CHARM_MAX ? "disabled" : ""}>${held >= CHARM_MAX ? "Pouch full" : `Buy a charm ${nectarAmt(CHARM_COST)}`}</button></div></div></div>
        <div><h3 class="sec-h">${ic("seed")} Spare seeds</h3>
          <div class="sheet"><p>Out of seeds with soil still bare? Keep going with one more for ${nectarAmt(SEED_COST)}. Offered when you run out, and from the pause menu. Stars still count every seed you sow.</p></div></div>
      </div>`;
    p.addEventListener("click", (e) => {
      const pl = e.target.closest("[data-play]");
      if (pl) { const [wi, j] = pl.dataset.play.split(":").map(Number); playLevel(wi, j); return; }
      const tb = e.target.closest("[data-trail]");
      if (tb) {
        const t = TRAILS.find((x) => x.id === tb.dataset.trail);
        const equip = () => { setSetting("trail", t.id); rerender(); note(`${t.name} trail equipped`, "good"); };
        if (trailOwned(t.id)) equip();
        else buyModal(`${t.name} trail`, `${t.note}. Every seed you sow will wear it.`, t.cost, () => { if (spend("trail:" + t.id, t.cost)) equip(); });
        return;
      }
      if (onBedClick(e)) return;
      if (e.target.closest("[data-a=greenhouse]")) { setTab("greenhouse", { focus: true }); return; }
      const dc = e.target.closest("[data-decor]");
      if (dc) {
        const x = DECOR.find((d) => d.id === dc.dataset.decor);
        if (owns("decor:" + x.id)) { setTab("greenhouse", { focus: true }); return; }
        buyModal(x.name, `${x.note}. It stays in the Greenhouse for good.`, x.cost, () => { if (spend("decor:" + x.id, x.cost)) { rerender(); note(`${x.name} added to the Greenhouse`, "good"); } });
        return;
      }
      if (e.target.closest("[data-a=banner]")) {
        if (owns(BANNER_KEY)) { note("The banner is on the title screen", "info"); return; }
        buyModal("Orchard banner", "Every bed you have grown sways along the bottom of the title screen, with fireflies. It grows as your beds do.", BANNER_COST, () => { if (spend(BANNER_KEY, BANNER_COST)) { rerender(); renderFlourish(); note("Orchard banner raised on the title screen", "good"); } });
        return;
      }
      const bg = e.target.closest("[data-badge]");
      if (bg) {
        const i = +bg.dataset.badge, w = WORLDS[i], key = "badge:" + w.id;
        if (owns(key)) { note(`The ${w.name} constellation is on the title screen`, "info"); return; }
        if (!badgeReady(i)) { sfx("lose"); note(`Clear every plot in ${w.name} first`, "bad"); return; }
        buyModal(`${w.name} constellation`, `A badge for clearing every plot in ${w.name}. It sits by the logo on the title screen and the menu.`, badgeCost(i), () => { if (spend(key, badgeCost(i))) { rerender(); renderFlourish(); note(`${w.name} constellation added`, "good"); } });
        return;
      }
      if (e.target.closest("[data-a=charm]")) {
        buyModal("Frost charm", "If you miss a day, this charm is used up to keep your Daily Sky streak going.", CHARM_COST, () => { if (spend("charm:" + newDevId(), CHARM_COST)) { rerender(); note("Frost charm added", "good"); } });
      }
    });
  }

  let cloud = null;
  let cloudSt = { mode: "connecting", reason: "", at: 0, who: null };
  const web = window.OrchardWeb || null;
  const WEB_GAP = 30000;
  const GLOGO = '<svg class="i glogo" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.6 12.3c0-.8-.1-1.5-.2-2.3H12v4.3h5.9a5 5 0 0 1-2.2 3.3v2.8h3.6c2.1-1.9 3.3-4.8 3.3-8.1z"/><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.8c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.6H2.1v2.9A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.8 14a6.6 6.6 0 0 1 0-4.2V7H2.1a11 11 0 0 0 0 9.9z"/><path fill="#EA4335" d="M12 5.4c1.6 0 3 .6 4.2 1.6l3.1-3.1A11 11 0 0 0 2.1 7l3.7 2.9C6.7 7.3 9.1 5.4 12 5.4z"/></svg>';
  const CLOUD_TEXT = { connecting: "Connecting", synced: "Synced", saving: "Saving", local: "This device", readonly: "This device", offline: "Offline", error: "Sync problem" };
  function cloudChip() {
    const s = cloudSt, on = s.mode === "synced" || s.mode === "saving" || s.mode === "connecting";
    const title = "Cloud save: " + (CLOUD_TEXT[s.mode] || s.mode) + (s.reason ? ". " + s.reason : "");
    return `<button class="chip cloud ${esc(s.mode)}" data-a="cloud" type="button" title="${esc(title)}" aria-label="${esc(title)}">${ic(on ? "cloud" : "cloudoff")}<i class="cdot"></i></button>`;
  }
  function ago(t) {
    if (!t) return "";
    const s = Math.round((Date.now() - t) / 1000);
    if (s < 45) return "just now";
    if (s < 3600) return Math.round(s / 60) + " min ago";
    return new Date(t).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  function refreshCloudUi() {
    if (screen === "hub") refreshChips();
    const c = $("#cloudCard");
    if (c) renderCloudCard(c);
  }
  const cloudLabel = (s) => s.mode === "synced" ? `Synced ${ago(s.at)}` : s.mode === "saving" ? "Saving to the cloud" : s.mode === "connecting" ? "Connecting to the cloud" : s.reason || CLOUD_TEXT[s.mode];
  function renderCloudCard(c) {
    if (web) return renderWebCard(c);
    const s = cloudSt, who = s.who, live = !!cloud && s.mode !== "local" && s.mode !== "readonly";
    const label = cloudLabel(s);
    c.innerHTML = `<div class="cc-id"><span class="av"></span><div><b class="nm"></b><span class="muted st"><i class="cdot ${esc(s.mode)}"></i><span></span></span></div></div>
      <p class="muted cc-note">${live ? "Progress, stars, trophies, nectar and your look follow you to any device where you open this page signed in. Sound levels stay per device." : "Your progress is saved in this browser. Open this page on claude.ai while signed in, with permission to save, to carry it across devices."}</p>
      <div class="row"><button class="btn small" type="button" data-c="sync" ${live ? "" : "disabled"}>${ic("sync")}Sync now</button><button class="btn small" type="button" data-c="export">${ic("down")}Download save</button><button class="btn small" type="button" data-c="import">${ic("up")}Load a save file</button><input type="file" accept=".json,application/json" hidden data-c="file"></div>`;
    $(".nm", c).textContent = who && who.name ? who.name : live ? "Your orchard" : "Saved on this device";
    $(".st span", c).textContent = label;
    const av = $(".av", c);
    if (who && who.avatarUrl) { const img = document.createElement("img"); img.alt = ""; img.src = who.avatarUrl; av.appendChild(img); }
    else av.innerHTML = ic(live ? "cloud" : "cloudoff");
  }
  function renderWebCard(c) {
    const s = cloudSt, a = web.account(), live = !!a && !!cloud && s.mode !== "local" && s.mode !== "readonly";
    const signBtn = web.available() ? `<button class="btn small primary" type="button" data-c="signin" ${web.busy() || !web.known() ? "disabled" : ""}>${GLOGO}${web.busy() ? "Signing in" : "Sign in with Google"}</button>` : "";
    const fileBtns = `<button class="btn small" type="button" data-c="export">${ic("down")}Download save</button><button class="btn small" type="button" data-c="import">${ic("up")}Load a save file</button><input type="file" accept=".json,application/json" hidden data-c="file">`;
    c.innerHTML = `<div class="cc-id"><span class="av"></span><div><b class="nm"></b><span class="muted em"></span><span class="muted st"><i class="cdot ${esc(s.mode)}"></i><span></span></span></div></div>
      <p class="muted cc-note">${a ? "Progress, stars, trophies, nectar and your look follow your Google account to any device. Sound levels stay per device. Signing out keeps this device's save." : "Your progress is saved in this browser. Sign in with Google to back it up and carry it to other devices. What you've played here is merged in, nothing is lost."}</p>
      <div class="row">${a ? `<button class="btn small" type="button" data-c="sync" ${live ? "" : "disabled"}>${ic("sync")}Sync now</button>${fileBtns}<button class="btn small ghost" type="button" data-c="signout">Sign out</button>` : signBtn + fileBtns}</div>`;
    $(".nm", c).textContent = a ? a.name || a.email || "Your orchard" : "Saved on this device";
    $(".em", c).textContent = a ? a.email : "";
    $(".em", c).hidden = !a || !a.email;
    $(".st span", c).textContent = a ? cloudLabel(s) : web.known() ? s.reason || "Not signed in" : "Checking sign-in";
    const av = $(".av", c);
    if (a && a.photo) { const img = document.createElement("img"); img.alt = ""; img.referrerPolicy = "no-referrer"; img.src = a.photo; av.appendChild(img); }
    else av.innerHTML = ic(live ? "cloud" : "cloudoff");
  }
  function webTitle() {
    const b = $("#webSign");
    if (!b) return;
    b.hidden = !web.known() || !web.available() || !!web.account();
    b.disabled = web.busy();
  }
  function webSignIn() {
    if (!web || web.busy()) return;
    web.signIn().catch((e) => {
      const c = (e && e.code) || "";
      if (c !== "auth/popup-closed-by-user" && c !== "auth/cancelled-popup-request") note(`Sign-in didn't finish${c ? ` (${c})` : ""}. Try again.`, "bad");
    });
  }
  function onWeb(kind, err) {
    if (kind === "auth") {
      if (cloud) cloud.restart();
      const a = web.account();
      note(a ? `Signed in as ${a.email || a.name}` : "Signed out. Your progress stays on this device.", a ? "good" : "info");
    }
    if (kind === "error" && err && err.code) note(`Sign-in didn't finish (${err.code}). Try again.`, "bad");
    refreshCloudUi();
    webTitle();
  }
  function wireCloudCard(c) {
    c.addEventListener("click", (e) => {
      const b = e.target.closest("[data-c]");
      if (!b) return;
      if (b.dataset.c === "signin") webSignIn();
      if (b.dataset.c === "signout" && web) Promise.resolve(cloud && cloud.flush()).then(() => web.signOut()).catch(() => note("Couldn't sign out. Try again.", "bad"));
      if (b.dataset.c === "sync" && cloud) { cloud.syncNow(); note("Syncing", "info"); }
      if (b.dataset.c === "export") exportSave();
      if (b.dataset.c === "import") $("[data-c=file]", c).click();
    });
    c.addEventListener("change", (e) => {
      const f = e.target.closest("[data-c=file]");
      if (f && f.files && f.files[0]) importSave(f.files[0]);
      if (f) f.value = "";
    });
  }
  async function exportSave() {
    if (!window.OrchardCloud) return;
    const data = JSON.stringify({ format: "orbit-orchard-save", version: 2, exportedAt: new Date().toISOString(), save: window.OrchardCloud.toWire(S) });
    const name = `orbit-orchard-save-${dayKey()}.json`;
    let dl = null;
    try { dl = window.claude && typeof window.claude.use === "function" ? await window.claude.use("downloads") : null; } catch (e) { dl = null; }
    if (dl) {
      try { await dl.save({ filename: name, data }); note("Save file downloaded", "good"); }
      catch (e) { if (!e || e.code !== "declined") note("The save file couldn't be downloaded here", "bad"); }
      return;
    }
    try {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([data], { type: "application/json" }));
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } catch (e) { note("The save file couldn't be downloaded here", "bad"); }
  }
  function cleanWallet(w) {
    w = w && typeof w === "object" ? w : {};
    const fixed = { clear: NECTAR.clear, star2: NECTAR.star2, star3: NECTAR.star3, golden: NECTAR.golden, par: NECTAR.par, daily: NECTAR.daily, ach: NECTAR.ach, week: WEEK_BONUS };
    const earnIn = w.earn && typeof w.earn === "object" ? w.earn : {}, earnOut = {};
    Object.keys(earnIn).forEach((k) => {
      const pre = k.split(":")[0], v = earnIn[k];
      const ok = pre in fixed ? v === fixed[pre]
        : pre === "login" ? Number.isInteger(v) && v >= 10 && v <= 20
        : pre === "tro" ? ACH.some((a) => "tro:" + a.id === k && a.nectar - NECTAR.ach === v)
        : pre === "chal" ? /^chal:\d{8}:[1-9]$/.test(k) && +k.slice(-1) <= CHAL_CAP && v === CHAL_PAY
        : pre === "zen" && /^zen:\d{8}:[1-9]$/.test(k) && +k.slice(-1) <= ZEN_CAP && ZEN_PAY.includes(v);
      if (ok) earnOut[k] = v;
    });
    const pick = (o, ok) => { const r = {}; Object.keys(o && typeof o === "object" ? o : {}).forEach((k) => { if (ok(k, o[k])) r[k] = o[k]; }); return r; };
    return {
      earn: earnOut,
      spend: pick(w.spend, (k, v) => typeof v === "number" && v > 0 && /^(oracle|glimpse|trail|charm|seed|pot|decor|banner|badge|fert):/.test(k) && (k.indexOf("fert:") !== 0 || /^fert:[a-z]+:[1-9]$/.test(k) && +k.slice(-1) <= FERT_MAX)),
      frost: pick(w.frost, (k) => /^\d{8}$/.test(k))
    };
  }
  function importSave(file) {
    const rd = new FileReader();
    rd.onload = () => {
      let d = null;
      try { d = JSON.parse(rd.result); } catch (e) { d = null; }
      if (!d || d.format !== "orbit-orchard-save" || !d.save || typeof d.save !== "object" || Array.isArray(d.save) || !window.OrchardCloud) { note("That isn't an Orbit Orchard save file", "bad"); return; }
      const C = window.OrchardCloud;
      const w = Object.assign({}, d.save, { gen: S.sync.gen || 0, wallet: cleanWallet(d.save.wallet) });
      const stars0 = WORLDS.reduce((n, x) => n + worldStars(x), 0), nec0 = nectar();
      adoptSave(C.fromWire(C.merge(C.toWire(S), w), S));
      const ds = WORLDS.reduce((n, x) => n + worldStars(x), 0) - stars0, dn = nectar() - nec0;
      note(ds || dn ? `Save merged: +${ds} stars, ${dn < 0 ? "−" : "+"}${Math.abs(dn)} nectar` : "Save merged, nothing new in it", "good");
    };
    rd.readAsText(file);
  }
  function adoptSave(n) {
    S = n;
    restar();
    backfillNectar();
    realUnlockedList().forEach((i) => { S.announced[WORLDS[i].id] = 1; });
    save(true);
    applyAllSettings();
    checkAch(true);
    renderFlourish();
    if (screen === "hub" && !stack.length) rerender();
    else refreshChips();
  }

  let cur = null;
  let hudState = {};
  let paused = false;
  function playLevel(wi, j) {
    const w = WORLDS[wi], lv = levelsOf(w)[j];
    if (!lv) return;
    journeyWorld = wi;
    cur = { mode: "journey", w, wi, li: j, level: lv };
    startCur();
  }
  function startCur(noIntro) {
    closeAllModals();
    stopPanelLoops();
    cur.finished = false;
    if (cur.mode !== "journey" || levelUnlocked(cur.wi, cur.li, true)) discover(cur.level);
    checkAch();
    showScreen("game");
    const g = $("#scr-game");
    if (cur.w) setWorldVars(g, cur.w);
    setHudIdentity();
    const lv = cur.level;
    cur.demo = null;
    $("#demoBar").hidden = true;
    $("#hGuide").hidden = true;
    eng("setGuides", null);
    Object.assign(cur, { launched: false, guided: false, assisted: !!S.settings.assist });
    hudState = { seedsLeft: lv.seeds, seeds: cur.mode === "zen" ? Infinity : lv.seeds, used: 0, par: lv.par, starAt: starAt(lv), pollenGot: 0, pollenTotal: (lv.pollen || []).length, sown: 0, needTotal: (lv.bodies || []).filter((b) => b.kind === "fertile").reduce((n, b) => n + (b.need || 1), 0) };
    podCount = -1;
    renderHud({});
    eng("loadLevel", lv, { world: cur.w, mode: cur.mode });
    aud("music", cur.mode === "journey" ? (cur.w ? cur.w.id : 1) : "zen");
    if (!window.Orchard) toastGame("The game engine isn't loaded", "bad");
    requestAnimationFrame(measureHud);
    if (!noIntro) openIntro();
  }
  function setHudIdentity() {
    const lv = cur.level;
    $("#hWorld").textContent = cur.mode === "journey" ? (cur.w ? cur.w.name : "") : cur.mode === "daily" ? "Daily Sky" : cur.mode === "challenge" ? "Challenge" : "Zen Garden";
    $("#hPlot").textContent = cur.mode === "journey" ? levelPlotLabel(cur.li) : cur.mode === "daily" ? prettyDay(cur.key) : cur.mode === "challenge" ? `${DIFF[cur.diff - 1] || ""} sky, seed ${cur.seed}` : `Seed ${cur.seed}`;
    $("#hName").textContent = lv.name || "";
    $("#hPar").hidden = cur.mode === "zen";
  }
  function measureHud() {
    const h = $("#hud");
    if (!h || screen !== "game") return;
    const b = h.getBoundingClientRect();
    root.style.setProperty("--hud-h", Math.round(b.height) + "px");
    const narrow = window.innerWidth <= 720, tall = window.innerHeight > window.innerWidth;
    eng("setViewInsets", { top: Math.round(b.bottom + 6), right: 0, bottom: narrow ? (tall ? 34 : 0) : 36, left: 0 });
  }
  let podCount = -1;
  function renderHud(prev) {
    const h = hudState;
    const pods = $("#hPods");
    const fin = isFinite(h.seeds) && h.seeds > 0 && h.seeds <= 24;
    if (fin) {
      if (podCount !== h.seeds) { pods.innerHTML = Array.from({ length: h.seeds }, () => '<span class="pod"></span>').join(""); podCount = h.seeds; }
      const used = h.seeds - (h.seedsLeft != null ? h.seedsLeft : h.seeds);
      $$(".pod", pods).forEach((p, i) => {
        const spent = i >= h.seeds - used;
        if (spent && !p.classList.contains("spent")) { p.classList.add("spent"); if (prev.seedsLeft != null) { p.classList.remove("pop"); void p.offsetWidth; p.classList.add("pop"); } }
        else if (!spent) p.classList.remove("spent");
      });
      pods.setAttribute("aria-label", `${h.seedsLeft} of ${h.seeds} seeds left`);
    } else {
      podCount = -1;
      pods.textContent = isFinite(h.seeds) ? `${h.seedsLeft} seeds left` : `∞ seeds, ${h.used || 0} sown`;
    }
    const setStat = (id, text, bumpIf) => {
      const el = $(id), b = $("b", el);
      if (b.textContent !== text) { b.textContent = text; if (bumpIf) { el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); } }
    };
    setStat("#hSown", `${h.sown || 0}/${h.needTotal || 0}`, prev.sown != null && h.sown > prev.sown);
    $("#hSown").classList.toggle("done", h.needTotal > 0 && h.sown >= h.needTotal);
    setStat("#hPar", h.starAt ? "≤ " + h.starAt[0] : "–", false);
    $("#hPollen").hidden = !h.pollenTotal;
    setStat("#hPollen", `${h.pollenGot || 0}/${h.pollenTotal || 0}`, prev.pollenGot != null && h.pollenGot > prev.pollenGot);
    const ro = $("#hReadout");
    if (h.aimDeg != null || h.power != null) {
      ro.innerHTML = `<span>aim ${(h.aimDeg != null ? h.aimDeg : 0).toFixed(1)}°</span><span class="lbl">power</span><span class="pw" style="--p:${Math.round((h.power || 0) * 100)}%"><i></i></span><span>${Math.round((h.power || 0) * 100)}%</span>${h.fast ? `<span class="ff">${h.demo ? "fast-forward" : "3× speed"}</span>` : ""}`;
    } else ro.innerHTML = "";
  }
  function onHud(h) {
    if (!h || screen !== "game") return;
    const prev = Object.assign({}, hudState);
    hudState = Object.assign({}, hudState, h);
    if (cur && !cur.demo && prev.used > 0 && h.used === 0) newAttempt();
    renderHud(prev);
  }

  function mechChips(lv) {
    return kindsOf(lv).map((k) => `<span>${ic(k)}${esc(almanacName(k))}</span>`).join("");
  }
  function openIntro() {
    const lv = cur.level;
    eng("setPaused", true);
    const where = esc(cur.mode === "zen" ? `Zen Garden, ${DIFF[(cur.diff || 3) - 1].toLowerCase()} sky` : placeLabel());
    const pc = (lv.pollen || []).length;
    const m = openModal({
      cls: "intro", label: lv.name, style: cur.w ? worldColorVars(cur.w) : "",
      html: `<div class="eyebrow">${where}</div><h2>${esc(lv.name)}</h2>
        ${lv.hint ? `<p class="hint">${esc(lv.hint)}</p>` : ""}
        <dl class="rfacts">${cur.mode !== "zen" ? `<div><dt>3 stars</dt><dd>≤ ${starAt(lv)[0]}</dd></div><div><dt>Par</dt><dd>${lv.par}</dd></div><div><dt>Seeds</dt><dd>${lv.seeds}</dd></div>` : `<div><dt>Seeds</dt><dd>∞</dd></div>`}${pc ? `<div><dt>Pollen</dt><dd>${pc}</dd></div>` : ""}</dl>
        <div class="mechs">${mechChips(lv)}</div>
        ${oracleRow(true)}
        <div class="row"><button class="btn primary" type="button" data-a="go" autofocus>${ic("play")}Start sowing <kbd>Space</kbd></button>${cur.mode === "journey" ? `<button class="btn ghost" type="button" data-a="quit">World map</button>` : ""}</div>`,
      onKey: (e) => {
        if (e.key === " " || e.key === "Enter") { m.close("go"); return true; }
        return false;
      },
      onClose: (why) => {
        if (why === "quit") return;
        eng("setPaused", false);
        paused = false;
        setTimeout(maybeCoach, reduced() ? 0 : 200);
      }
    });
    m.el.addEventListener("click", (e) => {
      if (onOracleClick(e)) return;
      if (e.target.closest("[data-a=quit]")) { m.close("quit"); quitToMenu(); return; }
      if (e.target.closest(".oracle-row")) return;
      m.close("go");
    });
  }
  function openPause() {
    if (stack.length || !cur) return;
    paused = true;
    eng("setPaused", true);
    const m = openModal({
      cls: "", label: "Paused",
      html: `<div class="eyebrow">${esc(placeLabel())}</div><h2>Paused</h2><p>${esc(cur.level.name || "")}</p>
        <div class="row" style="flex-direction:column;align-items:stretch">
          <button class="btn primary" type="button" data-a="resume" autofocus>${ic("play")}Resume <kbd>Esc</kbd></button>
          <button class="btn" type="button" data-a="restart">${ic("restart")}Replant <kbd>R</kbd></button>
          ${guidesOn() ? `<button class="btn" type="button" data-a="noguides">${ic("restart")}Replant without guides</button>` : ""}
          ${canBuySeed() ? `<button class="btn" type="button" data-a="seed">${ic("seed")}One more seed ${nectarAmt(SEED_COST)}</button>` : ""}
          <button class="btn" type="button" data-a="settings">${ic("gear")}Settings</button>
          <button class="btn ghost" type="button" data-a="quit">${ic("back")}${cur.mode === "journey" ? "Quit to world map" : "Quit to menu"}</button>
        </div>${oracleRow()}`,
      onKey: (e) => {
        if (e.key === "p" || e.key === "P") { m.close("resume"); return true; }
        if (e.key === "r" || e.key === "R") { m.close("restart"); restart(); return true; }
        return false;
      },
      onClose: (why) => {
        if (why === "quit") return;
        paused = false;
        eng("setPaused", false);
      }
    });
    m.el.addEventListener("click", (e) => {
      if (onOracleClick(e)) return;
      const a = e.target.closest("[data-a]");
      if (!a) return;
      const k = a.dataset.a;
      if (k === "seed") { if (!m.closed && buySeed()) m.close("resume"); }
      if (k === "resume") m.close("resume");
      if (k === "restart") { m.close("restart"); restart(); }
      if (k === "noguides") { m.close("restart"); dropGuides(); }
      if (k === "settings") openQuickSettings();
      if (k === "quit") { m.close("quit"); quitToMenu(); }
    });
  }
  function openQuickSettings() {
    const m = openModal({ cls: "wide", label: "Settings", html: `<h2>Settings</h2><div id="qs"></div><div class="row"><button class="btn primary" type="button" data-a="done">Done</button></div>` });
    renderSettings($("#qs", m.el), true);
    m.el.addEventListener("click", (e) => { if (e.target.closest("[data-a=done]")) m.close("done"); });
  }
  function newAttempt() {
    if (!cur) return;
    if (cur.launched && cur.mode === "journey") replants[cur.level.id] = (replants[cur.level.id] || 0) + 1;
    cur.launched = false;
    cur.guided = guidesOn();
    cur.assisted = !!S.settings.assist;
  }
  function restart() {
    if (!cur) return;
    cur.finished = false;
    closeCoach();
    eng("restart");
    newAttempt();
    const lv = cur.level;
    hudState = Object.assign({}, hudState, { seedsLeft: lv.seeds, used: 0, sown: 0, pollenGot: 0 });
    renderHud({});
  }
  function dropGuides() {
    eng("setGuides", null);
    $("#hGuide").hidden = true;
    restart();
  }
  function quitToMenu() {
    closeAllModals();
    if (cur && cur.demo) { cur.demo = null; eng("stopDemo"); }
    eng("setGuides", null);
    paused = false;
    eng("setPaused", false);
    const mode = cur ? cur.mode : "journey";
    const wi = cur && cur.mode === "journey" ? cur.wi : null;
    cur = null;
    if (mode === "journey") { enterHub({ tab: "journey", world: wi }); eng("showcase", wi != null ? WORLDS[wi] : null); }
    else enterHub({ tab: mode === "daily" ? "daily" : mode === "challenge" ? "friends" : "zen" });
  }

  function computeStars(used, at) { return used <= at[0] ? 3 : used <= at[1] ? 2 : 1; }
  function fmtSecs(s) { s = Math.max(0, Math.round(s || 0)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); }
  function popStars(box, n, after) {
    const svgs = $$("svg", box);
    let i = 0;
    const step = () => {
      if (i >= n) { if (after) after(); return; }
      const s = svgs[i];
      s.classList.add("on", "pop");
      i++;
      sfx("star", { n: i });
      setTimeout(step, reduced() ? 120 : 340);
    };
    setTimeout(step, reduced() ? 60 : 380);
  }
  function onWin(p) {
    if (!cur || cur.finished) return;
    p = p || {};
    if (cur.mode === "daily" || String(p.levelId || "").indexOf("daily-") === 0) return onDailyDone(p);
    if (cur.mode === "challenge") return onChallengeDone(p);
    if (cur.mode !== "journey") return onZenDone(p);
    cur.finished = true;
    closeCoach();
    const lv = cur.level, id = lv.id;
    const used = p.used != null ? p.used : hudState.used || 0;
    const par = p.par != null ? p.par : lv.par, at = p.starAt || starAt(lv);
    const guided = !!(cur.guided || guidesOn()), assisted = !!(cur.assisted || S.settings.assist);
    const stars = Math.min(clamp(p.stars || computeStars(used, at), 1, 3), guided ? 2 : 3);
    const golden = !guided && (p.pollenTotal || 0) > 0 && p.pollenGot >= p.pollenTotal;
    const before = realUnlockedList();
    const r = S.levels[id] || { stars: 0, golden: false, best: null, time: null, clears: 0 };
    const newBest = !guided && (r.best == null || used < r.best);
    const firstGolden = golden && !r.golden;
    const hadPerfect = perfectOn(id), perfect = !guided && used <= par;
    r.stars = Math.max(r.stars || 0, stars);
    r.golden = !!(r.golden || golden);
    if (!guided) {
      r.best = r.best == null ? used : Math.min(r.best, used);
      if (p.time != null) r.time = r.time == null ? p.time : Math.min(r.time, p.time);
    }
    r.clears = (r.clears || 0) + 1;
    S.levels[id] = r;
    S.stats.wins++;
    if (!guided && (S.fails[id] || 0) >= 3) S.stats.stubborn = 1;
    if (!guided && used >= lv.seeds) S.stats.lastSeed = 1;
    const after = realUnlockedList();
    const fresh = after.filter((i) => !before.includes(i) && !S.announced[WORLDS[i].id]);
    fresh.forEach((i) => { S.announced[WORLDS[i].id] = 1; });
    const gained = levelRewards(id);
    const tip = gained > 0 && !S.coach.nectarTip;
    if (tip) S.coach.nectarTip = 1;
    save(true);
    checkAch();
    sfx("win", { stars });
    const L = levelsOf(cur.w), hasNext = cur.li + 1 < L.length;
    const title = stars === 3 ? "Full bloom" : stars === 2 ? "In bloom" : "Sprouted";
    const tags = (guided ? `<span class="rtag">${ic("eye")}Guided</span>` : "") + (assisted ? `<span class="rtag">Assist</span>` : "");
    const line = guided ? "Guided clear. Sow it without guides for three stars."
      : stars < 3 ? `Clear it in ${at[0]} seeds or fewer for three stars.`
      : used <= par ? "Every seed found its soil."
      : hadPerfect ? `Par is ${par} seed${par === 1 ? "" : "s"}, if you fancy a perfect run.`
      : `Clear it in par, ${par} seed${par === 1 ? "" : "s"}, for a Perfect mark and +${NECTAR.par} nectar.`;
    const m = openModal({
      cls: "", label: title, style: worldColorVars(cur.w),
      html: `<div class="eyebrow">${esc(placeLabel())}${tags}</div><h2>${title}</h2>
        <div class="rstars" id="rstars">${star(false)}${star(false)}${star(false)}</div>
        <div id="goldSlot" class="rbadges"></div>
        <dl class="rfacts"><div><dt>Seeds</dt><dd>${used}<small class="muted" style="font-size:13px"> / ${at[0]} for 3★</small></dd></div><div><dt>Time</dt><dd>${fmtSecs(p.time)}</dd></div><div><dt>Pollen</dt><dd>${p.pollenTotal ? `${p.pollenGot}/${p.pollenTotal}` : "none"}</dd></div></dl>
        ${newBest && r.clears > 1 ? `<span class="newbest">New best: ${used} seeds</span>` : ""}
        ${gained ? `<span class="nectar-gain">${ic("nectar")}+${gained} nectar</span>` : ""}
        ${tip ? `<div class="ntip">${ic("nectar")}<p><b>Your garden makes nectar.</b> Clears, stars, golden pollen, trophies, the Daily Sky and daily visits all fill your pouch. Spend it in the Market on the Oracle, spare seeds, seed trails and the Greenhouse.</p></div>` : ""}
        <p>${line}</p>
        <div class="row">
          ${guided ? `<button class="btn primary" type="button" data-a="again" autofocus>${ic("restart")}Replant without guides <kbd>R</kbd></button>` : ""}
          ${hasNext ? `<button class="btn${guided ? "" : " primary"}" type="button" data-a="next" ${guided ? "" : "autofocus"}>${ic("next")}Next plot <kbd>N</kbd></button>` : `<button class="btn${guided ? "" : " primary"}" type="button" data-a="map" ${guided ? "" : "autofocus"}>${ic("map")}World map</button>`}
          ${guided ? "" : `<button class="btn" type="button" data-a="again">${ic("restart")}Replant <kbd>R</kbd></button>`}
          ${hasNext ? `<button class="btn ghost" type="button" data-a="map">World map</button>` : ""}
        </div>`,
      dismissable: false,
      onKey: (e) => {
        const k = e.key.toLowerCase();
        if (k === "n" && hasNext) { act("next"); return true; }
        if (k === "r") { act("again"); return true; }
        if (e.key === "Escape") { act("map"); return true; }
        return false;
      }
    });
    const act = (a) => {
      if (a === "next") { if (levelUnlocked(cur.wi, cur.li + 1)) playLevel(cur.wi, cur.li + 1); else quitToMenu(); }
      else if (a === "again") { m.close("again"); if (guided) dropGuides(); else restart(); }
      else if (a === "map") quitToMenu();
    };
    m.el.addEventListener("click", (e) => { const a = e.target.closest("[data-a]"); if (a) act(a.dataset.a); });
    popStars($("#rstars", m.el), stars, () => {
      if (golden) {
        $("#goldSlot", m.el).insertAdjacentHTML("beforeend", `<span class="golden"><i></i>${firstGolden ? "Golden pollen, new badge" : "Golden pollen"}</span>`);
        sfx("golden");
      }
      if (perfect) $("#goldSlot", m.el).insertAdjacentHTML("beforeend", `<span class="perfect">${ic("check")}${hadPerfect ? "Perfect" : "Perfect, new mark"}</span>`);
      if (fresh.length) setTimeout(() => celebrate(fresh[0]), reduced() ? 100 : 700);
    });
  }
  function realUnlockedList() { return WORLDS.map((_, i) => i).filter((i) => realUnlocked(i)); }
  function celebrate(i) {
    const w = WORLDS[i];
    if (!w) return;
    sfx("unlock");
    const petals = reduced() ? "" : Array.from({ length: 26 }, (_, k) => `<span class="petal" style="left:${(k * 37) % 100}%;background:${[theme(w).accent, theme(w).nebula, theme(w).glow][k % 3]};--dx:${((k * 53) % 120) - 60}px;animation-delay:${(k % 9) * 0.12}s"></span>`).join("");
    const m = openModal({
      cls: "unlock-modal", label: `${w.name} is open`, style: worldColorVars(w),
      html: `${petals}${planetHtml(w, 0)}<div class="eyebrow">World ${i + 1} unlocked</div><h2>${esc(w.name)} is open</h2><p>${esc(w.blurb || "")}</p>
        <div class="row" style="justify-content:center"><button class="btn primary" type="button" data-a="visit" autofocus>${ic("route")}Visit ${esc(w.name)}</button><button class="btn" type="button" data-a="stay">Keep going</button></div>`
    });
    m.el.addEventListener("click", (e) => {
      const a = e.target.closest("[data-a]");
      if (!a) return;
      if (a.dataset.a === "visit") { closeAllModals(); cur = null; enterHub({ tab: "journey", world: i }); eng("showcase", w); }
      else m.close("stay");
    });
  }
  function onLose(p) {
    if (!cur || cur.finished) return;
    cur.finished = true;
    closeCoach();
    p = p || {};
    S.stats.losses++;
    if (cur.mode === "journey") S.fails[cur.level.id] = (S.fails[cur.level.id] || 0) + 1;
    cur.launched = false;
    save();
    sfx("lose");
    const revivable = canBuySeed() && (p.reason == null || p.reason === "seeds");
    const m = openModal({
      cls: "", label: "Out of seeds", dismissable: false,
      html: `<div class="eyebrow">${esc(placeLabel())}</div><h2>Out of seeds</h2>
        <p>${p.needTotal ? `You sowed ${p.sown || 0} of ${p.needTotal}. ` : ""}${esc(cur.level.hint || "Try a different line.")}</p>
        <div class="row"><button class="btn primary" type="button" data-a="again" autofocus>${ic("restart")}Replant <kbd>R</kbd></button>${revivable ? `<button class="btn" type="button" data-a="seed">${ic("seed")}Keep going, +1 seed ${nectarAmt(SEED_COST)}</button>` : ""}<button class="btn ghost" type="button" data-a="quit">${cur.mode === "journey" ? "World map" : "Menu"}</button></div>
        ${oracleRow()}`,
      onKey: (e) => {
        if (e.key === "r" || e.key === "R") { m.close("again"); restart(); return true; }
        if (e.key === "Escape") { quitToMenu(); return true; }
        return false;
      }
    });
    m.el.addEventListener("click", (e) => {
      if (onOracleClick(e)) return;
      const a = e.target.closest("[data-a]");
      if (!a) return;
      if (a.dataset.a === "seed") { if (m.closed) return; cur.finished = false; if (buySeed()) m.close("seed"); else cur.finished = true; return; }
      if (a.dataset.a === "again") { m.close("again"); restart(); }
      else quitToMenu();
    });
  }
  function onDailyDone(p) {
    if (!cur || cur.finished || cur.mode !== "daily") return;
    cur.finished = true;
    closeCoach();
    const k = cur.key, lv = cur.level;
    const used = p.used != null ? p.used : hudState.used || 0;
    const par = p.par != null ? p.par : lv.par || used, at = p.starAt || starAt(lv);
    const stars = clamp(p.stars || computeStars(used, at), 1, 3);
    const pg = p.pollenGot != null ? p.pollenGot : hudState.pollenGot || 0, pt = p.pollenTotal != null ? p.pollenTotal : hudState.pollenTotal || 0;
    const old = S.daily.days[k], assisted = !!(cur.assisted || S.settings.assist), first = !old;
    const run = Object.assign({ stars, used, pollenGot: pg }, assisted ? { assist: true } : {});
    let improved = false;
    if (first) S.daily.days[k] = Object.assign({ stars, used, par, pollenGot: pg, pollenTotal: pt, at: Date.now() }, assisted ? { assist: true } : {});
    else if (betterRun(run, old.best || old)) { old.best = run; improved = true; }
    const off = S.daily.days[k];
    if (S.daily.last !== k) {
      S.daily.streak = S.daily.last === dayShift(k, -1) ? (S.daily.streak || 0) + 1 : 1;
      S.daily.last = k;
      S.daily.best = Math.max(S.daily.best || 0, S.daily.streak);
    }
    S.stats.daily++;
    const dGain = earn("daily:" + k, NECTAR.daily);
    if (dGain) setTimeout(() => nectarPop(dGain, "Daily Sky"), 1200);
    const keys = Object.keys(S.daily.days).sort();
    while (keys.length > 60) delete S.daily.days[keys.shift()];
    save(true);
    checkAch();
    sfx("win", { stars });
    const m = openModal({
      cls: "", label: "Daily Sky sown", dismissable: false,
      html: `<div class="eyebrow">${esc(placeLabel())}${first ? "" : `<span class="rtag">Practice</span>`}${assisted ? `<span class="rtag">Assist</span>` : ""}</div><h2>${first ? "Sky sown" : "Practice run"}</h2>
        <div class="rstars" id="rstars">${star(false)}${star(false)}${star(false)}</div>
        <dl class="rfacts"><div><dt>Seeds</dt><dd>${used}<small class="muted" style="font-size:13px"> / ${at[0]} for 3★</small></dd></div><div><dt>Streak</dt><dd>${S.daily.streak}</dd></div><div><dt>Pollen</dt><dd>${pt ? `${pg}/${pt}` : "none"}</dd></div></dl>
        ${first ? `<p class="muted small">This first run is today's official result.</p>` : `<p class="muted small">Today's official run stays ${miniStars(off.stars)} in ${off.used} seed${off.used === 1 ? "" : "s"}.${improved ? "" : " Replays only keep a best."}</p>${improved ? `<span class="newbest">New best replay: ${used} seed${used === 1 ? "" : "s"}</span>` : ""}`}
        <div class="share"><textarea id="dShare" readonly rows="6" aria-label="Share text">${esc(shareText(k))}</textarea></div>
        <div class="row"><button class="btn primary" type="button" data-a="copy" autofocus>${ic("copy")}Copy result</button><button class="btn" type="button" data-a="again">${ic("restart")}Replay</button><button class="btn ghost" type="button" data-a="quit">Menu</button></div>`,
      onKey: (e) => {
        if (e.key === "r" || e.key === "R") { m.close("again"); restart(); return true; }
        if (e.key === "Escape") { quitToMenu(); return true; }
        return false;
      }
    });
    m.el.addEventListener("click", (e) => {
      const a = e.target.closest("[data-a]");
      if (!a) return;
      if (a.dataset.a === "copy") copyBox(a, $("#dShare", m.el));
      else if (a.dataset.a === "again") { m.close("again"); restart(); }
      else quitToMenu();
    });
    popStars($("#rstars", m.el), stars);
  }
  function onZenDone(p) {
    if (!cur || cur.finished) return;
    if (cur.mode === "daily") return onDailyDone(p || {});
    if (cur.mode !== "zen") return;
    cur.finished = true;
    closeCoach();
    S.stats.zen++;
    const zGain = zenReward(cur.diff), left = zenLeft();
    save(true);
    checkAch();
    sfx("win", { stars: 3 });
    if (zGain) setTimeout(() => nectarPop(zGain, "Zen sky"), reduced() ? 200 : 900);
    const used = p && p.used != null ? p.used : hudState.used || 0;
    const m = openModal({
      cls: "", label: "Sky sown", dismissable: false,
      html: `<div class="eyebrow">${esc(placeLabel())}</div><h2>Sky sown</h2><p>${used} seed${used === 1 ? "" : "s"} to fill every plot. Share seed <b class="mono">${cur.seed}</b> to give someone this same sky.</p>
        ${zGain ? `<span class="nectar-gain">${ic("nectar")}+${zGain} nectar<small>${left ? `${left} more today` : "last one today"}</small></span>` : `<p class="muted small">Today's Zen nectar is all collected. Skies still grow your Still lotus.</p>`}
        <div class="row"><button class="btn primary" type="button" data-a="new" autofocus>${ic("sky")}New sky <kbd>N</kbd></button><button class="btn" type="button" data-a="again">${ic("restart")}Replant <kbd>R</kbd></button><button class="btn ghost" type="button" data-a="quit">Menu</button></div>`,
      onKey: (e) => {
        const k = e.key.toLowerCase();
        if (k === "n") { S.zen.seed = randSeed(); startZen(); return true; }
        if (k === "r") { m.close("again"); restart(); return true; }
        if (e.key === "Escape") { quitToMenu(); return true; }
        return false;
      }
    });
    m.el.addEventListener("click", (e) => {
      const a = e.target.closest("[data-a]");
      if (!a) return;
      if (a.dataset.a === "new") { S.zen.seed = randSeed(); startZen(); }
      else if (a.dataset.a === "again") { m.close("again"); restart(); }
      else quitToMenu();
    });
  }
  function onSimEvent(ev) {
    if (!ev || !ev.type || !cur) return;
    const t = ev.type, st = S.stats;
    if (t === "plant") {
      st.plants++;
      const fl = theme(cur.w).flora || "daisy";
      S.flora[fl] = (S.flora[fl] || 0) + 1;
    } else if (t === "pollen") st.pollen++;
    else if (st[t] != null && ["burn", "crash", "swallow", "bounce", "warp", "boost", "shield", "lost"].includes(t)) st[t]++;
    save();
    checkAch();
  }
  function onLaunch() {
    if (cur) { cur.launched = true; if (guidesOn()) cur.guided = true; if (S.settings.assist) cur.assisted = true; }
    S.stats.sown++;
    save();
    checkAch();
    if (coach && coach.advanceOnLaunch) coachNext();
  }

  const COACH = {
    "w1-01": [
      { ill: "drag", text: "Press anywhere and pull back, like a slingshot. Let go to sow.", launch: true },
      { ill: "line", text: "The dotted line previews the first part of the flight. Watch how it bends." },
      { ill: "soil", text: "Ringed planets are soil. Sow a seed on every one to finish the plot." }
    ],
    "w1-02": [
      { ill: "rock", text: "Grey rock is barren, but its pull still bends your path. Press G to see the gravity lattice." },
      { ill: "keys", text: "On a keyboard, ← → aims, ↑ ↓ sets power and Space sows. Hold Shift to fine tune." }
    ]
  };
  const COACH_ILL = {
    drag: '<svg class="coach-ill" viewBox="0 0 64 64"><circle cx="40" cy="26" r="7" fill="var(--c-seed)"/><path d="M40 26L26 40" stroke="var(--dim)" stroke-width="2" stroke-dasharray="3 3"/><g class="hand"><circle cx="40" cy="26" r="12" fill="none" stroke="var(--ink2)" stroke-width="2.5"/></g></svg>',
    line: '<svg class="coach-ill" viewBox="0 0 64 64"><path d="M8 52C20 20 40 12 58 16" fill="none" stroke="var(--gold)" stroke-width="3" stroke-dasharray="2 6" stroke-linecap="round"/><circle cx="8" cy="52" r="5" fill="var(--c-seed)"/></svg>',
    soil: '<svg class="coach-ill" viewBox="0 0 64 64"><circle cx="32" cy="32" r="16" fill="var(--c-soil)"/><circle cx="32" cy="32" r="24" fill="none" stroke="var(--c-soil)" stroke-width="2" stroke-dasharray="4 4"/></svg>',
    rock: '<svg class="coach-ill" viewBox="0 0 64 64"><circle cx="34" cy="38" r="16" fill="var(--c-rock)"/><path d="M4 12C30 14 54 30 60 58" fill="none" stroke="var(--dim)" stroke-width="2" stroke-dasharray="2 5"/></svg>',
    keys: '<svg class="coach-ill" viewBox="0 0 64 64" fill="none" stroke="var(--text)" stroke-width="2"><rect x="4" y="34" width="16" height="16" rx="3"/><rect x="24" y="34" width="16" height="16" rx="3"/><rect x="44" y="34" width="16" height="16" rx="3"/><rect x="24" y="14" width="16" height="16" rx="3"/></svg>'
  };
  let coach = null;
  function maybeCoach() {
    if (!cur || cur.mode !== "journey" || screen !== "game" || stack.length || cur.demo) return;
    const steps = COACH[cur.level.id];
    if (!steps || S.coach[cur.level.id]) return;
    coach = { id: cur.level.id, steps, i: 0 };
    renderCoach();
  }
  function renderCoach() {
    const box = $("#coach");
    if (!coach) { box.innerHTML = ""; return; }
    const s = coach.steps[coach.i], last = coach.i === coach.steps.length - 1;
    coach.advanceOnLaunch = !!s.launch;
    box.innerHTML = `<div class="coach-card" role="status">${COACH_ILL[s.ill] || ""}<div><p>${esc(s.text)}</p><div class="row"><span class="steps">${coach.steps.map((_, i) => `<i class="${i === coach.i ? "on" : ""}"></i>`).join("")}</span><button class="btn small" type="button" data-a="coach">${last ? "Got it" : "Next"}</button></div></div></div>`;
    $("[data-a=coach]", box).addEventListener("click", coachNext);
  }
  function coachNext() {
    if (!coach) return;
    coach.i++;
    if (coach.i >= coach.steps.length) { S.coach[coach.id] = 1; save(); coach = null; }
    renderCoach();
  }
  function closeCoach(keep) {
    if (keep && coach) { $("#coach").innerHTML = ""; return; }
    coach = null;
    const b = $("#coach");
    if (b) b.innerHTML = "";
  }

  const isTyping = (t) => t && (t.tagName === "TEXTAREA" || (t.tagName === "INPUT" && t.type !== "range" && t.type !== "checkbox"));
  function onKey(e) {
    if (e.defaultPrevented) return;
    gesture();
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (screen === "title") {
      if (e.key === "Tab" || e.key === "Shift") return;
      if (e.target && e.target.id === "webSign" && (e.key === "Enter" || e.key === " ")) return;
      e.preventDefault();
      enterHub();
      return;
    }
    const top = stack[stack.length - 1];
    if (top) {
      if (e.key === "Tab") { trapTab(e, top.el); return; }
      if (top.onKey && top.onKey(e)) { e.preventDefault(); return; }
      if (e.key === "Escape" && top.dismissable) { e.preventDefault(); top.close("esc"); }
      return;
    }
    if (isTyping(e.target)) return;
    if (e.key === "m" || e.key === "M") { toggleMute(); return; }
    if (screen === "game") {
      if (cur && cur.demo) { if (e.key === "Escape") { e.preventDefault(); endDemo(false); } return; }
      if (e.key === "Escape" || e.key === "p" || e.key === "P") { e.preventDefault(); openPause(); }
      if (!window.Orchard && (e.key === "r" || e.key === "R")) restart();
      return;
    }
    if (screen === "hub") {
      const onTab = e.target && e.target.classList && e.target.classList.contains("tab");
      const onBody = !e.target || e.target === document.body || onTab;
      const isRange = e.target && e.target.type === "range";
      if (new RegExp("^[1-" + TABS.length + "]$").test(e.key) && !isRange) { e.preventDefault(); setTab(TABS[+e.key - 1].id, { focus: true }); return; }
      if ((e.key === "ArrowRight" || e.key === "ArrowLeft") && onBody) {
        e.preventDefault();
        const i = TABS.findIndex((t) => t.id === tab), n = (i + (e.key === "ArrowRight" ? 1 : -1) + TABS.length) % TABS.length;
        setTab(TABS[n].id, { focus: true });
        return;
      }
      if (e.key === "Escape" && tab === "journey" && journeyWorld != null) { journeyWorld = null; eng("showcase", null); renderPanel("in-l"); }
    }
  }

  let lastHover = null, lastHoverT = 0;
  function wireSfx() {
    document.addEventListener("pointerover", (e) => {
      if (e.pointerType !== "mouse") return;
      const b = e.target.closest("button:not(:disabled), .node");
      if (!b || b === lastHover) return;
      lastHover = b;
      const now = performance.now();
      if (now - lastHoverT > 50) { lastHoverT = now; sfx("hover"); }
    });
    document.addEventListener("click", (e) => { if (e.target.closest("button:not(:disabled)")) sfx("click"); });
    document.addEventListener("pointerdown", gesture, { passive: true });
  }

  function fallbackSky(cv) {
    const draw = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
      const c = cv.getContext("2d"), P = readPal();
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.fillStyle = getComputedStyle(root).getPropertyValue("--bg").trim() || "#10142a";
      c.fillRect(0, 0, innerWidth, innerHeight);
      const r = mulberry(7);
      c.fillStyle = P.text;
      for (let i = 0; i < 160; i++) { c.globalAlpha = 0.2 + r() * 0.6; c.fillRect(r() * innerWidth, r() * innerHeight, 1.5, 1.5); }
      c.globalAlpha = 1;
    };
    draw();
    addEventListener("resize", draw);
    new MutationObserver(draw).observe(root, { attributes: true, attributeFilter: ["data-skin"] });
  }

  function wireEngine() {
    const o = window.Orchard;
    if (!o || typeof o.on !== "function") return;
    const on = (n, f) => { try { o.on(n, f); } catch (e) {} };
    on("hud", onHud);
    on("toast", (t) => { if (t && t.text && screen === "game") toastGame(t.text, t.tone); });
    on("win", onWin);
    on("lose", onLose);
    on("zenComplete", (p) => onZenDone(p || {}));
    on("event", onSimEvent);
    on("launch", onLaunch);
    on("demo", onDemo);
    on("settings", (s) => {
      if (!s) return;
      Object.keys(s).forEach((k) => { if (k in S.settings) S.settings[k] = s[k]; });
      save();
      if (s.grid != null) toastGame(s.grid ? "Gravity lattice on" : "Gravity lattice off", "info");
    });
  }

  function boot() {
    readWorlds();
    buildAch();
    keepIdOrderUnlocks();
    realUnlockedList().forEach((i) => { S.announced[WORLDS[i].id] = 1; });
    root.dataset.skin = S.settings.skin;
    root.classList.toggle("rm", !!S.settings.reducedMotion);
    const cv = $("#stage");
    if (hasEng("init")) eng("init", cv); else fallbackSky(cv);
    applyAllSettings();
    wireEngine();
    if (!window.OrchardFriends) { const fi = TABS.findIndex((t) => t.id === "friends"); if (fi >= 0) TABS.splice(fi, 1); }
    buildTitle();
    buildTabs();
    refreshChips();
    wireSfx();
    $("#hRestart").innerHTML = ic("restart");
    $("#hPause").innerHTML = ic("pause");
    $("#hRestart").addEventListener("click", () => { if (stack.length) return; if (cur && cur.demo) endDemo(false); else restart(); });
    $("#hPause").addEventListener("click", openPause);
    $("#hFast").innerHTML = ic("ff");
    $("#hFast").addEventListener("click", (e) => {
      setSetting("fastForward", !S.settings.fastForward);
      syncFast();
      toastGame(S.settings.fastForward ? "Fast-forward on" : "Fast-forward off", "info");
      if (e.detail) e.currentTarget.blur();
    });
    $("#hGuide").innerHTML = ic("eye");
    $("#hGuide").addEventListener("click", () => { if (!stack.length && !eng("snapToGuide")) toastGame("Wait for your turn", "info"); });
    document.addEventListener("keydown", onKey);
    let rt = 0;
    addEventListener("resize", () => {
      clearTimeout(rt);
      rt = setTimeout(() => {
        moveInd();
        if (screen === "game") measureHud();
        if (screen === "hub" && (tab === "journey")) renderPanel("");
      }, 140);
    });
    if (mqReduce.addEventListener) mqReduce.addEventListener("change", () => eng("setSettings", { reducedMotion: reduced() }));
    if (window.ResizeObserver) new ResizeObserver(measureHud).observe($("#hud"));
    setInterval(() => {
      if (screen === "game" && !paused && !stack.length && !document.hidden) {
        S.stats.playMs += 1000;
        if (S.stats.playMs % 15000 === 0) { save(); checkAch(); }
      }
    }, 1000);
    addEventListener("pagehide", () => { save(true); if (cloud) cloud.flush(); });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) { if (cloud) cloud.flush(); return; }
      const v = visitReward();
      if (v) { save(true); nectarPop(v.amt, visitLabel(v)); }
    });
    $("#demoBar").addEventListener("click", (e) => { if (e.target.closest("[data-a=stopdemo]")) endDemo(false); });
    const gained = restar();
    startNectar();
    checkAch(true);
    renderFlourish();
    if (gained) note(`Star targets got friendlier: +${gained} star${gained === 1 ? "" : "s"} from your past clears`, "good");
    if (window.OrchardCloud) cloud = window.OrchardCloud.start({ backend: web, minGap: web ? WEB_GAP : 0, get: () => S, replace: adoptSave, onStatus: (st) => { cloudSt = web ? web.view(st) : st; refreshCloudUi(); if (st.mode !== "connecting" && st.mode !== "saving") frostCheck(); } });
    if (web) web.on(onWeb);
    if (window.OrchardFriends) window.OrchardFriends.init({
      get: () => S, worlds: () => WORLDS, levelsOf, ach: () => ACH, liveStreak, nectar, dayKey, DIFF, CHAL_PAY, CHAL_CAP,
      ic, esc, miniStars, sfx, note, nectarPop, openModal, confirmModal, startChallenge, quitToMenu,
      inGame: () => screen === "game", cloudRetry: () => { if (cloud) cloud.syncNow(); }, web: web ? { signIn: webSignIn, glogo: GLOGO } : null, earn: (k, a) => { const n = earn(k, a); if (n) { save(true); refreshChips(); } return n; }
    });
    else frostCheck();
    eng("showcase", null);
    showScreen("title");
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(moveInd);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
