const assert = require("assert");
const fs = require("fs");
const path = require("path");
const U = require("../../js/username.js");

const ROOT = path.join(__dirname, "../..");
let n = 0;
const t = (name, fn) => { fn(); n++; console.log("ok " + name); };
const why = (s) => U.check(s).why;
const X = "A".repeat(42) + "Q", Y = "B".repeat(42) + "g";

t("valid names pass with display case kept and a lowercase key", () => {
  for (const s of ["Bob", "bob", "Ada_Lovelace", "x1y", "Gardener42", "a_b_c", "Zed9", "ABCDEFGHIJKLMNOPQRST"]) {
    const c = U.check(s);
    assert.ok(c.ok, s);
    assert.strictEqual(c.name, s);
    assert.strictEqual(c.key, s.toLowerCase());
  }
});

t("surrounding ASCII spaces, tabs and newlines are trimmed", () => {
  assert.deepStrictEqual(U.check("  Bob\t\n"), { ok: true, name: "Bob", key: "bob", why: "" });
});

t("empty and non-string input are refused", () => {
  for (const v of ["", "   ", null, undefined, 42, true, {}, ["Bob"], { toString: () => "Bob" }]) assert.strictEqual(why(v), "empty", String(v));
});

t("length is 3 to 20 characters", () => {
  assert.strictEqual(why("ab"), "short");
  assert.ok(U.check("abc").ok);
  assert.ok(U.check("a".repeat(20)).ok);
  assert.strictEqual(why("a".repeat(21)), "long");
});

t("must start with a letter", () => {
  assert.strictEqual(why("1bob"), "start");
  assert.strictEqual(why("_bob"), "start");
});

t("no double underscore and no trailing underscore", () => {
  assert.strictEqual(why("bo__b"), "double");
  assert.strictEqual(why("bob_"), "end");
  assert.ok(U.check("b_o_b").ok);
});

t("anything outside letters, digits and underscore is refused", () => {
  for (const s of ["bob smith", "bob-smith", "bob.smith", "bob@x", "<b>bob</b>", "<img src=x onerror=alert(1)>", "bob\"", "bob'", "bob&amp", "a/b/c", "../save", "bob%20", "bob\u0000x", "bob\nx"]) assert.strictEqual(why(s), "chars", JSON.stringify(s));
});

t("Unicode look-alikes are refused, not folded", () => {
  assert.strictEqual(why("аdmin"), "chars");
  assert.strictEqual(why("bоb"), "chars");
  assert.strictEqual(why("ｂｏｂ"), "chars");
  assert.strictEqual(why("Bób"), "chars");
  assert.strictEqual(why("Bøb"), "chars");
  assert.strictEqual(why("ınfo"), "chars");
  assert.strictEqual(why("bob\u{1D41B}"), "chars");
});

t("zero-width, bidi and other invisible characters are refused, not stripped", () => {
  for (const c of ["​", "‌", "‍", "﻿", "‪", "‮", "⁦", "⁩", " ", "­", "⁠", "᠎", "　"]) {
    assert.strictEqual(why("bo" + c + "b"), "chars", c.codePointAt(0).toString(16));
    assert.strictEqual(why(c + "bob"), "chars", c.codePointAt(0).toString(16));
    assert.strictEqual(why("bob" + c), "chars", c.codePointAt(0).toString(16));
  }
});

t("NFC is applied before the charset check", () => {
  assert.strictEqual(U.check("éve").name, "éve");
  assert.strictEqual(why("éve"), "chars");
});

t("keys are case-insensitive", () => {
  assert.strictEqual(U.check("BoB").key, U.check("bob").key);
  assert.strictEqual(U.check("ADA_lovelace").key, "ada_lovelace");
});

t("reserved names are refused in any case", () => {
  for (const s of ["admin", "Admin", "ADMINISTRATOR", "Moderator", "support", "Orbit", "OrbitOrchard", "orchard", "oracle", "System", "root", "null", "undefined",
    "Gardener", "anonymous", "everyone", "here", "Claude", "anthropic", "Google", "firebase", "staff", "official", "help", "mod"]) assert.strictEqual(why(s), "reserved", s);
  for (const s of ["me", "you"]) assert.ok(!U.check(s).ok, s);
  assert.ok(U.check("admin2").ok && U.check("gardener_jo").ok && U.check("Rooted").ok);
});

