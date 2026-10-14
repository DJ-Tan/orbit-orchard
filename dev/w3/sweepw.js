const S = require("./sweep.js");
const ranges = JSON.parse(process.argv[3]);
const N = +(process.argv[4] || 40);
const res = [];
for (let n = 0; n < N; n++) {
  const c = ranges.map(r => [Math.round(r[0] + S.rnd() * (r[1] - r[0])), Math.round(r[2] + S.rnd() * (r[3] - r[2]))]);
  const lv = Object.assign({}, S.base, { winds: S.base.winds.map((w, i) => Object.assign({}, w, { ax: c[i][0], ay: c[i][1] })) });
  res.push([S.score(lv, 0), JSON.stringify(c)]);
}
res.sort((a, b) => b[0] - a[0]);
console.log(res.slice(0, 6));
