(() => {
  if (!window.OrchardAudio) {
    window.OrchardAudio = { unlock() {}, sfx(n) { console.log("sfx", n); }, music(k) { console.log("music", k); }, setVolumes() {}, getVolumes() { return {}; }, setMuted() {}, isMuted() { return false; }, onBeat() {} };
  }
  if (window.Orchard) return;
  const L = {};
  let lv = null, used = 0, input = false, cv = null;
  const emit = (n, p) => (L[n] || []).forEach((f) => f(p));
  const draw = () => {
    if (!cv) return;
    cv.width = innerWidth; cv.height = innerHeight;
    const c = cv.getContext("2d");
    c.fillStyle = "#141a3a"; c.fillRect(0, 0, cv.width, cv.height);
    c.fillStyle = "#8fc79a"; c.beginPath(); c.arc(cv.width * 0.7, cv.height * 0.55, 60, 0, 7); c.fill();
  };
  const hud = () => emit("hud", { seedsLeft: lv.seeds - used, seeds: lv.seeds, used, par: lv.par, pollenGot: 0, pollenTotal: (lv.pollen || []).length, sown: Math.min(used, 1), needTotal: 2, aimDeg: -12.5, power: 0.55, fast: false, flying: false });
  window.Orchard = {
    init(c) { cv = c; draw(); addEventListener("resize", draw); },
    setViewInsets() {}, showcase() {}, setPaused() {}, isPaused() { return false; }, setSettings() {},
    setInputEnabled(b) { input = b; },
    loadLevel(l) { lv = l; used = 0; hud(); },
    restart() { used = 0; hud(); },
    generateLevel(seed, o) { return { id: "gen-" + seed, name: "Generated sky", hint: "A generated sky.", seeds: 5, par: 2, preview: 1, launch: [200, 500], bodies: [{ kind: "fertile", x: 1100, y: 500, r: 70 }] }; },
    getState() { return {}; },
    on(n, f) { (L[n] = L[n] || []).push(f); }, off() {}
  };
  addEventListener("keydown", (e) => {
    if (!input || !lv) return;
    if (e.key === " ") { used++; emit("launch", { used }); emit("event", { type: "plant" }); hud(); }
    if (e.key === "w") emit("win", { levelId: lv.id, used: lv.par, par: lv.par, stars: 3, pollenGot: 1, pollenTotal: 1, time: 42, plants: [] });
    if (e.key === "l") emit("lose", { levelId: lv.id, sown: 1, needTotal: 2, used });
  });
})();
