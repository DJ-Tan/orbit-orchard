(function (root) {
  "use strict";
  var RULES = [
    { path: "", read: "view", write: "owner" },
    { path: "data/users/{self}", write: "interact" },
    { path: "cards", read: "interact", write: "owner" },
    { path: "cards/{self}", write: "interact" },
    { path: "codes", read: "interact", write: "owner" },
    { path: "codes/{self}", write: "interact" },
    { path: "chal", read: "interact", write: "owner" },
    { path: "chal/{self}", write: "interact" },
    { path: "keys", read: "interact", write: "owner" },
    { path: "keys/{self}", write: "interact" },
    { path: "feedback", read: "owner", write: "owner" },
    { path: "feedback/{self}", write: "interact" }
  ];
  var CAPABILITIES = { db: { rules: RULES }, downloads: true, user: { scopes: ["profile"] } };
  var RANK = { view: 0, interact: 1, admin: 2, owner: 3 };
  var ROOT = { path: "", read: "view", write: "interact" };

  function selfPrefixes(rules) {
    var out = ["data/users"];
    rules.forEach(function (r) { if (/\/\{self\}$/.test(r.path)) out.push(r.path.slice(0, -7)); });
    return out;
  }

  function need(rules, uid, segs, op) {
    var lv = { read: ROOT.read, write: ROOT.write };
    rules.forEach(function (r) {
      if (r.path !== "") return;
      if (r.read) lv.read = r.read;
      if (r.write) lv.write = r.write;
    });
    for (var d = 1; d <= segs.length; d++) {
      var p = segs.slice(0, d).join("/");
      rules.forEach(function (r) {
        if (r.path.replace(/\{self\}$/, uid) !== p) return;
        if (r.read) lv.read = r.read;
        if (r.write) lv.write = r.write;
      });
    }
    return lv[op];
  }

  /** Whether a viewer at `level` with id `uid` may `op` ("read" | "write") the document or collection at `path`. */
  function allowed(rules, uid, level, path, op) {
    var segs = String(path).split("/"), pres = selfPrefixes(rules);
    for (var i = 0; i < pres.length; i++) {
      var pre = pres[i].split("/");
      var under = segs.length > pre.length && pre.every(function (s, k) { return segs[k] === s; });
      if (under && segs[pre.length] !== uid) {
        var opened = rules.some(function (r) { return r.path === pres[i]; });
        if (!opened) return false;
      }
    }
    return RANK[level] >= RANK[need(rules, uid, segs, op)];
  }

  var api = { RULES: RULES, CAPABILITIES: CAPABILITIES, RANK: RANK, allowed: allowed };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ORCHARD_RULES = api;
})(typeof window !== "undefined" ? window : this);
