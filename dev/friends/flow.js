(async function () {
  var K = Math.random().toString(36).slice(2);
  var hold = document.createElement("img");
  hold.style.cssText = "position:absolute;width:1px;height:1px;opacity:0";
  hold.src = "/__hold?k=" + K + "&ms=110000";
  document.body.appendChild(hold);
  var out = document.getElementById("res"), n = 0, fails = [];
  var log = function (s) { console.log("[t] FLOW " + s); out.textContent += s + "\n"; };
  var ok = function (c, msg) { n++; if (c) log("ok   " + msg); else { fails.push(msg); log("FAIL " + msg); } return c; };
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var waitFor = function (fn, ms) {
    var t0 = Date.now();
    return new Promise(function (res) { (function poll() { var v; try { v = fn(); } catch (e) { v = null; } if (v || Date.now() - t0 > (ms || 5000)) res(v); else setTimeout(poll, 40); })(); });
  };
  var store = function () { return JSON.parse(localStorage.getItem("oo-mock-db") || "{}"); };
  var setStore = function (s) { localStorage.setItem("oo-mock-db", JSON.stringify(s)); };
  var frame = function (uid) {
    return new Promise(function (res) {
      var f = document.createElement("iframe");
      f.onload = function () { res(f.contentWindow); };
      f.src = "preview.html?uid=" + uid + "&embed=1";
      document.getElementById(uid).appendChild(f);
    });
  };
  var $ = function (W, s) { var a = W.document.querySelectorAll(s); return /^\.(fr-new|modal|fr-result)\b/.test(s) ? a[a.length - 1] || null : a[0] || null; };
  var $$ = function (W, s) { return Array.from(W.document.querySelectorAll(s)); };
  var click = function (W, s) { var e = typeof s === "string" ? $(W, s) : s; if (!e) { log("missing " + s); return false; } e.click(); return true; };
  var key = function (W, k) { W.document.dispatchEvent(new W.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true })); };
  var title = function (W) { var h = $(W, ".fr-result h2"); return h ? h.textContent : ""; };
  var hub = async function (W) {
    await waitFor(function () { return W.OrchardFriends && W.OrchardFriends.status().mode === "ready"; }, 6000);
    key(W, "Enter"); await sleep(60); key(W, "9");
    return waitFor(function () { return $(W, "#frChal"); }, 3000);
  };
  var winSky = async function (W, waste) {
    await waitFor(function () { return $(W, ".modal.intro"); }, 3000);
    key(W, " "); await sleep(80);
    var D = W.Orchard._debug, def = JSON.stringify(D.state.def);
    for (var i = 0; i < waste; i++) { D.shoot(Math.PI, 1); D.advance(240); }
    D.state.lv.bodies.forEach(function (b, j) { if (b.kind === "fertile") for (var k = 0; k < (b.need || 1); k++) D.sow(j, 0); });
    D.advance(400);
    await waitFor(function () { return $(W, ".fr-result"); }, 5000);
    return def;
  };
  var today = (function () { var d = new Date(); return d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0"); })();

  try {
    setStore({});
    var A = await frame("u_alice");
    ok(await hub(A), "A reaches the Friends tab in ready mode");
    ok($(A, ".fr-empty") && /No friends yet/.test($(A, "#frList").textContent), "A sees the empty friends state");
    ok(!store()["cards/u_alice"], "card is off until enabled");

    click(A, "[data-f=share]");
    var card = await waitFor(function () { return store()["cards/u_alice"]; });
    var chipStars = +$(A, "#hubChips .chip b").textContent;
    ok(card && card.v === 2 && card.u === "u_alice" && Object.keys(card).sort().join() === "at,u,v,w" && !Object.keys(card.w).length && !/stars|nectar|cleared/.test(JSON.stringify(card)), "A's card is an empty v2 envelope with no plaintext: " + JSON.stringify(card));
    ok(+$(A, "#frCard .fr-stats dd").textContent === chipStars, "A's own preview shows stars=" + chipStars);

    var q = $(A, "#frQ"); q.focus(); q.value = "Bob"; q.dispatchEvent(new A.Event("input", { bubbles: true }));
    ok(click(A, await waitFor(function () { return $(A, "[data-add=u_bob]"); })), "search finds Bob");
    var fa = await waitFor(function () { var d = store()["data/users/u_alice/friends"]; return d && d.f.u_bob && d; });
    ok(fa && !fa.f.u_bob.del, "A's private friend list stores Bob's id only: " + JSON.stringify(fa && fa.f));
    ok(await waitFor(function () { return /Needs to open Friends once/.test(($(A, ".fr-row[data-id=u_bob]") || {}).textContent || ""); }), "A sees Bob hasn't opened Friends yet");
    ok($(A, ".fr-row[data-id=u_bob] [data-f=chal]").disabled, "A can't challenge Bob before he has a key");

    click(A, "[data-f=mkcode]");
    var code = await waitFor(function () { var c = store()["codes/u_alice"]; return c && c.c; });
    ok(code && /^[2-9A-HJKMNP-Z]{6}$/.test(code) && $(A, ".fr-mycode b").textContent === code.slice(0, 3) + "-" + code.slice(3), "A made friend code " + code);

    var B = await frame("u_bob");
    ok(await hub(B), "B reaches the Friends tab");
    click(B, "[data-f=share]");
    ok(await waitFor(function () { return store()["cards/u_bob"]; }), "B shares a card");
    $(B, "#frCodeIn").value = code.slice(0, 3).toLowerCase() + " " + code.slice(3);
    click(B, "[data-f=find]");
    ok(await waitFor(function () { var d = store()["data/users/u_bob/friends"]; return d && d.f.u_alice && d.f.u_alice.code === code; }), "B adds A by code (typed lowercase with a space)");
    var bRowA = await waitFor(function () { return $(B, ".fr-row[data-id=u_alice] .fr-stats"); }, 9000);
    ok(bRowA && $(B, ".fr-row[data-id=u_alice] .fr-stats dd").textContent === String(chipStars), "B decrypts A's card with " + chipStars + " stars");
    ok(await waitFor(function () { return $(B, ".fr-row[data-id=u_alice] .fr-worlds .fw"); }), "B sees the per-world ahead/behind comparison");
    ok(await waitFor(function () { return $(A, ".fr-row[data-id=u_bob] .fr-stats"); }), "A sees Bob's card live once he shares");

    click(A, ".fr-row[data-id=u_bob] [data-f=chal]");
    await waitFor(function () { return $(A, ".fr-new"); });
    click(A, ".fr-new [data-d='4']");
    click(A, ".fr-new [data-a=first]");
    var defA = await winSky(A, 2);
    ok(title(A) === "Challenge sent", "A played first; result screen says '" + title(A) + "'");
    var outA = await waitFor(function () { var d = store()["data/users/u_alice/chal"]; return d && Object.keys(d.out).length && d; }), cid = outA && Object.keys(outA.out)[0], ent = cid && outA.out[cid];
    ok(ent && ent.to === "u_bob" && ent.diff === 4 && ent.r && ent.r.used === 2 && ent.exp - ent.at === 7 * 864e5 && outA.to.indexOf("u_bob") >= 0, "challenge doc: " + JSON.stringify(ent));
    var walletA = JSON.parse(localStorage.getItem("orbit-orchard-v2@u_alice")).wallet.earn;
    ok(walletA["chal:" + today + ":1"] === 5, "A earned 5 nectar under chal:" + today + ":1");
    click(A, ".fr-result [data-a=back]");
    await waitFor(function () { return $(A, "#frChal"); });

    ok(await waitFor(function () { var b = $(B, "#tab-friends .fr-badge"); return b && b.textContent === "1"; }), "B's Friends tab shows a badge of 1");
    ok(click(B, await waitFor(function () { return $(B, "[data-c=play]"); })), "B sees the incoming challenge with Play");
    var defB = await winSky(B, 1);
    ok(defA && defA === defB, "B got the identical sky (level JSON " + defA.length + " chars, equal=" + (defA === defB) + ")");
    ok(JSON.stringify(A.Orchard.generateLevel(ent.seed, { difficulty: 4 })) === JSON.stringify(B.Orchard.generateLevel(ent.seed, { difficulty: 4 })), "generateLevel(seed, 4) matches across both players");
    ok(title(B) === "You win", "B's result screen: '" + title(B) + "' (1 seed vs 2)");
    var resB = await waitFor(function () { var d = store()["data/users/u_bob/chal"]; return d && d.res["u_alice~" + cid] && d; });
    ok(resB && resB.res["u_alice~" + cid] && resB.res["u_alice~" + cid].r.used === 1 && resB.from.indexOf("u_alice") >= 0, "B's answer is in B's own private doc");
    ok(store()["data/users/u_alice/chal"].out[cid].r.used === 2, "A's part is unchanged");
    click(B, ".fr-result [data-a=back]");
    ok(await waitFor(function () { return !$(B, "#tab-friends .fr-badge"); }), "B's badge clears after playing");

    var hi = await waitFor(function () { return $$(A, ".fr-hi").find(function (e) { return /They won/.test(e.textContent); }); });
    ok(hi, "A's history shows 'They won' live");
    if (hi) { click(A, hi); await waitFor(function () { return $(A, ".fr-result"); }); }
    ok(title(A) === "Bob Fern wins", "A's result view: '" + title(A) + "'");
    ok($$(A, ".fr-result .fr-vs-p").length === 2 && $(A, ".fr-result .fr-vs-p.win") && /Bob/.test($(A, ".fr-result .fr-vs-p.win").textContent), "result shows both sides with Bob marked winner");
    click(A, ".fr-result [data-a=back]");

    var db = await B.claude.use("db"), rej = function (p) { return p.then(function () { return "allowed"; }, function (e) { return e && e.code; }); };
    ok(await rej(db.doc("chal/u_alice").set({ v: 1, out: {}, res: {} })) === "invalid_argument", "B cannot overwrite A's challenge doc");
    ok(!(await db.doc("data/users/u_alice/chal").get()).exists, "B cannot read A's private challenge history");
    var wa = store()["chal/u_alice"], wb = store()["chal/u_bob"], wt = JSON.stringify([wa, wb]);
    ok(wa && wb && wa.v === 2 && wb.v === 2 && !wa.to && !wa.from && (wt.match(/"u_[a-z]+"/g) || []).join() === '"u_alice","u_bob"' && !/"(seed|used|diff|exp|by|cid)"/.test(wt) && wt.indexOf(String(ent.seed)) < 0, "both shared challenge docs are v2 with no plaintext ids, seeds or results");
    ok(await rej(db.doc("cards/u_alice").delete()) === "invalid_argument", "B cannot delete A's card");
    ok(await rej(db.doc("codes/u_alice").set({ c: "ZZZZZZ", u: "u_alice" })) === "invalid_argument", "B cannot take over A's code doc");
    ok(!(await db.doc("data/users/u_alice/friends").get()).exists, "B cannot read A's private friend list");
    ok((await db.doc("cards/u_alice").get()).exists, "B can read A's shared card doc");
    ok(await rej(db.doc("keys/u_alice").set({ u: "u_alice", x: "x", y: "y" })) === "invalid_argument", "B cannot replace A's public key");
    ok(!(await db.doc("data/users/u_alice/keys").get()).exists, "B cannot read A's private key");
    ok(!/stars|cleared|nectar|u_bob/.test(JSON.stringify(store()["cards/u_alice"])), "A's card doc holds no plaintext stats or follower ids");

    click(A, "[data-f=new]");
    await waitFor(function () { return $(A, ".fr-new"); });
    click(A, ".fr-new [data-d='0']");
    click(A, ".fr-new [data-a=blind]");
    var cid2 = await waitFor(function () { var d = store()["data/users/u_alice/chal"]; return d && Object.keys(d.out).find(function (k) { return k !== cid; }); });
    var e2 = store()["data/users/u_alice/chal"].out[cid2];
    ok(e2 && !e2.r && e2.rnd === 1 && e2.diff >= 1 && e2.diff <= 5, "A sent a blind random-difficulty challenge (diff " + (e2 && e2.diff) + ")");
    ok(await waitFor(function () { return $(B, "[data-c=play]"); }), "B sees the blind challenge");
    var s = store(), now = Date.now();
    s["data/users/u_alice/chal"].out[cid2].at = now - 8 * 864e5; s["data/users/u_alice/chal"].out[cid2].exp = now - 864e5;
    setStore(s);
    ok(await waitFor(function () { return !$(B, "[data-c=play]") && $$(B, ".fr-hi").some(function (e) { return /Expired/.test(e.textContent); }); }), "after expiry B can't play it and history says Expired");
    ok(await waitFor(function () { return $$(A, ".fr-hi").some(function (e) { return /Expired/.test(e.textContent); }); }), "A's history also says Expired");

    click(A, "[data-f=new]");
    await waitFor(function () { return $(A, ".fr-new"); });
    click(A, ".fr-new [data-a=blind]");
    var row = await waitFor(function () { return $(B, "[data-c=decline]"); });
    click(B, row);
    await waitFor(function () { return $(B, ".modal [data-a=yes]"); });
    click(B, ".modal [data-a=yes]");
    ok(await waitFor(function () { var d = store()["data/users/u_bob/chal"]; return d && Object.keys(d.res).some(function (k) { return d.res[k].no === 1; }); }), "B's decline is recorded in B's doc");
    ok(await waitFor(function () { return $$(A, ".fr-hi").some(function (e) { return /Declined/.test(e.textContent); }); }), "A's history shows Declined");

    var open = await A.OrchardFriends.outgoingOf(A.OrchardFriends._state.mine, A.OrchardFriends._state.outRes, "u_alice");
    ok(A.OrchardFriends.openCount(open, Date.now()) === 0, "A has no open challenges left");

    click(A, "[data-f=share]");
    ok(await waitFor(function () { return !store()["cards/u_alice"]; }), "switching sharing off deletes A's card");
    ok(await waitFor(function () { return /Not sharing their progress/.test(($(B, ".fr-row[data-id=u_alice]") || {}).textContent || ""); }), "B now sees A is not sharing");
    click(A, "[data-f=share]");
    await waitFor(function () { return store()["cards/u_alice"]; });

    var errs = (A.__errs || []).concat(B.__errs || []);
    ok(errs.length === 0, "no console errors in either frame" + (errs.length ? ": " + errs.join(" | ") : ""));
  } catch (e) {
    ok(false, "exception " + (e && e.stack || e));
  }
  log((fails.length ? "FAIL " + fails.length + " of " + n : "PASS " + n + " checks"));
  await sleep(400);
  var r = new Image(); r.src = "/__release?k=" + K;
})();
