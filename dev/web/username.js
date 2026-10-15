const PROJECT = "demo-orbit-orchard";
const Q = new URLSearchParams(location.search);
const HOLD = encodeURIComponent(Q.get("k") || "webusername");
const SEED = Q.get("seed") === "1";
const ALICE = { sub: "alice-google-1", email: "alice@example.com", name: "Alice Example", email_verified: true };
const BOB = { sub: "bob-google-2", email: "bob@example.com", name: "Bob Builder", email_verified: true };
const CARA = { sub: "cara-google-3", email: "cara@example.com", name: "Cara Outsider", email_verified: true };
const DAY = 864e5, WEEK = 7 * DAY;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fails = 0;
const out = (s) => { document.getElementById("log").textContent += s + "\n"; console.log("[t] WEBUN " + s); };
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
async function until(origin, fn, f, ms) {
  const t = Date.now();
  let s = await call(origin, fn);
  while (!f(s) && Date.now() - t < (ms || 15000)) { await sleep(250); s = await call(origin, fn); }
  return s;
}
async function waitAdmin(f, ms) {
  const t = Date.now();
  let v = await f();
  while (!v && Date.now() - t < (ms || 15000)) { await sleep(300); v = await f(); }
  return v;
}

const BASE = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents/`;
const H = { Authorization: "Bearer owner", "Content-Type": "application/json" };
const fromV = (v) => "nullValue" in v ? null : "booleanValue" in v ? v.booleanValue : "integerValue" in v ? +v.integerValue : "doubleValue" in v ? v.doubleValue : "stringValue" in v ? v.stringValue
  : "timestampValue" in v ? { ts: v.timestampValue } : "arrayValue" in v ? (v.arrayValue.values || []).map(fromV) : "mapValue" in v ? fromF(v.mapValue.fields || {}) : null;
const fromF = (f) => Object.keys(f).reduce((m, k) => { m[k] = fromV(f[k]); return m; }, {});
const aget = async (p) => { const r = await fetch(BASE + p, { headers: H }); return r.status === 404 ? null : fromF((await r.json()).fields || {}); };
const alist = async (p) => { const j = await (await fetch(BASE + p + "?pageSize=300", { headers: H })).json(); return (j.documents || []).map((d) => ({ id: d.name.split("/").pop(), data: fromF(d.fields || {}) })); };
/** Moves the last-change time of a player's username back by `ms`, as the project owner. */
const backdate = (uid, ms) => fetch(BASE + "pub/" + uid + "?updateMask.fieldPaths=ut", { method: "PATCH", headers: H, body: JSON.stringify({ fields: { ut: { timestampValue: new Date(Date.now() - ms).toISOString() } } }) });
const row = (s, id) => (s.rows.find((r) => r.id === id) || { text: "" }).text;
const LOCK = /^You can change your username again on \w{3}, \w{3} \d{1,2},? (at )?\d{1,2}:\d{2}\s?[AP]M$/;

(async () => {
  await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: "DELETE" });
  await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${PROJECT}/accounts`, { method: "DELETE" });
  const port2 = Q.get("p2") || "8773";
  const PA = "http://127.0.0.1:" + location.port, PB = "http://localhost:" + location.port, PC = "http://127.0.0.1:" + port2;
  await load(PA); await load(PB); await load(PC);

  let a = await call(PA, "unOpen");
  ok(!a.box && !a.nudgeText, "signed out: no Username row and no nudge", a);
  const uA = await call(PA, "signIn", ALICE);
  a = await call(PA, "unWaitNudge");
  const uB = await call(PB, "signIn", BOB);
  await call(PB, "unWaitNudge");
  const uC = await call(PC, "signIn", CARA);
  await call(PC, "unWaitNudge");
  ok(a.nudgeText === "Pick a username so friends can recognise you" && a.known && a.un === "", "after sign-in without a username the nudge appears: " + a.nudgeText, a);
  a = await call(PA, "unNudge", "no");
  ok(!a.nudgeText && a.nudged && a.nudged[uA] === 1, "dismissing hides it and remembers it for this account", a);
  await load(PA);
  a = await call(PA, "unOpen");
  await sleep(1500);
  a = await call(PA, "un");
  ok(a.known && !a.nudgeText, "after a reload the dismissed nudge stays hidden", a);

  let b = await call(PB, "unWaitNudge");
  ok(!!b.nudgeText, "Bob gets his own nudge", b);
  b = await call(PB, "unNudge", "go");
  ok(b.tab === "settings" && b.editing && b.focus === "unIn" && !b.nudgeText && b.nudged && b.nudged[uB] === 1, "the nudge's Choose opens Settings with the editor focused", b);
  b = await call(PB, "unCancel");
  ok(!b.editing && b.edit.text === "Choose" && b.edit.on, "Cancel closes the editor", b);

  a = await call(PA, "unOpen");
  ok(a.box && a.cur === "No username yet" && a.edit.text === "Choose" && a.edit.on && a.nm === "Alice Example", "Settings: the account card shows \"No username yet\" with Choose", a);
  a = await call(PA, "unType", "");
  ok(a.editing && a.st === "3–20 characters: letters, numbers and underscores" && !a.save.on && /won't be able to change it again for 7 days/.test(a.warn) && !a.remove.shown, "the editor shows the rule, the 7-day warning and no Remove yet", a);
  const BAD = [
    ["<img src=x onerror=alert(1)>", "Use only plain letters A–Z, numbers and underscores"], ["\"><script>alert(1)</script>", "Use only plain letters A–Z, numbers and underscores"],
    ["аlice", "Use only plain letters A–Z, numbers and underscores"], ["ali​ce", "Use only plain letters A–Z, numbers and underscores"], ["‮ecila", "Use only plain letters A–Z, numbers and underscores"],
    ["al", "At least 3 characters"], ["a".repeat(21), "At most 20 characters"], ["9lives", "Start with a letter"], ["ali__ce", "No double underscores"], ["alice_", "Don't end with an underscore"],
    ["Admin", "That name is reserved"], ["Gardener", "That name is reserved"]
  ];
  for (const [v, why] of BAD) {
    a = await call(PA, "unType", v);
    ok(a.st === why && a.tone === "bad" && !a.save.on, "refused at the field: " + JSON.stringify(v) + " → " + a.st, a);
  }
  a = await call(PA, "unSave", "<img src=x onerror=alert(1)>", true);
  ok(a.clicked && a.injected === 0 && a.alerts === 0 && a.un === "" && (await alist("names")).length === 0, "a forced Save of markup writes nothing and injects nothing", a);

  await until(PA, "frTab", (x) => x.mode === "ready"); await until(PB, "frTab", (x) => x.mode === "ready");
  const codeA = await call(PA, "frMakeCode"), codeB = await call(PB, "frMakeCode");
  await call(PA, "frAdd", codeB); await call(PB, "frAdd", codeA);
  await call(PA, "frShare", true);
  b = await until(PB, "fr", (x) => x.cards[uA] === "ok" && /Alice Example/.test(row(x, uA)), 25000);
  ok(/Alice Example/.test(row(b, uA)), "before a username, Bob sees Alice's Google name on her card", row(b, uA));

  a = await call(PA, "unType", "Alice_Orchard");
  ok(a.st === "Available" && a.tone === "good" && a.save.on, "a free name shows Available", a);
  a = await call(PA, "unSave");
  ok(a.un === "Alice_Orchard" && a.cur === "Alice_Orchard" && !a.editing && a.flashLine === "Friends now see you as Alice_Orchard.", "Save claims it: " + a.flashLine, a);
  ok(a.nm === "Alice_Orchard" && a.em === "Alice Example · alice@example.com", "the account card shows the username, then the Google name and email", [a.nm, a.em]);
  ok(LOCK.test(a.lock) && !a.edit.on, "Change is disabled with the date it opens again: " + a.lock, a);
  const nm1 = await aget("names/alice_orchard"), pub1 = await aget("pub/" + uA);
  ok(nm1 && nm1.u === uA && nm1.n === "Alice_Orchard" && Object.keys(nm1).sort().join() === "n,u", "names/alice_orchard is { u, n } with the case kept", nm1);
  ok(pub1.un === "Alice_Orchard" && pub1.ut && /^\d{4}-/.test(pub1.ut.ts) && !("n" in pub1), "pub carries un and a server ut, and drops the Google name", pub1);

  b = await until(PB, "fr", (x) => /Alice_Orchard/.test(row(x, uA)));
  ok(/Alice_Orchard/.test(row(b, uA)) && !/Alice Example/.test(row(b, uA)) && b.cards[uA] === "ok", "Bob's friend list and Alice's progress card show her username", row(b, uA));

  a = await call(PA, "frTab");
  a = await until(PA, "fr", (x) => /Alice_Orchard/.test(x.card));
  ok(/Alice_Orchard/.test(a.card), "Alice's own card preview shows her username", a.card);
  ok(/You have a username, so friends see that instead/.test(a.body), "the Google-name switch says it doesn't apply while a username is set");

  const r1 = await call(PA, "frChallenge", uB, true, 1);
  ok(r1.title === "Challenge sent", "Alice sends Bob a challenge", r1);
  b = await until(PB, "fr", (x) => /Alice_Orchard challenges you/.test(x.chal), 25000);
  ok(/Alice_Orchard challenges you/.test(b.chal), "Bob's challenge list names her by username", b.chal);
  if (SEED) { out("seeded"); out(`PASS ${pass} checks`); fetch("/__release?k=" + HOLD); return; }
  const r2 = await call(PB, "frPlay", 0);
  ok(/Alice_Orchard/.test(r2.text), "the challenge result shows her username: " + r2.title, r2);
  b = await until(PB, "fr", (x) => x.hist.some((h) => /Alice_Orchard vs you/.test(h)));
  ok(b.hist.some((h) => /Alice_Orchard vs you/.test(h)), "Bob's challenge history shows her username", b.hist);

  let c = await call(PC, "unType", "ALICE_orchard");
  ok(c.st === "That name is taken" && c.tone === "bad" && !c.save.on, "another player gets \"taken\" for the same name in other capitals", c);
  c = await call(PC, "unSave", "ALICE_orchard", true);
  ok(c.un === "" && c.flashLine === "That name was just taken. Try another." && (await aget("names/alice_orchard")).u === uA, "forcing Save is refused by the rules: " + c.flashLine, c);
  ok((await call(PC, "fs", "set", "names/alice_orchard", { u: uC, n: "alice_orchard" })).err === "permission-denied", "a direct overwrite of Alice's names doc is denied");
  ok((await call(PC, "fs", "del", "names/alice_orchard")).err === "permission-denied", "a direct delete of Alice's names doc is denied");
  ok((await call(PC, "fs", "list", "names")).err === "permission-denied", "names can't be listed");

  await backdate(uA, WEEK + 60000);
  a = await until(PA, "unOpen", (x) => x.edit.on && !x.lock);
  ok(a.edit.on && a.edit.text === "Change" && !a.lock, "a week later Change is enabled again", a);
  a = await call(PA, "unType", "Alice_Orchard");
  ok(a.st === "That's your username now" && !a.save.on && a.remove.on, "the current name can't be saved again; Remove is offered", a);
  a = await call(PA, "unType", "alice_orchard");
  ok(a.st === "Only the capitals change" && a.save.on, "a capitals-only change is allowed", a);
  a = await call(PA, "unSave", "Alice_Two");
  ok(a.un === "Alice_Two" && a.flashLine === "Friends now see you as Alice_Two.", "Alice changes to Alice_Two", a);
  ok(!(await aget("names/alice_orchard")) && (await aget("names/alice_two")).u === uA, "the old name is released in the same write");
  b = await until(PB, "fr", (x) => /Alice_Two/.test(row(x, uA)) && /Alice_Two/.test(x.hist.join(" ")));
  ok(/Alice_Two/.test(row(b, uA)) && b.hist.some((h) => /Alice_Two vs you/.test(h)), "Bob sees the new name on the card and in the history", [row(b, uA), b.hist]);
  a = await call(PA, "un");
  ok(LOCK.test(a.lock) && !a.edit.on, "the lock starts again after the change", a.lock);

  await load(PC);
  c = await call(PC, "unType", "Alice_Orchard");
  ok(c.st === "Available" && c.save.on, "the released name shows Available to Cara", c);
  c = await call(PC, "unSave");
  ok(c.un === "Alice_Orchard" && (await aget("names/alice_orchard")).u === uC, "Cara takes the released name", c);

  await backdate(uA, WEEK + 60000);
  a = await until(PA, "unOpen", (x) => x.edit.on);
  a = await call(PA, "unRemove");
  ok(a.un === "" && a.cur === "No username yet" && /^Username removed/.test(a.flashLine), "Remove clears the username: " + a.flashLine, a);
  ok(!(await aget("names/alice_two")) && !("un" in (await aget("pub/" + uA))), "removal deletes the names doc and un in one write");
  ok(/^You can choose a username again on /.test(a.lock) && !a.edit.on && a.nm === "Alice Example", "after removal Choose waits a week and the card shows the Google name", a);
  ok(await waitAdmin(async () => (await aget("pub/" + uA)).n === "Alice Example"), "Friends republishes the Google name");
  b = await until(PB, "fr", (x) => /Alice Example/.test(row(x, uA)));
  ok(/Alice Example/.test(row(b, uA)) && !/Alice_Two/.test(row(b, uA)), "Bob sees the Google name again", row(b, uA));
  ok(!a.nudgeText, "no nudge while the choice is locked");

  const eA = (await call(PA, "un")).errs, eB = (await call(PB, "un")).errs, eC = (await call(PC, "un")).errs;
  ok(!eA.length && !eB.length && !eC.length, "no console errors or warnings in any frame", { A: eA, B: eB, C: eC });
  out(fails ? `FAIL ${fails} of ${pass + fails}` : `PASS ${pass} checks`);
  fetch("/__release?k=" + HOLD);
})().catch((e) => { out("FAIL harness " + String(e) + " " + ((e && (e.code || e.stack)) || "")); out(`FAIL ${fails + 1} of ${pass + fails + 1}`); fetch("/__release?k=" + HOLD); });
