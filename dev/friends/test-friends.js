const assert = require("assert");
const F = require("../../js/friends.js");
const R = require("./rules.js");

let n = 0;
const t = (name, fn) => { fn(); n++; console.log("ok " + name); };
const DAY = 864e5, NOW = 1790000000000;
const canon = F.canon;

t("friend merge is a commutative, idempotent keyed union", () => {
  const a = { f: { u_b: { at: 10 }, u_c: { at: 20 } }, share: { on: true, at: 5 } };
  const b = { f: { u_c: { at: 30, del: 1 }, u_d: { at: 15, code: "BQ7K2M" } }, share: { on: false, at: 7 } };
  const ab = F.mergeFriends(a, b), ba = F.mergeFriends(b, a);
  assert.strictEqual(canon(ab), canon(ba));
  assert.strictEqual(canon(F.mergeFriends(ab, ab)), canon(ab));
  assert.deepStrictEqual(F.friendIds(ab).sort(), ["u_b", "u_d"]);
  assert.strictEqual(ab.f.u_c.del, 1);
  assert.strictEqual(ab.share.on, false);
  assert.strictEqual(ab.f.u_d.code, "BQ7K2M");
});

t("re-adding after a delete wins by timestamp; equal timestamps keep the tombstone", () => {
  const del = { f: { u_b: { at: 50, del: 1 } } };
  assert.deepStrictEqual(F.friendIds(F.mergeFriends(del, { f: { u_b: { at: 60 } } })), ["u_b"]);
  assert.deepStrictEqual(F.friendIds(F.mergeFriends(del, { f: { u_b: { at: 50 } } })), []);
  assert.deepStrictEqual(F.friendIds(F.mergeFriends({ f: { u_b: { at: 50 } } }, del)), []);
});

t("three-way merge order does not matter", () => {
  const docs = [{ f: { u_a: { at: 1 }, u_b: { at: 9, del: 1 } }, code: { c: "AK5MZ7", at: 3 } }, { f: { u_b: { at: 5 } }, code: { c: "BQ7K2M", at: 4 } }, { f: { u_a: { at: 2, del: 1 }, u_c: { at: 1 } }, share: { on: true, nectar: true, at: 9 } }];
  const x = F.mergeFriends(F.mergeFriends(docs[0], docs[1]), docs[2]), y = F.mergeFriends(docs[2], F.mergeFriends(docs[1], docs[0]));
  assert.strictEqual(canon(x), canon(y));
  assert.deepStrictEqual(F.friendIds(x), ["u_c"]);
  assert.strictEqual(x.code.c, "BQ7K2M");
});

t("friend docs drop junk and old tombstones", () => {
  const c = F.cleanFriends({ f: { "bad/id": { at: 1 }, u_x: { at: -1 }, u_y: "x", u_z: { at: 4, code: "lower" } }, code: { c: "AL5MZ7", at: 3 } });
  assert.deepStrictEqual(Object.keys(c.f), ["u_z"]);
  assert.strictEqual(c.f.u_z.code, undefined);
  assert.strictEqual(c.code, null);
  const p = F.pruneFriends({ f: { u_a: { at: NOW - 200 * DAY, del: 1 }, u_b: { at: NOW - DAY, del: 1 }, u_c: { at: NOW - 400 * DAY } } }, NOW);
  assert.deepStrictEqual(Object.keys(p.f).sort(), ["u_b", "u_c"]);
});

t("friend codes parse loosely and reject ambiguous letters", () => {
  assert.strictEqual(F.parseCode(" bq7-k2m "), "BQ7K2M");
  assert.strictEqual(F.parseCode("BQ7K2"), null);
  assert.strictEqual(F.parseCode("IL0O12"), null);
  for (let i = 0; i < 200; i++) assert.ok(F.codeOk(F.newCode()));
  assert.strictEqual(F.fmtCode("BQ7K2M"), "BQ7-K2M");
});

