const HOLD = encodeURIComponent(new URLSearchParams(location.search).get("k") || "weboff");
const OFF = "http://127.0.0.1:8772";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fails = 0;
const out = (s) => { document.getElementById("log").textContent += s + "\n"; console.log("[t] OFF " + s); };
function ok(c, name, extra) { if (c) pass++; else fails++; out((c ? "ok   " : "FAIL ") + name + (extra !== undefined && !c ? " :: " + JSON.stringify(extra) : "")); }
const calls = {};
let seq = 0, ready = null, frame = null;
addEventListener("message", (e) => {
  if (e.data && e.data.__ready && ready) { const f = ready; ready = null; f(); }
  if (e.data && e.data.__t && calls[e.data.__t]) { calls[e.data.__t](e.data); delete calls[e.data.__t]; }
});
function load(url) {
  return new Promise((res) => {
    ready = res;
    if (!frame) { frame = document.createElement("iframe"); document.getElementById("frames").appendChild(frame); }
    frame.src = url;
  });
}
const call = (fn, ...args) => new Promise((res, rej) => { const id = ++seq; calls[id] = (d) => (d.err ? rej(new Error(d.err)) : res(d.r)); frame.contentWindow.postMessage({ __t: id, fn, args }, "*"); });
async function until(f, ms) { const t = Date.now(); let s = await call("state"); while (!f(s) && Date.now() - t < ms) { await sleep(200); s = await call("state"); } return s; }

(async () => {
  await load(OFF + "/site/index.html?emu=1");
  let s = await until((x) => x.sw, 20000);
  ok(s.sw, "service worker controls the page after the first visit");
  await call("waitCaches");
  await load(OFF + "/site/index.html?emu=1&warm=1");
  await fetch(OFF + "/__die").catch(() => {});
  await sleep(500);
  let down = false;
  try { await fetch(OFF + "/site/index.html", { cache: "no-store" }); } catch (e) { down = true; }
  ok(down, "the site's server is gone");
  await load(OFF + "/site/index.html?emu=1&again=1");
  s = await call("state");
  ok(s.screen === "title" && s.tabs.length === 9, "page reloads from the cache with no server", s);
  const p = await call("play", 1, 1);
  ok(has(p.levels, "w1-01"), "a plot plays and saves locally offline", p);
  s = await call("state");
  ok(s.errs.length === 0, "no console errors offline", s.errs);

  await load(location.origin + "/dev/web/site-nosdk/index.html?emu=1");
  s = await until((x) => /needs a connection/.test(x.chip) || x.titleSign === false && x.screen === "title", 15000);
  const card = await call("settings");
  ok(/needs a connection/.test(card.text) && card.buttons.indexOf("Sign in with Google") < 0 && card.buttons.indexOf("Download save") >= 0, "SDK unreachable: card says cloud save needs a connection", card);
  s = await call("state");
  ok(!s.titleSign, "SDK unreachable: no sign-in prompt on the title");
  const p2 = await call("play", 1, 1);
  ok(has(p2.levels, "w1-01"), "SDK unreachable: the game still plays and saves", p2);
  s = await call("state");
  ok(s.errs.every((e) => /firebasejs|dynamically imported module/.test(e)), "SDK unreachable: only the blocked SDK fetch is reported", s.errs);
  out(fails ? `FAIL ${fails} of ${pass + fails}` : `PASS ${pass} checks`);
  fetch("/__release?k=" + HOLD);
})().catch((e) => { out("FAIL harness " + String(e)); out(`FAIL ${fails + 1} of ${pass + fails + 1}`); fetch("/__release?k=" + HOLD); });
function has(a, x) { return (a || []).indexOf(x) >= 0; }
