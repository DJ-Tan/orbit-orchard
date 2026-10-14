(function () {
  "use strict";
  const themes = {
    1: { ambience: "fireflies", flora: "daisy", bg: ["#1f2350", "#2b1f4f", "#0e1128"], nebula: "#ff9ec4", accent: "#8fc79a", glow: "#ffd9a8" },
    2: { ambience: "aurora", flora: "fern", bg: ["#0f2e40", "#0f2440", "#06121d"], nebula: "#7ef0d8", accent: "#bfe6f0", glow: "#d8fff6" },
    3: { ambience: "nebula", flora: "spiral", bg: ["#2c1046", "#3a1352", "#12071f"], nebula: "#c77dff", accent: "#a99be6", glow: "#f0c6ff" },
    4: { ambience: "clockwork", flora: "sunflower", bg: ["#221d33", "#2e2438", "#0d0b16"], nebula: "#f3c677", accent: "#f3d67a", glow: "#ffe7b0" },
    5: { ambience: "horizon", flora: "ember", bg: ["#1c0d12", "#2a0f16", "#060305"], nebula: "#ff7a45", accent: "#ff9e6b", glow: "#ffd0a8" },
  };
  const names = { 1: "Meadow Belt", 2: "Frost Reach", 3: "Fold Nebula", 4: "Clockwork Orrery", 5: "Event Horizon" };
  const levels = [
    { id: "t-01", name: "Basics", hint: "Soil, rock, sun, ice, hungry soil and pollen.", seeds: 6, par: 3, preview: 1.6, launch: [220, 560],
      bodies: [{ kind: "fertile", x: 1150, y: 500, r: 90, need: 2 }, { kind: "barren", x: 760, y: 280, r: 80 }, { kind: "sun", x: 700, y: 780, r: 60 },
        { kind: "ice", x: 1400, y: 840, r: 60 }, { kind: "fertile", x: 1380, y: 190, r: 50 }],
      pollen: [[900, 560]] },
    { id: "t-02", name: "Orrery", hint: "Moons, a moon of a moon, and a binary pair.", seeds: 6, par: 2, preview: 1.4, launch: [150, 860],
      bodies: [{ kind: "sun", x: 820, y: 500, r: 55, dens: 3000 }, { kind: "fertile", r: 30, orbit: { p: 0, R: 190, w: 0.5, ph: 0 } },
        { kind: "barren", r: 34, orbit: { p: 0, R: 320, w: -0.3, ph: 2 } }, { kind: "fertile", r: 16, orbit: { p: 2, R: 62, w: 1.3, ph: 0 } },
        { kind: "sun", r: 30, dens: 2600, orbit: { cx: 1330, cy: 240, R: 70, w: 0.8, ph: 0 } }, { kind: "sun", r: 30, dens: 2600, orbit: { cx: 1330, cy: 240, R: 70, w: 0.8, ph: 3.14159 } }] },
    { id: "t-03", name: "Shields", hint: "A still shield and a turning one.", seeds: 5, par: 2, preview: 1.4, launch: [200, 500],
      bodies: [{ kind: "fertile", x: 900, y: 280, r: 70, shield: { gap: 1.4, w: 0, ph: 3.14 } }, { kind: "fertile", x: 1220, y: 690, r: 80, shield: { gap: 1.2, w: 0.8, ph: 0 } },
        { kind: "barren", x: 600, y: 700, r: 70 }] },
    { id: "t-04", name: "Folds and Winds", hint: "A portal pair and two wind zones.", seeds: 5, par: 2, preview: 1.5, launch: [200, 500],
      bodies: [{ kind: "fertile", x: 1400, y: 300, r: 60 }, { kind: "fertile", x: 1380, y: 820, r: 50 }, { kind: "barren", x: 820, y: 520, r: 80 }],
      portals: [{ a: [450, 230], b: [1120, 820] }],
      winds: [{ x: 560, y: 0, w: 220, h: 1000, ax: 0, ay: 60 }, { x: 1020, y: 250, w: 260, h: 320, ax: -50, ay: 20 }] },
    { id: "t-05", name: "Boost Gates", hint: "Plain, re-aiming and slowing gates, plus three pollen.", seeds: 5, par: 2, preview: 1.8, launch: [200, 700],
      bodies: [{ kind: "fertile", x: 1320, y: 420, r: 70 }, { kind: "fertile", x: 880, y: 820, r: 45 }, { kind: "ice", x: 700, y: 200, r: 55 }],
      boosts: [{ x: 480, y: 560, mult: 1.4 }, { x: 900, y: 420, mult: 1.0, ang: -1.2 }, { x: 1100, y: 700, mult: 0.8, ang: 0.3 }],
      pollen: [[640, 470], [1150, 260], [1420, 800]] },
    { id: "t-06", name: "Event Horizon", hint: "A black hole and a repulsor.", seeds: 6, par: 4, preview: 1.2, launch: [200, 300],
      bodies: [{ kind: "blackhole", x: 800, y: 520, r: 18 }, { kind: "repulsor", x: 1120, y: 250, r: 40 }, { kind: "fertile", x: 1350, y: 650, r: 75, need: 3 },
        { kind: "fertile", x: 480, y: 830, r: 45 }] },
    { id: "t-07", name: "Everything", hint: "Every mechanic at once.", seeds: 8, par: 4, preview: 1.0, launch: [180, 820],
      bodies: [{ kind: "sun", x: 820, y: 460, r: 55, dens: 3000 }, { kind: "fertile", r: 28, orbit: { p: 0, R: 170, w: 0.45, ph: 1 } },
        { kind: "fertile", x: 1380, y: 200, r: 60, need: 2, shield: { gap: 1.5, w: 0.6, ph: 2.5 } }, { kind: "ice", x: 1420, y: 760, r: 55 },
        { kind: "blackhole", x: 1080, y: 820, r: 15 }, { kind: "repulsor", x: 480, y: 330, r: 32 }, { kind: "barren", x: 560, y: 640, r: 50 },
        { kind: "fertile", x: 1150, y: 520, r: 45, shield: { gap: 1.6, w: 0, ph: 3.14 } }],
      portals: [{ a: [330, 560], b: [1450, 480] }], winds: [{ x: 640, y: 0, w: 160, h: 360, ax: 40, ay: 30 }],
      boosts: [{ x: 700, y: 820, mult: 1.3 }, { x: 1250, y: 380, mult: 1.1, ang: -1.9 }], pollen: [[980, 300], [300, 180]] },
  ];
  window.ORCHARD_TEST_WORLDS = [1, 2, 3, 4, 5].map((id) => ({ id: id, name: names[id], blurb: "test", theme: themes[id], levels: levels }));
})();
