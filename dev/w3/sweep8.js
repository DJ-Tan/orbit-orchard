const S = require("./sweep.js");
const res = [];
for (let n = 0; n < 50; n++) {
  const c = [[-S.rnd() * 300, 150 + S.rnd() * 350], [-250 - S.rnd() * 400, -S.rnd() * 450]].map(v => v.map(Math.round));
  const lv = Object.assign({}, S.base, { winds: S.base.winds.map((w, i) => Object.assign({}, w, { ax: c[i][0], ay: c[i][1] })) });
  res.push([S.score(lv), JSON.stringify(c)]);
}
res.sort((a, b) => b[0] - a[0]);
console.log(res.slice(0, 6));
