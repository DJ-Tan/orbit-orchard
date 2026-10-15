(function (root) {
  "use strict";

  const MIN = 3, MAX = 20, WEEK = 7 * 86400000, CHECK_MS = 450, FRESH = 20000;
  const RESERVED = ["admin", "administrator", "mod", "moderator", "support", "help", "staff", "official", "orbit", "orbitorchard", "orchard", "oracle", "system",
    "root", "null", "undefined", "gardener", "anonymous", "everyone", "here", "me", "you", "claude", "anthropic", "google", "firebase"];
  const BLOCK = ["fuck", "shit", "cunt", "nigg", "fagg", "bitch", "whore", "slut", "nazi", "twat", "wank", "retard"];
  const SHAPE = /^[A-Za-z][A-Za-z0-9]*(_[A-Za-z0-9]+)*$/;
  const KEY = /^[a-z][a-z0-9_]{2,19}$/;
  const NUDGE = "orbit-orchard-username-nudge";
  const HINT = "3–20 characters: letters, numbers and underscores";
  const WHY = {
    empty: HINT, chars: "Use only plain letters A–Z, numbers and underscores", short: "At least 3 characters", long: "At most 20 characters",
    start: "Start with a letter", double: "No double underscores", end: "Don't end with an underscore", reserved: "That name is reserved", blocked: "That name isn't allowed"
  };

  const isObj = (v) => v != null && typeof v === "object" && !Array.isArray(v);
  const validId = (s) => typeof s === "string" && /^[A-Za-z0-9]{1,128}$/.test(s);

  /** Validates a username: trims ASCII spaces, NFC, then letters, digits and single inner underscores only; `key` is its lowercase id. */
  function check(v) {
    const s = typeof v === "string" ? v.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, "").normalize("NFC") : "";
    const bad = (why) => ({ ok: false, name: s, key: "", why });
    if (!s) return bad("empty");
    if (/[^A-Za-z0-9_]/.test(s)) return bad("chars");
    if (s.length < MIN) return bad("short");
    if (s.length > MAX) return bad("long");
    if (!/^[A-Za-z]/.test(s)) return bad("start");
    if (s.indexOf("__") >= 0) return bad("double");
    if (!SHAPE.test(s)) return bad("end");
    const key = s.toLowerCase();
    if (RESERVED.indexOf(key) >= 0) return bad("reserved");
    if (BLOCK.some((w) => key.indexOf(w) >= 0)) return bad("blocked");
    return { ok: true, name: s, key, why: "" };
  }

  /** A stored username fit to show, or "" when it isn't exactly a valid one. */
  function shown(v) {
    const c = check(v);
    return c.ok && c.name === v ? v : "";
  }

  const docPath = (key) => (typeof key === "string" && KEY.test(key) ? "names/" + key : null);

  /** Milliseconds of a Firestore timestamp, live or JSON-copied; 0 when absent. */
  function msOf(v) {
    if (v && typeof v.toMillis === "function") return v.toMillis();
    return isObj(v) && Number.isFinite(v.seconds) ? v.seconds * 1000 + Math.floor((Number(v.nanoseconds) || 0) / 1e6) : 0;
  }

  /** When the next change is allowed after a change at `ut`; 0 when it is allowed already. */
  const lockedUntil = (ut, now) => { const t = typeof ut === "number" && Number.isFinite(ut) ? ut : msOf(ut); return t > 0 && now < t + WEEK ? t + WEEK : 0; };

  /** A fresh names document. */
  const nameDoc = (uid, c) => (validId(uid) && c && c.ok ? { u: uid, n: c.name } : null);

  /** A fresh pub document from the stored one with a new username (or none) and change time; a username replaces the Google name. */
  function pubDoc(d, name, stamp, now) {
    if (!isObj(d) || typeof d.x !== "string" || typeof d.y !== "string") return null;
    const o = { x: d.x, y: d.y, at: now };
    if (!name && typeof d.n === "string" && d.n) o.n = d.n;
    if (d.s === true) o.s = true;
    if (name) o.un = name;
    o.ut = stamp;
    return o;
  }

  /** The batch for claiming, changing or removing: pub, the new names doc and the released old one. */
  function plan(uid, d, c, stamp, now) {
    const old = isObj(d) && typeof d.un === "string" ? d.un : "", oldKey = old.toLowerCase();
    if (!validId(uid) || (c && !c.ok) || (!c && !old) || (c && c.name === old)) return null;
    const p = pubDoc(d, c ? c.name : "", stamp, now);
    if (!p) return null;
    const ops = [["pub/" + uid, p]];
    if (c && c.key !== oldKey) ops.push([docPath(c.key), nameDoc(uid, c)]);
    if (old && (!c || c.key !== oldKey) && docPath(oldKey)) ops.push([docPath(oldKey), null]);
    return ops;
  }

  const api = { MIN, MAX, WEEK, RESERVED, BLOCK, HINT, WHY, check, shown, docPath, msOf, lockedUntil, nameDoc, pubDoc, plan };
  if (typeof module === "object" && module.exports) { module.exports = api; return; }

  const ls = {
    get(k) { try { return JSON.parse(root.localStorage.getItem(k) || "null"); } catch (e) { return null; } },
    set(k, v) { try { root.localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  const whenText = (t) => new Date(t).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  let ui = {}, W = null, box = null, nudgeEl = null, gen = 0, timer = 0, editing = false, busy = false, flash = null, nudged = false, draft = "";
  const st = { uid: null, known: false, pub: null, un: "", ut: 0 };
  const avail = {};
  const mark = (k, v) => { avail[k] = { v, at: Date.now() }; };
  const availOf = (k) => { const a = avail[k]; return a && (a.v === "mine" || a.v === "wait" || Date.now() - a.at < FRESH) ? a.v : ""; };
  const subs = [];
  const tell = () => subs.slice().forEach((f) => { try { f(); } catch (e) {} });
  const $ = (s) => (box ? box.querySelector(s) : null);

  function reset(uid) {
    st.uid = uid; st.known = false; st.pub = null; st.un = ""; st.ut = 0;
    editing = false; busy = false; flash = null; nudged = false;
    Object.keys(avail).forEach((k) => { delete avail[k]; });
  }

  /** Takes my stored pub doc (from a read or a Friends snapshot) as the current state. */
  function seen(uid, d) {
    if (!uid || uid !== st.uid) return;
    const was = st.un + "|" + st.ut;
    st.pub = isObj(d) ? d : null;
    st.un = st.pub ? shown(st.pub.un) : "";
    st.ut = st.pub ? msOf(st.pub.ut) : 0;
    st.known = true;
    if (st.un) mark(st.un.toLowerCase(), "mine");
    if (was !== st.un + "|" + st.ut) tell();
    paint();
    nudge();
  }

  /** Raw username and change time stored on my pub doc, so other pub writes keep them. */
  function carry(uid) {
    if (!uid || uid !== st.uid || !st.pub) return null;
    const o = {};
    if (typeof st.pub.un === "string") o.un = st.pub.un;
    if (st.pub.ut != null) o.ut = st.pub.ut;
    return o;
  }

  async function load() {
    const a = W.account(), g = ++gen;
    if (!a || !validId(a.uid)) { reset(null); paint(); hideNudge(); return; }
    if (a.uid !== st.uid) reset(a.uid);
    paint();
    try {
      const db = await W.use("db"), s = await db.doc("pub/" + a.uid).get();
      if (g === gen) seen(a.uid, s.exists ? s.data() : null);
    } catch (e) { if (g === gen) paint(); }
  }

  const account = () => { const a = W && W.account(); return a && validId(a.uid) && a.uid === st.uid ? a : null; };

  function errText(e) {
    const c = e && e.code;
    if (c === "resting") return "The cloud is resting until " + W.meter.untilText() + ". Try again after that.";
    if (c === "unavailable" || c === "resource_exhausted") return "Can't reach the cloud right now. Try again in a moment.";
    return "Couldn't save your username. Try again.";
  }

  /** Looks up whether a valid name is free, debounced and cached for this session. */
  function lookup(c) {
    clearTimeout(timer);
    if (!c.ok || availOf(c.key)) return;
    const uid = st.uid;
    timer = setTimeout(async () => {
      try {
        const db = await W.use("db"), path = docPath(c.key);
        if (!path) return;
        mark(c.key, "wait");
        const s = await db.doc(path).get(), d = s.exists ? s.data() : null;
        if (uid !== st.uid) return;
        mark(c.key, !d ? "free" : isObj(d) && d.u === uid ? "mine" : "taken");
      } catch (e) { delete avail[c.key]; }
      paint();
    }, CHECK_MS);
  }

  /** Field state: the check, its message and tone, and whether Save works. */
  function fieldView() {
    const i = $("#unIn"), c = check(i ? i.value : "");
    if (!c.ok) return { c, text: c.why === "empty" ? HINT : WHY[c.why], tone: c.why === "empty" ? "info" : "bad", save: false };
    if (c.name === st.un) return { c, text: "That's your username now", tone: "info", save: false };
    const a = availOf(c.key);
    if (st.un && c.key === st.un.toLowerCase()) return { c, text: "Only the capitals change", tone: "good", save: true };
    if (a === "taken") return { c, text: "That name is taken", tone: "bad", save: false };
    if (a === "free" || a === "mine") return { c, text: "Available", tone: "good", save: true };
    if (!a) lookup(c);
    return { c, text: "Checking…", tone: "info", save: true };
  }

  const markup = () => `<div class="un-row"><div class="un-txt"><span class="muted small">Username</span><b class="un-cur"></b><span class="muted small un-lock"></span></div>
      <button class="btn small" type="button" data-u="edit" aria-expanded="false" aria-controls="unEdit"></button></div>
    <div class="un-edit" id="unEdit" hidden>
      <div class="field"><label for="unIn">Choose a username</label>
        <input class="text-in" id="unIn" type="text" maxlength="32" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" aria-describedby="unSt unWarn">
        <p class="un-st" id="unSt" role="status" aria-live="polite"></p></div>
      <p class="muted small un-warn" id="unWarn">You won't be able to change it again for 7 days.</p>
      <div class="row"><button class="btn small primary" type="button" data-u="save">${ui.ic ? ui.ic("check") : ""}<span>Save</span></button><button class="btn small" type="button" data-u="cancel">Cancel</button><button class="btn small ghost" type="button" data-u="remove">Remove username</button></div>
    </div>
    <p class="un-flash" id="unFlash" role="status" aria-live="polite"></p>`;

  function paint() {
    if (!box || !box.isConnected) return;
    const a = account();
    box.hidden = !a;
    if (!a) return;
    const lock = lockedUntil(st.ut, Date.now()), edit = $("[data-u=edit]");
    $(".un-cur").textContent = !st.known ? "Checking…" : st.un || "No username yet";
    $(".un-cur").classList.toggle("none", st.known && !st.un);
    const lk = $(".un-lock");
    lk.textContent = st.known && lock ? (st.un ? "You can change your username again on " : "You can choose a username again on ") + whenText(lock) : "";
    lk.hidden = !lk.textContent;
    edit.textContent = st.un ? "Change" : "Choose";
    edit.disabled = !st.known || !!lock || busy;
    edit.hidden = editing;
    edit.setAttribute("aria-expanded", editing ? "true" : "false");
    const ed = $("#unEdit");
    ed.hidden = !editing;
    if (editing) {
      const v = fieldView(), s = $("#unSt");
      s.textContent = v.text;
      s.dataset.tone = v.tone;
      $("#unIn").setAttribute("aria-invalid", v.tone === "bad" ? "true" : "false");
      const sv = $("[data-u=save]");
      sv.disabled = busy || !v.save || !!lock;
      sv.lastChild.textContent = busy ? "Saving…" : "Save";
      const rm = $("[data-u=remove]");
      rm.hidden = !st.un;
      rm.disabled = busy || !!lock;
      $("[data-u=cancel]").disabled = busy;
    }
    const f = $("#unFlash");
    f.textContent = flash ? flash.text : "";
    f.dataset.tone = flash ? flash.tone : "info";
    f.hidden = !flash;
  }

  function openEditor() {
    if (!account() || !st.known || lockedUntil(st.ut, Date.now())) return false;
    editing = true; flash = null; draft = st.un;
    const i = $("#unIn");
    if (i) i.value = draft;
    paint();
    if (i) { try { i.focus(); i.select(); } catch (e) {} }
    return true;
  }

  function closeEditor() {
    editing = false;
    paint();
    const b = $("[data-u=edit]");
    if (b && !b.disabled) { try { b.focus(); } catch (e) {} }
  }

  /** Claims, changes or removes my username in one batch: pub, the new names doc and the old one released. */
  async function commit(remove) {
    const a = account();
    if (!a || busy) return;
    const c = remove ? null : check(($("#unIn") || {}).value);
    if (c && !c.ok) return;
    busy = true; flash = null;
    paint();
    let ok = false;
    try {
      const db = await W.use("db"), fs = (await W.sdk()).fs, s = await db.doc("pub/" + a.uid).get();
      if (a.uid !== st.uid) return;
      const d = s.exists ? s.data() : null;
      seen(a.uid, d);
      if (!d) { flash = { text: "Friends is still setting up on this device. Try again in a moment.", tone: "bad" }; return; }
      if (lockedUntil(d.ut, Date.now())) { flash = { text: "You can change your username again on " + whenText(lockedUntil(d.ut, Date.now())) + ".", tone: "bad" }; editing = false; return; }
      const ops = plan(a.uid, d, c, fs.serverTimestamp(), Date.now());
      if (!ops) { editing = false; return; }
      try { await db.batch(ops); ok = true; }
      catch (e) {
        if (e && e.code === "quota_exceeded" && c) {
          const n = await db.doc(docPath(c.key)).get().catch(() => null), nd = n && n.exists ? n.data() : null;
          if (nd && nd.u !== a.uid) { mark(c.key, "taken"); flash = { text: "That name was just taken. Try another.", tone: "bad" }; return; }
        }
        flash = { text: errText(e), tone: "bad" };
        return;
      }
      const old = typeof d.un === "string" ? d.un.toLowerCase() : "";
      if (old && (!c || c.key !== old)) mark(old, "free");
      if (c) mark(c.key, "mine");
      editing = false;
      flash = { text: c ? "Friends now see you as " + c.name + "." : "Username removed. Friends see your Google name or friend code again.", tone: "good" };
      const t = await db.doc("pub/" + a.uid).get().catch(() => null);
      if (t && t.exists) seen(a.uid, t.data());
      else { st.un = c ? c.name : ""; st.ut = Date.now(); tell(); }
    } catch (e) { flash = { text: errText(e), tone: "bad" }; }
    finally {
      busy = false;
      paint();
      if (ok && ui.note) ui.note(remove ? "Username removed" : "Username saved", "good");
    }
  }

  function askRemove() {
    const go = () => commit(true);
    if (ui.confirmModal) ui.confirmModal("Remove your username?", "Friends see your Google name or friend code again, and others can take this name. You won't be able to choose a new one for 7 days.", "Remove", go);
    else go();
  }

  /** Builds the Username row into `host` inside the signed-in account card. */
  function render(host) {
    box = host;
    host.innerHTML = markup();
    $("#unIn").value = draft;
    host.addEventListener("click", (e) => {
      const b = e.target.closest("[data-u]");
      if (!b || b.disabled) return;
      if (b.dataset.u === "edit") openEditor();
      if (b.dataset.u === "cancel") closeEditor();
      if (b.dataset.u === "save") commit(false);
      if (b.dataset.u === "remove") askRemove();
    });
    host.addEventListener("input", (e) => {
      if (e.target.id !== "unIn") return;
      flash = null;
      draft = e.target.value;
      lookup(check(e.target.value));
      paint();
    });
    host.addEventListener("keydown", (e) => {
      if (e.target.id !== "unIn") return;
      if (e.key === "Enter") { e.preventDefault(); const s = $("[data-u=save]"); if (s && !s.disabled) commit(false); }
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeEditor(); }
    });
    paint();
  }

  const dismissed = (uid) => { const m = ls.get(NUDGE); return !!(isObj(m) && m[uid]); };
  function dismiss() {
    const m = ls.get(NUDGE), o = isObj(m) ? m : {};
    if (st.uid) o[st.uid] = 1;
    ls.set(NUDGE, o);
    hideNudge();
  }
  function hideNudge() { if (nudgeEl) { nudgeEl.remove(); nudgeEl = null; } }

  /** Shows the one-time "pick a username" nudge to a signed-in player without one. */
  function nudge() {
    const a = account();
    if (!a || !st.known || st.un || nudged || dismissed(a.uid) || lockedUntil(st.ut, Date.now()) || !root.document || !document.body) { if (st.un) hideNudge(); return; }
    if (ui.inGame && ui.inGame()) return;
    nudged = true;
    const el = nudgeEl = document.createElement("div");
    el.className = "un-nudge";
    el.setAttribute("role", "region");
    el.setAttribute("aria-label", "Username");
    el.innerHTML = `<p></p><div class="row"><button class="btn small primary" type="button" data-n="go"></button><button class="btn small ghost un-x" type="button" data-n="no" aria-label="Dismiss">${ui.ic ? ui.ic("close") : "×"}</button></div>`;
    el.querySelector("p").textContent = "Pick a username so friends can recognise you";
    el.querySelector("[data-n=go]").textContent = "Choose a username";
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      const b = e.target.closest("[data-n]");
      if (!b) return;
      dismiss();
      if (b.dataset.n === "go" && ui.openSettings) { ui.openSettings(); setTimeout(openEditor, 60); }
    });
    document.body.appendChild(el);
  }

  root.OrchardUsername = Object.assign({}, api, {
    /** Hooks the module to the web adapter and the UI's helpers. */
    init(o) {
      ui = o || {};
      W = root.OrchardWeb || null;
      if (!W) return;
      W.on((k) => { if (k === "init" || k === "auth") load(); });
      if (W.known()) load();
    },
    render,
    seen,
    carry,
    mine: (uid) => (uid && uid === st.uid ? st.un : ""),
    on(f) { subs.push(f); return () => { const i = subs.indexOf(f); if (i >= 0) subs.splice(i, 1); }; },
    open: openEditor,
    screen() { if (ui.inGame && ui.inGame()) hideNudge(); else if (!nudgeEl) { nudged = false; nudge(); } },
    status: () => ({ uid: st.uid, known: st.known, un: st.un, ut: st.ut, editing, busy, flash: flash ? flash.text : "", nudge: !!nudgeEl })
  });
})(typeof window !== "undefined" ? window : this);
