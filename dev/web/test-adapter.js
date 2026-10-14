const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "../..");
const ADAPTER = fs.readFileSync(path.join(ROOT, "js/backend-firebase.js"), "utf8").replace(/\bimport\(/g, "__imp(");
const CLOUD = fs.readFileSync(path.join(ROOT, "js/cloud.js"), "utf8");
const CONFIG = { apiKey: "key", authDomain: "orbit.firebaseapp.com", projectId: "orbit", appId: "1:2:web:3" };
const clone = (v) => JSON.parse(JSON.stringify(v));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SHIFT = (12 - +new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", hourCycle: "h23" }).format(new Date())) * 36e5;
class NoonDate extends Date { constructor(...a) { if (a.length) super(...a); else super(Date.now() + SHIFT); } static now() { return Date.now() + SHIFT; } }

let pass = 0, failN = 0;
function ok(c, name) { if (c) { pass++; console.log("ok   " + name); } else { failN++; console.log("FAIL " + name); } }
async function waitFor(f, ms) { const t = Date.now(); while (Date.now() - t < (ms || 3000)) { if (f()) return true; await sleep(10); } return !!f(); }

function newServer() { return { docs: {}, listeners: [], writes: 0, reads: 0, users: {} }; }

/** In-memory stand-in for the Firebase app, auth and firestore modules of one browser. */
function fakeSdk(server, o) {
  const log = { app: null, emuAuth: null, emuFs: null, popup: 0, redirect: 0 };
  const client = { online: true, listeners: [] };
  const snap = (p, fromCache, pending, data) => ({ id: p.split("/").pop(), exists: () => data !== undefined, data: () => (data === undefined ? undefined : clone(data)), metadata: { fromCache, hasPendingWrites: pending } });
  const emit = (l, fromCache, pending) => { server.reads += fromCache ? 0 : 1; l.next(snap(l.path, fromCache, pending, server.docs[l.path])); };
  const auth = { user: null, cbs: [] };
  const setUser = (u) => { auth.user = u; auth.cbs.slice().forEach((f) => f(u)); };
  const firestore = {
    getFirestore: () => ({}),
    connectFirestoreEmulator: (db, h, p) => { log.emuFs = h + ":" + p; },
    doc: (db, ...segs) => ({ id: segs[segs.length - 1], path: segs.join("/") }),
    getDoc: (ref) => Promise.resolve(snap(ref.path, false, false, server.docs[ref.path])),
    runTransaction(db, fn) {
      const put = [], tx = { get: (ref) => Promise.resolve(snap(ref.path, false, false, server.docs[ref.path])), set: (ref, d) => { put.push([ref.path, d]); } };
      return fn(tx).then((v) => { put.forEach((x) => { server.docs[x[0]] = clone(x[1]); }); server.claims = (server.claims || 0) + 1; return v; });
    },
    setDoc(ref, data) {
      if (o.setError) return Promise.reject({ code: o.setError });
      client.listeners.filter((l) => l.path === ref.path).forEach((l) => l.next(snap(l.path, false, true, data)));
      return sleep(5).then(() => {
        server.docs[ref.path] = clone(data);
        server.writes++;
        server.listeners.filter((l) => l.path === ref.path && l.client.online).forEach((l) => emit(l, false, false));
      });
    },
    onSnapshot(ref, opts, next, err) {
      const l = { path: ref.path, next, err, client };
      if (o.snapError) { setTimeout(() => err({ code: o.snapError }), 1); return () => {}; }
      server.listeners.push(l); client.listeners.push(l);
      setTimeout(() => { if (server.listeners.indexOf(l) >= 0) emit(l, !client.online, false); }, 2);
      return () => { server.listeners.splice(server.listeners.indexOf(l), 1); client.listeners.splice(client.listeners.indexOf(l), 1); };
    }
  };
  const authMod = {
    getAuth: () => auth,
    connectAuthEmulator: (a, url) => { log.emuAuth = url; },
    onAuthStateChanged: (a, cb) => { a.cbs.push(cb); setTimeout(() => cb(a.user), 1); },
    getRedirectResult: () => Promise.resolve(null),
    GoogleAuthProvider: function () { this.setCustomParameters = (p) => { this.params = p; }; },
    signInWithPopup() {
      log.popup++;
      if (o.popupError) return Promise.reject({ code: o.popupError });
      return sleep(1).then(() => setUser(o.account));
    },
    signInWithRedirect() { log.redirect++; return sleep(1).then(() => setUser(o.account)); },
    signOut: () => sleep(1).then(() => setUser(null))
  };
  const app = { initializeApp: (c) => { log.app = c; return {}; } };
  return {
    log, client, auth, setUser,
    mods: { "firebase-app.js": app, "firebase-auth.js": authMod, "firebase-firestore.js": firestore },
    goOffline() { client.online = false; client.listeners.slice().forEach((l) => emit(l, true, false)); },
    goOnline() { client.online = true; client.listeners.slice().forEach((l) => emit(l, false, false)); }
  };
}

/** A browser page with cloud.js and the adapter loaded. */
function page(server, o) {
  o = Object.assign({ account: { uid: "alice", displayName: "Alice Example", email: "alice@example.com", photoURL: "https://example.com/a.png" } }, o);
  const sdk = fakeSdk(server, o);
  const loc = o.loc || { search: "", hostname: "127.0.0.1", host: "127.0.0.1:8000" };
  const ctx = {
    setTimeout, clearTimeout, Promise, URLSearchParams, console, JSON, Math, Date: NoonDate,
    location: loc, navigator: { userAgent: o.ua || "Mozilla/5.0 (X11; Linux x86_64; rv:136.0) Gecko/20100101 Firefox/136.0", onLine: true, maxTouchPoints: 0 },
    ORCHARD_FIREBASE_CONFIG: o.config === undefined ? CONFIG : o.config,
    __imp: (url) => (url.indexOf("https://www.gstatic.com/firebasejs/") === 0 && sdk.mods[url.split("/").pop()] ? Promise.resolve(sdk.mods[url.split("/").pop()]) : Promise.reject(new Error("no module " + url)))
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(CLOUD, ctx);
  vm.runInContext(ADAPTER, ctx);
  return { ctx, sdk, web: ctx.OrchardWeb, C: ctx.OrchardCloud };
}

function freshSave(dev) {
  return {
    v: 2, levels: {}, ach: {}, flora: {}, seen: {}, fails: {}, coach: {}, announced: {}, skins: { nocturne: 1 },
    stats: { sown: 0, plants: 0, pollen: 0, playMs: 0, wins: 0 },
    settings: { skin: "nocturne", grid: true, master: 0.8 },
    daily: { last: null, streak: 0, best: 0, days: {} }, zen: { diff: 3, seed: null },
    wallet: { earn: {}, spend: {}, frost: {} },
    sync: { dev, gen: 0, others: {}, settingsAt: 0, st: null }
  };
}

/** Starts cloud sync on a page the way ui.js does. */
function game(p, S, gap) {
  const g = { S, statuses: [], replaced: 0 };
  g.cloud = p.C.start({
    backend: p.web, minGap: gap,
    get: () => g.S,
    replace: (n) => { g.S = n; g.replaced++; },
    onStatus: (st) => { g.st = p.web.view(st); g.statuses.push(g.st.mode); }
  });
  p.web.on((kind) => { if (kind === "auth") g.cloud.restart(); });
  return g;
}

(async () => {
  {
    const p = page(newServer());
    const db = await p.web.use("db");
    ok(db.doc("data/users/u1/save").path === "users/u1/data/save", "maps data/users/<uid>/save to users/<uid>/data/save");
    let threw = null;
    try { db.doc("cards/u1"); } catch (e) { threw = e; }
    ok(threw && threw.code === "invalid_argument", "rejects paths outside the player's save");
    ok(p.sdk.log.app.projectId === "orbit" && !p.sdk.log.emuAuth, "uses the configured project without emulators");
    const u = await p.web.use("user");
    ok((await u.id()) === null && (await u.me()) === null, "signed out: no id or profile");
    ok(p.web.known() && p.web.available() && !p.web.account(), "auth state known, SDK available, no account");
    ok(p.web.view({ mode: "local", reason: "Not signed in to claude.ai" }).reason === "Not signed in", "local reason says Not signed in");
    ok((await p.web.use("downloads")) === null, "other capabilities resolve to null");
    await p.web.signIn();
    ok(p.sdk.log.popup === 1 && p.sdk.log.redirect === 0, "desktop sign-in uses a popup");
    const me = await u.me();
    ok((await u.id()) === "alice" && me.name === "Alice Example" && me.email === "alice@example.com" && me.avatarUrl === "https://example.com/a.png", "signed in: id, name, email and avatar");
  }
  {
    const p = page(newServer(), { popupError: "auth/popup-blocked" });
    await p.web.signIn();
    ok(p.sdk.log.popup === 1 && p.sdk.log.redirect === 1 && p.web.account(), "blocked popup falls back to redirect");
  }
  {
    const p = page(newServer(), { popupError: "auth/popup-closed-by-user" });
    let err = null;
    try { await p.web.signIn(); } catch (e) { err = e; }
    ok(err && err.code === "auth/popup-closed-by-user" && p.sdk.log.redirect === 0 && !p.web.busy(), "closed popup rejects without a redirect");
  }
  {
    const p = page(newServer(), { ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" });
    await p.web.signIn();
    ok(p.sdk.log.popup === 0 && p.sdk.log.redirect === 1, "mobile Safari signs in with a redirect");
  }
  {
    const p = page(newServer(), { ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1" });
    await p.web.signIn();
    ok(p.sdk.log.popup === 1, "Chrome on iOS keeps the popup");
  }
  {
    const p = page(newServer(), { config: { apiKey: "", projectId: "" }, loc: { search: "?emu=1", hostname: "127.0.0.1", host: "127.0.0.1:8000" } });
    await p.web.use("db");
    ok(p.web.available(), "emu=1 works without a real config");
    ok(p.sdk.log.app.projectId === "demo-orbit-orchard" && p.sdk.log.app.apiKey === "demo-api-key", "emu=1 uses the demo project, not the live one");
    ok(p.sdk.log.emuAuth === "http://127.0.0.1:9099" && p.sdk.log.emuFs === "127.0.0.1:8080", "emu=1 connects the auth and firestore emulators");
  }
  {
    const p = page(newServer(), { loc: { search: "", hostname: "orbit.web.app", host: "orbit.web.app" } });
    await p.web.use("db");
    ok(p.sdk.log.app.authDomain === "orbit.web.app", "authDomain follows the hosting domain");
  }
  {
    const p = page(newServer(), { config: { apiKey: "", projectId: "" } });
    let err = null;
    try { await p.web.use("db"); } catch (e) { err = e; }
    ok(err && !p.web.available() && p.web.known(), "placeholder config: SDK not loaded, sign-in unavailable");
    ok(/isn't set up/.test(p.web.view({ mode: "local" }).reason), "placeholder config: says cloud save isn't set up");
    const g = game(p, freshSave("d0"), 300);
    await waitFor(() => g.st && g.st.mode === "local");
    ok(g.st.mode === "local", "placeholder config: game stays on local save");
  }
  {
    const server = newServer();
    const p = page(server);
    p.sdk.setUser({ uid: "alice" });
    await p.web.use("user");
    const db = await p.web.use("db");
    const ref = db.doc("data/users/alice/save");
    const seen = [];
    const un = ref.onSnapshot((s) => seen.push(s), () => {});
    await waitFor(() => seen.length === 1);
    ok(seen.length === 1 && seen[0].exists === false && typeof seen[0].data === "function", "first snapshot: plain exists flag and data()");
    await ref.set({ v: 2, a: 1 });
    await sleep(30);
    ok(seen.length === 1, "own write: pending and echo snapshots are not forwarded");
    server.docs["users/alice/data/save"] = { v: 2, a: 2 };
    server.listeners.forEach((l) => l.next({ id: "save", exists: () => true, data: () => ({ v: 2, a: 2 }), metadata: { fromCache: false, hasPendingWrites: false } }));
    ok(seen.length === 2 && seen[1].data().a === 2, "another device's write is forwarded");
    un();
    const errs = [];
    ref.onSnapshot((s) => seen.push(s), (e) => errs.push(e));
    await sleep(10);
    p.sdk.goOffline();
    ok(errs.length === 1 && errs[0].code === "unavailable" && seen[seen.length - 1].metadata.fromCache, "going offline: cached snapshot then unavailable");
    let rej = null;
    try { await ref.set({ v: 2 }); } catch (e) { rej = e; }
    ok(rej && rej.code === "unavailable", "writes are refused while offline instead of queued");
  }
  {
    const p = page(newServer(), { setError: "permission-denied" });
    p.sdk.setUser({ uid: "alice" });
    await p.web.use("user");
    const ref = (await p.web.use("db")).doc("data/users/alice/save");
    let e1 = null;
    try { await ref.set({}); } catch (e) { e1 = e; }
    ok(e1 && e1.code === "quota_exceeded", "rejected write maps to quota_exceeded");
    const p2 = page(newServer(), { snapError: "permission-denied" });
    p2.sdk.setUser({ uid: "alice" });
    await p2.web.use("user");
    const ref2 = (await p2.web.use("db")).doc("data/users/alice/save");
    const e2 = await new Promise((r) => ref2.onSnapshot(() => {}, r));
    ok(e2.code === "not_granted", "denied listener maps to not_granted");
  }

  const server = newServer();
  server.docs["users/alice/data/save"] = (() => {
    const p = page(newServer());
    const S = freshSave("devcloud");
    S.levels["w1-02"] = { stars: 2, golden: false, best: 3, time: 20, clears: 1 };
    S.stats.sown = 7;
    S.wallet.earn["clear:w1-02"] = 10;
    return Object.assign(p.C.toWire(S), { at: 1 });
  })();
  const A = page(server);
  const SA = freshSave("devA");
  SA.levels["w1-01"] = { stars: 3, golden: true, best: 1, time: 9, clears: 1 };
  SA.stats.sown = 3;
  SA.wallet.earn["clear:w1-01"] = 10;
  const gA = game(A, SA, 400);
  await waitFor(() => gA.st && gA.st.mode === "local");
  ok(gA.st.mode === "local" && gA.st.reason === "Not signed in" && server.writes === 0, "signed out: local save only, nothing written");
  gA.S.levels["w1-03"] = { stars: 1, golden: false, best: 5, time: 30, clears: 1 };
  gA.cloud.notify(true);
  await sleep(50);
  ok(server.writes === 0, "signed out: notify writes nothing");

  await A.web.signIn();
  await waitFor(() => gA.st.mode === "synced" && server.writes > 0);
  const doc = server.docs["users/alice/data/save"];
  ok(gA.st.mode === "synced" && gA.st.who && gA.st.who.email === "alice@example.com", "sign-in connects and reports the account");
  ok(gA.S.levels["w1-01"] && gA.S.levels["w1-02"] && gA.S.levels["w1-03"], "first sign-in: local save gains the cloud's plots and keeps its own");
  ok(doc.levels["w1-01"] && doc.levels["w1-02"] && doc.levels["w1-03"], "first sign-in: cloud save gains this device's plots");
  ok(gA.S.stats.sown === 10 && A.C.balance(gA.S.wallet) === 20, "first sign-in: stats and nectar from both sides add up");
  ok(server.writes === 1, "first sign-in: one merged write");

  const w0 = server.writes, t0 = Date.now();
  for (let i = 0; i < 40; i++) { gA.S.stats.sown++; gA.cloud.notify(i % 3 === 0); await sleep(75); }
  await sleep(450);
  const span = Date.now() - t0, made = server.writes - w0;
  ok(made >= 2 && made <= Math.ceil(span / 400) + 1, `paced writes: ${made} writes for 40 changes over ${span} ms with a 400 ms gap`);
  ok(server.docs["users/alice/data/save"].stats.devA.sown === gA.S.stats.sown - 7, "paced writes: the last change reaches the cloud");
  const w1 = server.writes;
  gA.S.stats.playMs += 5000;
  gA.cloud.flush();
  await waitFor(() => server.writes > w1);
  ok(server.writes === w1 + 1, "flush writes at once, play time included");

  const B = page(server);
  const gB = game(B, freshSave("devB"), 400);
  await waitFor(() => gB.st && gB.st.mode === "local");
  await B.web.signIn();
  await waitFor(() => gB.st.mode === "synced" && gB.S.levels["w1-03"]);
  ok(gB.S.levels["w1-01"] && gB.S.levels["w1-02"] && gB.S.levels["w1-03"] && A.C.balance(gB.S.wallet) === 20, "second device receives the save on sign-in");
  gA.S.levels["w1-04"] = { stars: 3, golden: false, best: 2, time: 11, clears: 1 };
  gA.cloud.notify(true);
  await waitFor(() => gB.S.levels["w1-04"], 3000);
  ok(!!gB.S.levels["w1-04"], "a later change on device A reaches device B live");

  await A.web.signOut();
  await waitFor(() => gA.st.mode === "local");
  ok(gA.st.mode === "local" && gA.st.reason === "Not signed in" && !gA.st.who, "sign out: back to local, account cleared");
  ok(gA.S.levels["w1-04"] && gA.S.levels["w1-02"], "sign out: progress stays on the device");
  const w2 = server.writes;
  gA.S.levels["w1-05"] = { stars: 1, golden: false, best: 6, time: 40, clears: 1 };
  gA.cloud.notify(true);
  gA.cloud.flush();
  gA.cloud.syncNow();
  await sleep(900);
  ok(server.writes === w2 && !server.docs["users/alice/data/save"].levels["w1-05"], "sign out: sync stops");
  ok(server.listeners.filter((l) => l.client === A.sdk.client).length === 0, "sign out: the listener is closed");

  B.sdk.goOffline();
  await waitFor(() => gB.st.mode === "offline");
  ok(gB.st.mode === "offline" && /Can't reach/.test(gB.st.reason), "offline: status says offline");
  gB.S.levels["w1-06"] = { stars: 2, golden: false, best: 4, time: 30, clears: 1 };
  B.sdk.goOnline();
  gB.cloud.syncNow();
  await waitFor(() => gB.st.mode === "synced" && server.docs["users/alice/data/save"].levels["w1-06"], 3000);
  ok(!!server.docs["users/alice/data/save"].levels["w1-06"], "back online: Sync now uploads the offline progress");

  console.log(failN ? `ADAPTER FAIL ${failN} of ${pass + failN}` : `ADAPTER PASS ${pass} checks`);
  process.exit(failN ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
