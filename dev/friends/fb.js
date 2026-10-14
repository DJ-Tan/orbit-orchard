(async function () {
  var K = Math.random().toString(36).slice(2);
  var hold = document.createElement("img");
  hold.style.cssText = "position:absolute;width:1px;height:1px;opacity:0";
  hold.src = "/__hold?k=" + K + "&ms=280000";
  document.body.appendChild(hold);
  var out = document.getElementById("res"), n = 0, fails = [], errs = [];
  var log = function (s) { console.log("[t] FB " + s); out.textContent += s + "\n"; };
  var ok = function (c, msg) { n++; if (c) log("ok   " + msg); else { fails.push(msg); log("FAIL " + msg); } return c; };
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var waitFor = function (fn, ms) {
    var t0 = Date.now();
    return new Promise(function (res) { (function poll() { var v; try { v = fn(); } catch (e) { v = null; } if (v || Date.now() - t0 > (ms || 6000)) res(v); else setTimeout(poll, 40); })(); });
  };
  var store = function () { return JSON.parse(localStorage.getItem("oo-mock-db") || "{}"); };
  var notes = function (u) { var s = store(); return Object.keys(s).filter(function (k) { return k.indexOf("feedback/" + u + "/m/") === 0; }).sort(function (a, b) { return s[a].at - s[b].at; }).map(function (k) { return { path: k, d: s[k] }; }); };
  var W = {}, slot = 0;
  var frame = function (uid, extra) {
    return new Promise(function (res) {
      var box = document.getElementById("f" + (slot++ % 3 + 1));
      box.innerHTML = "";
      var f = document.createElement("iframe");
      f.onload = function () { W[uid] = f.contentWindow; f.contentWindow.alert = function () { f.contentWindow.__alerts = (f.contentWindow.__alerts || 0) + 1; }; res(f.contentWindow); };
      f.src = "preview.html?uid=" + uid + "&embed=1" + (extra || "");
      box.appendChild(f);
    });
  };
  var drop = function (uid) { if (W[uid]) { errs = errs.concat(W[uid].__errs || []); W[uid].frameElement.remove(); } W[uid] = null; };
  var $ = function (w, s) { return w.document.querySelector(s); };
  var $$ = function (w, s) { return Array.from(w.document.querySelectorAll(s)); };
  var key = function (w, k, t) { (t || w.document).dispatchEvent(new w.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true })); };
  var FB = function (w) { return w.OrchardFeedback.status(); };
  var tabOf = function (w) { var t = $(w, ".tab[aria-selected=true]"); return t ? t.dataset.tab : ""; };
  var settings = async function (w) {
    await waitFor(function () { return w.OrchardFeedback && w.document.querySelector(".tab"); }, 8000);
    if ($(w, ".screen:not([hidden])") && $(w, ".screen:not([hidden])").dataset.screen === "title") { key(w, "Enter"); await sleep(80); }
    key(w, "8");
    await waitFor(function () { return $(w, "#fbCard") && FB(w).mode !== "off"; }, 6000);
    await sleep(60);
    return FB(w).mode;
  };
  var pick = function (w, cat) { var r = $(w, "input[name=fbCat][value=" + cat + "]"); r.checked = true; r.dispatchEvent(new w.Event("change", { bubbles: true })); };
  var type = function (w, msg) { var t = $(w, "#fbMsg"); t.value = msg; t.dispatchEvent(new w.Event("input", { bubbles: true })); };
  var info = function (w, on) { var b = $(w, "#fbInfo"); if (b.checked !== on) { b.checked = on; b.dispatchEvent(new w.Event("change", { bubbles: true })); } };
  var status = function (w) { return ($(w, "#fbSt") || {}).textContent || ""; };
  var send = async function (w, msg, cat, inf) {
    if (cat) pick(w, cat);
    type(w, msg);
    info(w, !!inf);
    var b = $(w, "[data-fb=send]");
    if (b.disabled) return "disabled";
    b.click();
    await waitFor(function () { var s = FB(w); return !s.busy; }, 6000);
    return FB(w).flash || FB(w).mode;
  };
  var listed = function (w) { return $$(w, "#fbRecent li .fb-text").map(function (e) { return e.textContent; }); };
  var injected = function (w) { return $$(w, "#fbRecent img, #fbRecent script, #fbRecent svg, #fbRecent iframe, #fbRecent a, #fbRecent [onerror], #fbRecent [onload]").length; };

  try {
    localStorage.setItem("oo-mock-db", "{}");
    ["orbit-orchard-feedback", "orbit-orchard-feedback-draft"].forEach(function (k) { localStorage.removeItem(k); });

    var A = await frame("u_alice");
    ok(await settings(A) === "ready", "Alice (Contributor) sees the Feedback card ready on the Settings tab");
    var ta = $(A, "#fbMsg");
    ok(ta.labels.length === 1 && ta.labels[0].textContent === "Your note" && ta.maxLength === 1000 && /fbHint/.test(ta.getAttribute("aria-describedby")), "the note box is labelled, has maxlength 1000 and a described hint");
    var radios = $$(A, "input[name=fbCat]");
    ok(radios.length === 4 && radios.map(function (r) { return r.value + ":" + r.labels[0].textContent; }).join(",") === "bug:Bug,idea:Idea,praise:Praise,other:Other" && $(A, ".fb-cats legend").textContent === "Kind of note", "four labelled category radios in a fieldset with a legend");
    ok($(A, "#fbInfo").labels.length === 1 && /Include game info/.test($(A, "#fbInfo").labels[0].textContent) && $(A, "#fbSt").getAttribute("role") === "status", "the info checkbox is labelled and the status line is a live region");
    ok($(A, "[data-fb=send]").disabled && $(A, "[data-fb=signin]").hidden, "Send is disabled with an empty note and there is no Google button on claude.ai");
    type(A, "123456789");
    ok($(A, "[data-fb=send]").disabled && /At least 10/.test($(A, "#fbHint").textContent) && $(A, "#fbCount").textContent === "9 / 1000", "9 characters: Send stays disabled, the hint and the live count say why");
    type(A, "12345678\u200B\u200B\u200B\u202E9");
    ok($(A, "[data-fb=send]").disabled, "zero-width and bidi characters don't count toward the 10");
    key(A, "1", ta);
    ok(tabOf(A) === "settings", "typing a digit in the note doesn't switch tabs");
    key(A, "3", radios[1]);
    ok(tabOf(A) === "settings", "a digit on a category radio doesn't switch tabs either");

    var X1 = "<img src=x onerror=alert(1)>", X2 = "\"><script>alert(1)</script>", X3 = "javascript:alert(1)";
    ok(await send(A, X1, "bug") === "sent" && status(A) === "Thanks — your feedback was sent", "Alice sends an <img onerror> note: \"" + status(A) + "\"");
    ok(await send(A, X2, "idea", true) === "sent", "Alice sends a \"><script> note with game info");
    ok(await send(A, " " + X3 + "\u202E\u200B\r\n\r\n\r\n\r\n\r\nok ", "praise") === "sent", "Alice sends a javascript: note padded with bidi, zero-width and blank lines");
    var na = notes("u_alice");
    ok(na.length === 3 && na.every(function (x) { return /^feedback\/u_alice\/m\/\d{8}-[23456789abcdefghjkmnpqrstuvwxyz]{10}$/.test(x.path); }), "three docs under feedback/u_alice/m/<YYYYMMDD>-<random>: " + na.map(function (x) { return x.path.split("/").pop(); }).join(", "));
    ok(na.every(function (x) { var k = Object.keys(x.d).sort().join(","); return k === "at,cat,msg,v" || k === "at,cat,info,msg,v"; }) && na.map(function (x) { return x.d.cat; }).join(",") === "bug,idea,praise", "each doc has only v, cat, msg, at (and info), with the picked categories");
    ok(na[0].d.msg === X1 && na[1].d.msg === X2 && na[2].d.msg === X3 + "\n\n\nok", "messages are stored sanitized, markup kept as plain text");
    var inf = na[1].d.info, ij = JSON.stringify(inf);
    ok(inf && inf.ver === "2" && inf.build === "artifact" && inf.skin === "nocturne" && inf.ua === "Firefox" && inf.view === "phone" && typeof inf.stars === "number" && !/u_alice|Alice|Moss|AK5MZ7|Mozilla|@/.test(ij), "game info is non-identifying: " + ij);
    ok(!("u" in na[0].d) && JSON.stringify(na).indexOf("Alice") < 0, "no owner field, name or code in the claude.ai payload");
    await sleep(300);
    var li = listed(A);
    ok(li.length === 3 && li[0] === X3 + "\n\n\nok" && li[1] === X2 && li[2] === X1, "Your recent feedback lists the three notes newest first, as literal text");
    ok(injected(A) === 0 && !A.__alerts, "no element or handler came from the notes (0 injected nodes, 0 alerts)");
    ok($(A, "#fbMsg").value === "" && localStorage.getItem("orbit-orchard-feedback-draft") === null && !$(A, "#fbInfo").checked, "a sent note clears the box, the info box and the stored draft");

    type(A, "One more idea about pollen trails.");
    ok($(A, "[data-fb=send]").disabled && /^You've sent 3 notes today; try again after \d{1,2}:\d{2}\s?[AP]M\.$/.test(status(A)), "a 4th note is held: \"" + status(A) + "\"");
    $(A, "[data-fb=send]").disabled = false;
    $(A, "[data-fb=send]").click();
    await sleep(300);
    ok(notes("u_alice").length === 3 && $(A, "#fbMsg").value === "One more idea about pollen trails.", "forcing the button still writes nothing and keeps the draft");

    var dbA = await A.claude.use("db"), first = na[0].path;
    ok((await dbA.doc(first).get()).exists, "Alice can read her own note back");
    ok((await dbA.collection("feedback/u_alice/m").get()).size === 3, "Alice lists only her own notes");
    drop("u_alice");

    var B = await frame("u_bob");
    ok(await settings(B) === "ready", "Bob's card is ready");
    ok($(B, "#fbMsg").value === "One more idea about pollen trails." && $$(B, "#fbRecent li").length === 0, "the browser's draft carries over, but Alice's sends aren't listed for Bob");
    var dbB = await B.claude.use("db");
    ok(!(await dbB.doc(first).get()).exists && (await dbB.collection("feedback/u_alice/m").get()).size === 0, "Bob can't read or list Alice's notes");
    var forged = null;
    await dbB.doc("feedback/u_alice/m/20260101-forgedxxxx").set({ v: 1, cat: "bug", msg: "planted by bob", at: 1 }).catch(function (e) { forged = e; });
    ok(forged && notes("u_alice").length === 3, "Bob can't write into Alice's feedback (" + (forged && forged.message) + ")");
    var over = null;
    await dbB.doc(first).set({ v: 1, cat: "bug", msg: "overwritten", at: 1 }).catch(function (e) { over = e; });
    ok(over && store()[first].msg === X1, "Bob can't overwrite Alice's note");

    var evil = $(B, "input[name=fbCat][value=other]");
    evil.value = "evil";
    pick(B, "evil");
    type(B, "This category was swapped in the DOM.");
    $(B, "[data-fb=send]").click();
    await waitFor(function () { return !FB(B).busy; });
    ok(notes("u_bob").length === 0 && FB(B).flash !== "sent", "a category value tampered in the DOM is refused, nothing written");
    evil.value = "other";

    type(B, "Draft that should survive a tab switch and a reload.");
    pick(B, "praise");
    key(B, "1");
    await sleep(120);
    ok(tabOf(B) === "journey" && !$(B, "#fbCard"), "Bob switches to the Journey tab");
    key(B, "8");
    await waitFor(function () { return $(B, "#fbCard"); });
    ok($(B, "#fbMsg").value === "Draft that should survive a tab switch and a reload." && $(B, "input[name=fbCat]:checked").value === "praise", "back on Settings the draft and category are restored");
    drop("u_bob");
    B = await frame("u_bob");
    await settings(B);
    ok($(B, "#fbMsg").value === "Draft that should survive a tab switch and a reload." && $(B, "input[name=fbCat]:checked").value === "praise", "the draft survives closing and reopening the page");
    var X4 = "{{7*7}} and ${alert(1)}", X5 = "__proto__ constructor prototype", X6 = "<svg/onload=alert(1)> & <b>bold</b>";
    ok(await send(B, X4, "other") === "sent" && await send(B, X5, "bug", true) === "sent" && await send(B, X6, "idea") === "sent", "Bob sends template, __proto__ and svg notes");
    var nb = notes("u_bob");
    ok(nb.length === 3 && nb.map(function (x) { return x.d.msg; }).join("|") === [X4, X5, X6].join("|"), "Bob's three notes are stored as typed");
    await sleep(300);
    ok(listed(B).join("|") === [X6, X5, X4].join("|") && injected(B) === 0 && !B.__alerts && $$(B, "#fbRecent .fb-text *").length === 0, "Bob's list shows {{7*7}}, ${…}, __proto__ and <svg> literally (no 49, no bold, no handler)");
    ok(B.Object.prototype.constructor === B.Object && B.eval("({}).polluted") === undefined && !Object.prototype.hasOwnProperty.call(B.Object.prototype, "prototype"), "no prototype pollution in Bob's page");
    var sent = JSON.parse(localStorage.getItem("orbit-orchard-feedback") || "{}");
    ok(Array.isArray(sent.list) && sent.list.length === 6 && sent.list.every(function (e) { return Object.keys(e).sort().join(",") === "at,cat,day,msg,u"; }), "the local log keeps 6 sends as fixed-key entries");
    drop("u_bob");

    var O = await frame("u_own", "&level=owner"), dbO = await O.claude.use("db");
    var la = await dbO.collection("feedback/u_alice/m").get(), lb = await dbO.collection("feedback/u_bob/m").get();
    ok(la.size === 3 && lb.size === 3 && la.docs.map(function (d) { return d.data().msg; }).indexOf(X1) >= 0 && (await dbO.doc(first).get()).data().cat === "bug", "the artifact owner lists and reads every player's notes");
    ok(!(await dbO.doc("data/users/u_alice/keys").get()).exists && !!store()["data/users/u_alice/keys"], "the owner still can't read a player's private data/users subtree");
    drop("u_own");

    var V = await frame("u_eve", "&level=view");
    ok(await settings(V) === "readonly", "a view-only viewer gets the read-only state");
    type(V, "Viewers can type but not send this one.");
    ok($(V, "[data-fb=send]").disabled && /can't send feedback/.test(status(V)) && notes("u_eve").length === 0, "Send stays disabled for viewers: \"" + status(V) + "\"");
    drop("u_eve");

    var S = await frame("u_dev", "&signedout=1");
    ok(await settings(S) === "signedout" && /^Sign in to send feedback/.test(status(S)) && $(S, "[data-fb=send]").disabled && $(S, "[data-fb=signin]").hidden, "signed out: \"" + status(S) + "\"");
    drop("u_dev");

    var Z = await frame("u_guest", "&mock=none");
    ok(await settings(Z) === "local" && /sent through claude\.ai/.test(status(Z)) && $(Z, "#fbMsg").value === "Viewers can type but not send this one.", "outside claude.ai the card explains and keeps the draft");
    drop("u_guest");

    var C = await frame("u_cara", "&fail=invalid");
    await settings(C);
    var r = await send(C, "This write fails on purpose in the mock.", "bug");
    ok(r === "error" && /Your note is kept here/.test(status(C)) && $(C, "#fbMsg").value === "This write fails on purpose in the mock." && !$(C, "[data-fb=send]").disabled, "a failed write keeps the draft and Send stays on for a retry: \"" + status(C) + "\"");
    ok(JSON.parse(localStorage.getItem("orbit-orchard-feedback-draft") || "{}").msg === "This write fails on purpose in the mock." && notes("u_cara").length === 0, "the draft is still stored after the failure");
    drop("u_cara");

    ok(errs.length === 0, "no console errors in any frame" + (errs.length ? ": " + errs.join(" | ") : ""));
  } catch (e) {
    ok(false, "exception " + (e && e.stack || e));
  }
  log((fails.length ? "FAIL " + fails.length + " of " + n : "PASS " + n + " checks"));
  await sleep(400);
  var rr = new Image(); rr.src = "/__release?k=" + K;
})();
