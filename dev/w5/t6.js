const q = require("./quick.js");
const vs = [];
for (const rr of [22, 28]) for (const fx of [1200, 1300]) for (const fr of [65, 80])
  vs.push({ tag: `rr${rr} fx${fx} fr${fr}`, launch: [200, 500], bodies: [{ kind: "repulsor", x: 720, y: 500, r: rr }, { kind: "fertile", x: fx, y: 500, r: fr }] });
vs.push({ tag: "bumper", launch: [200, 800], bodies: [{ kind: "repulsor", x: 900, y: 300, r: 36 }, { kind: "barren", x: 760, y: 700, r: 110 }, { kind: "fertile", x: 1350, y: 750, r: 60 }] });
vs.push({ tag: "bumper2", launch: [200, 800], bodies: [{ kind: "repulsor", x: 1000, y: 250, r: 40 }, { kind: "barren", x: 800, y: 650, r: 130 }, { kind: "fertile", x: 1380, y: 700, r: 60 }] });
for (const v of vs) console.log(v.tag, q(v));
