(function () {
  var q = new URLSearchParams(location.search);
  var who = q.get("uid") || "u_alice";
  window.__errs = [];
  var rep = function (s) { window.__errs.push(s); console.log("[ERR] " + who + " " + s); };
  addEventListener("error", function (e) { rep((e.message || "error") + " @" + String(e.filename || "").split("/").pop() + ":" + e.lineno); });
  addEventListener("unhandledrejection", function (e) { var r = e.reason; rep("rejection " + (r && (r.message || r.code) || r)); });
  var w = console.warn, er = console.error;
  console.warn = function () { rep("warn " + [].join.call(arguments, " ").slice(0, 300)); w.apply(console, arguments); };
  console.error = function () { rep("error " + [].join.call(arguments, " ").slice(0, 300)); er.apply(console, arguments); };
  window.__log = function (s) { console.log("[t] " + who + " " + s); };
})();
