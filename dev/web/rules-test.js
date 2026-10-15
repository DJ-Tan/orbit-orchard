const fs = require("fs");
const path = require("path");
const { initializeTestEnvironment, assertSucceeds, assertFails } = require("@firebase/rules-unit-testing");
const { doc, getDoc, getDocs, setDoc, deleteDoc, updateDoc, collection, query, where, runTransaction, writeBatch, serverTimestamp, Timestamp } = require("firebase/firestore");
const C = require("../../js/cloud.js");
const G = require("./gen-dst.js");

const DAYMS = 864e5;
const dst = (t) => G.table.some((x) => t >= x[0] && t < x[1]);
const dayOf = (t) => Math.floor((t - (dst(t) ? 7 : 8) * 36e5) / DAYMS);
const D = dayOf(Date.now());
const CAPS = { save: 100, friends: 20, keys: 10, pins: 20, chal: 40, sent: 40 };
const Q = {};
const qNext = (p) => ({ d: D, n: (Q[p] || 0) + 1 });
const metered = (p) => /^users\/[^/]+\/data\/[a-z]+$|^pub\/[^/]+$|^cards\/[^/]+\/to\/[^/]+$/.test(p);
/** Writes with the next daily counter on metered paths; the counter only advances when the write succeeds. */
const put = (db, p, data) => { const q = metered(p) ? qNext(p) : null; return setDoc(doc(db, p), q ? Object.assign({}, data, { q }) : data).then(() => { if (q) Q[p] = q.n; }); };
const drop = (db, p) => deleteDoc(doc(db, p)).then(() => { delete Q[p]; });
/** Claims one allowance block: the day's counter and the caller's seat rise together. */
const claim = (db, uid, day, f) => runTransaction(db, async (tx) => {
  const c = doc(db, "days/" + (day || D)), s = doc(db, "days/" + (day || D) + "/u/" + uid);
  const n = ((await tx.get(c)).data() || { n: 0 }).n, k = ((await tx.get(s)).data() || { k: 0 }).k;
  const v = (f || ((a, b) => [{ n: a + 1 }, { k: b + 1 }]))(n, k);
  if (v[0]) tx.set(c, v[0]);
  if (v[1]) tx.set(s, v[1]);
});

const S = {
  levels: { "w1-01": { stars: 3, golden: true, best: 1, time: 9, clears: 2 } }, ach: { "first-clear": 1 }, fails: { "w1-02": 1 },
  stats: { sown: 4, plants: 3, playMs: 1000 }, flora: { daisy: 3 },
  daily: { last: null, streak: 0, best: 0, days: {} }, wallet: { earn: { "clear:w1-01": 10 }, spend: {}, frost: {} },
  settings: { skin: "nocturne", grid: true, master: 0.8 }, seen: { fertile: 1 }, coach: {}, announced: { 1: 1 }, skins: { nocturne: 1 },
  sync: { dev: "devA", gen: 0, others: {}, settingsAt: 0, st: null }
};
const save = () => Object.assign(C.toWire(JSON.parse(JSON.stringify(S))), { at: Date.now() });
const save0 = save;

let pass = 0, failN = 0;
async function check(name, p) {
  try { await p; pass++; console.log("ok   " + name); } catch (e) { failN++; console.log("FAIL " + name + ": " + (e && e.message)); }
}

const X = "A".repeat(42) + "Q", Y = "B".repeat(42) + "g", IV = "AAAAAAAAAAAAAAAA", CT = "abc_-9";
const HID = "abcdefghij_-0123";
const item = (from, extra) => Object.assign({ from, kind: "chal", iv: IV, ct: CT, at: Date.now(), k: Date.now() + 21 * 864e5 }, extra || {});