t("cards are built clamped and validated against the owner id", () => {
  const card = F.buildCard({ stars: 120.7, cleared: 40, worlds: 1, golden: 3, streak: 4, best: 9, trophies: 7, tiers: { bronze: 3, gold: 1 }, ws: [60, 50, 10.2], wc: [22, 15, 3], nectar: 999 }, "u_a", "20261012", false);
  assert.strictEqual(card.stars, 120);
  assert.strictEqual(card.nectar, undefined);
  assert.strictEqual(F.buildCard({ nectar: 5 }, "u_a", "20261012", true).nectar, 5);
  const c = F.cleanCard("u_a", card);
  assert.strictEqual(c.stars, 120);
  assert.deepStrictEqual(c.ws, [60, 50, 10]);
  assert.strictEqual(c.nectar, null);
  assert.strictEqual(F.cleanCard("u_b", card), null);
  assert.strictEqual(F.cleanCard("u_a", Object.assign({}, card, { stars: "lots" })), null);
  const odd = F.cleanCard("u_a", Object.assign({}, card, { streak: 1e9, golden: -2, ws: "x", day: "<b>", tiers: { gold: 1.5 } }));
  assert.strictEqual(odd.streak, 0);
  assert.strictEqual(odd.golden, 0);
  assert.deepStrictEqual(odd.ws, []);
  assert.strictEqual(odd.day, null);
  assert.strictEqual(odd.tiers.gold, 0);
});

const X43 = "A".repeat(42) + "Q", Y43 = "B".repeat(42) + "g", T16 = "abcdefghij_-0123", IV16 = "AAAAAAAAAAAAAAAA";

t("public keys must belong to the doc id and look like P-256 coordinates", () => {
  assert.deepStrictEqual(F.cleanPub("u_a", { u: "u_a", x: X43, y: Y43, at: 1 }), { x: X43, y: Y43 });
  assert.strictEqual(F.cleanPub("u_b", { u: "u_a", x: X43, y: Y43 }), null);
  assert.strictEqual(F.cleanPub("u_a", { u: "u_a", x: X43.slice(1), y: Y43 }), null);
  assert.strictEqual(F.cleanPub("u_a", { u: "u_a", x: X43.slice(1) + "=", y: Y43 }), null);
  assert.strictEqual(F.cleanPub("u_a", null), null);
});

t("private key docs need a full P-256 JWK", () => {
  const jwk = { kty: "EC", crv: "P-256", x: X43, y: Y43, d: X43 };
  assert.deepStrictEqual(F.cleanPriv({ v: 1, jwk }), { x: X43, y: Y43, d: X43 });
  assert.strictEqual(F.cleanPriv({ v: 1, jwk: Object.assign({}, jwk, { crv: "P-384" }) }), null);
  assert.strictEqual(F.cleanPriv({ v: 1, jwk: Object.assign({}, jwk, { d: undefined }) }), null);
  assert.strictEqual(F.cleanPriv({}), null);
});

t("v2 card envelopes are validated; v1, foreign and plaintext cards count as not shared", () => {
  const good = { v: 2, u: "u_a", at: NOW, w: { [T16]: { iv: IV16, ct: "abc_-9" } } };
  assert.deepStrictEqual(F.cleanSealed("u_a", good), { at: NOW, w: { [T16]: { iv: IV16, ct: "abc_-9" } } });
  assert.strictEqual(F.cleanSealed("u_b", good), null);
  assert.strictEqual(F.cleanSealed("u_a", { v: 1, u: "u_a", day: "20261012", stars: 50, cleared: 10 }), null);
  assert.strictEqual(F.cleanSealed("u_a", { v: 2, u: "u_a", stars: 50 }), null);
  const junk = F.cleanSealed("u_a", { v: 2, u: "u_a", at: NOW, w: { short: { iv: IV16, ct: "x" }, [T16]: { iv: "bad", ct: "x" }, ["k" + T16.slice(1)]: { iv: IV16, ct: "has space" }, ["z" + T16.slice(1)]: { iv: IV16, ct: "ok" } } });
  assert.deepStrictEqual(Object.keys(junk.w), ["z" + T16.slice(1)]);
  assert.ok(Object.keys(good).every((k) => ["v", "u", "at", "w"].indexOf(k) >= 0));
});

