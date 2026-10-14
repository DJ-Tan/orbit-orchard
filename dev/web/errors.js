(function () {
  const errs = window.__errs = [];
  const add = (s) => { errs.push(s); console.log("[ERR] " + location.host + " " + s); };
  addEventListener("error", (e) => add((e.message || "error") + " @" + (e.filename || "").split("/").pop() + ":" + e.lineno));
  addEventListener("unhandledrejection", (e) => add("rejection " + ((e.reason && e.reason.stack) || e.reason)));
  ["error", "warn"].forEach((k) => {
    const f = console[k];
    console[k] = function () { add(k + " " + Array.prototype.map.call(arguments, (x) => (x && x.stack) || String(x)).join(" ").slice(0, 300)); return f.apply(console, arguments); };
  });
})();
