window.ORCHARD_WORLDS = window.ORCHARD_WORLDS || [];
window.ORCHARD_WORLDS.push({
  id: 2, name: "Frost Reach",
  blurb: "A cold arm of the belt where ice turns seeds aside and frozen walls guard the soil. Bank your throws and find the one open door.",
  theme: { ambience: "aurora", flora: "fern", bg: ["#0f2e40", "#0f2440", "#06121d"], nebula: "#7ef0d8", accent: "#bfe6f0", glow: "#d8fff6" },
  levels: [
    {
      id: "w2-01", name: "First Frost",
      hint: "Pale ice never takes a seed. It skips them off like a stone on a pond.",
      seeds: 3, par: 1, preview: 1.6, launch: [200, 560],
      bodies: [
        { kind: "barren", x: 800, y: 420, r: 130 },
        { kind: "ice", x: 820, y: 820, r: 95 },
        { kind: "fertile", x: 1320, y: 480, r: 75 }
      ]
    },
    {
      id: "w2-02", name: "Glancing Blow",
      hint: "The rock wall blocks the straight path. Skim the ice below and let it carry you over.",
      seeds: 3, par: 1, preview: 1.6, launch: [180, 300],
      bodies: [
        { kind: "barren", x: 720, y: 130, r: 110 },
        { kind: "barren", x: 720, y: 370, r: 115 },
        { kind: "ice", x: 640, y: 820, r: 100 },
        { kind: "fertile", x: 1300, y: 300, r: 75 }
      ],
      pollen: [[1000, 700]]
    },
    {
      id: "w2-03", name: "Cold Shoulder",
      hint: "One plot sits in the open. The other hides behind the boulder, and the ice up top drops you right onto it.",
      seeds: 4, par: 2, preview: 1.5, launch: [200, 800],
      bodies: [
        { kind: "fertile", x: 820, y: 260, r: 60 },
        { kind: "barren", x: 1060, y: 780, r: 180 },
        { kind: "ice", x: 1400, y: 230, r: 95 },
        { kind: "fertile", x: 1450, y: 850, r: 60 }
      ]
    },
    {
      id: "w2-04", name: "Double Skip",
      hint: "Two ice moons, one shot. Skip off both to reach the soil tucked under the ridge.",
      seeds: 3, par: 1, preview: 1.5, launch: [160, 160],
      bodies: [
        { kind: "ice", x: 560, y: 820, r: 95 },
        { kind: "barren", x: 900, y: 380, r: 135 },
        { kind: "ice", x: 1235, y: 860, r: 90 },
        { kind: "barren", x: 1310, y: 460, r: 110 },
        { kind: "fertile", x: 1480, y: 855, r: 60 }
      ]
    },
    {
      id: "w2-05", name: "Sun Dog",
      hint: "A sun hangs beside the ice. Its pull bends every bounce, so aim a little wide.",
      seeds: 4, par: 2, preview: 1.4, launch: [200, 850],
      bodies: [
        { kind: "sun", x: 820, y: 520, r: 70 },
        { kind: "ice", x: 1220, y: 840, r: 90 },
        { kind: "fertile", x: 1380, y: 260, r: 60 },
        { kind: "fertile", x: 560, y: 190, r: 50 }
      ]
    },
    {
      id: "w2-06", name: "Frozen Gate",
      hint: "A wall of rime rings this plot. Seeds only get through the open gate.",
      seeds: 3, par: 1, preview: 1.4, launch: [200, 500],
      bodies: [
        { kind: "barren", x: 700, y: 250, r: 90 },
        { kind: "fertile", x: 1150, y: 520, r: 75, shield: { gap: 1.5, w: 0, ph: 3.14 } }
      ]
    },
    {
      id: "w2-07", name: "Back Door",
      hint: "The gate faces the far wall. Carom off the ice behind the plot and come in from the back.",
      seeds: 3, par: 1, preview: 1.4, launch: [200, 500],
      bodies: [
        { kind: "fertile", x: 1000, y: 460, r: 90, shield: { gap: 1.55, w: 0, ph: 0 } },
        { kind: "ice", x: 1395, y: 450, r: 95 }
      ]
    },
    {
      id: "w2-08", name: "Ice Key",
      hint: "This gate opens downward, straight at the ice. Skip up through it, and grab the pollen on the way.",
      seeds: 4, par: 2, preview: 1.3, launch: [180, 200],
      bodies: [
        { kind: "fertile", x: 900, y: 300, r: 75, shield: { gap: 1.6, w: 0, ph: 1.57 } },
        { kind: "ice", x: 900, y: 820, r: 100 },
        { kind: "fertile", x: 1400, y: 680, r: 55 }
      ],
      pollen: [[900, 560]]
    },
    {
      id: "w2-09", name: "Whiteout",
      hint: "The blizzard hides your sightline. Remember how the ice turned your last seed.",
      seeds: 4, par: 2, preview: 0.4, launch: [200, 700],
      bodies: [
        { kind: "barren", x: 760, y: 600, r: 150 },
        { kind: "ice", x: 1100, y: 200, r: 90 },
        { kind: "fertile", x: 1360, y: 720, r: 65 },
        { kind: "fertile", x: 580, y: 200, r: 50 }
      ]
    },
    {
      id: "w2-10", name: "Deep Drift",
      hint: "Hungry soil behind a gate that faces the sky. Every seed has to drop in from the ice above.",
      seeds: 4, par: 2, preview: 1.2, launch: [1400, 850],
      bodies: [
        { kind: "fertile", x: 600, y: 480, r: 90, need: 2, shield: { gap: 1.6, w: 0, ph: -1.57 } },
        { kind: "ice", x: 620, y: 110, r: 80 },
        { kind: "sun", x: 1050, y: 330, r: 55 }
      ]
    },
    {
      id: "w2-11", name: "Ice Pinball",
      hint: "Five ice moons stand in the lane. Ricochet through and collect the pollen between them.",
      seeds: 3, par: 1, preview: 1.2, launch: [150, 500],
      bodies: [
        { kind: "ice", x: 500, y: 300, r: 60 },
        { kind: "ice", x: 500, y: 700, r: 60 },
        { kind: "ice", x: 820, y: 500, r: 70 },
        { kind: "ice", x: 1120, y: 290, r: 60 },
        { kind: "ice", x: 1120, y: 710, r: 60 },
        { kind: "fertile", x: 1430, y: 500, r: 60, shield: { gap: 1.6, w: 0, ph: 3.14 } }
      ],
      pollen: [[660, 500], [960, 150], [960, 850]]
    },
    {
      id: "w2-12", name: "Thaw Line",
      hint: "Bank off the far ice and let the sun drag you down into the gate.",
      seeds: 3, par: 1, preview: 1.2, launch: [200, 200],
      bodies: [
        { kind: "sun", x: 820, y: 560, r: 80 },
        { kind: "ice", x: 1330, y: 220, r: 90 },
        { kind: "fertile", x: 620, y: 840, r: 70, shield: { gap: 1.4, w: 0, ph: -0.8 } }
      ]
    },
    {
      id: "w2-13", name: "Glacier Wall",
      hint: "Rock seals the corner plot on two sides. The only way in is to drop off the high ice.",
      seeds: 3, par: 1, preview: 1.1, launch: [200, 300],
      bodies: [
        { kind: "barren", x: 1180, y: 820, r: 155 },
        { kind: "barren", x: 1440, y: 480, r: 110 },
        { kind: "fertile", x: 1460, y: 860, r: 65 },
        { kind: "ice", x: 1200, y: 150, r: 90 }
      ]
    },
    {
      id: "w2-14", name: "Polar Night",
      hint: "Both gates face the ice between them. Drop onto it and let it throw you sideways.",
      seeds: 3, par: 2, preview: 1.1, launch: [800, 120],
      bodies: [
        { kind: "fertile", x: 300, y: 780, r: 65, shield: { gap: 1.5, w: 0, ph: 0.5 } },
        { kind: "fertile", x: 1300, y: 780, r: 65, shield: { gap: 1.5, w: 0, ph: 2.64 } },
        { kind: "ice", x: 800, y: 860, r: 90 },
        { kind: "barren", x: 800, y: 480, r: 70 }
      ]
    },
    {
      id: "w2-15", name: "Crevasse",
      hint: "Thread the crack between the glaciers, then kick off the ice to find the hidden gates.",
      seeds: 3, par: 2, preview: 1.1, launch: [150, 500],
      bodies: [
        { kind: "barren", x: 650, y: 250, r: 180 },
        { kind: "barren", x: 650, y: 750, r: 180 },
        { kind: "ice", x: 1420, y: 500, r: 90 },
        { kind: "fertile", x: 1150, y: 830, r: 60, shield: { gap: 1.4, w: 0, ph: -0.5 } },
        { kind: "fertile", x: 1150, y: 170, r: 60, shield: { gap: 1.4, w: 0, ph: 0.5 } }
      ]
    },
    {
      id: "w2-16", name: "Hailstorm",
      hint: "Hail everywhere. Every stray seed ricochets somewhere new, so read the whole field.",
      seeds: 4, par: 3, preview: 1.0, launch: [1450, 150],
      bodies: [
        { kind: "ice", x: 1150, y: 300, r: 45 },
        { kind: "ice", x: 900, y: 520, r: 45 },
        { kind: "ice", x: 1250, y: 650, r: 45 },
        { kind: "ice", x: 600, y: 300, r: 45 },
        { kind: "ice", x: 550, y: 750, r: 45 },
        { kind: "ice", x: 950, y: 850, r: 45 },
        { kind: "fertile", x: 250, y: 500, r: 60 },
        { kind: "fertile", x: 1400, y: 860, r: 55 },
        { kind: "fertile", x: 750, y: 120, r: 50 }
      ],
      pollen: [[1050, 700], [400, 550]]
    },
    {
      id: "w2-17", name: "Twin Gates",
      hint: "Two gates stare at each other across the ice. Split your seeds left and right off the same moon.",
      seeds: 3, par: 2, preview: 1.0, launch: [800, 900],
      bodies: [
        { kind: "fertile", x: 330, y: 380, r: 65, shield: { gap: 1.4, w: 0, ph: -0.4 } },
        { kind: "fertile", x: 1270, y: 380, r: 65, shield: { gap: 1.4, w: 0, ph: 3.54 } },
        { kind: "ice", x: 800, y: 300, r: 95 }
      ]
    },
    {
      id: "w2-18", name: "Permafrost",
      hint: "Deep soil, three seeds hungry, one narrow gate that faces the ice. Find the bank and repeat it.",
      seeds: 4, par: 3, preview: 1.0, launch: [200, 800],
      bodies: [
        { kind: "fertile", x: 1050, y: 400, r: 100, need: 3, shield: { gap: 1.1, w: 0, ph: 0.3 } },
        { kind: "ice", x: 1460, y: 620, r: 90 },
        { kind: "barren", x: 650, y: 320, r: 85 }
      ]
    },
    {
      id: "w2-19", name: "Rime Loop",
      hint: "No ice to help here. Swing around the sun and come back through the gate.",
      seeds: 3, par: 2, preview: 1.0, launch: [150, 850],
      bodies: [
        { kind: "fertile", x: 700, y: 500, r: 70, shield: { gap: 1.5, w: 0, ph: 0 } },
        { kind: "sun", x: 1150, y: 500, r: 70 },
        { kind: "fertile", x: 1420, y: 150, r: 55 }
      ]
    },
    {
      id: "w2-20", name: "Snow Blind",
      hint: "Short sight and turned backs. Both gates face ice, so trust the bounce.",
      seeds: 3, par: 2, preview: 0.5, launch: [150, 150],
      bodies: [
        { kind: "fertile", x: 700, y: 700, r: 65, shield: { gap: 1.4, w: 0, ph: 0.8 } },
        { kind: "ice", x: 1000, y: 890, r: 80 },
        { kind: "fertile", x: 1300, y: 420, r: 60, shield: { gap: 1.4, w: 0, ph: -1.2 } },
        { kind: "ice", x: 1400, y: 110, r: 80 }
      ]
    },
    {
      id: "w2-21", name: "Triple Carom",
      hint: "Three ice moons and a gate that faces the last of them. Chain the skips.",
      seeds: 2, par: 1, preview: 0.9, launch: [150, 850],
      bodies: [
        { kind: "ice", x: 600, y: 150, r: 80 },
        { kind: "ice", x: 1100, y: 850, r: 80 },
        { kind: "ice", x: 1450, y: 200, r: 80 },
        { kind: "fertile", x: 1050, y: 420, r: 70, shield: { gap: 1.3, w: 0, ph: -0.6 } }
      ]
    },
    {
      id: "w2-22", name: "Aurora Crown",
      hint: "The crown plot opens only to the sky. Clear the side gardens first, then earn the top.",
      seeds: 5, par: 4, preview: 0.9, launch: [800, 900],
      bodies: [
        { kind: "fertile", x: 800, y: 380, r: 85, need: 2, shield: { gap: 1.3, w: 0, ph: -1.57 } },
        { kind: "ice", x: 800, y: 90, r: 60 },
        { kind: "sun", x: 450, y: 480, r: 55 },
        { kind: "sun", x: 1150, y: 480, r: 55 },
        { kind: "fertile", x: 180, y: 250, r: 50, shield: { gap: 1.4, w: 0, ph: 1.57 } },
        { kind: "fertile", x: 1420, y: 250, r: 50, shield: { gap: 1.4, w: 0, ph: 1.57 } },
        { kind: "ice", x: 300, y: 760, r: 70 },
        { kind: "ice", x: 1300, y: 760, r: 70 }
      ],
      pollen: [[800, 200], [180, 520], [1420, 520]]
    }
  ]
});