t("card recipients are followed players with a published key, capped and sorted", () => {
  const f = {};
  for (let i = 0; i < 70; i++) f["u_" + String(i).padStart(2, "0")] = { at: 1000 + i };
  f.u_gone = { at: 5000, del: 1 };
  const pubs = { u_gone: { x: X43, y: Y43 }, u_stranger: { x: X43, y: Y43 }, u_65: { x: "bad", y: Y43 } };
  for (let i = 0; i < 70; i++) if (i !== 65) pubs["u_" + String(i).padStart(2, "0")] = { x: X43, y: Y43 };
  const r = F.cardRecips(F.cleanFriends({ f }), pubs);
  assert.strictEqual(r.length, 59);
  assert.ok(r.indexOf("u_gone") < 0 && r.indexOf("u_stranger") < 0 && r.indexOf("u_65") < 0 && r.indexOf("u_69") >= 0 && r.indexOf("u_09") < 0);
  assert.deepStrictEqual(r, r.slice().sort());
});

t("the recipient signature changes with follows, their keys and my key", () => {
  const mine = { x: X43, y: Y43 }, pubs = { u_a: { x: X43, y: Y43 }, u_b: { x: Y43, y: X43 } };
  const base = F.recipSig(mine, ["u_a", "u_b"], pubs);
  assert.notStrictEqual(F.recipSig(mine, ["u_a"], pubs), base);
  assert.notStrictEqual(F.recipSig(mine, ["u_a", "u_b"], { u_a: pubs.u_a, u_b: { x: X43, y: X43 } }), base);
  assert.notStrictEqual(F.recipSig({ x: Y43, y: Y43 }, ["u_a", "u_b"], pubs), base);
  assert.strictEqual(F.recipSig(mine, ["u_a", "u_b"], JSON.parse(JSON.stringify(pubs))), base);
  assert.notStrictEqual(F.aadOf("u_a", "u_b"), F.aadOf("u_b", "u_a"));
});

const res = (used, pollen, time, at, extra) => Object.assign({ used, stars: 3, pollen, pt: 2, time, at: at || NOW }, extra || {});

t("results are validated", () => {
  assert.ok(F.cleanResult(res(3, 1, 40)));
  assert.strictEqual(F.cleanResult(res(-1, 0, 4)), null);
  assert.strictEqual(F.cleanResult(res(3, 0, "4")), null);
  assert.strictEqual(F.cleanResult(Object.assign(res(3, 0, 4), { stars: 4 })), null);
  assert.strictEqual(F.cleanResult(res(3, 1, 40, NOW, { assist: "yes" })).assist, true);
});

t("winner: fewer seeds, then more pollen, then less time", () => {
  assert.ok(F.cmpResult(res(3, 0, 90), res(4, 2, 10)) < 0);
  assert.ok(F.cmpResult(res(4, 1, 90), res(4, 2, 99)) > 0);
  assert.ok(F.cmpResult(res(4, 2, 50), res(4, 2, 60)) < 0);
  assert.strictEqual(F.cmpResult(res(4, 2, 50), res(4, 2, 50)), 0);
});

const chal = (o) => Object.assign({ cid: "abcdef1234", from: "u_a", to: "u_b", seed: 123456, diff: 3, at: NOW - DAY, exp: NOW + 6 * DAY, sr: null, rr: null }, o || {});
const rr = (r, o) => Object.assign({ by: "u_a", cid: "abcdef1234", seed: 123456, diff: 3, at: NOW, r }, o || {});

t("verdict covers open, done, walkover, declined, expired and void", () => {
  assert.strictEqual(F.verdict(chal(), NOW).state, "open");
  assert.strictEqual(F.verdict(chal({ sr: res(3, 0, 9) }), NOW).state, "open");
  const d = F.verdict(chal({ sr: res(4, 0, 9), rr: rr(res(3, 0, 50)) }), NOW);
  assert.strictEqual(d.state, "done");
  assert.strictEqual(d.win, "r");
  assert.strictEqual(F.verdict(chal({ sr: res(3, 1, 9), rr: rr(res(3, 1, 9)) }), NOW).win, "draw");
  assert.strictEqual(F.verdict(chal({ rr: rr(null, { no: 1 }) }), NOW).state, "declined");
  assert.strictEqual(F.verdict(chal({ exp: NOW - 1 }), NOW).state, "expired");
  const w = F.verdict(chal({ exp: NOW - 1, sr: res(5, 0, 9, NOW - DAY) }), NOW);
  assert.strictEqual(w.state, "walkover");
  assert.strictEqual(w.win, "s");
  assert.strictEqual(F.verdict(chal({ rr: rr(res(3, 0, 9), { seed: 999 }) }), NOW).state, "void");
  assert.strictEqual(F.verdict(chal({ exp: NOW - 2 * DAY, rr: rr(res(3, 0, 9), { at: NOW }) }), NOW).state, "expired");
});

