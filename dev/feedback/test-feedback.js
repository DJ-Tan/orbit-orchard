const assert = require("assert");
const fs = require("fs");
const path = require("path");
const F = require("../../js/feedback.js");
const R = require("../friends/rules.js");

const ROOT = path.join(__dirname, "../..");
let n = 0;
const t = (name, fn) => { fn(); n++; console.log("ok " + name); };
const keys = (o) => Object.keys(o).sort();

t("sanitizer strips C0 and C1 controls but keeps newline and tab", () => {
  assert.strictEqual(F.clean("a\u0000b\u0001c\u0007d\u0008e\u000Bf\u000Cg\u001Bh\u001Fi\u007Fj\u0080k\u0085l\u009Fm"), "abcdefghijklm");
  assert.strictEqual(F.clean("one\ttwo\nthree"), "one\ttwo\nthree");
  assert.strictEqual(F.clean("\u001B[31mred\u001B[0m"), "[31mred[0m");
});

t("sanitizer turns CRLF and lone CR into newlines", () => {
  assert.strictEqual(F.clean("a\r\nb\rc\n"), "a\nb\nc");
});

t("sanitizer strips bidi overrides and isolates", () => {
  assert.strictEqual(F.clean("abc\u202Afed\u202B\u202C\u202D\u202Eghi"), "abcfedghi");
  assert.strictEqual(F.clean("\u2066x\u2067y\u2068z\u2069"), "xyz");
  assert.strictEqual(F.clean("invoice_\u202Efdp.exe"), "invoice_fdp.exe");
  assert.strictEqual(F.clean("keep ‎ and ‏ marks"), "keep ‎ and ‏ marks");
});

t("sanitizer strips zero-width characters", () => {
  assert.strictEqual(F.clean("ja\u200Bva\u200Cscr\u200Dipt:\uFEFF"), "javascript:");
  assert.strictEqual(F.clean("\uFEFF\u200B\u200C\u200D"), "");
});

t("sanitizer normalizes to NFC and leaves compatibility forms alone", () => {
  assert.strictEqual(F.clean("é"), "é");
  assert.strictEqual(F.clean("Å"), "Å");
  assert.strictEqual(F.clean("ﬁ"), "ﬁ");
  assert.strictEqual(F.clean("e\u200B́"), "é");
});

t("sanitizer collapses runs of more than two blank lines and trims", () => {
  assert.strictEqual(F.clean("a\n\n\n\n\n\nb"), "a\n\n\nb");
  assert.strictEqual(F.clean("a\n\n\nb"), "a\n\n\nb");
  assert.strictEqual(F.clean("a\n \n\t\n  \n \nb"), "a\n\n\nb");
  assert.strictEqual(F.clean("a\r\n\r\n\r\n\r\n\r\nb"), "a\n\n\nb");
  assert.strictEqual(F.clean("  \n\n hello \n\n  "), "hello");
});

t("sanitizer coerces non-string input without calling into it", () => {
  assert.strictEqual(F.clean(null), "");
  assert.strictEqual(F.clean(undefined), "");
  assert.strictEqual(F.clean(1234567890), "1234567890");
  assert.strictEqual(F.clean(NaN), "");
  assert.strictEqual(F.clean(Infinity), "");
  assert.strictEqual(F.clean(true), "true");
  assert.strictEqual(F.clean({ toString() { throw new Error("called"); } }), "");
  assert.strictEqual(F.clean(["a long enough line"]), "");
  assert.strictEqual(F.clean(Symbol("x")), "");
  assert.strictEqual(F.clean(() => "x"), "");
  assert.strictEqual(F.clean(Object.create(null)), "");
});

