(function (root) {
  "use strict";

  const SDK = "https://www.gstatic.com/firebasejs/12.19.0/";
  const EMU = { apiKey: "demo-api-key", authDomain: "127.0.0.1", projectId: "demo-orbit-orchard" };
  const SNAP_CODES = { "permission-denied": "not_granted", unauthenticated: "not_granted", "invalid-argument": "invalid_argument", "resource-exhausted": "resource_exhausted", resting: "resting", not_granted: "not_granted" };
  const SET_CODES = { "permission-denied": "quota_exceeded", "invalid-argument": "quota_exceeded", unauthenticated: "not_granted", "resource-exhausted": "resource_exhausted", resting: "resting", not_granted: "not_granted" };
  const REDIRECT = ["auth/popup-blocked", "auth/operation-not-supported-in-this-environment"];
  const ALLOW = { day: 400, user: 4, writes: 36, reads: 90, near: 380 };
  const CAPS = { save: 100, friends: 20, keys: 10, pins: 20, chal: 40, sent: 40, pub: 20, card: 12 };
  const DST = [[1772964000000, 1793523600000], [1805018400000, 1825578000000], [1836468000000, 1857027600000], [1867917600000, 1888477200000], [1899367200000, 1919926800000], [1930816800000, 1951376400000], [1962871200000, 1983430800000], [1994320800000, 2014880400000], [2025770400000, 2046330000000], [2057220000000, 2077779600000], [2088669600000, 2109229200000]];
  const DAY = 86400000, PDT = 25200000, PST = 28800000, EDGE = 900000, JITTER = 600000, CLAIM_W = 2, CLAIM_R = 4, CLAIM_TRIES = 3;

  const qp = new URLSearchParams(location.search);
  const emu = qp.get("emu") === "1";
  const dev = emu || !!root.ORCHARD_DEV;
  const devAllow = dev && /^\d+,\d+$/.test(qp.get("allow") || "") ? qp.get("allow").split(",").map(Number) : null;
  const devRest = dev ? Number(qp.get("rest")) || 0 : 0;
  const cfg = root.ORCHARD_FIREBASE_CONFIG;
  const configured = emu || !!(cfg && cfg.apiKey && cfg.projectId);
  let fb = null, loading = null, failed = false, account = null, known = false, signing = false;
  let markKnown;
  const knownP = new Promise((r) => { markKnown = r; });
  const subs = [];
  const tell = (kind, err) => subs.forEach((f) => { try { f(kind, err); } catch (e) {} });
  const canon = (v) => (root.OrchardCloud ? root.OrchardCloud.canon(v) : JSON.stringify(v));
  const code = (e, map) => ({ code: map[e && e.code] || "unavailable", message: (e && e.message) || "" });
  const isObj = (v) => v != null && typeof v === "object" && !Array.isArray(v);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const dst = (t) => DST.some((r) => t >= r[0] && t < r[1]);
  const dayOf = (t) => Math.floor((t - (dst(t) ? PDT : PST)) / DAY);
  const resetOf = (d) => { const a = (d + 1) * DAY + PDT; return dst(a) ? a : a - PDT + PST; };
  const today = () => dayOf(Date.now());
  const nearEdge = (t) => { const d = dayOf(t); return t - resetOf(d - 1) < EDGE || resetOf(d) - t < EDGE; };
  const capOf = (p) => {
    const m = /^users\/[^/]+\/data\/(save|friends|keys|pins|chal|sent)$/.exec(p);
    return m ? CAPS[m[1]] : /^pub\/[^/]+$/.test(p) ? CAPS.pub : /^cards\/[^/]+\/to\/[^/]+$/.test(p) ? CAPS.card : 0;
  };
  const gateOf = (p) => (/^inbox\//.test(p) ? 2 : /^(codes|feedback)\//.test(p) ? 1 : 0);
  const strip = (d) => { if (!isObj(d) || !("q" in d)) return d; const c = Object.assign({}, d); delete c.q; return c; };
  const metaOf = (m) => ({ fromCache: !!(m && m.fromCache), hasPendingWrites: !!(m && m.hasPendingWrites) });
  const plainDoc = (id, d, m) => ({ id, exists: d !== undefined, data: () => (d === undefined ? undefined : JSON.parse(JSON.stringify(strip(d)))), metadata: metaOf(m) });
  const plainQuery = (s) => ({ size: s.size, docs: s.docs.map((x) => plainDoc(x.id, x.data())), metadata: metaOf(s.metadata) });
  const ls = {
    get(k) { try { return JSON.parse(root.localStorage.getItem(k) || "null"); } catch (e) { return null; } },
    set(k, v) { try { root.localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { root.localStorage.removeItem(k); } catch (e) {} },
    keys(pre) { try { const a = []; for (let i = 0; i < root.localStorage.length; i++) { const k = root.localStorage.key(i); if (k && k.indexOf(pre) === 0) a.push(k); } return a; } catch (e) { return []; } }
  };

  /** Firebase app options for this host. */
  function appConfig() {
    if (emu) return Object.assign({}, EMU);
    const c = Object.assign({}, cfg);
    if (/\.(web\.app|firebaseapp\.com)$/.test(location.hostname)) c.authDomain = location.host;
    return c;
  }

  function settle() { if (!known) { known = true; markKnown(); } }

  /** Loads the Firebase SDK once and starts watching the signed-in account. */
  function load() {
    if (loading) return loading;
    const mods = configured ? Promise.all(["app", "auth", "firestore"].map((m) => import(SDK + "firebase-" + m + ".js"))) : Promise.reject(new Error("Firebase isn't configured"));
    loading = mods.then(([A, au, fs]) => {
      const app = A.initializeApp(appConfig());
      const auth = au.getAuth(app);
      const db = fs.getFirestore(app);
      if (emu) {
        au.connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
        fs.connectFirestoreEmulator(db, "127.0.0.1", 8080);
      }
      fb = { au, fs, auth, db };
      au.getRedirectResult(auth).catch((e) => tell("error", e));
      au.onAuthStateChanged(auth, (u) => {
        const first = !known;
        account = u ? { uid: u.uid, name: u.displayName || "", email: u.email || "", photo: u.photoURL || "" } : null;
        settle();
        tell(first ? "init" : "auth");
      });
      return fb;
    }, (e) => {
      failed = true;
      settle();
      tell("init");
      throw e;
    });
    return loading;
  }

  function mapPath(path) {
    const m = /^data\/users\/([^/]+)\/([^/]+)$/.exec(path), f = /^feedback\/([^/]+)\/m\/(\d+-\d)$/.exec(path);
    if (m) return fb.fs.doc(fb.db, "users", m[1], "data", m[2]);
    if (f) return fb.fs.doc(fb.db, "feedback", f[1], "m", f[2]);
    throw Object.assign(new Error("Unsupported path " + path), { code: "invalid_argument" });
  }

  /** Today's allowance for one account in this browser: blocks claimed in Firestore, writes and reads counted per page in localStorage. */
  function meterFor(uid) {
    const base = "oo.meter." + uid, page = base + "." + Math.random().toString(36).slice(2, 10), jit = Math.random() * JITTER;
    const lim = { w: devAllow ? devAllow[0] : ALLOW.writes, r: devAllow ? devAllow[1] : ALLOW.reads };
    const qs = {}, lists = {};
    let mine = { d: -1, b: 0, w: 0, r: 0 }, claiming = null, retryAt = 0, wakeT = 0, asleep = false;

    const info = () => { const i = ls.get(base); return isObj(i) && i.d === today() ? i : { d: today() }; };
    const note = (o) => ls.set(base, Object.assign(info(), o));
    const tellMe = (k) => { if (account && account.uid === uid) mtell(k); };
    const resting = () => ({ code: "resting", message: "Today's cloud allowance is used up" });
    const later = (m) => ({ code: "unavailable", message: m });

    function roll() {
      const d = today();
      if (mine.d === d) return;
      mine = { d, b: 0, w: 0, r: 0 };
      ls.keys(base + ".").forEach((k) => { const s = ls.get(k); if (!isObj(s) || s.d !== d) ls.del(k); });
    }
    function totals() {
      roll();
      const t = { b: mine.b, w: mine.w, r: mine.r };
      ls.keys(base + ".").forEach((k) => { const s = k !== page && ls.get(k); if (isObj(s) && s.d === mine.d) { t.b += s.b | 0; t.w += s.w | 0; t.r += s.r | 0; } });
      return t;
    }
    function add(b, w, r) { roll(); mine.b += b; mine.w += w; mine.r += r; ls.set(page, mine); }

    const wakeAt = () => { const i = info(); return devRest && i.rest ? (+i.at || 0) + devRest * 1000 : resetOf(today()) + jit; };
    function arm() { clearTimeout(wakeT); wakeT = setTimeout(wake, Math.max(1000, Math.min(wakeAt() - Date.now(), 2147483647))); }
    function wake() {
      const i = info();
      if (devRest && i.rest && Date.now() >= (+i.at || 0) + devRest * 1000) note({ rest: null, k: 0, n: 0 });
      arm();
      if (info().rest) return;
      asleep = false; retryAt = 0;
      tellMe("wake");
    }
    function rest(why) {
      note({ rest: why, at: Date.now() });
      asleep = true;
      arm();
      tellMe("rest");
      throw resting();
    }

    function claim() {
      if (!claiming) claiming = grab().then((v) => { claiming = null; return v; }, (e) => { claiming = null; throw e; });
      return claiming;
    }
    /** Claims one block: raises the day's counter and this account's seat together in one transaction. */
    async function grab() {
      const i = info();
      if (i.rest) return rest(i.rest);
      if ((i.k | 0) >= ALLOW.user) return rest("self");
      if ((i.n | 0) >= ALLOW.day) return rest("full");
      if (Date.now() < retryAt) throw later("claim later");
      if (navigator.onLine === false) throw later("offline");
      const d = String(today()), c = fb.fs.doc(fb.db, "days", d), s = fb.fs.doc(fb.db, "days", d, "u", uid);
      let got = 0, r = null;
      for (let a = 0; ; a++) {
        try {
          r = await fb.fs.runTransaction(fb.db, async (tx) => {
            const cs = await tx.get(c);
            got++;
            const n = cs.exists() ? cs.data().n | 0 : 0;
            if (n >= ALLOW.day) return { why: "full", n };
            const ss = await tx.get(s);
            got++;
            const k = ss.exists() ? ss.data().k | 0 : 0;
            if (k >= ALLOW.user) return { why: "self", n, k };
            tx.set(c, { n: n + 1 });
            tx.set(s, { k: k + 1 });
            return { n: n + 1, k: k + 1 };
          });
          break;
        } catch (e) {
          if (e && e.code === "permission-denied" && a < CLAIM_TRIES && !nearEdge(Date.now())) { await sleep(300 + Math.random() * 1200); continue; }
          add(0, 0, got);
          const now = Date.now();
          retryAt = now + (nearEdge(now) ? 120000 + Math.random() * 120000 : e && e.code === "permission-denied" ? 1800000 : 15000 + Math.random() * 15000);
          throw later((e && e.message) || "claim failed");
        }
      }
      note({ n: r.n, k: r.k });
      if (r.why) { add(0, 0, got); return rest(r.why); }
      add(1, CLAIM_W, got + CLAIM_R);
      tellMe("claim");
    }

    /** Takes writes and reads from today's allowance, claiming blocks as needed; `dry` only checks. */
    async function take(w, r, dry) {
      for (;;) {
        const t = totals();
        if (t.b > 0 && t.w + w <= t.b * lim.w && t.r + r <= t.b * lim.r) { if (!dry) add(0, w, r); return; }
        await claim();
      }
    }
    function count(r) {
      if (!(r > 0)) return;
      add(0, 0, r);
      const t = totals();
      if (!asleep && (t.b === 0 || t.r >= t.b * lim.r)) claim().catch(() => {});
    }

    const known = (p) => p in qs || !!lists[p.slice(0, p.lastIndexOf("/"))];
    const qOf = (p) => { const o = qs[p], d = today(); return o && o.d === d ? { d, n: o.n + 1 } : { d, n: 1 }; };
    function saw(p, d) { if (capOf(p)) qs[p] = isObj(d) && isObj(d.q) && typeof d.q.d === "number" && typeof d.q.n === "number" ? { d: d.q.d, n: d.q.n } : null; }

    async function get(ref) {
      await take(0, 1);
      const s = await fb.fs.getDoc(ref), d = s.exists() ? s.data() : undefined;
      saw(ref.path, d);
      return plainDoc(s.id, d, s.metadata);
    }
    async function list(ref) {
      await take(0, 1);
      const s = await fb.fs.getDocs(ref);
      count(s.size - 1);
      lists[ref.path] = 1;
      s.docs.forEach((x) => saw(x.ref.path, x.data()));
      return plainQuery(s);
    }
    /** Retries a refused write: once after re-reading its counters, then once more a few minutes later near the Pacific midnight. */
    async function retry(e, tries, refs, again) {
      if (!e || e.code !== "permission-denied" || tries >= 2) throw e;
      const m = refs.filter((x) => capOf(x.path));
      if (!tries && m.length) { for (const x of m) await get(x); return again(1); }
      if (!refs.length || !nearEdge(Date.now())) throw e;
      await sleep(120000 + Math.random() * 120000);
      return again(2);
    }
    /** Writes a document; metered paths carry the next daily counter `q`. */
    async function set(ref, data, tries) {
      const p = ref.path, cap = capOf(p);
      if (cap && !known(p)) await get(ref);
      const q = cap ? qOf(p) : null;
      if (q && q.n > cap) throw resting();
      await take(1, gateOf(p) + (q && q.n === 1 ? 1 : 0));
      try { await fb.fs.setDoc(ref, q ? Object.assign({}, data, { q }) : data); }
      catch (e) { return retry(e, tries | 0, cap || gateOf(p) ? [ref] : [], (n) => set(ref, data, n)); }
      if (q) qs[p] = q;
    }
    async function del(ref) {
      await take(1, 0);
      await fb.fs.deleteDoc(ref);
      saw(ref.path, undefined);
    }
    /** Commits `[ref, data]` sets and `[ref, null]` deletes as one batch, metered like `set`. */
    async function batch(ops, tries) {
      for (const o of ops) if (o[1] && capOf(o[0].path) && !known(o[0].path)) await get(o[0]);
      const qv = ops.map((o) => (o[1] && capOf(o[0].path) ? qOf(o[0].path) : null));
      if (qv.some((q, i) => q && q.n > capOf(ops[i][0].path))) throw resting();
      await take(ops.length, qv.some((q) => q && q.n === 1) ? 1 : 0);
      const w = fb.fs.writeBatch(fb.db);
      ops.forEach((o, i) => (o[1] ? w.set(o[0], qv[i] ? Object.assign({}, o[1], { q: qv[i] }) : o[1]) : w.delete(o[0])));
      try { await w.commit(); }
      catch (e) { return retry(e, tries | 0, ops.filter((o) => o[1]).map((o) => o[0]), (n) => batch(ops, n)); }
      ops.forEach((o, i) => { if (qv[i]) qs[o[0].path] = qv[i]; else if (!o[1]) saw(o[0].path, undefined); });
    }
    /** Listens with read counting; snapshots arrive as plain objects without `q`. */
    function listen(ref, next, err) {
      let fresh = true, last = null, live = true;
      const un = fb.fs.onSnapshot(ref, { includeMetadataChanges: true }, (s) => {
        const m = s.metadata, d = s.docs ? null : s.exists() ? s.data() : undefined;
        if (m.fromCache) fresh = true;
        else if (!m.hasPendingWrites) {
          if (s.docs) { count(fresh ? Math.max(1, s.size) : s.docChanges().length); s.docs.forEach((x) => saw(x.ref.path, x.data())); }
          else { const k = d === undefined ? "" : canon(d); if (fresh || k !== last) count(1); last = k; saw(ref.path, d); }
          fresh = false;
        }
        if (live) next(s.docs ? plainQuery(s) : plainDoc(s.id, d, m));
      }, err);
      return () => { live = false; un(); };
    }

    arm();
    return {
      ready: () => take(1, 1, true), get, list, set, del, batch, listen, count,
      room: (p) => { const o = qs[p]; return Math.max(0, capOf(p) - (o && o.d === today() ? o.n : 0)); },
      left() {
        const t = totals(), i = info();
        return Math.max(0, t.b * lim.w - t.w) + (i.rest || (i.n | 0) >= ALLOW.day ? 0 : Math.max(0, ALLOW.user - (i.k | 0)) * (lim.w - CLAIM_W));
      },
      slow() {
        const t = totals(), i = info();
        return (i.n | 0) >= ALLOW.near || ((i.k | 0) >= ALLOW.user && t.b > 0 && (t.w >= (t.b - 0.25) * lim.w || t.r >= (t.b - 0.25) * lim.r));
      },
      why: () => info().rest || "self",
      until: () => { const i = info(); return devRest && i.rest ? (+i.at || 0) + devRest * 1000 : resetOf(today()); },
      state: () => Object.assign(totals(), { info: info(), asleep, lim }),
      poke() { if (asleep && !info().rest) wake(); }
    };
  }

  const meters = {}, msubs = [];
  const mtell = (k) => { msubs.slice().forEach((f) => { try { f(k); } catch (e) {} }); tell(k); };
  const signedOut = () => ({ code: "not_granted", message: "signed out" });
  const cur = () => (account && fb ? meters[account.uid] || (meters[account.uid] = meterFor(account.uid)) : null);
  const viaMeter = (name) => (...a) => { const m = cur(); return m ? m[name](...a) : Promise.reject(signedOut()); };
  const meter = {
    ready: viaMeter("ready"), get: viaMeter("get"), list: viaMeter("list"), set: viaMeter("set"), del: viaMeter("del"), batch: viaMeter("batch"),
    listen(ref, next, err) { const m = cur(); if (m) return m.listen(ref, next, err); err(signedOut()); return () => {}; },
    count: (n) => { const m = cur(); if (m) m.count(n); },
    room: (p) => { const m = cur(); return m ? m.room(p) : 0; },
    left: () => { const m = cur(); return m ? m.left() : 0; },
    slow: () => { const m = cur(); return !!m && m.slow(); },
    why: () => { const m = cur(); return m ? m.why() : "self"; },
    until: () => { const m = cur(); return m ? m.until() : resetOf(today()); },
    untilText: () => new Date(meter.until()).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
    state: () => { const m = cur(); return m ? m.state() : null; },
    on(f) { msubs.push(f); return () => { const i = msubs.indexOf(f); if (i >= 0) msubs.splice(i, 1); }; },
    day: dayOf, reset: resetOf, today, allow: ALLOW, caps: CAPS
  };
  if (root.document) document.addEventListener("visibilitychange", () => { if (!document.hidden) Object.keys(meters).forEach((k) => meters[k].poke()); });

  /** Document handle with `get`, `set` and `onSnapshot` over Firestore, metered by today's allowance. */
  function docRef(ref) {
    let online = true, seen = null;
    return {
      id: ref.id, path: ref.path,
      get: () => meter.get(ref).catch((e) => { throw code(e, SNAP_CODES); }),
      set(data) {
        if (!online || navigator.onLine === false) return Promise.reject({ code: "unavailable", message: "offline" });
        seen = canon(data);
        return meter.set(ref, data).catch((e) => { throw code(e, SET_CODES); });
      },
      onSnapshot(next, fail) {
        let un = null, dead = false, synced = false, wait = 0;
        const offline = () => fail({ code: "unavailable", message: "offline" });
        const end = () => { dead = true; off(); clearTimeout(wait); if (un) { un(); un = null; } };
        const off = meter.on((k) => { if (k === "rest" && !dead) { end(); fail({ code: "resting", message: "resting" }); } });
        meter.ready().then(() => {
          if (dead) return;
          un = meter.listen(ref, (s) => {
            const m = s.metadata;
            online = !m.fromCache;
            if (m.hasPendingWrites) return;
            if (!m.fromCache) {
              synced = true; clearTimeout(wait);
              const key = s.exists ? canon(s.data()) : "";
              if (key === seen) return;
              seen = key;
            }
            next(s);
            if (!m.fromCache) return;
            if (synced || navigator.onLine === false) offline();
            else if (!wait) wait = setTimeout(() => { if (!dead && !synced) offline(); }, 15000);
          }, (e) => fail(code(e, SNAP_CODES)));
        }, (e) => { if (!dead) { end(); fail(code(e, SNAP_CODES)); } });
        return end;
      }
    };
  }

  const userApi = {
    id: () => knownP.then(() => (account ? account.uid : null)),
    me: () => knownP.then(() => (account ? { id: account.uid, name: account.name, email: account.email, avatarUrl: account.photo } : null))
  };

  function mobileSafari() {
    const ua = navigator.userAgent || "";
    const ios = /iP(hone|ad|od)/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  }

  /** Signs in with Google: a popup, or a redirect when popups can't work. */
  async function signIn() {
    const F = await load();
    const p = new F.au.GoogleAuthProvider();
    p.setCustomParameters({ prompt: "select_account" });
    signing = true;
    tell("ui");
    try {
      if (mobileSafari()) { await F.au.signInWithRedirect(F.auth, p); return; }
      try { await F.au.signInWithPopup(F.auth, p); }
      catch (e) {
        if (e && REDIRECT.indexOf(e.code) >= 0) await F.au.signInWithRedirect(F.auth, p);
        else throw e;
      }
    } finally {
      signing = false;
      tell("ui");
    }
  }

  async function signOut() {
    const F = await load();
    await F.au.signOut(F.auth);
  }

  /** Rewrites cloud.js's "local" and "resting" reasons for this site. */
  function view(st) {
    if (st.mode === "resting") return Object.assign({}, st, { reason: (meter.why() === "full" ? "Cloud sync is full for today." : "Today's cloud sync allowance is used up.") + " Progress is saved on this device and syncs again after " + meter.untilText() + "." });
    if (st.mode !== "local") return st;
    const reason = !configured ? "Cloud save isn't set up on this site" : failed ? "Cloud save needs a connection. Reload when you're online." : !account ? "Not signed in" : "Cloud save isn't available right now";
    return Object.assign({}, st, { reason });
  }

  root.OrchardWeb = {
    use(name) {
      if (name === "db") return load().then(() => ({ doc: (path) => docRef(mapPath(path)) }));
      if (name === "user") return load().then(() => knownP).then(() => userApi);
      return Promise.resolve(null);
    },
    on(f) { subs.push(f); },
    account: () => account,
    known: () => known,
    sdk: () => load().then((f) => ({ fs: f.fs, db: f.db })),
    available: () => configured && !failed,
    busy: () => signing,
    signIn, signOut, view, meter
  };
  load().catch(() => {});
})(window);