t("challenge docs drop forged and malformed entries", () => {
  const d = F.cleanChal({ out: {
    good123456: { to: "u_b", seed: 5, diff: 2, at: NOW, exp: NOW + 7 * DAY },
    longexpiry1: { to: "u_b", seed: 5, diff: 2, at: NOW, exp: NOW + 30 * DAY },
    baddiff123: { to: "u_b", seed: 5, diff: 9, at: NOW, exp: NOW + DAY },
    "BAD ID": { to: "u_b", seed: 5, diff: 2, at: NOW, exp: NOW + DAY }
  }, res: {
    "u_a~good123456": { by: "u_a", cid: "good123456", seed: 5, diff: 2, at: NOW, r: res(3, 0, 4) },
    "u_x~good123456": { by: "u_a", cid: "good123456", seed: 5, diff: 2, at: NOW, r: res(3, 0, 4) },
    "u_a~nores12345": { by: "u_a", cid: "nores12345", seed: 5, diff: 2, at: NOW }
  } });
  assert.deepStrictEqual(Object.keys(d.out), ["good123456"]);
  assert.deepStrictEqual(Object.keys(d.res), ["u_a~good123456"]);
});

t("challenge merge keeps the first result and is order independent", () => {
  const base = { to: "u_b", seed: 5, diff: 2, at: NOW, exp: NOW + 7 * DAY };
  const a = { out: { c111111111: Object.assign({}, base, { r: res(3, 0, 9, NOW + 10) }) }, res: { "u_x~c222222222": rr(res(4, 0, 9), { by: "u_x", cid: "c222222222", at: NOW + 5 }) } };
  const b = { out: { c111111111: Object.assign({}, base, { r: res(2, 0, 9, NOW + 20) }), c333333333: base }, res: { "u_x~c222222222": rr(null, { by: "u_x", cid: "c222222222", at: NOW + 9, no: 1 }) } };
  const m = F.mergeChal(a, b);
  assert.strictEqual(canon(m), canon(F.mergeChal(b, a)));
  assert.strictEqual(m.out.c111111111.r.used, 3);
  assert.strictEqual(m.res["u_x~c222222222"].no, undefined);
  assert.deepStrictEqual(Object.keys(m.out).sort(), ["c111111111", "c333333333"]);
});

t("finishChal prunes old entries, caps size and builds query indexes", () => {
  const out = {}, rs = {};
  for (let i = 0; i < 40; i++) out["c" + String(i).padStart(9, "0")] = { to: i % 2 ? "u_b" : "u_c", seed: i, diff: 1, at: NOW - i * 3600000, exp: NOW - i * 3600000 + DAY };
  out.oldoldold1 = { to: "u_z", seed: 1, diff: 1, at: NOW - 30 * DAY, exp: NOW - 29 * DAY };
  rs["u_q~r000000001"] = rr(res(1, 0, 1), { by: "u_q", cid: "r000000001" });
  rs["u_old~r000000002"] = rr(res(1, 0, 1), { by: "u_old", cid: "r000000002", at: NOW - 40 * DAY });
  const f = F.finishChal({ out, res: rs }, NOW);
  assert.strictEqual(Object.keys(f.out).length, 30);
  assert.ok(!f.out.oldoldold1 && f.out.c000000000 && !f.out.c000000039);
  assert.deepStrictEqual(f.to, ["u_b", "u_c"]);
  assert.deepStrictEqual(f.from, ["u_q"]);
});

