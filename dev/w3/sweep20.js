const S = require("./sweep.js");
const res = [];
for (let n = 0; n < 40; n++) {
  const lv = JSON.parse(JSON.stringify(S.base));
  const m = +(0.1 + S.rnd() * 0.5).toFixed(2), ang = S.rnd() < 0.5 ? null : +(-1.2 + S.rnd() * 1.2).toFixed(2);
  lv.boosts[0].mult = m; if (ang != null) lv.boosts[0].ang = ang;
  lv.bodies[0].shield.ph = +(0.6 + S.rnd() * 2).toFixed(2);
  res.push([S.score(lv, 0), m, ang, lv.bodies[0].shield.ph]);
}
res.sort((a, b) => b[0] - a[0]);
console.log(res.slice(0, 8));
