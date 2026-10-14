const PROJECT = "demo-orbit-orchard";
const Q = new URLSearchParams(location.search);
const HOLD = encodeURIComponent(Q.get("k") || "webfriends");
const SEED = Q.get("seed") === "1";
const ALICE = { sub: "alice-google-1", email: "alice@example.com", name: "Alice Example", email_verified: true };
const BOB = { sub: "bob-google-2", email: "bob@example.com", name: "Bob Builder", email_verified: true };
const CARA = { sub: "cara-google-3", email: "cara@example.com", name: "Cara Outsider", email_verified: true };
const DAY = 864e5;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fails = 0;
const out = (s) => { document.getElementById("log").textContent += s + "\n"; console.log("[t] WEBFR " + s); };
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
  let s = await call(origin, "fr");
  while (!f(s) && Date.now() - t < (ms || 15000)) { await sleep(250); s = await call(origin, "fr"); }
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
const toV = (v) => v === null || v === undefined ? { nullValue: null } : typeof v === "boolean" ? { booleanValue: v } : typeof v === "number" ? (Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v })
  : typeof v === "string" ? { stringValue: v } : Array.isArray(v) ? { arrayValue: { values: v.map(toV) } } : { mapValue: { fields: toF(v) } };
const toF = (o) => Object.keys(o).reduce((m, k) => { m[k] = toV(o[k]); return m; }, {});
const fromV = (v) => "nullValue" in v ? null : "booleanValue" in v ? v.booleanValue : "integerValue" in v ? +v.integerValue : "doubleValue" in v ? v.doubleValue : "stringValue" in v ? v.stringValue
  : "arrayValue" in v ? (v.arrayValue.values || []).map(fromV) : "mapValue" in v ? fromF(v.mapValue.fields || {}) : null;
const fromF = (f) => Object.keys(f).reduce((m, k) => { m[k] = fromV(f[k]); return m; }, {});
const aget = async (p) => { const r = await fetch(BASE + p, { headers: H }); return r.status === 404 ? null : fromF((await r.json()).fields || {}); };
const alist = async (p) => { const j = await (await fetch(BASE + p + "?pageSize=300", { headers: H })).json(); return (j.documents || []).map((d) => ({ id: d.name.split("/").pop(), data: fromF(d.fields || {}) })); };
const aset = (p, o) => fetch(BASE + p, { method: "PATCH", headers: H, body: JSON.stringify({ fields: toF(o) }) });
const adel = (p) => fetch(BASE + p, { method: "DELETE", headers: H });
const row = (s, id) => (s.rows.find((r) => r.id === id) || { text: "" }).text;
const has = (a, x) => a.indexOf(x) >= 0;

