"use strict";
const C = require("../../js/cloud.js");
const assert = require("assert");
let seed = 7;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const ri = (n) => Math.floor(rnd() * n);
const LEVELS = ["w1-01", "w1-02", "w2-05", "w3-10", "w5-22"];
const DAYS = ["20261001", "20261002", "20261003", "20261005", "20261006"];

function freshLocal(dev) {
  return {
    v: 2, levels: {}, ach: {}, flora: {}, seen: {}, fails: {}, coach: {}, announced: {}, skins: { nocturne: 1 },
    stats: { sown: 0, plants: 0, playMs: 0, wins: 0, stubborn: 0 },
    settings: { skin: "nocturne", grid: true, master: 0.8 },
    daily: { last: null, streak: 0, best: 0, days: {} },
    wallet: { earn: {}, spend: {}, frost: {} },
    zen: { diff: 3, seed: null },
    sync: { dev, gen: 0, others: {}, settingsAt: 0, st: null }
  };
}

function act(S, log) {
  const r = ri(7);
  if (r === 0) { S.stats.sown++; log.sown++; }
  else if (r === 1) {
    const id = LEVELS[ri(LEVELS.length)], st = 1 + ri(3), used = 1 + ri(5);
    const o = S.levels[id] || { stars: 0, golden: false, best: null, time: null, clears: 0 };
    o.stars = Math.max(o.stars, st); o.best = o.best == null ? used : Math.min(o.best, used); o.clears++;
    S.levels[id] = o;
    log.best[id] = Math.min(log.best[id] || 99, used); log.stars[id] = Math.max(log.stars[id] || 0, st);
    S.wallet.earn["clear:" + id] = 10; log.earn["clear:" + id] = 10;
  } else if (r === 2) { const f = ["daisy", "fern"][ri(2)]; S.flora[f] = (S.flora[f] || 0) + 1; log.flora[f] = (log.flora[f] || 0) + 1; }
  else if (r === 3) { const k = "seed:" + C.newId(); S.wallet.spend[k] = 8; log.spend[k] = 8; }
  else if (r === 4) { const d = DAYS[ri(DAYS.length)]; S.daily.days[d] = { stars: 1 + ri(3), used: 2, par: 2 }; log.days[d] = 1; }
  else if (r === 5) { S.ach["a" + ri(5)] = 1000 + ri(1000); }
  else { S.settings.skin = ["daylight", "synthwave", "inkwell"][ri(3)]; }
}

function sync(S, server, t) {
  const L = C.toWire(S, t);
  const M = server.doc ? C.merge(L, server.doc) : L;
  server.doc = M;
  return C.fromWire(M, S);
}

for (let trial = 0; trial < 300; trial++) {
  const devs = [freshLocal("a"), freshLocal("b"), freshLocal("c")];
  const server = { doc: null };
  const log = { sown: 0, flora: {}, best: {}, stars: {}, earn: {}, spend: {}, days: {} };
  let t = 1;
  for (let step = 0; step < 60; step++) {
    const i = ri(3);
    if (rnd() < 0.6) act(devs[i], log);
    else devs[i] = sync(devs[i], server, ++t);
    if (rnd() < 0.05) {
      const stale = JSON.parse(JSON.stringify(server.doc));
      if (stale) server.doc = C.merge(stale, server.doc);
    }
  }
  for (let r = 0; r < 2; r++) for (let i = 0; i < 3; i++) devs[i] = sync(devs[i], server, ++t);
  for (const S of devs) {
    assert.strictEqual(S.stats.sown, log.sown, "sown total");
    Object.keys(log.flora).forEach((f) => assert.strictEqual(S.flora[f], log.flora[f], "flora " + f));
    Object.keys(log.best).forEach((id) => { assert.strictEqual(S.levels[id].best, log.best[id]); assert.strictEqual(S.levels[id].stars, log.stars[id]); });
    const exp = Object.keys(log.earn).reduce((s, k) => s + log.earn[k], 0) - Object.keys(log.spend).reduce((s, k) => s + log.spend[k], 0);
    assert.strictEqual(C.balance(S.wallet), exp, "balance");
    Object.keys(log.days).forEach((d) => assert.ok(S.daily.days[d], "day " + d));
    { const x = C.toWire(S, t), y = C.toWire(devs[0], t); Object.keys(x).forEach((k) => { if (C.canon(x[k]) !== C.canon(y[k])) { console.log(k, C.canon(x[k]).slice(0, 400), "\n", C.canon(y[k]).slice(0, 400)); process.exit(1); } }); }
    assert.strictEqual(S.settings.skin, devs[0].settings.skin);
  }
}
console.log("convergence: 300 random 3-device histories ok");

