    {
      id: "w3-01", name: "First Fold", seeds: 3, par: 1, preview: 1.6, launch: [200, 560],
      hint: "Violet rings are stitched together. Fly into one and you leave the other at the same speed and heading.",
      bodies: [{ kind: "fertile", x: 1330, y: 470, r: 75 }].concat(ring(800, 499, 192, 90, 1, 0), [
        { kind: "barren", x: 800, y: 115, r: 90 }, { kind: "barren", x: 800, y: 307, r: 90 },
        { kind: "barren", x: 800, y: 691, r: 90 }, { kind: "barren", x: 800, y: 883, r: 90 }]).slice(0, 1).concat([
        { kind: "barren", x: 800, y: 115, r: 90 }, { kind: "barren", x: 800, y: 307, r: 90 }, { kind: "barren", x: 800, y: 499, r: 90 },
        { kind: "barren", x: 800, y: 691, r: 90 }, { kind: "barren", x: 800, y: 883, r: 90 }]),
      portals: [{ a: [470, 420], b: [1020, 420] }]
    },
