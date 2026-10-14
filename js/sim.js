(function (root) {
  "use strict";

  const WORLD = { w: 1600, h: 1000 };
  const SEED_R = 6, MAX_SPEED = 820, FLIGHT_MAX = 14, DT = 1 / 120;
  const PORTAL_R = 26, BOOST_R = 24, POLLEN_R = 20, SHIELD_PAD = 20;
  const DENS = { fertile: 1400, barren: 1500, sun: 3600, ice: 1100, blackhole: 40000, repulsor: -2200 };
  const TERMINAL = { plant: 1, crash: 1, burn: 1, swallow: 1, shield: 1, lost: 1 };

  function massOf(b) { return b.r * b.r * (b.dens != null ? b.dens : DENS[b.kind]); }

  function bodyPos(bodies, i, T) {
    const b = bodies[i];
    if (!b.orbit) return [b.x, b.y];
    const o = b.orbit;
    const c = o.p != null ? bodyPos(bodies, o.p, T) : [o.cx, o.cy];
    const a = o.ph + o.w * T;
    return [c[0] + Math.cos(a) * o.R, c[1] + Math.sin(a) * o.R];
  }

  function positions(bodies, T) { return bodies.map(function (_, i) { return bodyPos(bodies, i, T); }); }

  function shieldRadius(b) { return b.r + (b.shield.pad || SHIELD_PAD); }

  function wrapAngle(a) { a = (a + Math.PI) % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return a - Math.PI; }

  function shieldGapCenter(b, T) { return b.shield.ph + (b.shield.w || 0) * T; }

  function shieldOpen(b, ang, T) { return Math.abs(wrapAngle(ang - shieldGapCenter(b, T))) < b.shield.gap / 2; }

  function newSeed(lv, ang, pow) {
    const sp = pow * MAX_SPEED;
    return { x: lv.launch[0], y: lv.launch[1], vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, t: 0, cool: 0, boostCool: 0 };
  }

  function stepSeed(lv, s, T, dt, pollenGot) {
    const B = lv.bodies, P = positions(B, T);
    let ax = 0, ay = 0;
    for (let i = 0; i < B.length; i++) {
      const dx = P[i][0] - s.x, dy = P[i][1] - s.y;
      const d2 = dx * dx + dy * dy, d = Math.sqrt(d2) || 1;
      const a = massOf(B[i]) / (d2 + 400);
      ax += a * dx / d; ay += a * dy / d;
    }
    if (lv.winds) {
      for (const w of lv.winds) {
        if (s.x >= w.x && s.x <= w.x + w.w && s.y >= w.y && s.y <= w.y + w.h) { ax += w.ax; ay += w.ay; }
      }
    }
    const px = s.x, py = s.y;
    s.vx += ax * dt; s.vy += ay * dt;
    s.x += s.vx * dt; s.y += s.vy * dt;
    s.t += dt;
    if (s.cool > 0) s.cool -= dt;
    if (s.boostCool > 0) s.boostCool -= dt;

    for (let i = 0; i < B.length; i++) {
      const b = B[i];
      if (!b.shield) continue;
      const R = shieldRadius(b);
      const d0 = Math.hypot(px - P[i][0], py - P[i][1]), d1 = Math.hypot(s.x - P[i][0], s.y - P[i][1]);
      if ((d0 >= R && d1 < R) || (d0 < R && d1 >= R)) {
        const ang = Math.atan2(s.y - P[i][1], s.x - P[i][0]);
        if (!shieldOpen(b, ang, T)) return { type: "shield", i: i, x: s.x, y: s.y, ang: ang };
      }
    }

    for (let i = 0; i < B.length; i++) {
      const b = B[i], dx = s.x - P[i][0], dy = s.y - P[i][1], d = Math.hypot(dx, dy) || 1;
      if (d < b.r + SEED_R) {
        const nx = dx / d, ny = dy / d;
        if (b.kind === "ice") {
          const vn = s.vx * nx + s.vy * ny;
          if (vn < 0) { s.vx -= 1.85 * vn * nx; s.vy -= 1.85 * vn * ny; }
          s.x = P[i][0] + nx * (b.r + SEED_R + 0.5); s.y = P[i][1] + ny * (b.r + SEED_R + 0.5);
          return { type: "bounce", i: i, x: s.x, y: s.y };
        }
        const type = b.kind === "fertile" ? "plant" : b.kind === "sun" ? "burn" : b.kind === "blackhole" ? "swallow" : "crash";
        return { type: type, i: i, ang: Math.atan2(dy, dx), x: s.x, y: s.y };
      }
    }

    if (s.cool <= 0 && lv.portals) {
      for (let k = 0; k < lv.portals.length; k++) {
        const p = lv.portals[k];
        const ends = [[p.a, p.b], [p.b, p.a]];
        for (let e = 0; e < 2; e++) {
          const from = ends[e][0], to = ends[e][1];
          if (Math.hypot(s.x - from[0], s.y - from[1]) < PORTAL_R) {
            s.x = to[0]; s.y = to[1]; s.cool = 0.5;
            return { type: "warp", k: k, from: from, to: to };
          }
        }
      }
    }

    if (s.boostCool <= 0 && lv.boosts) {
      for (let k = 0; k < lv.boosts.length; k++) {
        const g = lv.boosts[k];
        if (Math.hypot(s.x - g.x, s.y - g.y) < BOOST_R) {
          const sp = Math.hypot(s.vx, s.vy) * (g.mult != null ? g.mult : 1.4);
          const dir = g.ang != null ? g.ang : Math.atan2(s.vy, s.vx);
          s.vx = Math.cos(dir) * sp; s.vy = Math.sin(dir) * sp;
          s.x = g.x; s.y = g.y; s.boostCool = 0.35;
          return { type: "boost", k: k, x: g.x, y: g.y };
        }
      }
    }

    if (lv.pollen && pollenGot) {
      for (let k = 0; k < lv.pollen.length; k++) {
        if (pollenGot[k]) continue;
        const q = lv.pollen[k];
        if (Math.hypot(s.x - q[0], s.y - q[1]) < POLLEN_R) return { type: "pollen", k: k, x: q[0], y: q[1] };
      }
    }

    if (s.x < -400 || s.x > WORLD.w + 400 || s.y < -400 || s.y > WORLD.h + 400 || s.t > FLIGHT_MAX) return { type: "lost", x: s.x, y: s.y };
    return null;
  }

  function simulateShot(lv, ang, pow, T0, maxT, pollenGot) {
    const s = newSeed(lv, ang, pow), events = [];
    let T = T0;
    const steps = Math.round((maxT || FLIGHT_MAX) / DT) + 2;
    for (let i = 0; i < steps; i++) {
      T += DT;
      const ev = stepSeed(lv, s, T, DT, pollenGot);
      if (!ev) continue;
      events.push(ev);
      if (ev.type === "pollen" && pollenGot) pollenGot[ev.k] = true;
      if (TERMINAL[ev.type]) break;
    }
    return { seed: s, events: events, end: events.length ? events[events.length - 1] : null };
  }

  const api = {
    WORLD: WORLD, SEED_R: SEED_R, MAX_SPEED: MAX_SPEED, FLIGHT_MAX: FLIGHT_MAX, DT: DT,
    PORTAL_R: PORTAL_R, BOOST_R: BOOST_R, POLLEN_R: POLLEN_R, SHIELD_PAD: SHIELD_PAD, DENS: DENS, TERMINAL: TERMINAL,
    massOf: massOf, bodyPos: bodyPos, positions: positions, shieldRadius: shieldRadius, shieldOpen: shieldOpen,
    shieldGapCenter: shieldGapCenter, wrapAngle: wrapAngle, newSeed: newSeed, stepSeed: stepSeed, simulateShot: simulateShot,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.OrchardSim = api;
})(this);