t("incoming lists only challenges to me, joined with my answers; open count", () => {
  const docs = { u_a: { out: {
    c111111111: { to: "u_me", seed: 1, diff: 1, at: NOW - 10, exp: NOW + DAY },
    c222222222: { to: "u_other", seed: 1, diff: 1, at: NOW - 10, exp: NOW + DAY }
  } }, u_me: { out: { c333333333: { to: "u_me", seed: 1, diff: 1, at: NOW, exp: NOW + DAY } } } };
  const mine = F.cleanChal({ res: { "u_a~c111111111": rr(res(2, 0, 3), { by: "u_a", cid: "c111111111", seed: 1, diff: 1 }) } });
  const inc = F.incomingOf(docs, mine, "u_me");
  assert.strictEqual(inc.length, 1);
  assert.strictEqual(inc[0].rr.r.used, 2);
  const outs = F.outgoingOf(F.cleanChal({ out: { c444444444: { to: "u_a", seed: 1, diff: 1, at: NOW, exp: NOW + DAY }, c555555555: { to: "u_a", seed: 1, diff: 1, at: NOW - 9 * DAY, exp: NOW - 2 * DAY } } }), {}, "u_me");
  assert.strictEqual(F.openCount(outs, NOW), 1);
});

t("trophy events need another gardener, an opened card and a played win", () => {
  const me = "u_me", h = F.palHash, card = (id) => ({ st: "ok", c: { u: id } });
  const fr = F.cleanFriends({ f: { u_me: { at: 1 }, u_b: { at: 2 }, u_c: { at: 3 }, u_d: { at: 4, del: 1 } } });
  const ch = (o) => chal(Object.assign({ from: "u_b", to: me }, o));
  const mineR = (o) => rr(res(2, 0, 9), Object.assign({ by: "u_b" }, o));
  const keys = (o) => F.palKeys(Object.assign({ me, fr, cards: {}, mine: F.cleanChal({}), inc: [], out: [], now: NOW }, o)).sort();
  assert.deepStrictEqual(F.palKeys({ me, fr: F.cleanFriends({ f: { u_me: { at: 1 } } }), cards: { u_me: card(me) }, mine: F.cleanChal({ out: { selfchal01: { to: me, seed: 1, diff: 1, at: NOW, exp: NOW + DAY } } }), inc: [ch({ from: me, cid: "selfchal02", sr: res(5, 0, 9), rr: mineR({ by: me, cid: "selfchal02" }) })], out: [], now: NOW }), [], "my own account is never a friend, card or rival");
  assert.deepStrictEqual(keys({}), ["f"]);
  assert.deepStrictEqual(keys({ cards: { u_b: card("u_b"), u_c: { st: "locked" }, u_d: card("u_d"), u_x: card("u_x") } }), ["f", "m:" + h("u_b")], "only open cards of followed players count");
  assert.deepStrictEqual(keys({ cards: { u_b: { st: "ok", c: { u: "u_c" } } } }), ["f"], "a card must belong to its row");
  assert.deepStrictEqual(keys({ mine: F.cleanChal({ out: { sent123456: { to: "u_b", seed: 1, diff: 1, at: NOW, exp: NOW + DAY } } }) }), ["c", "f"]);
  const won = ch({ sr: res(5, 0, 9), rr: mineR() }), lost = ch({ cid: "lost123456", sr: res(1, 0, 9), rr: mineR({ cid: "lost123456" }) });
  assert.deepStrictEqual(keys({ inc: [won, lost] }), ["f", "p", "w:" + h("u_b") + ":abcdef1234"], "a played answer counts once and only the win scores");
  const walk = ch({ cid: "walk123456", exp: NOW - 1, rr: mineR({ cid: "walk123456", at: NOW - DAY }) });
  const voided = ch({ cid: "void123456", sr: res(5, 0, 9), rr: mineR({ cid: "void123456", seed: 999 }) });
  const draw = ch({ cid: "draw123456", sr: res(2, 0, 9), rr: mineR({ cid: "draw123456" }) });
  const declined = ch({ cid: "decl123456", sr: res(5, 0, 9), rr: rr(null, { by: "u_b", cid: "decl123456", no: 1 }) });
  assert.deepStrictEqual(keys({ inc: [walk, voided, draw, declined] }), ["f", "p"], "walkovers, void answers, draws and declines are not wins");
  const outWin = chal({ cid: "outw123456", from: me, to: "u_c", sr: res(2, 0, 9), rr: rr(res(4, 0, 9), { by: me, cid: "outw123456" }) });
  const outWalk = chal({ cid: "outk123456", from: me, to: "u_c", exp: NOW - 1, sr: res(2, 0, 9, NOW - DAY) });
  assert.deepStrictEqual(keys({ out: [outWin, outWalk] }), ["f", "w:" + h("u_c") + ":outw123456"], "my sent challenge scores only when they answered and lost");
  assert.ok(/^[0-9a-z]{1,7}$/.test(h("u_b")) && h("u_b") === h("u_b") && h("u_b") !== h("u_c"));
});

