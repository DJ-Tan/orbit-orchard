global.window = global;
const Sim = require("../../js/sim.js");
const lv = JSON.parse(process.argv[2]);
const a = +process.argv[3], p = +process.argv[4];
const s = Sim.newSeed(lv, a * Math.PI / 180, p); let T = 0; const out = [];
for (let n = 0; n < 1680; n++) { T += Sim.DT; const ev = Sim.stepSeed(lv, s, T, Sim.DT, []); if (ev) out.push(ev.type + (ev.i != null ? ev.i : "")); if (n % 12 === 0) out.push(`(${Math.round(s.x)},${Math.round(s.y)} h${Math.round(Math.atan2(s.vy, s.vx) * 180 / Math.PI)} v${Math.round(Math.hypot(s.vx, s.vy))})`); if (ev && Sim.TERMINAL[ev.type]) break; }
console.log(out.join(" "));