t("length bounds are 10 to 1000 characters after sanitizing", () => {
  assert.deepStrictEqual(F.check("123456789"), { text: "123456789", ok: false, why: "short" });
  assert.strictEqual(F.check("1234567890").ok, true);
  assert.strictEqual(F.check("   1234567890   ").text, "1234567890");
  assert.strictEqual(F.check("123456789\u200B\u200B\u200B").ok, false);
  assert.strictEqual(F.check("1234\u0000\u0000\u000056789").why, "short");
  assert.strictEqual(F.check("a".repeat(1000)).ok, true);
  assert.deepStrictEqual([F.check("a".repeat(1001)).ok, F.check("a".repeat(1001)).why], [false, "long"]);
  assert.strictEqual(F.check(" " + "a".repeat(1000) + "\u200B\n").ok, true);
  assert.strictEqual(F.check("😀".repeat(5)).ok, false);
  assert.strictEqual(F.check("😀".repeat(10)).ok, true);
  assert.strictEqual(F.check("a".repeat(999) + "😀").ok, false);
  assert.strictEqual(F.check(12345).ok, false);
});

t("category comes only from the fixed list", () => {
  assert.deepStrictEqual(F.CATS, ["bug", "idea", "praise", "other"]);
  F.CATS.forEach((c) => assert.strictEqual(F.catOf(c), c));
  ["Bug", "BUG", " bug", "spam", "", "__proto__", "constructor", "toString", "hasOwnProperty"].forEach((c) => assert.strictEqual(F.catOf(c), null, c));
  [null, undefined, 1, ["bug"], { toString: () => "bug" }, new String("bug")].forEach((c) => assert.strictEqual(F.catOf(c), null));
});

t("payload is a fresh object with fixed keys and sanitized text", () => {
  const p = F.payload({ cat: "idea", msg: " More\u202E skies\u200B please!\r\n\r\n\r\n\r\nThanks ", at: 5, extra: 1, owner: "u_alice" });
  assert.deepStrictEqual(keys(p), ["at", "cat", "msg", "u", "v"]);
  assert.deepStrictEqual(p, { v: 1, cat: "idea", msg: "More skies please!\n\n\nThanks", at: 5, u: "u_alice" });
  assert.deepStrictEqual(keys(F.payload({ cat: "bug", msg: "0123456789", at: 1 })), ["at", "cat", "msg", "v"]);
  assert.strictEqual(typeof F.payload({ cat: "bug", msg: "0123456789" }).at, "number");
  assert.strictEqual(F.payload({ cat: "bug", msg: "0123456789", owner: "../x" }).u, undefined);
  assert.strictEqual(F.payload({ cat: "bug", msg: "0123456789", owner: { id: "u" } }).u, undefined);
});

t("payload refuses bad categories and messages", () => {
  assert.strictEqual(F.payload({ cat: "spam", msg: "a long enough message" }), null);
  assert.strictEqual(F.payload({ cat: ["bug"], msg: "a long enough message" }), null);
  assert.strictEqual(F.payload({ cat: "bug", msg: "too short" }), null);
  assert.strictEqual(F.payload({ cat: "bug", msg: "a".repeat(1001) }), null);
  assert.strictEqual(F.payload({ cat: "bug", msg: { toString: () => "a long enough message" } }), null);
  assert.strictEqual(F.payload(null), null);
  assert.strictEqual(F.payload("bug"), null);
});

t("payload never copies prototype or unknown keys from its input", () => {
  const evil = JSON.parse('{"__proto__": {"polluted": 1, "cat": "bug"}, "cat": "praise", "msg": "__proto__ is just text here", "constructor": {"prototype": {"polluted": 1}}, "info": {"__proto__": {"admin": true}, "email": "a@b.c", "uid": "u_alice", "name": "Alice", "skin": "inkwell", "ua": "Mozilla/5.0 (X11; Linux) Gecko/20100101 Firefox/131.0"}}');
  const p = F.payload(evil);
  assert.deepStrictEqual(keys(p), ["at", "cat", "info", "msg", "v"]);
  assert.strictEqual(p.msg, "__proto__ is just text here");
  assert.deepStrictEqual(keys(p.info), ["skin", "ua", "ver"]);
  assert.deepStrictEqual(p.info, { ver: "2", skin: "inkwell", ua: "Firefox" });
  assert.strictEqual(Object.getPrototypeOf(p), Object.prototype);
  assert.strictEqual(Object.getPrototypeOf(p.info), Object.prototype);
  assert.strictEqual({}.polluted, undefined);
  assert.strictEqual({}.admin, undefined);
  assert.strictEqual(F.payload(JSON.parse('{"__proto__": {"cat": "bug", "msg": "inherited message"}}')), null);
});

