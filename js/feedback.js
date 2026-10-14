(function (root) {
  "use strict";

  const CATS = ["bug", "idea", "praise", "other"];
  const CAT_NAMES = { bug: "Bug", idea: "Idea", praise: "Praise", other: "Other" };
  const SKINS = ["nocturne", "daylight", "synthwave", "inkwell"];
  const SKIN_NAMES = { nocturne: "Nocturne", daylight: "Daylight", synthwave: "Synthwave", inkwell: "Inkwell" };
  const BUILDS = ["web", "artifact"];
  const MIN = 10, MAX = 1000, DAILY = 3, SHOW = 5, KEEP = 20, VER = "2", MAX_WORLDS = 5, MAX_STARS = 330;
  const ALPHA = "23456789abcdefghjkmnpqrstuvwxyz";
  const DRAFT = "orbit-orchard-feedback-draft", LOG = "orbit-orchard-feedback";
  const CTRL = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/g;
  const BIDI = /[\u202A-\u202E\u2066-\u2069]/g;
  const ZW = /[\u200B-\u200D\uFEFF]/g;

  const validId = (s) => typeof s === "string" && s.length > 0 && s.length <= 200 && /^[A-Za-z0-9_\-.~:@+]+$/.test(s) && s !== "." && s !== "..";
  const points = (s) => Array.from(s).length;
  const int = (v, hi) => (Number.isInteger(v) && v >= 0 && v <= hi ? v : null);

  /** Feedback text with controls, bidi and zero-width characters removed, NFC, at most two blank lines in a row, trimmed. */
  function clean(v) {
    const s = typeof v === "string" ? v : (typeof v === "number" && isFinite(v)) || typeof v === "boolean" ? String(v) : "";
    return s.replace(/\r\n?/g, "\n").replace(CTRL, "").replace(BIDI, "").replace(ZW, "").normalize("NFC")
      .replace(/[ \t]+\n/g, "\n").replace(/\n{4,}/g, "\n\n\n").trim();
  }

  /** Cleaned text plus whether it fits 10–1000 characters. */
  function check(v) {
    const text = clean(v), short = points(text) < MIN, long = text.length > MAX;
    return { text, ok: !short && !long, why: short ? "short" : long ? "long" : "" };
  }

  const catOf = (v) => (typeof v === "string" && CATS.indexOf(v) >= 0 ? v : null);

  /** Browser family from a user agent string. */
  function uaFamily(ua) {
    ua = typeof ua === "string" ? ua : "";
    return /Edg(e|A|iOS)?\//.test(ua) ? "Edge" : /OPR\/|Opera/.test(ua) ? "Opera" : /SamsungBrowser\//.test(ua) ? "Samsung"
      : /Firefox\/|FxiOS\//.test(ua) ? "Firefox" : /Chrome\/|CriOS\/|Chromium\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Other";
  }

  const viewOf = (w) => (!(typeof w === "number" && w > 0) ? null : w < 600 ? "phone" : w < 1024 ? "tablet" : "desktop");

  /** Non-identifying game context with fixed keys and bounded values. */
  function gameInfo(o) {
    o = o && typeof o === "object" ? o : {};
    const i = { ver: VER };
    const put = (k, v) => { if (v !== null) i[k] = v; };
    put("build", BUILDS.indexOf(o.build) >= 0 ? o.build : null);
    put("skin", SKINS.indexOf(o.skin) >= 0 ? o.skin : null);
    put("worlds", int(o.worlds, MAX_WORLDS));
    put("stars", int(o.stars, MAX_STARS));
    put("view", viewOf(o.width));
    put("ua", uaFamily(o.ua));
    return i;
  }

  /** A fresh feedback document, or null when the category or text isn't allowed. */
  function payload(o) {
    o = o && typeof o === "object" ? o : {};
    const cat = catOf(o.cat), m = check(o.msg);
    if (!cat || !m.ok) return null;
    const d = { v: 1, cat, msg: m.text, at: o.at === undefined ? Date.now() : o.at };
    if (validId(o.owner)) d.u = o.owner;
    if (o.info) d.info = gameInfo(o.info);
    return d;
  }

  /** Random id of `n` characters from a fixed alphabet. */
  function rid(n) {
    const a = new Uint32Array(n), c = root.crypto || (typeof globalThis !== "undefined" ? globalThis.crypto : null);
    if (c && c.getRandomValues) c.getRandomValues(a);
    else for (let i = 0; i < n; i++) a[i] = Math.floor(Math.random() * 4294967296);
    return Array.from(a, (x) => ALPHA[x % ALPHA.length]).join("");
  }

  const localDay = (t) => { const d = new Date(t); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
  const localReset = (t) => { const d = new Date(t); d.setHours(24, 0, 0, 0); return d.getTime(); };
  const docPath = (id, note) => (validId(id) && /^\d{1,8}-[0-9a-z]{1,12}$/.test(note) ? "feedback/" + id + "/m/" + note : null);

  const api = { CATS, CAT_NAMES, MIN, MAX, DAILY, ALPHA, VER, clean, check, catOf, uaFamily, viewOf, gameInfo, payload, rid, localDay, localReset, docPath, validId };
  if (typeof module === "object" && module.exports) { module.exports = api; return; }

  const mem = { draft: null, log: null };
  const ls = {
    get(k) { try { return JSON.parse(root.localStorage.getItem(k) || "null"); } catch (e) { return null; } },
    set(k, v) { try { root.localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { root.localStorage.removeItem(k); } catch (e) {} }
  };
  const $ = (s) => (el ? el.querySelector(s) : null);
  const timeText = (t) => new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const whenText = (t) => new Date(t).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  let ui = {}, B = null, el = null, gen = 0, busy = false, cx = null;
  const st = { mode: "off", id: null, flash: "" };

  function readDraft() {
    const d = ls.get(DRAFT) || mem.draft;
    return { cat: catOf(d && d.cat) || "bug", msg: d && typeof d.msg === "string" ? d.msg.slice(0, MAX) : "", info: !!(d && d.info === true) };
  }
  function saveDraft(f) {
    mem.draft = { cat: f.cat, msg: f.msg, info: f.info };
    if (f.msg || f.info) ls.set(DRAFT, mem.draft); else ls.del(DRAFT);
  }
  function dropDraft() { mem.draft = null; ls.del(DRAFT); }

  const entryOk = (e) => e && typeof e === "object" && validId(e.u) && catOf(e.cat) && typeof e.msg === "string" && Number.isFinite(e.at) && e.at >= 0 && e.at <= 8.64e15 && Number.isInteger(e.day);
  function readLog() {
    const s = ls.get(LOG) || mem.log;
    const list = s && Array.isArray(s.list) ? s.list.filter(entryOk).slice(-KEEP) : [];
    const full = s && Array.isArray(s.full) ? s.full.filter((x) => x && validId(x.u) && Number.isInteger(x.day)).slice(-KEEP) : [];
    return { list, full };
  }
  function writeLog(g) { mem.log = { v: 1, list: g.list.slice(-KEEP), full: g.full.slice(-KEEP) }; ls.set(LOG, mem.log); }
  function remember(u, day, cat, msg) {
    const g = readLog();
    g.list.push({ u, day, cat, msg, at: Date.now() });
    writeLog(g);
  }
  function markFull(u, day) {
    const g = readLog();
    if (!g.full.some((x) => x.u === u && x.day === day)) g.full.push({ u, day });
    writeLog(g);
  }
  const sentOn = (u, day) => readLog().list.filter((e) => e.u === u && e.day === day).length;
  const limited = (u, day) => sentOn(u, day) >= DAILY || readLog().full.some((x) => x.u === u && x.day === day);

  const claudeBackend = {
    build: "artifact",
    day: () => localDay(Date.now()),
    resetAt: () => localReset(Date.now()),
    async probe() {
      if (cx) return cx;
      const c = root.claude;
      if (!c || typeof c.use !== "function") return { mode: "local" };
      let db = null, user = null, id = null, can = null;
      try { const r = await Promise.all([c.use("db"), c.use("user")]); db = r[0]; user = r[1]; } catch (e) { db = null; }
      if (!db || !user) return { mode: "absent" };
      try { id = await user.id(); } catch (e) { id = null; }
      if (!validId(id)) return { mode: "signedout" };
      try { can = await user.can("data.write"); } catch (e) { can = null; }
      if (can === false) return { mode: "readonly" };
      cx = { mode: "ready", id, db };
      return cx;
    },
    async put(c, p, day) {
      const path = docPath(c.id, day + "-" + rid(10));
      if (!path) throw { code: "invalid_argument" };
      await c.db.doc(path).set(p);
      return true;
    },
    stamp: () => Date.now(),
    fail: () => "error"
  };

  function webBackend(W) {
    const M = W.meter;
    return {
      build: "web",
      day: () => M.today(),
      resetAt: () => M.reset(M.today()),
      async probe() {
        if (!W.available()) return { mode: "local" };
        if (!W.known()) return { mode: "checking" };
        const a = W.account();
        if (!a || !validId(a.uid)) return { mode: "signedout" };
        const s = M.state();
        if (s && s.info && s.info.rest) return { mode: "resting", id: a.uid };
        if (root.navigator && root.navigator.onLine === false) return { mode: "offline", id: a.uid };
        let db = null, fs = null;
        try { db = await W.use("db"); fs = (await W.sdk()).fs; } catch (e) { return { mode: "local" }; }
        return { mode: "ready", id: a.uid, db, fs };
      },
      async put(c, p, day) {
        for (let n = sentOn(c.id, day); n < DAILY; n++) {
          const path = docPath(c.id, day + "-" + n);
          if (!path) throw { code: "invalid_argument" };
          try { await c.db.doc(path).set(p); return true; } catch (e) { if (!e || e.code !== "quota_exceeded") throw e; }
        }
        return false;
      },
      stamp: (c) => c.fs.serverTimestamp(),
      fail: (e) => (e && e.code === "resting" ? "resting" : e && e.code === "not_granted" ? "signedout" : "offline")
    };
  }

  const MODES = {
    local: () => (B.build === "web" ? "Feedback needs the cloud. Reload when you're online." : "Feedback is sent through claude.ai. Open the game from its claude.ai link to send a note."),
    absent: () => "This view can't send feedback. Allow Database and User access in this page's Permissions menu, then reload.",
    readonly: () => "Your access to this page can't send feedback.",
    signedout: () => (B.build === "web" ? "Sign in to send feedback. Your note stays here until you do." : "Sign in to send feedback. Sign in to claude.ai and open this page again."),
    checking: () => "Checking sign-in",
    offline: () => "Can't reach the cloud. Your note is kept here, so try again in a moment.",
    error: () => "Couldn't send right now. Your note is kept here, so try again in a moment.",
    resting: () => {
      const M = root.OrchardWeb && root.OrchardWeb.meter;
      return "Feedback is resting until " + (M ? M.untilText() : "tomorrow") + ". " + (M && M.why() === "full" ? "Cloud sync is full for today." : "Today's cloud allowance is used up.") + " Your note stays here as a draft.";
    },
    off: () => ""
  };

  function form() {
    const r = el && el.querySelector("input[name=fbCat]:checked"), t = $("#fbMsg"), i = $("#fbInfo");
    return { cat: r ? r.value : "", msg: t ? t.value : "", info: !!(i && i.checked) };
  }
  function infoSrc() {
    const g = ui.info ? ui.info() || {} : {};
    return { build: B.build, skin: g.skin, worlds: g.worlds, stars: g.stars, width: root.innerWidth, ua: root.navigator ? root.navigator.userAgent : "" };
  }
  function infoLine(i) {
    const bits = ["Version " + i.ver];
    if (i.skin) bits.push(SKIN_NAMES[i.skin] + " skin");
    if (i.worlds != null) bits.push(i.worlds + (i.worlds === 1 ? " world" : " worlds") + (i.stars != null ? ", " + i.stars + " stars" : ""));
    if (i.view) bits.push(i.view + " screen");
    if (i.ua) bits.push(i.ua);
    return "Adds " + bits.join(" · ") + ". Nothing that identifies you.";
  }

  /** Status line, its tone and whether Send works, from the mode, the last send and the draft. */
  function view(m) {
    const lim = st.mode === "ready" && limited(st.id, B.day()), lt = "You've sent " + DAILY + " notes today; try again after " + timeText(B.resetAt()) + ".";
    if (busy) return { text: "Sending…", tone: "info", send: false };
    if (st.mode !== "ready") {
      const f = MODES[st.mode] || MODES.error;
      return { text: f(), tone: st.mode === "checking" || st.mode === "off" ? "info" : "bad", send: st.mode === "offline" || st.mode === "error" ? m.ok : false };
    }
    if (st.flash === "sent") return { text: "Thanks — your feedback was sent" + (lim ? ". " + lt : ""), tone: "good", send: false };
    if (lim) return { text: lt, tone: "bad", send: false };
    if (st.flash === "offline" || st.flash === "error") return { text: MODES[st.flash](), tone: "bad", send: m.ok };
    return { text: "", tone: "info", send: m.ok };
  }

  function paint() {
    if (!el || !el.isConnected) return;
    const f = form(), m = check(f.msg), v = view(m);
    $("#fbCount").textContent = f.msg.length + " / " + MAX;
    $("#fbHint").textContent = m.why === "short" ? "At least " + MIN + " characters." : m.why === "long" ? "At most " + MAX + " characters." : MIN + " to " + MAX + " characters.";
    $("#fbInfoTx").textContent = infoLine(gameInfo(infoSrc()));
    const s = $("#fbSt");
    s.textContent = v.text;
    s.dataset.tone = v.tone;
    const b = $("[data-fb=send]");
    b.disabled = !v.send;
    b.setAttribute("aria-busy", busy ? "true" : "false");
    b.lastChild.textContent = busy ? "Sending…" : "Send feedback";
    const sign = $("[data-fb=signin]"), W = root.OrchardWeb;
    sign.hidden = !(B.build === "web" && st.mode === "signedout" && ui.web && ui.web.signIn);
    sign.disabled = !!(W && W.busy && W.busy());
  }

  function paintList() {
    if (!el || !el.isConnected) return;
    const box = $("#fbRecent"), ul = box.querySelector("ul");
    const list = st.id ? readLog().list.filter((e) => e.u === st.id).slice(-SHOW).reverse() : [];
    ul.textContent = "";
    list.forEach((e) => {
      const li = document.createElement("li"), top = document.createElement("div"), tag = document.createElement("b"), t = document.createElement("time"), p = document.createElement("p");
      top.className = "fb-top";
      tag.className = "fb-tag";
      tag.textContent = CAT_NAMES[e.cat];
      t.dateTime = new Date(e.at).toISOString();
      t.textContent = whenText(e.at);
      p.className = "fb-text";
      p.textContent = clean(e.msg).slice(0, MAX);
      top.append(tag, t);
      li.append(top, p);
      ul.appendChild(li);
    });
    box.hidden = !list.length;
  }

  async function refresh() {
    if (!el || !el.isConnected || !B) return;
    const g = ++gen;
    let c = null;
    try { c = await B.probe(); } catch (e) { c = { mode: "error" }; }
    if (g !== gen) return;
    if (c.mode !== st.mode || c.id !== st.id) st.flash = st.flash === "sent" && c.mode === "ready" && c.id === st.id ? "sent" : "";
    st.mode = c.mode;
    st.id = c.id || null;
    paint();
    paintList();
  }

  async function send() {
    if (busy || !B) return;
    const f = form();
    gen++;
    busy = true;
    st.flash = "";
    paint();
    let c = null;
    try { c = await B.probe(); } catch (e) { c = { mode: "error" }; }
    st.mode = c.mode;
    st.id = c.id || null;
    const day = B.day();
    const p = c.mode === "ready" && !limited(c.id, day) ? payload({ cat: f.cat, msg: f.msg, info: f.info ? infoSrc() : null, owner: B.build === "web" ? c.id : "", at: B.stamp(c) }) : null;
    if (!p) { busy = false; paint(); paintList(); return; }
    try {
      if (await B.put(c, p, day)) {
        remember(c.id, day, p.cat, p.msg);
        dropDraft();
        const t = $("#fbMsg"), i = $("#fbInfo");
        if (t) t.value = "";
        if (i) i.checked = false;
        st.flash = "sent";
      } else markFull(c.id, day);
    } catch (e) {
      const k = B.fail(e);
      if (k === "resting" || k === "signedout") st.mode = k; else st.flash = k;
    } finally {
      busy = false;
      paint();
      paintList();
    }
  }

  const cardHtml = () => `<p class="muted cc-note">Found a bug, have an idea, or just enjoying the orchard? Your note goes straight to the game's maker. Up to ${DAILY} notes a day.</p>
      <fieldset class="fb-cats"><legend>Kind of note</legend><div class="fb-opts">${CATS.map((c) => `<label class="fb-cat"><input type="radio" name="fbCat" value="${c}"><span>${CAT_NAMES[c]}</span></label>`).join("")}</div></fieldset>
      <div class="field"><div class="fb-lbl"><label for="fbMsg">Your note</label><output id="fbCount" for="fbMsg">0 / ${MAX}</output></div>
        <textarea id="fbMsg" class="text-in" rows="5" maxlength="${MAX}" spellcheck="true" autocomplete="off" aria-describedby="fbHint fbCount"></textarea>
        <span class="muted small" id="fbHint"></span></div>
      <label class="fb-info"><input type="checkbox" id="fbInfo" aria-describedby="fbInfoTx"><span><b>Include game info</b><span class="muted small" id="fbInfoTx"></span></span></label>
      <div class="row"><button class="btn small primary" type="button" data-fb="send" aria-describedby="fbSt">${ui.ic ? ui.ic("check") : ""}<span>Send feedback</span></button><button class="btn small" type="button" data-fb="signin" hidden>${ui.web && ui.web.glogo ? ui.web.glogo : ""}<span>Sign in with Google</span></button><p class="fb-st" id="fbSt" role="status" aria-live="polite"></p></div>
      <section class="fb-recent" id="fbRecent" aria-labelledby="fbRecentH" hidden><h4 id="fbRecentH">Your recent feedback</h4><ul></ul></section>`;

  /** Builds the Feedback card into `host` and restores the draft. */
  function render(host) {
    el = host;
    host.innerHTML = cardHtml();
    const d = readDraft();
    host.querySelectorAll("input[name=fbCat]").forEach((r) => { r.checked = r.value === d.cat; });
    $("#fbMsg").value = d.msg;
    $("#fbInfo").checked = d.info;
    host.addEventListener("input", (e) => {
      if (e.target.id !== "fbMsg") return;
      if (st.flash === "sent") st.flash = "";
      saveDraft(form());
      paint();
    });
    host.addEventListener("change", (e) => { if (e.target.name === "fbCat" || e.target.id === "fbInfo") { saveDraft(form()); paint(); } });
    host.addEventListener("click", (e) => {
      const b = e.target.closest("[data-fb]");
      if (!b || b.disabled) return;
      if (b.dataset.fb === "send") send();
      if (b.dataset.fb === "signin" && ui.web && ui.web.signIn) ui.web.signIn();
    });
    paint();
    paintList();
    refresh();
  }

  root.OrchardFeedback = Object.assign({}, api, {
    /** Picks the storage for this build and listens for account, allowance and network changes. */
    init(o) {
      ui = o || {};
      const W = root.OrchardWeb;
      B = W && W.meter ? webBackend(W) : claudeBackend;
      if (W && W.on) W.on((k) => { if (k === "ui") paint(); else refresh(); });
      root.addEventListener("online", refresh);
      root.addEventListener("offline", refresh);
    },
    render,
    status: () => ({ mode: st.mode, flash: st.flash, busy, id: st.id })
  });
})(typeof window !== "undefined" ? window : this);