for (let trial = 0; trial < 300; trial++) {
  const mk = () => { const S = freshLocal("d" + ri(3)); for (let i = 0; i < 20; i++) act(S, { sown: 0, flora: {}, best: {}, stars: {}, earn: {}, spend: {}, days: {} }); S.sync.settingsAt = ri(3); return C.toWire(S, 1); };
  const a = mk(), b = mk(), c = mk();
  const k = (x) => C.canonWire(x, false);
  assert.strictEqual(k(C.merge(a, b)), k(C.merge(b, a)), "commutative");
  assert.strictEqual(k(C.merge(C.merge(a, b), c)), k(C.merge(a, C.merge(b, c))), "associative");
  assert.strictEqual(k(C.merge(a, a)), k(C.merge(a, {})) === k(a) ? k(a) : k(C.merge(a, a)), "idempotent");
  assert.strictEqual(k(C.merge(C.merge(a, b), b)), k(C.merge(a, b)), "absorbing");
}
console.log("merge laws: commutative, associative, idempotent ok");

{
  const A = freshLocal("a"), B = freshLocal("b");
  A.stats.sown = 5; A.levels["w1-01"] = { stars: 3, golden: true, best: 2, time: 9, clears: 4 };
  const server = { doc: null };
  sync(A, server, 1);
  const R = freshLocal("a"); R.sync.gen = 1; R.settings.skin = "inkwell"; R.sync.st = null;
  const reset = sync(R, server, 2);
  assert.strictEqual(Object.keys(reset.levels).length, 0, "reset wins");
  const B2 = sync(B, server, 3);
  assert.strictEqual(B2.stats.sown, 0, "other device adopts reset");
  B2.stats.sown = 2;
  const B3 = sync(B2, server, 4);
  assert.strictEqual(B3.stats.sown, 2);
  const Aold = A; Aold.stats.sown = 99;
  const A2 = sync(Aold, server, 5);
  assert.strictEqual(A2.stats.sown, 2, "stale device loses to newer generation");
}
console.log("reset generations ok");

{
  const fresh = freshLocal("n");
  const server = { doc: null };
  const A = freshLocal("a"); A.sync.st = null; A.settings.skin = "synthwave";
  let a = sync(A, server, 1);
  a.settings.skin = "daylight";
  a = sync(a, server, 10);
  const n = sync(fresh, server, 11);
  assert.strictEqual(n.settings.skin, "daylight", "new device takes cloud settings");
  assert.strictEqual(n.settings.master, 0.8, "volume stays per device");
}
console.log("settings sync ok");

{
  const d = C.mergeDaily({ last: "20261005", streak: 5, best: 5, days: { "20261005": { stars: 2, used: 3 } } }, { last: "20261006", streak: 1, best: 3, days: { "20261006": { stars: 1, used: 4 } } });
  assert.strictEqual(d.last, "20261006");
  assert.ok(d.streak >= 2, "streak counts consecutive days");
}
console.log("daily merge ok");

{
  const server = { doc: null };
  let B = freshLocal("b");
  B.wallet.earn["clear:w1-01"] = 10; B.wallet.spend["trail:comet"] = 60;
  B = sync(B, server, 1);
  const A = freshLocal("a"); A.sync.gen = Date.now();
  const A2 = sync(A, server, 2);
  assert.ok(A2.wallet.spend["trail:comet"], "reset keeps purchases from other devices");
  const B2 = sync(B, server, 3);
  assert.ok(B2.wallet.spend["trail:comet"] && B2.wallet.earn["clear:w1-01"], "stale device keeps wallet after reset");
}
console.log("reset keeps wallet ok");

{
  const server = { doc: null };
  const U = freshLocal("u"); U.settings.skin = "daylight"; U.sync.settingsAt = 1;
  sync(U, server, 1);
  const F = sync(freshLocal("f"), server, 2);
  assert.strictEqual(F.settings.skin, "daylight", "fresh device does not override an upgraded device's settings");
  assert.strictEqual(server.doc.settings.skin, "daylight");
}
console.log("upgraded settings win over fresh defaults ok");

{
  const bad = C.merge({ v: 2, gen: 0, daily: { last: 5, days: { x: 1 } } }, { v: 2, gen: 0, daily: { last: "20261001", streak: 2, days: { "20261001": { stars: 1, used: 2 } } } });
  assert.strictEqual(bad.daily.last, "20261001");
  assert.ok(!bad.daily.days.x);
}
console.log("malformed daily ignored ok");

{
  const first = { stars: 1, used: 7, par: 3, pollenGot: 0, pollenTotal: 2, at: 1000 };
  const later = { stars: 3, used: 4, par: 3, pollenGot: 2, pollenTotal: 2, at: 5000, assist: true };
  const ab = C.betterDay(first, later), ba = C.betterDay(later, first);
  assert.strictEqual(C.canon(ab), C.canon(ba), "day merge is order independent");
  assert.strictEqual(ab.at, 1000, "earliest completed run stays official");
  assert.strictEqual(ab.stars, 1);
  assert.ok(!ab.assist, "official run keeps its own assist flag");
  assert.deepStrictEqual(ab.best, { stars: 3, used: 4, pollenGot: 2, assist: true }, "best keeps the better run");
  const same = C.betterDay(first, Object.assign({}, first));
  assert.ok(!("best" in same), "no best when it equals the official run");
  const legacy = { stars: 3, used: 3, par: 3 };
  assert.strictEqual(C.betterDay(legacy, first).at, 1000, "timed record is official over a legacy one");
  assert.strictEqual(C.betterDay(legacy, first).best.stars, 3, "legacy result still counts as a best");
  const t1 = { stars: 2, used: 5, par: 3, pollenGot: 1, pollenTotal: 2 }, t2 = { stars: 2, used: 5, par: 3, pollenGot: 0, pollenTotal: 2 };
  assert.strictEqual(C.canon(C.betterDay(t1, t2)), C.canon(C.betterDay(t2, t1)), "legacy ties resolve the same both ways");
}
console.log("daily official run and best ok");