t("challenge wire docs: v2 only, opaque entries, no plaintext fields kept", () => {
  const ent = { t: T16, iv: IV16, ct: "Zm9v_-", k: NOW };
  const d = { v: 2, u: "u_a", at: NOW, to: ["u_b"], from: ["u_c"], out: { abcdef1234: ent, "BAD ID": ent, c222222222: { t: T16, iv: IV16, ct: "x", k: 0 } }, res: { [T16]: ent, short: ent } };
  const w = F.cleanWire("u_a", d);
  assert.deepStrictEqual(Object.keys(w).sort(), ["at", "out", "res"]);
  assert.deepStrictEqual(Object.keys(w.out), ["abcdef1234"]);
  assert.deepStrictEqual(Object.keys(w.res), [T16]);
  assert.deepStrictEqual(w.out.abcdef1234, ent);
  assert.strictEqual(F.cleanWire("u_b", d), null);
  assert.strictEqual(F.cleanWire("u_a", { v: 1, to: ["u_b"], out: {}, res: {} }), null);
  assert.strictEqual(F.cleanWire("u_a", Object.assign({}, d, { out: { abcdef1234: Object.assign({}, ent, { seed: 5 }) } })).out.abcdef1234.seed, undefined);
});

t("challenge additional data binds kind, direction and entry id; prune time is coarse", () => {
  const all = [F.chalAad("out", "u_a", "u_b", "c1"), F.chalAad("out", "u_b", "u_a", "c1"), F.chalAad("res", "u_a", "u_b", "c1"), F.chalAad("out", "u_a", "u_b", "c2"), F.aadOf("u_a", "u_b")];
  assert.strictEqual(all.filter((x, i) => all.indexOf(x) === i).length, 5);
  const k = F.pruneAt(NOW + 1234);
  assert.ok(k >= NOW + 1234 + F.KEEP && k - (NOW + 1234 + F.KEEP) < 3600000 && k % 3600000 === 0);
  assert.strictEqual(F.pruneAt(NOW + 1), F.pruneAt(NOW + 2));
});

t("chalTargets seals each out entry for its recipient and each answer for its challenger", () => {
  const M = { out: { c111111111: { to: "u_b", seed: 1, diff: 1, at: NOW, exp: NOW + DAY }, c222222222: { to: "u_me", seed: 1, diff: 1, at: NOW, exp: NOW + DAY } },
    res: { "u_c~c333333333": rr(null, { by: "u_c", cid: "c333333333", no: 1 }) } };
  const t2 = F.chalTargets(M, "u_me");
  assert.deepStrictEqual(t2.map((x) => [x.kind, x.key, x.peer]), [["out", "c111111111", "u_b"], ["res", "u_c~c333333333", "u_c"]]);
  assert.deepStrictEqual(Object.keys(t2[0].e).sort(), ["at", "diff", "exp", "seed", "to"]);
});

t("decrypted entries count only when well formed and addressed to me", () => {
  const out = { to: "u_me", seed: 9, diff: 2, at: NOW, exp: NOW + DAY };
  assert.deepStrictEqual(F.chalEntry("out", "c111111111", out, "u_me"), ["c111111111", out]);
  assert.strictEqual(F.chalEntry("out", "c111111111", Object.assign({}, out, { to: "u_x" }), "u_me"), null);
  assert.strictEqual(F.chalEntry("out", "c111111111", Object.assign({}, out, { diff: 7 }), "u_me"), null);
  assert.strictEqual(F.chalEntry("out", "c111111111", null, "u_me"), null);
  const ans = rr(res(3, 1, 20), { by: "u_me", cid: "c111111111" });
  assert.strictEqual(F.chalEntry("res", "ridridridridrid1", ans, "u_me")[0], "u_me~c111111111");
  assert.strictEqual(F.chalEntry("res", "ridridridridrid1", Object.assign({}, ans, { by: "u_x" }), "u_me"), null);
  assert.strictEqual(F.chalEntry("res", "ridridridridrid1", Object.assign({}, ans, { r: null }), "u_me"), null);
});

