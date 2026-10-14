(async function () {
  var K = Math.random().toString(36).slice(2);
  var hold = document.createElement("img");
  hold.style.cssText = "position:absolute;width:1px;height:1px;opacity:0";
  hold.src = "/__hold?k=" + K + "&ms=280000";
  document.body.appendChild(hold);
  var out = document.getElementById("res"), n = 0, fails = [], errs = [];
  var log = function (s) { console.log("[t] TRUST " + s); out.textContent += s + "\n"; };
  var ok = function (c, msg) { n++; if (c) log("ok   " + msg); else { fails.push(msg); log("FAIL " + msg); } return c; };
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var waitFor = function (fn, ms) {
    var t0 = Date.now();
    return new Promise(function (res) { (function poll() { var v; try { v = fn(); } catch (e) { v = null; } if (v || Date.now() - t0 > (ms || 9000)) res(v); else setTimeout(poll, 40); })(); });
  };
  var store = function () { return JSON.parse(localStorage.getItem("oo-mock-db") || "{}"); };
  var patch = function (o) { var s = store(); Object.keys(o).forEach(function (k) { if (o[k] == null) delete s[k]; else s[k] = o[k]; }); localStorage.setItem("oo-mock-db", JSON.stringify(s)); };
  var W = {};
  var frame = function (uid, extra) {
    return new Promise(function (res) {
      var f = document.createElement("iframe");
      f.onload = function () { W[uid] = f.contentWindow; res(f.contentWindow); };
      f.src = "preview.html?uid=" + uid + "&embed=1" + (extra || "");
      document.getElementById(uid).appendChild(f);
    });
  };
  var drop = function (uid) { if (W[uid]) errs = errs.concat(W[uid].__errs || []); document.getElementById(uid).innerHTML = ""; W[uid] = null; };
  var $ = function (w, s) { var a = w.document.querySelectorAll(s); return /^\.(fr-new|modal)\b/.test(s) ? a[a.length - 1] || null : a[0] || null; };
  var key = function (w, k) { w.document.dispatchEvent(new w.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true })); };
  var hub = async function (w) {
    await waitFor(function () { return w.OrchardFriends && w.OrchardFriends.status().mode === "ready"; }, 8000);
    key(w, "Enter"); await sleep(60); key(w, "9");
    return waitFor(function () { return $(w, "#frChal"); }, 4000);
  };
  var follow = async function (w, name, id) {
    var q = $(w, "#frQ"), done = function () { var d = store()["data/users/" + w.__mock.uid + "/friends"]; return d && d.f[id] && !d.f[id].del; };
    q.focus(); q.value = name; q.dispatchEvent(new w.Event("input", { bubbles: true }));
    for (var i = 0; i < 4 && !done(); i++) {
      await waitFor(function () { var e = $(w, "[data-add=" + id + "]"); return e && !e.disabled && e.isConnected; }, 3000);
      var b = $(w, "[data-add=" + id + "]");
      if (b) b.click();
      await waitFor(done, 1500);
    }
    return done();
  };
  var row = function (w, id) { return $(w, ".fr-row[data-id=" + id + "]"); };
  var line = function (w, id) { var r = row(w, id); return r ? r.querySelector(".fr-who .muted").textContent : ""; };
  var shown = function (w, id) { var d = $(w, ".fr-row[data-id=" + id + "] .fr-stats dd"); return d ? d.textContent : null; };
  var own = function (w) { var d = $(w, "#frCard .fr-stats dd"); return d ? d.textContent : null; };
  var act = function (w, id, f) { var b = $(w, ".fr-row[data-id=" + id + "] [data-f=" + f + "]"); if (b) b.click(); return !!b; };
  var code = async function (w, id) {
    if (!$(w, ".fr-row[data-id=" + id + "] .fr-code")) act(w, id, "safe");
    return waitFor(function () { var b = $(w, ".fr-row[data-id=" + id + "] .fr-code b"); return b && /^\d{4} \d{4} \d{4}$/.test(b.textContent) && b.textContent; });
  };
  var warn = function (w, id) { var e = $(w, ".fr-row[data-id=" + id + "] .fr-warn"); return e ? e.textContent : ""; };
  var wraps = function (u) { var c = store()["cards/" + u]; return c ? Object.keys(c.w).length : -1; };
  var pin = function (u, id) { var p = store()["data/users/" + u + "/pins"]; return p && p.p[id]; };
  var realX = function (u) { var k = store()["data/users/" + u + "/keys"]; return k && k.jwk.x; };

  try {
    localStorage.setItem("oo-mock-db", "{}");
    var A = await frame("u_alice"), B = await frame("u_bob");
    ok(await hub(A) && await hub(B), "A and B reach the Friends tab");
    $(A, "[data-f=share]").click(); $(B, "[data-f=share]").click();
    await follow(A, "Bob", "u_bob");
    await follow(B, "Alice", "u_alice");
    ok(await waitFor(function () { return shown(A, "u_bob") === own(B) && shown(B, "u_alice") === own(A); }), "mutual cards open on both sides");
    ok(await waitFor(function () { var a = pin("u_alice", "u_bob"), b = pin("u_bob", "u_alice"); return a && b && a.fp.length === 43 && !a.ok; }), "each side pins the other's key on first sight, privately and unverified");

    var cA = await code(A, "u_bob"), cB = await code(B, "u_alice");
    ok(cA && cA === cB, "safety codes match on both screens: A sees " + cA + ", B sees " + cB);
    act(A, "u_bob", "verify");
    ok(await waitFor(function () { var p = pin("u_alice", "u_bob"); return p && p.ok === 1 && $(A, ".fr-row[data-id=u_bob] .fr-ver"); }), "Mark as verified stores the flag and shows the verified badge");

    act(A, "u_bob", "chal");
    await waitFor(function () { return $(A, ".fr-new"); }, 3000);
    $(A, ".fr-new [data-a=blind]").click();
    ok(await waitFor(function () { return $(B, "[data-c=play]"); }), "A sends B a challenge before the swap");

    var O = await frame("u_own", "&level=owner"), dbO = await O.claude.use("db"), fake = await A.OrchardFriends.cx.gen(), bobX = realX("u_bob");
    drop("u_bob");
    await dbO.doc("keys/u_bob").set({ u: "u_bob", x: fake.x, y: fake.y, at: Date.now() });
    ok(store()["keys/u_bob"].x === fake.x, "the owner can overwrite keys/u_bob");
    ok(await waitFor(function () { return /Their key changed since you verified them/.test(warn(A, "u_bob")) && /paused/.test(line(A, "u_bob")) && !shown(A, "u_bob") && !$(A, ".fr-row[data-id=u_bob] .fr-ver"); }), "A warns: '" + warn(A, "u_bob") + "', no stats, no badge");
    ok(await waitFor(function () { return wraps("u_alice") === 0; }), "A stops encrypting its card to the swapped key (0 wraps)");
    ok(await waitFor(function () { var w = store()["chal/u_alice"]; return !w || !Object.keys(w.out).length; }), "A stops encrypting its challenges to the swapped key");
    ok($(A, ".fr-row[data-id=u_bob] [data-f=chal]").disabled && /You challenged Bob Fern/.test($(A, "#frChal").textContent), "challenging B is paused, and A's own open challenge still shows from its private history");

    act(A, "u_bob", "accept");
    ok(await waitFor(function () { var p = pin("u_alice", "u_bob"); return wraps("u_alice") === 1 && p && !p.ok && !warn(A, "u_bob") && !$(A, ".fr-row[data-id=u_bob] .fr-ver"); }), "accepting re-pins the key, clears the verified flag and resumes sharing (1 wrap)");
    ok(await waitFor(function () { var w = store()["chal/u_alice"]; return w && Object.keys(w.out).length === 1; }), "challenges to B are sealed again after accepting");

    B = await frame("u_bob");
    await hub(B);
    ok(await waitFor(function () { return store()["keys/u_bob"].x === bobX && realX("u_bob") === bobX; }), "B restores its own published key on load");
    ok(await waitFor(function () { return /replaced by someone else and has been restored/.test(($(B, "#frNote") || {}).textContent || ""); }), "B shows: '" + (($(B, "#frNote") || {}).textContent || "").trim() + "'");
    ok(await waitFor(function () { return /Their key changed\./.test(warn(A, "u_bob")) && !/since you verified/.test(warn(A, "u_bob")); }), "A sees the key change back, now without the 'verified' note");
    act(A, "u_bob", "accept");
    ok(await waitFor(function () { return shown(A, "u_bob") === own(B) && shown(B, "u_alice") === own(A); }, 12000), "after A accepts B's real key, both cards open again");
    var cA2 = await code(A, "u_bob"), cB2 = await code(B, "u_alice");
    ok(cA2 && cA2 === cB2 && cA2 === cA, "the safety codes match again and equal the first ones (" + cA2 + ")");

    $(B, "[data-f=notehide]").click();
    await dbO.doc("keys/u_bob").set({ u: "u_bob", x: fake.x, y: fake.y, at: Date.now() });
    ok(await waitFor(function () { return store()["keys/u_bob"].x === bobX && $(B, "#frNote .fr-notice"); }, 6000), "a swap while B is online is undone at once and the notice shows again");
    ok(await waitFor(function () { return !warn(A, "u_bob") && shown(A, "u_bob") === own(B); }), "A ends up trusting B's real key with no action needed");

    var C = await frame("u_cara");
    await hub(C);
    await waitFor(function () { return store()["keys/u_cara"]; });
    await follow(A, "Cara", "u_cara");
    var t0 = Date.now(), fast = await waitFor(function () { return wraps("u_alice") === 2; }, 3000), ms = Date.now() - t0;
    ok(fast && ms < 2500, "a new follow re-wraps A's card promptly (" + ms + " ms)");

    var dk = await A.OrchardFriends.cx.gen();
    patch({ "keys/u_dev": { u: "u_dev", x: dk.x, y: dk.y, at: Date.now() } });
    await follow(A, "Dev", "u_dev");
    drop("u_alice");
    var mid = wraps("u_alice");
    A = await frame("u_alice");
    await hub(A);
    ok(await waitFor(function () { return wraps("u_alice") === 3; }, 5000), "a reload right after following survives: the card gets the new wrap (" + mid + " before the reload, 3 after)");

    var all = errs.concat.apply(errs, ["u_alice", "u_bob", "u_cara", "u_own"].map(function (u) { return W[u] ? W[u].__errs || [] : []; }));
    ok(all.length === 0, "no console errors in any frame" + (all.length ? ": " + all.join(" | ") : ""));
  } catch (e) {
    ok(false, "exception " + (e && e.stack || e));
  }
  log((fails.length ? "FAIL " + fails.length + " of " + n : "PASS " + n + " checks"));
  await sleep(400);
  var r = new Image(); r.src = "/__release?k=" + K;
})();