async function friends(env, alice, bob, anon) {
  const cara = env.authenticatedContext("cara").firestore();
  const p = (db, uid, name) => doc(db, "users/" + uid + "/data/" + name);
  const pp = (uid, name) => "users/" + uid + "/data/" + name;
  await check("friends doc with nm accepted", assertSucceeds(put(alice, pp("alice", "friends"), { v: 1, f: { bob: { at: 1, code: "BQ7K2M" } }, share: { on: true, nectar: false, at: 1 }, code: { c: "AK5MZ7", at: 1 }, nm: { on: false, at: 2 } })));
  await check("friends doc with an extra key denied", assertFails(put(alice, pp("alice", "friends"), { v: 1, f: {}, x: 1 })));
  await check("keys doc accepted", assertSucceeds(put(alice, pp("alice", "keys"), { v: 1, jwk: { kty: "EC", crv: "P-256", x: X, y: Y, d: X }, at: 1 })));
  await check("keys doc with an extra key denied", assertFails(put(alice, pp("alice", "keys"), { v: 1, jwk: {}, at: 1, pub: 1 })));
  await check("pins doc accepted", assertSucceeds(put(alice, pp("alice", "pins"), { v: 1, p: { bob: { fp: X, at: 1 } } })));
  await check("chal doc accepted", assertSucceeds(put(alice, pp("alice", "chal"), { v: 1, to: [], from: [], out: {}, res: {} })));
  const many = {};
  for (let i = 0; i < 41; i++) many["c" + i + "aaaaaa"] = { to: "bob" };
  await check("chal doc over 40 outgoing denied", assertFails(put(alice, pp("alice", "chal"), { v: 1, out: many, res: {} })));
  await check("sent ledger accepted", assertSucceeds(put(alice, pp("alice", "sent"), { v: 1, s: { ["alice_" + HID]: { t: "bob", k: 1 } } })));
  for (const n of ["friends", "keys", "pins", "chal", "sent"]) {
    await check("private " + n + ": other user can't read", assertFails(getDoc(p(bob, "alice", n))));
    await check("private " + n + ": other user can't write", assertFails(setDoc(p(bob, "alice", n), { v: 1, q: qNext(pp("alice", n)) })));
    await check("private " + n + ": signed out can't read", assertFails(getDoc(p(anon, "alice", n))));
  }

  const pub = (db, uid) => doc(db, "pub/" + uid);
  await check("pub: owner publishes key with name and share flag", assertSucceeds(put(alice, "pub/alice", { x: X, y: Y, at: 1, n: "Alice Example", s: true })));
  await check("pub: owner republishes without name", assertSucceeds(put(alice, "pub/alice", { x: X, y: Y, at: 2 })));
  await check("pub: name over 40 chars denied", assertFails(put(alice, "pub/alice", { x: X, y: Y, at: 3, n: "x".repeat(41) })));
  await check("pub: extra key denied", assertFails(put(alice, "pub/alice", { x: X, y: Y, at: 3, u: "alice" })));
  await check("pub: bad coordinate denied", assertFails(put(alice, "pub/alice", { x: X.slice(1), y: Y, at: 3 })));
  await check("pub: other user can't overwrite", assertFails(setDoc(pub(bob, "alice"), { x: Y, y: X, at: 9, q: qNext("pub/alice") })));
  await check("pub: other user can't delete", assertFails(deleteDoc(pub(bob, "alice"))));
  await check("pub: signed-in user gets it", assertSucceeds(getDoc(pub(bob, "alice"))));
  await check("pub: signed out can't get", assertFails(getDoc(pub(anon, "alice"))));
  await check("pub: nobody can list", assertFails(getDocs(collection(bob, "pub"))));
  await check("pub: owner can't list either", assertFails(getDocs(collection(alice, "pub"))));
  await check("pub: bob publishes his", assertSucceeds(put(bob, "pub/bob", { x: Y, y: X, at: 1 })));

  const code = (db, c) => doc(db, "codes/" + c);
  await check("codes: create own code", assertSucceeds(setDoc(code(alice, "AK5MZ7"), { u: "alice" })));
  await check("codes: signed-in user gets it", assertSucceeds(getDoc(code(bob, "AK5MZ7"))));
  await check("codes: signed out can't get", assertFails(getDoc(code(anon, "AK5MZ7"))));
  await check("codes: nobody can list", assertFails(getDocs(collection(bob, "codes"))));
  await check("codes: query by owner denied", assertFails(getDocs(query(collection(alice, "codes"), where("u", "==", "alice")))));
  await check("codes: steal an existing code denied", assertFails(setDoc(code(bob, "AK5MZ7"), { u: "bob" })));
  await check("codes: owner can't update either", assertFails(setDoc(code(alice, "AK5MZ7"), { u: "alice" })));
  await check("codes: create a code naming someone else denied", assertFails(setDoc(code(bob, "BQ7K2M"), { u: "alice" })));
  await check("codes: bad code format denied", assertFails(setDoc(code(bob, "BQ7K2I"), { u: "bob" })));
  await check("codes: extra key denied", assertFails(setDoc(code(bob, "BQ7K2M"), { u: "bob", c: "BQ7K2M" })));
  await check("codes: others can't delete", assertFails(deleteDoc(code(bob, "AK5MZ7"))));
  await check("codes: owner deletes (rotation)", assertSucceeds(deleteDoc(code(alice, "AK5MZ7"))));

  const card = (db, o, r) => doc(db, "cards/" + o + "/to/" + r);
  const body = { iv: IV, ct: CT, at: 1 };
  await check("cards: owner writes card for reader", assertSucceeds(put(alice, "cards/alice/to/bob", body)));
  await check("cards: owner rewrites it", assertSucceeds(put(alice, "cards/alice/to/bob", Object.assign({}, body, { at: 2 }))));
  await check("cards: reader reads it", assertSucceeds(getDoc(card(bob, "alice", "bob"))));
  await check("cards: owner reads it", assertSucceeds(getDoc(card(alice, "alice", "bob"))));
  await check("cards: third party can't read", assertFails(getDoc(card(cara, "alice", "bob"))));
  await check("cards: signed out can't read", assertFails(getDoc(card(anon, "alice", "bob"))));
  await check("cards: reader can't write", assertFails(setDoc(card(bob, "alice", "bob"), Object.assign({ q: qNext("cards/alice/to/bob") }, body))));
  await check("cards: third party can't write", assertFails(setDoc(card(cara, "alice", "cara"), Object.assign({ q: qNext("cards/alice/to/cara") }, body))));
  await check("cards: reader can't delete", assertFails(deleteDoc(card(bob, "alice", "bob"))));
  await check("cards: owner lists own cards", assertSucceeds(getDocs(collection(alice, "cards/alice/to"))));
  await check("cards: reader can't list owner's cards", assertFails(getDocs(collection(bob, "cards/alice/to"))));
  await check("cards: reader can read a missing card for them", assertSucceeds(getDoc(card(bob, "cara", "bob"))));
  await check("cards: plaintext field denied", assertFails(put(alice, "cards/alice/to/bob", Object.assign({}, body, { stars: 9 }))));
  await check("cards: oversized ciphertext denied", assertFails(put(alice, "cards/alice/to/bob", Object.assign({}, body, { ct: "a".repeat(4097) }))));
  await check("cards: card for self denied", assertFails(put(alice, "cards/alice/to/alice", body)));
  await check("cards: owner deletes", assertSucceeds(drop(alice, "cards/alice/to/bob")));

  const box = (db, to, id) => doc(db, "inbox/" + to + "/items/" + id);
  await check("inbox: alice sends bob an item", assertSucceeds(setDoc(box(alice, "bob", "alice_" + HID), item("alice"))));
  await check("inbox: answer kind accepted", assertSucceeds(setDoc(box(alice, "bob", "alice_" + HID.replace("a", "b")), item("alice", { kind: "res" }))));
  await check("inbox: same id again (update) denied", assertFails(setDoc(box(alice, "bob", "alice_" + HID), item("alice"))));
  await check("inbox: forged from denied", assertFails(setDoc(box(cara, "bob", "cara_" + HID), item("alice"))));
  await check("inbox: id with someone else's prefix denied", assertFails(setDoc(box(cara, "bob", "alice_" + HID.replace("a", "c")), item("cara"))));
  await check("inbox: id without the 16-char suffix denied", assertFails(setDoc(box(cara, "bob", "cara_x"), item("cara"))));
  await check("inbox: oversized body denied", assertFails(setDoc(box(cara, "bob", "cara_" + HID), item("cara", { ct: "a".repeat(2049) }))));
  await check("inbox: extra key denied", assertFails(setDoc(box(cara, "bob", "cara_" + HID), item("cara", { seed: 123 }))));
  await check("inbox: missing key denied", assertFails(setDoc(box(cara, "bob", "cara_" + HID), (() => { const d = item("cara"); delete d.k; return d; })())));
  await check("inbox: unknown kind denied", assertFails(setDoc(box(cara, "bob", "cara_" + HID), item("cara", { kind: "spam" }))));
  await check("inbox: prune time beyond 22 days denied", assertFails(setDoc(box(cara, "bob", "cara_" + HID), item("cara", { k: Date.now() + 30 * 864e5 }))));
  await check("inbox: backdated item denied", assertFails(setDoc(box(cara, "bob", "cara_" + HID), item("cara", { at: Date.now() - 3 * 864e5, k: Date.now() }))));
  await check("inbox: recipient without a pub doc denied", assertFails(setDoc(box(alice, "cara", "alice_" + HID), item("alice"))));
  await check("inbox: item to self denied", assertFails(setDoc(box(bob, "bob", "bob_" + HID), item("bob"))));
  await check("inbox: signed out can't send", assertFails(setDoc(box(anon, "bob", "anon_" + HID), item("anon"))));
  await check("inbox: owner lists inbox", assertSucceeds(getDocs(collection(bob, "inbox/bob/items"))));
  await check("inbox: owner reads an item", assertSucceeds(getDoc(box(bob, "bob", "alice_" + HID))));
  await check("inbox: sender can't read it back", assertFails(getDoc(box(alice, "bob", "alice_" + HID))));
  await check("inbox: third party can't read", assertFails(getDoc(box(cara, "bob", "alice_" + HID))));
  await check("inbox: third party can't list", assertFails(getDocs(collection(cara, "inbox/bob/items"))));
  await check("inbox: signed out can't list", assertFails(getDocs(collection(anon, "inbox/bob/items"))));
  await check("inbox: owner can't update", assertFails(updateDoc(box(bob, "bob", "alice_" + HID), { at: 1 })));
  await check("inbox: sender can't update", assertFails(updateDoc(box(alice, "bob", "alice_" + HID), { at: 1 })));
  await check("inbox: third party can't delete", assertFails(deleteDoc(box(cara, "bob", "alice_" + HID))));
  await check("inbox: sender deletes own item", assertSucceeds(deleteDoc(box(alice, "bob", "alice_" + HID))));
  await check("inbox: owner deletes an item", assertSucceeds(deleteDoc(box(bob, "bob", "alice_" + HID.replace("a", "b")))));
  await check("other top-level collections denied", assertFails(setDoc(doc(alice, "keys/alice"), { u: "alice", x: X, y: Y, at: 1 })));
}

