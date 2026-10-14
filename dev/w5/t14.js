const q = require("./quickv.js");
for (const t2 of [[620, 140], [760, 130], [480, 130]]) for (const bh of [380, 360]) {
  const lv = { launch: [200, 500], bodies: [
    { kind: "blackhole", x: 850, y: bh, r: 20 },
    { kind: "barren", x: 330, y: 260, r: 130 }, { kind: "barren", x: 330, y: 740, r: 120 },
    { kind: "fertile", x: 1420, y: 220, r: 42 }, { kind: "fertile", x: t2[0], y: t2[1], r: 40 }],
    boosts: [{ x: 330, y: 500, mult: 1.3, ang: 0 }] };
  console.log(bh, t2, q(lv));
}
