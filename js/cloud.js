(function (root) {
  "use strict";

  const SYNCED = ["skin", "grid", "shake", "reducedMotion", "colorblind", "assist", "unlockAll", "trail", "fastForward"];
  const FLAGS = ["stubborn", "lastSeed"];
  const UNIONS = ["seen", "coach", "announced", "skins"];
  const KEEP_DAYS = 60;

  const isObj = (v) => v != null && typeof v === "object" && !Array.isArray(v);
  const obj = (v) => (isObj(v) ? v : {});
  const num = (v) => (typeof v === "number" && isFinite(v) ? v : 0);
  const clone = (v) => JSON.parse(JSON.stringify(v == null ? null : v));

  /** Serializes a value with sorted keys so equal states compare equal. */
  function canon(v) {
    if (Array.isArray(v)) return "[" + v.map(canon).join(",") + "]";
    if (isObj(v)) return "{" + Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}";
    return JSON.stringify(v === undefined ? null : v);
  }

  /** Canonical form of a wire save, optionally ignoring play-time drift. */
  function canonWire(w, ignoreClock) {
    const c = clone(w) || {};
    delete c.at;
    if (ignoreClock) Object.keys(obj(c.stats)).forEach((d) => { if (isObj(c.stats[d])) delete c.stats[d].playMs; });
    return canon(c);
  }

  function minNN(a, b) { return a == null ? (b == null ? null : b) : b == null ? a : Math.min(a, b); }

  function mergeLevel(a, b) {
    if (!isObj(a)) return clone(b);
    if (!isObj(b)) return clone(a);
    const hi = num(b.stars) > num(a.stars) ? b : a;
    return Object.assign(clone(hi), {
      stars: Math.max(num(a.stars), num(b.stars)),
      golden: !!(a.golden || b.golden),
      best: minNN(a.best, b.best),
      time: minNN(a.time, b.time),
      clears: Math.max(num(a.clears), num(b.clears))
    });
  }

  function mergeKeyed(a, b, f) {
    const out = {};
    const A = obj(a), B = obj(b);
    Object.keys(A).concat(Object.keys(B)).forEach((k) => {
      if (k in out) return;
      out[k] = !(k in A) ? clone(B[k]) : !(k in B) ? clone(A[k]) : f(A[k], B[k]);
    });
    return out;
  }
  const maxOf = (x, y) => Math.max(num(x), num(y));
  const minTs = (x, y) => (num(x) && num(y) ? Math.min(x, y) : maxOf(x, y));

  function mergeDevices(a, b) { return mergeKeyed(a, b, (x, y) => mergeKeyed(x, y, maxOf)); }

  const hasAt = (d) => typeof d.at === "number" && isFinite(d.at);
  const sansBest = (d) => { const c = clone(d); delete c.best; return c; };
  const tieCanon = (x, y) => { const a = canon(x), b = canon(y); return a < b ? -1 : a > b ? 1 : 0; };

  /** Orders day records so the official one comes first: earliest `at`, then legacy records by result. */
  function cmpOfficial(x, y) {
    if (hasAt(x) !== hasAt(y)) return hasAt(x) ? -1 : 1;
    if (hasAt(x) && x.at !== y.at) return x.at < y.at ? -1 : 1;
    if (num(x.stars) !== num(y.stars)) return num(y.stars) - num(x.stars);
    if (num(x.used) !== num(y.used)) return num(x.used) - num(y.used);
    return tieCanon(sansBest(x), sansBest(y));
  }

  function resultOf(d) {
    const r = { stars: num(d.stars), used: num(d.used), pollenGot: num(d.pollenGot) };
    if (d.assist) r.assist = true;
    return r;
  }

  /** Orders run results best first: more stars, fewer seeds, more pollen. */
  function cmpBest(a, b) {
    if (a.stars !== b.stars) return b.stars - a.stars;
    if (a.used !== b.used) return a.used - b.used;
    if (a.pollenGot !== b.pollenGot) return b.pollenGot - a.pollenGot;
    return tieCanon(a, b);
  }

  /** Merges one day: the earliest completed run stays official, `best` keeps the best run of either side. */
  function betterDay(x, y) {
    if (!isObj(x)) return clone(y);
    if (!isObj(y)) return clone(x);
    const out = sansBest(cmpOfficial(x, y) <= 0 ? x : y);
    const runs = [];
    [x, y].forEach((d) => { runs.push(resultOf(d)); if (isObj(d.best)) runs.push(resultOf(d.best)); });
    const b = runs.sort(cmpBest)[0];
    if (cmpBest(b, resultOf(out)) < 0) out.best = b;
    return out;
  }

  function dayShift(k, n) {
    const d = new Date(+k.slice(0, 4), +k.slice(4, 6) - 1, +k.slice(6, 8));
    d.setDate(d.getDate() + n);
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  }

  /** Length of the run of consecutive day keys ending at `last`. */
  function runEnding(days, last) {
    let n = 0, k = last;
    while (k && days[k]) { n++; k = dayShift(k, -1); }
    return n;
  }

  const dayOk = (k) => typeof k === "string" && /^\d{8}$/.test(k);

  function mergeDaily(a, b) {
    a = obj(a); b = obj(b);
    if (!dayOk(a.last)) a = Object.assign({}, a, { last: null });
    if (!dayOk(b.last)) b = Object.assign({}, b, { last: null });
    const days = mergeKeyed(a.days, b.days, betterDay);
    Object.keys(days).forEach((k) => { if (!dayOk(k)) delete days[k]; });
    const keys = Object.keys(days).sort();
    while (keys.length > KEEP_DAYS) delete days[keys.shift()];
    const la = a.last || null, lb = b.last || null;
    const last = !la ? lb : !lb ? la : la > lb ? la : lb;
    let streak = la === lb ? maxOf(a.streak, b.streak) : last === la ? num(a.streak) : num(b.streak);
    if (last) streak = Math.max(streak, runEnding(days, last));
    return { last, streak, best: Math.max(num(a.best), num(b.best), streak), days };
  }

  function mergeWallet(a, b) {
    a = obj(a); b = obj(b);
    return { earn: mergeKeyed(a.earn, b.earn, maxOf), spend: mergeKeyed(a.spend, b.spend, maxOf), frost: mergeKeyed(a.frost, b.frost, maxOf) };
  }

  /** Merges two wire saves; the result only ever gains progress. */
  function merge(a, b) {
    if (!isObj(a)) return clone(b);
    if (!isObj(b)) return clone(a);
    if (num(a.gen) !== num(b.gen)) {
      const w = clone(num(a.gen) > num(b.gen) ? a : b);
      delete w.at;
      w.wallet = mergeWallet(a.wallet, b.wallet);
      return w;
    }
    const s = num(b.settingsAt) > num(a.settingsAt) || (num(b.settingsAt) === num(a.settingsAt) && canon(obj(b.settings)) > canon(obj(a.settings))) ? b : a;
    const out = {
      v: 2,
      gen: num(a.gen),
      levels: mergeKeyed(a.levels, b.levels, mergeLevel),
      ach: mergeKeyed(a.ach, b.ach, minTs),
      fails: mergeKeyed(a.fails, b.fails, maxOf),
      stats: mergeDevices(a.stats, b.stats),
      flora: mergeDevices(a.flora, b.flora),
      daily: mergeDaily(a.daily, b.daily),
      wallet: mergeWallet(a.wallet, b.wallet),
      settings: clone(obj(s.settings)),
      settingsAt: num(s.settingsAt)
    };
    UNIONS.forEach((k) => { out[k] = mergeKeyed(a[k], b[k], maxOf); });
    return out;
  }

  function pick(o, keys) { const r = {}; keys.forEach((k) => { if (o && o[k] !== undefined) r[k] = o[k]; }); return r; }

  function sumDevices(devs, keys) {
    const t = {};
    Object.keys(obj(devs)).forEach((d) => {
      const c = obj(devs[d]);
      Object.keys(c).forEach((k) => {
        t[k] = FLAGS.includes(k) && keys === "stats" ? Math.max(num(t[k]), num(c[k])) : num(t[k]) + num(c[k]);
      });
    });
    return t;
  }

  function ownPart(total, others, kind) {
    const sum = sumDevices(others, kind), own = {};
    Object.keys(obj(total)).forEach((k) => {
      const v = FLAGS.includes(k) && kind === "stats" ? num(total[k]) : Math.max(0, num(total[k]) - num(sum[k]));
      if (v) own[k] = v;
    });
    return own;
  }

  /** Converts the local save into the wire format; records a settings change time. */
  function toWire(S, now) {
    const sy = S.sync;
    const st = canon(pick(S.settings, SYNCED));
    if (sy.st == null) sy.st = st;
    else if (sy.st !== st) { sy.settingsAt = now || Date.now(); sy.st = st; }
    const others = obj(sy.others);
    const stats = Object.assign({}, clone(obj(others.stats)));
    stats[sy.dev] = ownPart(S.stats, others.stats, "stats");
    const flora = Object.assign({}, clone(obj(others.flora)));
    flora[sy.dev] = ownPart(S.flora, others.flora, "flora");
    const w = {
      v: 2, gen: num(sy.gen),
      levels: clone(S.levels), ach: clone(S.ach), fails: clone(S.fails),
      stats, flora,
      daily: { last: S.daily.last || null, streak: num(S.daily.streak), best: num(S.daily.best), days: clone(obj(S.daily.days)) },
      wallet: mergeWallet(S.wallet, {}),
      settings: pick(S.settings, SYNCED), settingsAt: num(sy.settingsAt)
    };
    UNIONS.forEach((k) => { w[k] = clone(obj(S[k])); });
    return w;
  }

  /** Builds a new local save from a wire save, keeping device-only fields of `S`. */
  function fromWire(W, S) {
    const n = clone(S);
    const dev = S.sync.dev;
    ["levels", "ach", "fails"].concat(UNIONS).forEach((k) => { n[k] = clone(obj(W[k])); });
    n.skins = Object.assign({ nocturne: 1 }, n.skins);
    const tot = sumDevices(W.stats, "stats");
    n.stats = {};
    Object.keys(obj(S.stats)).concat(Object.keys(tot)).forEach((k) => { n.stats[k] = num(tot[k]); });
    n.flora = sumDevices(W.flora, "flora");
    const strip = (devs) => { const o = clone(obj(devs)); delete o[dev]; return o; };
    n.sync.others = { stats: strip(W.stats), flora: strip(W.flora) };
    const d = obj(W.daily);
    n.daily = { last: d.last || null, streak: num(d.streak), best: num(d.best), days: clone(obj(d.days)) };
    n.wallet = mergeWallet(W.wallet, {});
    n.settings = Object.assign({}, S.settings, pick(W.settings, SYNCED));
    n.sync.settingsAt = num(W.settingsAt);
    n.sync.st = canon(pick(n.settings, SYNCED));
    n.sync.gen = num(W.gen);
    return n;
  }

  /** Total nectar: everything earned minus everything spent. */
  function balance(wallet) {
    const w = obj(wallet);
    const add = (o) => Object.keys(obj(o)).reduce((s, k) => s + num(o[k]), 0);
    return add(w.earn) - add(w.spend);
  }

  function newId() {
    const a = "abcdefghijklmnopqrstuvwxyz0123456789";
    let s = "";
    for (let i = 0; i < 12; i++) s += a[Math.floor(Math.random() * a.length)];
    return s;
  }

  /** Starts syncing the save with the viewer's private cloud document. */
  function start(opts) {
    const st = { mode: "connecting", reason: "", at: 0, who: null };
    let ref = null, unsub = null, remote, ready = false, busy = false, again = false, againForce = false, timer = 0, retried = false, starting = false, revive = 0;
    const gap = opts.minGap > 0 ? opts.minGap : 0;
    let epoch = 0, lastSet = 0;
    const status = (mode, reason) => {
      st.mode = mode; st.reason = reason || "";
      try { opts.onStatus(Object.assign({}, st)); } catch (e) {}
    };

    function stop(mode, reason) {
      if (unsub) { try { unsub(); } catch (e) {} unsub = null; }
      ref = null; ready = false;
      status(mode, reason);
    }

    function fail(e) {
      const code = (e && e.code) || "unavailable";
      if (code === "invalid_argument" || code === "transform_error") stop("readonly", "Your access to this page can't save. Ask the owner for Contributor access.");
      else if (code === "quota_exceeded") status("error", "Cloud storage is full.");
      else if (code === "revoked" || code === "not_granted" || code === "capability_disabled" || code === "capability_removed") stop("local", "Cloud save isn't available in this view.");
      else status("offline", "Can't reach the cloud. Progress is safe on this device and will sync later.");
    }

    function onSnapErr(e) {
      const code = (e && e.code) || "unavailable";
      if (code === "unavailable" || code === "resource_exhausted") {
        stop("offline", "Can't reach the cloud. Progress is safe on this device and will sync later.");
        clearTimeout(revive);
        revive = setTimeout(init, 15000 + Math.random() * 15000);
      } else if (code === "invalid_argument" || code === "transform_error") stop("local", "Cloud save isn't available in this view.");
      else fail(e);
    }

    async function push(force) {
      if (!ref || !ready) return;
      if (busy) { again = true; againForce = againForce || !!force; return; }
      const S = opts.get();
      const M = remote ? merge(toWire(S), remote) : toWire(S);
      if (remote && canonWire(M, !force) === canonWire(remote, !force)) { if (st.mode !== "synced") status("synced"); return; }
      M.at = Date.now();
      busy = true;
      lastSet = Date.now();
      const ep = epoch;
      status("saving");
      try {
        await ref.set(M);
        if (ep === epoch) {
          remote = M; retried = false; st.at = Date.now();
          status("synced");
        }
      } catch (e) {
        if (ep !== epoch) return;
        if (e && e.code === "unavailable" && !retried) {
          retried = true;
          setTimeout(() => push(force), 1500 + Math.random() * 2500);
        } else fail(e);
      } finally {
        busy = false;
        if (again) { const f = againForce; again = false; againForce = false; push(f); }
      }
    }

    /** Schedules one write no sooner than `minGap` after the last one. */
    function pace(now) {
      if (timer) return;
      timer = setTimeout(() => { timer = 0; push(false); }, Math.max(now ? 0 : 2500, lastSet + gap - Date.now()));
    }

    function absorb(W) {
      const S = opts.get();
      const L = toWire(S);
      const M = W ? merge(L, W) : L;
      if (canonWire(M, false) !== canonWire(L, false)) {
        const n = fromWire(M, S);
        opts.replace(n, { gained: balance(n.wallet) - balance(S.wallet) });
      }
      return M;
    }

    function onSnap(snap) {
      const W = snap.exists ? clone(snap.data()) : null;
      if (snap.metadata && snap.metadata.hasPendingWrites) return;
      if (snap.metadata && snap.metadata.fromCache) { if (W) absorb(W); return; }
      remote = W || undefined;
      ready = true;
      st.at = st.at || Date.now();
      const M = absorb(W);
      if (!W || canonWire(M, true) !== canonWire(W, true)) { if (gap) pace(true); else push(false); }
      else status("synced");
    }

    async function init() {
      if (starting || ref) return;
      starting = true;
      const ep = epoch;
      try { await connect(ep); } finally { starting = false; if (ep !== epoch) init(); }
    }

    async function connect(ep) {
      const c = opts.backend || root.claude;
      if (!c || typeof c.use !== "function") return status("local", "Not connected to claude.ai");
      let db = null, user = null;
      try { [db, user] = await Promise.all([c.use("db"), c.use("user")]); } catch (e) { db = null; }
      if (ep !== epoch) return;
      if (!db || !user) return status("local", "Cloud save isn't connected in this view");
      const uid = await user.id();
      if (ep !== epoch) return;
      if (!uid) return status("local", "Not signed in to claude.ai");
      let who = null;
      try { who = await user.me(); } catch (e) { who = null; }
      if (ep !== epoch) return;
      st.who = who;
      try { ref = db.doc("data/users/" + uid + "/save"); } catch (e) { return status("local", "Cloud save isn't available in this view."); }
      status("connecting");
      unsub = ref.onSnapshot(onSnap, onSnapErr);
    }

    init();
    return {
      status: () => Object.assign({}, st),
      notify(now) {
        if (!ref) return;
        if (gap) { pace(now); return; }
        clearTimeout(timer);
        timer = setTimeout(() => push(false), now ? 0 : 2500);
      },
      flush() { if (ref && ready) { clearTimeout(timer); timer = 0; return push(true); } },
      syncNow() {
        if (st.mode === "offline" || st.mode === "error") { retried = false; }
        if (!ref) { init(); return; }
        clearTimeout(timer); timer = 0;
        push(true);
      },
      restart() {
        epoch++;
        clearTimeout(timer); clearTimeout(revive); timer = 0;
        st.who = null; st.at = 0; remote = undefined; retried = false;
        stop("connecting");
        init();
      }
    };
  }

  const api = { SYNCED, canon, canonWire, merge, toWire, fromWire, balance, newId, start, mergeDaily, betterDay };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.OrchardCloud = api;
})(typeof window !== "undefined" ? window : this);