(async () => {
  await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: "DELETE" });
  await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${PROJECT}/accounts`, { method: "DELETE" });
  const port2 = Q.get("p2") || "8773";
  const PA = "http://127.0.0.1:" + location.port, PB = "http://localhost:" + location.port, PC = "http://127.0.0.1:" + port2;
  await load(PA); await load(PB); await load(PC);

  let a = await call(PA, "frTab");
  a = await until(PA, (x) => x.mode === "signedout");
  ok(a.tabs.length === 9 && a.tabs.indexOf("friends") === 8, "web hub has 9 tabs with Friends last", a.tabs);
  ok(a.mode === "signedout" && /Sign in with Google to add friends and trade challenges/.test(a.body) && a.signBtn, "signed out: Friends shows the sign-in card with the Google button", a.body);
  ok(!(await call(PA, "fr")).errs.length, "signed out: no errors");
  const p1 = await call(PA, "play", 1, 1);
  ok(has(p1.levels, "w1-01"), "A clears w1-01 before sharing", p1);
  await call(PA, "frTab");
  ok((await call(PA, "key", "9")) === "friends", "key 9 opens Friends");

  const uA = await call(PA, "signIn", ALICE), uB = await call(PB, "signIn", BOB), uC = await call(PC, "signIn", CARA);
  ok(uA && uB && uC && uA !== uB, "three Google accounts signed in on three origins");
  await call(PB, "frTab"); await call(PC, "frTab");
  a = await until(PA, (x) => x.mode === "ready");
  let b = await until(PB, (x) => x.mode === "ready"), c = await until(PC, (x) => x.mode === "ready");
  ok(a.mode === "ready" && b.mode === "ready" && c.mode === "ready", "Friends connects for A, B and C", [a.mode, b.mode, c.mode, a.errs]);
  ok(!a.search && a.codeIn && /Trade friend codes/.test(a.body) && !/Search|organization/.test(a.body), "add-by-code only: no search field, helper text mentions codes", a.body);
  ok(await waitAdmin(async () => (await aget("pub/" + uA)) && (await aget("pub/" + uB)) && (await aget("pub/" + uC))), "each player publishes pub/<uid>");
  const pubA0 = await aget("pub/" + uA);
  ok(pubA0.n === "Alice Example" && !pubA0.u && Object.keys(pubA0).every((k) => has(["x", "y", "at", "n", "s", "q"], k)) && pubA0.q && Object.keys(pubA0.q).sort().join() === "d,n", "pub doc is { x, y, at, n, q } with the Google name and today's counter", pubA0);

  const codeA = await call(PA, "frMakeCode"), codeB = await call(PB, "frMakeCode");
  ok(/^[2-9A-HJKMNP-Z]{6}$/.test(codeA || "") && /^[2-9A-HJKMNP-Z]{6}$/.test(codeB || ""), "A and B make friend codes", [codeA, codeB]);
  const cdoc = await aget("codes/" + codeA);
  ok(cdoc && cdoc.u === uA && Object.keys(cdoc).length === 1, "codes/<CODE> holds only { u }", cdoc);
  a = await call(PA, "frAdd", "zzz-zzz");
  ok(a.notes.some((n) => /No gardener has that code/.test(n)), "unknown code is reported");
  a = await call(PA, "frAdd", codeB.slice(0, 3).toLowerCase() + "-" + codeB.slice(3));
  b = await call(PB, "frAdd", codeA);
  ok(has(a.friends, uB) && has(b.friends, uA), "A and B follow each other by code", [a.friends, b.friends]);
  await call(PA, "frShare", true); await call(PB, "frShare", true);
  a = await until(PA, (x) => x.cards[uB] === "ok" && /Bob Builder/.test(row(x, uB)));
  b = await until(PB, (x) => x.cards[uA] === "ok" && /Alice Example/.test(row(x, uA)));
  ok(a.cards[uB] === "ok" && /Shares with you/.test(row(a, uB)) && /Bob Builder/.test(row(a, uB)), "A sees Bob's card and name", row(a, uB));
  ok(b.cards[uA] === "ok" && /Shares with you/.test(row(b, uA)) && /Stars\s*[1-9]/.test(row(b, uA)) && /Plots\s*1/.test(row(b, uA)), "B sees Alice's card with her stars and plots", row(b, uB) + " | " + row(b, uA));
  a = await until(PA, (x) => x.tro.indexOf("fr-card") >= 0);
  b = await until(PB, (x) => x.tro.indexOf("fr-card") >= 0);
  ok(a.tro.indexOf("fr-follow") >= 0 && a.tro.indexOf("fr-card") >= 0 && b.tro.indexOf("fr-card") >= 0, "trophies: A and B earn Over the fence and Good neighbours", [a.tro, b.tro]);
  let docs = await alist("cards/" + uA + "/to");
  ok(docs.length === 1 && docs[0].id === uB && Object.keys(docs[0].data).sort().join() === "at,ct,iv,q" && Object.keys(docs[0].data.q).sort().join() === "d,n", "A's card is one doc per reader with only { iv, ct, at, q }", docs);
  ok(!/stars|cleared|tiers|"u"|"day"|Alice/.test(JSON.stringify(docs)), "card ciphertext holds no plaintext progress", docs);

  c = await call(PC, "frAdd", codeA);
  c = await until(PC, (x) => /Hasn't added you back/.test(row(x, uA)));
  ok(has(c.friends, uA) && /Hasn't added you back/.test(row(c, uA)) && c.cards[uA] !== "ok", "one-way: C follows A but A doesn't follow back, so C sees no stats", row(c, uA));
  c = await until(PC, (x) => x.tro.indexOf("fr-follow") >= 0);
  ok(c.tro.indexOf("fr-follow") >= 0 && c.tro.indexOf("fr-card") < 0, "trophies: C's one-way follow earns Over the fence only", c.tro);
  ok((await call(PC, "fs", "get", "cards/" + uA + "/to/" + uB)).err === "permission-denied", "outsider C can't read A's card for B (rules deny)");
  ok((await call(PC, "fs", "list", "cards/" + uA + "/to")).err === "permission-denied", "outsider C can't list A's cards");
  ok((await call(PB, "fs", "get", "cards/" + uA + "/to/" + uC)).err === "permission-denied", "B can't read a card addressed to someone else");
  ok((await call(PC, "fs", "get", "users/" + uA + "/data/friends")).err === "permission-denied", "C can't read A's private friend list");
  ok((await call(PC, "fs", "list", "pub")).err === "permission-denied" && (await call(PC, "fs", "list", "codes")).err === "permission-denied", "pub and codes can't be listed");

  const r1 = await call(PA, "frChallenge", uB, true, 1);
  ok(r1.title === "Challenge sent" && /\+5 nectar/.test(r1.text), "A plays a challenge first and sends it, +5 nectar", r1);
  let items = await waitAdmin(async () => { const l = await alist("inbox/" + uB + "/items"); return l.length ? l : null; });
  const mineA = await aget("users/" + uA + "/data/chal"), cid = Object.keys(mineA.out)[0], seed = mineA.out[cid].seed;
  ok(items && items.length === 1 && items[0].data.from === uA && items[0].data.kind === "chal" && items[0].id.indexOf(uA + "_") === 0, "the challenge lands as one item in B's inbox", items);
  ok(!JSON.stringify(items).includes(String(seed)) && !JSON.stringify(items).includes(cid) && !JSON.stringify(items).includes(uB), "inbox item reveals no seed, challenge id or recipient", { seed, cid });
  b = await until(PB, (x) => x.badge === "1" && /Alice Example challenges you/.test(x.chal));
  ok(b.badge === "1" && /Alice Example challenges you/.test(b.chal), "B's badge and inbox show Alice's challenge", [b.badge, b.chal]);
  ok((await call(PC, "fs", "list", "inbox/" + uB + "/items")).err === "permission-denied", "outsider C can't list B's inbox");
  ok((await call(PA, "fs", "get", "inbox/" + uB + "/items/" + items[0].id)).err === "permission-denied", "the sender can't read B's inbox back");
  if (SEED) { out("seeded"); out(`PASS ${pass} checks`); fetch("/__release?k=" + HOLD); return; }

  const r2 = await call(PB, "frPlay", 0);
  ok(r2.title === "You win" && /\+5 nectar/.test(r2.text), "B answers with fewer seeds and wins, +5 nectar", r2);
  b = await until(PB, (x) => x.hist.some((h) => /You won/.test(h)));
  ok(b.badge === "" && b.hist.some((h) => /Alice Example vs you/.test(h) && /You won/.test(h)), "B's history shows the win", b.hist);
  a = await until(PA, (x) => x.hist.some((h) => /They won/.test(h)));
  ok(a.hist.some((h) => /You vs Bob Builder/.test(h) && /They won/.test(h)), "A sees B's answer as a loss", a.hist);
  items = await alist("inbox/" + uA + "/items");
  ok(items.length === 1 && items[0].data.kind === "res" && items[0].data.from === uB && !JSON.stringify(items).includes(String(seed)), "the answer goes to A's inbox, sealed", items);
  ok(a.chalPay.length === 1 && /=5$/.test(a.chalPay[0]) && b.chalPay.length === 1 && /=5$/.test(b.chalPay[0]), "nectar paid once each", [a.chalPay, b.chalPay]);
  b = await until(PB, (x) => x.tro.indexOf("fr-win") >= 0);
  a = await call(PA, "fr");
  ok(b.tro.indexOf("fr-play") >= 0 && b.tro.indexOf("fr-win") >= 0 && b.wins === 1 && a.tro.indexOf("fr-send") >= 0 && a.tro.indexOf("fr-win") < 0 && a.tro.indexOf("fr-play") < 0 && !a.wins, "trophies: B earns Cross-pollinated and Blue ribbon, A earns Gauntlet but no win", [a.tro, b.tro, a.wins, b.wins]);
  await load(PA); await call(PA, "frTab");
  a = await until(PA, (x) => x.mode === "ready" && x.hist.length >= 1);
  ok(a.chalPay.length === 1 && a.hist.some((h) => /They won/.test(h)), "after a reload A keeps the result and is not paid again", [a.chalPay, a.hist]);

  const now = Date.now(), res = (used, at) => ({ used, stars: 2, pollen: 1, pt: 2, time: 40, at });
  const priv = await aget("users/" + uA + "/data/chal");
  priv.out.walkov0001 = { to: uB, seed: 333111, diff: 2, at: now - 8 * DAY, exp: now - DAY, r: res(4, now - 8 * DAY + 60000) };
  priv.out.expird0001 = { to: uB, seed: 333222, diff: 3, at: now - 9 * DAY, exp: now - 2 * DAY };
  await aset("users/" + uA + "/data/chal", priv);
  b = await until(PB, (x) => x.hist.some((h) => /They won \(walkover\)/.test(h)) && x.hist.some((h) => /Expired/.test(h)), 20000);
  if (!b.hist.some((h) => /Expired/.test(h))) { out("probe A " + JSON.stringify(await call(PA, "probe"))); b = await until(PB, (x) => x.hist.some((h) => /Expired/.test(h)), 90000); out("after 90 s more: " + JSON.stringify(b.hist) + " " + JSON.stringify((await call(PA, "fr")).dbg)); }
  ok(b.hist.some((h) => /They won \(walkover\)/.test(h)) && b.hist.some((h) => /Expired/.test(h)), "B sees the walkover and the expired challenge", [b.hist, b.dbg, (await alist("inbox/" + uB + "/items")).map((d) => d.data.kind + "@" + d.id.slice(-6)), (await call(PA, "fr")).dbg, (await call(PA, "fr")).notes]);
  a = await until(PA, (x) => x.hist.some((h) => /You won \(walkover\)/.test(h)));
  ok(a.hist.some((h) => /You won \(walkover\)/.test(h)) && a.hist.some((h) => /Expired/.test(h)), "A sees its walkover win and the expired one", a.hist);
  await sleep(800);
  a = await call(PA, "fr");
  ok(a.tro.indexOf("fr-win") < 0 && !a.wins, "trophies: A's walkover win records no win", [a.tro, a.wins]);

  const pubB0 = await aget("pub/" + uB);
  const fk = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]), fj = await crypto.subtle.exportKey("jwk", fk.publicKey);
  await aset("pub/" + uB, { x: fj.x, y: fj.y, at: Date.now() });
  b = await until(PB, (x) => /replaced by someone else and has been restored/.test(x.note));
  ok(/replaced by someone else and has been restored/.test(b.note), "B notices the admin swapped its key and says so", b.note);
  ok(await waitAdmin(async () => { const p = await aget("pub/" + uB); return p && p.x === pubB0.x; }), "own-key restore: B republishes its real key");
  a = await until(PA, (x) => x.cards[uB] === "ok" && !/paused/.test(row(x, uB)));
  ok(a.cards[uB] === "ok", "A keeps reading B's card after the restore", row(a, uB));

  frames[PB].src = "about:blank";
  await sleep(500);
  await adel("users/" + uB + "/data/keys");
  const histB = b.hist.length;
  await load(PB); await call(PB, "frTab");
  ok(await waitAdmin(async () => { const p = await aget("pub/" + uB); return p && p.x !== pubB0.x; }), "B lost its private key, made a new pair and published it");
  a = await until(PA, (x) => /Sharing with them is paused/.test(row(x, uB)));
  ok(/Sharing with them is paused/.test(row(a, uB)) && /Their key changed/.test(row(a, uB)) && /Accept new key/.test(row(a, uB)), "A pauses sharing with B and shows the key warning", row(a, uB));
  ok(await waitAdmin(async () => !(await alist("cards/" + uA + "/to")).some((d) => d.id === uB)), "A stops encrypting its card to B's unverified key", (await call(PA, "fr")).dbg);
  ok((await call(PA, "frChallenge", uB, false)).err === "no challenge button", "A can't challenge B while the key is unaccepted");
  const sA = await call(PA, "frSafe", uB), sB = await call(PB, "frSafe", uA);
  ok(/^\d{4} \d{4} \d{4}$/.test(sA.code) && sA.code === sB.code, "safety codes match on both screens", [sA.code, sB.code]);
  await call(PA, "frAccept", uB);
  a = await until(PA, (x) => x.cards[uB] === "ok" && !/paused/.test(row(x, uB)), 20000);
  ok(a.cards[uB] === "ok" && /Shares with you/.test(row(a, uB)), "accepting resumes: A reads B's new card", row(a, uB));
  ok(await waitAdmin(async () => (await alist("cards/" + uA + "/to")).some((d) => d.id === uB)), "A re-encrypts its card for B");
  b = await until(PB, (x) => x.cards[uA] === "ok" && x.hist.length >= histB, 20000);
  ok(b.cards[uA] === "ok" && b.hist.length >= histB, "B reads A's card again and gets its challenge history back", [b.cards, b.hist.length, histB]);
  await call(PA, "frSafe", uB);
  await call(PA, "frVerify", uB);
  a = await until(PA, (x) => /verified/.test(row(x, uB)));
  ok(/verified/.test(row(a, uB)), "Mark as verified shows the badge", row(a, uB));

  c = await until(PC, (x) => /Alice Example/.test(row(x, uA)));
  ok(/Alice Example/.test(row(c, uA)), "C sees Alice's Google name");
  await call(PA, "frName", false);
  ok(await waitAdmin(async () => { const p = await aget("pub/" + uA); return p && !("n" in p); }), "name off: pub drops the name");
  await load(PC); await call(PC, "frTab");
  c = await until(PC, (x) => x.mode === "ready" && new RegExp("Gardener " + codeA.slice(0, 3) + "-" + codeA.slice(3)).test(row(x, uA)));
  ok(new RegExp("Gardener " + codeA.slice(0, 3) + "-" + codeA.slice(3)).test(row(c, uA)), "with the name off, C sees Gardener and the code", row(c, uA));

  a = await call(PA, "frRemove", uB);
  ok(!has(a.friends, uB), "A unfollows B");
  ok(await waitAdmin(async () => !(await alist("cards/" + uA + "/to")).some((d) => d.id === uB)), "unfollowing deletes A's card doc for B");
  b = await until(PB, (x) => /Hasn't added you back/.test(row(x, uA)));
  ok(/Hasn't added you back/.test(row(b, uA)) && b.cards[uA] !== "ok", "B no longer sees A's progress", row(b, uA));
  ok((await call(PB, "fs", "get", "cards/" + uA + "/to/" + uB)).exists === false, "B's card slot at A is empty");

  ok((await alist("cards/" + uB + "/to")).length >= 1, "B still shares with A before switching off");
  await call(PB, "frShare", false);
  ok(await waitAdmin(async () => (await alist("cards/" + uB + "/to")).length === 0), "sharing off deletes all of B's card docs");
  ok(await waitAdmin(async () => { const p = await aget("pub/" + uB); return p && !p.s; }), "sharing off clears the share flag on pub");

  a = await call(PA, "signOut");
  a = await until(PA, (x) => x.mode === "signedout");
  ok(a.mode === "signedout" && a.signBtn && a.rows.length === 0, "signing out shows the sign-in card and no friends", a.mode);

  const eA = (await call(PA, "fr")).errs, eB = (await call(PB, "fr")).errs, eC = (await call(PC, "fr")).errs;
  ok(!eA.length && !eB.length && !eC.length, "no console errors or warnings in any frame", { A: eA, B: eB, C: eC });
  out(fails ? `FAIL ${fails} of ${pass + fails}` : `PASS ${pass} checks`);
  fetch("/__release?k=" + HOLD);
})().catch((e) => { out("FAIL harness " + String(e) + " " + ((e && (e.code || e.stack)) || "")); out(`FAIL ${fails + 1} of ${pass + fails + 1}`); fetch("/__release?k=" + HOLD); });
