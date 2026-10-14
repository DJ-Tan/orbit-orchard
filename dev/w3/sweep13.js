const S = require("./sweep.js");
const res = [];
for (const m of [0.1, 0.15, 0.2]) for (const x of [1250, 1310, 1370]) for (const ph of [-1.57, -2.0]) {
  const lv = JSON.parse(JSON.stringify(S.base));
  lv.boosts[1].mult = m; lv.bodies[0].x = x; lv.bodies[0].shield.ph = ph;
  res.push([S.score(lv, 0), m, x, ph]);
}
res.sort((a, b) => b[0] - a[0]);
console.log(res.slice(0, 6));