const sha = (txt) => Array.from(require("crypto").createHash("sha256").update(txt, "utf8").digest());
const safety = (a, fa, b, fb) => F.safetyDigits(sha(F.safetyInput(a, fa, b, fb)));

t("key fingerprints hash the RFC 7638 canonical JWK", () => {
  assert.strictEqual(F.jwkCanon({ x: X43, y: Y43, d: "secret", kty: "EC" }), '{"crv":"P-256","kty":"EC","x":"' + X43 + '","y":"' + Y43 + '"}');
});

t("safety codes are 12 digits, the same on both sides and stable", () => {
  const ab = safety("u_a", X43, "u_b", Y43), ba = safety("u_b", Y43, "u_a", X43);
  assert.ok(/^\d{4} \d{4} \d{4}$/.test(ab));
  assert.strictEqual(ab, ba);
  assert.strictEqual(ab, safety("u_a", X43, "u_b", Y43));
  assert.notStrictEqual(safety("u_a", X43, "u_b", X43), ab);
  assert.notStrictEqual(safety("u_a", X43, "u_c", Y43), ab);
  assert.strictEqual(F.safetyDigits([0, 0, 0, 0, 39, 15, 255, 255, 255]), "0000 9999 7215");
});

t("pins: first sight is new, a match is ok, a different key is changed", () => {
  const FP1 = "A".repeat(42) + "Q", FP2 = "B".repeat(42) + "g";
  let pins = F.cleanPins({});
  assert.strictEqual(F.pinState(pins.p.u_b, FP1), "new");
  pins = F.setPin(pins, "u_b", FP1, 10);
  assert.strictEqual(F.pinState(pins.p.u_b, FP1), "ok");
  pins = F.setPin(pins, "u_b", FP1, 20, true);
  assert.strictEqual(pins.p.u_b.ok, 1);
  assert.strictEqual(F.pinState(pins.p.u_b, FP2), "changed");
  const acc = F.setPin(pins, "u_b", FP2, 30);
  assert.strictEqual(F.pinState(acc.p.u_b, FP2), "ok");
  assert.strictEqual(acc.p.u_b.ok, undefined);
  assert.strictEqual(pins.p.u_b.fp, FP1);
});

t("pin docs merge per peer by newest change and drop junk", () => {
  const FP1 = "A".repeat(42) + "Q", FP2 = "B".repeat(42) + "g";
  const a = { p: { u_b: { fp: FP1, at: 10, ok: 1 }, u_c: { fp: FP1, at: 5 } } }, b = { p: { u_b: { fp: FP2, at: 20 }, "bad/id": { fp: FP1, at: 1 }, u_d: { fp: "short", at: 1 } } };
  const m = F.mergePins(a, b);
  assert.strictEqual(canon(m), canon(F.mergePins(b, a)));
  assert.deepStrictEqual(Object.keys(m.p).sort(), ["u_b", "u_c"]);
  assert.deepStrictEqual(m.p.u_b, { fp: FP2, at: 20 });
  assert.strictEqual(F.cleanPins({ p: { u_b: { fp: FP1, at: 1, ok: "yes", extra: 1 } } }).p.u_b.ok, 1);
});

