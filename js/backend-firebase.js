(function (root) {
  "use strict";

  const SDK = "https://www.gstatic.com/firebasejs/12.19.0/";
  const EMU = { apiKey: "demo-api-key", authDomain: "127.0.0.1", projectId: "demo-orbit-orchard" };
  const SNAP_CODES = { "permission-denied": "not_granted", unauthenticated: "not_granted", "invalid-argument": "invalid_argument", "resource-exhausted": "resource_exhausted" };
  const SET_CODES = { "permission-denied": "quota_exceeded", "invalid-argument": "quota_exceeded", unauthenticated: "not_granted", "resource-exhausted": "resource_exhausted" };
  const REDIRECT = ["auth/popup-blocked", "auth/operation-not-supported-in-this-environment"];

  const emu = new URLSearchParams(location.search).get("emu") === "1";
  const cfg = root.ORCHARD_FIREBASE_CONFIG;
  const configured = emu || !!(cfg && cfg.apiKey && cfg.projectId);
  let fb = null, loading = null, failed = false, account = null, known = false, signing = false;
  let markKnown;
  const knownP = new Promise((r) => { markKnown = r; });
  const subs = [];
  const tell = (kind, err) => subs.forEach((f) => { try { f(kind, err); } catch (e) {} });
  const canon = (v) => (root.OrchardCloud ? root.OrchardCloud.canon(v) : JSON.stringify(v));
  const code = (e, map) => ({ code: map[e && e.code] || "unavailable", message: (e && e.message) || "" });

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
    const m = /^data\/users\/([^/]+)\/([^/]+)$/.exec(path);
    if (!m) throw Object.assign(new Error("Unsupported path " + path), { code: "invalid_argument" });
    return fb.fs.doc(fb.db, "users", m[1], "data", m[2]);
  }

  /** Plain snapshot in the shape cloud.js reads. */
  function wrap(s) {
    const d = s.exists() ? s.data() : undefined;
    return {
      id: s.id, exists: d !== undefined,
      data: () => (d === undefined ? undefined : JSON.parse(JSON.stringify(d))),
      metadata: { fromCache: !!s.metadata.fromCache, hasPendingWrites: !!s.metadata.hasPendingWrites }
    };
  }

  /** Document handle with `get`, `set` and `onSnapshot` over Firestore. */
  function docRef(ref) {
    let online = true, seen = null;
    return {
      id: ref.id, path: ref.path,
      get: () => fb.fs.getDoc(ref).then(wrap, (e) => { throw code(e, SNAP_CODES); }),
      set(data) {
        if (!online || navigator.onLine === false) return Promise.reject({ code: "unavailable", message: "offline" });
        seen = canon(data);
        return fb.fs.setDoc(ref, data).catch((e) => { throw code(e, SET_CODES); });
      },
      onSnapshot(next, fail) {
        return fb.fs.onSnapshot(ref, { includeMetadataChanges: true }, (s) => {
          const m = s.metadata;
          online = !m.fromCache;
          if (m.hasPendingWrites) return;
          if (!m.fromCache) {
            const key = s.exists() ? canon(s.data()) : "";
            if (key === seen) return;
            seen = key;
          }
          next(wrap(s));
          if (m.fromCache) fail({ code: "unavailable", message: "offline" });
        }, (e) => fail(code(e, SNAP_CODES)));
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

  /** Rewrites cloud.js's "local" reasons for this site. */
  function view(st) {
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
    signIn, signOut, view
  };
  load().catch(() => {});
})(window);
