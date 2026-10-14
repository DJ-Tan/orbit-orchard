window.ORCHARD_WORLDS = window.ORCHARD_WORLDS || [];
window.ORCHARD_WORLDS.push({
  id: 4, order: 3, name: "Clockwork Orrery",
  blurb: "A brass sky of moons on rails and shields that never stop turning. Here the when matters as much as the where.",
  theme: { ambience: "clockwork", flora: "sunflower", bg: ["#221d33", "#2e2438", "#0d0b16"], nebula: "#f3c677", accent: "#f3d67a", glow: "#ffe7b0" },
  levels: [
    {
      id: "w4-01", name: "First Tick",
      hint: "This soil is a moon, and it keeps moving while you aim. Wait until it swings toward you.",
      seeds: 6, par: 1, stars: [4, 5], preview: 1.6, launch: [220, 560],
      bodies: [
        { kind: "barren", x: 1050, y: 500, r: 90 },
        { kind: "fertile", r: 40, orbit: { p: 0, R: 220, w: 0.4, ph: Math.PI } }
      ]
    },
    {
      id: "w4-02", name: "Sweep Hand",
      hint: "A rock sweeps across the lane like a clock hand. Throw once it has passed.",
      seeds: 6, par: 1, stars: [4, 5], preview: 1.6, launch: [200, 500],
      bodies: [
        { kind: "fertile", x: 1320, y: 500, r: 60 },
        { kind: "barren", r: 55, orbit: { cx: 850, cy: 500, R: 170, w: 0.5, ph: Math.PI } }
      ],
      pollen: [[850, 500]]
    },
    {
      id: "w4-03", name: "Hour and Minute",
      hint: "Two soil moons ride one rock at different speeds. The slow one is patient, the fast one is not.",
      seeds: 7, par: 2, stars: [5, 6], preview: 1.5, launch: [170, 860],
      bodies: [
        { kind: "barren", x: 900, y: 520, r: 80 },
        { kind: "fertile", r: 38, orbit: { p: 0, R: 190, w: 0.9, ph: 0 } },
        { kind: "fertile", r: 42, orbit: { p: 0, R: 330, w: 0.3, ph: 2.5 } }
      ]
    },
    {
      id: "w4-04", name: "Balance Wheel",
      hint: "Two plots waltz around an empty point. Their pull swings together, so aim for the pair.",
      seeds: 7, par: 2, stars: [5, 6], preview: 1.5, launch: [220, 250],
      bodies: [
        { kind: "fertile", r: 45, orbit: { cx: 1000, cy: 520, R: 150, w: 0.6, ph: 0 } },
        { kind: "fertile", r: 45, orbit: { cx: 1000, cy: 520, R: 150, w: 0.6, ph: Math.PI } },
        { kind: "barren", x: 560, y: 760, r: 70 }
      ],
      pollen: [[1000, 520]]
    },
    {
      id: "w4-05", name: "Turning Gate",
      hint: "The shield around this soil turns. Watch the gap come round, then sow through it.",
      seeds: 6, par: 1, stars: [4, 5], preview: 1.4, launch: [220, 520],
      bodies: [
        { kind: "fertile", x: 1150, y: 520, r: 70, shield: { gap: 1.6, w: 0.6, ph: Math.PI } }
      ],
      pollen: [[720, 300]]
    },
    {
      id: "w4-06", name: "Eclipse",
      hint: "A soil moon slips behind the sun each lap. Catch it on the near side.",
      seeds: 7, par: 2, stars: [5, 6], preview: 1.4, launch: [200, 800],
      bodies: [
        { kind: "sun", x: 900, y: 500, r: 65, dens: 3000 },
        { kind: "fertile", r: 36, orbit: { p: 0, R: 230, w: 0.45, ph: Math.PI } },
        { kind: "fertile", x: 1400, y: 190, r: 50 }
      ]
    },
    {
      id: "w4-07", name: "Clock Face",
      hint: "Six stones circle the soil like numbers on a dial. Slip between two of them.",
      seeds: 6, par: 1, stars: [4, 5], preview: 1.3, launch: [220, 700],
      bodies: [
        { kind: "fertile", x: 1050, y: 500, r: 60 },
        { kind: "barren", r: 32, orbit: { p: 0, R: 175, w: 0.35, ph: 0 } },
        { kind: "barren", r: 32, orbit: { p: 0, R: 175, w: 0.35, ph: 1.0472 } },
        { kind: "barren", r: 32, orbit: { p: 0, R: 175, w: 0.35, ph: 2.0944 } },
        { kind: "barren", r: 32, orbit: { p: 0, R: 175, w: 0.35, ph: 3.1416 } },
        { kind: "barren", r: 32, orbit: { p: 0, R: 175, w: 0.35, ph: 4.1888 } },
        { kind: "barren", r: 32, orbit: { p: 0, R: 175, w: 0.35, ph: 5.2360 } }
      ],
      pollen: [[1050, 160]]
    },
    {
      id: "w4-08", name: "Gear Train",
      hint: "A moon rides a rock that rides an empty hub. Two wheels turning means two things to time.",
      seeds: 5, par: 1, stars: [3, 4], preview: 1.3, launch: [200, 200],
      bodies: [
        { kind: "barren", r: 55, orbit: { cx: 850, cy: 520, R: 200, w: 0.35, ph: 0 } },
        { kind: "fertile", r: 34, orbit: { p: 0, R: 120, w: -1.0, ph: Math.PI } }
      ],
      pollen: [[850, 520]]
    },
    {
      id: "w4-09", name: "Counter Wheels",
      hint: "Two rings of stone turn opposite ways. Wait for their gaps to line up.",
      seeds: 5, par: 1, stars: [3, 4], preview: 1.2, launch: [200, 500],
      bodies: [
        { kind: "fertile", x: 1100, y: 500, r: 38 },
        { kind: "barren", r: 34, orbit: { p: 0, R: 140, w: 0.5, ph: 0 } },
        { kind: "barren", r: 34, orbit: { p: 0, R: 140, w: 0.5, ph: 1.5708 } },
        { kind: "barren", r: 34, orbit: { p: 0, R: 140, w: 0.5, ph: 3.1416 } },
        { kind: "barren", r: 34, orbit: { p: 0, R: 140, w: 0.5, ph: 4.7124 } },
        { kind: "barren", r: 38, orbit: { p: 0, R: 260, w: -0.35, ph: 0.7854 } },
        { kind: "barren", r: 38, orbit: { p: 0, R: 260, w: -0.35, ph: 2.3562 } },
        { kind: "barren", r: 38, orbit: { p: 0, R: 260, w: -0.35, ph: 3.9270 } },
        { kind: "barren", r: 38, orbit: { p: 0, R: 260, w: -0.35, ph: 5.4978 } }
      ]
    },
    {
      id: "w4-10", name: "Resonance",
      hint: "The inner moon laps the outer one exactly twice. Learn the rhythm and both come to you.",
      seeds: 6, par: 2, stars: [4, 5], preview: 1.2, launch: [1480, 880],
      bodies: [
        { kind: "sun", x: 850, y: 520, r: 55, dens: 1500 },
        { kind: "fertile", r: 16, orbit: { p: 0, R: 200, w: 0.6, ph: 0 } },
        { kind: "fertile", r: 18, orbit: { p: 0, R: 360, w: 0.3, ph: 0 } }
      ],
      pollen: [[1350, 200], [420, 180]]
    },
    {
      id: "w4-11", name: "Ice Pendulum",
      hint: "This soil only opens to the sky. Bank off the swinging ice to drop in from above.",
      seeds: 5, par: 1, stars: [3, 4], preview: 1.2, launch: [200, 600],
      bodies: [
        { kind: "fertile", x: 1400, y: 540, r: 70, shield: { gap: 2.38, w: 0, ph: -Math.PI / 2 } },
        { kind: "ice", r: 50, orbit: { cx: 1120, cy: 235, R: 105, w: 0.6, ph: 0 } }
      ]
    },
    {
      id: "w4-12", name: "Tourbillon",
      hint: "A spinning shield rides on a moving moon. The moon and the gap both have to face you at once.",
      seeds: 6, par: 2, stars: [4, 5], preview: 1.1, launch: [200, 300],
      bodies: [
        { kind: "barren", x: 900, y: 520, r: 70 },
        { kind: "fertile", r: 40, orbit: { p: 0, R: 240, w: 0.35, ph: Math.PI }, shield: { gap: 1.5, w: 1.0, ph: 0 } },
        { kind: "fertile", x: 1400, y: 820, r: 50 }
      ]
    },
    {
      id: "w4-13", name: "Trine",
      hint: "Three plots turn around one sun, a third of a lap apart. One is always in reach.",
      seeds: 7, par: 3, stars: [5, 6], preview: 1.1, launch: [200, 850],
      bodies: [
        { kind: "sun", x: 950, y: 500, r: 55, dens: 2200 },
        { kind: "fertile", r: 22, orbit: { p: 0, R: 180, w: 0.6, ph: 0 } },
        { kind: "fertile", r: 22, orbit: { p: 0, R: 180, w: 0.6, ph: 2.0944 } },
        { kind: "fertile", r: 22, orbit: { p: 0, R: 180, w: 0.6, ph: 4.1888 } }
      ]
    },
    {
      id: "w4-14", name: "Blind Ratchet",
      hint: "Your sightline is short, but the moon keeps a steady beat. Count it and throw.",
      seeds: 6, par: 2, stars: [4, 5], preview: 0.4, launch: [250, 800],
      bodies: [
        { kind: "barren", x: 1000, y: 450, r: 60, dens: 1200 },
        { kind: "fertile", r: 22, orbit: { p: 0, R: 210, w: -0.5, ph: Math.PI / 2 } },
        { kind: "fertile", x: 460, y: 200, r: 32 }
      ]
    },
    {
      id: "w4-15", name: "Chime Twice",
      hint: "This hungry moon wants two seeds, and two stones orbit inside its path the other way.",
      seeds: 6, par: 2, stars: [4, 5], preview: 1.0, launch: [220, 200],
      bodies: [
        { kind: "sun", x: 1000, y: 520, r: 55, dens: 1000 },
        { kind: "fertile", r: 28, need: 2, orbit: { p: 0, R: 250, w: 0.4, ph: Math.PI } },
        { kind: "barren", r: 40, orbit: { p: 0, R: 150, w: -1.0, ph: 0 } },
        { kind: "barren", r: 40, orbit: { p: 0, R: 150, w: -1.0, ph: Math.PI } }
      ]
    },
    {
      id: "w4-16", name: "Cuckoo Call",
      hint: "The moon hides behind its rock and pops out like a cuckoo on the hour. Curve round the big wall to meet it.",
      seeds: 5, par: 2, stars: [3, 4], preview: 1.0, launch: [200, 500],
      bodies: [
        { kind: "barren", x: 620, y: 500, r: 160 },
        { kind: "barren", x: 1150, y: 450, r: 60 },
        { kind: "fertile", r: 36, orbit: { p: 1, R: 190, w: 0.5, ph: 0 } },
        { kind: "fertile", x: 1460, y: 150, r: 50 }
      ]
    },
    {
      id: "w4-17", name: "Double Escapement",
      hint: "Two shields spin opposite ways while a stone patrols between them.",
      seeds: 5, par: 2, stars: [3, 4], preview: 1.0, launch: [200, 850],
      bodies: [
        { kind: "fertile", x: 650, y: 280, r: 55, shield: { gap: 1.2, w: 0.7, ph: 0 } },
        { kind: "fertile", x: 1250, y: 700, r: 55, shield: { gap: 1.2, w: -0.7, ph: Math.PI } },
        { kind: "barren", r: 40, orbit: { cx: 950, cy: 490, R: 120, w: 0.5, ph: 0 } }
      ]
    },
    {
      id: "w4-18", name: "Astrolabe",
      hint: "A moon rides a rock that rides the sun. Read all three wheels before you throw.",
      seeds: 5, par: 2, stars: [3, 4], preview: 1.0, launch: [1500, 880],
      bodies: [
        { kind: "sun", x: 800, y: 500, r: 50, dens: 1200 },
        { kind: "fertile", r: 30, orbit: { p: 0, R: 120, w: -0.6, ph: 0 } },
        { kind: "barren", r: 50, dens: 400, orbit: { p: 0, R: 320, w: 0.3, ph: 0 } },
        { kind: "fertile", r: 15, orbit: { p: 2, R: 80, w: -1.2, ph: 0 } }
      ]
    },
    {
      id: "w4-19", name: "Regulator",
      hint: "A stone bob circles through the middle lane. Throw once it has swung clear, and catch each moon as it comes round.",
      seeds: 5, par: 2, stars: [3, 4], preview: 0.9, launch: [180, 850],
      bodies: [
        { kind: "barren", x: 1150, y: 550, r: 70 },
        { kind: "fertile", r: 26, orbit: { p: 0, R: 200, w: 0.5, ph: Math.PI } },
        { kind: "fertile", r: 20, orbit: { p: 0, R: 320, w: -0.3, ph: 2 } },
        { kind: "barren", r: 28, orbit: { cx: 640, cy: 680, R: 120, w: 0.5, ph: 0 } }
      ]
    },
    {
      id: "w4-20", name: "Striking Train",
      hint: "Three hammers circle the bell, and its shield turns the other way. Strike when a hammer has passed and the gap faces you.",
      seeds: 5, par: 2, stars: [3, 4], preview: 0.9, launch: [250, 650],
      bodies: [
        { kind: "fertile", x: 1100, y: 450, r: 55, shield: { gap: 1.3, w: 0.8, ph: Math.PI } },
        { kind: "barren", r: 32, orbit: { p: 0, R: 190, w: -0.4, ph: 0 } },
        { kind: "barren", r: 32, orbit: { p: 0, R: 190, w: -0.4, ph: 2.0944 } },
        { kind: "barren", r: 32, orbit: { p: 0, R: 190, w: -0.4, ph: 4.1888 } },
        { kind: "fertile", x: 560, y: 860, r: 45 }
      ]
    },
    {
      id: "w4-21", name: "Grand Complication",
      hint: "A shielded moon, a drifting ice floe and two quiet corners. Every part is moving but the corners.",
      seeds: 6, par: 3, stars: [4, 5], preview: 0.85, launch: [180, 620],
      bodies: [
        { kind: "sun", x: 800, y: 500, r: 55, dens: 3000 },
        { kind: "fertile", r: 32, orbit: { p: 0, R: 220, w: 0.4, ph: Math.PI }, shield: { gap: 1.05, w: -0.9, ph: 0 } },
        { kind: "ice", r: 40, orbit: { p: 0, R: 380, w: -0.25, ph: 0 } },
        { kind: "fertile", x: 1420, y: 800, r: 48 },
        { kind: "fertile", x: 420, y: 150, r: 40 }
      ]
    },
    {
      id: "w4-22", name: "The Great Orrery",
      hint: "The whole machine at once: rings, moons, a shielded giant and two fixed plots. Wind it up and wait for your moment.",
      seeds: 9, par: 6, stars: [7, 8], preview: 0.8, launch: [1450, 850],
      bodies: [
        { kind: "sun", x: 800, y: 500, r: 50, dens: 3200 },
        { kind: "fertile", r: 20, orbit: { p: 0, R: 110, w: 0.7, ph: 0 } },
        { kind: "barren", r: 32, orbit: { p: 0, R: 240, w: -0.45, ph: 1 } },
        { kind: "fertile", r: 18, orbit: { p: 2, R: 70, w: 1.2, ph: 0 } },
        { kind: "fertile", r: 34, need: 2, orbit: { p: 0, R: 400, w: 0.25, ph: 3 }, shield: { gap: 1.0, w: -0.8, ph: 0 } },
        { kind: "fertile", x: 1450, y: 170, r: 45 },
        { kind: "fertile", x: 180, y: 500, r: 45 }
      ],
      pollen: [[800, 950], [1250, 500], [828, 118]]
    }
  ]
});
