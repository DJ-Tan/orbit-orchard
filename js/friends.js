(function (root) {
  "use strict";

  const DAY = 864e5;
  const TTL = 7 * DAY, KEEP = 21 * DAY, TOMB = 120 * DAY, GRACE = 3600000;
  const MAX_OPEN = 10, MAX_OUT = 30, MAX_RES = 60, MAX_FRIENDS = 60, MAX_PER_SENDER = 30;
  const CARD_GAP = 60000, CARD_WAIT = 4000, REWRAP = 1000, SALT = "orchard-card-v2";
  const CODE_ABC = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  const TIERS = ["bronze", "silver", "gold", "platinum"];
  const STATS = { stars: 9999, cleared: 999, worlds: 20, golden: 999, streak: 9999, best: 9999, trophies: 999 };

  const isObj = (v) => v != null && typeof v === "object" && !Array.isArray(v);
  const obj = (v) => (isObj(v) ? v : {});
  const num = (v) => (typeof v === "number" && isFinite(v) ? v : 0);
  const clone = (v) => JSON.parse(JSON.stringify(v == null ? null : v));
  const int = (v, lo, hi) => (typeof v === "number" && isFinite(v) && Math.floor(v) === v && v >= lo && v <= hi ? v : null);
  const uniq = (a) => a.filter((x, i) => a.indexOf(x) === i);

  /** Serializes a value with sorted keys so equal states compare equal. */
  function canon(v) {
    if (Array.isArray(v)) return "[" + v.map(canon).join(",") + "]";
    if (isObj(v)) return "{" + Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}";
    return JSON.stringify(v === undefined ? null : v);
  }

  const validId = (s) => typeof s === "string" && s.length > 0 && s.length <= 200 && /^[A-Za-z0-9_\-.~:@+]+$/.test(s) && s !== "." && s !== "..";
  const validCid = (s) => typeof s === "string" && /^[a-z0-9]{6,16}$/.test(s);
  const codeOk = (c) => typeof c === "string" && c.length === 6 && c.split("").every((ch) => CODE_ABC.indexOf(ch) >= 0);
  const dayOk = (k) => typeof k === "string" && /^\d{8}$/.test(k);

  function randStr(abc, n) {
    let s = "";
    for (let i = 0; i < n; i++) s += abc[Math.floor(Math.random() * abc.length)];
    return s;
  }
  const newCode = () => randStr(CODE_ABC, 6);
  const newCid = () => randStr("abcdefghijklmnopqrstuvwxyz0123456789", 10);
  const randSeed = () => 100000 + Math.floor(Math.random() * 900000);
  const fmtCode = (c) => (codeOk(c) ? c.slice(0, 3) + "-" + c.slice(3) : "");

  /** Normalizes typed input into a friend code, or null. */
  function parseCode(s) {
    const c = String(s == null ? "" : s).toUpperCase().replace(/[^A-Z0-9]/g, "");
    return codeOk(c) ? c : null;
  }

  function cleanFriends(d) {
    d = obj(d);
    const out = { v: 1, f: {}, share: { on: false, nectar: false, at: 0 }, code: null };
    Object.keys(obj(d.f)).forEach((id) => {
      const e = d.f[id];
      if (!validId(id) || !isObj(e) || !(num(e.at) > 0)) return;
      const r = { at: e.at };
      if (e.del) r.del = 1;
      else if (codeOk(e.code)) r.code = e.code;
      out.f[id] = r;
    });
    const s = obj(d.share);
    out.share = { on: !!s.on, nectar: !!s.nectar, at: num(s.at) };
    const c = obj(d.code);
    if (codeOk(c.c) && num(c.at) > 0) out.code = { c: c.c, at: c.at };
    if (isObj(d.nm) && num(d.nm.at) > 0) out.nm = { on: !!d.nm.on, at: d.nm.at };
    return out;
  }

  function newer(x, y) {
    if (num(x.at) !== num(y.at)) return num(x.at) > num(y.at) ? x : y;
    if (!!x.del !== !!y.del) return x.del ? x : y;
    return canon(x) >= canon(y) ? x : y;
  }

  /** Merges two friend lists: per-friend last-write-wins with tombstones, sharing and code by newest. */
  function mergeFriends(a, b) {
    a = cleanFriends(a); b = cleanFriends(b);
    const f = {};
    Object.keys(a.f).concat(Object.keys(b.f)).forEach((id) => {
      if (f[id]) return;
      f[id] = clone(!a.f[id] ? b.f[id] : !b.f[id] ? a.f[id] : newer(a.f[id], b.f[id]));
    });
    const share = clone(newer(a.share, b.share));
    const code = !a.code ? clone(b.code) : !b.code ? clone(a.code) : a.code.at !== b.code.at ? clone(a.code.at > b.code.at ? a.code : b.code) : clone(a.code.c <= b.code.c ? a.code : b.code);
    const out = { v: 1, f, share, code };
    if (a.nm || b.nm) out.nm = clone(!a.nm ? b.nm : !b.nm ? a.nm : newer(a.nm, b.nm));
    return out;
  }

  /** Drops tombstones older than the keep window. */
  function pruneFriends(d, now) {
    const out = cleanFriends(d);
    Object.keys(out.f).forEach((id) => { if (out.f[id].del && now - out.f[id].at > TOMB) delete out.f[id]; });
    return out;
  }

  const friendIds = (d) => Object.keys(obj(d && d.f)).filter((id) => !d.f[id].del).sort((x, y) => d.f[y].at - d.f[x].at);

  /** Builds the public card body from a progress summary. */
  function buildCard(sum, uid, day, withNectar) {
    const c = { v: 1, u: uid, day: day };
    Object.keys(STATS).forEach((k) => { c[k] = Math.max(0, Math.min(STATS[k], Math.floor(num(sum[k])))); });
    c.tiers = {};
    TIERS.forEach((t) => { c.tiers[t] = Math.max(0, Math.min(999, Math.floor(num(obj(sum.tiers)[t])))); });
    c.ws = (sum.ws || []).slice(0, 10).map((v) => Math.max(0, Math.min(999, Math.floor(num(v)))));
    c.wc = (sum.wc || []).slice(0, 10).map((v) => Math.max(0, Math.min(999, Math.floor(num(v)))));
    if (withNectar) c.nectar = Math.max(0, Math.min(1e7, Math.floor(num(sum.nectar))));
    return c;
  }

  /** Validates another player's card; null unless it is well formed and belongs to `id`. */
  function cleanCard(id, d) {
    if (!validId(id) || !isObj(d) || d.u !== id) return null;
    const c = { u: id };
    const keys = Object.keys(STATS);
    for (let i = 0; i < keys.length; i++) {
      const v = int(d[keys[i]], 0, STATS[keys[i]]);
      if (v == null && (keys[i] === "stars" || keys[i] === "cleared")) return null;
      c[keys[i]] = v == null ? 0 : v;
    }
    const t = obj(d.tiers);
    c.tiers = {};
    TIERS.forEach((k) => { c.tiers[k] = int(t[k], 0, 999) || 0; });
    const arr = (a) => (Array.isArray(a) ? a.slice(0, 10).map((v) => int(v, 0, 999) || 0) : []);
    c.ws = arr(d.ws);
    c.wc = arr(d.wc);
    c.day = dayOk(d.day) ? d.day : null;
    c.nectar = d.nectar == null ? null : int(d.nectar, 0, 1e7);
    return c;
  }

  const b64ok = (s, n) => typeof s === "string" && s.length === n && /^[A-Za-z0-9_-]+$/.test(s);
  const pubFp = (k) => (k ? k.x + "." + k.y : "");
  const aadOf = (from, to) => SALT + "|" + from + "|" + to;

  /** Validates a published public key; null unless it belongs to `id`. */
  function cleanPub(id, d) {
    if (!validId(id) || !isObj(d) || d.u !== id || !b64ok(d.x, 43) || !b64ok(d.y, 43)) return null;
    return { x: d.x, y: d.y };
  }

  /** Validates a stored private key document. */
  function cleanPriv(d) {
    const j = obj(obj(d).jwk);
    return j.kty === "EC" && j.crv === "P-256" && b64ok(j.x, 43) && b64ok(j.y, 43) && b64ok(j.d, 43) ? { x: j.x, y: j.y, d: j.d } : null;
  }

  /** Validates an encrypted card envelope; null for v1, foreign or malformed docs. */
  function cleanSealed(id, d) {
    if (!validId(id) || !isObj(d) || d.v !== 2 || d.u !== id || !isObj(d.w)) return null;
    const w = {};
    Object.keys(d.w).forEach((t) => {
      const e = d.w[t];
      if (b64ok(t, 16) && isObj(e) && b64ok(e.iv, 16) && typeof e.ct === "string" && e.ct.length <= 8192 && /^[A-Za-z0-9_-]+$/.test(e.ct)) w[t] = { iv: e.iv, ct: e.ct };
    });
    return { at: num(d.at), w };
  }

  /** Lists followed players with a valid published key, sorted. */
  const cardRecips = (fr, pubs) => friendIds(fr).slice(0, MAX_FRIENDS).filter((id) => isObj(pubs[id]) && b64ok(pubs[id].x, 43) && b64ok(pubs[id].y, 43)).sort();
  const recipSig = (mine, to, pubs) => canon([pubFp(mine), to.map((id) => [id, pubFp(pubs[id])])]);

  function cleanResult(r) {
    if (!isObj(r)) return null;
    const used = int(r.used, 0, 99), stars = int(r.stars, 1, 3), pollen = int(r.pollen, 0, 9), pt = int(r.pt, 0, 9), at = num(r.at);
    const time = typeof r.time === "number" && isFinite(r.time) && r.time >= 0 && r.time <= 86400 ? Math.round(r.time * 10) / 10 : null;
    if (used == null || stars == null || pollen == null || time == null || !(at > 0)) return null;
    const o = { used, stars, pollen, pt: pt == null ? 0 : Math.max(pt, pollen), time, at };
    if (r.assist) o.assist = true;
    return o;
  }

  /** Orders two results: negative when `a` wins (fewer seeds, then more pollen, then less time). */
  function cmpResult(a, b) {
    if (a.used !== b.used) return a.used - b.used;
    if (a.pollen !== b.pollen) return b.pollen - a.pollen;
    if (a.time !== b.time) return a.time - b.time;
    return 0;
  }

  function cleanOut(cid, e) {
    if (!validCid(cid) || !isObj(e) || !validId(e.to)) return null;
    const seed = int(e.seed, 0, 2147483647), diff = int(e.diff, 1, 5), at = num(e.at), exp = num(e.exp);
    if (seed == null || diff == null || !(at > 0) || !(exp > at) || exp - at > TTL + GRACE) return null;
    const o = { to: e.to, seed, diff, at, exp };
    if (e.rnd) o.rnd = 1;
    const r = cleanResult(e.r);
    if (r) o.r = r;
    return o;
  }

  function cleanRes(key, e) {
    if (!isObj(e) || !validId(e.by) || !validCid(e.cid) || key !== e.by + "~" + e.cid) return null;
    const seed = int(e.seed, 0, 2147483647), diff = int(e.diff, 1, 5), at = num(e.at);
    if (seed == null || diff == null || !(at > 0)) return null;
    const o = { by: e.by, cid: e.cid, seed, diff, at };
    if (e.no) { o.no = 1; return o; }
    const r = cleanResult(e.r);
    if (!r) return null;
    o.r = r;
    return o;
  }

  /** Keeps only well-formed outgoing challenges and answers from a challenge document. */
  function cleanChal(d) {
    d = obj(d);
    const out = {}, res = {};
    Object.keys(obj(d.out)).forEach((k) => { const e = cleanOut(k, d.out[k]); if (e) out[k] = e; });
    Object.keys(obj(d.res)).forEach((k) => { const e = cleanRes(k, d.res[k]); if (e) res[k] = e; });
    return { v: 1, out, res };
  }

  const earlier = (x, y) => (!x ? y : !y ? x : x.at < y.at || (x.at === y.at && canon(x) <= canon(y)) ? x : y);

  /** Merges two copies of one player's challenge document; the first recorded result or answer stays. */
  function mergeChal(a, b) {
    a = cleanChal(a); b = cleanChal(b);
    const out = {}, res = {};
    Object.keys(a.out).concat(Object.keys(b.out)).forEach((k) => {
      if (out[k]) return;
      const x = a.out[k], y = b.out[k];
      if (!x || !y) { out[k] = clone(x || y); return; }
      const o = clone(earlier(x, y));
      delete o.r;
      const r = earlier(x.r, y.r);
      if (r) o.r = clone(r);
      out[k] = o;
    });
    Object.keys(a.res).concat(Object.keys(b.res)).forEach((k) => {
      if (!res[k]) res[k] = clone(earlier(a.res[k], b.res[k]));
    });
    return { v: 1, out, res };
  }

  /** Prunes old entries, caps sizes and rebuilds the `to`/`from` query indexes. */
  function finishChal(d, now) {
    const c = cleanChal(d);
    Object.keys(c.out).forEach((k) => { if (now - c.out[k].at > KEEP) delete c.out[k]; });
    let ks = Object.keys(c.out).sort((x, y) => c.out[x].at - c.out[y].at);
    while (ks.length > MAX_OUT) delete c.out[ks.shift()];
    Object.keys(c.res).forEach((k) => { if (now - c.res[k].at > KEEP) delete c.res[k]; });
    ks = Object.keys(c.res).sort((x, y) => c.res[x].at - c.res[y].at);
    while (ks.length > MAX_RES) delete c.res[ks.shift()];
    c.to = uniq(Object.keys(c.out).map((k) => c.out[k].to)).sort();
    c.from = uniq(Object.keys(c.res).map((k) => c.res[k].by)).sort();
    return c;
  }

  /** Outcome of one challenge: open, done, walkover, declined, expired or void, with the winner side. */
  function verdict(c, now) {
    const sr = c.sr && c.sr.at <= c.exp + GRACE ? c.sr : null;
    const rr = c.rr && c.rr.at <= c.exp + GRACE ? c.rr : null;
    if (rr && rr.no) return { state: "declined", sr: sr, rv: null };
    const rv = rr && rr.r && rr.seed === c.seed && rr.diff === c.diff ? rr.r : null;
    if (rr && !rv) return { state: "void", sr: sr, rv: null };
    if (sr && rv) { const k = cmpResult(sr, rv); return { state: "done", win: k < 0 ? "s" : k > 0 ? "r" : "draw", sr: sr, rv: rv }; }
    if (now <= c.exp) return { state: "open", sr: sr, rv: rv };
    if (sr || rv) return { state: "walkover", win: sr ? "s" : "r", sr: sr, rv: rv };
    return { state: "expired", sr: null, rv: null };
  }

  /** Lists challenges sent to `me` from senders' documents, newest first. */
  function incomingOf(docs, mine, me) {
    const list = [];
    Object.keys(docs).forEach((from) => {
      if (from === me || !validId(from)) return;
      const d = cleanChal(docs[from]);
      Object.keys(d.out).filter((cid) => d.out[cid].to === me).sort((x, y) => d.out[y].at - d.out[x].at).slice(0, MAX_PER_SENDER).forEach((cid) => {
        const e = d.out[cid];
        list.push({ cid, from, to: me, seed: e.seed, diff: e.diff, at: e.at, exp: e.exp, rnd: !!e.rnd, sr: e.r || null, rr: mine.res[from + "~" + cid] || null });
      });
    });
    return list.sort((x, y) => y.at - x.at);
  }

  /** Lists my outgoing challenges joined with each recipient's answer. */
  function outgoingOf(mine, docs, me) {
    return Object.keys(mine.out).map((cid) => {
      const e = mine.out[cid], d = docs[e.to] ? cleanChal(docs[e.to]) : null;
      return { cid, from: me, to: e.to, seed: e.seed, diff: e.diff, at: e.at, exp: e.exp, rnd: !!e.rnd, sr: e.r || null, rr: d ? d.res[me + "~" + cid] || null : null };
    }).sort((x, y) => y.at - x.at);
  }

  const openCount = (list, now) => list.filter((c) => verdict(c, now).state === "open").length;

  const chalAad = (kind, from, to, id) => "orchard-chal-v2|" + kind + "|" + from + "|" + to + "|" + id;
  const pruneAt = (at) => Math.ceil((num(at) + KEEP) / 3600000) * 3600000;
  const wireEntry = (e) => (isObj(e) && b64ok(e.t, 16) && b64ok(e.iv, 16) && typeof e.ct === "string" && e.ct.length <= 8192 && /^[A-Za-z0-9_-]+$/.test(e.ct) && num(e.k) > 0 ? { t: e.t, iv: e.iv, ct: e.ct, k: e.k } : null);

  /** Validates an encrypted challenge document; null for v1, foreign or malformed docs. */
  function cleanWire(id, d) {
    if (!validId(id) || !isObj(d) || d.v !== 2 || d.u !== id) return null;
    const out = {}, res = {};
    Object.keys(obj(d.out)).forEach((k) => { const e = validCid(k) && wireEntry(d.out[k]); if (e) out[k] = e; });
    Object.keys(obj(d.res)).forEach((k) => { const e = b64ok(k, 16) && wireEntry(d.res[k]); if (e) res[k] = e; });
    return { at: num(d.at), out, res };
  }

  /** Lists each entry of my challenge state with the peer it is sealed for. */
  function chalTargets(M, me) {
    const c = cleanChal(M), list = [];
    Object.keys(c.out).forEach((k) => { if (c.out[k].to !== me) list.push({ kind: "out", key: k, peer: c.out[k].to, e: c.out[k] }); });
    Object.keys(c.res).forEach((k) => { if (c.res[k].by !== me) list.push({ kind: "res", key: k, peer: c.res[k].by, e: c.res[k] }); });
    return list;
  }

  /** Validates a decrypted entry addressed to `me`; returns its in-memory key and body, or null. */
  function chalEntry(kind, id, e, me) {
    if (kind === "out") { const o = cleanOut(id, e); return o && o.to === me ? [id, o] : null; }
    const k = isObj(e) && e.by + "~" + e.cid, r = k && cleanRes(k, e);
    return r && r.by === me ? [k, r] : null;
  }

  /** Canonical public JWK in RFC 7638 member order; its SHA-256 is the key fingerprint. */
  const jwkCanon = (k) => '{"crv":"P-256","kty":"EC","x":"' + k.x + '","y":"' + k.y + '"}';

  function cleanPins(d) {
    const out = { v: 1, p: {} };
    Object.keys(obj(obj(d).p)).forEach((id) => {
      const e = d.p[id];
      if (validId(id) && isObj(e) && b64ok(e.fp, 43) && num(e.at) > 0) out.p[id] = e.ok ? { fp: e.fp, at: e.at, ok: 1 } : { fp: e.fp, at: e.at };
    });
    return out;
  }

  /** Merges two pin lists per peer by newest `at`. */
  function mergePins(a, b) {
    a = cleanPins(a); b = cleanPins(b);
    const p = {};
    Object.keys(a.p).concat(Object.keys(b.p)).forEach((id) => { if (!p[id]) p[id] = clone(!a.p[id] ? b.p[id] : !b.p[id] ? a.p[id] : newer(a.p[id], b.p[id])); });
    return { v: 1, p };
  }

  /** A peer's current fingerprint against its pin: new, ok or changed. */
  const pinState = (pin, fp) => (!pin ? "new" : pin.fp === fp ? "ok" : "changed");

  /** Pins `fp` for `id`; `ok` marks it verified, and any earlier verification is dropped otherwise. */
  function setPin(pins, id, fp, now, ok) {
    const out = cleanPins(pins);
    out.p[id] = ok ? { fp, at: now, ok: 1 } : { fp, at: now };
    return out;
  }

  /** Text hashed for a safety code; the same whichever side computes it. */
  const safetyInput = (a, fa, b, fb) => "orchard-safety-v1\n" + [a + "|" + fa, b + "|" + fb].sort().join("\n");

  /** Formats the first 9 bytes of a hash as 12 digits in groups of 4. */
  function safetyDigits(h) {
    const g = [];
    for (let i = 0; i < 3; i++) g.push(String(((h[3 * i] << 16) | (h[3 * i + 1] << 8) | h[3 * i + 2]) % 10000).padStart(4, "0"));
    return g.join(" ");
  }

  /** Short FNV-1a hash of an id in base 36. */
  function palHash(s) {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
    return h.toString(36);
  }

  /** Trophy event keys my Friends state proves: f follow, c challenge sent, p challenge answered, m:<peer> card seen, w:<peer>:<cid> win. */
  function palKeys(o) {
    const me = o.me, other = (id) => validId(id) && id !== me, keys = [], ids = friendIds(o.fr).filter(other);
    if (ids.length) keys.push("f");
    ids.forEach((id) => { const s = o.cards[id]; if (s && s.st === "ok" && s.c && s.c.u === id) keys.push("m:" + palHash(id)); });
    if (Object.keys(o.mine.out).some((k) => other(o.mine.out[k].to))) keys.push("c");
    o.inc.forEach((c) => {
      if (!other(c.from)) return;
      const v = verdict(c, o.now);
      if (v.rv) keys.push("p");
      if (v.state === "done" && v.win === "r") keys.push("w:" + palHash(c.from) + ":" + c.cid);
    });
    o.out.forEach((c) => {
      const v = other(c.to) && verdict(c, o.now);
      if (v && v.state === "done" && v.win === "s") keys.push("w:" + palHash(c.to) + ":" + c.cid);
    });
    return uniq(keys);
  }

  const api = {
    TTL, KEEP, TOMB, MAX_OPEN, MAX_FRIENDS, CARD_GAP, canon, validId, validCid, codeOk, parseCode, fmtCode, newCode, newCid, randSeed,
    cleanFriends, mergeFriends, pruneFriends, friendIds, buildCard, cleanCard, cleanPub, cleanPriv, cleanSealed, cardRecips, recipSig, pubFp, aadOf, cleanResult, cmpResult, cleanChal, mergeChal, finishChal,
    verdict, incomingOf, outgoingOf, openCount, chalAad, pruneAt, cleanWire, chalTargets, chalEntry,
    jwkCanon, cleanPins, mergePins, pinState, setPin, safetyInput, safetyDigits, palHash, palKeys
  };
  if (typeof module === "object" && module.exports) { module.exports = api; return; }

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  let ui = null;
  const B = {};
  const fresh = () => ({
    st: { mode: "off" }, db: null, user: null, me: null, connecting: false, revive: 0, retries: 0,
    fr: cleanFriends({}), frRemote: null, frRaw: null, frReady: false, frRef: null,
    mine: cleanChal({}), mineRemote: null, mineRaw: null, mineReady: false, mineRef: null,
    inc: {}, outRes: {}, cards: {}, cardDocs: {}, cardSeen: {}, cardKey: "", cardSubs: [], subs: [],
    card: { last: null, at: 0, timer: 0, urgent: false, busy: false, exists: null, doc: null, to: [], rs: null }, cardRef: null, codeRef: null, codeChecked: false,
    cx: false, key: null, keyRef: null, keyRaw: undefined, pubRef: null, pubSeen: null, pubs: {}, pairs: {}, keysWait: 0,
    allPubs: {}, allReady: false, chalDocs: {}, chalGen: 0, dec: {}, wireRef: null, wireCur: undefined, wireV1: false,
    pins: cleanPins({}), pinsRemote: null, pinsRaw: null, pinsReady: false, pinsRef: null, fpOf: {}, myFp: null, codes: {}, safeOpen: {}, keyNote: false, keyFresh: false,
    built: "", view: {}, names: {}, pending: null, raf: 0, hits: [], q: ""
  });
  const F = Object.assign(fresh(), { el: null });

  const EC = { name: "ECDH", namedCurve: "P-256" };
  const S = () => root.crypto.subtle;
  const utf8 = (s) => new TextEncoder().encode(s);
  const b64u = (b) => btoa(Array.from(new Uint8Array(b), (c) => String.fromCharCode(c)).join("")).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
  const hasCx = () => { try { return !!(root.crypto && root.crypto.subtle && root.TextEncoder && root.isSecureContext !== false); } catch (e) { return false; } };

  const cx = {
    /** Makes a new ECDH P-256 key pair. */
    async gen() {
      const k = await S().generateKey(EC, true, ["deriveBits"]), j = await S().exportKey("jwk", k.privateKey);
      return cx.load({ jwk: { kty: "EC", crv: "P-256", x: j.x, y: j.y, d: j.d } });
    },
    /** Imports a stored private key; null unless it matches its own public half. */
    async load(doc) {
      const j = cleanPriv(doc);
      if (!j) return null;
      try {
        const priv = await S().importKey("jwk", { kty: "EC", crv: "P-256", x: j.x, y: j.y, d: j.d, ext: true }, EC, false, ["deriveBits"]);
        const e = await S().generateKey(EC, false, ["deriveBits"]);
        const a = await S().deriveBits({ name: "ECDH", public: e.publicKey }, priv, 256), b = await S().deriveBits({ name: "ECDH", public: await cx.pub(j) }, e.privateKey, 256);
        return b64u(a) === b64u(b) ? { priv, x: j.x, y: j.y, d: j.d } : null;
      } catch (e) { return null; }
    },
    pub: (k) => S().importKey("jwk", { kty: "EC", crv: "P-256", x: k.x, y: k.y, ext: true }, EC, false, []),
    /** Derives the shared HKDF base with a peer's public key; null for a bad key. */
    async pair(mine, pk) {
      try {
        const bits = await S().deriveBits({ name: "ECDH", public: await cx.pub(pk) }, mine.priv, 256);
        return { base: await S().importKey("raw", bits, "HKDF", false, ["deriveKey", "deriveBits"]), memo: {} };
      } catch (e) { return null; }
    },
    /** One derived value for a direction, cached on the pair: an AES-GCM key for labels ending in "key", else a 16-char tag. */
    part(p, label, a, b) {
      const k = label + "|" + a + "|" + b, h = { name: "HKDF", hash: "SHA-256", salt: utf8(SALT), info: utf8(k) };
      if (!p.memo[k]) p.memo[k] = /key$/.test(label) ? S().deriveKey(h, p.base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]) : S().deriveBits(h, p.base, 96).then(b64u);
      return p.memo[k];
    },
    /** The key and tag for one direction; `kind` is "" for cards, "chal-out-" or "chal-res-" for challenges. */
    async side(p, kind, a, b) { return { key: await cx.part(p, kind + "key", a, b), tag: await cx.part(p, kind + "tag", a, b) }; },
    rid: (p, a, b, key) => cx.part(p, "chal-rid", a, b + "|" + key),
    thumb: async (k) => b64u(await S().digest("SHA-256", utf8(jwkCanon(k)))),
    safety: async (a, fa, b, fb) => safetyDigits(new Uint8Array(await S().digest("SHA-256", utf8(safetyInput(a, fa, b, fb))))),
    async seal(key, body, aad) {
      const iv = root.crypto.getRandomValues(new Uint8Array(12));
      const ct = await S().encrypt({ name: "AES-GCM", iv, additionalData: utf8(aad) }, key, utf8(JSON.stringify(body)));
      return { iv: b64u(iv), ct: b64u(ct) };
    },
    async open(key, e, aad) {
      try { return JSON.parse(new TextDecoder().decode(await S().decrypt({ name: "AES-GCM", iv: unb64u(e.iv), additionalData: utf8(aad) }, key, unb64u(e.ct)))); }
      catch (err) { return null; }
    },
    /** Seals my challenge state for each peer with a key, reusing entries of `old` that still decrypt to the same body. */
    async sealChal(M, me, pairOf, old, open) {
      const out = {}, res = {};
      open = open || cx.open;
      await Promise.all(chalTargets(M, me).map(async (x) => {
        const p = await pairOf(x.peer);
        if (!p) return;
        const s = await cx.side(p, "chal-" + x.kind + "-", me, x.peer), id = x.kind === "out" ? x.key : await cx.rid(p, me, x.peer, x.key);
        const k = pruneAt(x.e.at), aad = chalAad(x.kind, me, x.peer, id), o = old && old[x.kind][id];
        const same = o && o.t === s.tag && o.k === k && canon(await open(s.key, o, aad)) === canon(x.e);
        (x.kind === "out" ? out : res)[id] = same ? o : Object.assign({ t: s.tag }, await cx.seal(s.key, x.e, aad), { k });
      }));
      return { out, res };
    },
    /** Decrypts the entries of peer `u`'s challenge document that are addressed to `me`. */
    async openChal(d, u, me, p, open) {
      const got = { out: {}, res: {} };
      open = open || cx.open;
      await Promise.all(["out", "res"].map(async (kind) => {
        const tag = await cx.part(p, "chal-" + kind + "-tag", u, me), ids = Object.keys(d[kind]).filter((id) => d[kind][id].t === tag);
        if (!ids.length) return;
        const key = await cx.part(p, "chal-" + kind + "-key", u, me);
        await Promise.all(ids.map(async (id) => {
          const r = chalEntry(kind, id, await open(key, d[kind][id], chalAad(kind, u, me, id)), me);
          if (r) got[kind][r[0]] = r[1];
        }));
      }));
      return got;
    }
  };

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const ic = (n, cls) => (ui ? ui.ic(n, cls) : "");
  const note = (t, tone) => { if (ui) ui.note(t, tone); };
  const diffName = (d) => (ui && ui.DIFF[d - 1]) || "Sky " + d;
  const nameOf = (id) => F.names[id] || B.anon(F.fr.f[id] && F.fr.f[id].code, false);
  const plural = (n, w) => n + " " + w + (n === 1 ? "" : "s");

  function status(mode, reason) {
    F.st = { mode, reason: reason || "" };
    renderSoon();
  }

  function connect() { return B.connect(); }

  async function connectClaude() {
    if (F.connecting) return;
    F.connecting = true;
    try {
      const c = root.claude;
      if (!c || typeof c.use !== "function") return status("local");
      let db = null, user = null;
      try { const r = await Promise.all([c.use("db"), c.use("user")]); db = r[0]; user = r[1]; } catch (e) { db = null; }
      if (!db || !user) return status(await permMode(c));
      let id = null, can = null;
      try { id = await user.id(); } catch (e) { id = null; }
      if (!validId(id)) return status("signedout");
      try { can = await user.can("data.write"); } catch (e) { can = null; }
      F.db = db; F.user = user; F.me = id; F.cx = hasCx();
      if (can === false) return status("readonly");
      status("connecting");
      subscribe();
    } finally { F.connecting = false; }
  }

  async function permMode(c) {
    let p = null, s = null;
    try { p = await c.use("permissions"); } catch (e) { p = null; }
    F.perm = p;
    if (p) try { s = await Promise.all([p.state("db"), p.state("user")]); } catch (e) { s = null; }
    if (!s) return "absent";
    if (s.indexOf("denied") >= 0) return "denied";
    if (s.indexOf("prompt") >= 0) return "ask";
    return F.granted && s.every((x) => x === "granted") ? "reload" : "absent";
  }

  async function allow(panel) {
    const p = F.perm;
    if (!p) return;
    try { if (panel) await p.manage(); else await p.request(["db", "user"]); }
    catch (e) { note("Turn on Database and User in this page's Permissions menu", "info"); return; }
    F.granted = true;
    status("off"); teardown(); await connect();
    if (ui && ui.cloudRetry) ui.cloudRetry();
  }

  function subscribe() {
    const db = F.db, me = F.me;
    try {
      F.frRef = db.doc("data/users/" + me + "/friends");
      F.mineRef = db.doc("data/users/" + me + "/chal");
      F.keyRef = db.doc("data/users/" + me + "/keys");
      F.pinsRef = db.doc("data/users/" + me + "/pins");
      B.refs();
      if (F.cx) { F.subs.push(F.keyRef.onSnapshot(onKey, onSubErr)); F.subs.push(F.pubRef.onSnapshot(onPub, onSubErr)); F.subs.push(F.pinsRef.onSnapshot(onPins, onSubErr)); }
      F.subs.push(F.frRef.onSnapshot(onFriends, onSubErr));
      F.subs.push(F.mineRef.onSnapshot(onMine, onSubErr));
      B.subs();
    } catch (e) { teardown(); return status("error"); }
    B.loaded();
  }

  function refsClaude() {
    const db = F.db, me = F.me;
    F.wireRef = db.doc("chal/" + me);
    F.cardRef = db.doc("cards/" + me);
    F.codeRef = db.doc("codes/" + me);
    F.pubRef = db.doc("keys/" + me);
  }

  function subsClaude() {
    if (!F.cx) return;
    F.subs.push(F.db.collection("chal").orderBy("at", "desc").limit(1000).onSnapshot(onChals, onSubErr));
    F.subs.push(F.db.collection("keys").orderBy("at", "desc").limit(1000).onSnapshot(onKeys, onSubErr));
  }

  function loadedClaude() {
    const me = F.me;
    F.wireRef.get().then((s) => {
      const raw = s.exists ? s.data() : null, w = raw && cleanWire(me, raw);
      if (raw && !w) { F.wireV1 = true; F.mine = mergeChal(F.mine, cleanChal(raw)); pushMine(); }
      F.wireCur = w || null;
      pushWire();
    }, () => { F.wireCur = null; });
    F.cardRef.get().then((s) => {
      F.card.exists = !!s.exists;
      F.card.doc = s.exists ? cleanSealed(me, s.data()) : null;
      F.card.last = null; F.card.rs = null;
      if (s.exists && !F.card.doc) delCard(); else syncCard();
    }, () => { F.card.exists = false; });
  }

  async function onKey(snap) {
    if (snap.metadata && (snap.metadata.hasPendingWrites || snap.metadata.fromCache)) return;
    const raw = snap.exists ? snap.data() : null, c = canon(raw);
    if (c === F.keyRaw) return;
    F.keyRaw = c;
    const k = raw ? await cx.load(raw) : null;
    if (F.keyRaw !== c) return;
    if (k) setKey(k); else newKey();
  }

  const newKey = serial(async () => {
    let k = null;
    try { k = await cx.gen(); } catch (e) { k = null; }
    if (!k) { F.cx = false; openCards(); syncCard(); renderSoon(); return; }
    const d = { v: 1, jwk: { kty: "EC", crv: "P-256", x: k.x, y: k.y, d: k.d }, at: Date.now() };
    F.keyRaw = canon(d);
    await F.keyRef.set(d);
    F.keyFresh = true;
    setKey(k);
  });

  function setKey(k) {
    if (F.key && pubFp(F.key) === pubFp(k)) return;
    F.key = k; F.pairs = {}; F.cardSeen = {};
    pushPub();
    refreshTrust();
  }

  function onPub(snap) {
    if (snap.metadata && (snap.metadata.hasPendingWrites || snap.metadata.fromCache)) return;
    F.pubSeen = pubFp(snap.exists ? B.pubIn(F.me, snap.data()) : null);
    if (B.meta) F.pubMeta = snap.exists ? B.meta(snap.data()) : null;
    pushPub();
  }

  const pushPub = serial(async () => {
    if (!F.key || F.pubSeen == null || !F.pubRef || (F.pubSeen === pubFp(F.key) && (!B.meta || F.pubMeta === B.meta()))) return;
    const moved = F.pubSeen !== pubFp(F.key);
    if (moved) {
      const s = await F.keyRef.get(), k = s.exists ? await cx.load(s.data()) : null;
      if (k && pubFp(k) !== pubFp(F.key)) { setKey(k); return; }
    }
    const replaced = moved && !!F.pubSeen && !F.keyFresh, d = B.pubDoc();
    await F.pubRef.set(d);
    F.pubSeen = pubFp(F.key); F.keyFresh = false;
    if (B.meta) F.pubMeta = B.meta(d);
    if (replaced) { F.keyNote = true; renderSoon(); }
  });
  const pubClaude = () => ({ u: F.me, x: F.key.x, y: F.key.y, at: Date.now() });

  function onPins(snap) {
    if (snap.metadata && snap.metadata.hasPendingWrites) return;
    const raw = snap.exists ? snap.data() : null, W = raw ? cleanPins(raw) : null;
    F.pins = mergePins(F.pins, W);
    if (snap.metadata && snap.metadata.fromCache) return;
    F.pinsRemote = W; F.pinsRaw = raw ? canon(raw) : null; F.pinsReady = true;
    if (canon(F.pins) !== canon(W || cleanPins({}))) pushPins();
    refreshTrust();
  }

  const pushPins = serial(async () => {
    if (!F.pinsReady || !F.pinsRef) return;
    const M = mergePins(F.pins, F.pinsRemote);
    if (F.pinsRaw === canon(M)) return;
    await F.pinsRef.set(M);
    F.pinsRemote = M; F.pinsRaw = canon(M); F.pins = mergePins(F.pins, M);
  });

  /** Fingerprints every known public key, then pins new peers and re-runs sharing. */
  function refreshTrust() {
    if (!F.cx) return;
    const all = Object.assign({}, F.allPubs, F.pubs), ps = [];
    if (F.key) all[F.me] = F.key;
    Object.keys(all).forEach((id) => {
      const k = pubFp(all[id]);
      if (F.fpOf[k] !== undefined) return;
      F.fpOf[k] = null;
      ps.push(cx.thumb(all[id]).then((fp) => { F.fpOf[k] = fp; }, () => { delete F.fpOf[k]; }));
    });
    if (ps.length) Promise.all(ps).then(trustChanged); else trustChanged();
  }

  function trustChanged() {
    F.myFp = (F.key && F.fpOf[pubFp(F.key)]) || null;
    autoPin();
    openCards();
    syncCard();
    B.readChals();
    B.pushWire();
    renderSoon();
  }

  const pinScope = () => uniq(friendIds(F.fr).concat(chalTargets(F.mine, F.me).map((x) => x.peer)));

  /** Pins the current key of every peer I share with that has no pin yet. */
  function autoPin() {
    if (!F.pinsReady) return;
    let n = 0;
    pinScope().forEach((id) => { const pk = pubOf(id), fp = pk && F.fpOf[pubFp(pk)]; if (fp && !F.pins.p[id]) { F.pins = setPin(F.pins, id, fp, Date.now()); n++; } });
    if (n) pushPins();
  }

  /** Trust in a peer's current key: none, wait, new, ok or changed. */
  function trustOf(id) {
    const pk = pubOf(id), fp = pk && F.fpOf[pubFp(pk)];
    if (!pk) return "none";
    if (!F.pinsReady || !fp) return "wait";
    return pinState(F.pins.p[id], fp);
  }
  const trusted = (id) => { const t = trustOf(id); return t === "ok" || t === "new"; };
  const settled = (ids) => ids.every((id) => trustOf(id) !== "wait");
  const sharePubs = () => { const m = {}; Object.keys(F.pubs).forEach((id) => { if (trusted(id)) m[id] = F.pubs[id]; }); return m; };

  function acceptKey(id) {
    const pk = pubOf(id), fp = pk && F.fpOf[pubFp(pk)];
    if (!fp) return;
    F.pins = setPin(F.pins, id, fp, Date.now());
    pushPins();
    trustChanged();
    note(`Sharing with ${nameOf(id)} again`, "good");
  }

  function setVerified(id, on) {
    const pk = pubOf(id), fp = pk && F.fpOf[pubFp(pk)];
    if (!fp || trustOf(id) === "changed") return;
    F.pins = setPin(F.pins, id, fp, Date.now(), on);
    pushPins();
    renderSoon();
  }

  /** The 12-digit safety code for me and `id`, filled in once computed. */
  function safetyFor(id) {
    const pk = pubOf(id), fp = pk && F.fpOf[pubFp(pk)];
    if (!fp || !F.myFp) return "";
    const k = id + "|" + fp + "|" + F.myFp;
    if (F.codes[k] === undefined) { F.codes[k] = null; cx.safety(F.me, F.myFp, id, fp).then((c) => { F.codes[k] = c; renderSoon(); }, () => {}); }
    return F.codes[k] || "";
  }

  function pairFor(id, pk) {
    const k = id + "|" + pubFp(pk);
    if (!F.pairs[k]) F.pairs[k] = cx.pair(F.key, pk);
    return F.pairs[k];
  }

  const pubOf = (id) => F.pubs[id] || F.allPubs[id] || null;
  const canChal = (id) => F.cx && trusted(id);

  function onChals(snap) {
    if (snap.metadata && snap.metadata.fromCache) return;
    const m = {};
    snap.docs.forEach((d) => {
      const w = cleanWire(d.id, d.data());
      if (!w) return;
      if (d.id !== F.me) m[d.id] = w;
      else if (F.wireCur !== undefined) F.wireCur = w;
    });
    F.chalDocs = m;
    readChals();
    pushWire();
  }

  function onKeys(snap) {
    if (snap.metadata && snap.metadata.fromCache) return;
    const m = {};
    snap.docs.forEach((d) => { const k = cleanPub(d.id, d.data()); if (k) m[d.id] = k; });
    F.allPubs = m; F.allReady = true;
    refreshTrust();
  }

  /** Decrypt cache keyed by additional data and ciphertext. */
  const openMemo = (key, e, aad) => { const k = aad + "|" + e.iv + "|" + e.ct; return F.dec[k] || (F.dec[k] = cx.open(key, e, aad)); };

  /** Rebuilds incoming challenges and answers from every peer document that holds entries for me. */
  async function readChals() {
    const gen = ++F.chalGen;
    if (!F.cx || !F.key) return;
    const inc = {}, outRes = {}, fresh = [];
    await Promise.all(Object.keys(F.chalDocs).map(async (u) => {
      const d = F.chalDocs[u], pk = pubOf(u), t = trustOf(u);
      if (!pk || (!Object.keys(d.out).length && !Object.keys(d.res).length)) return;
      if (t === "changed" || t === "wait") { if (F.inc[u]) inc[u] = F.inc[u]; if (F.outRes[u]) outRes[u] = F.outRes[u]; return; }
      const p = await pairFor(u, pk), got = p && await cx.openChal(d, u, F.me, p, openMemo);
      if (got && Object.keys(got.out).length) inc[u] = { v: 1, out: got.out, res: {} };
      if (got && Object.keys(got.res).length) outRes[u] = { v: 1, out: {}, res: got.res };
      if ((inc[u] || outRes[u]) && t === "new") fresh.push(u);
    }));
    if (gen !== F.chalGen) return;
    fresh.forEach((u) => { const fp = F.fpOf[pubFp(pubOf(u))]; if (fp && !F.pins.p[u]) F.pins = setPin(F.pins, u, fp, Date.now()); });
    if (fresh.length) pushPins();
    if (Object.keys(F.dec).length > 4000) F.dec = {};
    F.inc = inc; F.outRes = outRes;
    renderSoon();
  }

  const pushWire = serial(async () => {
    if (!F.mineReady || F.wireCur === undefined || !F.wireRef) return;
    if (!F.cx) { if (F.wireV1) { await F.wireRef.delete(); F.wireV1 = false; } return; }
    if (!F.key || !F.allReady || !settled(chalTargets(F.mine, F.me).map((x) => x.peer))) return;
    const key = F.key, w = await cx.sealChal(finishChal(F.mine, Date.now()), F.me, (u) => (trusted(u) ? pairFor(u, pubOf(u)) : null), F.wireCur, openMemo);
    if (key !== F.key) return pushWire();
    const empty = !Object.keys(w.out).length && !Object.keys(w.res).length;
    if (!F.wireV1 && (F.wireCur ? canon([F.wireCur.out, F.wireCur.res]) === canon([w.out, w.res]) : empty)) return;
    if (empty) { await F.wireRef.delete(); F.wireCur = null; F.wireV1 = false; return; }
    const doc = { v: 2, u: F.me, at: Date.now(), out: w.out, res: w.res };
    await F.wireRef.set(doc);
    F.wireCur = cleanWire(F.me, doc); F.wireV1 = false;
  });

  function teardown() {
    F.subs.concat(F.cardSubs).forEach((u) => { try { u(); } catch (e) {} });
    F.subs = []; F.cardSubs = []; F.cardKey = "";
    F.frReady = false; F.mineReady = false; F.keyRaw = undefined; F.pubSeen = null; F.allReady = false; F.wireCur = undefined; F.pinsReady = false;
    if (B.down) B.down();
  }

  function onSubErr(e) {
    const code = (e && e.code) || "unavailable";
    teardown();
    if (code === "resting") status("resting");
    else if (code === "unavailable" || code === "resource_exhausted") {
      status("offline");
      clearTimeout(F.revive);
      F.revive = setTimeout(connect, 20000 + Math.random() * 20000);
    } else status("error");
  }

  function writeErr(e, retry) {
    const code = (e && e.code) || "unavailable";
    if (code === "invalid_argument" || code === "transform_error") { teardown(); status("readonly"); }
    else if (code === "quota_exceeded") note(B.tx.full, "bad");
    else if (code === "resting") { teardown(); status("resting"); }
    else if (code === "unavailable" && retry && F.retries < 3) { F.retries++; setTimeout(retry, 1500 + Math.random() * 2500); }
    else if (code === "unavailable") note(B.tx.unreach, "bad");
    else { teardown(); status("error"); }
  }

  function serial(fn) {
    let busy = false, again = false;
    const run = async () => {
      if (busy) { again = true; return; }
      busy = true;
      try { await fn(); F.retries = 0; } catch (e) { writeErr(e, run); }
      finally { busy = false; if (again) { again = false; run(); } }
    };
    return run;
  }

  function checkReady() {
    if (F.st.mode === "connecting" && F.frReady && F.mineReady) status("ready");
  }

  function onFriends(snap) {
    if (snap.metadata && snap.metadata.hasPendingWrites) return;
    const raw = snap.exists ? snap.data() : null, W = raw ? cleanFriends(raw) : null;
    F.fr = mergeFriends(F.fr, W);
    if (snap.metadata && snap.metadata.fromCache) { renderSoon(); return; }
    F.frRemote = W; F.frRaw = raw ? canon(raw) : null; F.frReady = true;
    if (canon(F.fr) !== canon(W || cleanFriends({}))) pushFriends();
    checkReady();
    B.resubCards();
    B.ensureCode();
    syncCard();
    if (B.meta) pushPub();
    renderSoon();
  }

  const pushFriends = serial(async () => {
    if (!F.frReady || !F.frRef) return;
    const M = pruneFriends(mergeFriends(F.fr, F.frRemote), Date.now());
    if (F.frRaw === canon(M)) return;
    await F.frRef.set(M);
    F.frRemote = M; F.frRaw = canon(M); F.fr = mergeFriends(F.fr, M);
  });

  function onMine(snap) {
    if (snap.metadata && snap.metadata.hasPendingWrites) return;
    const raw = snap.exists ? snap.data() : null, W = raw ? cleanChal(raw) : null;
    F.mine = mergeChal(F.mine, W);
    if (snap.metadata && snap.metadata.fromCache) { renderSoon(); return; }
    F.mineRemote = W; F.mineRaw = raw ? canon(raw) : null; F.mineReady = true;
    if (canon(F.mine) !== canon(W || cleanChal({}))) pushMine();
    B.pushWire();
    checkReady();
    renderSoon();
  }

  const pushMine = serial(async () => {
    if (!F.mineReady || !F.mineRef) return;
    const M = finishChal(mergeChal(F.mine, F.mineRemote), Date.now());
    if (F.mineRaw === canon(M)) return;
    await F.mineRef.set(M);
    F.mineRemote = cleanChal(M); F.mineRaw = canon(M); F.mine = mergeChal(F.mine, M);
    B.pushWire();
    renderSoon();
  });

  function resubCards() {
    const ids = friendIds(F.fr).slice().sort(), key = ids.join(",");
    if (key === F.cardKey || !F.db) return;
    F.cardKey = key;
    F.cardSubs.forEach((u) => { try { u(); } catch (e) {} });
    F.cardSubs = [];
    F.keysWait = 0;
    for (let i = 0; i < ids.length; i += 30) {
      const chunk = ids.slice(i, i + 30);
      F.cardSubs.push(F.db.collection("cards").where("u", "in", chunk).onSnapshot((snap) => {
        chunk.forEach((id) => { F.cardDocs[id] = null; });
        snap.docs.forEach((d) => { if (chunk.indexOf(d.id) >= 0) F.cardDocs[d.id] = cleanSealed(d.id, d.data()); });
        openCards();
      }, onSubErr));
      if (!F.cx) continue;
      let first = true;
      F.keysWait++;
      F.cardSubs.push(F.db.collection("keys").where("u", "in", chunk).onSnapshot((snap) => {
        if (snap.metadata && snap.metadata.fromCache) return;
        chunk.forEach((id) => { delete F.pubs[id]; });
        snap.docs.forEach((d) => { const k = chunk.indexOf(d.id) >= 0 && cleanPub(d.id, d.data()); if (k) F.pubs[d.id] = k; });
        if (first) { first = false; F.keysWait--; }
        refreshTrust();
      }, onSubErr));
    }
  }

  function setCard(id, v) {
    const o = F.cards[id];
    if (o && o.st === v.st && canon(o.c || null) === canon(v.c || null)) return;
    F.cards[id] = v;
    renderSoon();
  }

  /** Decrypts each followed player's card that changed since the last pass. */
  function openCards() {
    friendIds(F.fr).forEach((id) => {
      const d = F.cardDocs[id], pk = F.pubs[id];
      if (d === undefined) return;
      if (!d) return setCard(id, { st: "none" });
      if (!F.cx) return setCard(id, { st: "nocx" });
      if (!F.key || F.keysWait > 0) return;
      const t = trustOf(id);
      if (t === "wait") return;
      if (t === "changed") { delete F.cardSeen[id]; return setCard(id, { st: "changed" }); }
      if (!pk) return setCard(id, { st: "locked" });
      const sig = canon([d, pubFp(pk), pubFp(F.key)]);
      if (F.cardSeen[id] === sig) return;
      F.cardSeen[id] = sig;
      B.readCard(id, d, pk).then((c) => { if (F.cardSeen[id] === sig) setCard(id, c ? { st: "ok", c } : { st: "locked" }); });
    });
  }

  async function readCard(id, d, pk) {
    const p = await pairFor(id, pk), s = p && await cx.side(p, "", id, F.me), e = s && d.w[s.tag];
    return e ? cleanCard(id, await cx.open(s.key, e, aadOf(id, F.me))) : null;
  }

  const byId = () => ui.worlds().slice().sort((a, b) => a.id - b.id);
  function summary() {
    const S = ui.get(), lv = obj(S.levels), ws = [], wc = [];
    let worlds = 0, golden = 0, trophies = 0;
    byId().forEach((w) => {
      const L = ui.levelsOf(w);
      let s = 0, c = 0;
      L.forEach((l) => { const r = lv[l.id]; if (r && r.stars > 0) { c++; s += Math.min(3, Math.floor(r.stars)); } });
      ws.push(s); wc.push(c);
      if (L.length && c >= L.length) worlds++;
    });
    Object.keys(lv).forEach((id) => { if (id.indexOf("daily") !== 0 && lv[id] && lv[id].golden) golden++; });
    const tiers = { bronze: 0, silver: 0, gold: 0, platinum: 0 };
    ui.ach().forEach((a) => { if (S.ach[a.id]) { trophies++; if (a.tier in tiers) tiers[a.tier]++; } });
    const add = (a) => a.reduce((n, v) => n + v, 0);
    return { stars: add(ws), cleared: add(wc), worlds, golden, streak: ui.liveStreak(), best: num(obj(S.daily).best), trophies, tiers, nectar: ui.nectar(), ws, wc };
  }
  const cardBody = () => buildCard(summary(), F.me, ui.dayKey(), F.fr.share.nectar);

  function syncCard(immediate) {
    if (!F.frReady || F.card.exists === null || !F.cardRef) return;
    if (!F.fr.share.on || !F.cx) {
      clearTimeout(F.card.timer); F.card.timer = 0;
      if (F.card.exists && (!F.fr.share.on || !F.card.doc)) B.delCard();
      return;
    }
    if (!F.key || F.keysWait > 0 || !settled(friendIds(F.fr))) return;
    const P = sharePubs(), urgent = recipSig(F.key, cardRecips(F.fr, P), P) !== F.card.rs, now = Date.now();
    if (F.card.timer) { if (!immediate && (!urgent || F.card.urgent)) return; clearTimeout(F.card.timer); }
    const wait = immediate || !F.card.exists ? 0 : urgent ? Math.min(REWRAP, Math.max(250, F.card.at + REWRAP - now)) : Math.max(CARD_WAIT, F.card.at + B.gap - now);
    F.card.urgent = urgent && !immediate;
    F.card.timer = setTimeout(() => { F.card.timer = 0; F.card.urgent = false; B.writeCard(); }, wait);
  }

  /** Starts any pending card write now, before the page goes away. */
  function flushCard() {
    if (!F.card.timer) return;
    clearTimeout(F.card.timer);
    F.card.timer = 0; F.card.urgent = false;
    B.writeCard(true);
  }

  /** Whether an existing envelope already holds `body` for exactly these recipients. */
  async function sameCard(doc, body, to, pairs) {
    const tags = pairs.filter(Boolean).map((p) => p.tag).sort(), i = pairs.findIndex(Boolean);
    if (canon(tags) !== canon(Object.keys(doc.w).sort())) return false;
    return i < 0 || canon(await cx.open(pairs[i].key, doc.w[pairs[i].tag], aadOf(F.me, to[i]))) === canon(body);
  }

  async function writeCard() {
    if (F.card.busy) { F.card.timer = setTimeout(() => { F.card.timer = 0; writeCard(); }, 300); return; }
    if (!F.fr.share.on || !F.cardRef || !F.cx || !F.key || F.keysWait > 0 || !settled(friendIds(F.fr))) return;
    const P = sharePubs(), body = cardBody(), to = cardRecips(F.fr, P), rs = recipSig(F.key, to, P), sig = canon([body, rs]);
    if (sig === F.card.last) return;
    F.card.busy = true;
    try {
      const pairs = await Promise.all(to.map((id) => pairFor(id, P[id]).then((p) => p && cx.side(p, "", F.me, id)))), ok = to.filter((id, i) => pairs[i]);
      if (F.card.last == null && F.card.doc && await sameCard(F.card.doc, body, to, pairs)) { Object.assign(F.card, { last: sig, rs, to: ok }); renderSoon(); return; }
      const w = {};
      for (let i = 0; i < to.length; i++) if (pairs[i]) w[pairs[i].tag] = await cx.seal(pairs[i].key, body, aadOf(F.me, to[i]));
      const doc = { v: 2, u: F.me, at: Date.now(), w };
      await F.cardRef.set(doc);
      Object.assign(F.card, { last: sig, rs, to: ok, doc: cleanSealed(F.me, doc), exists: true, at: Date.now() });
      renderSoon();
    } catch (e) { writeErr(e); }
    finally { F.card.busy = false; if (!F.fr.share.on && F.card.exists) delCard(); }
  }

  async function delCard() {
    if (F.card.busy || !F.cardRef) return;
    F.card.busy = true;
    try { await F.cardRef.delete(); Object.assign(F.card, { exists: false, last: null, doc: null, to: [], rs: null }); renderSoon(); }
    catch (e) { writeErr(e); }
    finally { F.card.busy = false; if (F.fr.share.on) syncCard(true); }
  }

  async function ensureCode() {
    if (!F.fr.code || F.codeChecked || !F.codeRef) return;
    F.codeChecked = true;
    try {
      const s = await F.codeRef.get();
      if (!s.exists || obj(s.data()).c !== F.fr.code.c) await F.codeRef.set({ c: F.fr.code.c, u: F.me });
    } catch (e) { F.codeChecked = false; writeErr(e); }
  }

  async function makeCode() {
    if (F.fr.code) return;
    let c = null;
    try {
      for (let i = 0; i < 5 && !c; i++) {
        const k = newCode(), q = await F.db.collection("codes").where("c", "==", k).limit(3).get();
        if (!q.docs.some((d) => d.id !== F.me)) c = k;
      }
      if (!c) { note("Couldn't make a code. Try again.", "bad"); return; }
      await F.codeRef.set({ c, u: F.me });
      F.fr.code = { c, at: Date.now() };
      F.codeChecked = true;
      pushFriends();
      renderSoon();
    } catch (e) { writeErr(e); }
  }

  async function findCode(input) {
    const c = parseCode(input);
    if (!c) { note("Friend codes look like ABC-234", "bad"); return; }
    if (F.fr.code && F.fr.code.c === c) { note("That's your own code", "info"); return; }
    let ids = [];
    try {
      const q = await F.db.collection("codes").where("c", "==", c).limit(5).get();
      ids = q.docs.filter((d) => validId(d.id) && d.id !== F.me && obj(d.data()).c === c).map((d) => d.id);
    } catch (e) { writeErr(e); return; }
    if (!ids.length) { note("No gardener has that code", "bad"); return; }
    if (ids.length === 1) { addFriend(ids[0], c); const i = $("#frCodeIn"); if (i) i.value = ""; return; }
    pickModal(ids, c);
  }

  function pickModal(ids, c) {
    const m = ui.openModal({
      label: "Which gardener?",
      html: `<div class="eyebrow">${ic("friends")}Code ${esc(fmtCode(c))}</div><h2>Which gardener?</h2><p>More than one person shows this code. Pick the one you know.</p>
        <div class="fr-hits">${ids.map((id) => `<div class="fr-hit"><span class="av fr-av" data-uid="${esc(id)}"></span><b class="nm" data-uid="${esc(id)}">…</b><button class="btn small" type="button" data-id="${esc(id)}">Add</button></div>`).join("")}</div>
        <div class="row"><button class="btn ghost" type="button" data-a="no">Cancel</button></div>`
    });
    fillNames(m.el);
    m.el.addEventListener("click", (e) => {
      const b = e.target.closest("[data-id]");
      if (b) { m.close("pick"); addFriend(b.dataset.id, c); }
      else if (e.target.closest("[data-a=no]")) m.close("no");
    });
  }

  function addFriend(id, code) {
    if (!validId(id) || id === F.me || F.st.mode !== "ready") return;
    const e = F.fr.f[id];
    if (e && !e.del) { note(`${nameOf(id)} is already in your friends`, "info"); return; }
    if (friendIds(F.fr).length >= MAX_FRIENDS) { note(`You can follow up to ${MAX_FRIENDS} gardeners`, "bad"); return; }
    F.fr.f[id] = codeOk(code) ? { at: Date.now(), code } : { at: Date.now() };
    pushFriends();
    B.resubCards();
    ui.sfx("unlock");
    if (F.user) F.user.profiles([id]).then((ps) => { F.names[id] = (ps[id] && ps[id].name) || ""; note(`Following ${nameOf(id)}`, "good"); }, () => note("Friend added", "good"));
    renderSoon();
  }

  function removeFriend(id) {
    ui.confirmModal(`Stop following ${nameOf(id)}?`, "They lose access to your progress card. Open challenges stay, and you can add them again any time.", "Remove", () => {
      F.fr.f[id] = { at: Date.now(), del: 1 };
      delete F.cards[id]; delete F.cardDocs[id]; delete F.cardSeen[id];
      pushFriends();
      B.resubCards();
      renderSoon();
    });
  }

  function setShare(on) {
    if (on && !F.cx) { note("This browser can't encrypt your card", "bad"); return; }
    F.fr.share = { on: !!on, nectar: on ? F.fr.share.nectar : false, at: Date.now() };
    pushFriends();
    if (B.meta) pushPub();
    if (on) syncCard(true); else syncCard();
    note(on ? "Sharing with people you follow" : "Card removed. Nobody sees your progress now", on ? "good" : "info");
    renderSoon();
  }

  const nameOn = () => !F.fr.nm || F.fr.nm.on;

  function setName(on) {
    F.fr.nm = { on: !!on, at: Date.now() };
    pushFriends();
    if (B.meta) pushPub();
    delete F.names[F.me];
    renderSoon();
  }

  function setNectar(on) {
    F.fr.share = { on: F.fr.share.on, nectar: !!on, at: Date.now() };
    pushFriends();
    syncCard(true);
    renderSoon();
  }

  function incoming() { return incomingOf(F.inc, F.mine, F.me); }
  function outgoing() { return outgoingOf(F.mine, F.outRes, F.me); }
  function waitingForMe() { const now = Date.now(); return incoming().filter((c) => !c.rr && verdict(c, now).state === "open"); }

  function badge() {
    const b = document.getElementById("tab-friends");
    if (!b) return;
    const n = F.st.mode === "ready" ? waitingForMe().length : 0;
    let i = b.querySelector(".fr-badge");
    if (!n) { if (i) i.remove(); b.setAttribute("aria-label", "Friends"); return; }
    if (!i) { i = document.createElement("i"); i.className = "fr-badge"; i.setAttribute("aria-hidden", "true"); b.appendChild(i); }
    i.textContent = n > 9 ? "9+" : String(n);
    b.setAttribute("aria-label", `Friends, ${plural(n, "challenge")} waiting`);
  }

  function renderSoon() {
    badge();
    if (F.raf) return;
    F.raf = setTimeout(() => { F.raf = 0; tally(); paint(); }, 16);
  }

  /** Reports the trophy events my synced Friends state proves. */
  function tally() {
    if (F.st.mode !== "ready" || !F.me || !F.frReady || !F.mineReady || !ui.pals) return;
    ui.pals(palKeys({ me: F.me, fr: F.fr, cards: F.cards, mine: F.mine, inc: incoming(), out: outgoing(), now: Date.now() }));
  }

  function fillNames(box) {
    const els = $$("[data-uid]", box);
    if (!els.length || !F.user) return;
    const ids = uniq(els.map((e) => e.dataset.uid)).filter(validId);
    F.user.profiles(ids).then((ps) => {
      els.forEach((e) => {
        const p = ps[e.dataset.uid];
        if (!p) return;
        F.names[e.dataset.uid] = p.name || "";
        if (e.classList.contains("av")) {
          if (e.dataset.src === p.avatarUrl || !p.avatarUrl) return;
          e.textContent = "";
          const img = document.createElement("img");
          img.alt = ""; img.src = p.avatarUrl;
          e.appendChild(img);
          e.dataset.src = p.avatarUrl;
        } else {
          const code = e.dataset.code;
          e.textContent = p.name || B.anon(code, true);
          if (e.dataset.guest != null && p.guest) e.insertAdjacentHTML("beforeend", ` <span class="fr-tag">guest</span>`);
        }
      });
    }, () => {});
  }

  const who = (id, cls) => `<span class="nm${cls ? " " + cls : ""}" data-uid="${esc(id)}"${F.fr.f[id] && F.fr.f[id].code ? ` data-code="${esc(F.fr.f[id].code)}"` : ""}>${esc(F.names[id] || "…")}</span>`;
  const av = (id) => `<span class="av fr-av" data-uid="${esc(id)}" aria-hidden="true"></span>`;

  function ago(day) {
    if (!dayOk(day)) return "";
    const d = new Date(+day.slice(0, 4), +day.slice(4, 6) - 1, +day.slice(6, 8)), t = new Date();
    t.setHours(0, 0, 0, 0);
    const n = Math.round((t - d) / DAY);
    return n <= 0 ? "played today" : n === 1 ? "played yesterday" : n < 14 ? `played ${n} days ago` : "last played " + d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function left(exp) {
    const ms = exp - Date.now();
    if (ms <= 0) return "expired";
    const d = Math.floor(ms / DAY), h = Math.ceil(ms / 3600000);
    return d >= 1 ? `${plural(d, "day")} left` : `${plural(h, "hour")} left`;
  }

  const ABSENT = {
    off: ["cloud", "Friends are starting", "One moment."],
    local: ["cloudoff", "Friends live on claude.ai", "Open Orbit Orchard on claude.ai while signed in to follow friends and trade challenge skies. Everything else works right here."],
    absent: ["cloudoff", "Friends aren't connected", "This view didn't get access to claude.ai's shared data. Open the game from its claude.ai link while signed in. Your garden still saves on this device."],
    ask: ["lock", "Allow access to use Friends", "Friends and cloud save need permission to use this page's shared data and your claude.ai name. Your garden still saves on this device."],
    denied: ["lock", "Access is turned off", "Friends and cloud save need the Database and User permissions, which are off for this page. Turn them back on in its Permissions settings."],
    reload: ["sync", "Reload to finish", "Access is allowed. Reload the page to connect Friends and cloud save."],
    signedout: ["cloudoff", "Sign in to use Friends", "Sign in to claude.ai and open this page again to follow friends and send challenge skies."],
    readonly: ["lock", "View-only access", "Your access to this page can't save shared data, so you can't add friends or send challenges. Ask the owner for Contributor access."],
    connecting: ["sync", "Connecting to claude.ai", "Loading your friends and challenges."],
    offline: ["cloudoff", "Can't reach claude.ai", "Friends will reconnect on their own. Your garden is safe on this device."],
    error: ["cloudoff", "Friends aren't available here", "This view can't use shared data. The rest of the game works as usual."]
  };

  const TX = {
    absent: ABSENT, full: "Shared storage for this page is full", unreach: "Can't reach claude.ai right now", gap: " Updates at most once a minute.",
    empty: "No friends yet. Search for a colleague or trade friend codes to follow their garden. Following is one-way, but you see someone's progress only if they follow you too.",
    codeHelp: "Anyone with access to this page who enters it can follow you. They see your progress only if you follow them too.", noCode: "Make one so friends can add you without searching."
  };
  const anonClaude = (code, row) => (row && code ? "Someone (" + fmtCode(code) + ")" : "Someone");

  function absentHtml() {
    const A = B.tx.absent, a = A[F.st.mode] || A.error, retry = F.st.mode === "offline" || F.st.mode === "absent" || F.st.mode === "error";
    const sign = F.st.mode === "signedout" && B.signIn ? `<div class="row"><button class="btn small primary" type="button" data-f="signin"${B.busy() ? " disabled" : ""}>${B.glogo || ""}${B.busy() ? "Signing in" : "Sign in with Google"}</button></div>` : "";
    return `<div class="sheet fr-absent fr-${esc(F.st.mode)}"><span class="fr-absent-ic">${ic(a[0])}</span><div><h3>${esc(a[1])}</h3><p class="muted">${esc(a[2])}</p>
      ${retry ? `<div class="row"><button class="btn small" type="button" data-f="retry">${ic("sync")}Try again</button></div>` : ""}
      ${F.st.mode === "ask" ? `<div class="row"><button class="btn small primary" type="button" data-f="allow">${ic("lock")}Allow access</button></div>` : ""}
      ${F.st.mode === "denied" ? `<div class="row"><button class="btn small primary" type="button" data-f="perms">${ic("lock")}Open permissions</button></div>` : ""}${sign}</div></div>`;
  }

  function layoutHtml() {
    return `<div id="frNote"></div><div class="fr-grid">
      <div class="fr-col">
        <section class="sheet fr-sec" aria-labelledby="frChH"><div class="fr-h"><h3 id="frChH">Challenges</h3><button class="btn small primary" type="button" data-f="new">${ic("target")}New challenge</button></div><div id="frChal"></div></section>
        <section class="sheet fr-sec" aria-labelledby="frFrH"><div class="fr-h"><h3 id="frFrH">Friends</h3><span class="muted small" id="frCount"></span></div><div id="frList"></div></section>
        <section class="sheet fr-sec" aria-labelledby="frHiH"><div class="fr-h"><h3 id="frHiH">Recent challenges</h3></div><div id="frHist"></div></section>
      </div>
      <div class="fr-col">
        <section class="sheet fr-sec" aria-labelledby="frCaH"><div class="fr-h"><h3 id="frCaH">Your progress card</h3></div>
          <div class="toggle"><div class="t"><b id="frLblShare">Share my progress with people I follow</b><span>Only people you follow can see your stars, plots, worlds, golden badges, Daily streak, trophies and the last day you played. Off until you switch it on; off deletes it.</span></div><button class="switch" type="button" role="switch" aria-checked="false" data-f="share" aria-labelledby="frLblShare"></button></div>
          <div class="toggle"><div class="t"><b id="frLblNectar">Include nectar</b><span>Add your nectar balance to the card.</span></div><button class="switch" type="button" role="switch" aria-checked="false" data-f="nectar" aria-labelledby="frLblNectar"></button></div>
          ${B.meta ? `<div class="toggle"><div class="t"><b id="frLblName">Show my Google name to friends</b><span>When off, friends see “Gardener” and your friend code.</span></div><button class="switch" type="button" role="switch" aria-checked="false" data-f="name" aria-labelledby="frLblName"></button></div>` : ""}
          <div id="frCard"></div></section>
        <section class="sheet fr-sec" id="frAdd" aria-labelledby="frAdH"><div class="fr-h"><h3 id="frAdH">Add a friend</h3></div>
          ${B.search ? `<div class="field"><label for="frQ">Search your organization</label><input class="text-in" id="frQ" type="search" autocomplete="off" spellcheck="false" placeholder="Name"></div>
          <div class="fr-hits" id="frHits"></div>` : ""}
          <div class="field"><label for="frCodeIn">Friend code</label><div class="fr-inline"><input class="text-in" id="frCodeIn" autocomplete="off" spellcheck="false" maxlength="9" placeholder="ABC-234"><button class="btn small" type="button" data-f="find">Add</button></div></div>
          <div id="frMyCode"></div></section>
      </div></div>`;
  }

  function paint() {
    const el = F.el;
    if (!el || !el.isConnected) return;
    const body = $("#frBody", el);
    if (!body) return;
    if (F.st.mode !== "ready") {
      if (F.built !== F.st.mode) { body.innerHTML = absentHtml(); F.built = F.st.mode; }
      return;
    }
    if (F.built !== "ready") { body.innerHTML = layoutHtml(); F.built = "ready"; }
    F.view = {};
    $("#frNote", body).innerHTML = F.keyNote ? `<p class="fr-notice">${ic("lock")}<span>Your shared key was replaced by someone else and has been restored.</span><button class="btn small ghost" type="button" data-f="notehide">OK</button></p>` : "";
    paintChallenges(body);
    paintFriends(body);
    paintHistory(body);
    paintCard(body);
    paintCode(body);
    paintHits(body);
    fillNames(body);
  }

  function chRow(c, k, mine) {
    F.view[k] = c;
    const v = verdict(c, Date.now()), other = mine ? c.to : c.from;
    const me = mine ? v.sr : v.rv, them = mine ? v.rv : v.sr;
    const head = mine ? `You challenged ${who(other)}` : `${who(other)} challenges you`;
    const bits = [`${esc(diffName(c.diff))} sky${c.rnd ? " (random)" : ""}`, esc(left(c.exp))];
    if (me) bits.push(`you: ${plural(me.used, "seed")}`);
    else if (mine) bits.push("sent blind");
    bits.push(them ? "they've sown it" : mine ? "waiting for them" : "they haven't sown it yet");
    const acts = !mine && !c.rr ? `<button class="btn small primary" type="button" data-c="play">${ic("play")}Play</button><button class="btn small ghost" type="button" data-c="decline">Decline</button>`
      : mine && !me ? `<button class="btn small" type="button" data-c="mine">${ic("play")}Play your side</button>`
      : `<button class="btn small ghost" type="button" data-c="view">Details</button>`;
    return `<div class="fr-ch${!mine && !c.rr ? " hot" : ""}" data-k="${esc(k)}">${av(other)}<div class="fr-ch-t"><b>${head}</b><span class="muted small">${bits.join(" · ")}</span></div><div class="fr-acts">${acts}</div></div>`;
  }

  const NOCX = `<p class="muted fr-empty">This browser can't encrypt, so challenges are off here. Friend codes still work.</p>`;

  function paintChallenges(body) {
    const box = $("#frChal", body), now = Date.now();
    $("[data-f=new]", body).disabled = !F.cx;
    if (!F.cx) { box.innerHTML = NOCX; return; }
    const inc = incoming().filter((c) => verdict(c, now).state === "open");
    const out = outgoing().filter((c) => verdict(c, now).state === "open");
    const todo = inc.filter((c) => !c.rr), wait = inc.filter((c) => c.rr).map((c) => [c, false]).concat(out.map((c) => [c, true])).sort((a, b) => b[0].at - a[0].at);
    const openOut = out.length;
    let h = "";
    if (todo.length) h += `<h4 class="fr-sub">For you</h4>` + todo.map((c) => chRow(c, "in:" + c.from + ":" + c.cid, false)).join("");
    if (wait.length) h += `<h4 class="fr-sub">Waiting</h4>` + wait.map((p) => chRow(p[0], (p[1] ? "out:" : "in:") + p[0].from + ":" + p[0].cid, p[1])).join("");
    if (!h) h = `<p class="muted fr-empty">No open challenges. Send a friend a random sky: you both play the exact same one, and fewest seeds wins.</p>`;
    h += `<p class="muted small fr-meta">${openOut} of ${MAX_OPEN} sent challenges open. Challenges expire after 7 days.</p>`;
    box.innerHTML = h;
  }

  function worldBars(c, mine) {
    const W = ui.worlds(), ids = byId();
    if (!W.length) return "";
    const rows = W.map((w, n) => {
      const i = ids.indexOf(w);
      if (!(c.ws[i] || 0) && !(mine.ws[i] || 0)) return "";
      const max = Math.max(1, ui.levelsOf(w).length * 3), t = c.ws[i] || 0, y = mine.ws[i] || 0, d = t - y;
      const lab = d > 0 ? `Them +${d}★` : d < 0 ? `You +${-d}★` : "Even";
      return `<div class="fw"><span class="fw-n">${esc(String(w.name || "World " + (n + 1)).split(" ")[0])}</span><span class="fw-bars" aria-hidden="true"><i class="them" style="--p:${Math.round((t / max) * 100)}%"></i><i class="you" style="--p:${Math.round((y / max) * 100)}%"></i></span><b class="fw-d ${d > 0 ? "ahead" : d < 0 ? "behind" : "even"}">${lab}</b><span class="sr">${t} stars, you ${y}</span></div>`;
    }).join("");
    if (!rows) return "";
    return `<div class="fr-worlds"><div class="fw-key muted small"><span><i class="them"></i>Them</span><span><i class="you"></i>You</span></div>${rows}</div>`;
  }

  function statsHtml(c) {
    const cell = (l, v) => `<div><dt>${l}</dt><dd>${v}</dd></div>`;
    const tiers = TIERS.filter((t) => c.tiers[t]).map((t) => `<span class="fr-tier t-${t}" title="${t}"><i></i>${c.tiers[t]}</span>`).join("");
    return `<dl class="fr-stats">${cell("Stars", c.stars)}${cell("Plots", c.cleared)}${cell("Worlds", c.worlds)}${cell("Golden", c.golden)}${cell("Streak", c.streak)}${cell("Trophies", c.trophies)}${c.nectar != null ? cell("Nectar", c.nectar) : ""}</dl>${tiers ? `<div class="fr-tiers">${tiers}</div>` : ""}`;
  }

  function paintFriends(body) {
    const box = $("#frList", body), ids = friendIds(F.fr);
    $("#frCount", body).textContent = ids.length ? `${ids.length} of ${MAX_FRIENDS}` : "";
    if (!ids.length) {
      box.innerHTML = `<div class="fr-empty"><p class="muted">${esc(B.tx.empty)}</p><button class="btn small" type="button" data-f="goadd">${ic("friends")}Find friends</button></div>`;
      return;
    }
    const mine = summary();
    box.innerHTML = ids.map((id) => {
      const s = F.cards[id], c = s && s.st === "ok" ? s.c : null, nokey = F.cx && F.allReady && !F.keysWait && !pubOf(id);
      const t = F.cx ? trustOf(id) : "none", pin = F.pins.p[id], changed = t === "changed", ver = !changed && pin && pin.ok;
      const tip = changed ? "Accept their new key first" : F.cx ? "They need to open Friends once" : "This browser can't encrypt challenges";
      const line = changed ? "Sharing with them is paused" : nokey ? "Needs to open Friends once" : !s ? "Loading card…" : c ? `Shares with you${c.day ? " · " + ago(c.day) : ""}` : s.st === "locked" ? "Hasn't added you back. Only people they follow see their progress."
        : s.st === "nocx" ? "This browser can't open progress cards" : "Not sharing their progress";
      const safeBtn = F.cx && pubOf(id) && !changed ? `<button class="btn small ghost icon" type="button" data-f="safe" aria-expanded="${!!F.safeOpen[id]}" aria-label="Safety code" title="Safety code">${ic("lock")}</button>` : "";
      return `<div class="fr-row" data-id="${esc(id)}"><div class="fr-who">${av(id)}<div><b>${who(id)}${ver ? `<span class="fr-tag fr-ver">${ic("check")}verified</span>` : ""}</b><span class="muted small${c ? " fr-on" : ""}">${esc(line)}</span></div>
        <div class="fr-acts"><button class="btn small" type="button" data-f="chal"${canChal(id) ? "" : ` disabled title="${tip}"`}>${ic("target")}<span>Challenge</span></button>${safeBtn}<button class="btn small ghost icon" type="button" data-f="rm" aria-label="Stop following" title="Stop following">${ic("close")}</button></div></div>
        ${F.cx && pubOf(id) && (changed || F.safeOpen[id]) ? safeHtml(id, changed, pin) : ""}${c ? statsHtml(c) + worldBars(c, mine) : ""}</div>`;
    }).join("");
  }

  function safeHtml(id, changed, pin) {
    const code = safetyFor(id), ver = !!(pin && pin.ok);
    const warn = changed ? `<p class="fr-warn">${ic("lock")}<span>Their key changed${ver ? " since you verified them" : ""}. Compare safety codes, then accept.</span></p>` : "";
    const act = changed ? `<button class="btn small primary" type="button" data-f="accept">Accept new key</button>`
      : `<button class="btn small${ver ? "" : " ghost"}" type="button" data-f="verify" aria-pressed="${ver}">${ver ? ic("check") + "Verified" : "Mark as verified"}</button>`;
    return `<div class="fr-safe">${warn}<div class="fr-code"><div><span class="muted small">Safety code</span><b class="mono">${esc(code || "…")}</b></div>${act}</div><p class="muted small">It should match the code on their screen.</p></div>`;
  }

  function history() {
    const now = Date.now(), all = [];
    incoming().forEach((c) => { const v = verdict(c, now); if (v.state !== "open") all.push({ c, v, k: "in:" + c.from + ":" + c.cid, mine: false, t: Math.max(c.at, c.rr ? c.rr.at : 0, c.sr ? c.sr.at : 0) }); });
    outgoing().forEach((c) => { const v = verdict(c, now); if (v.state !== "open") all.push({ c, v, k: "out:" + c.from + ":" + c.cid, mine: true, t: Math.max(c.at, c.rr ? c.rr.at : 0, c.sr ? c.sr.at : 0) }); });
    return all.sort((a, b) => b.t - a.t).slice(0, 15);
  }

  function outcome(v, mine) {
    const side = mine ? "s" : "r";
    if (v.state === "declined") return ["Declined", "muted"];
    if (v.state === "expired") return ["Expired", "muted"];
    if (v.state === "void") return ["Void", "muted"];
    if (v.win === "draw") return ["Draw", "draw"];
    const won = v.win === side;
    return [(won ? "You won" : "They won") + (v.state === "walkover" ? " (walkover)" : ""), won ? "won" : "lost"];
  }

  function paintHistory(body) {
    const box = $("#frHist", body), h = F.cx ? history() : [];
    if (!F.cx) { box.innerHTML = NOCX; return; }
    if (!h.length) { box.innerHTML = `<p class="muted fr-empty">Finished, declined and expired challenges from the last three weeks show here.</p>`; return; }
    box.innerHTML = h.map((x) => {
      F.view[x.k] = x.c;
      const o = outcome(x.v, x.mine), other = x.mine ? x.c.to : x.c.from;
      return `<button class="fr-hi" type="button" data-k="${esc(x.k)}">${av(other)}<span class="fr-hi-t"><b>${x.mine ? "You vs " : ""}${who(other)}${x.mine ? "" : " vs you"}</b><span class="muted small">${esc(diffName(x.c.diff))} sky · ${esc(new Date(x.t).toLocaleDateString(undefined, { month: "short", day: "numeric" }))}</span></span><span class="fr-out ${o[1]}">${esc(o[0])}</span></button>`;
    }).join("");
  }

  function cardStatus() {
    if (!F.cx) return "This browser can't encrypt, so progress cards and challenges are off here. Friend codes still work.";
    if (!F.fr.share.on) return "Not shared. Nobody can see your progress.";
    if (!F.card.exists || !F.card.doc || F.card.rs == null) return "Sharing…";
    const k = F.card.to.length, miss = Math.min(MAX_FRIENDS, friendIds(F.fr).length) - k, at = F.card.doc.at;
    const t = at ? ", updated " + new Date(at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : "";
    return (k ? `Shared with ${k} ${k === 1 ? "person" : "people"} you follow${t}.` : `On${t}. Nobody you follow can see it yet.`) + (miss > 0 && !F.keysWait ? ` ${miss} ${miss === 1 ? "person you follow hasn't" : "people you follow haven't"} opened Friends yet.` : "") + B.tx.gap;
  }

  function paintCard(body) {
    const on = F.fr.share.on && F.cx, sw = $("[data-f=share]", body);
    sw.setAttribute("aria-checked", on ? "true" : "false");
    sw.disabled = !F.cx;
    const n = $("[data-f=nectar]", body);
    n.setAttribute("aria-checked", on && F.fr.share.nectar ? "true" : "false");
    n.disabled = !on;
    const nm = $("[data-f=name]", body);
    if (nm) nm.setAttribute("aria-checked", nameOn() ? "true" : "false");
    const c = cleanCard(F.me, cardBody()), st = cardStatus();
    $("#frCard", body).innerHTML = `<div class="fr-preview${on ? " on" : ""}"><div class="fr-who">${av(F.me)}<div><b>${who(F.me)}</b><span class="muted small">${esc(st)}</span></div></div>${c ? statsHtml(c) : ""}</div>`;
  }

  function paintCode(body) {
    const box = $("#frMyCode", body), c = F.fr.code;
    box.innerHTML = c ? `<div class="fr-mycode"><div><span class="muted small">Your friend code</span><b class="mono">${esc(fmtCode(c.c))}</b></div><button class="btn small" type="button" data-f="copy">${ic("copy")}Copy</button></div><p class="muted small">${esc(B.tx.codeHelp)}</p>`
      : `<div class="fr-mycode"><div><span class="muted small">Your friend code</span><span class="muted small">${esc(B.tx.noCode)}</span></div><button class="btn small" type="button" data-f="mkcode">Make my code</button></div>`;
  }

  function paintHits(body) {
    const box = $("#frHits", body);
    if (!box) return;
    const hits = F.hits.filter((p) => p && validId(p.id) && !p.isMe);
    if (!F.q) { box.innerHTML = ""; return; }
    if (!hits.length) { box.innerHTML = `<p class="muted small">No one found. Search may be limited here, so friend codes always work.</p>`; return; }
    box.innerHTML = hits.map((p) => {
      const e = F.fr.f[p.id], on = e && !e.del;
      return `<div class="fr-hit">${av(p.id)}<b class="nm" data-uid="${esc(p.id)}" data-guest>${esc(p.name || "Someone")}</b><button class="btn small${on ? " ghost" : ""}" type="button" data-add="${esc(p.id)}" ${on ? "disabled" : ""}>${on ? `${ic("check")}Following` : "Add"}</button></div>`;
    }).join("");
  }

  function search(q) {
    F.q = q;
    if (!F.user || typeof F.user.search !== "function") return;
    F.user.search(q).then((hits) => {
      if (F.q !== q) return;
      F.hits = Array.isArray(hits) ? hits.slice(0, 8) : [];
      if (!q) F.q = F.hits.some((p) => !p.isMe) ? " " : "";
      const body = F.el && $("#frBody", F.el);
      if (body) { paintHits(body); fillNames($("#frHits", body)); }
    }, () => {});
  }

  function copyCode(btn) {
    const t = `Add me in Orbit Orchard: open Friends and enter code ${fmtCode(F.fr.code.c)}`;
    const ok = () => { btn.innerHTML = ic("check") + "Copied"; setTimeout(() => { btn.innerHTML = ic("copy") + "Copy"; }, 1800); };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok, () => note("Copy isn't allowed here. Your code is " + fmtCode(F.fr.code.c), "info"));
      else note("Your code is " + fmtCode(F.fr.code.c), "info");
    } catch (e) { note("Your code is " + fmtCode(F.fr.code.c), "info"); }
  }

  function wire(el) {
    el.addEventListener("click", (e) => {
      const f = e.target.closest("[data-f]"), c = e.target.closest("[data-c]"), add = e.target.closest("[data-add]"), hi = e.target.closest(".fr-hi");
      if (add) { addFriend(add.dataset.add); return; }
      if (hi) { const x = F.view[hi.dataset.k]; if (x) resultModal(x, null, 0); return; }
      if (c) {
        const row = c.closest("[data-k]"), x = row && F.view[row.dataset.k];
        if (!x) return;
        if (c.dataset.c === "play") playIncoming(x);
        else if (c.dataset.c === "decline") decline(x);
        else if (c.dataset.c === "mine") playMine(x);
        else resultModal(x, null, 0);
        return;
      }
      if (!f) return;
      const k = f.dataset.f, row = f.closest(".fr-row");
      if (k === "retry") { status("off"); teardown(); connect(); }
      else if (k === "allow") allow(false);
      else if (k === "perms") allow(true);
      else if (k === "share") setShare(f.getAttribute("aria-checked") !== "true");
      else if (k === "nectar") setNectar(f.getAttribute("aria-checked") !== "true");
      else if (k === "new") newModal(null);
      else if (k === "chal" && row) newModal(row.dataset.id);
      else if (k === "rm" && row) removeFriend(row.dataset.id);
      else if (k === "safe" && row) { F.safeOpen[row.dataset.id] = !F.safeOpen[row.dataset.id]; renderSoon(); }
      else if (k === "verify" && row) setVerified(row.dataset.id, f.getAttribute("aria-pressed") !== "true");
      else if (k === "accept" && row) acceptKey(row.dataset.id);
      else if (k === "notehide") { F.keyNote = false; renderSoon(); }
      else if (k === "find") B.findCode($("#frCodeIn", el).value);
      else if (k === "mkcode") B.makeCode();
      else if (k === "copy") copyCode(f);
      else if (k === "goadd") { const a = $("#frAdd", el); if (a && a.scrollIntoView) a.scrollIntoView({ block: "start" }); const q = $("#frQ", el) || $("#frCodeIn", el); if (q) q.focus({ preventScroll: true }); }
      else if (k === "signin" && B.signIn) { B.signIn(); setTimeout(() => { F.built = ""; renderSoon(); }, 50); }
      else if (k === "name") setName(f.getAttribute("aria-checked") !== "true");
    });
    el.addEventListener("input", (e) => { if (e.target.id === "frQ") search(e.target.value.trim()); });
    el.addEventListener("focusin", (e) => { if (e.target.id === "frQ" && !e.target.value.trim()) search(""); });
    el.addEventListener("keydown", (e) => { if (e.target.id === "frCodeIn" && e.key === "Enter") { e.preventDefault(); B.findCode(e.target.value); } });
  }

  function newModal(preset) {
    const ids = friendIds(F.fr), now = Date.now();
    if (!F.cx) { note("This browser can't encrypt challenges", "bad"); return; }
    if (!ids.length) { note("Add a friend first", "info"); return; }
    if (!ids.some(canChal)) { note("Your friends need to open Friends once before you can challenge them", "info"); return; }
    const open = openCount(outgoing(), now);
    if (open >= MAX_OPEN) { note(`You have ${MAX_OPEN} open challenges. Wait for some to finish or expire.`, "bad"); return; }
    const ok = ids.filter(canChal);
    let to = preset && ok.indexOf(preset) >= 0 ? preset : ok.length === 1 ? ok[0] : null, diff = 3;
    const m = ui.openModal({
      cls: "wide fr-new", label: "New challenge",
      html: `<div class="eyebrow">${ic("target")}New challenge</div><h2>Challenge a friend</h2>
        <p>You both get the same random sky. Fewest seeds wins, then most pollen, then the faster time. It expires in 7 days.</p>
        <div class="field"><span class="lbl">Friend</span><div class="fr-pick" role="radiogroup" aria-label="Friend">${ids.map((id) => `<button class="fr-opt" type="button" role="radio" aria-checked="${id === to}" data-to="${esc(id)}"${canChal(id) ? "" : " disabled"}>${av(id)}${who(id)}</button>`).join("")}</div>
          ${ok.length < ids.length ? `<p class="muted small fr-meta">${ids.filter((id) => !canChal(id)).map((id) => who(id)).join(", ")} ${ids.length - ok.length === 1 ? "needs" : "need"} to open Friends once before you can challenge them.</p>` : ""}</div>
        <div class="field"><span class="lbl">Sky</span><div class="fr-diff" role="radiogroup" aria-label="Sky difficulty">${ui.DIFF.map((d, i) => `<button class="fr-opt" type="button" role="radio" aria-checked="${i + 1 === diff}" data-d="${i + 1}">${esc(d)}</button>`).join("")}<button class="fr-opt" type="button" role="radio" aria-checked="false" data-d="0">Random</button></div></div>
        <p class="muted small">${open} of ${MAX_OPEN} sent challenges open.</p>
        <div class="row"><button class="btn primary" type="button" data-a="first" ${to ? "" : "disabled"}>${ic("play")}Play it first</button><button class="btn" type="button" data-a="blind" ${to ? "" : "disabled"}>Send blind</button><button class="btn ghost" type="button" data-a="no">Cancel</button></div>`
    });
    fillNames(m.el);
    m.el.addEventListener("click", (e) => {
      const t = e.target.closest("[data-to]"), d = e.target.closest("[data-d]"), a = e.target.closest("[data-a]");
      if (t && !t.disabled) { to = t.dataset.to; $$("[data-to]", m.el).forEach((b) => b.setAttribute("aria-checked", b === t ? "true" : "false")); $$("[data-a=first],[data-a=blind]", m.el).forEach((b) => { b.disabled = false; }); ui.sfx("tick"); }
      if (d) { diff = +d.dataset.d; $$("[data-d]", m.el).forEach((b) => b.setAttribute("aria-checked", b === d ? "true" : "false")); ui.sfx("tick"); }
      if (!a || m.closed) return;
      if (a.dataset.a === "no") { m.close("no"); return; }
      if (!to) return;
      const rnd = diff === 0, c = { cid: newCid(), from: F.me, to, seed: randSeed(), diff: rnd ? 1 + Math.floor(Math.random() * 5) : diff, rnd };
      m.close(a.dataset.a);
      if (a.dataset.a === "blind") send(c, null);
      else {
        F.pending = c;
        if (!ui.startChallenge({ seed: c.seed, diff: c.diff, label: `Challenge for ${nameOf(to)}, ${diffName(c.diff).toLowerCase()} sky`, onDone: (r) => finish(c, "new", r) })) F.pending = null;
      }
    });
  }

  function send(c, r) {
    if (!canChal(c.to)) { note(`${nameOf(c.to)} needs to open Friends once`, "bad"); return false; }
    if (openCount(outgoing(), Date.now()) >= MAX_OPEN) { note(`You have ${MAX_OPEN} open challenges already`, "bad"); return false; }
    const now = Date.now(), e = { to: c.to, seed: c.seed, diff: c.diff, at: now, exp: now + TTL };
    if (c.rnd) e.rnd = 1;
    if (r) e.r = r;
    F.mine.out[c.cid] = e;
    pushMine();
    Object.assign(c, { at: e.at, exp: e.exp, sr: r || null, rr: null });
    if (!r) note(`Challenge sent to ${nameOf(c.to)}`, "good");
    renderSoon();
    return true;
  }

  function playIncoming(c) {
    if (Date.now() > c.exp) { note("This challenge has expired", "bad"); return; }
    if (c.rr) return;
    ui.startChallenge({ seed: c.seed, diff: c.diff, label: `Challenge from ${nameOf(c.from)}, ${diffName(c.diff).toLowerCase()} sky`, onDone: (r) => finish(c, "r", r) });
  }

  function playMine(c) {
    if (Date.now() > c.exp) { note("This challenge has expired", "bad"); return; }
    if (c.sr) return;
    ui.startChallenge({ seed: c.seed, diff: c.diff, label: `Your challenge to ${nameOf(c.to)}, ${diffName(c.diff).toLowerCase()} sky`, onDone: (r) => finish(c, "s", r) });
  }

  function decline(c) {
    ui.confirmModal("Decline this challenge?", `${nameOf(c.from)} will see that you passed on this sky.`, "Decline", () => {
      F.mine.res[c.from + "~" + c.cid] = { by: c.from, cid: c.cid, seed: c.seed, diff: c.diff, at: Date.now(), no: 1 };
      pushMine();
      renderSoon();
    });
  }

  function reward() {
    if (!ui.earn || !ui.CHAL_CAP) return 0;
    const S = ui.get(), t = ui.dayKey();
    for (let n = 1; n <= ui.CHAL_CAP; n++) {
      const k = "chal:" + t + ":" + n;
      if (!obj(S.wallet && S.wallet.earn)[k]) return ui.earn(k, ui.CHAL_PAY);
    }
    return 0;
  }

  function finish(c, side, r) {
    const now = Date.now(), rec = cleanResult(Object.assign({}, r, { at: now }));
    let gain = 0;
    if (!rec || !F.me || F.st.mode === "readonly") { note("This result couldn't be saved", "bad"); resultModal(c, side, 0, true); return; }
    if (side === "new") {
      F.pending = null;
      if (!send(c, rec)) { resultModal(c, side, 0, true); return; }
      gain = reward();
    } else if (now > c.exp + GRACE) {
      resultModal(c, side, 0, true);
      return;
    } else if (side === "r" && !c.rr) {
      c.rr = { by: c.from, cid: c.cid, seed: c.seed, diff: c.diff, at: now, r: rec };
      F.mine.res[c.from + "~" + c.cid] = c.rr;
      pushMine();
      gain = reward();
    } else if (side === "s" && !c.sr && F.mine.out[c.cid]) {
      F.mine.out[c.cid].r = rec;
      c.sr = rec;
      pushMine();
      gain = reward();
    }
    renderSoon();
    resultModal(c, side, gain, false);
  }

  function sideHtml(id, r, win, label) {
    return `<div class="fr-vs-p${win ? " win" : ""}">${av(id)}<div class="fr-vs-n"><b>${label ? esc(label) : who(id)}</b>${win ? `<span class="fr-crown">${ic("trophy")}Winner</span>` : ""}</div>
      ${r ? `${ui.miniStars(r.stars)}<dl class="fr-vs-s"><div><dt>Seeds</dt><dd>${r.used}</dd></div><div><dt>Pollen</dt><dd>${r.pt ? `${r.pollen}/${r.pt}` : r.pollen}</dd></div><div><dt>Time</dt><dd>${fmtTime(r.time)}</dd></div></dl>${r.assist ? `<span class="rtag">Assist</span>` : ""}` : `<p class="muted small">Not sown yet</p>`}</div>`;
  }
  const fmtTime = (s) => { s = Math.max(0, Math.round(s || 0)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };

  function resultModal(c, side, gain, late) {
    const now = Date.now(), v = verdict(c, now), mine = c.from === F.me, other = mine ? c.to : c.from;
    const meSide = mine ? "s" : "r", myR = mine ? v.sr : v.rv, theirR = mine ? v.rv : v.sr;
    let title;
    if (late) title = "Too late to count";
    else if (v.state === "done" || v.state === "walkover") title = v.win === "draw" ? "Dead heat" : v.win === meSide ? "You win" : `${nameOf(other)} wins`;
    else if (v.state === "declined") title = "Declined";
    else if (v.state === "expired") title = "Expired";
    else if (v.state === "void") title = "Void";
    else if (side === "new") title = "Challenge sent";
    else title = myR ? `Waiting for ${nameOf(other)}` : "Your move";
    const line = late ? "This challenge expired before you finished, so the result wasn't recorded."
      : v.state === "void" ? "The sky changed after it was sent, so this one doesn't count."
      : v.state === "declined" ? `${mine ? nameOf(other) + " passed on" : "You passed on"} this sky.`
      : v.state === "walkover" ? "Only one of you sowed it before it expired."
      : v.state === "done" ? "Fewest seeds wins. Ties go to more pollen, then the faster time."
      : side === "new" ? `${nameOf(other)} gets the same sky and has 7 days to beat you.`
      : "Fewest seeds wins. Ties go to more pollen, then the faster time.";
    const showTheirs = v.state === "done" || v.state === "walkover" || !!myR;
    const inGame = ui.inGame();
    const m = ui.openModal({
      cls: "fr-result", label: title, dismissable: !inGame,
      html: `<div class="eyebrow">${ic("target")}Challenge · ${esc(diffName(c.diff))} sky · seed <span class="mono">${c.seed}</span></div><h2>${esc(title)}</h2>
        <div class="fr-vs">${sideHtml(F.me, myR, (v.state === "done" || v.state === "walkover") && v.win === meSide, "You")}<span class="fr-vs-mid" aria-hidden="true">vs</span>${sideHtml(other, showTheirs ? theirR : null, (v.state === "done" || v.state === "walkover") && v.win !== meSide && v.win !== "draw", null)}</div>
        <p>${esc(line)}</p>
        ${!showTheirs && theirR ? `<p class="muted small">${esc(nameOf(other))} has sown it. Their result shows once you finish yours.</p>` : ""}
        ${gain ? `<span class="nectar-gain">${ic("nectar")}+${gain} nectar</span>` : ""}
        <div class="row"><button class="btn primary" type="button" data-a="back" autofocus>${inGame ? "Back to Friends" : "Close"}</button></div>`,
      onKey: (e) => { if (e.key === "Escape" || e.key === "Enter") { go(); return true; } return false; }
    });
    const go = () => { if (m.closed) return; m.close("back"); if (ui.inGame()) ui.quitToMenu(); };
    fillNames(m.el);
    m.el.addEventListener("click", (e) => { if (e.target.closest("[data-a=back]")) go(); });
    if (gain) setTimeout(() => ui.nectarPop(gain, "Challenge"), 900);
  }

  /** Internals handed to an alternative storage backend. */
  const kit = () => Object.assign({}, api, {
    F, cx, ui, status, renderSoon, serial, writeErr, onSubErr, teardown, subscribe, note, hasCx, pairFor, pubOf, trustOf, trusted, settled, sharePubs,
    refreshTrust, openCards, setCard, syncCard, cardBody, openMemo, pushFriends, pushPins, pushPub, addFriend, pinScope, nameOn, unb64u, b64u,
    reset() { const el = F.el; teardown(); clearTimeout(F.revive); clearTimeout(F.card.timer); Object.keys(F).forEach((k) => { delete F[k]; }); Object.assign(F, fresh(), { el }); },
    repaint() { F.built = ""; renderSoon(); }
  });

  root.OrchardFriends = Object.assign({}, api, {
    init(o) {
      ui = o;
      Object.assign(B, { connect: connectClaude, refs: refsClaude, subs: subsClaude, loaded: loadedClaude, pubIn: cleanPub, pubDoc: pubClaude, meta: null, resubCards, readCard, writeCard, delCard,
        ensureCode, makeCode, findCode, readChals, pushWire, gap: CARD_GAP, anon: anonClaude, tx: TX, search: true, signIn: null, busy: () => false, glogo: "" });
      if (root.OrchardWeb && root.OrchardFriendsWeb) Object.assign(B, root.OrchardFriendsWeb(kit()));
      connect();
      root.addEventListener("pagehide", flushCard);
      document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flushCard(); });
      setInterval(() => { if (F.st.mode === "ready") renderSoon(); }, 60000);
    },
    render(el) {
      F.el = el;
      F.built = "";
      if (F.pending && !ui.inGame()) { F.pending = null; note("Challenge not sent. Finish the sky to send it, or send it blind.", "info"); }
      el.innerHTML = `<div class="ph"><div><h2>Friends</h2><p>Follow friends' gardens and trade challenge skies. You both get the exact same random sky, and the fewest seeds wins.</p></div></div><div id="frBody"></div>`;
      wire(el);
      paint();
    },
    notify() {
      if (F.st.mode === "ready" && F.fr.share.on && !F.card.timer) syncCard();
    },
    status: () => Object.assign({}, F.st),
    cx,
    _state: F
  });
})(typeof window !== "undefined" ? window : this);
