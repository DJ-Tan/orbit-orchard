(async function () {
  var K = Math.random().toString(36).slice(2);
  var hold = document.createElement("img");
  hold.style.cssText = "position:absolute;width:1px;height:1px;opacity:0";
  hold.src = "/__hold?k=" + K + "&ms=280000";
  document.body.appendChild(hold);
  var out = document.getElementById("res"), n = 0, fails = [], errs = [];
  var log = function (s) { console.log("[t] CARDS " + s); out.textContent += s + "\n"; };
  var ok = function (c, msg) { n++; if (c) log("ok   " + msg); else { fails.push(msg); log("FAIL " + msg); } return c; };
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var waitFor = function (fn, ms) {
    var t0 = Date.now();
    return new Promise(function (res) { (function poll() { var v; try { v = fn(); } catch (e) { v = null; } if (v || Date.now() - t0 > (ms || 9000)) res(v); else setTimeout(poll, 50); })(); });
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
  var $ = function (w, s) { var a = w.document.querySelectorAll(s); return /^\.modal\b/.test(s) ? a[a.length - 1] || null : a[0] || null; };
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
      await sleep(150);
      var b = await waitFor(function () { var e = $(w, "[data-add=" + id + "]"); return e && !e.disabled && e.isConnected && e; }, 3000);
      if (b) b.click();
      await waitFor(done, 1500);
    }
    return done();
  };
  var row = function (w, id) { return $(w, ".fr-row[data-id=" + id + "]"); };
  var line = function (w, id) { var r = row(w, id); return r ? r.querySelector(".fr-who .muted").textContent : ""; };
  var shown = function (w, id) { var d = $(w, ".fr-row[data-id=" + id + "] .fr-stats dd"); return d ? d.textContent : null; };
  var own = function (w) { var d = $(w, "#frCard .fr-stats dd"); return d ? d.textContent : null; };
  var dump = function (uid) {
    var w = W[uid], F = w && w.OrchardFriends._state;
    if (!F) return;
    log("  " + uid + " follows=" + JSON.stringify(Object.keys(F.fr.f).filter(function (k) { return !F.fr.f[k].del; })) + " keysWait=" + F.keysWait + " pubs=" + Object.keys(F.pubs) + " card=" + JSON.stringify({ to: F.card.to, exists: F.card.exists, timer: !!F.card.timer, busy: F.card.busy, at: F.card.at }) + " cards=" + JSON.stringify(Object.keys(F.cards).map(function (k) { return k + ":" + F.cards[k].st; })) + " key=" + !!F.key + " mode=" + w.OrchardFriends.status().mode);
  };
  var LOCK = /Hasn't added you back/, NONE = /Not sharing their progress/;
  var v1 = function (id) { return { v: 1, u: id, day: "20261011", stars: 500, cleared: 99, worlds: 3, golden: 9, streak: 4, best: 4, trophies: 2, tiers: {}, ws: [], wc: [] }; };

  try {
    localStorage.setItem("oo-mock-db", "{}");
    var A = await frame("u_alice"), B = await frame("u_bob"), C = await frame("u_cara");
    ok(await hub(A) && await hub(B) && await hub(C), "A, B and C reach the Friends tab as Contributors");
    ok(await waitFor(function () { var s = store(); return ["u_alice", "u_bob", "u_cara"].every(function (u) { return s["keys/" + u] && s["data/users/" + u + "/keys"]; }); }), "each player has a private key doc and a published public key");
    var s0 = store();
    ok(Object.keys(s0["keys/u_bob"]).sort().join() === "at,u,x,y" && !s0["keys/u_bob"].d && s0["data/users/u_bob/keys"].jwk.d, "keys/<id> carries only the public half; d stays in the private doc");

    [A, B, C].forEach(function (w) { $(w, "[data-f=share]").click(); });
    ok(await waitFor(function () { var s = store(); return ["u_alice", "u_bob", "u_cara"].every(function (u) { return s["cards/" + u] && s["cards/" + u].v === 2; }); }), "all three share a v2 card");
    await follow(A, "Bob", "u_bob");
    await follow(B, "Alice", "u_alice");
    await follow(C, "Bob", "u_bob");

    ok(await waitFor(function () { return shown(A, "u_bob") && shown(A, "u_bob") === own(B); }), "mutual: A reads B's card (stars " + shown(A, "u_bob") + " = B's " + own(B) + ")");
    ok(await waitFor(function () { return shown(B, "u_alice") && shown(B, "u_alice") === own(A); }), "mutual: B reads A's card (stars " + shown(B, "u_alice") + " = A's " + own(A) + ")");
    ok(/Shared with 1 person you follow/.test($(B, "#frCard").textContent), "B's status line says who can see it: " + $(B, "#frCard .fr-who .muted").textContent);

    ok(await waitFor(function () { return LOCK.test(line(C, "u_bob")) && !shown(C, "u_bob"); }), "one-way: C follows B, B doesn't follow C, so C sees '" + line(C, "u_bob") + "' and no stats");

    var X = A.OrchardFriends.cx, raw = (await (await C.claude.use("db")).doc("cards/u_bob").get()).data(), txt = JSON.stringify(raw);
    var pubB = (await (await C.claude.use("db")).doc("keys/u_bob").get()).data();
    ok(Object.keys(raw).sort().join() === "at,u,v,w" && Object.keys(raw.w).length === 1, "C can read the raw cards/u_bob doc: keys " + Object.keys(raw).join(",") + ", " + Object.keys(raw.w).length + " wrap");
    var wrapsOk = Object.keys(raw.w).every(function (t) { var e = raw.w[t]; return Object.keys(e).sort().join() === "ct,iv" && /^[\w-]{16}$/.test(t) && /^[\w-]+$/.test(e.ct) && /^[\w-]{16}$/.test(e.iv); });
    ok(wrapsOk && !/"(stars|cleared|worlds|golden|streak|trophies|nectar|day|tiers)"/.test(txt) && (txt.match(/"u_[a-z]+"/g) || []).join() === '"u_bob"', "the raw doc has only opaque wraps, no plaintext stats and no user id besides u");
    var kC = C.OrchardFriends._state.key, pC = await X.pair(kC, pubB), cIn = await X.side(pC, "", "u_bob", "u_cara"), cOut = await X.side(pC, "", "u_cara", "u_bob"), tries = 0, opened = 0;
    var aadOf = A.OrchardFriends.aadOf;
    for (var t in raw.w) {
      for (var k of [cIn.key, cOut.key]) for (var aad of [["u_bob", "u_cara"], ["u_bob", "u_alice"], ["u_cara", "u_bob"]]) { tries++; if (await X.open(k, raw.w[t], aadOf(aad[0], aad[1]))) opened++; }
    }
    ok(!raw.w[cIn.tag] && tries === 6 && opened === 0, "C has no wrap and can't decrypt B's wrap with its own keys (" + opened + " of " + tries + " attempts opened)");
    var kA = A.OrchardFriends._state.key, aIn = await X.side(await X.pair(kA, pubB), "", "u_bob", "u_alice"), bodyA = await X.open(aIn.key, raw.w[aIn.tag], aadOf("u_bob", "u_alice"));
    ok(bodyA && String(bodyA.stars) === own(B), "control: A's pair key opens the same wrap (stars " + (bodyA && bodyA.stars) + ")");
    ok(!(await X.open(aIn.key, raw.w[aIn.tag], aadOf("u_mallory", "u_alice"))), "the wrap is bound to sender and recipient, so it won't open under another sender id");

    $(B, ".fr-row[data-id=u_alice] [data-f=rm]").click();
    await waitFor(function () { return $(B, ".modal [data-a=yes]"); }, 3000);
    $(B, ".modal [data-a=yes]").click();
    ok(await waitFor(function () { var c = store()["cards/u_bob"]; return c && c.v === 2 && !Object.keys(c.w).length; }), "B unfollows A and B's next sync drops A's wrap");
    ok(await waitFor(function () { return LOCK.test(line(A, "u_bob")) && !shown(A, "u_bob"); }), "A loses access: '" + line(A, "u_bob") + "'");
    await follow(B, "Alice", "u_alice");
    ok(await waitFor(function () { return shown(A, "u_bob") === own(B); }), "B follows A again and A reads B's card again");

    var oldPub = store()["keys/u_bob"], fake = await X.gen();
    drop("u_bob");
    patch({ "data/users/u_bob/keys": null, "keys/u_bob": { u: "u_bob", x: fake.x, y: fake.y, at: Date.now() } });
    ok(await waitFor(function () { return /paused/.test(line(A, "u_bob")) && /Their key changed/.test(row(A, "u_bob").textContent) && !shown(A, "u_bob"); }), "B's key changed: A shows '" + line(A, "u_bob") + "' with a key-change warning and no stale stats");
    ok(A.OrchardFriends.status().mode === "ready" && !(A.__errs || []).length, "nothing breaks in A while B's card can't be opened");
    B = await frame("u_bob");
    await hub(B);
    ok(await waitFor(function () { var k = store()["data/users/u_bob/keys"], p = store()["keys/u_bob"]; return k && p && p.x === k.jwk.x && p.x !== oldPub.x && p.x !== fake.x; }), "B made a new key pair and republished its public key");
    ok(await waitFor(function () { return row(A, "u_bob").querySelector("[data-f=accept]"); }), "A is asked to accept B's new key");
    row(A, "u_bob").querySelector("[data-f=accept]").click();
    ok(await waitFor(function () { return shown(A, "u_bob") === own(B); }, 12000), "after A accepts and both sync, A reads B's card again");
    ok(await waitFor(function () { return shown(B, "u_alice") === own(A); }, 12000), "after both sync, B reads A's card again (A re-wrapped for B's new key)");

    $(B, "[data-f=share]").click();
    ok(await waitFor(function () { return !store()["cards/u_bob"]; }), "B switches sharing off and the card is deleted");
    ok(await waitFor(function () { return NONE.test(line(A, "u_bob")) && !shown(A, "u_bob"); }), "A now sees '" + line(A, "u_bob") + "'");

    var ek = await X.gen();
    patch({ "keys/u_eve": { u: "u_eve", x: ek.x, y: ek.y, at: Date.now() }, "cards/u_eve": v1("u_eve") });
    await follow(A, "Eve", "u_eve");
    var tEve = Date.now(), wrapped = await waitFor(function () { return Object.keys(store()["cards/u_alice"].w).length === 2; }, 3000);
    ok(wrapped, "following Eve, who has a key, re-wraps A's card promptly (" + (Date.now() - tEve) + " ms after the follow was saved)");
    ok(await waitFor(function () { return NONE.test(line(A, "u_eve")) && !shown(A, "u_eve"); }), "a plaintext v1 card counts as not shared: '" + line(A, "u_eve") + "'");
    await follow(A, "Dev", "u_dev");
    patch({ "cards/u_dev": v1("u_dev") });

    drop("u_cara");
    patch({ "cards/u_cara": v1("u_cara") });
    C = await frame("u_cara");
    await hub(C);
    ok(await waitFor(function () { var c = store()["cards/u_cara"]; return c && c.v === 2 && !/stars/.test(JSON.stringify(c)); }), "C's own v1 card is replaced by a v2 card on load (sharing on)");
    drop("u_cara");
    var fc = store()["data/users/u_cara/friends"];
    fc.share = { on: false, nectar: false, at: Date.now() + 1000 };
    patch({ "cards/u_cara": v1("u_cara"), "data/users/u_cara/friends": fc });
    C = await frame("u_cara");
    await hub(C);
    ok(await waitFor(function () { return !store()["cards/u_cara"]; }), "C's own v1 card is deleted on load (sharing off)");

    patch({ "chal/u_dev": { v: 1, to: ["u_alice"], from: [], out: { dv1aaaaaa1: { to: "u_alice", seed: 424242, diff: 3, at: Date.now(), exp: Date.now() + 864e5 } }, res: {} } });
    var D = await frame("u_dev", "&nocrypto=1");
    ok(await hub(D), "D without WebCrypto still reaches the Friends tab");
    ok(await waitFor(function () { return !store()["cards/u_dev"]; }), "D's leftover plaintext v1 card is deleted");
    ok($(D, "[data-f=share]").disabled && /can't encrypt/.test($(D, "#frCard").textContent), "D's share switch is disabled with a clear status: " + $(D, "#frCard .fr-who .muted").textContent);
    $(D, "[data-f=mkcode]").click();
    ok(await waitFor(function () { var c = store()["codes/u_dev"]; return c && c.c; }), "D can still make a friend code");
    await follow(D, "Alice", "u_alice");
    ok(await waitFor(function () { return /can't open progress cards/.test(line(D, "u_alice")); }), "D's friend row says '" + line(D, "u_alice") + "'");
    ok($(D, "[data-f=new]").disabled && $(D, ".fr-row[data-id=u_alice] [data-f=chal]").disabled && /challenges are off/.test($(D, "#frChal").textContent), "challenges are off without WebCrypto: " + $(D, "#frChal").textContent);
    ok(await waitFor(function () { var p = store()["data/users/u_dev/chal"]; return !store()["chal/u_dev"] && p && p.out.dv1aaaaaa1; }), "D's plaintext v1 challenge doc moves into its private history and the shared copy is deleted");
    ok(!store()["keys/u_dev"] && !store()["data/users/u_dev/keys"], "D publishes no key");

    var atA = store()["cards/u_alice"].at;
    drop("u_alice");
    A = await frame("u_alice");
    await hub(A);
    await waitFor(function () { var c = A.OrchardFriends._state.card; return c.rs != null && !c.timer && !c.busy; });
    ok(store()["cards/u_alice"].at === atA && A.OrchardFriends._state.card.rs != null, "reloading A with an unchanged card verifies it instead of rewriting it");

    var all = errs.concat.apply(errs, ["u_alice", "u_bob", "u_cara", "u_dev"].map(function (u) { return W[u] ? W[u].__errs || [] : []; }));
    ok(all.length === 0, "no console errors in any frame" + (all.length ? ": " + all.join(" | ") : ""));
  } catch (e) {
    ok(false, "exception " + (e && e.stack || e));
  }
  if (fails.length) { ["u_alice", "u_bob", "u_cara", "u_dev"].forEach(dump); var st = store(); log("  cards/u_bob w=" + (st["cards/u_bob"] ? Object.keys(st["cards/u_bob"].w).length : "none")); }
  log((fails.length ? "FAIL " + fails.length + " of " + n : "PASS " + n + " checks"));
  await sleep(400);
  var r = new Image(); r.src = "/__release?k=" + K;
})();