t("game info keeps only fixed, bounded, non-identifying keys", () => {
  const i = F.gameInfo({ build: "web", skin: "daylight", worlds: 3, stars: 120, width: 412, ua: "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/129.0 Mobile Safari/537.36", name: "Alice", email: "a@b.c", code: "AK5MZ7", uid: "u_alice" });
  assert.deepStrictEqual(i, { ver: "2", build: "web", skin: "daylight", worlds: 3, stars: 120, view: "phone", ua: "Chrome" });
  assert.deepStrictEqual(F.gameInfo({ build: "dev", skin: "<b>", worlds: 6, stars: 331, width: -1, ua: 5 }), { ver: "2", ua: "Other" });
  assert.deepStrictEqual(F.gameInfo({ worlds: 2.5, stars: "12" }), { ver: "2", ua: "Other" });
  assert.deepStrictEqual(F.gameInfo({ worlds: 0, stars: 0, width: 1024 }), { ver: "2", worlds: 0, stars: 0, view: "desktop", ua: "Other" });
  assert.deepStrictEqual(F.gameInfo(null), { ver: "2", ua: "Other" });
  const all = JSON.stringify(F.gameInfo({ build: "artifact", skin: "synthwave", worlds: 5, stars: 330, width: 800, ua: "x" }));
  assert.ok(!/@|u_|Alice|AK5MZ7|Mozilla/.test(all), all);
});

t("user agent family and screen size class", () => {
  const UA = {
    Firefox: ["Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 FxiOS/131.0 Mobile/15E148 Safari/605.1.15"],
    Chrome: ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/129.0 Mobile/15E148 Safari/604.1"],
    Safari: ["Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"],
    Edge: ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0"],
    Opera: ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 OPR/114.0.0.0"],
    Samsung: ["Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36"],
    Other: ["", "curl/8.0", "<script>alert(1)</script>"]
  };
  Object.keys(UA).forEach((k) => UA[k].forEach((u) => assert.strictEqual(F.uaFamily(u), k, u)));
  assert.strictEqual(F.uaFamily(null), "Other");
  assert.deepStrictEqual([360, 599, 600, 1023, 1024, 2560].map(F.viewOf), ["phone", "phone", "tablet", "tablet", "desktop", "desktop"]);
  assert.strictEqual(F.viewOf("1024"), null);
});

t("doc ids are generated from a fixed alphabet, never from the message", () => {
  for (let i = 0; i < 200; i++) { const r = F.rid(10); assert.ok(r.length === 10 && r.split("").every((c) => F.ALPHA.indexOf(c) >= 0), r); }
  assert.notStrictEqual(F.rid(10), F.rid(10));
  assert.strictEqual(F.docPath("u_alice", "20261014-k3m9x2ab"), "feedback/u_alice/m/20261014-k3m9x2ab");
  assert.strictEqual(F.docPath("Xy12abc", "20740-2"), "feedback/Xy12abc/m/20740-2");
  [["u_alice", "../save"], ["u_alice", "20740-0/x"], ["u_alice", "the sun is too hot"], ["u_alice", "20740-<img>"], ["../u", "20740-0"], ["a/b", "20740-0"], ["", "20740-0"], [null, "20740-0"], ["u_alice", ""]].forEach((x) => assert.strictEqual(F.docPath(x[0], x[1]), null, x.join(" ")));
});

t("local day and reset for the claude.ai build", () => {
  const t0 = new Date(2026, 9, 14, 23, 59, 30).getTime();
  assert.strictEqual(F.localDay(t0), 20261014);
  assert.strictEqual(F.localReset(t0), new Date(2026, 9, 15).getTime());
  assert.strictEqual(F.localDay(F.localReset(t0)), 20261015);
});

