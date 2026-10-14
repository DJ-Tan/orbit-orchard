const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "../..");
const FROM = 2026, TO = 2036;
const RULES = path.join(ROOT, "firebase/firestore.rules"), CLIENT = path.join(ROOT, "js/backend-firebase.js");

/** UTC start and end of US daylight time for a year: second Sunday of March 10:00 UTC to first Sunday of November 09:00 UTC. */
function span(y) {
  const sunday = (m, n) => { const w = new Date(Date.UTC(y, m, 1)).getUTCDay(); return 1 + ((7 - w) % 7) + 7 * (n - 1); };
  return [Date.UTC(y, 2, sunday(2, 2), 10), Date.UTC(y, 10, sunday(10, 1), 9)];
}

const table = [];
for (let y = FROM; y <= TO; y++) table.push(span(y));
const client = "  const DST = [" + table.map((r) => "[" + r.join(", ") + "]").join(", ") + "];";
const rules = "    function dst(t) {\n      return " + table.map((r) => "(t >= " + r[0] + " && t < " + r[1] + ")").join("\n        || ") + ";\n    }\n";
const RE_CLIENT = /^  const DST = \[.*\];$/m, RE_RULES = /^    function dst\(t\) \{\n[\s\S]*?\n    \}\n/m;

if (require.main === module) {
  const check = process.argv.indexOf("--check") >= 0;
  let bad = 0;
  [[CLIENT, RE_CLIENT, client], [RULES, RE_RULES, rules]].forEach((x) => {
    const src = fs.readFileSync(x[0], "utf8");
    if (!x[1].test(src)) { console.log("missing table in " + x[0]); bad++; return; }
    const out = src.replace(x[1], x[2]);
    if (out === src) return;
    if (check) { console.log("stale table in " + x[0]); bad++; } else { fs.writeFileSync(x[0], out); console.log("updated " + x[0]); }
  });
  if (check && !bad) console.log("DST tables match " + FROM + "-" + TO);
  process.exit(bad ? 1 : 0);
}
module.exports = { table, client, rules, FROM, TO };
