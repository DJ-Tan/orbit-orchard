const out = [];
for (const ph of [0, -0.6, 0.6, -1.2]) for (const sx of [950, 1100, 1250]) for (const sy of [200, 450, 700]) for (const d of [3600, 6000]) {
  out.push({ tag: [ph, sx, sy, d].join(","), lv: { launch: [150, 850], bodies: [
    { kind: "fertile", x: 700, y: 500, r: 70, shield: { gap: 1.7, w: 0, ph: ph } },
    { kind: "sun", x: sx, y: sy, r: 70, dens: d },
    { kind: "fertile", x: 1420, y: 150, r: 55 }] } });
}
module.exports = out;
