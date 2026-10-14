const E = require("./nodeenv.js"), S = E.O._debug.state;
const N = +(process.argv[2] || 60);
for (let d = 1; d <= 5; d++) { let inb = 0, near = 0, fb = 0, att = 0, t = 0, used = 0;
  for (let k = 0; k < N; k++) { const t0 = performance.now(); E.O.generateLevel(9000 + k * 13, { difficulty: d }); t += performance.now() - t0; const g = S.genInfo; att += g.att; used += 550000 - g.left; if (g.inBand) inb++; else if (g.nearest) near++; else fb++; }
  console.log("d" + d, "inBand", inb + "/" + N, "nearest", near, "spare/fallback", fb, "avg attempts", (att / N).toFixed(1), "avg ms", (t / N).toFixed(0), "avg ksteps", (used / N / 1000).toFixed(0)); }
