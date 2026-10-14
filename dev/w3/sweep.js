global.window = global;
const Sim = require("../../js/sim.js");
global.ORCHARD_WORLDS = [];
require("../../js/levels/w3.js");
const idx = +process.argv[2];
const base = global.ORCHARD_WORLDS[0].levels[idx];
function score(lv, ti) {
  let h = 0, t = 0;
  for (let a = 0; a < 360; a += 3) for (let p = 0.1; p <= 1.0001; p += 0.05) { t++; const r = Sim.simulateShot(lv, a * Math.PI / 180, p, 0, 14, null); if (r.end.type === "plant" && (ti == null || r.end.i === ti)) h++; }
  return +(100 * h / t).toFixed(2);
}
module.exports = { base, score, rnd: (function () { let rs = 7; return function () { rs = (rs * 16807) % 2147483647; return rs / 2147483647; }; })() };
if (require.main === module) console.log(score(base), score(Object.assign({}, base, { winds: undefined })));
