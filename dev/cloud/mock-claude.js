(function () {
  window.ORCHARD_DEV = 1;
  var q = new URLSearchParams(location.search);
  var KEY = "orbit-orchard-v2";
  try { localStorage.removeItem(KEY); } catch (e) {}
  var base = { skin: "nocturne", unlockAll: true, grid: true, shake: true, reducedMotion: false, colorblind: false, assist: false, master: 0.8, music: 0.6, sfx: 0.8, muted: false };
  var local = { settings: base, coach: { "w1-01": 1, "w1-02": 1 } };
  if (q.get("local") === "progress") {
    local.levels = { "w1-11": { stars: 3, golden: false, best: 2, time: 20, clears: 1 } };
    local.stats = { sown: 5, plants: 4, playMs: 1000, wins: 1, losses: 0 };
    local.sync = { dev: "devlocal", gen: 0, others: {}, settingsAt: 0, st: null };
  }
  if (q.get("local") === "rich") {
    local.coach.nectar = 1;
    local.wallet = { earn: { seed: 400 }, spend: {}, frost: {} };
  }
  if (q.get("local") === "garden") {
    local.coach.nectar = 1;
    local.levels = {};
    var cl = { 1: 22, 2: 14, 3: 3 };
    Object.keys(cl).forEach(function (w) { for (var i = 1; i <= cl[w]; i++) local.levels["w" + w + "-" + (i < 10 ? "0" + i : i)] = { stars: 3, golden: w === "1" && i % 2 === 0, best: 1, time: 10, clears: 1 }; });
    local.stats = { sown: 400, plants: 300, pollen: 90, playMs: 9000000, wins: 60, losses: 20, zen: 16 };
    local.flora = { daisy: 120, fern: 70, spiral: 9 };
    local.daily = { last: null, streak: 0, best: 8, days: {} };
    local.wallet = { earn: { seed: 3000 }, spend: q.get("bare") ? {} : { "decor:chime": 90, "decor:lanterns": 140, "decor:jar": 180, "decor:orrery": 240, "decor:chart": 320, "pot:daisy": 90, "pot:lotus": 90, "pot:fern": 90, "badge:1": 120, "banner:orchard": 300, "fert:fern:1": 140, "fert:lotus:1": 140, "fert:spiral:1": 110 }, frost: {} };
  }
  if (q.get("local") === "daily") {
    local.coach.nectar = 1;
    var dk = function (n) { var d = new Date(); d.setDate(d.getDate() - n); return d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0"); };
    local.daily = { last: dk(0), streak: 4, best: 6, days: {} };
    for (var n = 1; n < 4; n++) local.daily.days[dk(n)] = { stars: 2, used: 5, par: 3, pollenGot: 0, pollenTotal: 1, at: 1 };
    local.daily.days[dk(0)] = { stars: 2, used: 6, par: 3, pollenGot: 1, pollenTotal: 2, at: Date.now() - 60000, assist: true, best: { stars: 3, used: 4, pollenGot: 2 } };
    local.wallet = { earn: { seed: 50 }, spend: {}, frost: {} };
  }
  var plots = function (w, n) { var o = {}; for (var i = 1; i <= n; i++) o["w" + w + "-" + (i < 10 ? "0" + i : i)] = { stars: 3, golden: false, best: 1, time: 10, clears: 1 }; return o; };
  if (q.get("local") === "fold" || q.get("local") === "foldbare") {
    local.coach.nectar = 1;
    local.levels = Object.assign(plots(1, 22), plots(2, 16), plots(3, 10));
    local.announced = q.get("local") === "fold" ? { 1: 1, 2: 1, 3: 1 } : {};
    local.wallet = { earn: {}, spend: { "oracle:w3-11": 55 }, frost: {} };
  }
  if (q.get("local") === "early") {
    local.coach.nectar = 1;
    local.levels = Object.assign(plots(1, 22), plots(2, +(q.get("w2") || 10)), plots(4, +(q.get("w4") || 0)));
    local.announced = { 1: 1, 2: 1 };
    local.sync = { dev: "devlocal", gen: 0, others: {}, settingsAt: 0, st: null, wo: 1 };
  }
  if (q.get("nowelcome")) local.coach.nectar = 1;
  if (q.get("achold")) {
    local.coach.nectar = 1;
    local.levels = {}; for (var j = 1; j <= 10; j++) local.levels["w1-" + String(j).padStart(2, "0")] = { stars: 1, golden: false, best: 9, time: 9, clears: 1 };
    local.ach = { "ten-plots": 1, "first-clear": 1 };
    local.wallet = { earn: { "ach:ten-plots": 20, "ach:first-clear": 20 }, spend: {}, frost: {} };
  }
  if (q.get("streak")) {
    local.coach.nectar = 1;
    local.wallet = { earn: {}, spend: {}, frost: {} };
    for (var i = 1; i <= +q.get("streak"); i++) {
      var d = new Date(); d.setDate(d.getDate() - i);
      local.wallet.earn["login:" + d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0")] = 10;
    }
  }
  if (q.get("assist")) base.assist = true;
  if (q.get("skin")) base.skin = q.get("skin");
  if (q.get("locked")) base.unlockAll = false;
  if (q.get("fails")) local.fails = { "w1-05": +q.get("fails"), "w1-12": +q.get("fails") };
  if (q.get("local") === "old") {
    local.coach.nectar = 1;
    local.levels = { "w1-01": { stars: 2, golden: false, best: 2, time: 9, clears: 1 }, "w1-10": { stars: 1, golden: false, best: 3, time: 9, clears: 1 }, "w1-16": { stars: 1, golden: false, best: 5, time: 9, clears: 1 }, "w1-20": { stars: 1, golden: false, best: 6, time: 9, clears: 1 }, "w1-06": { stars: 1, golden: false, best: 1, time: 9, clears: 1 } };
    local.wallet = { earn: { "clear:w1-01": 10, "star2:w1-01": 5, "clear:w1-10": 10, "clear:w1-16": 10, "clear:w1-20": 10 }, spend: {}, frost: {} };
  }
  if (!q.get("fresh")) { try { localStorage.setItem(KEY, JSON.stringify(local)); } catch (e) {} }

  var lv = {};
  for (var i = 1; i <= 10; i++) lv["w1-" + (i < 10 ? "0" + i : i)] = { stars: 3, golden: i < 4, best: 1, time: 12, clears: 2 };
  lv["w2-01"] = { stars: 2, golden: false, best: 3, time: 40, clears: 1 };
  var earn = {};
  Object.keys(lv).forEach(function (id) { earn["clear:" + id] = 10; if (lv[id].stars >= 2) earn["star2:" + id] = 5; if (lv[id].stars >= 3) earn["star3:" + id] = 10; if (lv[id].golden) earn["golden:" + id] = 10; });
  earn["login:20261007"] = 10;
  var FIX = {
    other: {
      v: 2, gen: 0, levels: lv, ach: {}, fails: { "w1-05": 2 },
      stats: { devother: { sown: 40, plants: 30, wins: 10, playMs: 600000, pollen: 6 } },
      flora: { devother: { daisy: 30 } },
      daily: { last: null, streak: 0, best: 0, days: {} },
      wallet: { earn: earn, spend: { "trail:petal": 90 }, frost: {} },
      settings: { skin: "daylight", grid: true, shake: true, reducedMotion: false, colorblind: false, assist: false, unlockAll: true, trail: "petal" },
      settingsAt: 1000, seen: { fertile: 1 }, coach: { "w1-01": 1, nectar: 1 }, announced: {}, skins: { nocturne: 1, daylight: 1 }
    }
  };
  FIX.oldfold = JSON.parse(JSON.stringify(FIX.other));
  FIX.oldfold.levels = Object.assign(plots(1, 22), plots(2, 16), plots(3, 10));
  FIX.oldfold.announced = { 1: 1, 2: 1, 3: 1 };
  FIX.oldfold.settings.unlockAll = false;
  var store = {};
  if (q.get("remote") && FIX[q.get("remote")]) store["data/users/u_test/save"] = JSON.parse(JSON.stringify(FIX[q.get("remote")]));
  var writes = [], subs = {};
  window.__mock = { store: store, writes: writes };
  if (q.get("mock") === "none") return;
  var snap = function (path, pending) {
    var d = store[path];
    return { id: path.split("/").pop(), exists: !!d, data: function () { return d ? JSON.parse(JSON.stringify(d)) : undefined; }, metadata: { fromCache: false, hasPendingWrites: !!pending } };
  };
  var fire = function (path) { (subs[path] || []).forEach(function (f) { f(snap(path)); }); };
  var db = {
    doc: function (path) {
      return {
        id: path.split("/").pop(), path: path,
        get: function () { return Promise.resolve(snap(path)); },
        set: function (data) {
          if (q.get("fail") === "invalid") return Promise.reject({ code: "invalid_argument", message: "no" });
          store[path] = JSON.parse(JSON.stringify(data)); writes.push(path);
          return Promise.resolve().then(function () { fire(path); });
        },
        onSnapshot: function (next) {
          (subs[path] = subs[path] || []).push(next);
          Promise.resolve().then(function () { next(snap(path)); });
          return function () {};
        }
      };
    }
  };
  var avatar = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="#8fc79a"/><text x="20" y="26" font-size="16" text-anchor="middle" fill="#10142a">JT</text></svg>');
  var user = { id: function () { return Promise.resolve(q.get("signedout") ? null : "u_test"); }, me: function () { return Promise.resolve({ id: "u_test", name: "Jun Tester", avatarUrl: avatar, color: "#8fc79a", email: null, isOwner: true, canEdit: true }); } };
  var downloads = { save: function (r) { writes.push("download:" + r.filename); return Promise.resolve({ status: "saved" }); } };
  window.claude = { use: function (n) { return Promise.resolve(n === "db" ? db : n === "user" ? user : n === "downloads" ? downloads : null); } };
})();
