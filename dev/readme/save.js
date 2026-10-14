(function () {
  var q = new URLSearchParams(location.search);
  if (q.get("sav") === "none") return;
  var DAY = 864e5, NOW = Date.now();
  var seed = 7;
  var rnd = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  var dk = function (n) { var d = new Date(NOW - n * DAY); return d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0"); };
  var W = {};
  (window.ORCHARD_WORLDS || []).forEach(function (w) { W[w.id] = w.levels.slice().sort(function (a, b) { return a.id < b.id ? -1 : 1; }); });

  var plan = { 1: [22, 1, 0.85], 2: [22, 0.75, 0.6], 4: [17, 0.6, 0.4], 3: [4, 0.5, 0.3] };
  var levels = {}, fails = {};
  [1, 2, 4, 3].forEach(function (wid) {
    var p = plan[wid];
    (W[wid] || []).slice(0, p[0]).forEach(function (l) {
      var r = rnd(), st = r < p[1] ? 3 : r < p[1] + 0.2 ? 2 : 1;
      var best = st === 3 ? (rnd() < 0.5 ? l.par : l.stars[0]) : st === 2 ? l.stars[1] : l.stars[1] + 1;
      var gold = !!(l.pollen && l.pollen.length) && rnd() < p[2];
      levels[l.id] = { stars: st, golden: gold, best: best, time: Math.round(12 + rnd() * 70), clears: 1 + Math.floor(rnd() * 3) };
      if (rnd() < 0.25) fails[l.id] = 1 + Math.floor(rnd() * 4);
    });
  });

  var days = {};
  [0, 1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13, 14, 15, 18, 19, 21].forEach(function (n) {
    var par = 2 + (n % 3), used = par + (n % 4 === 0 ? 0 : 1 + (n % 2)), pt = n % 3;
    days[dk(n)] = { stars: used <= par + 2 ? 3 : 2, used: used, par: par, pollenGot: pt ? (n % 2 ? pt : pt - 1) : 0, pollenTotal: pt, at: NOW - n * DAY - 3600000 * (2 + n % 5) };
  });
  days[dk(0)] = { stars: 3, used: 4, par: 3, pollenGot: 2, pollenTotal: 2, at: NOW - 3600000 };

  var earn = {};
  earn["week:" + dk(0)] = 50;
  for (var i = 0; i < 7; i++) earn["login:" + dk(i)] = 10 + Math.min(10, 2 * (6 - i));
  for (var j = 8; j < 16; j++) earn["login:" + dk(j)] = 10 + Math.min(10, 2 * (15 - j));
  [1, 2, 4, 6].forEach(function (n) { earn["zen:" + dk(n) + ":1"] = 4; earn["zen:" + dk(n) + ":2"] = 4; });
  var spend = {
    "trail:comet": 60, "trail:petal": 90, "decor:chime": 90, "decor:lanterns": 140, "decor:jar": 180,
    "pot:daisy": 90, "pot:fern": 90, "pot:sunflower": 90, "fert:fern:1": 140, "fert:sunflower:1": 110,
    "oracle:w4-14": 45, "glimpse:w2-19": 12, "charm:readme1": 40, "badge:1": 120, "banner:orchard": 300
  };

  var t = function (n) { return NOW - n * DAY - 3600000 * 3; };
  var ach = {
    "first-seed": t(42), "first-clear": t(42), "three-star": t(42), "ten-plots": t(39), "golden-1": t(37), "daily-1": t(30),
    "world-1": t(30), "pollen-100": t(12), "fifty-plots": t(9), "world-2": t(16), "three-25": t(26), "perfect-world": t(28),
    "last-seed": t(33), "stubborn": t(24), "burn-10": t(35), "bounce-25": t(18), "streak-7": t(21),
    "zen-10": t(5), "hour": t(29), "skins": null, "plants-100": t(20), "almanac": null,
    "fr-follow": t(9), "fr-card": t(8), "fr-send": t(6), "fr-play": t(2), "fr-win": t(1)
  };
  Object.keys(ach).forEach(function (k) { if (ach[k] == null) delete ach[k]; });

  var save = {
    v: 2, levels: levels, ach: ach, fails: fails,
    flora: { daisy: 96, fern: 74, sunflower: 41, spiral: 6 },
    seen: { fertile: 1, hungry: 1, barren: 1, sun: 1, pollen: 1, ice: 1, shield: 1, orbit: 1, portal: 1, wind: 1, boost: 1 },
    coach: { "w1-01": 1, "w1-02": 1, nectar: 1, nectarTip: 1 }, announced: { 1: 1, 2: 1, 3: 1, 4: 1 },
    skins: { nocturne: 1, daylight: 1, synthwave: 1 },
    pals: { f: t(9), "m:k3x9q1": t(8), c: t(6), p: t(2), "w:k3x9q1:alout0001": t(1) },
    stats: { sown: 742, plants: 468, pollen: 152, playMs: 5.4 * 3600000, wins: 109, losses: 31, burn: 38, crash: 127, swallow: 0, bounce: 164, warp: 22, boost: 15, shield: 26, lost: 142, zen: 14, daily: 18, lastSeed: 3, stubborn: 4 },
    settings: { skin: q.get("skin") || "nocturne", unlockAll: false, grid: !!q.get("grid"), shake: true, reducedMotion: false, colorblind: !!q.get("cb"), assist: false, fastForward: false, trail: q.get("trail") || "comet", master: 0.8, music: 0.6, sfx: 0.8, muted: false },
    settingsAt: NOW - DAY,
    daily: { last: dk(0), streak: 7, best: 9, days: days },
    zen: { diff: +(q.get("zdiff") || 3), seed: +(q.get("zseed") || 48213) },
    wallet: { earn: earn, spend: spend, frost: { } },
    sync: { dev: "devreadme", gen: 0, others: {}, settingsAt: NOW - DAY, st: null, wo: 1 }
  };
  try { localStorage.setItem("orbit-orchard-v2", JSON.stringify(save)); } catch (e) {}
})();
