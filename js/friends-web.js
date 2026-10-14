(function (root) {
  "use strict";

  const CARD_GAP = 1800000, FLUSH_GAP = 300000, CT_MAX = 2048, CARD_CT = 4096, PER_SENDER = 70, DROP_MAX = 50, WATCH = 20000, HOUR = 3600000;
  const LISTEN = { "permission-denied": "not_granted", unauthenticated: "not_granted", "resource-exhausted": "resource_exhausted", resting: "resting" };
  const WRITE = { "permission-denied": "denied", unauthenticated: "denied", "invalid-argument": "denied", "resource-exhausted": "quota_exceeded", resting: "resting" };
  const ABSENT = {
    off: ["cloud", "Friends are starting", "One moment."],
    local: ["cloudoff", "Friends need the cloud", "Friends load from the cloud. Reload when you're online. Everything else works right here."],
    signedout: ["cloudoff", "Sign in to use Friends", "Sign in with Google to add friends and trade challenges."],
    connecting: ["sync", "Connecting", "Loading your friends and challenges."],
    offline: ["cloudoff", "Can't reach the cloud", "Friends will reconnect on their own. Your garden is safe on this device."],
    error: ["cloudoff", "Friends aren't available right now", "Something went wrong loading Friends. The rest of the game works as usual."],
    get resting() {
      const M = root.OrchardWeb && root.OrchardWeb.meter;
      return ["cloudoff", "Friends are resting until " + (M ? M.untilText() : "tomorrow"), (M && M.why() === "full" ? "Cloud sync is full for today." : "Today's cloud allowance is used up.") + " Your garden keeps saving on this device."];
    }
  };
  const TX = {
    absent: ABSENT, full: "The cloud is at today's limit. Try again later.", unreach: "Can't reach the cloud right now", gap: " Updates at most every 30 minutes.",
    empty: "No friends yet. Trade friend codes to follow their garden. Following is one-way, but you see someone's progress only if they follow you too.",
    codeHelp: "Anyone who enters it can follow you. They see your progress only if you follow them too.", noCode: "Make one so friends can add you."
  };

  const isObj = (v) => v != null && typeof v === "object" && !Array.isArray(v);
  const num = (v) => (typeof v === "number" && isFinite(v) ? v : 0);
  const b64ok = (s, n) => typeof s === "string" && s.length === n && /^[A-Za-z0-9_-]+$/.test(s);
  const ctOk = (s, n) => typeof s === "string" && s.length > 0 && s.length <= n && /^[A-Za-z0-9_-]+$/.test(s);
  const uniq = (a) => a.filter((x, i) => a.indexOf(x) === i);
  const off = () => navigator.onLine === false;
  const offline = () => Promise.reject({ code: "unavailable", message: "offline" });
  const mapErr = (map) => (e) => ({ code: map[e && e.code] || "unavailable", message: (e && e.message) || "" });
  const metaOf = (d) => ({ n: isObj(d) && typeof d.n === "string" ? d.n.trim().slice(0, 40) : "", s: !!(isObj(d) && d.s) });
  const cardOf = (d) => (isObj(d) && b64ok(d.iv, 16) && ctOk(d.ct, CARD_CT) && num(d.at) > 0 ? { iv: d.iv, ct: d.ct, at: d.at } : null);
  const face = (name) => "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="#2b2f55"/><text x="20" y="26" font-size="16" font-family="sans-serif" font-weight="700" text-anchor="middle" fill="#cfd3ff">' + ((name || "G").trim()[0] || "G").toUpperCase().replace(/[<&>"']/g, "") + "</text></svg>");

  /** Friends storage on Firestore: per-reader card docs, friend-code docs, public keys and a challenge inbox. */
  root.OrchardFriendsWeb = function (K) {
    const F = K.F, cx = K.cx, W = root.OrchardWeb, M = W.meter, hooks = (K.ui && K.ui.web) || {};
    let fs = null, db = null, gen = 0, watch = 0, codeMine = null;
    let live = {}, known = {}, asked = {}, meta = {}, cardRaw = {}, pubAt = {}, dropping = {};

    const path = (p) => { const m = /^data\/users\/([^/]+)\/([^/]+)$/.exec(p); return m ? "users/" + m[1] + "/data/" + m[2] : p; };
    const pubIn = (id, d) => K.cleanPub(id, Object.assign({}, d, { u: id }));
    const cardDoc = (owner, reader) => fs.doc(db, "cards", owner, "to", reader);
    const itemDoc = (to, id) => fs.doc(db, "inbox", to, "items", id);
    const commit = (ops) => (off() ? offline() : M.batch(ops).catch((e) => { throw mapErr(WRITE)(e); }));
    const write = (f) => (off() ? offline() : Promise.resolve().then(f).catch((e) => { throw mapErr(WRITE)(e); }));

    /** Listens with cached and pending-write events dropped; a cached event while offline reports `unavailable`. */
    function listen(r, next, err) {
      return M.listen(r, (s) => {
        if (s.metadata.fromCache) { if (off()) err({ code: "unavailable", message: "offline" }); return; }
        if (!s.metadata.hasPendingWrites) next(s);
      }, (e) => err(mapErr(LISTEN)(e)));
    }

    /** Document handle in the shape friends.js expects, with `data/users/<id>/<name>` mapped to `users/<id>/data/<name>`. */
    function ref(p) {
      const r = fs.doc(db, path(p));
      return {
        id: r.id, path: p,
        get: () => M.get(r).catch((e) => { throw mapErr(LISTEN)(e); }),
        set: (d) => write(() => M.set(r, d)),
        delete: () => write(() => M.del(r)),
        onSnapshot: (next, err) => listen(r, next, err)
      };
    }

    const myName = () => {
      const a = W.account();
      if (K.nameOn() && a && a.name && a.name.trim()) return a.name.trim().slice(0, 40);
      return F.fr.code ? "Gardener " + K.fmtCode(F.fr.code.c) : "";
    };
    const people = {
      profiles(ids) {
        ids = [].concat(ids).filter(K.validId);
        return Promise.all(ids.map((id) => (id === F.me ? null : askPub(id)))).then(() => {
          const o = {};
          ids.forEach((id) => { const n = id === F.me ? myName() : (meta[id] && meta[id].n) || ""; o[id] = { id, name: n, avatarUrl: face(n), isMe: id === F.me }; });
          return o;
        });
      }
    };

    /** Fetches a non-friend's public key once per connection. */
    function askPub(id) {
      if (!K.validId(id) || id === F.me || live[id]) return null;
      if (asked[id]) return asked[id];
      return (asked[id] = ref("pub/" + id).get().then((s) => {
        const d = s.exists ? s.data() : null, k = d && pubIn(id, d);
        meta[id] = metaOf(d); known[id] = 1; pubAt[id] = Date.now();
        if (k) F.allPubs[id] = k; else delete F.allPubs[id];
        K.refreshTrust();
      }, () => { delete asked[id]; }));
    }

    async function connect() {
      if (F.connecting || F.st.mode === "ready" || F.st.mode === "connecting") return;
      F.connecting = true;
      const g = ++gen;
      try {
        if (!W.available()) return K.status("local");
        let user = null;
        try { user = await W.use("user"); const S = await W.sdk(); fs = S.fs; db = S.db; } catch (e) { user = null; }
        if (g !== gen) return;
        if (!user || !fs) return K.status("local");
        const id = await user.id();
        if (g !== gen) return;
        if (!K.validId(id)) return K.status("signedout");
        if (off()) return K.onSubErr({ code: "unavailable" });
        F.db = { doc: ref }; F.user = people; F.me = id; F.cx = K.hasCx();
        K.status("connecting");
        clearTimeout(watch);
        watch = setTimeout(() => { if (F.st.mode === "connecting" && F.me === id) K.onSubErr({ code: "unavailable" }); }, WATCH);
        try { await M.ready(); } catch (e) { if (g === gen && F.st.mode === "connecting") { clearTimeout(watch); K.onSubErr(mapErr(LISTEN)(e)); } return; }
        if (g !== gen || F.st.mode !== "connecting") return;
        K.subscribe();
      } finally { if (g === gen) F.connecting = false; }
    }

    function refs() {
      F.pubRef = ref("pub/" + F.me);
      F.cardRef = { web: 1 };
      F.sentRef = ref("data/users/" + F.me + "/sent");
    }

    function subs() {
      if (F.cx) F.subs.push(listen(fs.collection(db, "inbox", F.me, "items"), onInbox, K.onSubErr));
    }

    function loaded() {
      F.allReady = true; F.wireCur = null;
      M.list(fs.collection(db, "cards", F.me, "to")).then((q) => {
        const docs = {};
        let at = 0;
        q.docs.forEach((d) => { docs[d.id] = cardOf(d.data()) || {}; at = Math.max(at, num(docs[d.id].at)); });
        Object.assign(F.card, { docs, per: {}, exists: q.size > 0, doc: q.size ? { at } : null, last: null, rs: null, at });
        K.syncCard();
      }, () => { Object.assign(F.card, { docs: {}, per: {}, exists: false }); });
      if (!F.cx) return;
      F.sentRef.get().then((s) => {
        const d = s.exists ? s.data() : null, out = { v: 1, s: {} };
        Object.keys(isObj(d) && isObj(d.s) ? d.s : {}).forEach((id) => { const e = d.s[id]; if (isObj(e) && K.validId(e.t) && num(e.k) > 0) out.s[id] = { t: e.t, k: e.k }; });
        F.sent = out; F.sentReady = true;
        pushWire();
      }, (e) => K.onSubErr(e));
    }

    function down() {
      Object.keys(live).forEach((id) => live[id].u.forEach((u) => { try { u(); } catch (e) {} }));
      live = {}; known = {}; asked = {}; meta = {}; cardRaw = {}; pubAt = {}; dropping = {};
      F.keysWait = 0; F.items = {}; F.inboxReady = false; F.sentReady = false;
      clearTimeout(watch);
    }

    function cardState(id) {
      if (cardRaw[id] === undefined || !known[id]) return;
      F.cardDocs[id] = cardRaw[id] && cardRaw[id].ct ? cardRaw[id] : meta[id] && meta[id].s ? { gone: 1 } : null;
    }

    /** Watches each followed player's card for me and their public key, one listener each. */
    function resubCards() {
      if (!fs || !F.me) return;
      const ids = K.friendIds(F.fr);
      Object.keys(live).forEach((id) => {
        if (ids.indexOf(id) >= 0) return;
        live[id].u.forEach((u) => { try { u(); } catch (e) {} });
        if (live[id].wait) F.keysWait--;
        delete live[id]; delete known[id]; delete F.pubs[id]; delete F.cardDocs[id]; delete cardRaw[id];
      });
      ids.forEach((id) => {
        if (live[id]) return;
        const L = live[id] = { u: [], wait: !!F.cx };
        if (L.wait) F.keysWait++;
        L.u.push(listen(cardDoc(id, F.me), (s) => { cardRaw[id] = s.exists ? cardOf(s.data()) || {} : null; cardState(id); K.openCards(); }, K.onSubErr));
        L.u.push(listen(fs.doc(db, "pub", id), (s) => {
          const d = s.exists ? s.data() : null, k = d && pubIn(id, d);
          meta[id] = metaOf(d); known[id] = 1; pubAt[id] = Date.now();
          F.names[id] = meta[id].n;
          if (k) F.pubs[id] = k; else delete F.pubs[id];
          if (L.wait) { L.wait = false; F.keysWait--; }
          cardState(id);
          K.refreshTrust();
          K.openCards();
          K.renderSoon();
        }, K.onSubErr));
      });
    }

    async function readCard(id, d, pk) {
      if (!d || !d.ct) return null;
      const p = await K.pairFor(id, pk), s = p && await cx.side(p, "", id, F.me);
      return s ? K.cleanCard(id, await cx.open(s.key, d, K.aadOf(id, F.me))) : null;
    }

    /** Seals my card into one doc per recipient: new or re-keyed recipients at once, body refreshes at most every CARD_GAP (FLUSH_GAP when the page hides) and only while today's allowance covers them. */
    async function writeCard(force) {
      if (F.card.busy) { F.card.timer = setTimeout(() => { F.card.timer = 0; writeCard(force); }, 300); return; }
      if (!F.fr.share.on || !F.cx || !F.key || !F.card.docs || F.keysWait > 0 || !K.settled(K.friendIds(F.fr))) return;
      const P = K.sharePubs(), body = K.cardBody(), to = K.cardRecips(F.fr, P), rs = K.recipSig(F.key, to, P), b = K.canon(body), sig = K.canon([body, rs]);
      if (sig === F.card.last) return;
      F.card.busy = true;
      try {
        const docs = F.card.docs, per = F.card.per, now = Date.now(), due = now >= F.card.at + (force === true ? FLUSH_GAP : CARD_GAP), mine = K.pubFp(F.key), ok = [];
        let later = false, held = false, put = [];
        for (const id of to) {
          const p = await K.pairFor(id, P[id]), s = p && await cx.side(p, "", F.me, id), ks = K.pubFp(P[id]) + "|" + mine, aad = K.aadOf(F.me, id);
          if (!s) continue;
          ok.push(id);
          if (docs[id] && per[id] === undefined) { const o = await cx.open(s.key, docs[id], aad); per[id] = o ? { b: K.canon(o), k: ks } : null; }
          const e = per[id];
          if (e && e.k === ks && e.b === b) continue;
          if (e && e.k === ks && !due) { later = true; continue; }
          if (!M.room(cardDoc(F.me, id).path)) { later = held = true; continue; }
          put.push([id, Object.assign(await cx.seal(s.key, body, aad), { at: now }), ks, !(e && e.k === ks)]);
        }
        const gone = Object.keys(docs).filter((id) => ok.indexOf(id) < 0);
        if (put.length + gone.length > M.left() && put.some((x) => !x[3])) { put = put.filter((x) => x[3]); later = held = true; }
        if (put.length || gone.length) {
          await commit(put.map((x) => [cardDoc(F.me, x[0]), x[1]]).concat(gone.map((id) => [cardDoc(F.me, id), null])));
          put.forEach((x) => { docs[x[0]] = x[1]; per[x[0]] = { b, k: x[2] }; });
          gone.forEach((id) => { delete docs[id]; delete per[id]; });
          if (put.length && due) F.card.at = now;
        }
        const at = Object.keys(docs).reduce((m, id) => Math.max(m, num(docs[id].at)), 0);
        Object.assign(F.card, { last: later ? null : sig, rs, to: ok, exists: true, doc: { at } });
        if (later && !F.card.timer) F.card.timer = setTimeout(() => { F.card.timer = 0; writeCard(); }, held ? CARD_GAP : Math.max(1000, F.card.at + CARD_GAP - now));
        K.renderSoon();
      } catch (e) { K.writeErr(e); }
      finally { F.card.busy = false; if (!F.fr.share.on && F.card.exists) delCard(); }
    }

    /** Deletes every card doc I own, listed fresh so other devices' docs go too. */
    async function delCard() {
      if (F.card.busy) return;
      F.card.busy = true;
      try {
        if (off()) throw { code: "unavailable" };
        const q = await M.list(fs.collection(db, "cards", F.me, "to")).catch((e) => { throw mapErr(LISTEN)(e); });
        const ids = uniq(q.docs.map((d) => d.id).concat(Object.keys(F.card.docs || {})));
        if (ids.length) await commit(ids.map((id) => [cardDoc(F.me, id), null]));
        Object.assign(F.card, { exists: false, last: null, doc: null, to: [], rs: null, docs: {}, per: {} });
        K.renderSoon();
      } catch (e) { K.writeErr(e); }
      finally { F.card.busy = false; if (F.fr.share.on) K.syncCard(true); }
    }

    /** Makes sure `codes/<my code>` points at me; a code replaced on another device is deleted. */
    async function ensureCode() {
      const c = F.fr.code && F.fr.code.c;
      if (!c || c === codeMine || !F.me) return;
      const old = codeMine;
      codeMine = c;
      try {
        if (old) await ref("codes/" + old).delete().catch(() => {});
        const s = await ref("codes/" + c).get(), u = s.exists ? (s.data() || {}).u : null;
        if (u === F.me) return;
        if (!s.exists) { await ref("codes/" + c).set({ u: F.me }); return; }
        F.fr.code = null; codeMine = null;
        makeCode();
      } catch (e) { codeMine = old; K.writeErr(e); }
    }

    async function makeCode() {
      if (F.fr.code || !F.me) return;
      let c = null;
      try {
        for (let i = 0; i < 5 && !c; i++) {
          const k = K.newCode();
          try { await ref("codes/" + k).set({ u: F.me }); c = k; } catch (e) { if (e.code !== "denied") throw e; }
        }
        if (!c) { K.note("Couldn't make a code. Try again.", "bad"); return; }
        codeMine = c;
        F.fr.code = { c, at: Date.now() };
        K.pushFriends();
        K.renderSoon();
      } catch (e) { K.writeErr(e); }
    }

    async function findCode(input) {
      const c = K.parseCode(input);
      if (!c) { K.note("Friend codes look like ABC-234", "bad"); return; }
      if (F.fr.code && F.fr.code.c === c) { K.note("That's your own code", "info"); return; }
      let u = null;
      try { const s = await ref("codes/" + c).get(); u = s.exists ? (s.data() || {}).u : null; } catch (e) { K.writeErr(e); return; }
      if (u === F.me) { K.note("That's your own code", "info"); return; }
      if (!K.validId(u)) { K.note("No gardener has that code", "bad"); return; }
      K.addFriend(u, c);
      const i = document.getElementById("frCodeIn");
      if (i) i.value = "";
    }

    function itemOf(id, d) {
      if (!isObj(d) || !K.validId(d.from) || d.from === F.me || id.indexOf(d.from + "_") !== 0 || (d.kind !== "chal" && d.kind !== "res")) return null;
      return b64ok(d.iv, 16) && ctOk(d.ct, CT_MAX) && num(d.at) > 0 && num(d.k) > 0 ? { from: d.from, kind: d.kind, iv: d.iv, ct: d.ct, at: d.at, k: d.k } : null;
    }

    function onInbox(s) {
      const m = {}, junk = [];
      s.docs.forEach((d) => { const x = itemOf(d.id, d.data()); if (x) m[d.id] = x; else junk.push(d.id); });
      F.items = m; F.inboxReady = true;
      uniq(Object.keys(m).map((id) => m[id].from)).forEach(askPub);
      if (junk.length) dropItems(junk);
      readChals();
    }

    function dropItems(ids) {
      ids = ids.filter((id) => !dropping[id]).slice(0, DROP_MAX);
      if (!ids.length || off()) return;
      ids.forEach((id) => { dropping[id] = 1; });
      M.batch(ids.map((id) => [itemDoc(F.me, id), null])).catch(() => ids.forEach((id) => { delete dropping[id]; }));
    }

    /** Decrypts my inbox into incoming challenges and answers, the same shapes the claude.ai build reads from peers' docs. */
    async function readChals() {
      const g = ++F.chalGen;
      if (!F.cx || !F.key || !F.inboxReady) return;
      const now = Date.now(), by = {}, drop = [], inc = {}, outRes = {}, fresh = [];
      Object.keys(F.items).forEach((id) => { const x = F.items[id]; if (x.k < now) drop.push(id); else (by[x.from] = by[x.from] || []).push(id); });
      await Promise.all(Object.keys(by).map(async (u) => {
        const ids = by[u].sort((a, b) => F.items[b].at - F.items[a].at), pk = K.pubOf(u), t = K.trustOf(u);
        ids.slice(PER_SENDER).forEach((id) => drop.push(id));
        if (!pk) return;
        if (t === "changed" || t === "wait") { if (F.inc[u]) inc[u] = F.inc[u]; if (F.outRes[u]) outRes[u] = F.outRes[u]; return; }
        const p = await K.pairFor(u, pk);
        if (!p) return;
        let got = { v: 1, out: {}, res: {} };
        await Promise.all(ids.slice(0, PER_SENDER).map(async (id) => {
          const x = F.items[id], kind = x.kind === "chal" ? "out" : "res";
          const e = await K.openMemo(await cx.part(p, "chal-" + kind + "-key", u, F.me), x, K.chalAad(kind, u, F.me, id));
          const r = isObj(e) && K.chalEntry(kind, kind === "out" ? e.cid : null, e, F.me);
          if (!r) { if (x.at < num(pubAt[u]) - HOUR) drop.push(id); return; }
          got = K.mergeChal(got, { [kind]: { [r[0]]: r[1] } });
        }));
        if (Object.keys(got.out).length) inc[u] = { v: 1, out: got.out, res: {} };
        if (Object.keys(got.res).length) outRes[u] = { v: 1, out: {}, res: got.res };
        if ((inc[u] || outRes[u]) && t === "new") fresh.push(u);
      }));
      if (g !== F.chalGen) return;
      fresh.forEach((u) => { const fp = F.fpOf[K.pubFp(K.pubOf(u))]; if (fp && !F.pins.p[u]) F.pins = K.setPin(F.pins, u, fp, Date.now()); });
      if (fresh.length) K.pushPins();
      if (Object.keys(F.dec).length > 4000) F.dec = {};
      F.inc = inc; F.outRes = outRes;
      K.renderSoon();
      if (drop.length) dropItems(drop);
    }

    /** Delivers each of my challenges and answers to the peer's inbox once per version, tracked in the private `sent` ledger. */
    const pushWire = K.serial(async () => {
      if (!F.mineReady || !F.sentReady || !F.cx || !F.key) return;
      const T = K.chalTargets(K.finishChal(F.mine, Date.now()), F.me), peers = uniq(T.map((x) => x.peer));
      peers.forEach(askPub);
      if (!K.settled(peers)) return;
      const key = F.key, want = {}, make = [], now = Date.now();
      await Promise.all(T.map(async (x) => {
        if (!K.trusted(x.peer)) return;
        const p = await K.pairFor(x.peer, K.pubOf(x.peer));
        if (!p) return;
        const id = F.me + "_" + await cx.part(p, "inbox-id", F.me, x.peer + "|" + x.kind + "|" + x.key + "|" + (x.kind === "res" ? "a" : x.e.r ? "s" : "c"));
        want[id] = 1;
        if (F.sent.s[id]) return;
        const s = await cx.side(p, "chal-" + x.kind + "-", F.me, x.peer), body = x.kind === "out" ? Object.assign({ cid: x.key }, x.e) : x.e, k = K.pruneAt(x.e.at);
        make.push({ id, to: x.peer, k, d: Object.assign({ from: F.me, kind: x.kind === "out" ? "chal" : "res" }, await cx.seal(s.key, body, K.chalAad(x.kind, F.me, x.peer, id)), { at: now, k }) });
      }));
      if (key !== F.key) return pushWire();
      const gone = Object.keys(F.sent.s).filter((id) => !want[id] && !(peers.indexOf(F.sent.s[id].t) >= 0 && !known[F.sent.s[id].t]));
      if (!make.length && !gone.length) return;
      let retry = null;
      await Promise.all(make.map((m) => write(() => M.set(itemDoc(m.to, m.id), m.d)).then(() => { F.sent.s[m.id] = { t: m.to, k: m.k }; }, (e) => {
        if (e.code === "denied") F.sent.s[m.id] = { t: m.to, k: m.k }; else retry = e;
      })));
      await Promise.all(gone.map((id) => {
        const g = F.sent.s[id];
        if (g.k < now) { delete F.sent.s[id]; return null; }
        return write(() => M.del(itemDoc(g.t, id))).then(() => { delete F.sent.s[id]; }, (e) => { if (e.code === "denied") delete F.sent.s[id]; else retry = e; });
      }));
      await F.sentRef.set(F.sent);
      if (retry) throw retry;
    });

    function pubDoc() {
      const d = { x: F.key.x, y: F.key.y, at: Date.now() }, a = W.account();
      if (K.nameOn() && a && a.name && a.name.trim()) d.n = a.name.trim().slice(0, 40);
      if (F.fr.share.on && F.cx) d.s = true;
      return d;
    }

    /** Name and sharing flag of a pub doc, or the wanted ones when called without a doc. */
    function pubMeta(d) {
      if (d === undefined) return F.frReady ? K.canon(metaOf(pubDoc())) : F.pubMeta;
      return K.canon(metaOf(d));
    }

    W.on((kind) => {
      if (kind === "auth") { gen++; K.reset(); K.status("off"); codeMine = null; connect(); }
      if (kind === "ui" && F.st.mode === "signedout") K.repaint();
    });
    M.on((kind) => {
      if (kind === "rest" && (F.st.mode === "ready" || F.st.mode === "connecting")) K.onSubErr({ code: "resting" });
      if (kind === "wake" && F.st.mode === "resting") connect();
    });
    addEventListener("offline", () => { if (F.st.mode === "ready" || F.st.mode === "connecting") K.onSubErr({ code: "unavailable" }); });
    addEventListener("online", () => { if (F.st.mode === "offline") { clearTimeout(F.revive); connect(); } });

    return {
      connect, refs, subs, loaded, down, pubIn, pubDoc, meta: pubMeta, resubCards, readCard, writeCard, delCard, ensureCode, makeCode, findCode, readChals, pushWire,
      gap: CARD_GAP, anon: (code) => (code ? "Gardener " + K.fmtCode(code) : "Gardener"), tx: TX, search: false,
      signIn: hooks.signIn || null, busy: () => !!W.busy(), glogo: hooks.glogo || ""
    };
  };
})(window);
