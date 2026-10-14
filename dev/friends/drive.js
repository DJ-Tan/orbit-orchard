(function () {
  var q = new URLSearchParams(location.search);
  var embedded = window.parent !== window;
  var K = Math.random().toString(36).slice(2);
  if (!embedded) {
    var img = document.createElement("img");
    img.alt = ""; img.style.cssText = "position:absolute;width:1px;height:1px;opacity:0;pointer-events:none";
    img.src = "/__hold?k=" + K + "&ms=" + (q.get("ms") || 20000);
    document.body.appendChild(img);
  }
  var st = document.createElement("style");
  st.textContent = "*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition:none!important}.panels{scroll-behavior:auto!important}";
  document.head.appendChild(st);
  var log = window.__log;
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var key = function (k) { document.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true })); };
  var waitFor = function (fn, ms) {
    var t0 = Date.now();
    return new Promise(function (res) { (function poll() { var v; try { v = fn(); } catch (e) { v = null; } if (v || Date.now() - t0 > (ms || 4000)) res(v); else setTimeout(poll, 40); })(); });
  };
  window.__drive = { key: key, waitFor: waitFor, sleep: sleep };
  var release = function () { var i = new Image(); i.src = "/__release?k=" + K; };
  if (embedded) return;
  document.addEventListener("DOMContentLoaded", function () {
    (async function () {
      await sleep(60);
      if (q.get("title")) { await sleep(+(q.get("settle") || 400)); release(); return; }
      key("Enter");
      await sleep(40);
      key(q.get("tab") || "9");
      var F = window.OrchardFriends;
      await waitFor(function () { var m = F && F.status().mode; return m && m !== "off" && m !== "connecting"; }, 4000);
      log("mode=" + (F ? F.status().mode : "none") + " tabs=" + document.querySelectorAll(".tab").length + " badge=" + ((document.querySelector("#tab-friends .fr-badge") || {}).textContent || "-"));
      await sleep(250);
      var open = q.get("open");
      if (open === "new") { var b = document.querySelector("[data-f=chal]") || document.querySelector("[data-f=new]"); if (b) b.click(); await sleep(150); var d = document.querySelector(".modal [data-d='4']"); if (d) d.click(); }
      if (open === "hist") { var h = document.querySelectorAll(".fr-hi")[+(q.get("n") || 0)]; if (h) h.click(); }
      if (open === "search") { var i = document.getElementById("frQ"); i.focus(); i.value = q.get("s") || "e"; i.dispatchEvent(new Event("input", { bubbles: true })); }
      if (open === "play") {
        var p = document.querySelector("[data-c=play]"); if (p) p.click();
        await sleep(300); key(" "); await sleep(100);
        var D = window.Orchard._debug;
        for (var n = 0; n < +(q.get("waste") || 1); n++) { D.shoot(Math.PI, 1); D.advance(240); }
        D.state.lv.bodies.forEach(function (bd, j) { if (bd.kind === "fertile") for (var k = 0; k < (bd.need || 1); k++) D.sow(j, 0); });
        D.advance(400);
        await waitFor(function () { return document.querySelector(".fr-result"); }, 4000);
      }
      if (q.get("safe")) { var sb = document.querySelector(".fr-row[data-id=" + q.get("safe") + "] [data-f=safe]"); if (sb) sb.click(); await sleep(300); }
      if (q.get("fb")) {
        var ta = document.getElementById("fbMsg"), FB = window.OrchardFeedback;
        var type = function (m) { ta.value = m; ta.dispatchEvent(new Event("input", { bubbles: true })); };
        var NOTES = ["The sun in Frost Reach 7 hides the last fertile planet behind the HUD on my phone.", "<img src=x onerror=alert(1)> shows up as text, nice.", "Love the Synthwave skin. More trails please!"];
        for (var s = 0; s < (q.get("fb") === "limit" ? 3 : q.get("fb") === "sent" ? 1 : 0); s++) {
          type(NOTES[s]);
          document.querySelector("[data-fb=send]").click();
          await waitFor(function () { return FB.status().flash === "sent" && !FB.status().busy; }, 4000);
          await sleep(50);
        }
        if (q.get("fb") === "draft" || q.get("fb") === "limit") {
          var r = document.querySelector("input[name=fbCat][value=idea]"); r.checked = true; r.dispatchEvent(new Event("change", { bubbles: true }));
          type("A zoom-out button for the big Event Horizon plots would help on small screens.");
          var ib = document.getElementById("fbInfo"); ib.checked = true; ib.dispatchEvent(new Event("change", { bubbles: true }));
        }
        await sleep(200);
        document.getElementById("fbCard").previousElementSibling.scrollIntoView({ block: q.get("fbat") || "start" });
        log("FB " + JSON.stringify(FB.status()) + " st=" + document.getElementById("fbSt").textContent);
      }
      if (q.get("click")) { var cb = document.querySelector("[data-f=" + q.get("click") + "]"); if (cb) cb.click(); await sleep(800); }
      if (q.get("scroll")) { var el = document.querySelector(q.get("scroll")); if (el) el.scrollIntoView({ block: "start" }); }
      await sleep(+(q.get("settle") || 500));
      var ov = Array.from(document.querySelectorAll("body *")).filter(function (e) { var r = e.getBoundingClientRect(); return r.right > innerWidth + 1 && getComputedStyle(e).position !== "fixed" && e.offsetParent; }).length;
      log("h2=" + Array.from(document.querySelectorAll(".modal h2, .fr-absent h3")).map(function (e) { return e.textContent; }).join("|") + " overflowX=" + (document.documentElement.scrollWidth > innerWidth) + " wideEls=" + ov + " errs=" + window.__errs.length);
      release();
    })();
  });
})();
