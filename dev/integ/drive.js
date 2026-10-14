document.addEventListener("DOMContentLoaded", () => {
  const q = new URLSearchParams(location.search);
  const sc = q.get("sc");
  const st = document.createElement("style"); st.textContent = "*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition:none!important}"; document.head.appendChild(st);

  if (!sc) return;
  const key = (k) => document.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
  const log = (s) => { const d = document.getElementById("dev-log") || Object.assign(document.body.appendChild(document.createElement("pre")), { id: "dev-log" }); d.style.cssText = "position:fixed;right:0;top:40%;z-index:9999;background:#000c;color:#0f0;font:11px monospace;margin:0;padding:4px;max-width:40vw;white-space:pre-wrap"; d.textContent += s + "\n"; console.log("[drive] " + s); };
  key("Enter");
  if (sc === "hub") return;
  if (sc === "bot") {
    const D = Orchard._debug, S = D.state;
    Orchard.showcase(null);
    let plants = 0, max = 0;
    const t0 = performance.now(); for (let i = 0; i < 900 && performance.now() - t0 < 20000; i++) { D.advance(1); max = Math.max(max, S.used); plants = S.lv.bodies.reduce((a, b) => a + b.got, 0) + (S.phase === "won" ? 100 : 0); if (S.phase === "won") break; }
    log("bot: used=" + S.used + " sown=" + plants + " phase=" + S.phase + " state=" + (S.bot && S.bot.state) + " step=" + S.step);
    return;
  }
  if (sc === "tab") { key(q.get("n")); return; }
  const w = +(q.get("w") || 1), l = +(q.get("l") || 1);
  const cards = document.querySelectorAll(".wcard");
  if (!cards[w - 1]) { log("no world card " + w + " of " + cards.length); return; }
  cards[w - 1].click();
  if (sc === "world") return;
  const nodes = document.querySelectorAll(".node");
  if (!nodes[l - 1]) { log("no node " + l + " of " + nodes.length); return; }
  nodes[l - 1].click();
  if (sc === "intro") return;
  key(" ");
  const D = Orchard._debug, S = D.state, Sim = window.OrchardSim;
  D.advance(+(q.get("pre") || 150));
  const lv = S.lv;
  if (q.get("trail")) Orchard.setSettings({ trail: q.get("trail") });
  if (q.get("clean")) { const cs = document.createElement("style"); cs.textContent = "#dev-log,#modals{display:none!important}"; document.head.appendChild(cs); Orchard.setInputEnabled(true); }
  if (sc === "demo" || sc === "guides" || sc === "revive" || sc === "alldemo" || sc === "trail") { extra(sc, q, D, S, Sim, key, log); return; }
  let best = null;
  const target = lv.bodies.findIndex((b) => b.kind === "fertile");
  const T0 = S.T != null ? S.T : 0;
  outer: for (let a = 0; a < 360; a += 1) for (let p = 0.15; p <= 1; p += 0.03) {
    const r = Sim.simulateShot(lv, a * Math.PI / 180, p, T0, 14, null);
    if (r.end && r.end.type === "plant") { best = [a * Math.PI / 180, p, r.seed.t]; break outer; }
  }
  log("T=" + T0 + " shot " + JSON.stringify(best));
  if (!best) return;
  Orchard.on("event", (e) => log("ev " + e.type + " T=" + S.T.toFixed(3) + " seed=" + (S.seed ? S.seed.x.toFixed(0) + "," + S.seed.y.toFixed(0) : "-")));
  log("pre-launch T=" + S.T + " paused=" + S.paused + " phase=" + S.phase + " acc=" + S.acc);
  log("launched " + D.shoot(best[0], best[1]) + " T=" + S.T);
  if (sc === "flight") { D.advance(Math.round(best[2] * 60 * 0.6)); return; }
  D.advance(Math.round(best[2] * 60) + 30);
  if (sc === "plant") { D.advance(90); return; }
  lv.bodies.forEach((b, i) => { if (b.kind === "fertile") for (let k = 0; k < (b.need || 1); k++) D.sow(i, -1.2 + k * 0.6); });
  D.advance(+(q.get("post") || 200));
  log("modal: " + (document.querySelector(".modal h2, [role=dialog] h2") || {}).textContent);
});

window.TEST_SOLUTIONS = {"w1-05":{"shots":[[0,0.55,0],[0,0.55,227],[0,0.55,454]],"stars":3,"golden":true},"w1-03":{"shots":[[-0.418879,0.55,0],[0.226893,0.55,233]],"stars":3,"golden":true},"w4-03":{"shots":[[-0.785398,0.55,90],[-0.715585,0.55,306]],"stars":3,"golden":true},"w4-13":{"shots":[[-0.628319,0.55,420],[-0.715585,0.55,1078],[-0.593412,0.55,1711]],"stars":3,"golden":true}};

