window.ORCHARD_WORLDS = window.ORCHARD_WORLDS || [];
window.ORCHARD_WORLDS.push({
  id: 1,
  name: "Meadow Belt",
  blurb: "A warm belt of rock and soil where every gardener learns to throw. Bend seeds around stones, borrow a sun's pull, and chase pollen through the spring haze.",
  theme: { ambience: "fireflies", flora: "daisy", bg: ["#1f2350", "#2b1f4f", "#0e1128"], nebula: "#ff9ec4", accent: "#8fc79a", glow: "#ffd9a8" },
  levels: [
    {
      id: "w1-01", name: "First Sprout",
      hint: "Drag anywhere to pull back, then let go to sow. Or aim with the arrow keys and press Space.",
      seeds: 6, par: 1, stars: [4, 5], preview: 1.8, launch: [220, 560],
      bodies: [{ kind: "fertile", x: 1150, y: 480, r: 70 }]
    },
    {
      id: "w1-02", name: "Around the Bend",
      hint: "Grey rock is barren, but its pull still bends your path.",
      seeds: 6, par: 1, stars: [4, 5], preview: 1.75, launch: [200, 500],
      bodies: [{ kind: "barren", x: 780, y: 500, r: 110 }, { kind: "fertile", x: 1330, y: 520, r: 70 }]
    },
    {
      id: "w1-03", name: "Twin Plots",
      hint: "Every ringed planet needs a seed before the plot is done.",
      seeds: 7, par: 2, stars: [5, 6], preview: 1.7, launch: [200, 500],
      bodies: [
        { kind: "fertile", x: 1050, y: 250, r: 65 }, { kind: "fertile", x: 1050, y: 760, r: 65 },
        { kind: "barren", x: 1400, y: 500, r: 60 }
      ]
    },
    {
      id: "w1-04", name: "Sunward",
      hint: "Suns scorch seeds on contact. Skim past one and its pull will swing you somewhere new.",
      seeds: 6, par: 1, stars: [4, 5], preview: 1.7, launch: [220, 820],
      bodies: [
        { kind: "sun", x: 760, y: 470, r: 80 },
        { kind: "barren", x: 1000, y: 820, r: 90 },
        { kind: "fertile", x: 1320, y: 250, r: 60 }
      ]
    },
    {
      id: "w1-05", name: "Hungry Soil",
      hint: "Some soil is hungry. The segments around the ring count how many seeds it wants.",
      seeds: 8, par: 3, stars: [6, 7], preview: 1.65, launch: [240, 380],
      bodies: [
        { kind: "fertile", x: 1120, y: 560, r: 78, need: 3 },
        { kind: "barren", x: 700, y: 700, r: 70 },
        { kind: "barren", x: 1400, y: 260, r: 55 }
      ]
    },
    {
      id: "w1-06", name: "Sun Lift",
      hint: "The rock hides your plot. Let the sun above lift your seed over the top.",
      seeds: 6, par: 1, stars: [4, 5], preview: 1.6, launch: [180, 640],
      bodies: [
        { kind: "barren", x: 760, y: 660, r: 150 },
        { kind: "sun", x: 820, y: 230, r: 60 },
        { kind: "fertile", x: 1220, y: 700, r: 45 }
      ]
    },
    {
      id: "w1-07", name: "Nestled Bud",
      hint: "A big garden shelters a tiny one. Sow the small bud without the big one catching your seed.",
      seeds: 7, par: 2, stars: [5, 6], preview: 1.55, launch: [180, 280],
      bodies: [
        { kind: "fertile", x: 860, y: 520, r: 120 },
        { kind: "fertile", x: 1200, y: 680, r: 34 },
        { kind: "barren", x: 1250, y: 300, r: 60 }
      ]
    },
    {
      id: "w1-08", name: "Pollen Drift",
      hint: "Golden pollen floats in the meadow. Brush through it on the way to your plot for a golden badge.",
      seeds: 5, par: 1, stars: [3, 4], preview: 1.5, launch: [240, 760],
      bodies: [
        { kind: "sun", x: 780, y: 560, r: 60 },
        { kind: "fertile", x: 1300, y: 380, r: 50 }
      ],
      pollen: [[760, 330], [1180, 720]]
    },
    {
      id: "w1-09", name: "Long Lob",
      hint: "Your plot sits at the far corner. A soft throw lets the rock pull you the whole way there.",
      seeds: 5, par: 1, stars: [3, 4], preview: 1.45, launch: [140, 860],
      bodies: [
        { kind: "barren", x: 820, y: 480, r: 110 },
        { kind: "barren", x: 420, y: 330, r: 60 },
        { kind: "fertile", x: 1440, y: 160, r: 48 }
      ],
      pollen: [[1100, 800]]
    },
    {
      id: "w1-10", name: "Needle Gap",
      hint: "A wall of stone with only hairline lanes. Aim true and thread one.",
      seeds: 5, par: 1, stars: [3, 4], preview: 1.45, launch: [200, 500],
      bodies: [
        { kind: "barren", x: 800, y: 150, r: 110 },
        { kind: "barren", x: 800, y: 380, r: 100 },
        { kind: "barren", x: 800, y: 625, r: 110 },
        { kind: "barren", x: 800, y: 860, r: 100 },
        { kind: "fertile", x: 1360, y: 500, r: 55 }
      ],
      pollen: [[1100, 500]]
    },
    {
      id: "w1-11", name: "Look Back",
      hint: "Your plot hides behind you, past a wall of stone. Arc over the top or under the bottom to reach it.",
      seeds: 5, par: 1, stars: [3, 4], preview: 1.4, launch: [640, 600],
      bodies: [
        { kind: "sun", x: 1150, y: 520, r: 80 },
        { kind: "barren", x: 380, y: 300, r: 110 },
        { kind: "barren", x: 380, y: 540, r: 115 },
        { kind: "barren", x: 380, y: 780, r: 110 },
        { kind: "fertile", x: 140, y: 560, r: 50 }
      ],
      pollen: [[290, 170]]
    },
    {
      id: "w1-12", name: "Daisy Chain",
      hint: "Three plots in a row. The near one is in the way, so choose your order.",
      seeds: 7, par: 3, stars: [5, 6], preview: 1.4, launch: [160, 860],
      bodies: [
        { kind: "fertile", x: 540, y: 660, r: 50 },
        { kind: "fertile", x: 900, y: 460, r: 50 },
        { kind: "fertile", x: 1260, y: 260, r: 50 }
      ],
      pollen: [[1150, 620]]
    },
    {
      id: "w1-13", name: "Sun Gate",
      hint: "Two suns stand guard. The lane between them is hotter than it looks.",
      seeds: 5, par: 1, stars: [3, 4], preview: 1.35, launch: [200, 700],
      bodies: [
        { kind: "sun", x: 800, y: 320, r: 60 },
        { kind: "sun", x: 800, y: 680, r: 60 },
        { kind: "fertile", x: 1380, y: 480, r: 40 }
      ],
      pollen: [[800, 500]]
    },
    {
      id: "w1-14", name: "Greedy Pair",
      hint: "Two hungry gardens share one sun. Feed them both twice.",
      seeds: 8, par: 4, stars: [6, 7], preview: 1.3, launch: [800, 100],
      bodies: [
        { kind: "sun", x: 800, y: 520, r: 70 },
        { kind: "fertile", x: 330, y: 700, r: 38, need: 2 },
        { kind: "fertile", x: 1270, y: 700, r: 38, need: 2 },
        { kind: "barren", x: 800, y: 850, r: 50 }
      ],
      pollen: [[560, 380], [1040, 380]]
    },
    {
      id: "w1-15", name: "Honey Ring",
      hint: "A ring of pollen hugs the top of the sun. Skim it close and swing down to the plot.",
      seeds: 5, par: 1, stars: [3, 4], preview: 1.3, launch: [180, 820],
      bodies: [
        { kind: "sun", x: 820, y: 500, r: 70 },
        { kind: "fertile", x: 1400, y: 820, r: 36 },
        { kind: "barren", x: 1150, y: 700, r: 70 }
      ],
      pollen: [[680, 395], [820, 345], [960, 395]]
    },
    {
      id: "w1-16", name: "Hedgerow",
      hint: "A row of stones with plots tucked in the lanes. Each gap wants its own throw.",
      seeds: 6, par: 3, stars: [4, 5], preview: 1.25, launch: [1420, 500],
      bodies: [
        { kind: "barren", x: 700, y: 140, r: 80 },
        { kind: "barren", x: 700, y: 400, r: 80 },
        { kind: "barren", x: 700, y: 660, r: 80 },
        { kind: "fertile", x: 350, y: 270, r: 32 },
        { kind: "fertile", x: 350, y: 530, r: 32 },
        { kind: "fertile", x: 350, y: 820, r: 32 }
      ],
      pollen: [[150, 400]]
    },
    {
      id: "w1-17", name: "High Meadow",
      hint: "You sow from the top of the sky. Let your seeds fall through the rocks below.",
      seeds: 6, par: 3, stars: [4, 5], preview: 1.2, launch: [800, 120],
      bodies: [
        { kind: "barren", x: 560, y: 450, r: 90 },
        { kind: "barren", x: 1040, y: 450, r: 90 },
        { kind: "fertile", x: 800, y: 800, r: 45, need: 2 },
        { kind: "fertile", x: 200, y: 820, r: 34 },
        { kind: "sun", x: 1350, y: 700, r: 60 }
      ],
      pollen: [[800, 450], [1450, 450]]
    },
    {
      id: "w1-18", name: "Full Circle",
      hint: "The plot below you is roofed with stone. Go all the way round the sun and come in from the side.",
      seeds: 4, par: 1, stars: [2, 3], preview: 1.15, launch: [160, 300],
      bodies: [
        { kind: "sun", x: 1050, y: 480, r: 75 },
        { kind: "barren", x: 100, y: 640, r: 80 },
        { kind: "barren", x: 275, y: 630, r: 80 },
        { kind: "barren", x: 465, y: 660, r: 75 },
        { kind: "fertile", x: 260, y: 860, r: 28 }
      ],
      pollen: [[1090, 125]]
    },
    {
      id: "w1-19", name: "Stepping Stones",
      hint: "Small stones pull a little each. Hop your seed from one to the next.",
      seeds: 5, par: 2, stars: [3, 4], preview: 1.1, launch: [140, 180],
      bodies: [
        { kind: "barren", x: 470, y: 420, r: 45 },
        { kind: "barren", x: 760, y: 280, r: 45 },
        { kind: "barren", x: 1000, y: 560, r: 45 },
        { kind: "barren", x: 1250, y: 380, r: 45 },
        { kind: "fertile", x: 1450, y: 700, r: 40 },
        { kind: "fertile", x: 700, y: 820, r: 40 }
      ],
      pollen: [[620, 350], [1095, 525]]
    },
    {
      id: "w1-20", name: "Bramble Patch",
      hint: "Rocks everywhere. Find the one clean lane to each plot.",
      seeds: 6, par: 3, stars: [4, 5], preview: 1.05, launch: [1440, 860],
      bodies: [
        { kind: "barren", x: 1100, y: 700, r: 70 },
        { kind: "barren", x: 900, y: 450, r: 90 },
        { kind: "barren", x: 1250, y: 400, r: 60 },
        { kind: "barren", x: 600, y: 700, r: 80 },
        { kind: "barren", x: 550, y: 330, r: 60 },
        { kind: "fertile", x: 250, y: 500, r: 30 },
        { kind: "fertile", x: 1100, y: 170, r: 28 },
        { kind: "fertile", x: 780, y: 880, r: 28 }
      ],
      pollen: [[695, 635]]
    },
    {
      id: "w1-21", name: "Dusk Throw",
      hint: "Dusk shortens your sightline. Read the sun and trust your arm.",
      seeds: 5, par: 2, stars: [3, 4], preview: 0.5, launch: [200, 200],
      bodies: [
        { kind: "sun", x: 760, y: 560, r: 70 },
        { kind: "barren", x: 1150, y: 300, r: 80 },
        { kind: "fertile", x: 1400, y: 560, r: 26 },
        { kind: "fertile", x: 300, y: 820, r: 24 }
      ],
      pollen: [[1000, 820]]
    },
    {
      id: "w1-22", name: "Maypole",
      hint: "The sun is the maypole and every garden dances around it. Plan the whole round before your first throw.",
      seeds: 10, par: 7, stars: [8, 9], preview: 1.0, launch: [800, 900],
      bodies: [
        { kind: "sun", x: 800, y: 470, r: 85 },
        { kind: "barren", x: 540, y: 640, r: 55 },
        { kind: "barren", x: 1060, y: 640, r: 55 },
        { kind: "barren", x: 800, y: 250, r: 50 },
        { kind: "barren", x: 330, y: 790, r: 70 },
        { kind: "barren", x: 1270, y: 790, r: 70 },
        { kind: "fertile", x: 260, y: 280, r: 30, need: 2 },
        { kind: "fertile", x: 1340, y: 280, r: 30, need: 2 },
        { kind: "fertile", x: 800, y: 90, r: 30 },
        { kind: "fertile", x: 140, y: 870, r: 24 },
        { kind: "fertile", x: 1460, y: 870, r: 24 }
      ],
      pollen: [[800, 350], [560, 470], [1040, 470]]
    }
  ]
});
