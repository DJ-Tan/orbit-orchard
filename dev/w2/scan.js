"use strict";
const cp = require("child_process"), path = require("path");
const cands = require(path.resolve(process.argv[2]));
const NW = 32; let i = 0, done = 0; const res = [];
const ws = [];
for (let k = 0; k < NW; k++) {
  const w = cp.fork(path.join(__dirname, "evalw.js")); ws.push(w);
  w.on("message", (m) => { res[m.id] = m.res; done++; next(w); if (done === cands.length) finish(); });
}
function next(w) { if (i < cands.length) { w.send({ id: i, lv: cands[i].lv }); i++; } }
ws.forEach(next);
function finish() {
  const rows = cands.map((c, k) => ({ tag: c.tag, r: res[k] })).filter((x) => x.r);
  rows.forEach((x) => { const r = x.r; x.s = r.fert.map((f) => (100 * r.hits[f] / r.total).toFixed(2) + "[" + r.bh[f].join(",") + "]").join(" ") + " pol:" + r.pol.join(","); x.min = Math.min.apply(null, r.fert.map((f) => r.hits[f])); });
  rows.sort((a, b) => b.min - a.min);
  rows.slice(0, 25).forEach((x) => console.log(x.tag, x.s));
  ws.forEach((w) => w.kill());
}
