(function () {
  var q = new URLSearchParams(location.search);
  var K = Math.random().toString(36).slice(2);
  var img = document.createElement("img");
  img.alt = ""; img.style.cssText = "position:absolute;width:1px;height:1px;opacity:0;pointer-events:none";
  img.src = "/__hold?k=" + K + "&ms=" + (q.get("ms") || 30000);
  document.body.appendChild(img);
  var st = document.createElement("style");
  st.textContent = "*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition:none!important}.panels{scroll-behavior:auto!important}" + (q.get("css") || "");
  document.head.appendChild(st);
  var log = window.__log;
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var key = function (k) { document.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true })); };
  var waitFor = function (fn, ms) {
    var t0 = Date.now();
    return new Promise(function (res) { (function poll() { var v; try { v = fn(); } catch (e) { v = null; } if (v || Date.now() - t0 > (ms || 4000)) res(v); else setTimeout(poll, 40); })(); });
  };
  var release = function () { var i = new Image(); i.src = "/__release?k=" + K; };
  var TABS = { journey: 1, daily: 2, zen: 3, almanac: 4, greenhouse: 5, trophies: 6, market: 7, settings: 8, friends: 9 };

  function findLevel(id) {
    var ws = (window.ORCHARD_WORLDS || []).slice().sort(function (a, b) { return (a.order || a.id) - (b.order || b.id); });
    for (var i = 0; i < ws.length; i++) {
      var ls = ws[i].levels.slice().sort(function (a, b) { return a.id < b.id ? -1 : 1; });
      for (var j = 0; j < ls.length; j++) if (ls[j].id === id) return { wi: i, j: j };
    }
    return null;
  }

  async function openLevel(id) {
    var f = findLevel(id);
    key("1");
    await sleep(150);
    var cards = document.querySelectorAll(".wcard");
    if (!f || !cards[f.wi]) { log("no world for " + id); return false; }
    cards[f.wi].click();
    await sleep(150);
    var nodes = document.querySelectorAll(".node");
    if (!nodes[f.j]) { log("no node " + f.j); return false; }
    nodes[f.j].click();
    await sleep(300);
    key(" ");
    await sleep(300);
    return true;
  }

  async function play(mode) {
    var id = q.get("lv") || "w4-07";
    if (!(await openLevel(id))) return;
    var D = Orchard._debug, S = D.state, Sim = window.OrchardSim, DT = Sim.DT;
    var sol = (window.ORCHARD_SOLUTIONS || {})[id];
    if (!sol) { log("no solution " + id); return; }
    Orchard.setPaused(true);
    Orchard.restart();
    Orchard.setPaused(true);
    for (var f = 0; f < +(q.get("pre") || 0); f++) { S.paused = false; D.advance(1, 1 / 60); S.paused = true; }
    var off = S.step;
    var upTo = mode === "win" ? sol.shots.length : +(q.get("n") || 0);
    var stepTo = function (k) { var g = 0; while (S.step < k && g++ < 20000) { S.paused = false; D.advance(1, DT); S.paused = true; } };
    for (var i = 0; i < upTo; i++) {
      stepTo(sol.shots[i][2] + off);
      S.paused = false; D.shoot(sol.shots[i][0], sol.shots[i][1]);
      var g = 0; while (S.seed && g++ < 4000) D.advance(1, DT);
      S.paused = true;
    }
    if (mode === "win") {
      S.paused = false;
      for (var w = 0; w < 400 && !document.querySelector(".modal .rstars"); w++) { D.advance(1, 1 / 60); if (w % 20 === 0) await sleep(10); }
      log("win modal=" + !!document.querySelector(".modal .rstars") + " state=" + JSON.stringify(Orchard.getState()));
      return;
    }
    var sh = sol.shots[upTo];
    stepTo(sh[2] + off + +(q.get("wait") || 0));
    if (q.get("ang")) { S.aim.ang = +q.get("ang"); S.aim.pow = +(q.get("pow") || 0.7); } else { S.aim.ang = sh[0]; S.aim.pow = sh[1]; }
    S.paused = false; D.advance(1, DT);
    if (mode === "flight") {
      var pred = Sim.simulateShot(S.lv, S.aim.ang, S.aim.pow, S.T, 14, S.pollenGot.slice());
      D.shoot();
      D.advance(Math.round(pred.seed.t / DT * +(q.get("frac") || 0.6)), DT);
    }
    S.paused = true;
    D.advance(1, DT);
    log("mode=" + mode + " step=" + S.step + " seed=" + !!S.seed + " pv=" + !!S.pv);
  }

  async function zen() {
    key("3");
    await sleep(150);
    var b = document.querySelector("[data-a=sow]");
    if (b) b.click();
    await sleep(400);
    key(" ");
    await sleep(300);
    var D = Orchard._debug, S = D.state, Sim = window.OrchardSim, DT = Sim.DT;
    D.advance(+(q.get("pre") || 150), 1 / 60);
    var fert = S.lv.bodies.map(function (bd, i) { return bd.kind === "fertile" ? i : -1; }).filter(function (i) { return i >= 0; });
    var goal = fert.length - +(q.get("leave") || 1), done = 0;
    fert.slice(0, goal).forEach(function (t) {
      var hit = null;
      for (var a = 0; a < 360 && !hit; a += 2) for (var pw = 0.2; pw <= 1 && !hit; pw += 0.05) {
        var r = Sim.simulateShot(S.lv, a * Math.PI / 180, pw, S.T, 14, S.pollenGot.slice());
        if (r.end && r.end.type === "plant" && r.end.i === t) hit = [a * Math.PI / 180, pw];
      }
      if (!hit) return;
      D.shoot(hit[0], hit[1]);
      var g = 0; while (S.seed && g++ < 4000) D.advance(1, DT);
      D.advance(30, 1 / 60);
      done++;
    });
    D.advance(120, 1 / 60);
    if (q.get("ang")) { S.aim.ang = +q.get("ang"); S.aim.pow = +(q.get("pow") || 0.6); D.advance(1, DT); }
    Orchard.setPaused(true);
    log("zen fertile=" + fert.length + " planted=" + done + " state=" + JSON.stringify(Orchard.getState()));
  }

  document.addEventListener("DOMContentLoaded", function () {
    (async function () {
      await sleep(80);
      var shot = q.get("shot") || "journey";
      if (shot !== "title") { key("Enter"); await sleep(120); }
      if (TABS[shot]) {
        key(String(TABS[shot]));
        if (shot === "friends") {
          var F = window.OrchardFriends;
          await waitFor(function () { var m = F && F.status().mode; return m && m !== "off" && m !== "connecting"; }, 6000);
          await sleep(800);
        }
        if (q.get("world")) { await sleep(150); var c = document.querySelectorAll(".wcard")[+q.get("world") - 1]; if (c) c.click(); }
      }
      if (shot === "aim" || shot === "flight" || shot === "win") await play(shot);
      if (shot === "zenplay") await zen();
      await sleep(+(q.get("settle") || 700));
      if (q.get("scroll")) { var el = document.querySelector(q.get("scroll")); if (el) el.scrollIntoView({ block: "start" }); }
      if (q.get("top")) { var pn = document.querySelector(q.get("pane") || ".panels"); if (pn) pn.scrollTop += +q.get("top"); }
      await sleep(300);
      var ov = document.documentElement.scrollWidth > innerWidth;
      log("shot=" + shot + " overflowX=" + ov + " toasts=" + document.querySelectorAll(".toast, .ach-toast").length + " errs=" + window.__errs.length);
      release();
    })();
  });
})();
