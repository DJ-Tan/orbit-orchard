const SDK = "https://www.gstatic.com/firebasejs/12.19.0/";
const PROJECT = "demo-orbit-orchard";
const Q = new URLSearchParams(location.search);
const HOLD = encodeURIComponent(Q.get("k") || "webrest");
const SEED = Q.get("seed") === "1";
const REST = 25;
const ALICE = { sub: "alice-google-1", email: "alice@example.com", name: "Alice Example", email_verified: true };
const BOB = { sub: "bob-google-2", email: "bob@example.com", name: "Bob Builder", email_verified: true };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fails = 0;
const out = (s) => { document.getElementById("log").textContent += s + "\n"; console.log("[t] REST " + s); };
function ok(c, name, extra) { if (c) pass++; else fails++; out((c ? "ok   " : "FAIL ") + name + (extra !== undefined && !c ? " :: " + JSON.stringify(extra).slice(0, 1500) : "")); return c; }

const frames = {}, waits = {}, calls = {};
let seq = 0;
addEventListener("message", (e) => {
  if (e.data && e.data.__ready && waits[e.data.__ready]) { const f = waits[e.data.__ready]; delete waits[e.data.__ready]; f(); }
  if (e.data && e.data.__t && calls[e.data.__t]) { calls[e.data.__t](e.data); delete calls[e.data.__t]; }
});
function load(origin, q) {
  return new Promise((res) => {
    waits[origin] = res;
    let f = frames[origin];
    if (!f) { f = frames[origin] = document.createElement("iframe"); document.getElementById("frames").appendChild(f); }
    f.src = origin + "/dev/web/site/index.html?emu=1&" + q + "&t=" + Date.now();
  });
}
function call(origin, fn, ...args) {
  return new Promise((res, rej) => {
    const id = ++seq;
    calls[id] = (d) => (d.err ? rej(new Error(fn + ": " + d.err)) : res(d.r));
    frames[origin].contentWindow.postMessage({ __t: id, fn, args }, "*");
  });
}
async function until(origin, fn, f, ms) {
  const t = Date.now();
  let s = await call(origin, fn);
  while (!f(s) && Date.now() - t < (ms || 15000)) { await sleep(300); s = await call(origin, fn); }
  return s;
}
async function waitAdmin(f, ms) { const t = Date.now(); let v = await f(); while (!v && Date.now() - t < (ms || 15000)) { await sleep(500); v = await f(); } return v; }

