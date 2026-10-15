const fs = require("fs");
const path = require("path");
const vm = require("vm");
const G = require("./gen-dst.js");

const ROOT = path.join(__dirname, "../..");
const ADAPTER = fs.readFileSync(path.join(ROOT, "js/backend-firebase.js"), "utf8").replace(/\bimport\(/g, "__imp(");
const CLOUD = fs.readFileSync(path.join(ROOT, "js/cloud.js"), "utf8");
const RULES = fs.readFileSync(path.join(ROOT, "firebase/firestore.rules"), "utf8");
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const LA = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" });
const LAH = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", hourCycle: "h23" });
const pacDay = (t) => { const p = {}; LA.formatToParts(new Date(t)).forEach((x) => { p[x.type] = +x.value; }); return Date.UTC(p.year, p.month - 1, p.day) / 864e5; };
const NOON = (12 - +LAH.format(new Date())) * 36e5;
const CAPS = { save: 100, friends: 20, keys: 10, pins: 20, chal: 40, sent: 40 };

let pass = 0, failN = 0;
function ok(c, name, extra) { if (c) { pass++; console.log("ok   " + name); } else { failN++; console.log("FAIL " + name + (extra !== undefined ? " :: " + JSON.stringify(extra) : "")); } }
async function waitFor(f, ms) { const t = Date.now(); while (Date.now() - t < (ms || 3000)) { if (f()) return true; await sleep(10); } return !!f(); }

/** Shared fake Firestore that applies the allowance rules: day id, lockstep claims, caps and daily counters. */
function newServer() {
  const S = { docs: {}, listeners: [], writes: 0, reads: 0, claims: 0, shift: NOON, skew: 0 };
  S.now = () => Date.now() + S.shift + S.skew;
  S.day = () => pacDay(S.now());
  const capOf = (p) => { const m = /^users\/[^/]+\/data\/(\w+)$/.exec(p); return m ? CAPS[m[1]] || 0 : /^pub\//.test(p) ? 20 : /^cards\/[^/]+\/to\//.test(p) ? 12 : 0; };
  const seated = (uid) => !!S.docs["days/" + S.day() + "/u/" + uid];
  S.allow = (p, d, uid) => {
    const cap = capOf(p);
    if (/^(inbox|codes|feedback)\//.test(p) && !seated(uid)) return false;
    if (!cap) return true;
    const q = d && d.q, old = S.docs[p] && S.docs[p].q, day = S.day();
    if (!q || q.d !== day || !Number.isInteger(q.n) || q.n > cap) return false;
    return old && old.d === day ? q.n === old.n + 1 : q.n === 1 && seated(uid);
  };
  S.put = (p, d) => { if (d === undefined) delete S.docs[p]; else S.docs[p] = clone(d); S.listeners.filter((l) => l.match(p)).forEach((l) => l.emit()); };
  return S;
}

function fakeSdk(S, o) {
  const auth = { user: null, cbs: [] }, client = { listeners: [], seen: {} };
  const uid = () => auth.user && auth.user.uid;
  const denied = () => Promise.reject({ code: "permission-denied", message: "denied" });
  const docSnap = (p) => { const d = clone(S.docs[p]); return { id: p.split("/").pop(), ref: { path: p }, exists: () => d !== undefined, data: () => d, metadata: { fromCache: false, hasPendingWrites: false } }; };
  const kids = (c) => Object.keys(S.docs).filter((p) => p.indexOf(c + "/") === 0 && p.split("/").length === c.split("/").length + 1).sort();
  const qSnap = (c, prev) => {
    const ids = kids(c), docs = ids.map(docSnap), ch = ids.filter((p) => !prev || prev[p] !== JSON.stringify(S.docs[p])).concat(Object.keys(prev || {}).filter((p) => ids.indexOf(p) < 0));
    return { docs, size: docs.length, metadata: { fromCache: false, hasPendingWrites: false }, docChanges: () => ch.map((p) => ({ doc: { id: p } })) };
  };
  const firestore = {
    getFirestore: () => ({}), connectFirestoreEmulator() {},
    doc: (db, ...segs) => { const p = segs.join("/"); return { type: "document", id: p.split("/").pop(), path: p }; },
    collection: (db, ...segs) => ({ type: "collection", path: segs.join("/") }),
    getDoc: (ref) => { S.reads++; return Promise.resolve(docSnap(ref.path)); },
    getDocs: (ref) => { const s = qSnap(ref.path); S.reads += Math.max(1, s.size); return Promise.resolve(s); },
    setDoc(ref, d) { if (!S.allow(ref.path, d, uid())) return denied(); S.writes++; S.put(ref.path, d); return Promise.resolve(); },
    deleteDoc(ref) { S.writes++; S.put(ref.path, undefined); return Promise.resolve(); },
    writeBatch() {
      const ops = [];
      return { set: (r, d) => ops.push([r.path, d]), delete: (r) => ops.push([r.path, undefined]), commit: () => (ops.every((x) => x[1] === undefined || S.allow(x[0], x[1], uid())) ? (S.writes += ops.length, ops.forEach((x) => S.put(x[0], x[1])), Promise.resolve()) : denied()) };
    },
    runTransaction(db, fn) {
      const put = [], tx = { get: (r) => { S.reads++; return Promise.resolve(docSnap(r.path)); }, set: (r, d) => put.push([r.path, d]) };
      return fn(tx).then((v) => {
        if (!put.length) return v;
        const day = String(S.day()), c = put.find((x) => x[0] === "days/" + day), s = put.find((x) => x[0] === "days/" + day + "/u/" + uid());
        const n0 = (S.docs["days/" + day] || { n: 0 }).n, k0 = (S.docs["days/" + day + "/u/" + uid()] || { k: 0 }).k;
        if (put.length !== 2 || !c || !s || c[1].n !== n0 + 1 || s[1].k !== k0 + 1 || c[1].n > 400 || s[1].k > 4) return denied();
        S.writes += 2; S.claims++;
        put.forEach((x) => S.put(x[0], x[1]));
        return v;
      });
    },
    onSnapshot(ref, opts, next, err) {
      const col = ref.type === "collection";
      let prev = null;
      const l = {
        match: (p) => (col ? p.indexOf(ref.path + "/") === 0 : p === ref.path),
        emit() {
          if (col) { const s = qSnap(ref.path, prev); prev = {}; kids(ref.path).forEach((p) => { prev[p] = JSON.stringify(S.docs[p]); }); next(s); }
          else next(docSnap(ref.path));
        }
      };
      S.listeners.push(l); client.listeners.push(l);
      if (!col && client.seen[ref.path] && S.docs[ref.path] !== undefined) setTimeout(() => { if (S.listeners.indexOf(l) >= 0) next(Object.assign(docSnap(ref.path), { metadata: { fromCache: true, hasPendingWrites: false } })); }, 1);
      client.seen[ref.path] = 1;
      setTimeout(() => { if (S.listeners.indexOf(l) >= 0) l.emit(); }, 4);
      return () => { S.listeners.splice(S.listeners.indexOf(l), 1); client.listeners.splice(client.listeners.indexOf(l), 1); };
    }
  };
  const authMod = {
    getAuth: () => auth, connectAuthEmulator() {}, getRedirectResult: () => Promise.resolve(null),
    onAuthStateChanged: (a, cb) => { a.cbs.push(cb); setTimeout(() => cb(a.user), 1); },
    GoogleAuthProvider: function () { this.setCustomParameters = () => {}; },
    signInWithPopup: () => sleep(1).then(() => { auth.user = o.account; auth.cbs.forEach((f) => f(auth.user)); }),
    signOut: () => sleep(1).then(() => { auth.user = null; auth.cbs.forEach((f) => f(null)); })
  };
  return { auth, client, mods: { "firebase-app.js": { initializeApp: () => ({}) }, "firebase-auth.js": authMod, "firebase-firestore.js": firestore } };
}

function storage() {
  const m = new Map();
  return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), key: (i) => Array.from(m.keys())[i] || null, get length() { return m.size; } };
}

/** A browser page with cloud.js and the adapter, signed in as `uid`, sharing `store` with other pages of the same browser. */
async function page(S, uid, o) {
  o = Object.assign({ store: storage(), search: "?emu=1" }, o);
  const sdk = fakeSdk(S, { account: { uid, displayName: uid, email: uid + "@example.com" } });
  sdk.auth.user = { uid, displayName: uid, email: uid + "@example.com" };
  const clock = { shift: S.shift };
  class PageDate extends Date { constructor(...a) { if (a.length) super(...a); else super(Date.now() + clock.shift); } static now() { return Date.now() + clock.shift; } }
  const ctx = {
    setTimeout: (f, ms) => setTimeout(f, ms >= 100000 && ms <= 300000 ? 10 : ms), clearTimeout, Promise, URLSearchParams, console, JSON, Math, Date: PageDate, Intl,
    location: { search: o.search, hostname: "127.0.0.1", host: "127.0.0.1:8000" }, navigator: { userAgent: "Firefox", onLine: true, maxTouchPoints: 0 },
    localStorage: o.store, ORCHARD_FIREBASE_CONFIG: { apiKey: "k", projectId: "p" },
    __imp: (url) => Promise.resolve(sdk.mods[url.split("/").pop()])
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(CLOUD, ctx);
  vm.runInContext(ADAPTER, ctx);
  const web = ctx.OrchardWeb;
  await web.use("user");
  const F = await web.sdk();
  const events = [];
  web.meter.on((k) => events.push(k));
  return { ctx, web, M: web.meter, F, sdk, store: o.store, clock, events, ref: (p) => F.fs.doc(F.db, p), col: (p) => F.fs.collection(F.db, p) };
}

function freshSave(dev) {
  return {
    v: 2, levels: {}, ach: {}, flora: {}, seen: {}, fails: {}, coach: {}, announced: {}, skins: { nocturne: 1 },
    stats: { sown: 0, plants: 0, pollen: 0, playMs: 0, wins: 0 }, settings: { skin: "nocturne", grid: true },
    daily: { last: null, streak: 0, best: 0, days: {} }, wallet: { earn: {}, spend: {}, frost: {} },
    sync: { dev, gen: 0, others: {}, settingsAt: 0, st: null }
  };
}
function game(p, gap) {
  const g = { S: freshSave("d-" + Math.random()), st: null, modes: [] };
  g.cloud = p.ctx.OrchardCloud.start({ backend: p.web, minGap: gap, get: () => g.S, replace: (n) => { g.S = n; }, onStatus: (st) => { g.st = p.web.view(st); g.modes.push(st.mode); } });
  p.web.on((k) => { if (k === "wake" && g.st && g.st.mode === "resting") g.cloud.syncNow(); });
  return g;
}

(async () => {
  const P = await page(newServer(), "probe");
  const day = P.M.day, reset = P.M.reset;

  let bad = [];
  for (let y = G.FROM; y <= G.TO; y++) for (let t = Date.UTC(y, 0, 1); t < Date.UTC(y + 1, 0, 1); t += 36e5) if (day(t) !== pacDay(t)) bad.push(t);
  ok(!bad.length, "day number matches Intl America/Los_Angeles every hour of " + G.FROM + "-" + G.TO, bad.slice(0, 3));
  bad = [];
  G.table.forEach((r) => r.forEach((edge) => { for (let t = edge - 3 * 36e5; t <= edge + 3 * 36e5; t += 6e4) if (day(t) !== pacDay(t)) bad.push(t); }));
  ok(!bad.length, "day number matches Intl minute by minute within 3 hours of every DST change", bad.slice(0, 3));
  const off = (t) => { const p = {}; new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", timeZoneName: "shortOffset" }).formatToParts(new Date(t)).forEach((x) => { p[x.type] = x.value; }); return p.timeZoneName; };
  ok(G.table.every((r) => off(r[0] - 1) === "GMT-8" && off(r[0]) === "GMT-7" && off(r[1] - 1) === "GMT-7" && off(r[1]) === "GMT-8"), "each table entry is exactly where Intl switches between UTC-8 and UTC-7");
  bad = [];
  for (let d = day(Date.UTC(G.FROM, 0, 1)); d < day(Date.UTC(G.TO, 11, 31)); d++) { const r = reset(d); if (day(r) !== d + 1 || day(r - 1) !== d || pacDay(r) !== d + 1 || pacDay(r - 1) !== d) bad.push(d); }
  ok(!bad.length, "reset(d) is the first millisecond of the next Pacific day for every day in the table", bad.slice(0, 3));
  ok(ADAPTER.indexOf(G.client.replace(/^ +/, "")) >= 0, "client DST table is the generated one");
  ok(RULES.indexOf(G.rules) >= 0, "rules dst() table is the generated one");
  ok(/let t = request\.time\.toMillis\(\);\n\s+return \(t - \(dst\(t\) \? 25200000 : 28800000\)\) \/ 86400000;/.test(RULES), "rules today() uses the same offsets and integer division");
  ok(/day: 400, user: 4, writes: 36, reads: 90/.test(ADAPTER) && /n <= 400/.test(RULES) && /k <= 4/.test(RULES), "client constants and rule caps agree (400 blocks, 4 per user)");
  ok(/'save': 100, 'friends': 20, 'keys': 10, 'pins': 20, 'chal': 40, 'sent': 40/.test(RULES) && /CAPS = \{ save: 100, friends: 20, keys: 10, pins: 20, chal: 40, sent: 40, pub: 20, card: 12 \}/.test(ADAPTER) && /counted\(20\)/.test(RULES) && /counted\(12\)/.test(RULES), "per-doc caps agree between client and rules");

  {
    const S = newServer(), store = storage();
    const A = await page(S, "ann", { store, search: "?emu=1&allow=6,20" });
    await A.M.ready();
    const d = S.day();
    let st = A.M.state();
    ok(S.claims === 1 && S.docs["days/" + d].n === 1 && S.docs["days/" + d + "/u/ann"].k === 1, "ready() claims the first block: counter and seat both 1", S.docs);
    ok(st.b === 1 && st.w === 2 && st.r === 6, "a claim counts 2 writes and 6 reads (2 read in the transaction, 4 by rules)", st);
    ok(A.M.left() === 4 + 3 * 4, "left(): rest of this block plus three more claimable blocks", A.M.left());
    const r0 = S.reads;
    await A.M.set(A.ref("users/ann/data/pins"), { v: 1, p: {} });
    st = A.M.state();
    ok(S.reads === r0 + 1 && st.w === 3 && st.r === 8, "unknown doc: one counted get first, then a write that also counts the seat lookup", [S.reads - r0, st]);
    ok(S.docs["users/ann/data/pins"].q.d === d && S.docs["users/ann/data/pins"].q.n === 1, "the write carries q = { d: today, n: 1 }", S.docs["users/ann/data/pins"]);
    await A.M.set(A.ref("users/ann/data/pins"), { v: 1, p: { x: 1 } });
    ok(S.docs["users/ann/data/pins"].q.n === 2 && A.M.state().r === 8 && S.reads === r0 + 1, "the next write is n 2, with no read and no seat lookup", [S.docs["users/ann/data/pins"].q, A.M.state()]);
    const g = await A.M.get(A.ref("users/ann/data/pins"));
    ok(g.exists && !("q" in g.data()) && g.data().p.x === 1, "get() returns the data without q", g.data());
    await A.M.set(A.ref("users/ann/data/pins"), { v: 1, p: { x: 2 } });
    await A.M.set(A.ref("users/ann/data/pins"), { v: 1, p: { x: 3 } });
    ok(S.claims === 1 && A.M.state().w === 6, "a block covers exactly its 6 writes, the claim's 2 included", A.M.state());
    await A.M.set(A.ref("users/ann/data/pins"), { v: 1, p: { x: 4 } });
    st = A.M.state();
    ok(S.claims === 2 && st.b === 2 && st.w === 9, "the next write claims a second block first", st);

    const B = await page(S, "ann", { store, search: "?emu=1&allow=6,20" });
    const c0 = S.claims;
    await B.M.ready();
    ok(S.claims === c0 && B.M.state().b === 2 && B.M.state().w === A.M.state().w, "a reload in the same browser resumes the stored counts without claiming", B.M.state());
    await B.M.set(B.ref("users/ann/data/keys"), { v: 1, jwk: {}, at: 1 });
    ok(A.M.state().w === B.M.state().w, "two tabs of one browser share one pool", [A.M.state().w, B.M.state().w]);

    const r1 = A.M.state().r, c1 = S.claims, un = A.M.listen(A.ref("users/ann/data/save"), () => {}, () => {});
    await sleep(20);
    ok(A.M.state().r === r1 + 1, "a listener's first snapshot counts one read", A.M.state().r - r1);
    for (let i = 0; i < 25; i++) S.put("users/ann/data/save", { v: 2, i });
    await sleep(30);
    ok(S.claims > c1 && A.M.state().r === r1 + 26 + 6 * (S.claims - c1), "each changed snapshot counts a read and the read allowance claims more blocks", [A.M.state().r - r1, S.claims - c1]);
    un();
    const rq = A.M.state().r, uq = A.M.listen(A.col("inbox/ann/items"), () => {}, () => {});
    await sleep(20);
    S.put("inbox/ann/items/x_1", { a: 1 }); S.put("inbox/ann/items/x_2", { a: 1 });
    await sleep(20);
    ok(A.M.state().r - rq === 1 + 1 + 1, "query listener: max(1, docs) first, then docChanges", A.M.state().r - rq);
    uq();

    while (S.claims < 4) await A.M.set(A.ref("users/ann/data/chal"), { v: 1, out: {}, res: {} }).catch(() => {});
    const w0 = S.writes;
    let e = null;
    while (!e) await A.M.set(A.ref("users/ann/data/chal"), { v: 1, out: {}, res: {} }).catch((x) => { e = x; });
    ok(e.code === "resting" && S.docs["days/" + d + "/u/ann"].k === 4, "user cap: after 4 blocks a write is refused with `resting`", [e, S.docs["days/" + d + "/u/ann"]]);
    ok(S.writes - w0 <= 6, "no write goes past the last block's allowance", S.writes - w0);
    const rec = JSON.parse(store.getItem("oo.meter.ann"));
    ok(rec.d === d && rec.rest === "self" && A.events.indexOf("rest") >= 0, "the rest is stored as oo.meter.<uid> = { d, rest: self } and announced", rec);
    const C = await page(S, "ann", { store, search: "?emu=1&allow=6,20" }), rr = S.reads;
    let e2 = null;
    await C.M.ready().catch((x) => { e2 = x; });
    ok(e2 && e2.code === "resting" && S.reads === rr, "a new page in that browser rests at once with no reads", [e2, S.reads - rr]);
    ok(C.M.why() === "self" && C.M.until() === reset(d), "why() is self and the rest lasts until the next Pacific midnight", [C.M.why(), C.M.until(), reset(d)]);
    ok(A.M.left() === 0, "left() is 0 once resting");
  }

  {
    const S = newServer();
    const d = S.day();
    S.docs["days/" + d] = { n: 400 };
    const A = await page(S, "bo"), r0 = S.reads;
    let e = null;
    await A.M.ready().catch((x) => { e = x; });
    ok(e && e.code === "resting" && A.M.why() === "full" && S.reads === r0 + 1, "full day: ready() rests after reading only the counter", [e, A.M.why(), S.reads - r0]);
    S.docs["days/" + d] = { n: 378 };
    const B = await page(S, "cy");
    await B.M.ready();
    ok(!B.M.slow(), "not slow below 380 blocks", B.M.state());
    const C = await page(S, "di");
    await C.M.ready();
    ok(C.M.slow(), "slow once the day count reaches 380", C.M.state().info);
    S.docs["days/" + d] = { n: 10 };
    const E = await page(S, "ed", { search: "?emu=1&allow=8,40" });
    for (let i = 0; i < 3; i++) { await E.M.set(E.ref("users/ed/data/sent"), { v: 1, s: { i } }); while (E.M.state().w < E.M.state().b * 8) await E.M.set(E.ref("users/ed/data/sent"), { v: 1, s: { i } }); }
    await E.M.set(E.ref("users/ed/data/sent"), { v: 1, s: {} });
    ok(E.M.state().info.k === 4 && !E.M.slow(), "4th block fresh: not slow yet", E.M.state());
    while (E.M.state().w < 3.75 * 8 + 0.01) await E.M.set(E.ref("users/ed/data/sent"), { v: 1, s: {} });
    ok(E.M.slow(), "4th block at 75% spent: slow", E.M.state());
  }

  {
    const S = newServer(), d = S.day();
    const A = await page(S, "fi"), B = await page(S, "fi");
    await A.M.ready(); await B.M.ready();
    const P1 = "users/fi/data/friends";
    await A.M.set(A.ref(P1), { v: 1, f: {} });
    await B.M.get(B.ref(P1));
    await A.M.set(A.ref(P1), { v: 1, f: { a: 1 } });
    const r0 = S.reads, w0 = S.writes;
    await B.M.set(B.ref(P1), { v: 1, f: { b: 1 } });
    ok(S.docs[P1].q.n === 3 && S.docs[P1].f.b === 1 && S.reads === r0 + 1 && S.writes === w0 + 1, "a stale counter (another device wrote) is re-read once and the write retried", [S.docs[P1].q, S.reads - r0, S.writes - w0]);
    S.docs[P1] = { v: 1, f: {}, q: { d, n: 20 } };
    await A.M.get(A.ref(P1));
    let e = null;
    const w1 = S.writes;
    await A.M.set(A.ref(P1), { v: 1, f: {} }).catch((x) => { e = x; });
    ok(e && e.code === "resting" && S.writes === w1, "a doc at its daily cap is refused locally with `resting`", e);
    ok(A.M.room(P1) === 0 && A.M.room("users/fi/data/save") === 100, "room() reports what's left of each doc's cap");
    S.docs[P1] = { v: 1, f: {}, q: { d: d - 1, n: 20 } };
    await A.M.get(A.ref(P1));
    await A.M.set(A.ref(P1), { v: 1, f: {} });
    ok(S.docs[P1].q.d === d && S.docs[P1].q.n === 1, "yesterday's counter starts again at n 1", S.docs[P1].q);
    S.docs[P1] = { v: 1, f: {} };
    await A.M.get(A.ref(P1));
    await A.M.set(A.ref(P1), { v: 1, f: {} });
    ok(S.docs[P1].q.n === 1, "an old doc without q starts at n 1", S.docs[P1].q);
    S.docs["cards/fi/to/x"] = { iv: "i", ct: "c", at: 1, q: { d, n: 4 } };
    const r1 = S.reads;
    const L = await A.M.list(A.col("cards/fi/to"));
    ok(L.size === 1 && !("q" in L.docs[0].data()), "list() strips q from each doc", L.docs[0].data());
    await A.M.batch([[A.ref("cards/fi/to/x"), { iv: "i", ct: "c", at: 2 }], [A.ref("cards/fi/to/y"), { iv: "i", ct: "c", at: 2 }], [A.ref("cards/fi/to/z"), null]]);
    ok(S.reads === r1 + 1 && S.docs["cards/fi/to/x"].q.n === 5 && S.docs["cards/fi/to/y"].q.n === 1, "batch: listed docs need no extra gets; each set carries its own next q", [S.reads - r1, S.docs["cards/fi/to/x"], S.docs["cards/fi/to/y"]]);
    await A.M.batch([[A.ref("cards/fi/to/y"), null]]);
    ok(!S.docs["cards/fi/to/y"] && A.M.room("cards/fi/to/y") === 12, "a deleted card doc is known to be gone");
    await A.M.set(A.ref("codes/ABC234"), { u: "fi" });
    ok(S.docs["codes/ABC234"] && !("q" in S.docs["codes/ABC234"]), "seat-gated creates go through without q", S.docs["codes/ABC234"]);
    const db = await A.web.use("db"), fp = "feedback/fi/m/" + d + "-0", f0 = A.M.state();
    await db.doc(fp).set({ v: 1, u: "fi", cat: "bug", msg: "0123456789", at: 1 });
    const f1 = A.M.state();
    ok(S.docs[fp] && !("q" in S.docs[fp]) && f1.w - f0.w === 1 && f1.r - f0.r === 1, "a feedback note maps to feedback/<uid>/m/<day>-<n>, carries no q and counts 1 write and 1 seat read", [S.docs[fp], f0, f1]);
    const bad = ["feedback/fi/m/hello", "feedback/fi/m/" + d + "-0/x", "feedback/fi/x/" + d + "-0", "feedback/fi/m/../save"].filter((p) => { try { db.doc(p); return true; } catch (e) { return e.code !== "invalid_argument"; } });
    ok(!bad.length, "the adapter refuses feedback paths that aren't <day>-<n>", bad);
    S.docs["pub/fi"] = { x: "x", y: "y", at: 1, q: { d, n: 1 } };
    const pg = await db.doc("pub/fi").get(), u0 = A.M.state();
    await db.batch([["pub/fi", { x: "x", y: "y", at: 2, un: "Fi_1", ut: 1 }], ["names/fi_1", { u: "fi", n: "Fi_1" }], ["names/old_fi", null]]);
    const u1 = A.M.state();
    ok(!("q" in pg.data()) && S.docs["pub/fi"].q.n === 2 && S.docs["pub/fi"].un === "Fi_1" && S.docs["names/fi_1"].u === "fi" && !("q" in S.docs["names/fi_1"]) && u1.w - u0.w === 3 && u1.r - u0.r === 2,
      "a username batch maps pub/<uid> and names/<key>, puts q only on pub and counts 3 writes and 2 rule reads", [S.docs["pub/fi"], S.docs["names/fi_1"], u0, u1]);
    const badN = ["names/Fi_1", "names/ab", "names/" + "a".repeat(21), "names/1fi", "names/fi/x", "names/../save", "names/f\u0131x", "pub/../x", "pub/a b", "pub/fi/x", "names", "pub"].filter((p) => { try { db.doc(p); return true; } catch (e) { return e.code !== "invalid_argument"; } });
    ok(!badN.length, "the adapter refuses names keys that aren't lowercase ids and pub paths that aren't one uid", badN);
    let be = null;
    await db.batch([["names/Fi_1", { u: "fi", n: "Fi_1" }]]).catch((e) => { be = e; });
    ok(be && be.code === "invalid_argument" && !S.docs["names/Fi_1"], "a batch with an unmapped path is refused before anything is sent", be);
    const seen = [];
    const un = A.M.listen(A.ref("users/fi/data/friends"), (s) => seen.push(s), () => {});
    await sleep(20);
    ok(seen.length && !("q" in seen[0].data()) && seen[0].exists === true, "listener snapshots arrive without q", seen[0] && seen[0].data());
    un();
  }

  {
    const S = newServer();
    const A = await page(S, "gil");
    const g = game(A, 0);
    await waitFor(() => g.st && g.st.mode === "synced");
    g.S.levels["w1-01"] = { stars: 3, golden: false, best: 1, time: 9, clears: 1 };
    g.cloud.notify(true);
    await waitFor(() => S.docs["users/gil/data/save"] && S.docs["users/gil/data/save"].levels["w1-01"]);
    const w0 = S.writes;
    for (let i = 0; i < 10; i++) { g.cloud.notify(true); await sleep(5); }
    await sleep(100);
    ok(S.writes === w0 && g.st.mode === "synced", "cloud save: q on the server never causes a rewrite of an unchanged save", [S.writes - w0, g.st.mode]);
    ok(S.docs["users/gil/data/save"].q.d === S.day() && S.docs["users/gil/data/save"].q.n === 2, "cloud save writes carry q (two writes today: n 2)", S.docs["users/gil/data/save"].q);
  }

  {
    const S = newServer();
    const A = await page(S, "hal", { search: "?emu=1&allow=6,40" });
    const g = game(A, 0);
    await waitFor(() => g.st && g.st.mode === "synced");
    for (let i = 0; i < 40 && g.st.mode !== "resting"; i++) { g.S.stats.sown++; g.cloud.notify(true); await sleep(15); }
    await waitFor(() => g.st.mode === "resting");
    ok(g.st.mode === "resting", "cloud save rests when the personal allowance is used up", g.modes.slice(-4));
    ok(/^Today's cloud sync allowance is used up\. Progress is saved on this device and syncs again after \d{1,2}:\d{2}\s?[AP]M\.$/.test(g.st.reason), "resting text names the local reset time", g.st.reason);
    ok(!S.listeners.length, "resting cloud save detaches its listener");
    const w0 = S.writes, sown = g.S.stats.sown + 5;
    g.S.stats.sown = sown; g.cloud.notify(true); g.cloud.flush(); g.cloud.syncNow();
    await sleep(80);
    ok(S.writes === w0 && g.st.mode === "resting", "while resting nothing is written and progress stays local", [S.writes - w0, g.st.mode]);
  }

  {
    const S = newServer(), d = S.day();
    S.docs["days/" + d] = { n: 400 };
    const A = await page(S, "ida");
    const g = game(A, 0);
    await waitFor(() => g.st && g.st.mode === "resting");
    ok(g.st.mode === "resting" && /^Cloud sync is full for today\. Progress is saved on this device and syncs again after /.test(g.st.reason), "full day: cloud save rests with the day-full text", g.st);
  }

  {
    const S = newServer(), d = S.day();
    const A = await page(S, "jo", { search: "?emu=1&allow=6,40&rest=1" });
    const g = game(A, 0);
    await waitFor(() => g.st && g.st.mode === "synced");
    for (let i = 0; i < 40 && g.st.mode !== "resting"; i++) { g.S.stats.sown++; g.cloud.notify(true); await sleep(15); }
    await waitFor(() => g.st.mode === "resting");
    g.S.levels["w2-01"] = { stars: 2, golden: false, best: 3, time: 20, clears: 1 };
    delete S.docs["days/" + d + "/u/jo"]; S.docs["days/" + d] = { n: 0 };
    ok(g.st.mode === "resting" && !(S.docs["users/jo/data/save"].levels || {})["w2-01"], "dev rest: resting with w2-01 only on the device");
    await waitFor(() => g.st.mode === "synced" && (S.docs["users/jo/data/save"].levels || {})["w2-01"], 4000);
    ok(A.events.indexOf("wake") >= 0 && g.st.mode === "synced" && !!S.docs["users/jo/data/save"].levels["w2-01"], "after the rest the meter wakes, cloud save reconnects and uploads w2-01", [A.events, g.st.mode]);
    ok(g.modes.slice(g.modes.lastIndexOf("resting")).indexOf("offline") < 0, "the cached snapshot replayed on reconnect is not taken for offline", g.modes);
  }

  {
    const S = newServer(), d = S.day();
    const A = await page(S, "kim", { search: "?emu=1&allow=50,9" });
    const g = game(A, 0);
    await waitFor(() => g.st && g.st.mode === "synced");
    const w0 = S.writes;
    for (let i = 0; i < 60 && g.st.mode !== "resting"; i++) { const cur = S.docs["users/kim/data/save"]; S.put("users/kim/data/save", Object.assign({}, cur, { at: i, q: { d, n: cur.q.n + 1 } })); await sleep(10); }
    await waitFor(() => g.st.mode === "resting");
    ok(g.st.mode === "resting" && S.docs["days/" + d + "/u/kim"].k === 4 && !S.listeners.length, "listener reads alone use up 4 blocks, then cloud save rests and detaches", [g.st.mode, S.docs["days/" + d + "/u/kim"]]);
    ok(S.writes - w0 <= 8, "no save writes were made while only reading", S.writes - w0);
  }

  {
    const S = newServer(), d = S.day();
    const A = await page(S, "lu");
    A.clock.shift = reset(d) - Date.now() + 5 * 6e4;
    S.shift = reset(d) - Date.now() - 5 * 6e4;
    let e = null;
    await A.M.set(A.ref("users/lu/data/pins"), { v: 1, p: {} }).catch((x) => { e = x; });
    ok(e && e.code === "unavailable" && !A.M.state().asleep && S.writes === 0, "near the Pacific midnight a refused claim is transient, not a rest", [e, A.M.state()]);
    S.shift = A.clock.shift;
    A.clock.shift += 5 * 6e4; S.shift += 5 * 6e4;
    await A.M.set(A.ref("users/lu/data/pins"), { v: 1, p: {} });
    ok(S.docs["users/lu/data/pins"].q.d === d + 1, "once the server reaches the new day the write goes through", S.docs["users/lu/data/pins"].q);
  }

  console.log(failN ? `METER FAIL ${failN} of ${pass + failN}` : `METER PASS ${pass} checks`);
  process.exit(failN ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
