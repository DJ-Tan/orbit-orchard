(function () {
  const h = (s) => { let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return (x >>> 0).toString(36); };
  const out = [];
  for (let d = 1; d <= 5; d++) for (let k = 0; k < 8; k++) out.push(h(JSON.stringify(Orchard.generateLevel(5000 + k * 17, { difficulty: d }))));
  return out.join(",");
})
