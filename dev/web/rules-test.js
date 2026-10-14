const fs = require("fs");
const path = require("path");
const { initializeTestEnvironment, assertSucceeds, assertFails } = require("@firebase/rules-unit-testing");
const { doc, getDoc, getDocs, setDoc, deleteDoc, updateDoc, collection, query, where, runTransaction, writeBatch } = require("firebase/firestore");
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

  await check("unknown private doc denied", assertFails(setDoc(doc(alice, "users/alice/data/notes"), { any: 1 })));
  await check("claude.ai path denied", assertFails(setDoc(doc(alice, "data/users/alice/save"), save())));
  await check("user root doc denied", assertFails(setDoc(doc(alice, "users/alice"), { a: 1 })));
  await check("other subcollection denied", assertFails(setDoc(doc(alice, "users/alice/friends/x"), { a: 1 })));
  await check("top-level card doc denied", assertFails(getDoc(doc(alice, "cards/alice"))));
  await check("reading another user's save denied", assertFails(getDoc(doc(alice, "users/bob/data/save"))));
  await check("owner deletes the save", assertSucceeds(drop(alice, SP)));

  await friends(env, alice, bob, anon);
  await allowance(env, alice, bob, anon);
  await env.cleanup();
  console.log(failN ? `RULES FAIL ${failN} of ${pass + failN}` : `RULES PASS ${pass} checks`);
  process.exit(failN ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
