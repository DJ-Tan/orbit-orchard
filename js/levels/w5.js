window.ORCHARD_WORLDS = window.ORCHARD_WORLDS || [];
window.ORCHARD_WORLDS.push({
  id: 5, name: "Event Horizon",
  blurb: "Black holes that swallow light and repulsors that shove it away. Every trick you have learned, at the edge of no return.",
  theme: { ambience: "horizon", flora: "ember", bg: ["#1c0d12", "#2a0f16", "#060305"], nebula: "#ff7a45", accent: "#ff9e6b", glow: "#ffd0a8" },
  levels: [
    {
      id: "w5-01", name: "Dark Star", seeds: 6, par: 1, stars: [4, 5], preview: 1.3, launch: [200, 520],
      hint: "A black hole swallows anything that touches it. Aim past it and let it bend your seed home.",
      bodies: [
        { kind: "blackhole", x: 760, y: 500, r: 18 },
        { kind: "fertile", x: 1360, y: 480, r: 48 }
      ]
    },
    {
      id: "w5-02", name: "Lensing", seeds: 6, par: 1, stars: [4, 5], preview: 1.3, launch: [220, 820],
      hint: "Seeds bend around a black hole like light does. Whip one around the back to reach the plot behind the rock.",
      bodies: [
        { kind: "blackhole", x: 840, y: 420, r: 20 },
        { kind: "barren", x: 120, y: 470, r: 80 },
        { kind: "barren", x: 320, y: 470, r: 80 },
        { kind: "barren", x: 520, y: 470, r: 80 },
        { kind: "fertile", x: 300, y: 200, r: 40 }
      ]
    },
    {
      id: "w5-03", name: "Periapsis Dive", seeds: 7, par: 2, stars: [5, 6], preview: 1.3, launch: [180, 260],
      hint: "Dive close to the black hole to steal its speed. The side you pass decides where you land.",
      bodies: [
        { kind: "blackhole", x: 720, y: 600, r: 16, dens: 50000 },
        { kind: "barren", x: 1080, y: 520, r: 100 },
        { kind: "fertile", x: 1420, y: 230, r: 52 },
        { kind: "fertile", x: 1400, y: 840, r: 52 }
      ]
    },
    {
      id: "w5-04", name: "Triple Horizon", seeds: 7, par: 2, stars: [5, 6], preview: 1.2, launch: [200, 500],
      hint: "Three black holes guard the way through. Thread a gap where their pulls cancel.",
      bodies: [
        { kind: "blackhole", x: 820, y: 190, r: 15, dens: 32000 },
        { kind: "blackhole", x: 820, y: 500, r: 15, dens: 32000 },
        { kind: "blackhole", x: 820, y: 810, r: 15, dens: 32000 },
        { kind: "fertile", x: 1380, y: 330, r: 50 },
        { kind: "fertile", x: 1380, y: 700, r: 50 }
      ],
      pollen: [[820, 345]]
    },
    {
      id: "w5-05", name: "Photon Ring", seeds: 7, par: 2, stars: [5, 6], preview: 1.2, launch: [180, 780],
      hint: "A soil moon circles the black hole. Catch it as it swings toward you, not while it hides behind.",
      bodies: [
        { kind: "blackhole", x: 980, y: 480, r: 18 },
        { kind: "fertile", r: 32, orbit: { p: 0, R: 210, w: 0.6, ph: 0 } },
        { kind: "fertile", x: 1450, y: 160, r: 44 }
      ]
    },
    {
      id: "w5-06", name: "Negative Mass", seeds: 6, par: 1, stars: [4, 5], preview: 1.2, launch: [200, 800],
      hint: "Repulsors push seeds away, and touching one is a crash. Skim past it and let the push fold you down behind the rock.",
      bodies: [
        { kind: "repulsor", x: 1000, y: 250, r: 40 },
        { kind: "barren", x: 760, y: 760, r: 190 },
        { kind: "fertile", x: 1380, y: 700, r: 60 }
      ],
      pollen: [[1060, 330]]
    },
    {
      id: "w5-07", name: "Ember Fence", seeds: 7, par: 2, stars: [5, 6], preview: 1.2, launch: [180, 860],
      hint: "Repulsors fence off the high road. Swing low around the rock and curl up the far side.",
      bodies: [
        { kind: "repulsor", x: 560, y: 560, r: 34 },
        { kind: "repulsor", x: 820, y: 420, r: 34 },
        { kind: "repulsor", x: 1080, y: 300, r: 34 },
        { kind: "barren", x: 1250, y: 660, r: 110 },
        { kind: "fertile", x: 1420, y: 140, r: 46 },
        { kind: "fertile", x: 700, y: 170, r: 44 }
      ]
    },
    {
      id: "w5-08", name: "Dipole", seeds: 6, par: 2, stars: [4, 5], preview: 1.1, launch: [200, 780],
      hint: "A black hole pulls and a repulsor pushes. Ride the line between them.",
      bodies: [
        { kind: "blackhole", x: 700, y: 380, r: 18 },
        { kind: "repulsor", x: 1000, y: 580, r: 45 },
        { kind: "fertile", x: 1380, y: 820, r: 50 },
        { kind: "fertile", x: 1150, y: 140, r: 44 }
      ]
    },
    {
      id: "w5-09", name: "Jet Nozzle", seeds: 6, par: 2, stars: [4, 5], preview: 1.1, launch: [200, 500],
      hint: "Repulsors squeeze your seed into a narrow jet. The last one plugs the middle, so bend around it.",
      bodies: [
        { kind: "repulsor", x: 650, y: 200, r: 30 },
        { kind: "repulsor", x: 900, y: 310, r: 28 },
        { kind: "repulsor", x: 650, y: 800, r: 30 },
        { kind: "repulsor", x: 900, y: 690, r: 28 },
        { kind: "repulsor", x: 1150, y: 500, r: 13 },
        { kind: "fertile", x: 1420, y: 500, r: 52, need: 2 }
      ],
      pollen: [[1150, 250]]
    },
    {
      id: "w5-10", name: "Cold Horizon", seeds: 6, par: 2, stars: [4, 5], preview: 1.0, launch: [1420, 850],
      hint: "The shielded plot only opens from below. Bank off the ice, and mind the black hole on the way.",
      bodies: [
        { kind: "blackhole", x: 820, y: 480, r: 20 },
        { kind: "ice", x: 380, y: 760, r: 80 },
        { kind: "fertile", x: 250, y: 300, r: 48, shield: { gap: 1.6, w: 0, ph: 1.5708 } },
        { kind: "barren", x: 1330, y: 540, r: 110 },
        { kind: "fertile", x: 1380, y: 190, r: 38 }
      ],
      pollen: [[460, 455]]
    },
    {
      id: "w5-11", name: "Rosen Bridge", seeds: 6, par: 2, stars: [4, 5], preview: 1.0, launch: [200, 250],
      hint: "A wall of rock seals off the far plots. Let the black hole drag you into the fold.",
      bodies: [
        { kind: "blackhole", x: 700, y: 600, r: 20 },
        { kind: "barren", x: 1050, y: 170, r: 140 },
        { kind: "barren", x: 1050, y: 500, r: 140 },
        { kind: "barren", x: 1050, y: 830, r: 140 },
        { kind: "fertile", x: 1420, y: 330, r: 42 },
        { kind: "fertile", x: 1420, y: 780, r: 48 }
      ],
      portals: [{ a: [460, 840], b: [1290, 560] }]
    },
    {
      id: "w5-12", name: "Dark Adapt", seeds: 7, par: 3, stars: [5, 6], preview: 0.35, launch: [800, 900],
      hint: "Your sightline barely leaves the launcher. Feel for the pull of the black hole and the push of the repulsors.",
      bodies: [
        { kind: "blackhole", x: 800, y: 460, r: 18 },
        { kind: "repulsor", x: 430, y: 560, r: 36 },
        { kind: "repulsor", x: 1170, y: 560, r: 36 },
        { kind: "fertile", x: 250, y: 220, r: 42 },
        { kind: "fertile", x: 1350, y: 220, r: 42 },
        { kind: "fertile", x: 800, y: 130, r: 40 }
      ]
    },
    {
      id: "w5-13", name: "Coronal Wind", seeds: 6, par: 2, stars: [4, 5], preview: 1.0, launch: [180, 500],
      hint: "A hot wind blows everything down past the sun. Fight it for the high plot, ride it for the low one.",
      bodies: [
        { kind: "sun", x: 800, y: 500, r: 55 },
        { kind: "repulsor", x: 1255, y: 725, r: 33 },
        { kind: "fertile", x: 1430, y: 880, r: 40 },
        { kind: "fertile", x: 1300, y: 180, r: 53 }
      ],
      winds: [{ x: 500, y: 0, w: 600, h: 1000, ax: 0, ay: 90 }],
      pollen: [[800, 250], [1100, 600]]
    },
    {
      id: "w5-14", name: "Redshift", seeds: 6, par: 2, stars: [4, 5], preview: 0.9, launch: [200, 500],
      hint: "The boost gate fires you due east past the black hole. How fast you enter decides how hard it bends you.",
      bodies: [
        { kind: "blackhole", x: 850, y: 620, r: 20 },
        { kind: "barren", x: 330, y: 250, r: 120 },
        { kind: "barren", x: 330, y: 750, r: 120 },
        { kind: "fertile", x: 1420, y: 780, r: 36 },
        { kind: "fertile", x: 620, y: 860, r: 42 }
      ],
      boosts: [{ x: 330, y: 500, mult: 1.3, ang: 0 }]
    },
    {
      id: "w5-15", name: "Binary Abyss", seeds: 7, par: 3, stars: [5, 6], preview: 1.0, launch: [200, 820],
      hint: "Two black holes waltz at the centre, and every plot turns its back on them. Loop around behind to find the open side.",
      bodies: [
        { kind: "blackhole", r: 16, dens: 35000, orbit: { cx: 800, cy: 500, R: 130, w: 0.7, ph: 0 } },
        { kind: "blackhole", r: 16, dens: 35000, orbit: { cx: 800, cy: 500, R: 130, w: 0.7, ph: 3.1416 } },
        { kind: "fertile", x: 1280, y: 260, r: 54, dens: 6000, shield: { gap: 4.5, w: 0, ph: -0.6 } },
        { kind: "fertile", x: 1380, y: 780, r: 50, dens: 6000, shield: { gap: 4.2, w: 0, ph: 0.4636 } },
        { kind: "fertile", x: 300, y: 180, r: 46, shield: { gap: 3.6, w: 0, ph: -2.5724 } }
      ]
    },
    {
      id: "w5-16", name: "Firewall", seeds: 5, par: 2, stars: [3, 4], preview: 0.9, launch: [180, 300],
      hint: "A spinning shield guards the plot beyond the black hole. Time the lensing so you arrive at the gap.",
      bodies: [
        { kind: "blackhole", x: 850, y: 500, r: 20 },
        { kind: "fertile", x: 1350, y: 500, r: 55, shield: { gap: 1.3, w: 0.8, ph: 0 } },
        { kind: "sun", x: 1350, y: 170, r: 45 },
        { kind: "fertile", x: 1350, y: 850, r: 40, shield: { gap: 1.5, w: 0, ph: 3.1416 } }
      ]
    },
    {
      id: "w5-17", name: "Quasar", seeds: 6, par: 3, stars: [4, 5], preview: 0.9, launch: [200, 300],
      hint: "Jets of wind blast out of the black hole's poles. One plot sits at the tip of a jet, one hides its shield's gap on the far side.",
      bodies: [
        { kind: "blackhole", x: 800, y: 500, r: 20, dens: 45000 },
        { kind: "fertile", x: 800, y: 120, r: 36 },
        { kind: "fertile", x: 1420, y: 500, r: 51, shield: { gap: 2.9, w: 0, ph: -0.45 } },
        { kind: "repulsor", x: 1100, y: 780, r: 32 },
        { kind: "ice", x: 1205, y: 220, r: 50 },
        { kind: "fertile", x: 380, y: 820, r: 40 }
      ],
      winds: [{ x: 770, y: 40, w: 60, h: 400, ax: 0, ay: -400 }, { x: 770, y: 560, w: 60, h: 400, ax: 0, ay: 360 }]
    },
    {
      id: "w5-18", name: "Frame Dragging", seeds: 5, par: 2, stars: [3, 4], preview: 0.9, launch: [180, 180],
      hint: "The black hole drifts in a circle and drags a soil moon with it. The far plot hides between two repulsors.",
      bodies: [
        { kind: "blackhole", r: 20, orbit: { cx: 800, cy: 500, R: 150, w: 0.5, ph: 0 } },
        { kind: "fertile", r: 22, orbit: { p: 0, R: 110, w: -1.2, ph: 0 } },
        { kind: "repulsor", x: 1250, y: 700, r: 31 },
        { kind: "fertile", x: 1300, y: 780, r: 34 },
        { kind: "repulsor", x: 1450, y: 640, r: 28 }
      ]
    },
    {
      id: "w5-19", name: "Kerr Maze", seeds: 5, par: 2, stars: [3, 4], preview: 0.8, launch: [1450, 150],
      hint: "Repulsors and ice make a pinball maze. The fold is a shortcut if you can reach it.",
      bodies: [
        { kind: "repulsor", x: 1100, y: 400, r: 32 },
        { kind: "repulsor", x: 800, y: 250, r: 32 },
        { kind: "repulsor", x: 500, y: 400, r: 32 },
        { kind: "ice", x: 800, y: 700, r: 70 },
        { kind: "fertile", x: 220, y: 800, r: 42 },
        { kind: "fertile", x: 800, y: 470, r: 20 }
      ],
      portals: [{ a: [1250, 850], b: [260, 470] }]
    },
    {
      id: "w5-20", name: "Roche Limit", seeds: 5, par: 2, stars: [3, 4], preview: 0.8, launch: [1450, 850],
      hint: "This moon keeps its shield's gap turned toward the black hole. Slip inside its orbit and whip around the hole to enter.",
      bodies: [
        { kind: "blackhole", x: 850, y: 480, r: 18 },
        { kind: "fertile", r: 24, orbit: { p: 0, R: 200, w: 0.4, ph: 0 }, shield: { gap: 0.8, w: 0.4, ph: 3.1416 } },
        { kind: "repulsor", x: 420, y: 650, r: 30 },
        { kind: "fertile", x: 220, y: 480, r: 32 }
      ],
      pollen: [[795, 390], [600, 480]]
    },
    {
      id: "w5-21", name: "Last Light", seeds: 6, par: 3, stars: [4, 5], preview: 0.35, launch: [800, 130],
      hint: "Almost no sightline, two black holes above and a repulsor over every plot. Remember every lesson.",
      bodies: [
        { kind: "blackhole", x: 500, y: 500, r: 18 },
        { kind: "blackhole", x: 1100, y: 500, r: 18 },
        { kind: "repulsor", x: 800, y: 520, r: 36 },
        { kind: "fertile", x: 200, y: 850, r: 20 },
        { kind: "fertile", x: 1400, y: 850, r: 20 },
        { kind: "fertile", x: 800, y: 870, r: 24 },
        { kind: "repulsor", x: 280, y: 700, r: 40 },
        { kind: "repulsor", x: 1320, y: 700, r: 40 },
        { kind: "repulsor", x: 800, y: 720, r: 30 }
      ],
      boosts: [{ x: 800, y: 300, mult: 0.7 }]
    },
    {
      id: "w5-22", name: "Accretion Crown", seeds: 8, par: 5, stars: [6, 7], preview: 0.7, launch: [160, 300],
      hint: "A crown of soil moons circles the last black hole inside a ring of spinning ice. The final plot waits behind a pair of repulsors.",
      bodies: [
        { kind: "blackhole", x: 760, y: 520, r: 24 },
        { kind: "fertile", r: 20, orbit: { p: 0, R: 190, w: 0.5, ph: 0 } },
        { kind: "fertile", r: 21, orbit: { p: 0, R: 190, w: 0.5, ph: 1.5708 } },
        { kind: "fertile", r: 20, orbit: { p: 0, R: 190, w: 0.5, ph: 3.1416 } },
        { kind: "fertile", r: 20, orbit: { p: 0, R: 190, w: 0.5, ph: 4.7124 } },
        { kind: "barren", r: 16, orbit: { p: 0, R: 105, w: -1.0, ph: 0.7854 } },
        { kind: "barren", r: 16, orbit: { p: 0, R: 105, w: -1.0, ph: 3.927 } },
        { kind: "ice", r: 22, orbit: { p: 0, R: 320, w: -0.25, ph: 0 } },
        { kind: "ice", r: 22, orbit: { p: 0, R: 320, w: -0.25, ph: 2.0944 } },
        { kind: "ice", r: 22, orbit: { p: 0, R: 320, w: -0.25, ph: 4.1888 } },
        { kind: "repulsor", x: 1330, y: 350, r: 30 },
        { kind: "repulsor", x: 1330, y: 670, r: 30 },
        { kind: "fertile", x: 1490, y: 520, r: 36, shield: { gap: 1.35, w: 0, ph: 3.1416 } }
      ],
      portals: [{ a: [380, 160], b: [1180, 520] }],
      pollen: [[760, 110], [1200, 860]]
    }
  ]
});
