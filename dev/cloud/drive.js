document.addEventListener("DOMContentLoaded", () => {
  const q = new URLSearchParams(location.search);
  const st = document.createElement("style"); st.textContent = "*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition:none!important}.panels{scroll-behavior:auto!important}"; document.head.appendChild(st);
  const key = (k) => document.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
  const log = (s) => { const d = document.getElementById("dev-log") || Object.assign(document.body.appendChild(document.createElement("pre")), { id: "dev-log" }); d.style.cssText = "position:fixed;left:0;bottom:0;z-index:9999;background:#000d;color:#0f0;font:11px monospace;margin:0;padding:4px;max-width:60vw;white-space:pre-wrap"; d.textContent += s + "\n"; console.log("[t] " + s); };
  if (q.get("tscale")) { const f = +q.get("tscale"), st0 = window.setTimeout; window.setTimeout = (fn, ms, ...a) => st0(fn, (ms || 0) * f, ...a); }
  if (q.get("nolog")) st.textContent += "#dev-log{display:none!important}";
  if (q.get("title")) return;
  key("Enter");
  if (q.get("tab")) key(q.get("tab"));
  const report = () => {
    const doc = window.__mock.store["data/users/u_test/save"];
    if (!doc) { log("no remote doc; writes=" + window.__mock.writes.length); return; }
    log("writes=" + window.__mock.writes.length + " levels=" + Object.keys(doc.levels).length + " devices=" + Object.keys(doc.stats).join(",") + " sown=" + JSON.stringify(Object.keys(doc.stats).map((d) => doc.stats[d].sown)) + " balance=" + OrchardCloud.balance(doc.wallet) + " skin=" + doc.settings.skin + " trail=" + doc.settings.trail);
  };
  Promise.resolve().then(() => Promise.resolve()).then(() => new Promise((r) => setTimeout(r, 30))).then(report);
  const scrollTo = () => { const el = document.querySelector(q.get("scroll")); if (el) el.scrollIntoView({ block: "start" }); };
  if (q.get("scroll")) { scrollTo(); setTimeout(scrollTo, 40); }
  if (q.get("act") === "continue") setTimeout(() => { const b = document.querySelector("[data-a=continue]"); log("continue=" + (b && b.textContent.trim())); if (b) b.click(); log("screen=" + (document.querySelector(".screen:not([hidden])") || {}).id + " level=" + Orchard.getState().levelId + " h2=" + (document.querySelector(".modal h2") || {}).textContent); }, 40);
  if (q.get("act") === "toast") {
    setTimeout(() => {
      document.querySelectorAll(".wcard")[0].click(); document.querySelectorAll(".node")[0].click(); key(" ");
      const D = Orchard._debug;
      for (let i = 0; i < +(q.get("n") || 4); i++) { D.shoot(Math.PI, 1); D.advance(240); }
      const ts = Array.from(document.querySelectorAll(".gtoast")).map((t) => t.textContent);
      log("toasts=" + JSON.stringify(ts));
    }, 40);
  }
  if (q.get("act") === "ff") setTimeout(() => { document.querySelector("[data-set=fastForward]").click(); log("ff engine=" + Orchard.getSettings().fastForward + " saved=" + JSON.parse(localStorage.getItem("orbit-orchard-v2") || "{}").settings); setTimeout(() => log("ff saved=" + JSON.parse(localStorage.getItem("orbit-orchard-v2")).settings.fastForward + " wire=" + JSON.stringify(OrchardCloud.toWire(JSON.parse(localStorage.getItem("orbit-orchard-v2"))).settings)), 600); }, 40);
  if (q.get("act") === "replants") {
    setTimeout(() => {
      const D = Orchard._debug, l = +(q.get("l") || 5) - 1;
      document.querySelectorAll(".wcard")[0].click(); document.querySelectorAll(".node")[l].click(); key(" ");
      D.shoot(Math.PI, 1); D.advance(30); document.getElementById("hRestart").click(); D.advance(30);
      if (!q.get("once")) { D.shoot(Math.PI, 1); D.advance(30); key("r"); D.advance(30); }
      key("Escape"); document.querySelector(".modal [data-a=quit]").click();
      document.querySelectorAll(".node")[l].click();
      log("oracle rows after replants=" + document.querySelectorAll(".modal.intro .oracle-row").length);
    }, 40);
  }
  if (q.get("act") === "dailywin") {
    setTimeout(() => {
      key("2");
      document.querySelector("[data-a=play]").click(); key(" ");
      const D = Orchard._debug, S = D.state;
      D.shoot(Math.PI, 1); D.advance(240);
      if (q.get("miss")) { D.shoot(Math.PI, 1); D.advance(240); }
      S.lv.bodies.forEach((b, i) => { if (b.kind === "fertile") for (let k = 0; k < (b.need || 1); k++) D.sow(i, 0); });
      D.advance(400);
      const day = () => JSON.stringify(JSON.parse(localStorage.getItem("orbit-orchard-v2")).daily.days);
      setTimeout(() => {
        log("h2=" + (document.querySelector(".modal h2") || {}).textContent + " days=" + day());
        log("share=" + JSON.stringify((document.getElementById("dShare") || {}).value));
        if (!q.get("again")) return;
        document.querySelector(".modal [data-a=again]").click();
        D.advance(30);
        for (let m = 0; m < (q.get("again") === "worse" ? 3 : 1); m++) { D.shoot(Math.PI, 1); D.advance(240); }
        Orchard._debug.state.lv.bodies.forEach((b, i) => { if (b.kind === "fertile") for (let k = 0; k < (b.need || 1); k++) D.sow(i, 0); });
        D.advance(400);
        setTimeout(() => {
          log("replay h2=" + (document.querySelector(".modal h2") || {}).textContent + " days=" + day() + " line=" + Array.from(document.querySelectorAll(".modal p")).map((x) => x.textContent).join("|") + " best=" + (document.querySelector(".modal .newbest") || {}).textContent + " tags=" + Array.from(document.querySelectorAll(".modal .rtag")).map((t) => t.textContent + "/" + getComputedStyle(t).color + "/" + getComputedStyle(t).opacity + "/" + t.getBoundingClientRect().width).join(","));
          if (q.get("menu")) { document.querySelector(".modal [data-a=quit]").click(); }
        }, 1500);
      }, 1500);
    }, 40);
  }
  if (q.get("act") === "zenwin") {
    setTimeout(() => {
      key("3");
      if (q.get("diff")) { const r = document.getElementById("zenDiff"); r.value = q.get("diff"); r.dispatchEvent(new Event("input", { bubbles: true })); }
      document.querySelector("[data-a=sow]").click(); key(" ");
      const D = Orchard._debug, n = +(q.get("n") || 1);
      let i = 0;
      const one = () => {
        D.state.lv.bodies.forEach((b, j) => { if (b.kind === "fertile") for (let k = 0; k < (b.need || 1); k++) D.sow(j, 0); });
        D.advance(400);
        i++;
        const ks = Object.keys(JSON.parse(localStorage.getItem("orbit-orchard-v2")).wallet.earn).filter((k) => k.indexOf("zen:") === 0);
        log("zen " + i + ": h2=" + (document.querySelector(".modal h2") || {}).textContent + " gain=" + ((document.querySelector(".modal .nectar-gain") || {}).textContent || (document.querySelector(".modal p.small") || {}).textContent || "-") + " keys=" + ks.join(",") + " zen=" + JSON.stringify(ks.map((k) => JSON.parse(localStorage.getItem("orbit-orchard-v2")).wallet.earn[k])));
        if (i < n) { document.querySelector(".modal [data-a=new]").click(); key(" "); one(); }
        else if (q.get("menu")) document.querySelector(".modal [data-a=quit]").click();
      };
      one();
    }, 40);
  }
  if (q.get("act") === "fert") {
    setTimeout(() => {
      key("5");
      const b = document.querySelector('[data-fert="' + (q.get("plant") || "daisy") + '"]');
      log("fert button=" + (b && b.textContent.trim()));
      if (!b) return;
      b.click();
      if (q.get("buy")) { document.querySelector(".modal.buy [data-a=yes]").click(); log("spend=" + Object.keys(JSON.parse(localStorage.getItem("orbit-orchard-v2")).wallet.spend).join(",")); }
    }, 40);
  }
  if (q.get("act") === "import") {
    setTimeout(() => {
      const wire = OrchardCloud.toWire(JSON.parse(localStorage.getItem("orbit-orchard-v2")));
      wire.wallet = { earn: { "zen:20261012:1": 4, "zen:20261012:9": 4, "zen:20261012:2": 99, "clear:w1-01": 10 }, spend: { "decor:chime": 90, "badge:1": 120, "fert:daisy:1": 110, "hack:x": 5 }, frost: {} };
      const file = new File([JSON.stringify({ format: "orbit-orchard-save", version: 2, save: wire })], "s.json", { type: "application/json" });
      key("8");
      const inp = document.querySelector("[data-c=file]");
      const dt = new DataTransfer(); dt.items.add(file); inp.files = dt.files;
      inp.dispatchEvent(new Event("change", { bubbles: true }));
      setTimeout(() => { const w = JSON.parse(localStorage.getItem("orbit-orchard-v2")).wallet; log("earn=" + Object.keys(w.earn).filter((k) => /zen|clear:w1-01/.test(k)).join(",") + " spend=" + Object.keys(w.spend).join(",")); }, 300);
    }, 40);
  }
  if (q.get("act") === "unlocks") {
    setTimeout(() => {
      const cards = Array.from(document.querySelectorAll(".wcard"));
      log("worlds=" + cards.map((c) => c.querySelector(".wnum").textContent + ":" + c.querySelector(".wn").textContent + ":" + (c.classList.contains("locked") ? "locked" : "open")).join(", "));
      log("continue=" + ((document.querySelector("[data-a=continue]") || {}).textContent || "").trim().replace(/\s+/g, " "));
      const sv = JSON.parse(localStorage.getItem("orbit-orchard-v2"));
      log("announced=" + Object.keys(sv.announced || {}).sort().join(",") + " wo=" + (sv.sync && sv.sync.wo) + " levels=" + Object.keys(sv.levels).length + " oracle=" + Object.keys(sv.wallet.spend).filter((k) => k.indexOf("oracle:") === 0).join(","));
      const f = cards.find((c) => /Fold/.test(c.textContent));
      if (!f) return;
      f.click();
      const n = Array.from(document.querySelectorAll(".node"));
      if (!n.length) log("no plots shown; modals=" + Array.from(document.querySelectorAll(".modal h2")).map((h) => h.textContent).join("|") + " h2=" + ((document.querySelector(".panel h2, #panels h2") || {}).textContent || ""));
      log("fold plots open=" + n.filter((x) => !x.classList.contains("locked")).length + "/" + n.length + " cleared=" + n.filter((x) => x.classList.contains("clear")).length + " current=" + ((document.querySelector(".node.current") || {}).dataset || {}).j);
    }, +(q.get("wait") || 600));
  }
  if (q.get("act") === "level") {
    setTimeout(() => { const cards = document.querySelectorAll(".wcard"); cards[0].click(); document.querySelectorAll(".node")[q.get("l") ? +q.get("l") - 1 : 11].click(); if (q.get("pause")) { key(" "); if (q.get("guides")) Orchard.setGuides(window.ORCHARD_SOLUTIONS[Orchard.getState().levelId]); key("Escape"); } }, 40);
  }
  const flow = q.get("flow");
  if (flow) {
    const D = () => Orchard._debug;
    if (q.get("instant")) { const pd = Orchard.playDemo; Orchard.playDemo = (sol, o) => pd(sol, Object.assign({}, o, { instant: true })); }
    const clickSel = (sel) => { const b = document.querySelector(sel); if (!b) log("missing " + sel); else b.click(); };
    setTimeout(() => {
      document.querySelectorAll(".wcard")[(+q.get("w") || 1) - 1].click();
      document.querySelectorAll(".node")[(+q.get("l") || 5) - 1].click();
      if (flow === "intro") return;
      if (flow === "stage") {
        key(" ");
        for (let i = 0; i < (+q.get("ff") || 0); i++) clickSel("#hFast");
        const b = document.getElementById("hFast"), st = JSON.parse(localStorage.getItem("orbit-orchard-v2")).settings;
        D().shoot(-Math.PI / 2, 0.6);
        log("ff pressed=" + (b && b.getAttribute("aria-pressed")) + " engine=" + D().state.settings.fastForward + " btns=" + document.querySelectorAll(".hud-btns .btn:not([hidden])").length);
        return;
      }
      if (flow === "gwin") {
        key(" ");
        const id = Orchard.getState().levelId, sol = window.ORCHARD_SOLUTIONS[id];
        if (!q.get("plain")) Orchard.setGuides(sol);
        sol.shots.forEach((sh) => { for (let i = 0; i < 2000 && (D().state.seed || Orchard.getState().step < sh[2]); i++) D().advance(1, 1 / 120); if (!Orchard.snapToGuide()) { D().state.aim.ang = sh[0]; D().state.aim.pow = sh[1]; } D().shoot(); });
        D().advance(1200);
        log("h2=" + (document.querySelector(".modal h2") || {}).textContent);
        return;
      }
      if (flow === "win") {
        key(" ");
        const S = D().state, id = Orchard.getState().levelId, sol = window.ORCHARD_SOLUTIONS[id];
        for (let i = 0; i < (+q.get("miss") || 0); i++) { D().shoot(-Math.PI * 0.5, 1); D().advance(900); }
        sol.shots.forEach((sh) => { D().shoot(sh[0], sh[1]); D().advance(900); });
        D().advance(400);
        setTimeout(() => console.log("[t] used=" + Orchard.getState().used + " h2=" + (document.querySelector(".modal h2") || {}).textContent + " stars=" + JSON.stringify(JSON.parse(localStorage.getItem("orbit-orchard-v2")).levels[id])), 1500);
        return;
      }
      if (flow === "lose") {
        key(" ");
        const S = D().state;
        for (let i = 0; i < 12 && S.phase !== "lose" && S.phase !== "lost"; i++) { D().shoot(Math.PI * 0.5, 1); D().advance(900); }
        D().advance(200);
        log("phase=" + S.phase);
        if (q.get("revive")) {
          (() => {
            clickSel(".modal [data-a=seed]");
            log("after revive phase=" + S.phase + " modals=" + document.querySelectorAll(".modal").length + " chip=" + (document.querySelector(".chip.nectar b") || {}).textContent + " spent=" + Object.keys(JSON.parse(localStorage.getItem("orbit-orchard-v2")).wallet.spend).join(","));
            D().advance(30);
            log("phase later=" + S.phase + " input=" + S.inputEnabled);
          })();
        }
        return;
      }
      if (!document.querySelector(".modal.intro [data-o]")) { key(" "); key("Escape"); }
      clickSel(q.get("kind") === "glimpse" ? "[data-o=glimpse]" : "[data-o=full]");
      if (flow === "buymodal") return;
      clickSel(".modal.buy [data-a=yes]");
      log("demo=" + Orchard.isDemo() + " bar=" + !document.getElementById("demoBar").hidden);
      if (q.get("adv")) { D().advance(+q.get("adv")); log("advanced to step " + Orchard.getState().step + " flying=" + Orchard.getState().flying); }
      if (flow === "demo") return;
      setTimeout(() => {
        log("modal=" + (document.querySelector(".modal h2") || {}).textContent);
        if (flow === "done") return;
        clickSel(".modal [data-a=guides]");
        D().advance(60);
        log("guides=" + Orchard.getState().guides + " btn=" + !document.getElementById("hGuide").hidden + " snap=" + Orchard.snapToGuide());
        if (flow !== "guidedwin" && flow !== "unguided") return;
        const id = Orchard.getState().levelId, sol = window.ORCHARD_SOLUTIONS[id];
        const play = () => { sol.shots.forEach((sh) => { for (let i = 0; i < 2000 && (D().state.seed || Orchard.getState().step < sh[2]); i++) D().advance(1, 1 / 120); if (q.get("snap") && Orchard.snapToGuide()) D().shoot(); else D().shoot(sh[0], sh[1]); }); D().advance(1200); };
        const rec = () => JSON.stringify(JSON.parse(localStorage.getItem("orbit-orchard-v2")).levels[id] || null);
        const earned = () => Object.keys(JSON.parse(localStorage.getItem("orbit-orchard-v2")).wallet.earn).filter((k) => k.indexOf(id) > 0).join(",");
        play();
        setTimeout(() => {
          log("guided win: h2=" + (document.querySelector(".modal h2") || {}).textContent + " stars=" + document.querySelectorAll("#rstars svg.on").length + " rec=" + rec() + " earn=" + earned() + " line=" + (Array.from(document.querySelectorAll(".modal p")).map((x) => x.textContent).pop()));
          if (flow !== "unguided") return;
          clickSel(".modal [data-a=again]");
          D().advance(60);
          log("after replant guides=" + Orchard.getState().guides);
          play();
          setTimeout(() => log("unguided win: h2=" + (document.querySelector(".modal h2") || {}).textContent + " rec=" + rec() + " earn=" + earned()), 1500);
        }, 1500);
      }, 1300);
    }, 40);
  }
  if (q.get("probe")) setTimeout(() => log("probe " + q.get("probe") + " = " + document.querySelectorAll(q.get("probe")).length + " " + JSON.stringify(Array.from(document.querySelectorAll(q.get("probe"))).map((e) => e.textContent.trim().slice(0, 60)))), 300);
  if (q.get("act") === "world") setTimeout(() => { document.querySelectorAll(".wcard")[0].click(); if (q.get("plate")) { const n = document.querySelectorAll(".node")[+q.get("plate") - 1]; n.dispatchEvent(new PointerEvent("pointerover", { bubbles: true })); if (q.get("scroll")) document.querySelector(q.get("scroll")).scrollIntoView({ block: "start" }); } }, 40);
  if (q.get("act") === "buy") {
    setTimeout(() => { const b = document.querySelector('[data-trail="' + (q.get("trail") || "comet") + '"]'); if (b) b.click(); }, 40);
  }
});
