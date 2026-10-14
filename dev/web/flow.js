const SDK = "https://www.gstatic.com/firebasejs/12.19.0/";
const PROJECT = "demo-orbit-orchard";
const ALICE = { sub: "alice-google-1", email: "alice@example.com", name: "Alice Example", email_verified: true };
const HOLD = encodeURIComponent(new URLSearchParams(location.search).get("k") || "webflow");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fails = 0;
const out = (s) => { document.getElementById("log").textContent += s + "\n"; console.log("[t] WEB " + s); };
function ok(c, name, extra) { if (c) pass++; else fails++; out((c ? "ok   " : "FAIL ") + name + (extra !== undefined && !c ? " :: " + JSON.stringify(extra) : "")); }

const frames = {}, waits = {}, calls = {};
let seq = 0;
addEventListener("message", (e) => {
  if (e.data && e.data.__ready && waits[e.data.__ready]) { const f = waits[e.data.__ready]; delete waits[e.data.__ready]; f(); }
  if (e.data && e.data.__t && calls[e.data.__t]) { calls[e.data.__t](e.data); delete calls[e.data.__t]; }
});
function load(origin) {
  return new Promise((res) => {
    waits[origin] = res;
    let f = frames[origin];
    if (!f) { f = frames[origin] = document.createElement("iframe"); document.getElementById("frames").appendChild(f); }
    f.src = origin + "/dev/web/site/index.html?emu=1&t=" + Date.now();
  });
}
function call(origin, fn, ...args) {
  return new Promise((res, rej) => {
    const id = ++seq;
    calls[id] = (d) => (d.err ? rej(new Error(d.err)) : res(d.r));
    frames[origin].contentWindow.postMessage({ __t: id, fn, args }, "*");
  });
}
async function until(origin, f, ms) {
  const t = Date.now();
  let s = await call(origin, "state");
  while (!f(s) && Date.now() - t < (ms || 10000)) { await sleep(150); s = await call(origin, "state"); }
  return s;
}
const has = (arr, ids) => ids.every((x) => arr.indexOf(x) >= 0);
const BASE = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents/`;
const H = { Authorization: "Bearer owner", "Content-Type": "application/json" };
const toV = (v) => v === null || v === undefined ? { nullValue: null } : typeof v === "boolean" ? { booleanValue: v } : typeof v === "number" ? (Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v })
  : typeof v === "string" ? { stringValue: v } : Array.isArray(v) ? { arrayValue: { values: v.map(toV) } } : { mapValue: { fields: toF(v) } };
const toF = (o) => Object.keys(o).reduce((m, k) => { m[k] = toV(o[k]); return m; }, {});
const fromV = (v) => "nullValue" in v ? null : "booleanValue" in v ? v.booleanValue : "integerValue" in v ? +v.integerValue : "doubleValue" in v ? v.doubleValue : "stringValue" in v ? v.stringValue
  : "arrayValue" in v ? (v.arrayValue.values || []).map(fromV) : "mapValue" in v ? fromF(v.mapValue.fields || {}) : null;
const fromF = (f) => Object.keys(f).reduce((m, k) => { m[k] = fromV(f[k]); return m; }, {});
const aset = (p, o) => fetch(BASE + p, { method: "PATCH", headers: H, body: JSON.stringify({ fields: toF(o) }) });
const aget = async (p) => { const r = await fetch(BASE + p, { headers: H }); return r.status === 404 ? null : fromF((await r.json()).fields || {}); };

function freshSave(dev) {
  return {
    v: 2, levels: {}, ach: {}, flora: {}, seen: {}, fails: {}, coach: {}, announced: {}, skins: { nocturne: 1 },
    stats: { sown: 5, plants: 2, pollen: 0, playMs: 60000, wins: 1 }, settings: { skin: "nocturne", grid: true },
    daily: { last: null, streak: 0, best: 0, days: {} }, wallet: { earn: {}, spend: {}, frost: {} },
    sync: { dev, gen: 0, others: {}, settingsAt: 0, st: null }
  };
}

(async () => {
  const [A, au, fs] = await Promise.all(["app", "auth", "firestore"].map((m) => import(SDK + "firebase-" + m + ".js")));
  const app = A.initializeApp({ apiKey: "demo-api-key", authDomain: "127.0.0.1", projectId: PROJECT }, "harness");
  const auth = au.initializeAuth(app, { persistence: au.inMemoryPersistence });
  au.connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  const db = fs.getFirestore(app);
  fs.connectFirestoreEmulator(db, "127.0.0.1", 8080);
  await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: "DELETE" });
  await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${PROJECT}/accounts`, { method: "DELETE" });
  await au.signInWithCredential(auth, au.GoogleAuthProvider.credential(JSON.stringify(ALICE)));
  const uid = auth.currentUser.uid;
  const ref = fs.doc(db, "users", uid, "data", "save");
  const seed = freshSave("devcloud");
  seed.levels["w1-02"] = { stars: 3, golden: false, best: 1, time: 12, clears: 1 };
  seed.wallet.earn["clear:w1-02"] = 10;
  await aset("users/" + uid + "/data/save", Object.assign(OrchardCloud.toWire(seed), { at: Date.now() }));
  const cloud = async () => { const s = await fs.getDocFromServer(ref); return s.exists() ? s.data() : null; };
  const cloudLevels = async () => Object.keys(((await cloud()) || {}).levels || {}).sort();
  ok(has(await cloudLevels(), ["w1-02"]), "cloud seeded for alice with w1-02");

  const PA = "http://127.0.0.1:" + location.port, PB = "http://localhost:" + location.port;
  await load(PA);
  let s = await until(PA, (x) => x.titleSign, 10000);
  ok(s.titleSign && s.screen === "title", "signed out: title shows the Google sign-in prompt", s);
  ok(s.tabs.length === 9 && s.tabs.indexOf("friends") === 8, "Friends tab present, 9 tabs", s.tabs);
  const pop = await call(PA, "clickTitleSignIn");
  ok(/127\.0\.0\.1:9099\/emulator\/auth\/handler/.test(pop.url) && /google\.com/.test(pop.url), "title button opens the Google sign-in popup", pop.url);
  ok(pop.screen === "title" && !pop.busy, "closing the popup stays on the title, quietly", pop);
  await call(PA, "enterHub");
  ok((await call(PA, "key", "8")) === "settings", "key 8 opens Settings");
  ok((await call(PA, "key", "9")) === "friends", "key 9 opens Friends");
  ok(/Sign in with Google to add friends and trade challenges/.test(await call(PA, "panelText")), "signed out: Friends asks to sign in with Google");
  let card = await call(PA, "settings");
  ok(/Not signed in/.test(card.text) && card.buttons.indexOf("Sign in with Google") >= 0 && card.buttons.indexOf("Download save") >= 0 && card.buttons.indexOf("Load a save file") >= 0 && card.buttons.indexOf("Sign out") < 0, "signed out: Settings card offers Google sign-in", card);
  ok(/Not signed in/.test((await call(PA, "state")).chip), "signed out: cloud chip says Not signed in");

  const p1 = await call(PA, "play", 1, 1);
  ok(p1.phase === "won" && has(p1.levels, ["w1-01"]), "signed-out play saves w1-01 locally", p1);
  ok(!has(await cloudLevels(), ["w1-01"]), "signed-out play writes nothing to the cloud");

  const uA = await call(PA, "signIn", ALICE);
  ok(uA === uid, "device A signs in as alice");
  s = await until(PA, (x) => has(x.levels, ["w1-01", "w1-02"]), 10000);
  ok(has(s.levels, ["w1-01", "w1-02"]), "first sign-in: local save gains the cloud's w1-02 and keeps w1-01", s.levels);
  await sleep(1500);
  ok(has(await cloudLevels(), ["w1-01", "w1-02"]), "first sign-in: cloud gains w1-01");
  ok((await call(PA, "notes")).some((n) => /Signed in as alice@example\.com/.test(n)), "sign-in note names the account");
  const mA = await call(PA, "meter"), saveQ = ((await aget("users/" + uid + "/data/save")) || {}).q || {}, dayDoc = await aget("days/" + mA.day), seat = await aget("days/" + mA.day + "/u/" + uid);
  ok(mA.state.b === 1 && dayDoc && dayDoc.n === 1 && seat && seat.k === 1, "sign-in claims one allowance block: days/<day> n 1, alice's seat k 1", { mA, dayDoc, seat });
  ok(saveQ.d === mA.day && saveQ.n >= 1, "the save carries today's counter q", saveQ);
  card = await call(PA, "settings");
  ok(/Alice Example/.test(card.text) && /alice@example\.com/.test(card.text) && /Synced/.test(card.text) && card.buttons.indexOf("Sign out") >= 0 && card.buttons.indexOf("Sync now") >= 0, "signed in: card shows name, email, Synced, Sync now and Sign out", card);
  ok(!(await call(PA, "state")).titleSign, "signed in: title prompt hidden");

  await load(PB);
  s = await call(PB, "state");
  ok(!s.account && s.levels.length === 0, "device B starts fresh and signed out", s);
  await call(PB, "signIn", ALICE);
  s = await until(PB, (x) => has(x.levels, ["w1-01", "w1-02"]), 10000);
  ok(has(s.levels, ["w1-01", "w1-02"]), "device B receives the save on sign-in", s.levels);

  const t0 = Date.now();
  const p3 = await call(PA, "play", 1, 3);
  ok(has(p3.levels, ["w1-03"]), "device A clears w1-03", p3);
  s = await until(PB, (x) => has(x.levels, ["w1-03"]), 135000);
  ok(has(s.levels, ["w1-03"]), "device B receives w1-03 live", { ms: Date.now() - t0, levels: s.levels });
  out("w1-03 reached device B after " + (Date.now() - t0) + " ms (120 s write gap)");

  await load(PA);
  await call(PA, "enterHub");
  s = await until(PA, (x) => x.account && /Synced/.test(x.chip), 10000);
  ok(s.account && s.account.email === "alice@example.com" && /Synced/.test(s.chip), "reload keeps alice signed in and synced", s);

  const dl = await call(PA, "download");
  ok(dl && dl.format === "orbit-orchard-save" && dl.version === 2 && has(Object.keys(dl.save.levels), ["w1-01", "w1-02", "w1-03"]), "Download save builds the save file", dl && Object.keys(dl.save.levels));
  const file = { format: "orbit-orchard-save", version: 2, exportedAt: new Date().toISOString(), save: Object.assign({}, dl.save, { levels: Object.assign({}, dl.save.levels, { "w1-05": { stars: 2, golden: false, best: 4, time: 30, clears: 1 } }) }) };
  const ld = await call(PA, "loadFile", JSON.stringify(file));
  ok(has(ld.levels, ["w1-05"]) && /Save merged/.test(ld.note), "Load a save file merges w1-05", ld);

  await call(PA, "settings");
  await call(PA, "click", "#cloudCard [data-c=signout]");
  s = await until(PA, (x) => !x.account, 8000);
  ok(!s.account && has(s.levels, ["w1-05"]), "sign out: account cleared, local save kept", s);
  card = await call(PA, "card");
  ok(card.buttons.indexOf("Sign in with Google") >= 0 && card.buttons.indexOf("Sign out") < 0 && /Not signed in/.test(card.text), "sign out: card offers sign-in again", card);
  ok((await call(PA, "notes")).some((n) => /Signed out/.test(n)), "sign out: note says progress stays");
  await sleep(1000);
  ok(has(await cloudLevels(), ["w1-05"]), "sign out: pending progress was flushed first");
  const p4 = await call(PA, "play", 1, 4);
  ok(has(p4.levels, ["w1-04"]), "signed out again: w1-04 saved locally", p4);
  await call(PA, "pagehide");
  await sleep(4000);
  ok(!has(await cloudLevels(), ["w1-04"]), "sign out: sync stopped, w1-04 never reaches the cloud");
  s = await until(PB, (x) => has(x.levels, ["w1-05"]), 40000);
  ok(has(s.levels, ["w1-05"]) && s.levels.indexOf("w1-04") < 0, "device B got w1-05, not w1-04", s.levels);

  const day = (await call(PB, "meter")).day, dayEnd = await aget("days/" + day);
  ok(dayEnd && dayEnd.n >= 2 && dayEnd.n <= 6, "two devices and a reload used a handful of blocks", dayEnd);
  const eA = (await call(PA, "state")).errs, eB = (await call(PB, "state")).errs;
  ok(eA.length === 0 && eB.length === 0, "no console errors or warnings on either device", { A: eA, B: eB });
  out(fails ? `FAIL ${fails} of ${pass + fails}` : `PASS ${pass} checks`);
  fetch("/__release?k=" + HOLD);
})().catch((e) => { out("FAIL harness " + String(e) + " " + ((e && (e.code || e.stack)) || "")); out(`FAIL ${fails + 1} of ${pass + fails + 1}`); fetch("/__release?k=" + HOLD); });
