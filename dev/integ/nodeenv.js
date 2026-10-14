const path = require("path"), fs = require("fs"), ROOT = path.join(__dirname, "..", "..");
global.window = global;
window.OrchardSim = require(path.join(ROOT, "js/sim.js"));
global.performance = { now: () => { const t = process.hrtime(); return t[0] * 1e3 + t[1] / 1e6; } };
function mkctx() {
  return new Proxy({}, { get(o, k) { if (k in o) return o[k]; if (/create(Radial|Linear)Gradient/.test(k)) return () => ({ addColorStop() {} }); if (k === "createPattern") return () => ({}); if (k === "createImageData") return (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }); return () => {}; }, set(o, k, v) { o[k] = v; return true; } });
}
global.document = { createElement: () => ({ getContext: () => mkctx(), style: {} }) };
global.addEventListener = () => {}; global.requestAnimationFrame = () => {}; global.devicePixelRatio = 1;
window.OrchardAudio = { sfx() {}, unlock() {} };
window.ORCHARD_WORLDS = [];
for (let w = 1; w <= 5; w++) require(path.join(ROOT, "js/levels/w" + w + ".js"));
new Function("window", fs.readFileSync(path.join(ROOT, "js/solutions.js"), "utf8"))(window);
require(path.resolve(ROOT, process.env.GAME || "js/game.js"));
Orchard.init({ style: {}, getContext: () => mkctx(), addEventListener() {}, getBoundingClientRect: () => ({ width: 1280, height: 800 }) });
module.exports = { Sim: window.OrchardSim, W: window.ORCHARD_WORLDS, SOL: window.ORCHARD_SOLUTIONS, O: window.Orchard };
