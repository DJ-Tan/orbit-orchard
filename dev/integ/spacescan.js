const E = require("./nodeenv.js"), O = E.O, D = O._debug, S = D.state;
let last = null; O.on("event", (e) => { if (e.type !== "pollen" && e.type !== "bounce" && e.type !== "warp" && e.type !== "boost") last = e.type; });
const res = { plantNow: [], plantLater: [], clearNow: [] };
for (const pre of [0, 150, 400]) {
  E.W.forEach((w) => w.levels.forEach((l) => {
    O.loadLevel(l, { world: w, mode: "journey" }); D.advance(pre); last = null;
    D.shoot(); let n = 0; while (S.seed && n++ < 2000) D.advance(1);
    if (last === "plant") { (pre ? res.plantLater : res.plantNow).push(l.id + (pre > 150 ? "@6.7s" : "")); if (!pre && O.getState().sown >= O.getState().needTotal) res.clearNow.push(l.id); }
  }));
}
console.log("first Space at once plants:", res.plantNow.length, "clears plot:", res.clearNow.length, res.clearNow.join(" "));
console.log("first Space after 2.5s plants:", res.plantLater.length, res.plantLater.join(" "));
O.loadLevel(E.W[0].levels[2], { world: E.W[0], mode: "journey" }); D.advance(100);
S.aim.ang = 0.3; S.aim.pow = 0.77; D.shoot(); D.advance(400);
const a1 = [S.aim.ang, S.aim.pow]; O.restart(); const a2 = [S.aim.ang, S.aim.pow];
O.loadLevel(E.W[0].levels[3], { world: E.W[0], mode: "journey" }); const a3 = [S.aim.ang, S.aim.pow];
O.loadLevel(E.W[0].levels[2], { world: E.W[0], mode: "journey" }); const a4 = [S.aim.ang, S.aim.pow];
console.log("aim kept between shots", a1, "after restart", a2, "other level", a3, "back to plot (reload)", a4);
