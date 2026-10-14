const S = require("./sweep.js");
const res = [];
for (let n = 0; n < 25; n++) {
  const ax = Math.round(S.rnd() * 700), ay = Math.round(100 + S.rnd() * 600);
  const lv = Object.assign({}, S.base, { winds: [Object.assign({}, S.base.winds[0], { ax, ay })] });
  const sc = S.score(lv, 0);
  res.push([sc, JSON.stringify([ax, ay])]);
}
res.sort((a, b) => b[0] - a[0]);
console.log(res.slice(0, 8));
