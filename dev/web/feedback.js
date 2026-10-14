const PROJECT = "demo-orbit-orchard";
const Q = new URLSearchParams(location.search);
const HOLD = encodeURIComponent(Q.get("k") || "webfeedback");
const ALICE = { sub: "alice-google-1", email: "alice@example.com", name: "Alice Example", email_verified: true };
const BOB = { sub: "bob-google-2", email: "bob@example.com", name: "Bob Builder", email_verified: true };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fails = 0;
const out = (s) => { document.getElementById("log").textContent += s + "\n"; console.log("[t] WEBFB " + s); };
function ok(c, name, extra) { if (c) pass++; else fails++; out((c ? "ok   " : "FAIL ") + name + (extra !== undefined && !c ? " :: " + JSON.stringify(extra).slice(0, 1500) : "")); return c; }

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
    calls[id] = (d) => (d.err ? rej(new Error(fn + ": " + d.err)) : res(d.r));
    frames[origin].contentWindow.postMessage({ __t: id, fn, args }, "*");
  });
}
async function until(origin, f, ms) {
  const t = Date.now();
  let s = await call(origin, "fb");
  while (!f(s) && Date.now() - t < (ms || 15000)) { await sleep(200); s = await call(origin, "fb"); }
  return s;
}

const BASE = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents/`;
const H = { Authorization: "Bearer owner", "Content-Type": "application/json" };
const fromV = (v) => "nullValue" in v ? null : "booleanValue" in v ? v.booleanValue : "integerValue" in v ? +v.integerValue : "doubleValue" in v ? v.doubleValue : "stringValue" in v ? v.stringValue
  : "timestampValue" in v ? { ts: v.timestampValue } : "arrayValue" in v ? (v.arrayValue.values || []).map(fromV) : "mapValue" in v ? fromF(v.mapValue.fields || {}) : null;
const fromF = (f) => Object.keys(f).reduce((m, k) => { m[k] = fromV(f[k]); return m; }, {});
const alist = async (p) => { const j = await (await fetch(BASE + p + "?pageSize=300", { headers: H })).json(); return (j.documents || []).map((d) => ({ id: d.name.split("/").pop(), data: fromF(d.fields || {}) })); };
const keys = (o) => Object.keys(o || {}).sort().join(",");
const LIMIT = /^You've sent 3 notes today; try again after \d{1,2}:\d{2}\s?[AP]M\.$/;

(async () => {
  await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: "DELETE" });
  await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${PROJECT}/accounts`, { method: "DELETE" });
  const PA = "http://127.0.0.1:" + location.port, PB = "http://localhost:" + location.port;
  await load(PA);

  let s = await call(PA, "fbOpen");
  s = await until(PA, (x) => x.mode === "signedout");
  ok(s.mode === "signedout" && /^Sign in to send feedback/.test(s.st) && s.sign && !s.send, "signed out: the card asks to sign in and shows the Google button", s);
  s = await call(PA, "fbType", "Typed before signing in, kept as a draft.", "idea");
  ok(!s.send && s.draft && s.draft.msg === "Typed before signing in, kept as a draft." && s.draft.cat === "idea", "signed out: Send stays off and the draft is stored", s);

  const uid = await call(PA, "signIn", ALICE);
  s = await until(PA, (x) => x.mode === "ready");
  ok(s.mode === "ready" && !s.sign && s.send && s.msg === "Typed before signing in, kept as a draft.", "after sign-in the card is ready with the draft", s);
  await call(PA, "waitCloud", "synced");
  const day = (await call(PA, "meter")).day;
  const X1 = "<img src=x onerror=alert(1)>", X2 = "\"><script>alert(1)</script> and ${alert(1)}", X3 = "{{7*7}} __proto__ javascript:alert(1)";
  s = await call(PA, "fbSend", X1, "bug");
  ok(s.flash === "sent" && s.st === "Thanks — your feedback was sent" && s.msg === "" && s.draft === null, "first note sent, box and draft cleared: " + s.st, s);
  s = await call(PA, "fbSend", X2 + "\u202E\u200B", "idea", true);
  ok(s.flash === "sent", "second note with game info sent", s);
  const m0 = await call(PA, "meter");
  s = await call(PA, "fbSend", X3, "praise");
  ok(s.flash === "sent" && LIMIT.test(s.st.replace(/^Thanks — your feedback was sent\. /, "")) && !s.send, "third note sent and the limit is shown at once: " + s.st, s);
  const m1 = await call(PA, "meter");
  ok(m1.state.w - m0.state.w === 1 && m1.state.r - m0.state.r === 1, "a create counts 1 write and 1 rule read (the seat) against the allowance", [m0.state, m1.state]);

  let docs = await alist("feedback/" + uid + "/m");
  ok(docs.map((d) => d.id).join(",") === [0, 1, 2].map((n) => day + "-" + n).join(","), "three docs at feedback/<uid>/m/<day>-0..2", docs.map((d) => d.id));
  ok(docs.every((d) => d.data.u === uid && d.data.v === 1 && /^\d{4}-\d\d-\d\dT/.test(d.data.at && d.data.at.ts) && Math.abs(Date.parse(d.data.at.ts) - Date.now()) < 120000), "each has u = uid, v 1 and a server timestamp", docs.map((d) => d.data));
  ok(keys(docs[0].data) === "at,cat,msg,u,v" && keys(docs[1].data) === "at,cat,info,msg,u,v" && docs.map((d) => d.data.cat).join(",") === "bug,idea,praise", "only the allowed keys, with the picked categories", docs.map((d) => keys(d.data)));
  ok(docs[0].data.msg === X1 && docs[1].data.msg === X2 && docs[2].data.msg === X3, "messages stored sanitized (bidi and zero-width gone), markup as text", docs.map((d) => d.data.msg));
  const inf = docs[1].data.info, ij = JSON.stringify(inf);
  ok(inf.ver === "2" && inf.build === "web" && inf.ua === "Firefox" && inf.view === "tablet" && inf.skin === "nocturne" && !/alice|Alice|@|Mozilla|google/.test(ij), "game info has no name, email, uid or full user agent: " + ij);
  s = await call(PA, "fb");
  ok(s.list.join("|") === [X3, X2, X1].join("|") && s.injected === 0 && s.alerts === 0 && s.polluted === undefined, "the recent list shows all three as literal text: no element, no handler, no pollution", s);

  s = await call(PA, "fbSend", "A fourth note, forced through the button.", "other", false, true);
  ok(s.clicked && LIMIT.test(s.st) && s.msg === "A fourth note, forced through the button." && (await alist("feedback/" + uid + "/m")).length === 3, "a forced 4th send writes nothing and keeps the draft: " + s.st, s);

  const own = "feedback/" + uid + "/m/" + day + "-0", note = { v: 1, u: uid, cat: "bug", msg: "Sent straight to Firestore." };
  const denied = async (op, p, d) => { const r = await call(PA, "fs", op, p, d); return r.err === "permission-denied"; };
  ok(await denied("get", own), "the page can't read its own note");
  ok(await denied("list", "feedback/" + uid + "/m"), "the page can't list its notes");
  ok(await denied("note", own, note), "overwriting today's first note is denied");
  ok(await denied("update", own, { cat: "other" }), "updating a note is denied");
  ok(await denied("del", own), "deleting a note is denied");
  ok(await denied("note", "feedback/" + uid + "/m/" + day + "-3", note), "a 4th slot is denied");
  ok(await denied("note", "feedback/" + uid + "/m/" + (day + 1) + "-0", note), "tomorrow's slot is denied");
  ok(await denied("note", "feedback/someone-else/m/" + day + "-0", Object.assign({}, note, { u: "someone-else" })), "another user's path is denied");
  ok(await denied("note", "feedback/" + uid + "/m/" + day + "-0", Object.assign({}, note, { msg: "x".repeat(1001) })), "an oversize note is denied");
  ok(await denied("set", "feedback/" + uid + "/m/" + day + "-2", Object.assign({}, note, { at: Date.now() })), "a client clock instead of the server time is denied");
  ok((await alist("feedback/" + uid + "/m")).length === 3, "still exactly three notes");

  await load(PB);
  await call(PB, "signIn", ALICE);
  s = await call(PB, "fbOpen");
  s = await until(PB, (x) => x.mode === "ready");
  ok(s.mode === "ready" && s.send === false && s.list.length === 0, "a second device starts with no local sends", s);
  s = await call(PB, "fbSend", "Second device, same account, same day.", "idea");
  ok(LIMIT.test(s.st) && s.msg === "Second device, same account, same day." && (await alist("feedback/" + uid + "/m")).length === 3, "the rules refuse all three slots there, so it shows the limit and keeps the draft: " + s.st, s);
  s = await call(PB, "fbOpen");
  ok(LIMIT.test(s.st) && !s.send, "the limit is remembered on that device", s);

  await call(PB, "signOut");
  s = await until(PB, (x) => x.mode === "signedout");
  ok(s.mode === "signedout" && s.sign && s.list.length === 0, "signing out hides Alice's list and offers sign-in again", s);
  const uB = await call(PB, "signIn", BOB);
  s = await until(PB, (x) => x.mode === "ready");
  ok(s.mode === "ready" && s.send && s.msg === "Second device, same account, same day.", "Bob signs in on that device; the draft is still there", s);
  s = await call(PB, "fbNet", false);
  s = await until(PB, (x) => x.mode === "offline");
  ok(s.mode === "offline" && /^Can't reach the cloud/.test(s.st) && s.send, "offline: the card says so and Send stays on for a retry", s);
  s = await call(PB, "fbSend", "Second device, same account, same day.", "idea");
  ok(s.mode === "offline" && s.msg === "Second device, same account, same day." && (await alist("feedback/" + uB + "/m")).length === 0, "a retry while offline writes nothing and keeps the draft", s);
  await call(PB, "fbNet", true);
  s = await until(PB, (x) => x.mode === "ready");
  s = await call(PB, "fbSend", "Back online, this one goes through.", "bug");
  docs = await alist("feedback/" + uB + "/m");
  ok(s.flash === "sent" && docs.length === 1 && docs[0].id === day + "-0" && docs[0].data.u === uB, "back online the note is sent to Bob's own slot 0", [s, docs]);

  s = await call(PB, "fbRest", true);
  s = await until(PB, (x) => x.mode === "resting");
  ok(s.mode === "resting" && /^Feedback is resting until \d{1,2}:\d{2}\s?[AP]M\. Today's cloud allowance is used up\. Your note stays here as a draft\.$/.test(s.st) && !s.send, "resting: \"" + s.st + "\"", s);
  s = await call(PB, "fbType", "Written while resting.", "other");
  ok(!s.send && s.draft && s.draft.msg === "Written while resting.", "resting keeps the draft and Send off", s);
  s = await call(PB, "fbRest", false);
  s = await until(PB, (x) => x.mode === "ready");
  ok(s.mode === "ready" && s.send && s.msg === "Written while resting.", "after the rest ends the draft can be sent", s);

  const eA = (await call(PA, "fb")).errs, eB = (await call(PB, "fb")).errs;
  ok(!eA.length && !eB.length, "no console errors or warnings in either frame", { A: eA, B: eB });
  out(fails ? `FAIL ${fails} of ${pass + fails}` : `PASS ${pass} checks`);
  fetch("/__release?k=" + HOLD);
})().catch((e) => { out("FAIL harness " + String(e) + " " + ((e && (e.code || e.stack)) || "")); out(`FAIL ${fails + 1} of ${pass + fails + 1}`); fetch("/__release?k=" + HOLD); });