t("claude.ai rules: players read and write only their own feedback, the owner reads all of it", () => {
  const ok = (uid, lv, p, op) => R.allowed(R.RULES, uid, lv, p, op);
  assert.ok(ok("u_a", "interact", "feedback/u_a/m/20261014-abc", "write"));
  assert.ok(ok("u_a", "interact", "feedback/u_a/m/20261014-abc", "read"));
  assert.ok(ok("u_a", "interact", "feedback/u_a/m", "read"));
  assert.ok(!ok("u_b", "interact", "feedback/u_a/m/20261014-abc", "read"));
  assert.ok(!ok("u_b", "interact", "feedback/u_a/m/20261014-abc", "write"));
  assert.ok(!ok("u_b", "admin", "feedback/u_a/m/20261014-abc", "read"));
  assert.ok(!ok("u_b", "admin", "feedback/u_a/m/20261014-abc", "write"));
  assert.ok(!ok("u_v", "view", "feedback/u_v/m/20261014-abc", "write"));
  assert.ok(!ok("u_a", "interact", "feedback/u_b", "write"));
  assert.ok(!ok("u_a", "interact", "feedback/x", "write"));
  assert.ok(ok("u_own", "owner", "feedback/u_a/m/20261014-abc", "read"));
  assert.ok(ok("u_own", "owner", "feedback/u_a/m", "read"));
  assert.ok(ok("u_own", "owner", "feedback/u_own/m/20261014-abc", "write"));
  assert.ok(!ok("u_own", "owner", "data/users/u_a/save", "read"));
  assert.ok(ok("u_b", "interact", "cards/u_a", "read"));
});

t("capability declaration in CONTRACT.md is the full set the mock applies", () => {
  const md = fs.readFileSync(path.join(ROOT, "CONTRACT.md"), "utf8");
  const m = /The complete declaration:\n`(\{.*\})`/.exec(md);
  assert.ok(m, "declaration line");
  assert.deepStrictEqual(JSON.parse(m[1]), R.CAPABILITIES);
  const paths = R.CAPABILITIES.db.rules.map((r) => r.path);
  assert.ok(paths.indexOf("data/users") < 0);
  ["cards", "codes", "chal", "keys", "feedback"].forEach((p) => assert.ok(paths.indexOf(p) >= 0 && paths.indexOf(p + "/{self}") >= 0, p));
  assert.deepStrictEqual(R.RULES.find((r) => r.path === "feedback"), { path: "feedback", read: "owner", write: "owner" });
});

t("Firestore rules mirror the client's categories, bounds, daily slots and info allowlist", () => {
  const rules = fs.readFileSync(path.join(ROOT, "firebase/firestore.rules"), "utf8");
  assert.ok(rules.indexOf("d.cat in [" + F.CATS.map((c) => "'" + c + "'").join(", ") + "]") >= 0);
  assert.ok(rules.indexOf("d.msg.size() >= " + F.MIN + " && d.msg.size() <= " + F.MAX) >= 0);
  const slots = []; for (let i = 0; i < F.DAILY; i++) slots.push("string(today()) + '-" + i + "'");
  assert.ok(rules.indexOf("note in [" + slots.join(", ") + "]") >= 0);
  assert.ok(/match \/feedback\/\{uid\}\/m\/\{note\} \{\n\s+allow create: if signedInAs\(uid\)[^}]*seated\(\);\n\s+\}/.test(rules));
  assert.ok(!/match \/feedback[^{]*\{[^}]*allow (read|get|list|update|delete|write)/.test(rules));
  assert.ok(rules.indexOf("i.ua in ['Firefox', 'Chrome', 'Safari', 'Edge', 'Opera', 'Samsung', 'Other']") >= 0);
  assert.ok(rules.indexOf("i.skin in ['nocturne', 'daylight', 'synthwave', 'inkwell']") >= 0);
});

t("web adapter maps only generated feedback paths and gates them on the seat", () => {
  const src = fs.readFileSync(path.join(ROOT, "js/backend-firebase.js"), "utf8");
  assert.ok(/\/\^feedback\\\/\(\[\^\/\]\+\)\\\/m\\\/\(\\d\+-\\d\)\$\//.test(src));
  assert.ok(/\/\^\(codes\|feedback\)\\\/\/\.test\(p\) \? 1/.test(src));
});

console.log(n + " feedback tests passed");
