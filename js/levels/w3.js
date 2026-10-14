(function () {
  "use strict";

  function rock(x, y, r, dens) {
    const b = { kind: "barren", x: x, y: y, r: r };
    if (dens) b.dens = dens;
    return b;
  }

  function ring(cx, cy, R, r, n, a0, skip) {
    const out = [];
    for (let k = 0; k < n; k++) {
      if (skip && skip.indexOf(k) >= 0) continue;
      const a = (a0 || 0) + (k * Math.PI * 2) / n;
      out.push(rock(Math.round((cx + Math.cos(a) * R) * 10) / 10, Math.round((cy + Math.sin(a) * R) * 10) / 10, r));
    }
    return out;
  }

  function column(x, n, dens) {
    const r = Math.floor((958 - (n - 1) * 12) / (2 * n)), out = [];
    for (let k = 0; k < n; k++) out.push(rock(x, 21 + r + k * (2 * r + 12), r, dens));
    return out;
  }

  function wall(x, gy, gh, r, dens) {
    const out = [];
    for (let y = 21 + r; y + r <= 980; y += 2 * r + 12) if (Math.abs(y - gy) > gh / 2 + r) out.push(rock(x, y, r, dens));
    return out;
  }

  function box(x0, y0, nx, ny, r, dens) {
    const out = [], s = 2 * r + 12;
    for (let i = 0; i < nx; i++) { out.push(rock(x0 + i * s, y0, r, dens)); out.push(rock(x0 + i * s, y0 + (ny - 1) * s, r, dens)); }
    for (let j = 1; j < ny - 1; j++) { out.push(rock(x0, y0 + j * s, r, dens)); out.push(rock(x0 + (nx - 1) * s, y0 + j * s, r, dens)); }
    return out;
  }

  const levels = [
    {
      id: "w3-01", name: "First Fold", seeds: 6, par: 1, stars: [4, 5], preview: 1.6, launch: [200, 560],
      hint: "Violet rings are stitched together. Fly into one and you leave the other at the same speed and heading.",
      bodies: [{ kind: "fertile", x: 1330, y: 470, r: 64 }].concat(column(800, 5)),
      portals: [{ a: [470, 420], b: [1020, 420] }]
    },
    {
      id: "w3-02", name: "Hidden Pocket", seeds: 6, par: 1, stars: [4, 5], preview: 1.6, launch: [220, 620],
      hint: "This soil is sealed inside a ring of rock. Only the fold can take you in.",
      bodies: [{ kind: "fertile", x: 1150, y: 500, r: 55 }].concat(ring(1150, 500, 223.3, 70, 9, 0)),
      portals: [{ a: [560, 520], b: [1020, 500] }]
    },
    {
      id: "w3-03", name: "Chain Stitch", seeds: 6, par: 1, stars: [4, 5], preview: 1.5, launch: [200, 300],
      hint: "One fold can lead straight into the next. Line up the whole seam before you sow.",
      bodies: [{ kind: "fertile", x: 1370, y: 620, r: 75 }].concat(column(560, 6, 400), column(1040, 6, 400)),
      portals: [{ a: [340, 440], b: [700, 300] }, { a: [840, 440], b: [1180, 420] }]
    },
    {
      id: "w3-04", name: "Crossed Threads", seeds: 7, par: 2, stars: [5, 6], preview: 1.5, launch: [800, 880],
      hint: "Folds work both ways. The ring on the left leads right, and the one on the right leads left.",
      bodies: [{ kind: "fertile", x: 330, y: 420, r: 50 }, { kind: "fertile", x: 1270, y: 420, r: 50 }, rock(800, 470, 110)]
        .concat(ring(330, 420, 200, 62, 9, 0.611), ring(1270, 420, 200, 62, 9, 0.436)),
      portals: [{ a: [500, 700], b: [1348, 498] }, { a: [1100, 700], b: [252, 498] }]
    },
    {
      id: "w3-05", name: "Sunlit Seam", seeds: 6, par: 1, stars: [4, 5], preview: 1.5, launch: [1320, 730],
      hint: "The fold hides behind the sun. Let its pull swing you round, and brush the pollen as you pass.",
      bodies: [{ kind: "fertile", x: 330, y: 690, r: 66 }, { kind: "sun", x: 875, y: 445, r: 81 }].concat(ring(330, 690, 200, 62, 9, 0.175)),
      portals: [{ a: [720, 430], b: [425, 745] }],
      pollen: [[800, 540]]
    },
    {
      id: "w3-06", name: "Rising Nap", seeds: 6, par: 1, stars: [4, 5], preview: 1.5, launch: [200, 800],
      hint: "Shimmering bands of wind push every seed that crosses them. This one blows straight up, toward a plot that opens from below.",
      bodies: [{ kind: "fertile", x: 1100, y: 230, r: 60, shield: { gap: 1.3, w: 0, ph: 1.571 } }, rock(700, 470, 100)],
      winds: [{ x: 980, y: 320, w: 240, h: 660, ax: 0, ay: -420 }]
    },
    {
      id: "w3-07", name: "Bias Cut", seeds: 6, par: 1, stars: [4, 5], preview: 1.5, launch: [800, 900],
      hint: "A sideways wind blows across the top of the sky. Sow wide of the rock and let it carry you home.",
      bodies: [{ kind: "fertile", x: 800, y: 170, r: 55, shield: { gap: 1.4, w: 0, ph: 3.1416 } }, rock(800, 540, 140)],
      winds: [{ x: 120, y: 110, w: 1400, h: 190, ax: 380, ay: 0 }],
      pollen: [[420, 200]]
    },
    {
      id: "w3-08", name: "Wind River", seeds: 5, par: 1, stars: [3, 4], preview: 1.4, launch: [200, 300],
      hint: "Two winds meet in a river that bends round the corner of the sky. Drop a seed in and ride it to the far plot.",
      bodies: [{ kind: "fertile", x: 1310, y: 800, r: 60, shield: { gap: 1.5, w: 0, ph: 0 } }, rock(780, 640, 135)],
      winds: [
        { x: 1440, y: 40, w: 140, h: 660, ax: -265, ay: 185 },
        { x: 1400, y: 700, w: 180, h: 200, ax: -420, ay: -430 }
      ],
      pollen: [[1000, 240], [1510, 450]]
    },
    {
      id: "w3-09", name: "Backstitch", seeds: 5, par: 1, stars: [3, 4], preview: 1.4, launch: [300, 820],
      hint: "The plot sits above you, behind a rock shelf. Throw into the headwind and let it stitch the seed back to you.",
      bodies: [{ kind: "fertile", x: 800, y: 250, r: 78, dens: 500 }, rock(90, 540, 60, 700), rock(222, 540, 60, 700), rock(354, 540, 60, 700), rock(486, 540, 60, 700), rock(618, 540, 60, 700), rock(750, 540, 60, 700), rock(882, 540, 60, 700)],
      winds: [{ x: 1060, y: 40, w: 480, h: 920, ax: -560, ay: -150 }],
      pollen: [[1200, 540]]
    },
    {
      id: "w3-10", name: "Warp and Weft", seeds: 6, par: 2, stars: [4, 5], preview: 1.3, launch: [1440, 480],
      hint: "The far fold opens into a sealed sleeve with a falling wind. Enter it gently and the weft will carry you down.",
      bodies: [{ kind: "fertile", x: 330, y: 710, r: 50 }, { kind: "fertile", x: 900, y: 820, r: 50 }, { kind: "sun", x: 780, y: 300, r: 75 }]
        .concat(box(150, 150, 5, 8, 44, 500)),
      portals: [{ a: [1120, 520], b: [460, 280] }],
      winds: [{ x: 194, y: 194, w: 312, h: 612, ax: 90, ay: 410 }],
      pollen: [[350, 480]]
    },
    {
      id: "w3-11", name: "Shuttle Rush", seeds: 5, par: 1, stars: [3, 4], preview: 1.3, launch: [150, 520],
      hint: "No throw is strong enough to beat this gale. Pass through the boost gate first; its forward chevrons quicken your seed.",
      bodies: [{ kind: "fertile", x: 1400, y: 120, r: 70 }, rock(560, 760, 120)],
      winds: [{ x: 720, y: 40, w: 520, h: 920, ax: -900, ay: 0 }],
      boosts: [{ x: 430, y: 420, mult: 1.9 }]
    },
    {
      id: "w3-12", name: "Slack Thread", seeds: 5, par: 1, stars: [3, 4], preview: 1.3, launch: [150, 500],
      hint: "The tailwind flings seeds far too fast to fall. A boost gate with backward chevrons is a brake. Pass through it and the downdraft can settle you.",
      bodies: [{ kind: "fertile", x: 1380, y: 840, r: 60, shield: { gap: 1.6, w: 0, ph: -2.0 } }, rock(1320, 300, 110), rock(1060, 692, 46, 600), rock(1060, 796, 46, 600), rock(1060, 900, 46, 600)].concat(
        [340, 432, 524, 616, 708, 800, 892, 984].map(function (x) { return rock(x, 400, 40, 600); }),
        [340, 432, 524, 616, 708, 800, 892, 984].map(function (x) { return rock(x, 600, 40, 600); })),
      winds: [{ x: 300, y: 440, w: 720, h: 120, ax: 700, ay: 0 }, { x: 1120, y: 440, w: 400, h: 540, ax: 0, ay: 800 }],
      boosts: [{ x: 1070, y: 500, mult: 0.2 }]
    },
    {
      id: "w3-13", name: "Tension", seeds: 5, par: 1, stars: [3, 4], preview: 1.2, launch: [150, 300],
      hint: "Quicken to break the gale, then brake to fall soft. Both boost gates, in that order.",
      bodies: [{ kind: "fertile", x: 1370, y: 830, r: 60, shield: { gap: 1.6, w: 0, ph: -1.571 } }, rock(1250, 130, 90),
        rock(960, 540, 46, 600), rock(960, 644, 46, 600), rock(960, 748, 46, 600), rock(960, 852, 46, 600)],
      winds: [{ x: 560, y: 40, w: 300, h: 560, ax: -1000, ay: 0 }, { x: 1060, y: 240, w: 420, h: 740, ax: 0, ay: 600 }],
      boosts: [{ x: 520, y: 300, mult: 2, ang: 0 }, { x: 1010, y: 300, mult: 0.1 }]
    },
    {
      id: "w3-14", name: "Comet Gate", seeds: 5, par: 1, stars: [3, 4], preview: 1.2, launch: [760, 860],
      hint: "This boost gate points one way. Whatever way you enter, it flings the seed the way its chevrons point.",
      bodies: [{ kind: "fertile", x: 1400, y: 230, r: 60, shield: { gap: 1.1, w: 0, ph: 1.571 } }, { kind: "sun", x: 520, y: 420, r: 70 }].concat(
        [350, 422, 494, 566, 638, 710].map(function (y) { return rock(1320, y, 30, 600); }),
        [350, 422, 494, 566, 638, 710].map(function (y) { return rock(1480, y, 30, 600); })),
      boosts: [{ x: 1400, y: 820, mult: 1, ang: -1.571 }]
    },
    {
      id: "w3-15", name: "Hairpin Pleat", seeds: 5, par: 1, stars: [3, 4], preview: 1.2, launch: [1280, 800],
      hint: "The plot sits just above you but opens the other way. Send the seed across the sky and let the boost gate turn it back.",
      bodies: [{ kind: "fertile", x: 1400, y: 250, r: 60, shield: { gap: 1.4, w: 0, ph: 3.1416 } },
        rock(1300, 560, 70, 500), rock(1460, 560, 70, 500)].concat(
        [916, 988, 1060, 1132, 1204, 1276].map(function (x) { return rock(x, 150, 30, 500); }),
        [rock(1342, 116, 30, 500), rock(1414, 110, 30, 500), rock(1486, 110, 30, 500)],
        [916, 988, 1060, 1132, 1204, 1276].map(function (x) { return rock(x, 350, 30, 500); })),
      boosts: [{ x: 720, y: 250, mult: 1.2, ang: 0 }],
      pollen: [[800, 250]]
    },
    {
      id: "w3-16", name: "Zigzag Seam", seeds: 4, par: 1, stars: [2, 3], preview: 1.1, launch: [820, 880],
      hint: "One boost gate hands the seed to the next. Hit the first cleanly and the pair will stitch a path into the ring.",
      bodies: [{ kind: "fertile", x: 1300, y: 330, r: 55 }, rock(560, 590, 120, 300)].concat(ring(1300, 330, 197.6, 30, 17, 3.1416, [0])),
      boosts: [{ x: 250, y: 860, mult: 1.6, ang: -1.5708 }, { x: 250, y: 330, mult: 1, ang: 0 }],
      pollen: [[250, 600], [700, 330]]
    },
    {
      id: "w3-17", name: "Hem and Drop", seeds: 4, par: 1, stars: [2, 3], preview: 1.1, launch: [200, 620],
      hint: "Fold through the wall, then let the boost gate drop you through the only opening in the ring.",
      bodies: [{ kind: "fertile", x: 1250, y: 720, r: 55 }].concat(column(780, 6, 500), ring(1250, 720, 197.6, 30, 17, -1.5708, [0])),
      portals: [{ a: [500, 400], b: [1040, 530] }],
      boosts: [{ x: 1250, y: 405, mult: 1, ang: 1.5708 }],
      pollen: [[1145, 468]]
    },
    {
      id: "w3-18", name: "Pollen Loom", seeds: 4, par: 1, stars: [2, 3], preview: 1.0, launch: [150, 500],
      hint: "The winds weave up and down like threads on a loom. Slip over the first reed, dive under the next, and gather each grain.",
      bodies: [{ kind: "fertile", x: 1480, y: 540, r: 60 }].concat(wall(560, 383, 100, 40, 300), wall(1060, 659, 100, 40, 300)),
      winds: [
        { x: 640, y: 40, w: 260, h: 920, ax: 0, ay: 1000 },
        { x: 1120, y: 40, w: 260, h: 920, ax: 0, ay: -1800 }
      ],
      pollen: [[560, 383], [770, 300], [1060, 659]]
    },
    {
      id: "w3-19", name: "Blind Stitch", seeds: 5, par: 2, stars: [3, 4], preview: 0.4, launch: [800, 470],
      hint: "Your sightline is only a thread long here. Learn where each fold and boost gate sends you, then sow by feel.",
      bodies: [{ kind: "fertile", x: 380, y: 620, r: 55 }, { kind: "fertile", x: 1320, y: 820, r: 50, shield: { gap: 0.9, w: 0, ph: -1.5708 } },
        { kind: "sun", x: 800, y: 800, r: 70 }].concat(ring(380, 620, 197.6, 30, 17, 0), [rock(1180, 640, 40, 500), rock(1460, 640, 40, 500)]),
      portals: [{ a: [1150, 230], b: [290, 700] }],
      boosts: [{ x: 1320, y: 400, mult: 1, ang: 1.5708 }],
      pollen: [[980, 330], [1320, 560]]
    },
    {
      id: "w3-20", name: "Selvage", seeds: 4, par: 1, stars: [2, 3], preview: 0.9, launch: [150, 500],
      hint: "The gale throws you far too fast for the sun to catch. The boost gate brakes and tilts you upward, so the sun can swing you round to the open side.",
      bodies: [{ kind: "fertile", x: 1000, y: 250, r: 45, shield: { gap: 1.0, w: 0, ph: 1.77 } }, { kind: "sun", x: 1000, y: 540, r: 80 }].concat(
        [340, 432, 524, 616].map(function (x) { return rock(x, 400, 40, 600); }),
        [340, 432, 524, 616].map(function (x) { return rock(x, 600, 40, 600); })),
      winds: [{ x: 300, y: 440, w: 380, h: 120, ax: 900, ay: 0 }],
      boosts: [{ x: 720, y: 500, mult: 0.3, ang: -0.9 }]
    },
    {
      id: "w3-21", name: "Tangled Skein", seeds: 5, par: 2, stars: [3, 4], preview: 0.9, launch: [150, 300],
      hint: "Fold under the wall, let the low wind carry you to the second fold, and it opens beside hungry soil. It wants two seeds.",
      bodies: [{ kind: "fertile", x: 1200, y: 400, r: 55, need: 2 }].concat(column(700, 6, 400), ring(1200, 400, 197.6, 30, 17, 0)),
      portals: [{ a: [430, 540], b: [880, 860] }, { a: [1440, 860], b: [1080, 400] }],
      winds: [{ x: 840, y: 780, w: 740, h: 170, ax: 500, ay: 0 }],
      pollen: [[1160, 860]]
    },
    {
      id: "w3-22", name: "Heart of the Fold", seeds: 6, par: 3, stars: [4, 5], preview: 0.8, launch: [800, 900],
      hint: "The heart is sealed in stone and hungry for two seeds. Ride the rising wind into the fold, and let the boost gate feed the far plot.",
      bodies: [{ kind: "fertile", x: 800, y: 400, r: 55, need: 2 }, { kind: "fertile", x: 1420, y: 200, r: 50, shield: { gap: 1.0, w: 0, ph: 1.5708 } },
        { kind: "sun", x: 800, y: 740, r: 60 }].concat(
        ring(800, 400, 197.6, 30, 17, 1.5708 + 0.1848),
        [51, 123, 195, 267, 339, 411, 483, 555].map(function (y) { return rock(330, y, 30, 150); }),
        [330, 402, 474, 546, 618].map(function (y) { return rock(1340, y, 30, 500); }),
        [330, 402, 474, 546, 618].map(function (y) { return rock(1500, y, 30, 500); })),
      portals: [{ a: [170, 380], b: [800, 520] }],
      winds: [{ x: 60, y: 100, w: 230, h: 860, ax: 70, ay: -540 }],
      boosts: [{ x: 1430, y: 760, mult: 1, ang: -1.5708 }],
      pollen: [[175, 520], [1420, 480], [455, 835]]
    }
  ];

  window.ORCHARD_WORLDS = window.ORCHARD_WORLDS || [];
  window.ORCHARD_WORLDS.push({
    id: 3, order: 4, name: "Fold Nebula",
    blurb: "Space here is creased like cloth. Stitch seeds through portals, ride the wind rivers and let boost gates bend your aim.",
    theme: { ambience: "nebula", flora: "spiral", bg: ["#2c1046", "#3a1352", "#12071f"], nebula: "#c77dff", accent: "#a99be6", glow: "#f0c6ff" },
    levels: levels
  });
})();