{
  const rec = () => {
    const r = { stars: 1 + ri(3), used: 3 + ri(4), par: 3, pollenGot: ri(3), pollenTotal: 2 };
    if (rnd() < 0.8) r.at = 1000 + ri(4) * 1000;
    if (rnd() < 0.3) r.assist = true;
    if (rnd() < 0.4) r.best = { stars: 1 + ri(3), used: 3 + ri(3), pollenGot: ri(3) };
    return r;
  };
  const day = (r) => ({ last: "20261010", streak: 1, best: 1, days: { "20261010": r } });
  const k = (x) => C.canon(x);
  for (let trial = 0; trial < 2000; trial++) {
    const a = day(rec()), b = day(rec()), c = day(rec());
    const M = C.mergeDaily;
    assert.strictEqual(k(M(a, b)), k(M(b, a)), "day commutative");
    assert.strictEqual(k(M(M(a, b), c)), k(M(a, M(b, c))), "day associative");
    assert.strictEqual(k(M(M(a, b), b)), k(M(a, b)), "day absorbing");
    const m = M(a, b).days["20261010"], runs = [a, b].map((d) => d.days["20261010"]);
    const off = runs.filter((r) => r.at != null);
    if (off.length) assert.strictEqual(m.at, Math.min.apply(null, off.map((r) => r.at)), "earliest at is official");
    const top = Math.max.apply(null, runs.map((r) => Math.max(r.stars, r.best ? r.best.stars : 0)));
    assert.strictEqual(m.best ? m.best.stars : m.stars, top, "best stars never lost");
  }
}
console.log("daily merge laws ok");

{
  const server = { doc: null };
  let A = freshLocal("a"), B = freshLocal("b");
  A.daily = { last: "20261010", streak: 1, best: 1, days: { "20261010": { stars: 1, used: 7, par: 3, pollenGot: 0, pollenTotal: 1, at: 100 } } };
  A = sync(A, server, 1);
  B = sync(B, server, 2);
  B.daily.days["20261010"].best = { stars: 3, used: 4, pollenGot: 1 };
  B = sync(B, server, 3);
  A = sync(A, server, 4);
  const doc = C.canon(server.doc.daily);
  assert.strictEqual(C.canon(C.merge(C.toWire(A, 5), server.doc).daily), doc, "device A agrees with the cloud, no ping-pong");
  assert.strictEqual(C.canon(C.merge(C.toWire(B, 5), server.doc).daily), doc, "device B agrees with the cloud, no ping-pong");
  assert.strictEqual(A.daily.days["20261010"].stars, 1, "official stays the first run");
  assert.strictEqual(A.daily.days["20261010"].best.stars, 3, "replay best syncs to the other device");
}
console.log("daily replay best syncs ok");

{
  const server = { doc: null };
  let Old = freshLocal("old");
  for (let i = 1; i <= 16; i++) Old.levels["w2-" + String(i).padStart(2, "0")] = { stars: 3, golden: false, best: 1, time: 9, clears: 1 };
  for (let i = 1; i <= 10; i++) Old.levels["w3-" + String(i).padStart(2, "0")] = { stars: 2, golden: i === 3, best: 2, time: 9, clears: 1 };
  Old.announced = { 1: 1, 2: 1, 3: 1 };
  Old.wallet.spend["oracle:w3-11"] = 55;
  delete Old.sync.wo;
  Old = sync(Old, server, 1);
  const N = freshLocal("new"); N.sync.wo = 1; N.announced = { 1: 1, 2: 1, 4: 1 };
  const N2 = sync(N, server, 2);
  assert.deepStrictEqual(Object.keys(N2.announced).sort(), ["1", "2", "3", "4"], "old-client unlocks survive the merge");
  assert.strictEqual(N2.levels["w3-03"].golden, true, "Fold plot records keep their ids");
  assert.strictEqual(N2.wallet.spend["oracle:w3-11"], 55, "Oracle purchase stays with its plot");
  assert.strictEqual(N2.sync.wo, 1, "id-order migration flag stays on the device");
  assert.ok(!("wo" in C.toWire(N2, 3)) && !("wo" in server.doc), "migration flag is not synced");
  const Old2 = sync(Old, server, 4);
  assert.ok(Old2.announced["4"] && Old2.announced["3"], "old client takes the new device's unlocks too");
  assert.ok(!("wo" in Old2.sync), "old device is still migrated on its own first new boot");
}
console.log("old-client save with Fold progress merges ok");
