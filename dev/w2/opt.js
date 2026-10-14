"use strict";
const cp = require("child_process");
const path = require("path");
const spec = require(path.resolve(process.argv[2]));
const iters = parseInt(process.argv[3] || "400", 10);
const NW = 32;
function clone(o) { return JSON.parse(JSON.stringify(o)); }
function setp(o, p, v) { const ks = p.split("."); let x = o; for (let i = 0; i < ks.length - 1; i++) x = x[ks[i]]; x[ks[ks.length - 1]] = v; }
function getp(o, p) { return p.split(".").reduce((x, k) => x[k], o); }
function score(r) {
  if (!r) return -99;
  const pct = r.fert.map((i) => 100 * r.hits[i] / r.total);
  const hard = Math.min.apply(null, pct);
  let s = 0;
  const [lo, hi] = spec.band;
  if (hard < lo) s -= (lo - hard) / lo * 3; else if (hard > hi) s -= (hard - hi) / hi * 1.5;
  if (r.fert.some((i) => r.hits[i] === 0)) s -= 5;
  for (const k in spec.force || {}) {
    const mb = spec.force[k], h = r.hits[k] || 0;
    if (!h) { s -= 1; continue; }
    let f = 0; for (let n = mb; n < 4; n++) f += r.bh[k][n];
    s += f / h;
  }
  r.pol.forEach((c) => { if (c === 0) s -= 2; else if (c < 4) s -= 0.3; });
  return s;
}
function desc(r) {
  if (!r) return "invalid";
  return r.fert.map((i) => `#${i}:${(100 * r.hits[i] / r.total).toFixed(2)}%[${r.bh[i].join(",")}]`).join(" ") + " pol:" + r.pol.join(",");
}
const workers = [];
let pending = {}, nextId = 0;
for (let i = 0; i < NW; i++) {
  const w = cp.fork(path.join(__dirname, "evalw.js"));
  w.on("message", (m) => { const cb = pending[m.id]; delete pending[m.id]; cb(m.res); });
  workers.push(w);
}
function evalLv(lv, wi) { return new Promise((res) => { const id = nextId++; pending[id] = res; workers[wi].send({ id, lv }); }); }
function mutate(lv, scale) {
  const n = clone(lv);
  const k = 1 + Math.floor(Math.random() * 3);
  for (let t = 0; t < k; t++) {
    const v = spec.vary[Math.floor(Math.random() * spec.vary.length)];
    const [p, lo, hi] = v;
    let x = getp(n, p) + (Math.random() * 2 - 1) * (hi - lo) * scale;
    x = Math.max(lo, Math.min(hi, x));
    setp(n, p, v[3] === "f" ? Math.round(x * 100) / 100 : Math.round(x / 5) * 5);
  }
  return n;
}
(async () => {
  let best = clone(spec.level);
  let bestR = await evalLv(best, 0), bestS = score(bestR);
  console.log("start " + bestS.toFixed(3) + " " + desc(bestR));
  let done = 0;
  while (done < iters) {
    const scale = 0.25 * (1 - done / iters) + 0.03;
    const cands = workers.map(() => mutate(best, scale));
    const rs = await Promise.all(cands.map((c, i) => evalLv(c, i)));
    done += NW;
    rs.forEach((r, i) => { const s = score(r); if (s > bestS) { bestS = s; best = cands[i]; bestR = r; console.log(done + " " + s.toFixed(3) + " " + desc(r)); } });
  }
  console.log("BEST", JSON.stringify(best.bodies), JSON.stringify(best.launch), JSON.stringify(best.pollen || []));
  workers.forEach((w) => w.kill());
})();
