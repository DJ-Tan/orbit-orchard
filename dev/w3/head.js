(function () {
  "use strict";
  function ring(cx, cy, R, r, n, a0, skip) {
    const out = [];
    for (let k = 0; k < n; k++) {
      if (skip && skip.indexOf(k) >= 0) continue;
      const a = (a0 || 0) + (k * Math.PI * 2) / n;
      out.push({ kind: "barren", x: Math.round(cx + Math.cos(a) * R), y: Math.round(cy + Math.sin(a) * R), r: r });
    }
    return out;
  }
