module.exports = {
  band: [1.6, 3], force: { 0: 1 },
  level: { launch: [200, 500], bodies: [
    { kind: "fertile", x: 1000, y: 500, r: 70, shield: { gap: 1.4, w: 0, ph: 0 } },
    { kind: "ice", x: 1420, y: 500, r: 90 }] },
  vary: [["bodies.0.x", 800, 1150], ["bodies.0.y", 350, 650], ["bodies.0.r", 55, 90], ["bodies.0.shield.gap", 1.2, 2.2, "f"],
    ["bodies.1.x", 1250, 1480], ["bodies.1.y", 300, 700], ["bodies.1.r", 70, 110]]
};
