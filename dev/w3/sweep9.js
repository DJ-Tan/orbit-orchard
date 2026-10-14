const S = require("./sweep.js");
const res = [];
for (let n = 0; n < 60; n++) {
  const ax = -200 - Math.round(S.rnd() * 500), ay = -Math.round(S.rnd() * 450), x = 980 + Math.round(S.rnd() * 200), ph = +(S.rnd() * 0.8 - 0.6).toFixed(2);
  const lv = Object.assign({}, S.base, { winds: [Object.assign({}, S.base.winds[0], { ax, ay, x })] });
  lv.bodies = lv.bodies.slice(); lv.bodies[0] = Object.assign({}, lv.bodies[0], { shield: { gap: 1.5, w: 0, ph } });
  res.push([S.score(lv), JSON.stringify([ax, ay, x, ph])]);
}
res.sort((a, b) => b[0] - a[0]);
console.log(res.slice(0, 8));
