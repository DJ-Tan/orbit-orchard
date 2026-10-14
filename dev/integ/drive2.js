document.addEventListener("DOMContentLoaded", () => {
  const q = new URLSearchParams(location.search), sc = q.get("sc2");
  if (!sc) return;
  const D = Orchard._debug, S = D.state, key = (k) => document.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
  const log = (s) => console.log("[drive] " + s);
  document.querySelectorAll(".wcard")[(+q.get("w") || 1) - 1].click();
  document.querySelectorAll(".node")[(+q.get("l") || 1) - 1].click();
  key(" ");
  const cs = document.createElement("style"); cs.textContent = "#dev-log,#modals{display:none!important}"; document.head.appendChild(cs);
  Orchard.setInputEnabled(true);
  Orchard.setSettings({ skin: q.get("skin") || "nocturne", colorblind: !!q.get("cb") });
  document.documentElement.dataset.skin = q.get("skin") || "nocturne";
  const hb = document.getElementById("hud").getBoundingClientRect(), narrow = innerWidth <= 720, tall = innerHeight > innerWidth;
  Orchard.setViewInsets({ top: Math.round(hb.bottom + 6), right: 0, bottom: narrow ? (tall ? 34 : 0) : 36, left: 0 });
  D.advance(+(q.get("pre") || 150));
  const lv = S.lv;
  setTimeout(() => log("view rot=" + S.rot + " s=" + S.view.s.toFixed(3) + " insets=" + JSON.stringify(S.insets) + " WH=" + S.W + "x" + S.H), 0);
  if (sc === "look") {
    lv.bodies.forEach((b, i) => { if (b.need > 1) D.sow(i, -2.2); });
    D.advance(120);
    const r = S.canvas.getBoundingClientRect(), ox = r.left + r.width * 0.62, oy = r.top + r.height * 0.55;
    const ev = (t, x, y) => S.canvas.dispatchEvent(new PointerEvent(t, { pointerId: 7, clientX: x, clientY: y, bubbles: true, button: 0, isPrimary: true }));
    ev("pointerdown", ox, oy);
    const dx = +(q.get("dx") || -120), dy = +(q.get("dy") || 40);
    ev("pointermove", ox + dx * 0.5, oy + dy * 0.5); ev("pointermove", ox + dx, oy + dy);
    D.advance(2);
    log("drag pow=" + S.aim.pow.toFixed(3) + " out=" + S.drag.out);
    if (q.get("release")) { ev("pointerup", ox + dx, oy + dy); log("released; used=" + S.used + " flying=" + !!S.seed); }
  } else if (sc === "ptest") {
    const ev = (t, x, y, id) => S.canvas.dispatchEvent(new PointerEvent(t, { pointerId: id || 7, clientX: x, clientY: y, bubbles: true, button: 0, isPrimary: true }));
    const L = D.toScreen(lv.launch[0], lv.launch[1]), scrAng = () => { const a = D.toScreen(lv.launch[0] + Math.cos(S.aim.ang) * 100, lv.launch[1] + Math.sin(S.aim.ang) * 100); return Math.atan2(a[1] - L[1], a[0] - L[0]) * 180 / Math.PI; };
    log("rotated=" + S.rot + " launcher screen=" + L.map(Math.round) + " s=" + S.view.s.toFixed(3));
    const hud = []; Orchard.on("hud", (h) => hud.push(h));
    const near = []; Orchard.on("event", (e) => { if (e.type === "near") near.push(e); });
    const ox = innerWidth * 0.5, oy = innerHeight * 0.55, ddx = +(q.get("dx") || 0), ddy = +(q.get("dy") || 120);
    ev("pointerdown", ox, oy); ev("pointermove", ox + ddx * 0.5, oy + ddy * 0.5); ev("pointermove", ox + ddx, oy + ddy); D.advance(1);
    log("drag screen (" + ddx + "," + ddy + ") -> aim screen angle " + scrAng().toFixed(1) + " expected " + (Math.atan2(-ddy, -ddx) * 180 / Math.PI).toFixed(1) + " hud aimDeg=" + hud[hud.length - 1].aimDeg + " pow=" + S.aim.pow.toFixed(2));
    ev("pointerup", ox + ddx, oy + ddy);
    const s0 = D.toScreen(S.seed.x, S.seed.y); D.advance(6); const s1 = D.toScreen(S.seed.x, S.seed.y);
    log("released used=" + S.used + " seed screen motion angle " + (Math.atan2(s1[1] - s0[1], s1[0] - s0[0]) * 180 / Math.PI).toFixed(1));
    ev("pointerdown", 100, 100, 9); D.advance(1); ev("pointerup", 100, 100, 9); D.advance(3);
    log("tap mid-flight -> fast=" + S.fast);
    const cv = S.canvas; cv.style.width = "1000px"; cv.style.height = "560px"; dispatchEvent(new Event("resize")); D.advance(2);
    log("mid-flight switch -> rotated=" + S.rot + " flying=" + !!S.seed + " seed=" + (S.seed ? S.seed.x.toFixed(0) + "," + S.seed.y.toFixed(0) : "-"));
    cv.style.width = ""; cv.style.height = ""; dispatchEvent(new Event("resize")); D.advance(2);
    log("switched back -> rotated=" + S.rot + " flying=" + !!S.seed);
    let n = 0; while (S.seed && n++ < 3000) D.advance(1);
    log("landed; used=" + S.used + " fast=" + S.fast + " tapFast=" + S.tapFast);
    D.advance(60);
    const a0 = scrAng();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true })); D.advance(20); document.dispatchEvent(new KeyboardEvent("keyup", { key: "ArrowLeft", bubbles: true }));
    log("ArrowLeft: screen angle " + a0.toFixed(1) + " -> " + scrAng().toFixed(1) + " (negative change = counter-clockwise on screen)");
    const u0 = S.used;
    ev("pointerdown", ox, oy, 11); ev("pointermove", ox + 30, oy + 40, 11); ev("pointermove", ox + 8, oy + 10, 11); D.advance(1);
    log("cancel zone: out=" + S.drag.out); ev("pointerup", ox + 8, oy + 10, 11); D.advance(2);
    log("cancel released -> launched=" + (S.used !== u0));
    const sim = window.OrchardSim; let nm = null;
    for (let a = -180; a < 180 && !nm; a += 0.5) for (let pw = 0.3; pw <= 1 && !nm; pw += 0.05) {
      const r = sim.simulateShot(lv, a * Math.PI / 180, pw, S.T, 6, null);
      if (!r.end || r.end.type === "plant") continue;
      const sd = sim.newSeed(lv, a * Math.PI / 180, pw); let T = S.T, best = 1e9;
      for (let k = 0; k < 600; k++) { T += sim.DT; const e = sim.stepSeed(lv, sd, T, sim.DT, null); lv.bodies.forEach((b, i) => { if (b.kind === "fertile") { const P = sim.bodyPos(lv.bodies, i, T); best = Math.min(best, Math.hypot(sd.x - P[0], sd.y - P[1]) - b.r - 6); } }); if (e && sim.TERMINAL[e.type]) break; }
      if (best > 0 && best < 10) nm = [a * Math.PI / 180, pw, best];
    }
    if (nm) { D.shoot(nm[0], nm[1]); let k = 0; while (S.seed && k++ < 3000) D.advance(1); log("near-miss shot clearance~" + nm[2].toFixed(1) + " -> near events " + JSON.stringify(near)); }
    else log("no near-miss shot found");
  } else if (sc === "guides" || sc === "demo") {
    const sol = window.ORCHARD_SOLUTIONS[S.def.id];
    if (sc === "guides") { log("setGuides " + Orchard.setGuides(sol)); D.advance(+(q.get("at") || 30)); }
    else {
      Orchard.playDemo(sol, { speed: +(q.get("speed") || 1) });
      const want = +(q.get("shot") || 0); let n = 0;
      while (n++ < 20000 && !(S.demo && S.demo.i === want && S.seed && (S.seedT - S.T + 0 >= 0) && n > 0 && S.trail.length > +(q.get("trail") || 50))) D.advance(1);
      log("demo shot " + want + " seed screen " + D.toScreen(S.seed.x, S.seed.y).map(Math.round) + " fast=" + S.fast);
    }
    const sh = sol.shots[Math.min(S.used, sol.shots.length - 1)], L = D.toScreen(lv.launch[0], lv.launch[1]), tip = D.toScreen(lv.launch[0] + Math.cos(sh[0]) * 100, lv.launch[1] + Math.sin(sh[0]) * 100);
    log("next guide shot world ang " + sh[0].toFixed(3) + " screen ang " + (Math.atan2(tip[1] - L[1], tip[0] - L[0]) * 180 / Math.PI).toFixed(1) + " rot=" + S.rot);
  } else if (sc === "ff") {
    D.shoot(+(q.get("a") || -0.2), +(q.get("p") || 0.9));
    const ev = (t) => S.canvas.dispatchEvent(new PointerEvent(t, { pointerId: 9, clientX: 300, clientY: 300, bubbles: true, button: 0, isPrimary: true }));
    ev("pointerdown"); D.advance(1); ev("pointerup");
    D.advance(20);
    log("tap -> fast=" + S.fast + " drag=" + !!S.drag + " used=" + S.used + " getState.fast=" + Orchard.getState().fast);
    ev("pointerdown"); D.advance(1); ev("pointerup"); D.advance(2);
    log("tap again -> fast=" + S.fast);
    ev("pointerdown"); D.advance(40); log("holding -> fast=" + S.fast + " flying=" + !!S.seed); ev("pointerup"); D.advance(2); log("hold released -> fast=" + S.fast);
    ev("pointerdown"); D.advance(1); ev("pointerup");
    let n = 0; while (S.seed && n++ < 3000) D.advance(1);
    log("after landing fast=" + S.fast + " tapFast=" + S.tapFast + " drag=" + !!S.drag + " used=" + S.used);
    D.shoot(-0.2, 0.9); ev("pointerdown"); ev("pointerup"); D.advance(15);
  }
});