async function allowance(env, alice, bob, anon) {
  const db = (u) => env.authenticatedContext(u).firestore();
  const dana = db("dana"), eve = db("eve"), fay = db("fay");
  const seed = (p, d) => env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), p), d));
  const read = (p) => { let v = null; return env.withSecurityRulesDisabled(async (c) => { const s = await getDoc(doc(c.firestore(), p)); v = s.exists() ? s.data() : null; }).then(() => v); };
  const n0 = (await read("days/" + D)).n;

  await check("today(): the client's Pacific day table matches the server's day", assertSucceeds(claim(dana, "dana")));
  const after = await read("days/" + D), seat = await read("days/" + D + "/u/dana");
  await check("claim: counter and seat each rose by exactly 1", after.n === n0 + 1 && seat.k === 1 ? Promise.resolve() : Promise.reject(new Error(JSON.stringify([n0, after, seat]))));
  await check("claim: tomorrow's day id denied", assertFails(claim(dana, "dana", D + 1)));
  await check("claim: yesterday's day id denied", assertFails(claim(dana, "dana", D - 1)));
  await check("claim: day id in another format denied", assertFails(claim(dana, "dana", D + ".0")));
  await check("claim: counter alone denied", assertFails(claim(dana, "dana", 0, (n) => [{ n: n + 1 }, null])));
  await check("claim: seat alone denied", assertFails(claim(dana, "dana", 0, (n, k) => [null, { k: k + 1 }])));
  await check("claim: counter +2 denied", assertFails(claim(dana, "dana", 0, (n, k) => [{ n: n + 2 }, { k: k + 1 }])));
  await check("claim: seat +2 denied", assertFails(claim(dana, "dana", 0, (n, k) => [{ n: n + 1 }, { k: k + 2 }])));
  await check("claim: lowering the counter denied", assertFails(claim(dana, "dana", 0, (n, k) => [{ n: n - 1 }, { k: k + 1 }])));
  await check("claim: forged seat k with an extra field denied", assertFails(claim(dana, "dana", 0, (n, k) => [{ n: n + 1 }, { k: k + 1, x: 1 }])));
  await check("claim: fractional counter denied", assertFails(claim(dana, "dana", 0, (n, k) => [{ n: n + 1.5 }, { k: k + 1 }])));
  await check("claim: raising someone else's seat denied", assertFails(runTransaction(dana, async (tx) => {
    const c = doc(dana, "days/" + D), n = (await tx.get(c)).data().n;
    tx.set(c, { n: n + 1 }); tx.set(doc(dana, "days/" + D + "/u/eve"), { k: 1 });
  })));
  await check("claim: deleting a seat denied", assertFails(deleteDoc(doc(dana, "days/" + D + "/u/dana"))));
  await check("claim: deleting the counter denied", assertFails(deleteDoc(doc(dana, "days/" + D))));
  await check("claim: signed out denied", assertFails(setDoc(doc(anon, "days/" + D), { n: n0 + 5 })));
  for (let i = 2; i <= 4; i++) await check("user cap: claim " + i + " of 4 accepted", assertSucceeds(claim(dana, "dana")));
  await check("user cap: a 5th claim the same day denied", assertFails(claim(dana, "dana")));
  await check("reads: signed-in user gets the counter", assertSucceeds(getDoc(doc(eve, "days/" + D))));
  await check("reads: user gets own seat", assertSucceeds(getDoc(doc(dana, "days/" + D + "/u/dana"))));
  await check("reads: another user's seat denied", assertFails(getDoc(doc(eve, "days/" + D + "/u/dana"))));
  await check("reads: listing days denied", assertFails(getDocs(collection(eve, "days"))));
  await check("reads: listing seats denied", assertFails(getDocs(collection(dana, "days/" + D + "/u"))));
  await check("reads: signed out can't get the counter", assertFails(getDoc(doc(anon, "days/" + D))));
  const cur = (await read("days/" + D)).n;
  await seed("days/" + D, { n: 399 });
  await check("day cap: claim number 400 accepted", assertSucceeds(claim(fay, "fay")));
  await check("day cap: claim number 401 denied", assertFails(claim(eve, "eve")));
  await seed("days/" + D, { n: 400 });
  await check("day cap: a forged n of 401 denied", assertFails(claim(eve, "eve", 0, () => [{ n: 401 }, { k: 1 }])));
  await seed("days/" + D, { n: cur + 1 });

  const save = (u) => "users/" + u + "/data/save";
  await check("no seat: q with n 1 denied", assertFails(put(eve, save("eve"), save0())));
  await check("no seat: inbox create denied", assertFails(setDoc(doc(eve, "inbox/bob/items/eve_" + HID), item("eve"))));
  await check("no seat: code create denied", assertFails(setDoc(doc(eve, "codes/EVE234"), { u: "eve" })));
  await check("no seat: eve claims a block", assertSucceeds(claim(eve, "eve")));
  await check("seated: the same save write accepted", assertSucceeds(put(eve, save("eve"), save0())));
  await check("seated: the same inbox create accepted", assertSucceeds(setDoc(doc(eve, "inbox/bob/items/eve_" + HID), item("eve"))));
  await check("seated: the same code create accepted", assertSucceeds(setDoc(doc(eve, "codes/EVE234"), { u: "eve" })));
  await check("old format: save without q denied", assertFails(setDoc(doc(alice, "users/alice/data/save"), save0())));
  await check("old format: friends without q denied", assertFails(setDoc(doc(alice, "users/alice/data/friends"), { v: 1, f: {} })));
  await check("old format: pub without q denied", assertFails(setDoc(doc(alice, "pub/alice"), { x: X, y: Y, at: 9 })));
  await check("old format: card without q denied", assertFails(setDoc(doc(alice, "cards/alice/to/bob"), { iv: IV, ct: CT, at: 1 })));

  const FP = "users/alice/data/pins", body = { v: 1, p: {} };
  await check("q: next n accepted", assertSucceeds(put(alice, FP, body)));
  const n = Q[FP];
  const raw = (q, extra) => setDoc(doc(alice, FP), Object.assign({}, body, { q }, extra || {}));
  await check("q: repeating n denied", assertFails(raw({ d: D, n })));
  await check("q: skipping n denied", assertFails(raw({ d: D, n: n + 2 })));
  await check("q: restarting at 1 denied", assertFails(raw({ d: D, n: 1 })));
  await check("q: yesterday's day denied", assertFails(raw({ d: D - 1, n: n + 1 })));
  await check("q: tomorrow's day denied", assertFails(raw({ d: D + 1, n: 1 })));
  await check("q: day as a string denied", assertFails(raw({ d: String(D), n: n + 1 })));
  await check("q: fractional n denied", assertFails(raw({ d: D, n: n + 0.5 })));
  await check("q: extra counter field denied", assertFails(raw({ d: D, n: n + 1, x: 1 })));
  await check("q: partial update keeping the old n denied", assertFails(updateDoc(doc(alice, FP), { p: {} })));
  await seed(FP, Object.assign({}, body, { q: { d: D - 1, n: 19 } }));
  await check("q: first write of a new day starts again at 1", assertSucceeds(raw({ d: D, n: 1 })));
  await seed(FP, Object.assign({}, body, { q: { d: D - 1, n: 3 } }));
  await check("q: first write of a new day with n 4 denied", assertFails(raw({ d: D, n: 4 })));

  const caps = Object.keys(CAPS).map((k) => [save("alice").replace("save", k), CAPS[k]]).concat([["pub/alice", 20], ["cards/alice/to/bob", 12]]);
  const bodies = { save: save0(), friends: { v: 1, f: {} }, keys: { v: 1, jwk: {}, at: 1 }, pins: { v: 1, p: {} }, chal: { v: 1, out: {}, res: {} }, sent: { v: 1, s: {} }, pub: { x: X, y: Y, at: 1 }, card: { iv: IV, ct: CT, at: 1 } };
  for (const [path, cap] of caps) {
    const b = bodies[path.split("/").pop()] || (/^pub/.test(path) ? bodies.pub : bodies.card);
    await seed(path, Object.assign({}, b, { q: { d: D, n: cap - 1 } }));
    await check("cap " + path.split("/").slice(-1)[0] + " " + cap + ": write number " + cap + " accepted", assertSucceeds(setDoc(doc(alice, path), Object.assign({}, b, { q: { d: D, n: cap } }))));
    await check("cap " + path.split("/").slice(-1)[0] + " " + cap + ": write number " + (cap + 1) + " denied", assertFails(setDoc(doc(alice, path), Object.assign({}, b, { q: { d: D, n: cap + 1 } }))));
  }

  const w = writeBatch(alice);
  for (let i = 0; i < 60; i++) w.set(doc(alice, "cards/alice/to/r" + i), { iv: IV, ct: CT, at: 1, q: { d: D, n: 1 } });
  await check("cards: a batch of 60 first writes of the day accepted (one seat lookup)", assertSucceeds(w.commit()));
}