function extra(sc, q, D, S, Sim, key, log) {
  const DT = Sim.DT, id = S.def.id, all = Object.assign({}, window.ORCHARD_SOLUTIONS || {}, window.TEST_SOLUTIONS);
  const sol = all[id];
  const cnt = { launch: 0, event: 0, win: 0, lose: 0, zenComplete: 0 }, demoEv = [];
  Object.keys(cnt).forEach((n) => Orchard.on(n, (e) => { cnt[n]++; if (n === "lose" || n === "win") log(n + " " + JSON.stringify(e)); }));
  Orchard.on("demo", (e) => { demoEv.push(e); log("demo " + JSON.stringify(e) + " step=" + S.step); });
  if (sc === "demo") {
    log(id + " sol " + JSON.stringify(sol));
    const t0 = performance.now();
    log("instant playDemo -> " + Orchard.playDemo(sol, { instant: true, upTo: q.get("upto") ? +q.get("upto") : undefined }) + " in " + Math.round(performance.now() - t0) + "ms, counts " + JSON.stringify(cnt));
    Orchard.restart();
    const ks = [];
    Orchard.on("demo", (e) => { if (e.phase === "shot") ks.push(S.step + "/" + sol.shots[e.i][2] + " aim=" + (S.aim.ang === sol.shots[e.i][0] && S.aim.pow === sol.shots[e.i][1])); });
    Orchard.playDemo(sol, { speed: +(q.get("speed") || 1), upTo: q.get("upto") ? +q.get("upto") : undefined });
    let f = 0, ffMax = 0;
    const stop = +(q.get("at") || 0);
    while (Orchard.getState().demoState !== "done" && f < 20000 && (!stop || f < stop)) { D.advance(1); f++; if (S.fast) ffMax++; }
    log("stepped demo: frames=" + f + " ffFrames=" + ffMax + " launches(step/k) " + ks.join(", ") + " counts " + JSON.stringify(cnt) + " phase=" + S.phase + " input canAim=" + (S.mode === "play" && !S.demo));
    if (!stop) { D.advance(60); log("after end: isDemo=" + Orchard.isDemo() + " state " + JSON.stringify(Orchard.getState())); }
    if (q.get("stop")) { Orchard.stopDemo(); log("stopDemo -> isDemo=" + Orchard.isDemo() + " phase=" + S.phase + " step=" + S.step); }
    return;
  }
  if (sc === "guides") {
    log("setGuides " + Orchard.setGuides(sol));
    D.advance(+(q.get("pre") || 40));
    key("h");
    const sh = sol.shots[0];
    log("H snap exact=" + (S.aim.ang === sh[0] && S.aim.pow === sh[1]) + " aim=" + S.aim.ang + "," + S.aim.pow);
    if (q.get("go")) {
      for (let j = 0; j < sol.shots.length && j < +q.get("go"); j++) {
        const s2 = sol.shots[j];
        if (S.step > s2[2]) { log("missed k " + s2[2] + " step " + S.step); break; }
        while (S.step < s2[2]) D.advance(1, DT);
        key("h");
        const pred = Sim.simulateShot(S.lv, S.aim.ang, S.aim.pow, S.T, 14, S.pollenGot.slice());
        const pvEnd = S.pv && S.pv.end;
        key(" ");
        while (S.seed) D.advance(1, DT);
        log("shot " + j + " at step " + S.step + " predicted " + pred.end.type + "#" + pred.end.i + " steps=" + Math.round(pred.seed.t / DT) + " preview end=" + (pvEnd ? pvEnd.type : "none") + " engine sown=" + Orchard.getState().sown);
      }
    }
    D.advance(+(q.get("post") || 30));
    log("state " + JSON.stringify(Orchard.getState()));
    return;
  }
  if (sc === "revive") {
    let n = 0;
    while (Orchard.getState().seedsLeft > 0 && n++ < 20) { D.shoot(Math.PI, 1); while (S.seed) D.advance(1); }
    D.advance(120);
    log("after waste: phase=" + S.phase + " seedsLeft=" + S.seedsLeft + " counts " + JSON.stringify(cnt));
    log("addSeeds(1) -> " + Orchard.addSeeds(1) + " phase=" + S.phase + " seedsLeft=" + S.seedsLeft + " seeds=" + S.seeds + " fade=" + S.fade);
    if (sol) {
      const sh = sol.shots[0];
      while (S.step < sh[2]) D.advance(1, DT);
      log("shoot sol -> " + D.shoot(sh[0], sh[1]));
      D.advance(400);
      log("after: phase=" + S.phase + " counts " + JSON.stringify(cnt) + " state " + JSON.stringify(Orchard.getState()));
    }
    return;
  }
  if (sc === "trail") {
    const sh = sol ? sol.shots[0] : [-0.3, 0.6, 0];
    while (S.step < sh[2]) D.advance(1, DT);
    const pred = Sim.simulateShot(S.lv, sh[0], sh[1], S.T, 14, null), n = Math.round(pred.seed.t / DT);
    D.shoot(sh[0], sh[1]);
    D.advance(Math.round(n * +(q.get("frac") || 0.55)), DT);
    const sp = D.toScreen(S.seed.x, S.seed.y), sx = sp[0], sy = sp[1];
    log("SEEDXY " + Math.round(sx) + " " + Math.round(sy) + " trail=" + Orchard.getSettings().trail + " skin=" + Orchard.getSettings().skin);
    return;
  }
  if (sc === "alldemo") {
    const W = window.ORCHARD_WORLDS, res = [];
    let ok = 0, comp = 0, tot = 0;
    const t0 = performance.now();
    W.forEach((w) => w.levels.forEach((l) => {
      const s2 = (window.ORCHARD_SOLUTIONS || {})[l.id];
      if (!s2) { res.push(l.id + ":nosol"); return; }
      Orchard.loadLevel(l, { world: w, mode: "journey" });
      let end = null;
      const h = (e) => { if (e.phase === "end") end = e; };
      Orchard.on("demo", h);
      Orchard.playDemo(s2, { instant: true });
      Orchard.off("demo", h);
      tot++;
      if (end && end.ok) ok++;
      if (end && end.completed) comp++;
      if (!end || !end.completed || !end.ok) res.push(l.id + ":" + JSON.stringify(end && { ok: end.ok, completed: end.completed, results: end.results, late: end.late }));
    }));
    log("alldemo " + tot + " with solutions: ok=" + ok + " completed=" + comp + " in " + Math.round(performance.now() - t0) + "ms; counts " + JSON.stringify(cnt));
    log("problems: " + res.join(" "));
  }
}
