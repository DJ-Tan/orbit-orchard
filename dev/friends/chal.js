(async function () {
  var K = Math.random().toString(36).slice(2);
  var hold = document.createElement("img");
  hold.style.cssText = "position:absolute;width:1px;height:1px;opacity:0";
  hold.src = "/__hold?k=" + K + "&ms=280000";
  document.body.appendChild(hold);
  var out = document.getElementById("res"), n = 0, fails = [], errs = [];
  var log = function (s) { console.log("[t] CHAL " + s); out.textContent += s + "\n"; };
  var ok = function (c, msg) { n++; if (c) log("ok   " + msg); else { fails.push(msg); log("FAIL " + msg); } return c; };
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var waitFor = function (fn, ms) {
    var t0 = Date.now();
    return new Promise(function (res) { (function poll() { var v; try { v = fn(); } catch (e) { v = null; } if (v || Date.now() - t0 > (ms || 9000)) res(v); else setTimeout(poll, 50); })(); });
  };
  var store = function () { return JSON.parse(localStorage.getItem("oo-mock-db") || "{}"); };
  var patch = function (o) { var s = store(); Object.keys(o).forEach(function (k) { if (o[k] == null) delete s[k]; else s[k] = o[k]; }); localStorage.setItem("oo-mock-db", JSON.stringify(s)); };
  var W = {};
  var frame = function (uid) {
    return new Promise(function (res) {
      var f = document.createElement("iframe");
      f.onload = function () { W[uid] = f.contentWindow; res(f.contentWindow); };
      f.src = "preview.html?uid=" + uid + "&embed=1";
      document.getElementById(uid).appendChild(f);
    });
  };
  var drop = function (uid) { if (W[uid]) errs = errs.concat(W[uid].__errs || []); document.getElementById(uid).innerHTML = ""; W[uid] = null; };
  var $ = function (w, s) { var a = w.document.querySelectorAll(s); return /^\.(fr-new|modal|fr-result)\b/.test(s) ? a[a.length - 1] || null : a[0] || null; };
  var $$ = function (w, s) { return Array.from(w.document.querySelectorAll(s)); };
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
  var winSky = async function (w, waste) {
    await waitFor(function () { return $(w, ".modal.intro"); }, 4000);
    key(w, " "); await sleep(80);
    var D = w.Orchard._debug;
    for (var i = 0; i < waste; i++) { D.shoot(Math.PI, 1); D.advance(240); }
    D.state.lv.bodies.forEach(function (b, j) { if (b.kind === "fertile") for (var k = 0; k < (b.need || 1); k++) D.sow(j, 0); });
    D.advance(400);
    await waitFor(function () { return $(w, ".fr-result"); }, 6000);
    var b = $(w, ".fr-result [data-a=back]"); if (b) b.click();
    return waitFor(function () { return !$(w, ".fr-result") && $(w, "#frChal"); }, 4000);
  };
  var newChal = async function (w, to, first) {
    var r = $(w, ".fr-row[data-id=" + to + "] [data-f=chal]");
    if (!r || r.disabled) return false;
    r.click();
    await waitFor(function () { return $(w, ".fr-new"); }, 3000);
    $(w, ".fr-new [data-a=" + (first ? "first" : "blind") + "]").click();
    if (first) await winSky(w, 2);
    return true;
  };
  var priv = function (u) { return store()["data/users/" + u + "/chal"] || { out: {}, res: {} }; };
  var outTo = function (u, to) { var d = priv(u); return Object.keys(d.out).filter(function (k) { return d.out[k].to === to; }); };
  var hist = function (w) { return $$(w, ".fr-hi").map(function (e) { return e.textContent; }); };
  var earned = function (u) { var e = JSON.parse(localStorage.getItem("orbit-orchard-v2@" + u)).wallet.earn; return Object.keys(e).filter(function (k) { return /^chal:/.test(k); }); };
  var today = (function () { var d = new Date(); return d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0"); })();
  var IDS = /"u_[a-z]+"/g;

  try {
    localStorage.setItem("oo-mock-db", "{}");
    var A = await frame("u_alice"), B = await frame("u_bob"), C = await frame("u_cara");
    ok(await hub(A) && await hub(B) && await hub(C), "A, B and C reach the Friends tab as Contributors");
    await waitFor(function () { var s = store(); return s["keys/u_alice"] && s["keys/u_bob"] && s["keys/u_cara"]; });
    await follow(A, "Bob", "u_bob");
    await follow(A, "Dev", "u_dev");
    await follow(B, "Alice", "u_alice");
    await follow(C, "Alice", "u_alice");

    ok(await waitFor(function () { var b = $(A, ".fr-row[data-id=u_dev] [data-f=chal]"); return b && b.disabled && /Needs to open Friends once/.test($(A, ".fr-row[data-id=u_dev]").textContent); }), "no key: A's Challenge button for Dev is disabled and the row says 'Needs to open Friends once'");
    $(A, "[data-f=new]").click();
    await waitFor(function () { return $(A, ".fr-new"); }, 3000);
    var optDev = $(A, ".fr-new [data-to=u_dev]"), optBob = $(A, ".fr-new [data-to=u_bob]");
    ok(optDev && optDev.disabled && /Dev Sol needs to open Friends once/.test($(A, ".fr-new").textContent) && optBob && !optBob.disabled, "no key: Dev is disabled in the New challenge picker, Bob is not");
    optDev.click();
    ok(optDev.getAttribute("aria-checked") === "false" && optBob.getAttribute("aria-checked") === "true", "Dev can't be picked; Bob, the only friend with a key, stays selected");
    $(A, ".fr-new [data-a=no]").click();

    ok(await newChal(A, "u_bob", true), "A challenges B and plays first");
    var cid1 = await waitFor(function () { return outTo("u_alice", "u_bob")[0]; }), seed1 = cid1 && priv("u_alice").out[cid1].seed;
    ok(await waitFor(function () { var b = $(B, "#tab-friends .fr-badge"); return b && b.textContent === "1"; }), "B decrypts the challenge: badge 1");
    var play = await waitFor(function () { return $(B, "[data-c=play]"); });
    if (play) play.click();
    await winSky(B, 1);
    ok(await waitFor(function () { return hist(A).some(function (t) { return /They won/.test(t); }); }), "A decrypts B's answer and sees 'They won'");
    ok(await waitFor(function () { return hist(B).some(function (t) { return /You won/.test(t); }); }), "B's history says 'You won'");
    await sleep(500);
    ok(earned("u_alice").join() === "chal:" + today + ":1" && earned("u_bob").join() === "chal:" + today + ":1", "each side earned challenge nectar exactly once: A " + earned("u_alice") + ", B " + earned("u_bob"));

    var dbC = await C.claude.use("db"), rawA = (await dbC.doc("chal/u_alice").get()).data(), rawB = (await dbC.doc("chal/u_bob").get()).data();
    var txt = JSON.stringify([rawA, rawB]);
    ok(rawA && rawB && Object.keys(rawA).sort().join() === "at,out,res,u,v" && Object.keys(rawB).sort().join() === "at,out,res,u,v" && rawA.v === 2, "C can read both raw challenge docs: keys " + Object.keys(rawA).sort().join(","));
    ok((txt.match(IDS) || []).join() === '"u_alice","u_bob"' && !/"(to|from|seed|diff|used|pollen|time|exp|by|cid|no|r)"/.test(txt) && txt.indexOf(String(seed1)) < 0, "the raw docs hold no ids besides u, no seeds and no results");
    var ents = [];
    [["u_alice", rawA], ["u_bob", rawB]].forEach(function (x) { ["out", "res"].forEach(function (kind) { Object.keys(x[1][kind]).forEach(function (id) { ents.push({ u: x[0], kind: kind, id: id, e: x[1][kind][id] }); }); }); });
    ok(ents.length === 2 && ents.every(function (x) { return Object.keys(x.e).sort().join() === "ct,iv,k,t" && x.e.k % 3600000 === 0; }), "entries are opaque {t, iv, ct, k} with an hour-rounded prune time (" + ents.length + " entries)");
    var X = C.OrchardFriends.cx, aad = C.OrchardFriends.chalAad, kC = C.OrchardFriends._state.key, tries = 0, opened = 0, cTags = [];
    for (var peer of ["u_alice", "u_bob"]) {
      var p = await X.pair(kC, store()["keys/" + peer]);
      for (var kind of ["out", "res"]) for (var dir of [[peer, "u_cara"], ["u_cara", peer]]) {
        var kk = await X.part(p, "chal-" + kind + "-key", dir[0], dir[1]);
        cTags.push(await X.part(p, "chal-" + kind + "-tag", dir[0], dir[1]));
        for (var x of ents) for (var to of ["u_cara", "u_alice", "u_bob"]) { tries++; if (await X.open(kk, x.e, aad(x.kind, x.u, to, x.id))) opened++; }
      }
    }
    ok(tries === 48 && opened === 0 && ents.every(function (x) { return cTags.indexOf(x.e.t) < 0; }), "C matches no tag and opens nothing with any of its keys (" + opened + " of " + tries + " attempts)");
    ok(!C.OrchardFriends._state.inc.u_alice && !C.OrchardFriends._state.inc.u_bob && !hist(C).length, "C's own view shows none of A and B's challenges");
    var XA = A.OrchardFriends.cx, pAB = await XA.pair(A.OrchardFriends._state.key, store()["keys/u_bob"]), sAB = await XA.side(pAB, "chal-out-", "u_alice", "u_bob");
    var bodyA = await XA.open(sAB.key, rawA.out[cid1], aad("out", "u_alice", "u_bob", cid1));
    ok(bodyA && bodyA.seed === seed1 && bodyA.to === "u_bob" && Object.keys(bodyA).sort().join() === "at,diff,exp,r,seed,to", "control: A's pair key opens its own entry to the exact v1 shape");
    var resTag = Object.keys(rawB.res).map(function (k) { return rawB.res[k].t; })[0], cardTag = await XA.part(pAB, "tag", "u_alice", "u_bob");
    ok(resTag && resTag !== rawA.out[cid1].t && cardTag !== rawA.out[cid1].t && !(await XA.open(sAB.key, rawA.out[cid1], aad("out", "u_mallory", "u_bob", cid1))), "out tag, answer tag and card tag all differ, and the entry is bound to its sender");

    ok(await newChal(A, "u_bob", true), "A sends B a challenge played first");
    ok(await newChal(A, "u_bob", false), "A sends B a blind challenge");
    var cids = await waitFor(function () { var l = outTo("u_alice", "u_bob").filter(function (k) { return k !== cid1; }); return l.length === 2 && l; });
    ok(await waitFor(function () { return $$(B, "[data-c=play]").length === 2; }), "B sees both new challenges");
    var d = priv("u_alice"), now = Date.now();
    cids.forEach(function (k) { d.out[k].at = now - 8 * 864e5; d.out[k].exp = now - 864e5; if (d.out[k].r) d.out[k].r.at = now - 7.5 * 864e5; });
    patch({ "data/users/u_alice/chal": d });
    ok(await waitFor(function () { var h = hist(A).join("|"); return /You won \(walkover\)/.test(h) && /Expired/.test(h); }), "after expiry A's history shows a walkover win and an expired sky");
    ok(await waitFor(function () { var h = hist(B).join("|"); return /They won \(walkover\)/.test(h) && /Expired/.test(h) && !$(B, "[data-c=play]"); }), "B's history shows the walkover loss and the expired sky, with nothing left to play");

    ok(await newChal(A, "u_bob", false), "A sends B one more blind challenge");
    ok(await waitFor(function () { return $(B, "[data-c=play]"); }), "B sees it");
    var histA = hist(A).length, histB = hist(B).length, oldPub = store()["keys/u_bob"], fake = await X.gen();
    drop("u_bob");
    patch({ "data/users/u_bob/keys": null, "keys/u_bob": { u: "u_bob", x: fake.x, y: fake.y, at: Date.now() } });
    await sleep(1500);
    ok(await waitFor(function () { return hist(A).length === histA && /You challenged Bob Fern/.test($(A, "#frChal").textContent) && A.OrchardFriends.status().mode === "ready"; }), "B's key rotated: A still sees its own open challenge and all " + histA + " history entries");
    ok(!(A.__errs || []).length, "nothing breaks in A");
    B = await frame("u_bob");
    await hub(B);
    ok(await waitFor(function () { var k = store()["keys/u_bob"]; return k && k.x !== oldPub.x && k.x !== fake.x; }), "B made a new key");
    var acc = await waitFor(function () { return $(A, ".fr-row[data-id=u_bob] [data-f=accept]"); });
    ok(acc && $(A, ".fr-row[data-id=u_bob] [data-f=chal]").disabled, "A pauses challenges to B until it accepts B's new key");
    if (acc) acc.click();
    ok(await waitFor(function () { return hist(B).length === histB; }), "B's own history survived the rotation (" + histB + " entries)");
    var dec = await waitFor(function () { return $(B, "[data-c=decline]"); }, 12000);
    ok(dec, "after both sync, B sees A's open challenge again");
    if (dec) { dec.click(); await waitFor(function () { return $(B, ".modal [data-a=yes]"); }, 3000); $(B, ".modal [data-a=yes]").click(); }
    ok(await waitFor(function () { return hist(A).some(function (t) { return /Declined/.test(t); }); }, 12000), "A decrypts B's decline under B's new key");
    ok(await newChal(A, "u_bob", false), "A sends a new challenge after the resync");
    ok(await waitFor(function () { return $(B, "[data-c=play]"); }, 12000), "B sees the new challenge");

    var t0 = Date.now();
    patch({ "chal/u_cara": { v: 1, to: ["u_alice", "u_dev"], from: [], out: { cv1aaaaaa1: { to: "u_alice", seed: 777777, diff: 2, at: t0, exp: t0 + 6 * 864e5 }, cv1bbbbbb2: { to: "u_dev", seed: 888888, diff: 2, at: t0, exp: t0 + 6 * 864e5 } }, res: {} } });
    await sleep(1500);
    ok(!/Cara Quill challenges you/.test($(A, "#frChal").textContent), "a plaintext v1 challenge doc from Cara is ignored");
    drop("u_cara");
    C = await frame("u_cara");
    await hub(C);
    ok(await waitFor(function () { var w = store()["chal/u_cara"]; return w && w.v === 2 && Object.keys(w.out).length === 1 && !/777777|u_alice|u_dev/.test(JSON.stringify(w)); }), "Cara's own v1 doc is rewritten as v2 on load, keeping only the entry whose peer has a key");
    ok(await waitFor(function () { var p2 = priv("u_cara"); return p2.out.cv1aaaaaa1 && p2.out.cv1bbbbbb2; }), "both entries move into Cara's private history");
    ok(await waitFor(function () { return /Cara Quill challenges you/.test($(A, "#frChal").textContent); }), "A now decrypts Cara's migrated challenge");

    var F = A.OrchardFriends._state, subs = F.subs.length + F.cardSubs.length;
    ok(subs <= 12, "A holds " + subs + " subscriptions (limit 64)");
    var all = errs.concat.apply(errs, ["u_alice", "u_bob", "u_cara"].map(function (u) { return W[u] ? W[u].__errs || [] : []; }));
    ok(all.length === 0, "no console errors in any frame" + (all.length ? ": " + all.join(" | ") : ""));
  } catch (e) {
    ok(false, "exception " + (e && e.stack || e));
  }
  log((fails.length ? "FAIL " + fails.length + " of " + n : "PASS " + n + " checks"));
  await sleep(400);
  var r = new Image(); r.src = "/__release?k=" + K;
})();