async function feedback(env, alice, bob, anon) {
  const db = (u) => env.authenticatedContext(u).firestore();
  const fa = db("fa"), fb = db("fb"), fc = db("fc"), gus = db("gus");
  for (const [d, u] of [[fa, "fa"], [fb, "fb"], [fc, "fc"]]) await check("feedback: " + u + " claims a block", assertSucceeds(claim(d, u)));
  const fp = (u, n) => "feedback/" + u + "/m/" + n;
  const note = (u, extra) => Object.assign({ v: 1, u, cat: "bug", msg: "The sun in w1-03 hides the last plot.", at: serverTimestamp() }, extra || {});
  const without = (u, k) => { const d = note(u); delete d[k]; return d; };
  const info = (extra) => Object.assign({ ver: "2", build: "web", skin: "nocturne", worlds: 3, stars: 120, view: "desktop", ua: "Firefox" }, extra || {});
  const put = (d, u, n, body) => setDoc(doc(d, fp(u, n)), body);

  await check("feedback: create with exactly 10 characters, a newline and a tab accepted", assertSucceeds(put(fa, "fa", D + "-0", note("fa", { msg: "line one\n\tx" }))));
  await check("feedback: create with 1000 characters and full game info accepted", assertSucceeds(put(fa, "fa", D + "-1", note("fa", { cat: "idea", msg: "a".repeat(1000), info: info() }))));
  await check("feedback: third note of the day accepted", assertSucceeds(put(fa, "fa", D + "-2", note("fa", { cat: "praise" }))));
  await check("feedback: a 4th note of the day denied", assertFails(put(fa, "fa", D + "-3", note("fa"))));
  await check("feedback: reusing today's first slot (update) denied", assertFails(put(fa, "fa", D + "-0", note("fa", { cat: "other" }))));
  await check("feedback: partial update denied", assertFails(updateDoc(doc(fa, fp("fa", D + "-1")), { cat: "other" })));
  await check("feedback: owner can't delete", assertFails(deleteDoc(doc(fa, fp("fa", D + "-0")))));
  await check("feedback: owner can't read own note", assertFails(getDoc(doc(fa, fp("fa", D + "-0")))));
  await check("feedback: owner can't list own notes", assertFails(getDocs(collection(fa, "feedback/fa/m"))));
  await check("feedback: owner can't query own notes", assertFails(getDocs(query(collection(fa, "feedback/fa/m"), where("u", "==", "fa")))));
  await check("feedback: another user can't read a note", assertFails(getDoc(doc(fb, fp("fa", D + "-0")))));
  await check("feedback: another user can't list notes", assertFails(getDocs(collection(fb, "feedback/fa/m"))));
  await check("feedback: another user can't delete a note", assertFails(deleteDoc(doc(fb, fp("fa", D + "-0")))));
  await check("feedback: signed out can't read a note", assertFails(getDoc(doc(anon, fp("fa", D + "-0")))));
  await check("feedback: per-user parent doc can't be written", assertFails(setDoc(doc(fa, "feedback/fa"), { n: 1 })));
  await check("feedback: per-user parent doc can't be read", assertFails(getDoc(doc(fa, "feedback/fa"))));
  await check("feedback: top-level collection can't be listed", assertFails(getDocs(collection(fa, "feedback"))));

  await check("feedback: writing into another user's notes denied", assertFails(put(fb, "fa", D + "-0", note("fb"))));
  await check("feedback: another user's slot with their uid as owner denied", assertFails(put(fb, "fc", D + "-0", note("fc"))));
  await check("feedback: own path with someone else's owner field denied", assertFails(put(fb, "fb", D + "-0", note("fa"))));
  await check("feedback: signed out create denied", assertFails(put(anon, "fb", D + "-0", note("fb"))));
  await check("feedback: yesterday's day id denied", assertFails(put(fb, "fb", (D - 1) + "-0", note("fb"))));
  await check("feedback: tomorrow's day id denied", assertFails(put(fb, "fb", (D + 1) + "-0", note("fb"))));
  await check("feedback: padded counter denied", assertFails(put(fb, "fb", D + "-00", note("fb"))));
  await check("feedback: id from the message text denied", assertFails(put(fb, "fb", "the-sun-in-w1-03", note("fb"))));
  await check("feedback: random id denied", assertFails(put(fb, "fb", D + "-k3m9x2ab", note("fb"))));
  await check("feedback: 1001 characters denied", assertFails(put(fb, "fb", D + "-0", note("fb", { msg: "a".repeat(1001) }))));
  await check("feedback: 9 characters denied", assertFails(put(fb, "fb", D + "-0", note("fb", { msg: "too short" }))));
  await check("feedback: empty message denied", assertFails(put(fb, "fb", D + "-0", note("fb", { msg: "" }))));
  await check("feedback: message as a number denied", assertFails(put(fb, "fb", D + "-0", note("fb", { msg: 12345678901 }))));
  await check("feedback: message as a list denied", assertFails(put(fb, "fb", D + "-0", note("fb", { msg: ["a long enough line"] }))));
  await check("feedback: message as a map denied", assertFails(put(fb, "fb", D + "-0", note("fb", { msg: { toString: "a long enough line" } }))));
  await check("feedback: NUL character denied", assertFails(put(fb, "fb", D + "-0", note("fb", { msg: "hello\u0000 world here" }))));
  await check("feedback: carriage return denied", assertFails(put(fb, "fb", D + "-0", note("fb", { msg: "hello\r\nworld here" }))));
  await check("feedback: C1 control denied", assertFails(put(fb, "fb", D + "-0", note("fb", { msg: "hello \u0085 world here" }))));
  await check("feedback: bidi override denied", assertFails(put(fb, "fb", D + "-0", note("fb", { msg: "hello \u202Edlrow here" }))));
  await check("feedback: bidi isolate denied", assertFails(put(fb, "fb", D + "-0", note("fb", { msg: "hello \u2066world\u2069 here" }))));
  await check("feedback: zero-width space denied", assertFails(put(fb, "fb", D + "-0", note("fb", { msg: "hello\u200Bworld here" }))));
  await check("feedback: byte order mark denied", assertFails(put(fb, "fb", D + "-0", note("fb", { msg: "\uFEFFhello world here" }))));
  await check("feedback: unknown category denied", assertFails(put(fb, "fb", D + "-0", note("fb", { cat: "spam" }))));
  await check("feedback: category in another case denied", assertFails(put(fb, "fb", D + "-0", note("fb", { cat: "Bug" }))));
  await check("feedback: category as a list denied", assertFails(put(fb, "fb", D + "-0", note("fb", { cat: ["bug"] }))));
  await check("feedback: extra key denied", assertFails(put(fb, "fb", D + "-0", note("fb", { name: "Bob" }))));
  await check("feedback: constructor key denied", assertFails(put(fb, "fb", D + "-0", note("fb", { constructor: { admin: true } }))));
  await check("feedback: a __proto__ field never leaves the SDK", Promise.resolve().then(() => put(fb, "fb", D + "-0", Object.defineProperty(note("fb"), "__proto__", { value: { admin: true }, enumerable: true }))).then(() => Promise.reject(new Error("accepted")), (e) => (e && e.code === "invalid-argument" ? null : Promise.reject(e))));
  for (const k of ["v", "u", "cat", "msg", "at"]) await check("feedback: missing " + k + " denied", assertFails(put(fb, "fb", D + "-0", without("fb", k))));
  await check("feedback: version 2 denied", assertFails(put(fb, "fb", D + "-0", note("fb", { v: 2 }))));
  await check("feedback: version as a string denied", assertFails(put(fb, "fb", D + "-0", note("fb", { v: "1" }))));
  await check("feedback: client clock instead of the server time denied", assertFails(put(fb, "fb", D + "-0", note("fb", { at: Date.now() }))));
  await check("feedback: backdated timestamp denied", assertFails(put(fb, "fb", D + "-0", note("fb", { at: new Date(Date.now() - 864e5) }))));
  await check("feedback: info as a string denied", assertFails(put(fb, "fb", D + "-0", note("fb", { info: "Firefox 131 on Linux" }))));
  await check("feedback: info with an extra key denied", assertFails(put(fb, "fb", D + "-0", note("fb", { info: info({ email: "bob@example.com" }) }))));
  await check("feedback: info with a uid denied", assertFails(put(fb, "fb", D + "-0", note("fb", { info: info({ uid: "fb" }) }))));
  await check("feedback: info without ver denied", assertFails(put(fb, "fb", D + "-0", note("fb", { info: (() => { const i = info(); delete i.ver; return i; })() }))));
  await check("feedback: info ver over 12 chars denied", assertFails(put(fb, "fb", D + "-0", note("fb", { info: info({ ver: "x".repeat(13) }) }))));
  await check("feedback: full user agent string denied", assertFails(put(fb, "fb", D + "-0", note("fb", { info: info({ ua: "Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0" }) }))));
  await check("feedback: unknown skin denied", assertFails(put(fb, "fb", D + "-0", note("fb", { info: info({ skin: "<b>x</b>" }) }))));
  await check("feedback: unknown screen size class denied", assertFails(put(fb, "fb", D + "-0", note("fb", { info: info({ view: "1920x1080" }) }))));
  await check("feedback: unknown build denied", assertFails(put(fb, "fb", D + "-0", note("fb", { info: info({ build: "dev" }) }))));
  await check("feedback: 6 worlds denied", assertFails(put(fb, "fb", D + "-0", note("fb", { info: info({ worlds: 6 }) }))));
  await check("feedback: 331 stars denied", assertFails(put(fb, "fb", D + "-0", note("fb", { info: info({ stars: 331 }) }))));
  await check("feedback: fractional stars denied", assertFails(put(fb, "fb", D + "-0", note("fb", { info: info({ stars: 1.5 }) }))));
  await check("feedback: negative worlds denied", assertFails(put(fb, "fb", D + "-0", note("fb", { info: info({ worlds: -1 }) }))));
  await check("feedback: stars as a string denied", assertFails(put(fb, "fb", D + "-0", note("fb", { info: info({ stars: "120" }) }))));
  await check("feedback: bob's own first note accepted", assertSucceeds(put(fb, "fb", D + "-0", note("fb", { cat: "other", info: { ver: "2", ua: "Other" } }))));
  await check("feedback: bob can't read it back", assertFails(getDoc(doc(fb, fp("fb", D + "-0")))));
  await check("feedback: a batch writing two slots at once is limited by the same rules", assertSucceeds((() => { const w = writeBatch(fc); w.set(doc(fc, fp("fc", D + "-0")), note("fc")); w.set(doc(fc, fp("fc", D + "-1")), note("fc")); return w.commit(); })()));
  await check("feedback: a batch reaching a 4th slot denied", assertFails((() => { const w = writeBatch(fc); w.set(doc(fc, fp("fc", D + "-2")), note("fc")); w.set(doc(fc, fp("fc", D + "-3")), note("fc")); return w.commit(); })()));
  await check("feedback: no seat today denied", assertFails(put(gus, "gus", D + "-0", note("gus"))));
  await check("feedback: gus claims a block", assertSucceeds(claim(gus, "gus")));
  await check("feedback: seated, the same note accepted", assertSucceeds(put(gus, "gus", D + "-0", note("gus"))));
  const stored = await (async () => { let v = null; await env.withSecurityRulesDisabled(async (c) => { const s = await getDoc(doc(c.firestore(), fp("fa", D + "-1"))); v = s.data(); }); return v; })();
  await check("feedback: the project owner (Admin access) reads the stored note", stored && stored.msg.length === 1000 && stored.info.ua === "Firefox" && stored.at && typeof stored.at.toMillis === "function" ? Promise.resolve() : Promise.reject(new Error(JSON.stringify(stored))));
}

