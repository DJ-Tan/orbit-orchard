const fs = require("fs"); const f = "js/levels/w4.js"; let s = fs.readFileSync(f, "utf8");
const reps = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
for (const [id, a, b] of reps) {
  const i = s.indexOf(`id: "${id}"`); const j = s.indexOf(`id: "w4-`, i + 5); const end = j < 0 ? s.length : j;
  const blk = s.slice(i, end);
  if (!blk.includes(a)) { console.log("MISS", id, a); continue; }
  s = s.slice(0, i) + blk.split(a).join(b) + s.slice(end);
}
fs.writeFileSync(f, s);
