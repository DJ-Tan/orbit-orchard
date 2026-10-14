global.window = global;
window.OrchardSim = require("../../js/sim.js");
global.performance = { now: () => Date.now() };
const counts = {};
function mkctx() {
  const target = { canvas: null };
  return new Proxy(target, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === "createRadialGradient" || k === "createLinearGradient") return () => ({ addColorStop() {} });
      if (k === "createPattern") return () => ({});
      if (k === "createImageData") return (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) });
      return function () { counts[k] = (counts[k] || 0) + 1; };
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}
global.document = { createElement: () => ({ width: 0, height: 0, getContext: () => mkctx(), style: {} }) };
global.addEventListener = () => {};
global.innerWidth = 1280; global.innerHeight = 800; global.devicePixelRatio = 1;
global.requestAnimationFrame = () => {};
require("./testworld.js");
require("../../js/game.js");
const cv = { width: 0, height: 0, style: {}, getContext: () => mkctx(), addEventListener() {}, getBoundingClientRect: () => ({ width: 1280, height: 800 }), setPointerCapture() {} };
const origErr = console.error; let errs = 0;
console.error = (...a) => { errs++; if (errs < 5) origErr(...a); };
Orchard.init(cv);
const W = window.ORCHARD_TEST_WORLDS;
for (const skin of ["nocturne", "daylight", "synthwave", "inkwell"]) {
  for (let w = 0; w < 5; w++) {
    Orchard.setSettings({ skin, colorblind: w % 2 === 0 });
    for (const lv of W[w].levels) {
      Orchard.loadLevel(lv, { world: W[w], mode: "journey" });
      Orchard._debug.advance(150);
      Orchard._debug.shoot(-0.2, 0.6);
      Orchard._debug.advance(200);
    }
  }
}
Orchard.showcase(null); Orchard._debug.advance(600);
console.log("errors", errs, "fillRect", counts.fillRect, "drawImage", counts.drawImage);