async function usernames(env, anon) {
  const db = (u) => env.authenticatedContext(u).firestore();
  const ua = db("una"), ub = db("unb"), uc = db("unc"), ud = db("und"), ue = db("une");
  const seed = (p, d) => env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), p), d));
  const read = (p) => { let v = null; return env.withSecurityRulesDisabled(async (c) => { const s = await getDoc(doc(c.firestore(), p)); v = s.exists() ? s.data() : null; }).then(() => v); };
  const fact = (name, c, extra) => check(name, c ? Promise.resolve() : Promise.reject(new Error(JSON.stringify(extra === undefined ? null : extra))));
  /** One batch: pub/<uid> with the given un/ut, plus names creates and deletes. */
  const move = (d, uid, o) => {
    const w = writeBatch(d), q = qNext("pub/" + uid), body = { x: X, y: Y, at: Date.now(), q };
    if (o.un !== undefined) body.un = o.un;
    if (o.ut !== undefined) body.ut = o.ut;
    if (o.n) body.n = o.n;
    if (o.pub !== false) w.set(doc(d, "pub/" + uid), Object.assign(body, o.extra || {}));
    (o.add || []).forEach((a) => w.set(doc(d, "names/" + (a.key || a.n.toLowerCase())), a.doc || { u: a.u || uid, n: a.n }));
    (o.del || []).forEach((k) => w.delete(doc(d, "names/" + k)));
    return w.commit().then(() => { if (o.pub !== false) Q["pub/" + uid] = q.n; });
  };
  const stamp = serverTimestamp;
  const utOf = async (uid) => (await read("pub/" + uid)).ut;
  const backdate = async (uid, ms) => { const d = await read("pub/" + uid); d.ut = Timestamp.fromMillis(Date.now() - ms); await seed("pub/" + uid, d); };
  const WEEK = 7 * DAYMS;

  for (const [d, u] of [[ua, "una"], [ub, "unb"], [uc, "unc"], [ud, "und"]]) {
    await check("names: " + u + " claims a block", assertSucceeds(claim(d, u)));
    await check("names: " + u + " publishes a pub doc without a username", assertSucceeds(put(d, "pub/" + u, { x: X, y: Y, at: 1, n: "Google Name" })));
  }

  await check("names: first claim (pub un + names doc in one batch) accepted", assertSucceeds(move(ua, "una", { un: "Alice_1", ut: stamp(), add: [{ n: "Alice_1" }] })));
  const n1 = await read("names/alice_1"), p1 = await read("pub/una");
  await fact("names: names/alice_1 is { u, n } with the display case kept", n1 && n1.u === "una" && n1.n === "Alice_1" && Object.keys(n1).sort().join() === "n,u", n1);
  await fact("names: pub carries un and a server-time ut", p1.un === "Alice_1" && p1.ut && typeof p1.ut.toMillis === "function" && Math.abs(p1.ut.toMillis() - Date.now()) < 120000, p1);
  await check("names: a pub rewrite keeping un and ut accepted", assertSucceeds(move(ua, "una", { un: "Alice_1", ut: p1.ut, extra: { s: true } })));
  await check("names: a pub rewrite dropping un without releasing the name denied", assertFails(move(ua, "una", { ut: p1.ut })));
  await check("names: a pub rewrite dropping ut denied", assertFails(move(ua, "una", { un: "Alice_1" })));
  await check("names: a pub rewrite moving ut alone denied", assertFails(move(ua, "una", { un: "Alice_1", ut: stamp() })));
  await check("names: a pub rewrite with a forged older ut denied", assertFails(move(ua, "una", { un: "Alice_1", ut: Timestamp.fromMillis(Date.now() - 30 * DAYMS) })));
  await check("names: a partial pub update of un denied", assertFails(updateDoc(doc(ua, "pub/una"), { un: "Alice_9", q: qNext("pub/una") })));
  await check("names: owner deleting a pub doc that holds a username denied", assertFails(deleteDoc(doc(ua, "pub/una"))));

  await check("names: signed-in user gets a names doc", assertSucceeds(getDoc(doc(ub, "names/alice_1"))));
  await check("names: signed-in user gets a missing names doc (availability)", assertSucceeds(getDoc(doc(ub, "names/nobody_here"))));
  await check("names: signed out can't get", assertFails(getDoc(doc(anon, "names/alice_1"))));
  await check("names: listing denied", assertFails(getDocs(collection(ub, "names"))));
  await check("names: owner listing denied", assertFails(getDocs(collection(ua, "names"))));
  await check("names: query by owner denied", assertFails(getDocs(query(collection(ua, "names"), where("u", "==", "una")))));

  await check("names: same name in other capitals (case-insensitive collision) denied", assertFails(move(ub, "unb", { un: "ALICE_1", ut: stamp(), add: [{ n: "ALICE_1" }] })));
  await check("names: taking someone else's names doc denied", assertFails(move(ub, "unb", { un: "Alice_1", ut: stamp(), add: [{ n: "Alice_1" }] })));
  await check("names: pointing pub at someone else's name denied", assertFails(move(ub, "unb", { un: "Alice_1", ut: stamp() })));
  await check("names: pointing pub at a name nobody holds denied", assertFails(move(ub, "unb", { un: "Ghost", ut: stamp() })));
  await check("names: deleting someone else's name denied", assertFails(deleteDoc(doc(ub, "names/alice_1"))));
  await check("names: deleting someone else's name inside a claim denied", assertFails(move(ub, "unb", { un: "Bobby", ut: stamp(), add: [{ n: "Bobby" }], del: ["alice_1"] })));
  await check("names: holding two names in one batch denied", assertFails(move(ub, "unb", { un: "Bobby", ut: stamp(), add: [{ n: "Bobby" }, { n: "Bobby2" }] })));
  await check("names: a names doc without pub pointing at it denied", assertFails(move(ub, "unb", { pub: false, add: [{ n: "Bobby" }] })));
  await check("names: a names doc naming another user denied", assertFails(move(ub, "unb", { un: "Bobby", ut: stamp(), add: [{ n: "Bobby", u: "una" }] })));
  await check("names: key that isn't the lowercase of n denied", assertFails(move(ub, "unb", { un: "Bobby", ut: stamp(), add: [{ key: "bobbx", n: "Bobby" }] })));
  await check("names: key in capitals denied", assertFails(move(ub, "unb", { un: "Bobby", ut: stamp(), add: [{ key: "Bobby", n: "Bobby" }] })));
  await check("names: names doc with an extra key denied", assertFails(move(ub, "unb", { un: "Bobby", ut: stamp(), add: [{ n: "Bobby", doc: { u: "unb", n: "Bobby", at: 1 } }] })));
  await check("names: names doc without n denied", assertFails(move(ub, "unb", { un: "Bobby", ut: stamp(), add: [{ n: "Bobby", doc: { u: "unb" } }] })));
  await check("names: claim with a client clock ut denied", assertFails(move(ub, "unb", { un: "Bobby", ut: Timestamp.now(), add: [{ n: "Bobby" }] })));
  await check("names: claim without ut denied", assertFails(move(ub, "unb", { un: "Bobby", add: [{ n: "Bobby" }] })));
  for (const bad of ["bo", "a".repeat(21), "bob smith", "\u0430dmin", "b\u043Eb", "bob\u200B", "\u202Ebob", "bob_", "b__b", "1bob", "_bob", "<b>x</b>", "x\"><img>"]) {
    await check("names: invalid " + JSON.stringify(bad) + " in pub and names denied", assertFails(move(ub, "unb", { un: bad, ut: stamp(), add: [{ n: bad, key: bad.toLowerCase().replace(/\//g, "_") }] })));
  }
  await check("names: a username that isn't a string denied", assertFails(move(ub, "unb", { un: 42, ut: stamp() })));
  for (const bad of ["Admin", "GARDENER", "orbitorchard", "Claude", "Firebase", "Moderator", "xFuckx", "Nazi_1"]) {
    await check("names: refused name " + bad + " denied", assertFails(move(ub, "unb", { un: bad, ut: stamp(), add: [{ n: bad }] })));
  }

  await check("names: unb claims Bobby", assertSucceeds(move(ub, "unb", { un: "Bobby", ut: stamp(), add: [{ n: "Bobby" }] })));
  await check("names: updating a names doc (set over it) denied", assertFails(setDoc(doc(ub, "names/bobby"), { u: "unb", n: "BOBBY" })));
  await check("names: partial update of a names doc denied", assertFails(updateDoc(doc(ub, "names/bobby"), { n: "BOBBY" })));
  await check("names: someone else updating a names doc denied", assertFails(setDoc(doc(ua, "names/bobby"), { u: "una", n: "Bobby" })));
  await check("names: deleting your own name while pub still points at it denied", assertFails(deleteDoc(doc(ub, "names/bobby"))));
  await check("names: a second name while keeping the first denied", assertFails(move(ub, "unb", { un: "Bobby", ut: await utOf("unb"), add: [{ n: "Robert" }] })));

  await check("names: signed out can't create a names doc", assertFails(setDoc(doc(anon, "names/sneaky"), { u: "anon", n: "Sneaky" })));
  await check("names: signed out can't delete a names doc", assertFails(deleteDoc(doc(anon, "names/bobby"))));
  await check("names: signed out can't write pub", assertFails(setDoc(doc(anon, "pub/unb"), { x: X, y: Y, at: 1, un: "Bobby", q: qNext("pub/unb") })));

  await check("week: a second change within 7 days denied", assertFails(move(ua, "una", { un: "Alice_2", ut: stamp(), add: [{ n: "Alice_2" }], del: ["alice_1"] })));
  await check("week: removal within 7 days denied", assertFails(move(ua, "una", { ut: stamp(), del: ["alice_1"] })));
  await check("week: a capitals-only change within 7 days denied", assertFails(move(ua, "una", { un: "ALICE_1", ut: stamp() })));
  await backdate("una", WEEK - 3600000);
  await check("week: 6 days 23 hours later still denied", assertFails(move(ua, "una", { un: "Alice_2", ut: stamp(), add: [{ n: "Alice_2" }], del: ["alice_1"] })));
  await backdate("una", WEEK + 60000);
  await check("week: a change without releasing the old name denied", assertFails(move(ua, "una", { un: "Alice_2", ut: stamp(), add: [{ n: "Alice_2" }] })));
  await check("week: a change keeping ut denied", assertFails(move(ua, "una", { un: "Alice_2", ut: await utOf("una"), add: [{ n: "Alice_2" }], del: ["alice_1"] })));
  await check("week: 7 days later a change (new name, old released, one batch) accepted", assertSucceeds(move(ua, "una", { un: "Alice_2", ut: stamp(), add: [{ n: "Alice_2" }], del: ["alice_1"] })));
  await fact("week: the old names doc is gone and the new one is una's", !(await read("names/alice_1")) && (await read("names/alice_2")).u === "una", [await read("names/alice_1"), await read("names/alice_2")]);
  await check("week: the released name is free for unc", assertSucceeds(move(uc, "unc", { un: "alice_1", ut: stamp(), add: [{ n: "alice_1" }] })));
  await fact("week: names/alice_1 now belongs to unc", (await read("names/alice_1")).u === "unc", await read("names/alice_1"));
  await check("week: right after the change another one denied", assertFails(move(ua, "una", { un: "ALICE_2", ut: stamp() })));
  await backdate("una", WEEK + 60000);
  await check("week: a capitals-only change (pub only, names doc kept) accepted", assertSucceeds(move(ua, "una", { un: "ALICE_2", ut: stamp() })));
  await fact("week: the names doc keeps its key and owner", (await read("names/alice_2")).u === "una" && (await read("pub/una")).un === "ALICE_2", [await read("names/alice_2"), await read("pub/una")]);
  await backdate("una", WEEK + 60000);
  await check("week: removal deleting the names doc while pub still points at it denied", assertFails(move(ua, "una", { un: "ALICE_2", ut: await utOf("una"), del: ["alice_2"] })));
  await check("week: removal (pub without un, new ut, names doc deleted) accepted", assertSucceeds(move(ua, "una", { ut: stamp(), del: ["alice_2"] })));
  const p2 = await read("pub/una");
  await fact("week: after removal pub has ut but no un, and the names doc is gone", !("un" in p2) && p2.ut && !(await read("names/alice_2")), p2);
  await check("week: a new claim right after removal denied", assertFails(move(ua, "una", { un: "Alice_3", ut: stamp(), add: [{ n: "Alice_3" }] })));
  await check("week: a pub rewrite keeping ut without un accepted", assertSucceeds(move(ua, "una", { ut: p2.ut, n: "Google Name" })));
  await check("week: deleting a pub doc that holds ut denied", assertFails(deleteDoc(doc(ua, "pub/una"))));
  await backdate("una", WEEK + 60000);
  await check("week: a claim a week after removal accepted", assertSucceeds(move(ua, "una", { un: "Alice_3", ut: stamp(), add: [{ n: "Alice_3" }] })));
  await check("names: a pub doc that never had a username can still be deleted", assertSucceeds(deleteDoc(doc(ud, "pub/und"))));
  delete Q["pub/und"];

  await seed("pub/une", { x: X, y: Y, at: 1 });
  await check("names: a claim without today's seat denied", assertFails(move(ue, "une", { un: "Unseated", ut: stamp(), add: [{ n: "Unseated" }] })));
}

(async () => {
  const env = await initializeTestEnvironment({
    projectId: "demo-orbit-orchard",
    firestore: { rules: fs.readFileSync(path.join(__dirname, "../../firebase/firestore.rules"), "utf8"), host: "127.0.0.1", port: 8080 }
  });
  await env.clearFirestore();
  const alice = env.authenticatedContext("alice").firestore();
  const bob = env.authenticatedContext("bob").firestore();
  const anon = env.unauthenticatedContext().firestore();
  const mine = (db) => doc(db, "users/alice/data/save");
  for (const u of ["alice", "bob", "cara"]) await check("claim: " + u + " claims a block", assertSucceeds(claim(env.authenticatedContext(u).firestore(), u)));

  const SP = "users/alice/data/save";
  await check("owner creates a valid save", assertSucceeds(put(alice, SP, save())));
  await check("owner reads the save", assertSucceeds(getDoc(mine(alice))));
  await check("owner overwrites the save", assertSucceeds(put(alice, SP, Object.assign(save(), { gen: 5 }))));
  await check("owner updates one field", assertSucceeds(updateDoc(mine(alice), { at: 1, q: qNext(SP) }).then(() => { Q[SP]++; })));
  await check("another user can't read", assertFails(getDoc(mine(bob))));
  await check("another user can't write", assertFails(setDoc(mine(bob), Object.assign(save(), { q: qNext(SP) }))));
  await check("another user can't delete", assertFails(deleteDoc(mine(bob))));
  await check("signed out can't read", assertFails(getDoc(mine(anon))));
  await check("signed out can't write", assertFails(setDoc(mine(anon), Object.assign(save(), { q: qNext(SP) }))));

  const bad = (f) => { const d = save(); f(d); return d; };
  await check("missing key rejected", assertFails(put(alice, SP, bad((d) => { delete d.wallet; }))));
  await check("unknown key rejected", assertFails(put(alice, SP, bad((d) => { d.extra = 1; }))));
  await check("wrong version rejected", assertFails(put(alice, SP, bad((d) => { d.v = 3; }))));
  await check("non-map levels rejected", assertFails(put(alice, SP, bad((d) => { d.levels = "x"; }))));
  await check("list instead of map rejected", assertFails(put(alice, SP, bad((d) => { d.ach = [1, 2]; }))));
  await check("non-number gen rejected", assertFails(put(alice, SP, bad((d) => { d.gen = "0"; }))));
  await check("non-map document rejected", assertFails(put(alice, SP, { v: 2 })));
  const big = {};
  for (let i = 0; i < 15001; i++) big["login:" + i] = 10;
  await check("oversized wallet rejected", assertFails(put(alice, SP, bad((d) => { d.wallet.earn = big; }))));
  delete big["login:0"];
  await check("wallet at the cap accepted", assertSucceeds(put(alice, SP, bad((d) => { d.wallet.earn = big; }))));
  const days = {};
  for (let i = 0; i < 71; i++) days[String(20250101 + i)] = { stars: 1 };
  await check("too many daily days rejected", assertFails(put(alice, SP, bad((d) => { d.daily.days = days; }))));
  const pals = { f: 1, c: 1 };
  for (let i = 0; i < 198; i++) pals["w:" + i.toString(36) + ":abcdef" + String(i).padStart(4, "0")] = 1;
  await check("Friends trophy events at the cap accepted", assertSucceeds(put(alice, SP, bad((d) => { d.pals = pals; }))));
  await check("too many Friends trophy events rejected", assertFails(put(alice, SP, bad((d) => { d.pals = Object.assign({ p: 1 }, pals); }))));
  await check("Friends trophy events must be a map", assertFails(put(alice, SP, bad((d) => { d.pals = ["f"]; }))));

  await check("unknown private doc denied", assertFails(setDoc(doc(alice, "users/alice/data/notes"), { any: 1 })));
  await check("claude.ai path denied", assertFails(setDoc(doc(alice, "data/users/alice/save"), save())));
  await check("user root doc denied", assertFails(setDoc(doc(alice, "users/alice"), { a: 1 })));
  await check("other subcollection denied", assertFails(setDoc(doc(alice, "users/alice/friends/x"), { a: 1 })));
  await check("top-level card doc denied", assertFails(getDoc(doc(alice, "cards/alice"))));
  await check("reading another user's save denied", assertFails(getDoc(doc(alice, "users/bob/data/save"))));
  await check("owner deletes the save", assertSucceeds(drop(alice, SP)));

  await friends(env, alice, bob, anon);
  await allowance(env, alice, bob, anon);
  await feedback(env, alice, bob, anon);
  await usernames(env, anon);
  await env.cleanup();
  console.log(failN ? `RULES FAIL ${failN} of ${pass + failN}` : `RULES PASS ${pass} checks`);
  process.exit(failN ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
