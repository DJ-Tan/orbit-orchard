global.window = global;
window.OrchardSim = require("../../js/sim.js");
global.performance = { now: () => Date.now() };
function mkctx() {
  return new Proxy({}, { get(o, k) { if (k in o) return o[k]; if (/create(Radial|Linear)Gradient/.test(k)) return () => ({ addColorStop() {} }); if (k === "createPattern") return () => ({}); if (k === "createImageData") return (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }); return () => {}; }, set(o, k, v) { o[k] = v; return true; } });
}
global.document = { createElement: () => ({ getContext: () => mkctx(), style: {} }) };
const keyHandlers = {};
global.addEventListener = (n, f) => { keyHandlers[n] = f; }; global.requestAnimationFrame = () => {}; global.devicePixelRatio = 1;
const sfx = [];
window.OrchardAudio = { sfx: (n, o) => sfx.push(n), unlock() {} };
require("./testworld.js"); require("../../js/game.js");
Orchard.init({ style: {}, getContext: () => mkctx(), addEventListener() {}, getBoundingClientRect: () => ({ width: 1280, height: 800 }) });
const log = [];
["hud", "launch", "event", "toast", "win", "lose", "zenComplete", "settings"].forEach((n) => Orchard.on(n, (p) => log.push([n, p])));
const W = ORCHARD_TEST_WORLDS;
const count = (n) => log.filter((x) => x[0] === n).length;
// lose flow
Orchard.loadLevel(W[0].levels[2], { world: W[0], mode: "journey" });
Orchard._debug.advance(150);
for (let i = 0; i < 5; i++) { Orchard._debug.shoot(Math.PI, 0.9); Orchard._debug.advance(60 * 8); }
console.log("lose:", count("lose"), log.filter((x) => x[0] === "lose")[0], "launches", count("launch"), "state", Orchard.getState().phase);
// win flow
log.length = 0;
Orchard.loadLevel(W[0].levels[0], { world: W[0], mode: "journey" });
Orchard._debug.advance(150);
Orchard._debug.sow(0, -2); Orchard._debug.sow(0, -1); Orchard._debug.sow(4, 2);
Orchard._debug.advance(120);
console.log("win:", JSON.stringify(log.filter((x) => x[0] === "win")[0]));
// zen
log.length = 0;
const g = Orchard.generateLevel("zz", { difficulty: 2 });
Orchard.loadLevel(g, { world: W[1], mode: "zen" });
console.log("zen seeds", Orchard.getState().seeds);
Orchard._debug.advance(150);
g.bodies.forEach((b, i) => { if (b.kind === "fertile") for (let k = 0; k < (b.need || 1); k++) Orchard._debug.sow(i, -1.5); });
Orchard._debug.advance(120);
console.log("zenComplete", JSON.stringify(log.filter((x) => x[0] === "zenComplete")), "win", count("win"));
// daily
log.length = 0;
Orchard.loadLevel(g, { world: W[1], mode: "daily" });
Orchard._debug.advance(150);
g.bodies.forEach((b, i) => { if (b.kind === "fertile") for (let k = 0; k < (b.need || 1); k++) Orchard._debug.sow(i, -1.5); });
Orchard._debug.advance(120);
console.log("daily win", JSON.stringify(log.filter((x) => x[0] === "win").map((x) => x[1].levelId)), "seeds", Orchard.getState().seeds);
// keys
log.length = 0;
const ev = (key) => ({ key, target: { tagName: "BODY" }, preventDefault() {}, repeat: false });
keyHandlers.keydown(ev("g")); keyHandlers.keydown(ev("ArrowLeft")); Orchard._debug.advance(10); keyHandlers.keyup(ev("ArrowLeft"));
keyHandlers.keydown(ev(" "));
console.log("settings", JSON.stringify(log.filter((x) => x[0] === "settings")), "launch", count("launch"), "hud n", count("hud"));
console.log("sfx", [...new Set(sfx)].join(","));
Orchard.setInputEnabled(false); keyHandlers.keydown(ev("r")); console.log("input disabled R ignored used=", Orchard.getState().used);
