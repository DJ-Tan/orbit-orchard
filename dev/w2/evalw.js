"use strict";
global.window = global;
const Sim = require("../../js/sim.js");
function outerR(b) { return b.shield ? Sim.shieldRadius(b) : b.r; }
function valid(lv) {
  const [lx, ly] = lv.launch;
  const B = lv.bodies;
  for (let i = 0; i < B.length; i++) {
    const b = B[i], R = outerR(b);
    if (b.x - b.r < 20 || b.x + b.r > 1580 || b.y - b.r < 20 || b.y + b.r > 980) return false;
    if (Math.hypot(b.x - lx, b.y - ly) < R + 40) return false;
    for (let j = i + 1; j < B.length; j++) if (Math.hypot(b.x - B[j].x, b.y - B[j].y) < R + outerR(B[j]) + 12) return false;
  }
  for (const q of lv.pollen || []) {
    if (q[0] < 30 || q[0] > 1570 || q[1] < 30 || q[1] > 970) return false;
    for (const b of B) if (Math.hypot(q[0] - b.x, q[1] - b.y) < outerR(b) + 24) return false;
  }
  return true;
}
function stats(lv) {
  if (!valid(lv)) return null;
  const fert = lv.bodies.map((b, i) => (b.kind === "fertile" ? i : -1)).filter((i) => i >= 0);
  const hits = {}, bh = {};
  fert.forEach((i) => { hits[i] = 0; bh[i] = [0, 0, 0, 0]; });
  const pol = (lv.pollen || []).map(() => 0);
  let total = 0;
  for (let a = 0; a < 360; a += 1.5) for (let p = 0.1; p <= 1.0001; p += 0.035) {
    total++;
    const got = (lv.pollen || []).map(() => false);
    const r = Sim.simulateShot(lv, a * Math.PI / 180, p, 0, Sim.FLIGHT_MAX, got);
    got.forEach((g, k) => { if (g) pol[k]++; });
    if (r.end && r.end.type === "plant") {
      hits[r.end.i]++;
      let nb = 0; for (const e of r.events) if (e.type === "bounce") nb++;
      bh[r.end.i][Math.min(nb, 3)]++;
    }
  }
  return { total, hits, bh, pol, fert };
}
module.exports = { stats, valid };
if (require.main === module || process.send) {
  process.on("message", (m) => { process.send({ id: m.id, res: stats(m.lv) }); });
}
