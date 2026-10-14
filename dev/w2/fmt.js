"use strict";
const fs = require("fs");
const path = require("path");
function num(v) { return String(v); }
function obj(o) {
  if (Array.isArray(o)) return "[" + o.map(obj).join(", ") + "]";
  if (o && typeof o === "object") return "{ " + Object.keys(o).map((k) => k + ": " + obj(o[k])).join(", ") + " }";
  if (typeof o === "string") return JSON.stringify(o);
  return num(o);
}
module.exports = function (w) {
  const L = [];
  L.push("window.ORCHARD_WORLDS = window.ORCHARD_WORLDS || [];");
  L.push("window.ORCHARD_WORLDS.push({");
  L.push("  id: 2, name: " + JSON.stringify(w.name) + ",");
  L.push("  blurb: " + JSON.stringify(w.blurb) + ",");
  L.push("  theme: " + obj(w.theme) + ",");
  L.push("  levels: [");
  w.levels.forEach((lv, i) => {
    L.push("    {");
    L.push("      id: " + JSON.stringify(lv.id) + ", name: " + JSON.stringify(lv.name) + ",");
    L.push("      hint: " + JSON.stringify(lv.hint) + ",");
    L.push("      seeds: " + lv.seeds + ", par: " + lv.par + ", preview: " + lv.preview + ", launch: " + obj(lv.launch) + ",");
    L.push("      bodies: [");
    lv.bodies.forEach((b, j) => L.push("        " + obj(b) + (j < lv.bodies.length - 1 ? "," : "")));
    L.push("      ]" + (lv.pollen && lv.pollen.length ? "," : ""));
    if (lv.pollen && lv.pollen.length) L.push("      pollen: " + obj(lv.pollen));
    L.push("    }" + (i < w.levels.length - 1 ? "," : ""));
  });
  L.push("  ]");
  L.push("});");
  return L.join("\n") + "\n";
};
if (require.main === module) {
  const w = require("./load.js")();
  fs.writeFileSync(path.resolve(__dirname, "../../js/levels/w2.js"), module.exports(w));
}