t("every required reserved name is listed", () => {
  const need = "admin administrator mod moderator support help staff official orbit orbitorchard orchard oracle system root null undefined gardener anonymous everyone here me you claude anthropic google firebase".split(" ");
  assert.deepStrictEqual(need.filter((w) => U.RESERVED.indexOf(w) < 0), []);
});

t("the blocklist matches substrings of the lowercase key", () => {
  for (const w of U.BLOCK) {
    assert.strictEqual(why(w[0].toUpperCase() + w.slice(1) + "y"), "blocked", w);
    assert.strictEqual(why("xx" + w.toUpperCase()), "blocked", w);
  }
  assert.ok(U.BLOCK.length > 0 && U.BLOCK.length <= 16);
  assert.ok(U.check("Scrabble").ok && U.check("Peacock").ok && U.check("Grapevine").ok);
});

t("shown() accepts only an exactly valid stored name", () => {
  assert.strictEqual(U.shown("Bob"), "Bob");
  for (const v of [" Bob", "Bob ", "<b>", "аdmin", "admin", "ab", 42, null, undefined, {}, ["Bob"], "éve"]) assert.strictEqual(U.shown(v), "", JSON.stringify(v));
});

t("docPath takes only a lowercase key in the id shape", () => {
  assert.strictEqual(U.docPath("bob"), "names/bob");
  assert.strictEqual(U.docPath("ada_lovelace"), "names/ada_lovelace");
  for (const k of ["Bob", "ab", "a".repeat(21), "1bob", "../x", "bob/x", "", null, "bоb", "bob "]) assert.strictEqual(U.docPath(k), null, String(k));
});

t("msOf reads live and JSON-copied timestamps", () => {
  assert.strictEqual(U.msOf({ toMillis: () => 1234 }), 1234);
  assert.strictEqual(U.msOf({ seconds: 1700000000, nanoseconds: 123456789 }), 1700000000123);
  for (const v of [null, undefined, 5, "x", {}, { seconds: "1" }]) assert.strictEqual(U.msOf(v), 0);
});

t("the weekly lock lasts 7 days after the last change", () => {
  const t0 = 1700000000000, ts = { seconds: t0 / 1000, nanoseconds: 0 };
  assert.strictEqual(U.WEEK, 7 * 86400000);
  assert.strictEqual(U.lockedUntil(null, t0), 0);
  assert.strictEqual(U.lockedUntil(ts, t0 + 1000), t0 + U.WEEK);
  assert.strictEqual(U.lockedUntil(ts, t0 + U.WEEK - 1), t0 + U.WEEK);
  assert.strictEqual(U.lockedUntil(ts, t0 + U.WEEK), 0);
  assert.strictEqual(U.lockedUntil(t0, t0 + 1000), t0 + U.WEEK);
  assert.strictEqual(U.lockedUntil(0, t0), 0);
});

t("nameDoc is a fresh { u, n } only for a valid name and uid", () => {
  assert.deepStrictEqual(U.nameDoc("uid1", U.check("Bob")), { u: "uid1", n: "Bob" });
  assert.strictEqual(U.nameDoc("uid1", U.check("admin")), null);
  assert.strictEqual(U.nameDoc("../x", U.check("Bob")), null);
});

t("pubDoc keeps only the fixed keys and drops the Google name while a username is set", () => {
  const d = { x: X, y: Y, at: 1, n: "Bob Builder", s: true, un: "Old", ut: { seconds: 1, nanoseconds: 0 }, extra: "<script>", __proto__: { polluted: 1 } };
  const p = U.pubDoc(d, "Bob", "STAMP", 99);
  assert.deepStrictEqual(Object.keys(p).sort(), ["at", "s", "un", "ut", "x", "y"]);
  assert.strictEqual(p.ut, "STAMP");
  assert.strictEqual(p.at, 99);
  const r = U.pubDoc(d, "", "STAMP", 99);
  assert.deepStrictEqual(Object.keys(r).sort(), ["at", "n", "s", "ut", "x", "y"]);
  assert.strictEqual(U.pubDoc({ x: X }, "Bob", "S", 1), null);
});

