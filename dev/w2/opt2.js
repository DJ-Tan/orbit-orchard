"use strict";
const fs = require("fs");
const path = require("path");
const load = require("./load.js");
const fmt = require("./fmt.js");
const a = process.argv.slice(2);
const idx = +a[0], lo = +a[1], hi = +a[2], force = JSON.parse(a[3] || "{}"), iters = +(a[4] || 320);
const flag = (f) => a.includes(f);
const D = flag("--wide") ? 250 : 150;
const w = load();
const base = w.levels[idx];
const vary = [];
base.bodies.forEach((b, i) => {
  if (b.fixed) return;
  vary.push(["bodies." + i + ".x", b.x - D, b.x + D], ["bodies." + i + ".y", b.y - D, b.y + D], ["bodies." + i + ".r", b.r * 0.75, b.r * 1.25]);
  if (b.shield && flag("--shield")) vary.push(["bodies." + i + ".shield.gap", Math.max(0.9, b.shield.gap - 0.3), b.shield.gap + 0.3, "f"], ["bodies." + i + ".shield.ph", b.shield.ph - 0.4, b.shield.ph + 0.4, "f"]);
});
if (flag("--launch")) vary.push(["launch.0", base.launch[0] - D, base.launch[0] + D], ["launch.1", base.launch[1] - D, base.launch[1] + D]);
if (flag("--pollen")) (base.pollen || []).forEach((q, k) => vary.push(["pollen." + k + ".0", q[0] - D, q[0] + D], ["pollen." + k + ".1", q[1] - D, q[1] + D]));
const specPath = path.join(__dirname, "spec_tmp_" + idx + ".js");
fs.writeFileSync(specPath, "module.exports=" + JSON.stringify({ band: [lo, hi], force: force, level: { launch: base.launch, bodies: base.bodies, pollen: base.pollen }, vary: vary }) + ";");
const cp = require("child_process");
const out = cp.execFileSync("node", [path.join(__dirname, "opt.js"), specPath, String(iters)], { encoding: "utf8", maxBuffer: 1e8 });
const lines = out.trim().split("\n");
console.log(lines.slice(-4).join("\n"));
const m = lines[lines.length - 1].match(/^BEST (\[.*\]) (\[.*\]) (\[.*\])$/);
if (flag("--write") && m) {
  const w2 = load();
  const lv = w2.levels[idx];
  lv.bodies = JSON.parse(m[1]); lv.launch = JSON.parse(m[2]);
  const pol = JSON.parse(m[3]); if (pol.length) lv.pollen = pol;
  fs.writeFileSync(path.resolve(__dirname, "../../js/levels/w2.js"), fmt(w2));
  console.log("written");
}
