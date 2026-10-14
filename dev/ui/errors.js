(() => {
  const errs = [];
  const show = () => {
    let b = document.getElementById("dev-errs");
    if (!b) { b = document.createElement("pre"); b.id = "dev-errs"; b.style.cssText = "position:fixed;left:0;right:0;bottom:0;z-index:9999;background:#b00;color:#fff;font:12px monospace;margin:0;padding:6px;white-space:pre-wrap;max-height:40vh;overflow:auto"; document.body.appendChild(b); }
    b.textContent = errs.join("\n");
  };
  addEventListener("error", (e) => { errs.push((e.message || "error") + " @" + (e.filename || "").split("/").pop() + ":" + e.lineno); if (document.body) show(); });
  addEventListener("unhandledrejection", (e) => { errs.push("rejection " + e.reason); if (document.body) show(); });
  const w = console.warn;
  console.warn = (...a) => { errs.push("warn " + a.map((x) => (x && x.stack) || String(x)).join(" ").slice(0, 300)); if (document.body) show(); w.apply(console, a); };
  addEventListener("DOMContentLoaded", () => { if (errs.length) show(); });
})();
if (/seed=1/.test(location.search)) {
  try { localStorage.setItem("orbit-orchard-v2", JSON.stringify({ flora: { daisy: 3, fern: 12, spiral: 40, sunflower: 1, ember: 90 }, stats: { sown: 120, plants: 146, pollen: 30, playMs: 4000000 }, levels: { "w1-01": { stars: 3, golden: true, best: 1 }, "w1-02": { stars: 2, best: 3 }, "w1-03": { stars: 1, best: 4 } }, daily: { last: "20260928", streak: 3, best: 5, days: { "20260928": { stars: 2, used: 4, par: 3, pollenGot: 1, pollenTotal: 2 }, "20260927": { stars: 3, used: 3, par: 3 } } } })); } catch (e) {}
}