t("db rules: each player writes only their own card, code and challenge doc", () => {
  const ok = (uid, lv, p, op) => R.allowed(R.RULES, uid, lv, p, op);
  assert.ok(ok("u_a", "interact", "cards/u_a", "write"));
  assert.ok(!ok("u_b", "interact", "cards/u_a", "write"));
  assert.ok(ok("u_b", "interact", "cards/u_a", "read"));
  assert.ok(!ok("u_b", "view", "cards/u_a", "read"));
  assert.ok(!ok("u_b", "view", "cards/u_b", "write"));
  assert.ok(ok("u_b", "interact", "chal/u_b", "write"));
  assert.ok(!ok("u_b", "admin", "chal/u_a", "write"));
  assert.ok(ok("u_own", "owner", "chal/u_a", "write"));
  assert.ok(ok("u_b", "interact", "codes/u_b", "write"));
  assert.ok(!ok("u_b", "interact", "codes/u_a", "write"));
  assert.ok(ok("u_a", "interact", "data/users/u_a/friends", "write"));
  assert.ok(ok("u_a", "interact", "data/users/u_a/save", "write"));
  assert.ok(!ok("u_b", "interact", "data/users/u_a/friends", "read"));
  assert.ok(!ok("u_own", "owner", "data/users/u_a/save", "read"));
  assert.ok(!ok("u_v", "view", "data/users/u_v/save", "write"));
});

t("db rules: public keys are readable by Contributors and writable only by their player or the owner", () => {
  const ok = (uid, lv, p, op) => R.allowed(R.RULES, uid, lv, p, op);
  assert.ok(ok("u_a", "interact", "keys/u_a", "write"));
  assert.ok(ok("u_b", "interact", "keys/u_a", "read"));
  assert.ok(!ok("u_b", "interact", "keys/u_a", "write"));
  assert.ok(!ok("u_b", "admin", "keys/u_a", "write"));
  assert.ok(ok("u_own", "owner", "keys/u_a", "write"));
  assert.ok(!ok("u_b", "view", "keys/u_a", "read"));
  assert.ok(ok("u_a", "interact", "data/users/u_a/keys", "write"));
  assert.ok(!ok("u_b", "interact", "data/users/u_a/keys", "read"));
  assert.ok(!ok("u_own", "owner", "data/users/u_a/keys", "read"));
  assert.ok(!ok("u_b", "interact", "data/users/u_a/chal", "read"));
  assert.ok(!ok("u_own", "owner", "data/users/u_a/chal", "read"));
  assert.ok(ok("u_a", "interact", "data/users/u_a/chal", "write"));
  assert.ok(!ok("u_own", "owner", "data/users/u_a/pins", "read"));
  assert.ok(!ok("u_b", "interact", "data/users/u_a/pins", "write"));
});

t("db rules: only the owner writes outside the game's own paths", () => {
  const ok = (uid, lv, p, op) => R.allowed(R.RULES, uid, lv, p, op);
  assert.ok(!ok("u_a", "interact", "junk/x", "write"));
  assert.ok(!ok("u_a", "admin", "junk/x", "write"));
  assert.ok(!ok("u_a", "interact", "data/other", "write"));
  assert.ok(ok("u_own", "owner", "junk/x", "write"));
  assert.ok(ok("u_a", "view", "junk/x", "read"));
  assert.ok(ok("u_a", "interact", "data/users/u_a/save", "write"));
  assert.ok(!ok("u_a", "interact", "data/users/u_b/save", "write"));
  assert.ok(!ok("u_a", "view", "data/users/u_a/save", "write"));
});

t("capabilities declaration keeps db, downloads and user and adds profile scope and rules", () => {
  const c = R.CAPABILITIES;
  assert.deepStrictEqual(Object.keys(c).sort(), ["db", "downloads", "user"]);
  assert.deepStrictEqual(c.user.scopes, ["profile"]);
  assert.strictEqual(c.downloads, true);
  const paths = c.db.rules.map((r) => r.path);
  c.db.rules.filter((r) => /\{self\}$/.test(r.path) && r.path !== "data/users/{self}").forEach((r) => {
    const pre = c.db.rules.find((x) => x.path === r.path.slice(0, -7));
    assert.ok(pre && pre.read && pre.write, "prefix rule sets read and write for " + r.path);
  });
  assert.ok(paths.every((p) => p.indexOf("data") !== 0 || p === "data/users/{self}"));
  assert.ok(paths.indexOf("data/users") < 0);
  ["cards", "codes", "chal", "keys"].forEach((p) => assert.ok(paths.indexOf(p) >= 0 && paths.indexOf(p + "/{self}") >= 0, p));
  assert.ok(c.db.rules.length <= 64);
});

console.log(n + " friends tests passed");
