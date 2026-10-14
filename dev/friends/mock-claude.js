(function () {
  window.ORCHARD_DEV = 1;
  var q = new URLSearchParams(location.search);
  var UID = q.get("uid") || "u_alice";
  var LEVEL = q.get("level") || (q.get("owner") ? "owner" : "interact");
  var SAVE = "orbit-orchard-v2", DBKEY = "oo-mock-db";
  var R = window.ORCHARD_RULES;
  if (q.get("nocrypto")) try { Object.defineProperty(window.crypto, "subtle", { get: function () { return undefined; }, configurable: true }); } catch (e) {}
  var DAY = 864e5, NOW = Date.now();

  var gi = Storage.prototype.getItem, si = Storage.prototype.setItem, ri = Storage.prototype.removeItem;
  var ns = function (k) { return k === SAVE ? SAVE + "@" + UID : k; };
  Storage.prototype.getItem = function (k) { return gi.call(this, ns(k)); };
  Storage.prototype.setItem = function (k, v) { return si.call(this, ns(k), v); };
  Storage.prototype.removeItem = function (k) { return ri.call(this, ns(k)); };

  var PEOPLE = {
    u_alice: { name: "Alice Moss", color: "#8fc79a" }, u_bob: { name: "Bob Fern", color: "#a99be6" }, u_cara: { name: "Cara Quill", color: "#f29e7a" },
    u_dev: { name: "Dev Sol", color: "#f3d67a" }, u_eve: { name: "Eve Thorn", color: "#7ef0d8" }, u_guest: { name: "Gil Guest", color: "#ff79b0", guest: true }
  };
  var avatar = function (id) {
    var p = PEOPLE[id], ini = p ? p.name.split(" ").map(function (w) { return w[0]; }).join("") : "?";
    return "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="' + (p ? p.color : "#7d7aa0") + '"/><text x="20" y="26" font-size="15" font-family="sans-serif" font-weight="700" text-anchor="middle" fill="#10142a">' + ini + "</text></svg>");
  };

  var dk = function (n) { var d = new Date(NOW - n * DAY); return d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0"); };
  var levels = function (spec) {
    var lv = {};
    Object.keys(spec).forEach(function (w) {
      var s = spec[w];
      for (var i = 1; i <= s[0]; i++) lv["w" + w + "-" + (i < 10 ? "0" + i : i)] = { stars: i <= s[1] ? 3 : 2, golden: i <= s[2], best: 2, time: 20, clears: 1 };
    });
    return lv;
  };
  var SAVES = {
    u_alice: { levels: levels({ 1: [22, 18, 6], 2: [12, 8, 2], 3: [2, 1, 0] }), ach: { "first-seed": 1, "first-clear": 1, "three-star": 1, "ten-plots": 1, "world-1": 1, "golden-1": 1, "daily-1": 1 }, daily: { last: dk(0), streak: 5, best: 9, days: {} } },
    u_bob: { levels: levels({ 1: [22, 22, 12], 2: [22, 15, 5], 3: [9, 4, 1] }), ach: { "first-seed": 1, "first-clear": 1, "three-star": 1, "ten-plots": 1, "world-1": 1, "world-2": 1, "golden-1": 1, "fifty-plots": 1, "perfect-world": 1 }, daily: { last: dk(1), streak: 12, best: 12, days: {} } },
    u_cara: { levels: levels({ 1: [14, 6, 1] }), ach: { "first-seed": 1, "first-clear": 1, "ten-plots": 1 }, daily: { last: null, streak: 0, best: 2, days: {} } }
  };

  try { localStorage.removeItem(SAVE); } catch (e) {}
  if (!q.get("fresh")) {
    var base = { skin: q.get("skin") || "nocturne", unlockAll: true, grid: true, shake: true, reducedMotion: !!q.get("rm"), colorblind: false, assist: !!q.get("assist"), master: 0, music: 0, sfx: 0, muted: true };
    var local = Object.assign({ settings: base, coach: { "w1-01": 1, "w1-02": 1, nectar: 1, nectarTip: 1 }, wallet: { earn: { seed: 420 }, spend: {}, frost: {} } }, JSON.parse(JSON.stringify(SAVES[UID] || {})));
    try { localStorage.setItem(SAVE, JSON.stringify(local)); } catch (e) {}
  }

  var read = function () { try { return JSON.parse(gi.call(localStorage, DBKEY) || "{}"); } catch (e) { return {}; } };
  var write = function (s) { try { si.call(localStorage, DBKEY, JSON.stringify(s)); } catch (e) {} };

  var PLAIN = {}, FOLLOWS = { u_bob: ["u_alice"], u_cara: ["u_eve"] };
  if (q.get("fx")) write(fixture(q.get("fx")));
  if (q.get("reset")) write({});

  function fixture(name) {
    var s = {};
    if (name === "empty") return s;
    var card = function (id, st) { return Object.assign({ v: 1, u: id, day: dk(st.ago || 0), stars: 0, cleared: 0, worlds: 0, golden: 0, streak: 0, best: 0, trophies: 0, tiers: { bronze: 0, silver: 0, gold: 0, platinum: 0 }, ws: [], wc: [] }, st.c); };
    PLAIN.u_bob = card("u_bob", { ago: 1, c: { stars: 160, cleared: 53, worlds: 2, golden: 18, streak: 12, best: 12, trophies: 9, tiers: { bronze: 4, silver: 2, gold: 3, platinum: 0 }, ws: [66, 59, 31, 0, 0], wc: [22, 22, 9, 0, 0], nectar: 1840 } });
    PLAIN.u_cara = card("u_cara", { ago: 4, c: { stars: 34, cleared: 14, worlds: 0, golden: 1, streak: 0, best: 2, trophies: 3, tiers: { bronze: 2, silver: 1, gold: 0, platinum: 0 }, ws: [34, 0, 0, 0, 0], wc: [14, 0, 0, 0, 0] } });
    s["cards/u_dev"] = card("u_dev", { ago: 2, c: { stars: 77, cleared: 30 } });
    s["cards/u_mallory"] = { v: 2, u: "u_bob", at: NOW, w: {} };
    s["data/users/u_bob/friends"] = { v: 1, f: { u_alice: { at: NOW - 8 * DAY } }, share: { on: true, nectar: true, at: NOW - 8 * DAY }, code: null };
    s["data/users/u_cara/friends"] = { v: 1, f: { u_eve: { at: NOW - 5 * DAY } }, share: { on: true, nectar: false, at: NOW - 5 * DAY }, code: null };
    s["codes/u_bob"] = { c: "BQ7K2M", u: "u_bob" };
    s["codes/u_cara"] = { c: "CR4TQ9", u: "u_cara" };
    s["codes/u_dev"] = { c: "DV8W3N", u: "u_dev" };
    s["data/users/u_alice/friends"] = { v: 1, f: { u_bob: { at: NOW - 9 * DAY }, u_cara: { at: NOW - 6 * DAY, code: "CR4TQ9" }, u_dev: { at: NOW - 2 * DAY }, u_guest: { at: NOW - 3 * DAY } }, share: { on: true, nectar: false, at: NOW - 9 * DAY }, code: { c: "AK5MZ7", at: NOW - 9 * DAY } };
    s["codes/u_alice"] = { c: "AK5MZ7", u: "u_alice" };
    var r = function (used, pollen, time, ago, assist) { var o = { used: used, stars: used <= 4 ? 3 : used <= 5 ? 2 : 1, pollen: pollen, pt: 2, time: time, at: NOW - ago }; if (assist) o.assist = true; return o; };
    s["data/users/u_bob/chal"] = { v: 1, to: ["u_alice"], from: ["u_alice"], out: {
      bobopen001: { to: "u_alice", seed: 482913, diff: 4, at: NOW - 3600000 * 5, exp: NOW - 3600000 * 5 + 7 * DAY, r: r(5, 1, 74.2, 3600000 * 5) },
      bobdone002: { to: "u_alice", seed: 551203, diff: 3, at: NOW - 3 * DAY, exp: NOW + 4 * DAY, r: r(4, 2, 61.5, 3 * DAY) },
      bobexp0003: { to: "u_alice", seed: 330011, diff: 2, at: NOW - 9 * DAY, exp: NOW - 2 * DAY }
    }, res: { "u_alice~alout0001": { by: "u_alice", cid: "alout0001", seed: 712004, diff: 5, at: NOW - 5 * DAY, r: r(6, 0, 98, 5 * DAY) } } };
    s["data/users/u_cara/chal"] = { v: 1, to: ["u_alice"], from: [], out: { caraopen01: { to: "u_alice", seed: 120044, diff: 1, at: NOW - DAY, exp: NOW + 6 * DAY } }, res: {} };
    s["data/users/u_dev/chal"] = { v: 1, to: [], from: ["u_alice"], out: {}, res: { "u_alice~alout0002": { by: "u_alice", cid: "alout0002", seed: 640211, diff: 3, at: NOW - 2 * DAY, no: 1 } } };
    s["data/users/u_alice/chal"] = { v: 1, to: ["u_bob", "u_cara", "u_dev"], from: ["u_bob"], out: {
      alout0001: { to: "u_bob", seed: 712004, diff: 5, at: NOW - 6 * DAY, exp: NOW + DAY, r: r(5, 1, 80.4, 6 * DAY, true) },
      alout0002: { to: "u_dev", seed: 640211, diff: 3, at: NOW - 3 * DAY, exp: NOW + 4 * DAY },
      alout0003: { to: "u_cara", seed: 902177, diff: 2, at: NOW - 2 * 3600000, exp: NOW - 2 * 3600000 + 7 * DAY, r: r(3, 2, 41, 2 * 3600000) }
    }, res: { "u_bob~bobdone002": { by: "u_bob", cid: "bobdone002", seed: 551203, diff: 3, at: NOW - 2 * DAY, r: r(4, 2, 55.0, 2 * DAY) } } };
    s["data/users/u_bob/save"] = { secret: true };
    return s;
  }

  function seedCards() {
    var X = window.OrchardFriends && window.OrchardFriends.cx;
    if (!X || !window.crypto || !window.crypto.subtle) return Promise.resolve();
    var ids = ["u_alice", "u_bob", "u_cara", "u_dev", "u_eve"], keys = {}, st = read();
    return Promise.all(ids.map(function (id) { return X.gen().then(function (k) { keys[id] = k; }); })).then(function () {
      ids.forEach(function (id) {
        var k = keys[id];
        st["data/users/" + id + "/keys"] = { v: 1, jwk: { kty: "EC", crv: "P-256", x: k.x, y: k.y, d: k.d }, at: NOW };
        st["keys/" + id] = { u: id, x: k.x, y: k.y, at: NOW };
      });
      return Promise.all(Object.keys(PLAIN).map(function (from) {
        var w = {};
        return Promise.all(FOLLOWS[from].map(function (to) {
          return X.pair(keys[from], keys[to]).then(function (p) { return X.side(p, "", from, to); }).then(function (sd) { return X.seal(sd.key, PLAIN[from], "orchard-card-v2|" + from + "|" + to).then(function (e) { w[sd.tag] = e; }); });
        })).then(function () { st["cards/" + from] = { v: 2, u: from, at: NOW - DAY, w: w }; });
      }).concat(ids.filter(function (id) { return st["data/users/" + id + "/chal"]; }).map(function (id) {
        return X.sealChal(st["data/users/" + id + "/chal"], id, function (peer) { return keys[peer] ? X.pair(keys[id], keys[peer]) : null; }).then(function (w) { st["chal/" + id] = { v: 2, u: id, at: NOW - 3600000, out: w.out, res: w.res }; });
      })));
    }).then(function () {
      if (!q.get("pins")) return;
      return Promise.all(["u_bob", "u_dev"].map(function (id) { return X.thumb(keys[id]); })).then(function (fp) {
        st["data/users/u_alice/pins"] = { v: 1, p: { u_bob: { fp: fp[0], at: NOW - DAY, ok: 1 }, u_dev: { fp: fp[1], at: NOW - DAY }, u_cara: { fp: "A".repeat(42) + "Q", at: NOW - 5 * DAY, ok: 1 } } };
      });
    }).then(function () { write(st); });
  }
  var seeding = null;

  var log = function () { if (q.get("dblog")) console.log.apply(console, ["[db " + UID + "]"].concat([].slice.call(arguments))); };
  window.__mock = { uid: UID, level: LEVEL, read: read, write: write, writes: [], rejects: [], raw: { get: function (p) { return read()[p]; }, set: function (p, d) { var s = read(); if (d == null) delete s[p]; else s[p] = d; write(s); refire(); } } };
  if (q.get("mock") === "none") return;

  var can = function (path, op) { return R.allowed(R.RULES, UID, LEVEL, path, op); };
  var reject = function (path, why) { window.__mock.rejects.push(path); log("reject", path, why); return Promise.reject({ code: "invalid_argument", message: why }); };
  var segs = function (p) { return p.split("/"); };
  var docSnap = function (path, s) {
    var d = can(path, "read") ? s[path] : undefined, id = segs(path).pop();
    return { id: id, exists: !!d, data: function () { return d ? JSON.parse(JSON.stringify(d)) : undefined; }, metadata: { fromCache: false, hasPendingWrites: false } };
  };
  var runQuery = function (qy, s) {
    var n = segs(qy.path).length;
    var docs = Object.keys(s).filter(function (p) { return p.indexOf(qy.path + "/") === 0 && segs(p).length === n + 1 && can(p, "read"); }).sort();
    docs = docs.filter(function (p) {
      var d = s[p];
      return qy.filters.every(function (f) {
        var v = d[f[0]];
        if (f[1] === "==") return v === f[2];
        if (f[1] === "in") return f[2].indexOf(v) >= 0;
        if (f[1] === "array-contains") return Array.isArray(v) && v.indexOf(f[2]) >= 0;
        throw { code: "invalid_argument", message: "op " + f[1] };
      });
    });
    if (qy.lim) docs = docs.slice(0, qy.lim);
    var list = docs.map(function (p) { return docSnap(p, s); });
    return { docs: list, size: list.length, empty: !list.length, docChanges: function () { return []; }, metadata: { fromCache: false, hasPendingWrites: false } };
  };

  var subs = [];
  function refire() {
    var s = read();
    subs.forEach(function (sub) {
      if (sub.dead) return;
      var snap = sub.kind === "doc" ? docSnap(sub.path, s) : runQuery(sub.q, s);
      var key = JSON.stringify(sub.kind === "doc" ? [snap.exists, snap.exists ? snap.data() : null] : snap.docs.map(function (d) { return [d.id, d.data()]; }));
      if (key === sub.last) return;
      sub.last = key;
      try { sub.next(snap); } catch (e) { setTimeout(function () { throw e; }); }
    });
  }
  addEventListener("storage", function (e) { if (e.key === DBKEY) refire(); });
  var tick = function () { return new Promise(function (r) { setTimeout(r, 10); }); };
  var subscribe = function (sub) {
    subs.push(sub);
    tick().then(function () { if (sub.dead) return; var s = read(); var snap = sub.kind === "doc" ? docSnap(sub.path, s) : runQuery(sub.q, s); sub.last = JSON.stringify(sub.kind === "doc" ? [snap.exists, snap.exists ? snap.data() : null] : snap.docs.map(function (d) { return [d.id, d.data()]; })); sub.next(snap); });
    return function () { sub.dead = true; };
  };

  var checkPath = function (p, even) {
    var n = segs(p).length;
    if (!p || segs(p).some(function (x) { return !/^[A-Za-z0-9_\-.~:@+]+$/.test(x); }) || (n % 2 === 0) !== even) throw new TypeError("bad path " + p);
  };
  var docRef = function (path) {
    checkPath(path, true);
    var ref = {
      id: segs(path).pop(), path: path,
      get: function () { return tick().then(function () { return docSnap(path, read()); }); },
      set: function (data) {
        if (!can(path, "write")) return reject(path, "write denied");
        if (q.get("fail") === "invalid") return reject(path, "forced");
        return tick().then(function () { var s = read(); s[path] = JSON.parse(JSON.stringify(data)); write(s); window.__mock.writes.push(path); log("set", path); refire(); });
      },
      update: function (data) {
        if (!can(path, "write")) return reject(path, "write denied");
        return tick().then(function () { var s = read(); if (!s[path]) throw { code: "invalid_argument", message: "missing" }; Object.assign(s[path], JSON.parse(JSON.stringify(data))); write(s); refire(); });
      },
      delete: function () {
        if (!can(path, "write")) return reject(path, "write denied");
        return tick().then(function () { var s = read(); delete s[path]; write(s); window.__mock.writes.push("del:" + path); log("delete", path); refire(); });
      },
      onSnapshot: function (next, err) { return subscribe({ kind: "doc", path: path, next: next, err: err }); },
      collection: function (c) { return colRef(path + "/" + c); }
    };
    return ref;
  };
  var query = function (path, filters, lim) {
    var qy = { path: path, filters: filters, lim: lim };
    return {
      where: function (f, op, v) { return query(path, filters.concat([[f, op, v]]), lim); },
      orderBy: function () { return query(path, filters, lim); },
      limit: function (n) { return query(path, filters, n); },
      get: function () { return tick().then(function () { return runQuery(qy, read()); }); },
      onSnapshot: function (next, err) { return subscribe({ kind: "q", q: qy, next: next, err: err }); }
    };
  };
  var colRef = function (path) {
    checkPath(path, false);
    return Object.assign(query(path, [], 0), { path: path, doc: function (id) { return docRef(path + "/" + (id || Math.random().toString(36).slice(2, 12))); } });
  };
  var db = { doc: docRef, collection: colRef };

  var signedOut = !!q.get("signedout"), noProfile = !!q.get("noprofile");
  var profile = function (id) {
    var p = PEOPLE[id];
    return { id: id, name: p && !noProfile ? p.name : "", avatarUrl: avatar(noProfile ? "" : id), color: p ? p.color : "#7d7aa0", email: null, isMe: id === UID, guest: !!(p && p.guest && !noProfile) };
  };
  var seen = {};
  var user = {
    id: function () { return Promise.resolve(signedOut ? null : UID); },
    me: function () { var p = profile(UID); return Promise.resolve({ id: signedOut ? null : UID, name: signedOut ? "" : p.name, avatarUrl: p.avatarUrl, color: p.color, email: null, isOwner: LEVEL === "owner", canEdit: LEVEL === "owner" || LEVEL === "admin" }); },
    isOwner: function () { return Promise.resolve(LEVEL === "owner"); },
    canEdit: function () { return Promise.resolve(LEVEL === "owner" || LEVEL === "admin"); },
    can: function (n) { return Promise.resolve(q.get("can") === "null" ? null : n === "data.write" ? R.RANK[LEVEL] >= 1 : false); },
    profiles: function (ids) { var o = {}; [].concat(ids).forEach(function (id) { o[id] = profile(id); seen[id] = 1; }); return Promise.resolve(o); },
    search: function (s) {
      if (noProfile) return Promise.resolve([]);
      s = String(s || "").toLowerCase();
      var ids = s ? Object.keys(PEOPLE).filter(function (id) { return PEOPLE[id].name.toLowerCase().indexOf(s) >= 0; }) : [UID].concat(Object.keys(seen).filter(function (id) { return id !== UID && PEOPLE[id]; }));
      return Promise.resolve(ids.slice(0, 8).map(profile));
    }
  };
  var downloads = { save: function () { return Promise.resolve({ status: "saved" }); } };
  var none = q.get("none") || "", perm = q.get("perm") || "";
  var permissions = {
    state: function (n) { var s = perm || "granted"; return Promise.resolve(n ? s : { db: s, user: s }); },
    request: function (ns) { if (perm === "prompt") perm = "granted"; var o = {}; (ns || ["db", "user"]).forEach(function (n) { o[n] = perm || "granted"; }); return Promise.resolve(o); },
    manage: function () { if (perm === "denied") perm = "granted"; return Promise.resolve(); }
  };
  window.claude = { use: function (n) {
    if (none.split(",").indexOf(n) >= 0) return Promise.resolve(null);
    if (n === "permissions") return Promise.resolve(permissions);
    if (perm && (n === "db" || n === "user")) return Promise.resolve(null);
    if (!seeding) seeding = q.get("fx") === "rich" ? seedCards() : Promise.resolve();
    return seeding.then(function () { return new Promise(function (r) { setTimeout(function () { r(n === "db" ? db : n === "user" ? user : n === "downloads" ? downloads : null); }, 20); }); });
  } };
})();
