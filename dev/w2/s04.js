module.exports = {
  band: [2, 5], force: { 4: 2 },
  level: { launch: [160, 160], bodies: [
    { kind: "ice", x: 560, y: 820, r: 95 },
    { kind: "barren", x: 900, y: 380, r: 150 },
    { kind: "ice", x: 1150, y: 860, r: 90 },
    { kind: "barren", x: 1380, y: 520, r: 110 },
    { kind: "fertile", x: 1480, y: 850, r: 60 }] },
  vary: [["bodies.0.x", 300, 800], ["bodies.0.y", 600, 880], ["bodies.1.x", 700, 1100], ["bodies.1.y", 200, 600], ["bodies.1.r", 100, 180],
    ["bodies.2.x", 900, 1300], ["bodies.2.y", 600, 880], ["bodies.3.x", 1100, 1450], ["bodies.3.y", 300, 750], ["bodies.3.r", 80, 160],
    ["bodies.4.x", 1300, 1510], ["bodies.4.y", 100, 900]]
};
