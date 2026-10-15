(function () {
  const q = new URLSearchParams(location.search);
  const SDK = document.querySelector('link[rel=modulepreload]').href.replace(/firebase-app\.js$/, "");
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const key = (k) => document.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
  const local = () => { try { return JSON.parse(localStorage.getItem("orbit-orchard-v2") || "null"); } catch (e) { return null; } };
  const screenName = () => { const s = $(".screen:not([hidden])"); return s ? s.dataset.screen : ""; };
  async function waitFor(f, ms) { const t = Date.now(); while (Date.now() - t < (ms || 8000)) { if (f()) return true; await sleep(50); } return !!f(); }
  const blobs = [];
  const mk = URL.createObjectURL;
  URL.createObjectURL = function (b) { blobs.push(b); return mk.call(URL, b); };
  const opened = [];
  window.open = function (url) { const w = { closed: false, close() { this.closed = true; }, focus() {} }; opened.push({ url: String(url || ""), w }); return w; };

  async function sdk() {
    const [A, au] = await Promise.all([import(SDK + "firebase-app.js"), import(SDK + "firebase-auth.js")]);
    return { auth: au.getAuth(A.getApp()), au };
  }

  const cloudLog = [];
  if (window.OrchardCloud) {
    const start = OrchardCloud.start;
    OrchardCloud.start = (o) => start(Object.assign({}, o, { onStatus: (st) => { cloudLog.push(Math.round(performance.now()) + " " + st.mode + (st.reason ? ": " + st.reason : "")); o.onStatus(st); } }));
  }

  const T = {
    cloudLog: () => cloudLog.slice(),
    state() {
      const S = local() || {};
      return {
        screen: screenName(), tabs: $$(".tab").map((b) => b.dataset.tab), tab: ($(".tab[aria-selected=true]") || {}).dataset ? $(".tab[aria-selected=true]").dataset.tab : "",
        account: OrchardWeb.account(), titleSign: !!$("#webSign") && !$("#webSign").hidden, titleRest: $("#webRest") && !$("#webRest").hidden ? $("#webRest").textContent : "",
        levels: Object.keys(S.levels || {}).sort(), sown: S.stats ? S.stats.sown : 0, errs: window.__errs.slice(),
        chip: ($(".chip.cloud") || { title: "" }).title,
        sw: !!(navigator.serviceWorker && navigator.serviceWorker.controller)
      };
    },
    async enterHub() {
      if (screenName() === "title") { key("Enter"); await sleep(150); }
      for (let i = 0; i < 8 && (screenName() !== "hub" || $("#modals").children.length); i++) { key("Escape"); await sleep(250); }
      return screenName();
    },
    async key(k) { key(k); await sleep(80); return T.state().tab; },
    async settings() {
      await T.enterHub();
      key(String(T.state().tabs.indexOf("settings") + 1));
      await waitFor(() => $("#cloudCard"));
      $("#cloudCard").scrollIntoView({ block: "center", behavior: "instant" });
      return T.card();
    },
    card() {
      const c = $("#cloudCard");
      return c && { text: c.innerText.replace(/\s+/g, " ").trim(), buttons: $$("#cloudCard button").map((b) => b.textContent.trim() + (b.disabled ? " (disabled)" : "")) };
    },
    panelText() { return ($("#panels") || {}).innerText || ""; },
    async signIn(claims) {
      const { auth, au } = await sdk();
      await au.signInWithCredential(auth, au.GoogleAuthProvider.credential(JSON.stringify(claims)));
      return auth.currentUser.uid;
    },
    async clickTitleSignIn() {
      $("#webSign").click();
      await waitFor(() => opened.length, 4000);
      const o = opened[opened.length - 1];
      if (o && o.w) o.w.close();
      await waitFor(() => !OrchardWeb.busy(), 20000);
      return { url: o ? o.url : "", screen: screenName(), busy: OrchardWeb.busy() };
    },
    async click(sel) { const e = $(sel); if (!e) return false; e.click(); await sleep(100); return true; },
    async waitCloud(mode, ms) { await waitFor(() => (($(".chip.cloud") || {}).className || "").indexOf(" " + mode) >= 0 || T.cardMode() === mode, ms || 15000); return T.cardMode(); },
    cardMode() { const d = $("#cloudCard .cdot") || $(".chip.cloud"); return d ? (d.className.match(/(connecting|synced|saving|local|readonly|offline|error|resting)/) || [""])[0] : ""; },
    meter() { const M = OrchardWeb.meter; return { day: M.today(), state: M.state(), until: M.untilText(), why: M.why(), slow: M.slow(), left: M.left() }; },
    async toTitle() { if (screenName() !== "title") { $("#homeLogo").click(); await sleep(300); } return T.state(); },
    async play(w, l) {
      await T.enterHub();
      key("1");
      await sleep(100);
      if (!$$(".wcard").length) { key("1"); await sleep(100); }
      $$(".wcard")[w - 1].click();
      await sleep(100);
      $$(".node")[l - 1].click();
      await sleep(150);
      key(" ");
      await sleep(100);
      const D = Orchard._debug, S = D.state, Sim = window.OrchardSim;
      D.advance(150);
      const id = S.def.id, done = () => (local() && local().levels && local().levels[id]) || /won|celebrate/.test(S.phase);
      for (let n = 0; n < 8 && !done(); n++) {
        let best = null;
        outer: for (let a = 0; a < 360; a += 1) for (let p = 0.15; p <= 1; p += 0.03) {
          const r = Sim.simulateShot(S.lv, a * Math.PI / 180, p, S.T || 0, 14, null);
          if (r.end && r.end.type === "plant" && S.lv.bodies[r.end.i].got < (S.lv.bodies[r.end.i].need || 1)) { best = [a * Math.PI / 180, p, r.seed.t]; break outer; }
        }
        if (!best) break;
        D.shoot(best[0], best[1]);
        D.advance(Math.round(best[2] * 60) + 40);
      }
      for (let n = 0; n < 60 && !(local().levels || {})[id]; n++) { D.advance(10); await sleep(20); }
      await sleep(300);
      const r = { phase: S.phase, levels: T.state().levels };
      await T.enterHub();
      return r;
    },
    async download() {
      const n = blobs.length;
      await T.settings();
      $("#cloudCard [data-c=export]").click();
      await waitFor(() => blobs.length > n, 4000);
      const b = blobs[blobs.length - 1];
      return b ? JSON.parse(await b.text()) : null;
    },
    async loadFile(text) {
      await T.settings();
      const input = $("#cloudCard input[type=file]");
      const dt = new DataTransfer();
      dt.items.add(new File([text], "orbit-orchard-save.json", { type: "application/json" }));
      input.files = dt.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
      await sleep(600);
      return { levels: T.state().levels, note: notes.join(" | ") };
    },
    async pagehide() { dispatchEvent(new Event("pagehide")); await sleep(100); return true; },
    notes() { return notes.slice(); },
    async frTab() {
      await T.enterHub();
      key(String(T.state().tabs.indexOf("friends") + 1));
      await waitFor(() => $("#frBody"), 4000);
      return T.fr();
    },
    fr() {
      const F = window.OrchardFriends, S = F && F._state, txt = (e) => (e ? e.innerText.replace(/\s+/g, " ").trim() : "");
      const earn = ((local() || {}).wallet || {}).earn || {};
      return {
        mode: F ? F.status().mode : "none", me: S && S.me, code: S && S.fr.code ? S.fr.code.c : null, share: !!(S && S.fr.share.on),
        friends: S ? Object.keys(S.fr.f).filter((k) => !S.fr.f[k].del) : [], cards: S ? Object.keys(S.cards).reduce((o, k) => { o[k] = S.cards[k].st; return o; }, {}) : {},
        rows: $$(".fr-row").map((r) => ({ id: r.dataset.id, text: txt(r) })), chal: txt($("#frChal")), hist: $$(".fr-hi").map(txt), card: txt($("#frCard")), body: txt($("#frBody")),
        note: txt($("#frNote")), badge: ($("#tab-friends .fr-badge") || {}).textContent || "", search: !!$("#frQ"), codeIn: !!$("#frCodeIn"),
        tro: Object.keys((local() || {}).ach || {}).filter((k) => /^fr-/.test(k)).sort(), wins: Object.keys((local() || {}).pals || {}).filter((k) => /^w:/.test(k)).length,
        signBtn: !!$("#frBody [data-f=signin]"), chalPay: Object.keys(earn).filter((k) => /^chal:/.test(k)).map((k) => k + "=" + earn[k]),
        items: S && S.items ? Object.keys(S.items).length : 0, sent: S && S.sent ? Object.keys(S.sent.s).length : 0, cardTo: S && S.card.to ? S.card.to.slice() : [],
        tabs: T.state().tabs, errs: window.__errs.slice(), notes: notes.slice(-6),
        dbg: S ? { docs: Object.keys(S.card.docs || {}).map((k) => k.slice(0, 4)), to: (S.card.to || []).map((k) => k.slice(0, 4)), last: !!S.card.last, timer: !!S.card.timer, busy: S.card.busy, urgent: S.card.urgent,
          inc: Object.keys(S.inc).map((k) => k.slice(0, 4) + ":" + Object.keys(S.inc[k].out).join("|")), items: Object.keys(S.items || {}).map((k) => S.items[k].kind + "@" + k.slice(-6)), keysWait: S.keysWait, mode: S.st.mode,
          mine: Object.keys(S.mine.out), sent: Object.keys((S.sent || { s: {} }).s).map((k) => k.slice(-6)), ready: [S.mineReady, S.sentReady, S.pinsReady, !!S.key, S.cx] } : null
      };
    },
    async frClick(sel) { const e = $(sel); if (!e || e.disabled) return false; e.click(); await sleep(150); return true; },
    async frMakeCode() {
      await T.frClick("#frBody [data-f=mkcode]");
      await waitFor(() => OrchardFriends._state.fr.code, 8000);
      return OrchardFriends._state.fr.code ? OrchardFriends._state.fr.code.c : null;
    },
    async frAdd(code) {
      const i = $("#frCodeIn");
      i.value = code;
      $("#frBody [data-f=find]").click();
      await waitFor(() => notes.some((n) => /Following|No gardener|own code|already/.test(n)), 6000);
      await sleep(300);
      return T.fr();
    },
    async frShare(on) { const b = $("#frBody [data-f=share]"); if ((b.getAttribute("aria-checked") === "true") !== on) b.click(); await sleep(300); return T.fr(); },
    async frName(on) { const b = $("#frBody [data-f=name]"); if ((b.getAttribute("aria-checked") === "true") !== on) b.click(); await sleep(300); return T.fr(); },
    async winSky(waste) {
      await waitFor(() => $(".modal.intro"), 5000);
      key(" ");
      await sleep(100);
      const D = Orchard._debug;
      for (let i = 0; i < waste; i++) { D.shoot(Math.PI, 1); D.advance(240); }
      D.state.lv.bodies.forEach((b, j) => { if (b.kind === "fertile") for (let k = 0; k < (b.need || 1); k++) D.sow(j, 0); });
      D.advance(400);
      await waitFor(() => $(".fr-result"), 8000);
      const r = $$(".fr-result").pop(), out = { title: r ? r.querySelector("h2").textContent : "", text: r ? r.innerText.replace(/\s+/g, " ") : "" };
      const b = r && r.querySelector("[data-a=back]");
      if (b) b.click();
      await waitFor(() => !$(".fr-result") && $("#frChal"), 5000);
      return out;
    },
    async frChallenge(to, first, waste) {
      if (!(await T.frClick(".fr-row[data-id='" + to + "'] [data-f=chal]"))) return { err: "no challenge button" };
      await waitFor(() => $(".fr-new"), 3000);
      $$(".fr-new [data-a=" + (first ? "first" : "blind") + "]").pop().click();
      return first ? T.winSky(waste || 0) : { title: "blind" };
    },
    async frPlay(waste) {
      if (!(await T.frClick("#frChal [data-c=play]"))) return { err: "no play button" };
      return T.winSky(waste || 0);
    },
    async frPlayMine(waste) {
      if (!(await T.frClick("#frChal [data-c=mine]"))) return { err: "no play-your-side button" };
      return T.winSky(waste || 0);
    },
    async frSafe(id) {
      const row = () => $(".fr-row[data-id='" + id + "']");
      if (!row().querySelector(".fr-safe")) await T.frClick(".fr-row[data-id='" + id + "'] [data-f=safe]");
      await waitFor(() => row().querySelector(".fr-safe .mono") && /\d{4} \d{4} \d{4}/.test(row().querySelector(".fr-safe .mono").textContent), 6000);
      const e = row().querySelector(".fr-safe");
      return { code: e ? e.querySelector(".mono").textContent : "", text: e ? e.innerText.replace(/\s+/g, " ") : "" };
    },
    async frAccept(id) { return T.frClick(".fr-row[data-id='" + id + "'] [data-f=accept]"); },
    async frVerify(id) { return T.frClick(".fr-row[data-id='" + id + "'] [data-f=verify]"); },
    async frRemove(id) {
      await T.frClick(".fr-row[data-id='" + id + "'] [data-f=rm]");
      await waitFor(() => $(".modal [data-a=yes]"), 3000);
      $$(".modal [data-a=yes]").pop().click();
      await sleep(400);
      return T.fr();
    },
    async fs(op, path, extra) {
      const fs = await import(SDK + "firebase-firestore.js"), A = await import(SDK + "firebase-app.js"), db = fs.getFirestore(A.getApp()), segs = path.split("/");
      try {
        if (op === "get") { const s = await fs.getDocFromServer(fs.doc(db, path)); return { exists: s.exists(), data: s.exists() ? s.data() : null }; }
        if (op === "list") { const q = await fs.getDocsFromServer(fs.collection(db, path)); return { ids: q.docs.map((d) => d.id) }; }
        if (op === "set") { await fs.setDoc(fs.doc(db, path), extra); return { ok: true }; }
        if (op === "del") { await fs.deleteDoc(fs.doc(db, path)); return { ok: true }; }
        if (op === "note") { await fs.setDoc(fs.doc(db, path), Object.assign({}, extra, { at: fs.serverTimestamp() })); return { ok: true }; }
        if (op === "update") { await fs.updateDoc(fs.doc(db, path), extra); return { ok: true }; }
      } catch (e) { return { err: e.code || String(e), segs: segs.length }; }
      return { err: "op" };
    },
    async probe() {
      const fs = await import(SDK + "firebase-firestore.js"), A = await import(SDK + "firebase-app.js"), db = fs.getFirestore(A.getApp()), me = OrchardFriends._state.me, r = fs.doc(db, "pub/" + me);
      const t0 = Date.now(), s = await fs.getDocFromServer(r), t1 = Date.now();
      await Promise.race([fs.setDoc(r, s.data()), sleep(30000)]);
      return { get: t1 - t0, set: Date.now() - t1 };
    },
    async fbOpen() {
      await T.enterHub();
      key("1");
      await sleep(80);
      key(String(T.state().tabs.indexOf("settings") + 1));
      await waitFor(() => $("#fbCard") && OrchardFeedback.status().mode !== "off", 8000);
      await sleep(100);
      return T.fb();
    },
    fb() {
      const s = window.OrchardFeedback ? OrchardFeedback.status() : {}, sb = $("#fbCard [data-fb=signin]"), b = $("#fbCard [data-fb=send]");
      let draft = null;
      try { draft = JSON.parse(localStorage.getItem("orbit-orchard-feedback-draft") || "null"); } catch (e) { draft = null; }
      return {
        mode: s.mode, flash: s.flash, busy: s.busy, id: s.id, st: ($("#fbSt") || {}).textContent || "", send: !!b && !b.disabled, sign: !!sb && !sb.hidden,
        msg: ($("#fbMsg") || {}).value, cat: ($("input[name=fbCat]:checked") || {}).value, list: $$("#fbRecent li .fb-text").map((e) => e.textContent),
        injected: $$("#fbRecent img, #fbRecent script, #fbRecent svg, #fbRecent iframe, #fbRecent a, #fbRecent [onerror], #fbRecent [onload], #fbRecent .fb-text *").length,
        alerts: window.__alerts || 0, polluted: ({}).polluted, draft, errs: window.__errs.slice()
      };
    },
    fbType(msg, cat, info) {
      window.alert = () => { window.__alerts = (window.__alerts || 0) + 1; };
      if (cat) { const r = $("input[name=fbCat][value=" + cat + "]"); r.checked = true; r.dispatchEvent(new Event("change", { bubbles: true })); }
      const t = $("#fbMsg");
      t.value = msg;
      t.dispatchEvent(new Event("input", { bubbles: true }));
      const i = $("#fbInfo");
      if (i.checked !== !!info) { i.checked = !!info; i.dispatchEvent(new Event("change", { bubbles: true })); }
      return T.fb();
    },
    async fbSend(msg, cat, info, force) {
      T.fbType(msg, cat, info);
      const b = $("#fbCard [data-fb=send]");
      if (b.disabled && !force) return Object.assign(T.fb(), { clicked: false });
      b.disabled = false;
      b.click();
      await sleep(30);
      await waitFor(() => !OrchardFeedback.status().busy, 20000);
      await sleep(200);
      return Object.assign(T.fb(), { clicked: true });
    },
    async fbNet(on) {
      Object.defineProperty(navigator, "onLine", { configurable: true, get: () => on });
      dispatchEvent(new Event(on ? "online" : "offline"));
      await sleep(400);
      return T.fb();
    },
    async fbRest(on) {
      const k = "oo.meter." + OrchardWeb.account().uid, i = JSON.parse(localStorage.getItem(k) || "{}");
      localStorage.setItem(k, JSON.stringify(Object.assign(i, { d: OrchardWeb.meter.today(), rest: on ? "self" : null, at: Date.now() })));
      return T.fbOpen();
    },
    async unOpen() {
      await T.settings();
      await waitFor(() => OrchardWeb.known() && (!OrchardWeb.account() || OrchardUsername.status().known), 15000);
      await sleep(100);
      return T.un();
    },
    un() {
      const s = window.OrchardUsername ? OrchardUsername.status() : {}, box = $("#cloudCard .un-box"), txt = (e) => (e && !e.hidden ? e.textContent.replace(/\s+/g, " ").trim() : "");
      const btn = (sel) => { const b = $(sel); return b ? { text: b.textContent.trim(), on: !b.hidden && !b.disabled, shown: !b.hidden } : { text: "", on: false, shown: false }; };
      let nud = null;
      try { nud = JSON.parse(localStorage.getItem("orbit-orchard-username-nudge") || "null"); } catch (e) { nud = null; }
      return Object.assign({}, s, {
        box: !!box && !box.hidden, cur: txt($(".un-cur")), lock: txt($(".un-lock")), edit: btn("[data-u=edit]"), save: btn("[data-u=save]"), remove: btn("[data-u=remove]"),
        st: txt($("#unSt")), tone: ($("#unSt") || { dataset: {} }).dataset.tone || "", warn: txt($("#unWarn")), flashLine: txt($("#unFlash")), field: ($("#unIn") || {}).value,
        focus: document.activeElement && document.activeElement.id, nm: txt($("#cloudCard .nm")), em: txt($("#cloudCard .em")), nudgeText: txt($(".un-nudge p")), nudged: nud,
        injected: $$("#cloudCard .un-box img, #cloudCard .un-box script, #cloudCard .un-box iframe, #cloudCard .un-box [onerror], .un-nudge img").length,
        alerts: window.__alerts || 0, tab: T.state().tab, screen: T.state().screen, errs: window.__errs.slice()
      });
    },
    async unType(v) {
      window.alert = () => { window.__alerts = (window.__alerts || 0) + 1; };
      if (!$("#unIn") || !$("#unIn").offsetParent) await T.unOpen();
      if (!OrchardUsername.status().editing) OrchardUsername.open();
      const i = $("#unIn");
      if (!i) return T.un();
      i.value = v;
      i.dispatchEvent(new Event("input", { bubbles: true }));
      await sleep(50);
      await waitFor(() => !/Checking/.test(($("#unSt") || {}).textContent || ""), 8000);
      return T.un();
    },
    async unSave(v, force) {
      if (v !== undefined) await T.unType(v);
      const b = $("[data-u=save]");
      if (!b || (b.disabled && !force)) return Object.assign(T.un(), { clicked: false });
      b.disabled = false;
      b.click();
      await sleep(50);
      await waitFor(() => !OrchardUsername.status().busy, 20000);
      await sleep(300);
      return Object.assign(T.un(), { clicked: true });
    },
    async unRemove() {
      if (!$("#unIn") || !$("#unIn").offsetParent) await T.unOpen();
      if (!OrchardUsername.status().editing) OrchardUsername.open();
      const b = $("[data-u=remove]");
      if (!b || b.disabled || b.hidden) return Object.assign(T.un(), { clicked: false });
      b.click();
      await waitFor(() => $(".modal [data-a=yes]"), 3000);
      $$(".modal [data-a=yes]").pop().click();
      await sleep(50);
      await waitFor(() => !OrchardUsername.status().busy, 20000);
      await sleep(300);
      return Object.assign(T.un(), { clicked: true });
    },
    async unCancel() { await T.click("[data-u=cancel]"); return T.un(); },
    async unNudge(act) {
      await waitFor(() => $(".un-nudge"), 10000);
      const b = $(".un-nudge [data-n=" + act + "]");
      if (b) b.click();
      await sleep(400);
      return T.un();
    },
    async unWaitNudge(ms) { await waitFor(() => $(".un-nudge"), ms || 10000); return T.un(); },
    async signOut() { await OrchardWeb.signOut(); await waitFor(() => !OrchardWeb.account(), 5000); await sleep(400); return T.fr(); },
    async waitCaches() {
      for (let i = 0; i < 100; i++) { const ks = await caches.keys(); if (ks.length && (await (await caches.open(ks[0])).keys()).length >= 15) return ks; await sleep(200); }
      return [];
    }
  };
  window.__t = T;
  const notes = [];
  document.addEventListener("DOMContentLoaded", () => {
    new MutationObserver(() => $$("#nfx .note").forEach((n) => { if (!n.__seen) { n.__seen = 1; notes.push(n.dataset.text || n.textContent); } })).observe($("#nfx"), { childList: true, subtree: true });
  });

  addEventListener("message", async (e) => {
    if (!e.data || !e.data.__t) return;
    let r = null, err = null;
    try { r = await T[e.data.fn].apply(null, e.data.args || []); } catch (x) { err = String((x && x.stack) || (x && x.code) || x); }
    e.source.postMessage({ __t: e.data.__t, r, err }, "*");
  });

  if (q.get("shot")) {
    const hold = document.createElement("img");
    hold.src = "/__hold?k=" + encodeURIComponent(q.get("k") || q.get("shot")) + "&ms=60000";
    hold.style.cssText = "position:fixed;width:1px;height:1px;opacity:0";
    document.body.appendChild(hold);
  }

  async function shot(name) {
    const css = document.createElement("style");
    css.textContent = "*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition:none!important}";
    document.head.appendChild(css);
    await waitFor(() => OrchardWeb.known(), 8000);
    const PEOPLE = { alice: { sub: "alice-google-1", email: "alice@example.com", name: "Alice Example", email_verified: true }, bob: { sub: "bob-google-2", email: "bob@example.com", name: "Bob Builder", email_verified: true } };
    const who = PEOPLE[q.get("who")] || { sub: "shot-sam", email: "sam.gardener@example.com", name: "Sam Gardener", email_verified: true };
    if (/-in$/.test(name)) { await T.signIn(who); await waitFor(() => T.cardMode() === "synced" || T.state().chip.indexOf("Synced") >= 0, 15000); }
    if (/-rest$/.test(name)) { await T.signIn(who); await waitFor(() => OrchardWeb.meter.state() && OrchardWeb.meter.state().asleep, 15000); await sleep(500); }
    if (/^settings/.test(name)) await T.settings();
    if (/^journey/.test(name)) await T.enterHub();
    if (/^feedback/.test(name)) {
      await T.fbOpen();
      if (q.get("skin")) { const p = $("[data-pick=" + q.get("skin") + "]"); if (p) p.click(); }
      const fb = q.get("fb") || "", N = ["The sun in Frost Reach 7 hides the last fertile planet behind the HUD on my phone.", "<img src=x onerror=alert(1)> shows up as text, nice.", "Love the Synthwave skin. More trails please!"];
      if (/-in$/.test(name)) await waitFor(() => OrchardFeedback.status().mode === "ready", 15000);
      for (let i = 0; i < (fb === "limit" ? 3 : fb === "sent" ? 1 : 0); i++) await T.fbSend(N[i], ["bug", "praise", "idea"][i]);
      if (fb === "draft" || fb === "limit" || /-out$/.test(name)) T.fbType("A zoom-out button for the big Event Horizon plots would help on small screens.", "idea", true);
      await sleep(300);
      $("#fbCard").previousElementSibling.scrollIntoView({ block: q.get("fbat") || "start", behavior: "instant" });
    }
    if (/^username/.test(name)) {
      await T.unOpen();
      if (q.get("skin")) { const p = $("[data-pick=" + q.get("skin") + "]"); if (p) p.click(); }
      const u = q.get("un") || "";
      if (u === "set") await T.unSave("Sam_Gardener");
      if (u === "edit") await T.unType("Sam_Gardener");
      if (u === "bad") await T.unType("<img src=x onerror=alert(1)>");
      if (u === "taken") await T.unType("alice_orchard");
      await sleep(300);
      $("#cloudCard .un-box").scrollIntoView({ block: "center", behavior: "instant" });
    }
    if (/^nudge/.test(name)) await T.unWaitNudge(15000);
    if (/^trophies/.test(name)) { await T.enterHub(); key(String(T.state().tabs.indexOf("trophies") + 1)); }
    if (/-in$/.test(name)) await T.waitCloud("synced");
    if (/^friends/.test(name)) {
      await T.frTab();
      if (/-rest$/.test(name)) await waitFor(() => OrchardFriends.status().mode === "resting", 15000);
      if (/-in$/.test(name)) await waitFor(() => OrchardFriends.status().mode === "ready" && !$$(".fr-row .muted").some((e) => /Loading card/.test(e.textContent)), 15000);
      await sleep(1500);
      if (q.get("safe")) { const r = $(".fr-row"); await T.frSafe(q.get("safe") === "first" && r ? r.dataset.id : q.get("safe")); $(".fr-safe").scrollIntoView({ block: "center", behavior: "instant" }); }
    }
    await sleep(800);
    if ($("#cloudCard") && !/^(feedback|username)/.test(name)) $("#cloudCard").scrollIntoView({ block: "center", behavior: "instant" });
    if (q.get("scroll")) { const e = $(q.get("scroll")); if (e) e.scrollIntoView({ block: "start", behavior: "instant" }); }
    if (!/^nudge/.test(name) && $(".un-nudge")) $(".un-nudge").remove();
    await sleep(100);
    console.log("[t] SHOT " + name + " " + JSON.stringify(/^friends/.test(name) ? T.fr() : /^feedback/.test(name) ? T.fb() : /^(username|nudge)/.test(name) ? T.un() : { state: T.state(), card: T.card() }));
    fetch("/__release?k=" + encodeURIComponent(q.get("k") || name));
  }

  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
      if (q.get("shot")) shot(q.get("shot"));
      if (parent !== window) parent.postMessage({ __ready: location.origin }, "*");
    }, 0);
  });
})();