t("plan: a first claim writes pub and the new names doc", () => {
  const ops = U.plan("uid1", { x: X, y: Y, at: 1 }, U.check("Bob"), "S", 5);
  assert.deepStrictEqual(ops.map((o) => o[0]), ["pub/uid1", "names/bob"]);
  assert.deepStrictEqual(ops[1][1], { u: "uid1", n: "Bob" });
  assert.strictEqual(ops[0][1].un, "Bob");
});

t("plan: a change releases the old names doc in the same batch", () => {
  const ops = U.plan("uid1", { x: X, y: Y, at: 1, un: "Bob", ut: 1 }, U.check("Robert"), "S", 5);
  assert.deepStrictEqual(ops.map((o) => [o[0], o[1] === null]), [["pub/uid1", false], ["names/robert", false], ["names/bob", true]]);
});

t("plan: a capitals-only change touches pub only", () => {
  const ops = U.plan("uid1", { x: X, y: Y, at: 1, un: "bob", ut: 1 }, U.check("Bob"), "S", 5);
  assert.deepStrictEqual(ops.map((o) => o[0]), ["pub/uid1"]);
  assert.strictEqual(ops[0][1].un, "Bob");
});

t("plan: removal clears un and deletes the old names doc", () => {
  const ops = U.plan("uid1", { x: X, y: Y, at: 1, un: "Bob", ut: 1 }, null, "S", 5);
  assert.deepStrictEqual(ops.map((o) => o[0]), ["pub/uid1", "names/bob"]);
  assert.ok(!("un" in ops[0][1]) && ops[0][1].ut === "S" && ops[1][1] === null);
});

t("plan: no-ops and bad input give no batch", () => {
  assert.strictEqual(U.plan("uid1", { x: X, y: Y, at: 1, un: "Bob" }, U.check("Bob"), "S", 5), null);
  assert.strictEqual(U.plan("uid1", { x: X, y: Y, at: 1 }, null, "S", 5), null);
  assert.strictEqual(U.plan("uid1", { x: X, y: Y, at: 1 }, U.check("bad name"), "S", 5), null);
  assert.strictEqual(U.plan("../x", { x: X, y: Y, at: 1 }, U.check("Bob"), "S", 5), null);
  assert.strictEqual(U.plan("uid1", null, U.check("Bob"), "S", 5), null);
});

t("the rules mirror the client's shape, reserved list and blocklist", () => {
  const R = fs.readFileSync(path.join(ROOT, "firebase/firestore.rules"), "utf8");
  const fn = R.slice(R.indexOf("function validName"), R.indexOf("function namePath"));
  assert.ok(fn.indexOf("n.size() >= 3 && n.size() <= 20") >= 0);
  assert.ok(fn.indexOf("n.matches('[A-Za-z][A-Za-z0-9]*(_[A-Za-z0-9]+)*')") >= 0);
  const res = JSON.parse("[" + /n\.lower\(\) in \[([^\]]*)\]/.exec(fn)[1].replace(/'/g, '"') + "]");
  assert.deepStrictEqual(res, U.RESERVED);
  const blk = /\.\*\(([^)]*)\)\.\*/.exec(fn)[1].split("|");
  assert.deepStrictEqual(blk, U.BLOCK);
});

t("the web build loads username.js; claude.ai's page doesn't", () => {
  const html = fs.readFileSync(path.join(ROOT, "orbit-orchard.html"), "utf8"), build = fs.readFileSync(path.join(ROOT, "firebase/build.sh"), "utf8");
  assert.ok(html.indexOf("username.js") < 0);
  assert.ok(build.indexOf("<script src=\"js/backend-firebase.js\"></script>\\n<script src=\"js/username.js\"></script>") >= 0);
});

t("names render only through textContent in the module", () => {
  const src = fs.readFileSync(path.join(ROOT, "js/username.js"), "utf8");
  const html = src.split("\n").filter((l) => /innerHTML/.test(l));
  assert.ok(html.every((l) => !/st\.un|\.name|draft|flash|value/.test(l)), html.join("\n"));
});

console.log("USERNAME PASS " + n + " checks");