const BASE = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents/`;
const H = { Authorization: "Bearer owner", "Content-Type": "application/json" };
const toV = (v) => v === null || v === undefined ? { nullValue: null } : typeof v === "boolean" ? { booleanValue: v } : typeof v === "number" ? (Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v })
  : typeof v === "string" ? { stringValue: v } : Array.isArray(v) ? { arrayValue: { values: v.map(toV) } } : { mapValue: { fields: toF(v) } };
const toF = (o) => Object.keys(o).reduce((m, k) => { m[k] = toV(o[k]); return m; }, {});
const fromV = (v) => "nullValue" in v ? null : "booleanValue" in v ? v.booleanValue : "integerValue" in v ? +v.integerValue : "doubleValue" in v ? v.doubleValue : "stringValue" in v ? v.stringValue
  : "arrayValue" in v ? (v.arrayValue.values || []).map(fromV) : "mapValue" in v ? fromF(v.mapValue.fields || {}) : null;
const fromF = (f) => Object.keys(f).reduce((m, k) => { m[k] = fromV(f[k]); return m; }, {});
const aget = async (p) => { const r = await fetch(BASE + p, { headers: H }); return r.status === 404 ? null : fromF((await r.json()).fields || {}); };
const aset = (p, o) => fetch(BASE + p, { method: "PATCH", headers: H, body: JSON.stringify({ fields: toF(o) }) });
const adel = (p) => fetch(BASE + p, { method: "DELETE", headers: H });
const has = (a, x) => (a || []).indexOf(x) >= 0;
const TIME = "\\d{1,2}:\\d{2}\\s?[AP]M";

function freshSave(dev) {
  return {
    v: 2, levels: {}, ach: {}, flora: {}, seen: {}, fails: {}, coach: {}, announced: {}, skins: { nocturne: 1 },
    stats: { sown: 5, plants: 2, pollen: 0, playMs: 60000, wins: 1 }, settings: { skin: "nocturne", grid: true },
    daily: { last: null, streak: 0, best: 0, days: {} }, wallet: { earn: {}, spend: {}, frost: {} },
    sync: { dev, gen: 0, others: {}, settingsAt: 0, st: null }
  };
}

(async () => {
  const [A, au] = await Promise.all(["app", "auth"].map((m) => import(SDK + "firebase-" + m + ".js")));
  const app = A.initializeApp({ apiKey: "demo-api-key", authDomain: "127.0.0.1", projectId: PROJECT }, "harness");
  const auth = au.initializeAuth(app, { persistence: au.inMemoryPersistence });
  au.connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: "DELETE" });
  await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${PROJECT}/accounts`, { method: "DELETE" });
  const uidOf = async (who) => { await au.signInWithCredential(auth, au.GoogleAuthProvider.credential(JSON.stringify(who))); const u = auth.currentUser.uid; await au.signOut(auth); return u; };
  const uA = await uidOf(ALICE), uB = await uidOf(BOB);
  const PA = "http://127.0.0.1:" + location.port, PB = "http://localhost:" + location.port, QS = "allow=4,400&rest=" + REST;
  await load(PA, QS);
  const day = (await call(PA, "meter")).day;
  await aset("days/" + day, { n: 3 });
  await aset("days/" + day + "/u/" + uA, { k: SEED ? 4 : 3 });
  if (SEED) { out("seeded day " + day); out(`PASS ${pass} checks`); fetch("/__release?k=" + HOLD); return; }
  const seed = freshSave("devcloud");
  seed.levels["w1-02"] = { stars: 3, golden: false, best: 1, time: 12, clears: 1 };
  await aset("users/" + uA + "/data/save", Object.assign(OrchardCloud.toWire(seed), { at: Date.now() }));

  await until(PA, "state", (x) => x.titleSign, 15000);
  ok(await call(PA, "signIn", ALICE) === uA, "alice signs in with 3 of her 4 blocks already used today");
  const m = await until(PA, "meter", (x) => x.state && x.state.asleep, 20000);
  ok(m.state.asleep && (await call(PA, "cloudLog")).some((x) => / resting/.test(x)), "the device claims her 4th block, spends it and rests", [m, await call(PA, "cloudLog")]);
  let s = await call(PA, "state");
  ok(m.state.b === 1 && m.state.info.rest === "self" && (await aget("days/" + day + "/u/" + uA)).k === 4, "one block claimed here, seat k 4, rest stored as self", m);
  ok(m.state.w <= 4, "this device stayed within its block's 4 writes", m.state);
  ok(has(s.levels, "w1-02"), "the cloud save still came down before resting", s.levels);
  const card = await call(PA, "settings");
  ok(new RegExp("Today's cloud sync allowance is used up\\. Progress is saved on this device and syncs again after " + TIME + "\\.").test(card.text), "Settings: allowance used up, saved on this device, syncs again after the local reset time", card.text);
  ok(card.buttons.indexOf("Sync now (disabled)") >= 0, "Settings: Sync now is disabled while resting", card.buttons);
  s = await call(PA, "toTitle");
  ok(/Today's cloud sync allowance is used up/.test(s.titleRest) && !s.titleSign, "title: the same line under the start prompt", s.titleRest);
  const fr = await until(PA, "frTab", (x) => x.mode === "resting", 10000);
  ok(fr.mode === "resting" && new RegExp("Friends are resting until " + TIME).test(fr.body) && /Today's cloud allowance is used up\. Your garden keeps saving on this device\./.test(fr.body), "Friends: resting until the reset time", fr.body);
  ok(!/Try again/.test(fr.body), "Friends: no Try again while resting");

  const p1 = await call(PA, "play", 1, 1);
  ok(has(p1.levels, "w1-01"), "playing while resting saves w1-01 on the device", p1);
  await call(PA, "pagehide");
  await sleep(1500);
  ok(!(((await aget("users/" + uA + "/data/save")) || {}).levels || {})["w1-01"], "nothing reaches the cloud while resting");

  await adel("days/" + day + "/u/" + uA);
  await aset("days/" + day, { n: 0 });
  out("new day simulated: seat cleared, counter 0; waiting for the automatic resume");
  const t0 = Date.now();
  const back = await waitAdmin(async () => (((await aget("users/" + uA + "/data/save")) || {}).levels || {})["w1-01"], 200000);
  ok(!!back, "after the rest the save reconnects on its own and uploads w1-01", { ms: Date.now() - t0, log: await call(PA, "cloudLog"), m: await call(PA, "meter") });
  out("w1-01 reached the cloud " + (Date.now() - t0) + " ms after the simulated reset (rest " + REST + " s, then the 120 s write gap)");
  const m2 = await call(PA, "meter");
  ok(!m2.state.asleep && m2.state.b >= 2 && (await aget("days/" + day + "/u/" + uA)).k >= 1, "the meter woke and claimed a fresh block", m2.state);
  const fr2 = await until(PA, "fr", (x) => x.mode === "ready", 20000);
  ok(fr2.mode === "ready", "Friends reconnect on their own after the rest", fr2.mode);
  s = await until(PA, "state", (x) => /Synced/.test(x.chip), 20000);
  ok(/Synced/.test(s.chip) && !s.titleRest, "cloud chip back to Synced and the title line is gone", [s.chip, s.titleRest]);

  await aset("days/" + day, { n: 400 });
  await load(PB, QS);
  await until(PB, "state", (x) => x.titleSign, 15000);
  await call(PB, "signIn", BOB);
  s = await until(PB, "state", (x) => /Resting/.test(x.chip), 20000);
  const cardB = await call(PB, "settings");
  ok(new RegExp("Cloud sync is full for today\\. Progress is saved on this device and syncs again after " + TIME + "\\.").test(cardB.text), "full day: Settings says cloud sync is full for today", cardB.text);
  const mB = await call(PB, "meter");
  ok(mB.state.b === 0 && mB.why === "full" && !(await aget("days/" + day + "/u/" + uB)) && (await aget("days/" + day)).n === 400, "full day: no block, no seat, counter untouched", mB);
  const frB = await until(PB, "frTab", (x) => x.mode === "resting", 10000);
  ok(/Friends are resting until/.test(frB.body) && /Cloud sync is full for today\. Your garden keeps saving on this device\./.test(frB.body), "full day: Friends rest with the full-day line", frB.body);
  ok(!(await aget("users/" + uB + "/data/save")) && !(await aget("pub/" + uB)), "full day: bob wrote nothing");

  const eA = (await call(PA, "state")).errs, eB = (await call(PB, "state")).errs;
  ok(!eA.length && !eB.length, "no console errors or warnings on either device", { A: eA, B: eB });
  out(fails ? `FAIL ${fails} of ${pass + fails}` : `PASS ${pass} checks`);
  fetch("/__release?k=" + HOLD);
})().catch((e) => { out("FAIL harness " + String(e) + " " + ((e && (e.code || e.stack)) || "")); out(`FAIL ${fails + 1} of ${pass + fails + 1}`); fetch("/__release?k=" + HOLD); });
