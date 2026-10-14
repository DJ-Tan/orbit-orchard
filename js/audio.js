(function () {
  "use strict";

  const XF = 1.8, LOOK = 0.12, TICK = 25;
  const CAP = { sfx: 24, music: 28 };
  const GAP = { aim: 0.03, hover: 0.04, tick: 0.02, near: 1.2, bloom: 1, oracle: 1, ffon: 0.5, ffoff: 0.5 };
  const vol = { master: 0.8, music: 0.55, sfx: 0.8 };
  const active = { sfx: 0, music: 0 };
  const lastHit = {};
  const beatFns = [];
  let ctx = null, N = null, SX = null, noiseBuf = null, crackBuf = null;
  let muted = false, want = null, cur = null, sessions = [], timer = null, hidSusp = false, scaleKey = "menu";
  let LD = null, hooked = false, pubNear = false;
  const mood = { tenT: 0, tempo: 1, tempoT: 1, thin: 1, rm: false, vAt: 0 };
  const G = { sown: 0, need: 0, flying: false, demo: false, fast: false };
  const PR = { id: 0, px: 0, py: 0, has: false, arm: -1, th: 0, fired: false, rose: false, lc: Infinity, rise: null };
  const TERM = { plant: 1, crash: 1, burn: 1, swallow: 1, shield: 1, lost: 1 };
  const trace = [];
  const mqRM = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const ri = (a, b) => Math.floor(rnd(a, b + 1));
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const num = (v, d) => (typeof v === "number" && isFinite(v) ? v : d);
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const hz = (f) => (f > 0 ? clamp(f, 20, 18000) : 440);
  const gv = (v) => (v > 0 ? Math.min(1, v) : 0);
  const pj = () => Math.pow(2, rnd(-12, 12) / 1200);
  const ramp = (p, v, t) => p.exponentialRampToValueAtTime(Math.max(1e-4, v), t);
  const now = () => ctx.currentTime + 0.005;

  // Attack/decay envelope on a gain param.
  function envAD(p, t, a, v, d) {
    a = Math.max(0.001, a);
    p.setValueAtTime(0, t);
    p.linearRampToValueAtTime(Math.max(1e-4, gv(v)), t + a);
    ramp(p, 1e-4, t + a + d);
    p.linearRampToValueAtTime(0, t + a + d + 0.02);
  }

  function ok(D) {
    return !!ctx && ctx.state === "running" && !muted && active[D.kind] < CAP[D.kind] && vol.master > 0 && vol[D.kind] > 0;
  }

  // Voice output: sum node with optional pan, reverb send and fx send.
  function mkOut(D, send, pan) {
    const sum = ctx.createGain(), o = { sum, nodes: [sum], last: null, end: 0 };
    let tail = sum;
    if (pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = clamp(pan, -1, 1);
      sum.connect(p); tail = p; o.nodes.push(p);
    }
    tail.connect(D.dry);
    if (send > 0 && D.wet) {
      const s = ctx.createGain();
      s.gain.value = gv(send);
      tail.connect(s); s.connect(D.wet); o.nodes.push(s);
    }
    if (D.fx && D.fxAmt > 0) {
      const s = ctx.createGain();
      s.gain.value = gv(D.fxAmt);
      tail.connect(s); s.connect(D.fx); o.nodes.push(s);
    }
    return o;
  }

  function mark(o, s, end) {
    if (end > o.end) { o.end = end; o.last = s; }
  }

  // Counts the voice and disconnects its nodes when the longest source ends.
  function finish(D, o) {
    const drop = () => { for (const n of o.nodes) { try { n.disconnect(); } catch (e) { continue; } } };
    if (!o.last) { drop(); return; }
    active[D.kind]++;
    o.last.onended = () => { active[D.kind]--; drop(); };
  }

  function pl(D, send, pan, fn) {
    if (!ok(D)) return;
    const o = mkOut(D, send, pan);
    try { fn(o); } finally { finish(D, o); }
  }

  function part(o, q) {
    const x = ctx.createOscillator(), g = ctx.createGain();
    const t = q.t, a = Math.max(0.001, q.a || 0.005), d = q.d || 0.2, end = t + a + d + 0.05;
    x.type = q.type || "sine";
    x.frequency.setValueAtTime(hz(q.f), t);
    if (q.f2) ramp(x.frequency, hz(q.f2), t + (q.slide || a + d));
    if (q.det) x.detune.setValueAtTime(q.det, t);
    envAD(g.gain, t, a, q.v, d);
    x.connect(g); g.connect(q.to || o.sum);
    o.nodes.push(x, g);
    x.start(t); x.stop(end); mark(o, x, end);
    return x;
  }

  function nz(o, q) {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    const t = q.t, a = Math.max(0.001, q.a || 0.005), d = q.d || 0.2, end = t + a + d + 0.05;
    s.buffer = q.buf || noiseBuf; s.loop = true;
    f.type = q.ft || "bandpass"; f.Q.value = q.q || 1;
    f.frequency.setValueAtTime(hz(q.f), t);
    if (q.f2) ramp(f.frequency, hz(q.f2), t + (q.slide || a + d));
    envAD(g.gain, t, a, q.v, d);
    s.connect(f); f.connect(g); g.connect(q.to || o.sum);
    o.nodes.push(s, f, g);
    s.start(t, Math.random() * s.buffer.duration * 0.5); s.stop(end); mark(o, s, end);
  }

  function flt(o, q) {
    const f = ctx.createBiquadFilter();
    f.type = q.ft || "lowpass"; f.Q.value = q.q || 0.7;
    f.frequency.setValueAtTime(hz(q.f), q.t);
    if (q.f2) ramp(f.frequency, hz(q.f2), q.t + q.dur);
    f.connect(o.sum); o.nodes.push(f);
    return f;
  }

  // Two-operator FM tone.
  function fm(o, q) {
    const f = hz(q.f), t = q.t, d = q.d || 0.6, end = t + d + 0.06;
    const c = ctx.createOscillator(), m = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
    const idx = f * (q.i == null ? 1 : q.i);
    c.frequency.setValueAtTime(f, t);
    m.frequency.setValueAtTime(hz(f * (q.r || 2)), t);
    mg.gain.setValueAtTime(idx, t);
    ramp(mg.gain, idx * 0.03, t + (q.md || 0.1));
    envAD(g.gain, t, q.a || 0.004, q.v, d);
    m.connect(mg); mg.connect(c.frequency); c.connect(g); g.connect(q.to || o.sum);
    o.nodes.push(c, m, mg, g);
    c.start(t); m.start(t); c.stop(end); m.stop(end); mark(o, c, end);
  }

  const BELL = [[1, 1, 1], [1.004, 0.35, 0.8], [2.76, 0.4, 0.5], [5.4, 0.2, 0.28], [8.93, 0.09, 0.16]];
  function bellP(o, t, f, v, dec) {
    for (const p of BELL) if (f * p[0] < 16000) part(o, { t, f: f * p[0], a: 0.002, v: v * p[1], d: dec * p[2] });
  }

  function pad(D, t, ms, dur, v, p) {
    if (!(v > 0.001) || !ok(D)) return;
    p = p || {};
    const o = mkOut(D, p.send == null ? 0.5 : p.send, p.pan || 0);
    const atk = p.atk || 0.6, rel = p.rel || 1.2, hold = Math.max(atk, dur), end = t + hold + rel + 0.05;
    const cut = p.cut || 1200, det = p.det == null ? 8 : p.det;
    const f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = "lowpass"; f.Q.value = p.q || 0.7;
    f.frequency.setValueAtTime(hz(cut * 0.55), t);
    f.frequency.linearRampToValueAtTime(hz(cut), t + atk);
    f.frequency.linearRampToValueAtTime(hz(cut * 0.6), t + hold + rel);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gv(v), t + atk);
    g.gain.setValueAtTime(gv(v), t + hold);
    g.gain.linearRampToValueAtTime(0, t + hold + rel);
    f.connect(g); g.connect(o.sum); o.nodes.push(f, g);
    const per = 1 / (ms.length * 2);
    for (const m of ms) for (const s of [-1, 1]) {
      const x = ctx.createOscillator(), xg = ctx.createGain();
      x.type = p.type || "sawtooth";
      x.frequency.setValueAtTime(hz(mtof(m)), t);
      x.detune.setValueAtTime(s * det + rnd(-2, 2), t);
      xg.gain.value = per;
      x.connect(xg); xg.connect(f); o.nodes.push(x, xg);
      x.start(t); x.stop(end); mark(o, x, end);
    }
    finish(D, o);
  }

  function kal(D, t, m, v, pan, send) {
    if (v < 0.002) return;
    pl(D, send == null ? 0.3 : send, pan, (o) => {
      const f = mtof(m) * pj();
      fm(o, { t, f, v, d: 1.2, r: 5.4, i: 1.1, md: 0.09 });
      part(o, { t, f: f * 2, v: v * 0.12, d: 0.25 });
    });
  }

  function mar(D, t, m, v, pan, send) {
    if (v < 0.002) return;
    pl(D, send == null ? 0.2 : send, pan, (o) => {
      const f = mtof(m);
      fm(o, { t, f, v, d: 0.7, r: 4, i: 1.8, md: 0.05 });
      part(o, { t, f, v: v * 0.35, a: 0.003, d: 0.35 });
    });
  }

  function bel(D, t, m, v, dec, send, pan) {
    if (v < 0.002) return;
    pl(D, send, pan, (o) => bellP(o, t, mtof(m) * pj(), v, dec));
  }

  function box(D, t, m, v, pan) {
    if (v < 0.002) return;
    pl(D, 0.35, pan, (o) => {
      const f = mtof(m);
      part(o, { t, f, v, a: 0.002, d: 1.3 });
      part(o, { t, f: f * 4, v: v * 0.12, a: 0.001, d: 0.1 });
      part(o, { t, type: "triangle", f: f * 2, v: v * 0.12, a: 0.002, d: 0.45 });
    });
  }

  function lead(D, t, m, dur, v, pan) {
    if (v < 0.002) return;
    pl(D, 0.45, pan, (o) => {
      const f = mtof(m), lp = flt(o, { ft: "lowpass", f: 2400, t });
      const x = part(o, { t, type: "triangle", f, a: 0.03, v, d: dur, to: lp });
      const l = ctx.createOscillator(), lg = ctx.createGain();
      l.frequency.value = 5.2;
      lg.gain.setValueAtTime(0, t);
      lg.gain.linearRampToValueAtTime(f * 0.006, t + 0.3);
      l.connect(lg); lg.connect(x.frequency); o.nodes.push(l, lg);
      l.start(t); l.stop(t + dur + 0.08);
    });
  }

  function tick(D, t, v, f) {
    if (v < 0.002) return;
    pl(D, 0.15, rnd(-0.2, 0.2), (o) => {
      nz(o, { t, ft: "bandpass", f, q: 6, a: 0.001, v, d: 0.035 });
      part(o, { t, f: f * 0.6, a: 0.001, v: v * 0.4, d: 0.02 });
    });
  }

  function pulse(D, t, v) {
    if (v < 0.002) return;
    pl(D, 0.7, 0, (o) => {
      part(o, { t, f: 72, f2: 38, slide: 0.35, a: 0.005, v, d: 0.6 });
      nz(o, { t, ft: "lowpass", f: 220, v: v * 0.25, a: 0.005, d: 0.12 });
    });
  }

  function swell(D, t, dur, v, f1, f2) {
    if (v < 0.002) return;
    pl(D, 0.6, rnd(-0.3, 0.3), (o) => {
      const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), end = t + dur + 0.05;
      s.buffer = noiseBuf; s.loop = true;
      f.type = "bandpass"; f.Q.value = 3;
      f.frequency.setValueAtTime(hz(f1), t);
      ramp(f.frequency, hz(f2), t + dur * 0.6);
      ramp(f.frequency, hz(f1 * 1.2), t + dur);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(gv(v), t + dur * 0.55);
      g.gain.linearRampToValueAtTime(0, t + dur);
      s.connect(f); f.connect(g); g.connect(o.sum); o.nodes.push(s, f, g);
      s.start(t, Math.random() * 1.5); s.stop(end); mark(o, s, end);
    });
  }

  const ION = [0, 2, 4, 5, 7, 9, 11], LYD = [0, 2, 4, 6, 7, 9, 11], DOR = [0, 2, 3, 5, 7, 9, 10];
  const MIX = [0, 2, 4, 5, 7, 9, 10], PHR = [0, 1, 3, 5, 7, 8, 10];

  function sc(S, arr, d, oct) {
    const n = arr.length, q = Math.floor(d / n);
    return S.st.root + 12 * (oct + q) + arr[d - q * n];
  }
  const dm = (S, d, oct) => sc(S, S.st.mode, d, oct);
  const pm = (S, d, oct) => sc(S, S.st.penta, d, oct);
  const chordM = (S, oct, n) => [0, 2, 4, 6].slice(0, n || 3).map((x) => dm(S, S.chord + x, oct));
  const L = (S, l) => (S.lv[l] || 0) * (S.st.core[l] ? 1 : mood.thin);
  const on = (S, l) => L(S, l) > 0.01;
  const barDur = (S) => (60 / S.st.bpm) * S.st.bpb;
  const stepDur = (S) => 60 / S.st.bpm / S.st.sub;

  function motif(len, dens) {
    const a = [];
    let d = 0;
    for (let i = 0; i < len; i++) {
      if (i === 0 || Math.random() < dens) {
        if (i) d = clamp(d + pick([-2, -1, -1, 0, 1, 1, 2]), -3, 6);
        a.push(d);
      } else a.push(null);
    }
    return a;
  }

  function mutate(a) {
    for (let n = ri(1, 2); n > 0; n--) {
      const i = ri(1, a.length - 1), prev = a[i - 1] == null ? 0 : a[i - 1];
      if (a[i] == null) a[i] = clamp(prev + pick([-1, 1]), -3, 6);
      else a[i] = Math.random() < 0.35 ? null : clamp(a[i] + pick([-1, 1]), -3, 6);
    }
  }

  function gate(n, d) {
    const a = [];
    for (let i = 0; i < n; i++) a.push(i === 0 || Math.random() < d);
    return a;
  }

  const STYLES = {
    menu: {
      bpm: 76, sub: 2, bpb: 4, root: 53, mode: ION, penta: [0, 2, 4, 7, 9], chordBars: 1, wet: 0.4,
      progs: [[0, 5, 3, 4], [0, 3, 5, 4], [3, 0, 4, 0], [0, 2, 3, 4]],
      layers: { pad: 1, bass: 1, mel: 0.75, arp: 0.5, spark: 0.5 }, core: { pad: 1, bass: 1 }, motifLen: 16, density: 0.5, bases: [2, 3, 4],
      step(S, i, t, bar, b, k) {
        const D = S.D;
        if (i === 0 && S.chordStart) pad(D, t, chordM(S, 0), barDur(S) * 0.95, 0.06 * L(S, "pad"), { type: "triangle", cut: 1400, atk: 0.6, rel: 1.4, det: 7 });
        if (i === 0) mar(D, t, dm(S, S.chord, -1), 0.3 * L(S, "bass"), 0, 0.15);
        if (i === 5 && Math.random() < 0.5) mar(D, t, dm(S, S.chord + 4, -1), 0.16 * L(S, "bass"), 0, 0.15);
        const n = S.motif[(bar % 2) * 8 + i];
        if (n != null && on(S, "mel")) kal(D, t, pm(S, S.mbase + n, 1), 0.18 * L(S, "mel"), rnd(-0.3, 0.3), 0.35);
        if (k === 1 && on(S, "arp") && Math.random() < 0.5) kal(D, t, chordM(S, 1)[b % 3], 0.07 * L(S, "arp"), rnd(-0.5, 0.5), 0.4);
        if (Math.random() < 0.05 * L(S, "spark")) bel(D, t, pm(S, ri(0, 5), 2), 0.035, 2, 0.7, rnd(-0.6, 0.6));
      },
    },
    1: {
      bpm: 84, sub: 2, bpb: 4, root: 62, mode: ION, penta: [0, 2, 4, 7, 9], chordBars: 1, patD: 0.7,
      progs: [[0, 3, 4, 0], [0, 5, 3, 4], [3, 4, 0, 5], [0, 2, 3, 4], [5, 3, 0, 4]],
      layers: { pad: 1, bass: 0.9, arp: 0.7, mel: 0.6, spark: 0.5 }, core: { pad: 1, bass: 1 }, motifLen: 16, density: 0.55, bases: [2, 3, 4],
      step(S, i, t, bar) {
        const D = S.D;
        if (i === 0 && S.chordStart) pad(D, t, chordM(S, -1), barDur(S), 0.05 * L(S, "pad"), { type: "sawtooth", cut: 900, atk: 0.5, rel: 1.2, det: 9 });
        if (i === 0) mar(D, t, dm(S, S.chord, -2), 0.32 * L(S, "bass"), 0, 0.12);
        if (i === 4 && Math.random() < 0.7) mar(D, t, dm(S, S.chord + 4, -2), 0.2 * L(S, "bass"), 0, 0.12);
        if (S.pat[i] && on(S, "arp")) {
          const c = chordM(S, 0), a = S.ai++ % 6;
          kal(D, t, c[a % 3] + 12 * Math.floor(a / 3), 0.11 * L(S, "arp"), a % 2 ? 0.3 : -0.3, 0.25);
        }
        const n = S.motif[(bar % 2) * 8 + i];
        if (n != null && on(S, "mel")) kal(D, t, pm(S, S.mbase + n, 0), 0.16 * L(S, "mel"), rnd(-0.2, 0.2), 0.3);
        if (Math.random() < 0.05 * L(S, "spark")) bel(D, t, pm(S, ri(0, 5), 2), 0.03, 1.8, 0.6, rnd(-0.6, 0.6));
      },
    },
    2: {
      bpm: 70, sub: 2, bpb: 4, root: 64, mode: LYD, penta: [0, 2, 4, 6, 7, 11], chordBars: 2,
      progs: [[0, 1], [0, 1, 4, 1], [0, 5, 1, 0], [0, 2, 1, 0]],
      layers: { pad: 1, bass: 0.8, bell: 0.8, tw: 0.6, drift: 0.4 }, core: { pad: 1, bass: 1 }, motifLen: 16, density: 0.35, bases: [0, 1, 2],
      step(S, i, t, bar) {
        const D = S.D, bd = barDur(S);
        if (i === 0 && S.chordStart) {
          const c = chordM(S, -1, 4);
          pad(D, t, c.concat([c[0] + 24]), bd * 2, 0.045 * L(S, "pad"), { type: "triangle", cut: 2800, atk: 2, rel: 2.5, det: 16, send: 0.75 });
          pad(D, t, [dm(S, S.chord, -2)], bd * 2, 0.09 * L(S, "bass"), { type: "sine", cut: 300, atk: 1, rel: 2, det: 2, send: 0.2 });
        }
        const n = S.motif[(bar % 2) * 8 + i];
        if (n != null && on(S, "bell") && Math.random() < 0.65) bel(D, t, pm(S, S.mbase + n, 0), 0.07 * L(S, "bell"), 3, 0.65, rnd(-0.4, 0.4));
        if (Math.random() < 0.07 * L(S, "tw")) bel(D, t + rnd(0, 0.1), pm(S, ri(0, 6), 2), 0.025, 1.6, 0.7, rnd(-0.8, 0.8));
        if (i === 0 && bar % 4 === 2 && on(S, "drift")) swell(D, t, bd * 2, 0.03 * L(S, "drift"), 2000, 5000);
      },
    },
    3: {
      bpm: 96, sub: 4, bpb: 4, root: 57, mode: DOR, penta: [0, 3, 5, 7, 10], chordBars: 1, patD: 0.75,
      progs: [[0, 3, 0, 3], [0, 3, 6, 0], [0, 6, 3, 4], [0, 2, 3, 0]],
      layers: { pad: 1, arp: 0.85, bass: 0.8, lead: 0.45, hat: 0.5 }, core: { pad: 1, bass: 1 }, motifLen: 16, density: 0.45, bases: [0, 2, 4],
      init(S) {
        const mk = (g) => { const n = ctx.createGain(); n.gain.value = g; S.nodes.push(n); return n; };
        S.phIn = mk(1);
        const phOut = mk(0.7);
        let prev = S.phIn;
        const lfo = ctx.createOscillator(), lg = mk(420);
        lfo.frequency.value = 0.18; lfo.connect(lg);
        for (const f of [600, 900, 1300, 1800]) {
          const ap = ctx.createBiquadFilter();
          ap.type = "allpass"; ap.frequency.value = f; ap.Q.value = 0.8;
          lg.connect(ap.frequency); prev.connect(ap); prev = ap; S.nodes.push(ap);
        }
        prev.connect(phOut); phOut.connect(S.fade); S.phIn.connect(S.fade);
        lfo.start(); S.lfos.push(lfo);
        S.dlyIn = mk(1);
        const dl = ctx.createDelay(2), fb = mk(0.38), lp = ctx.createBiquadFilter(), dOut = mk(0.5);
        dl.delayTime.value = (60 / S.st.bpm) * 0.75;
        lp.type = "lowpass"; lp.frequency.value = 2500;
        S.dlyIn.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(dOut); dOut.connect(S.fade);
        S.nodes.push(dl, lp);
        S.Dp = { dry: S.phIn, wet: S.fadeWet, kind: "music" };
        S.Da = { dry: S.fade, wet: S.fadeWet, fx: S.dlyIn, fxAmt: 0.45, kind: "music" };
      },
      step(S, i, t, bar) {
        const D = S.D;
        if (i === 0 && S.chordStart) pad(S.Dp, t, chordM(S, -1, 4), barDur(S), 0.065 * L(S, "pad"), { type: "sawtooth", cut: 1500, atk: 0.3, rel: 0.8, det: 12, send: 0.4 });
        if (S.pat[i] && on(S, "arp")) {
          const c = chordM(S, 0, 4), a = S.ai++ % 12, seq = [0, 1, 2, 3, 2, 1];
          const m = c[seq[a % 6]] + (a >= 6 ? 12 : 0);
          pl(S.Da, 0.2, a % 2 ? 0.35 : -0.35, (o) => fm(o, { t, f: mtof(m), v: 0.1 * L(S, "arp"), d: 0.22, r: 2, i: 1.2, md: 0.1 }));
        }
        if ((i === 0 || i === 6 || i === 8 || i === 14) && on(S, "bass")) {
          pl(D, 0.05, 0, (o) => fm(o, { t, f: mtof(dm(S, S.chord, -2)), v: 0.26 * L(S, "bass"), d: 0.3, r: 1, i: 1.3, md: 0.12 }));
        }
        if (i % 2 === 0 && on(S, "lead")) {
          const n = S.motif[(bar % 2) * 8 + i / 2];
          if (n != null) lead(D, t, pm(S, S.mbase + n, 1), stepDur(S) * 3.2, 0.05 * L(S, "lead"), rnd(-0.2, 0.2));
        }
        if (i % 4 === 2 && on(S, "hat")) pl(D, 0.1, 0.25, (o) => nz(o, { t, ft: "highpass", f: 8000, a: 0.001, v: 0.02 * L(S, "hat"), d: 0.03 }));
      },
    },
    4: {
      bpm: 100, sub: 6, bpb: 4, root: 55, mode: MIX, penta: [0, 2, 4, 7, 10], chordBars: 1,
      progs: [[0, 6, 3, 0], [0, 4, 6, 3], [0, 3, 6, 0], [0, 6, 4, 0]],
      layers: { clock: 1, fine: 0.6, boxA: 0.9, boxB: 0.75, bass: 0.8, pad: 0.5 }, core: { clock: 1, bass: 1 }, motifLen: 6, density: 0.75, bases: [0, 1, 2],
      step(S, i, t, bar, b) {
        const D = S.D;
        if (i % 6 === 0) tick(D, t, (b % 2 ? 0.05 : 0.07) * L(S, "clock"), b % 2 ? 1900 : 3200);
        if (i % 3 === 0 && i % 6 !== 0 && on(S, "fine")) tick(D, t, 0.02 * L(S, "fine"), 5200);
        if (i % 6 === 0 && on(S, "boxA")) box(D, t, chordM(S, 1)[[0, 1, 2, 1][b]], 0.09 * L(S, "boxA"), -0.35);
        if (i % 8 === 0 && on(S, "boxB")) {
          const n = S.motif[(bar % 2) * 3 + i / 8];
          if (n != null) box(D, t, pm(S, S.mbase + n, 2), 0.07 * L(S, "boxB"), 0.35);
        }
        if (i === 0) mar(D, t, dm(S, S.chord, -1), 0.22 * L(S, "bass"), 0, 0.15);
        if (i === 12) mar(D, t, dm(S, S.chord + 4, -1), 0.13 * L(S, "bass"), 0, 0.15);
        if (i === 0 && S.chordStart && on(S, "pad")) pad(D, t, chordM(S, 0), barDur(S), 0.03 * L(S, "pad"), { type: "triangle", cut: 1100, atk: 0.4, rel: 1, det: 6 });
        if (i === 0 && bar % 8 === 7) bel(D, t, dm(S, 0, 1), 0.06, 3, 0.6, 0);
        if (i === 12 && bar % 16 === 15) bel(D, t, dm(S, 4, 1), 0.05, 3, 0.6, 0);
      },
    },
    5: {
      bpm: 64, sub: 2, bpb: 4, root: 48, mode: PHR, penta: [0, 1, 3, 7, 8], chordBars: 2,
      progs: [[0, 1], [0, 1, 0, 6], [0, 5, 1, 0], [0, 6, 5, 1]],
      layers: { drone: 1, pulse: 0.8, swell: 0.6, bell: 0.55, dark: 0.5 }, core: { drone: 1, pulse: 1 }, motifLen: 16, density: 0.25, bases: [0, 1, 2],
      step(S, i, t, bar) {
        const D = S.D, bd = barDur(S);
        if (i === 0 && S.chordStart) {
          const r = dm(S, S.chord, -1);
          pad(D, t, [r, r + 7], bd * 2 + 0.5, 0.13 * L(S, "drone"), { type: "sine", det: 3, cut: 260, atk: 1.6, rel: 2.2, send: 0.25 });
          pad(D, t, [r - 12], bd * 2 + 0.5, 0.1 * L(S, "drone"), { type: "sine", det: 1, cut: 150, atk: 2, rel: 2.5, send: 0 });
          if (on(S, "dark")) pad(D, t, chordM(S, 0), bd * 2, 0.035 * L(S, "dark"), { type: "sawtooth", cut: 520, q: 2, atk: 2.5, rel: 3, det: 10, send: 0.7 });
        }
        if (i === 0 || i === 4) pulse(D, t, 0.14 * L(S, "pulse"));
        if (i === 1 && Math.random() < 0.4) pulse(D, t, 0.07 * L(S, "pulse"));
        if (i === 0 && bar % 4 === 1 && on(S, "swell")) swell(D, t, bd * 2.5, 0.045 * L(S, "swell"), 200, 900);
        const n = S.motif[(bar % 2) * 8 + i];
        if (n != null && on(S, "bell") && Math.random() < 0.55) bel(D, t, pm(S, S.mbase + n, 1), 0.05 * L(S, "bell"), 4.5, 0.85, rnd(-0.5, 0.5));
      },
    },
    zen: {
      bpm: 56, sub: 1, bpb: 4, root: 50, mode: LYD, penta: [0, 2, 4, 7, 9], chordBars: 4,
      progs: [[0, 1], [0, 3], [5, 1, 0, 4], [0, 4, 5, 1]],
      layers: { pad: 1, drone: 0.8, bell: 0.8, low: 0.5, air: 0.4 }, core: { pad: 1, drone: 1 }, motifLen: 8, density: 0.4,
      step(S, i, t, bar) {
        const D = S.D, bd = barDur(S);
        if (i === 0 && S.chordStart) {
          pad(D, t, chordM(S, 0, 4), bd * 4 + 2, 0.055 * L(S, "pad"), { type: "triangle", det: 10, cut: 1500, atk: 4, rel: 5, send: 0.7 });
          pad(D, t, [dm(S, 0, -1)], bd * 4 + 2, 0.08 * L(S, "drone"), { type: "sine", det: 2, cut: 300, atk: 4, rel: 5, send: 0.3 });
        }
        if (Math.random() < 0.3 * L(S, "bell")) bel(D, t + rnd(0, 0.4), pm(S, ri(0, 7), 1), rnd(0.03, 0.06), 4, 0.8, rnd(-0.7, 0.7));
        if (Math.random() < 0.1 * L(S, "low")) kal(D, t, pm(S, ri(0, 4), 0), 0.08, rnd(-0.3, 0.3), 0.6);
        if (i === 0 && bar % 8 === 2 && on(S, "air")) swell(D, t, bd * 3, 0.02 * L(S, "air"), 1500, 4000);
      },
    },
  };

  function normKey(k) {
    if (k == null || k === false) return null;
    if (typeof k === "string" && /^[1-5]$/.test(k)) k = +k;
    return Object.prototype.hasOwnProperty.call(STYLES, k) ? k : undefined;
  }

  function startSession(key) {
    const st = STYLES[key], t0 = ctx.currentTime;
    const S = { key, st, next: t0 + 0.06, step: 0, ci: 0, prog: pick(st.progs), chord: 0, lv: {}, tgt: {}, motif: null, mbase: 0, pat: null, ai: 0, lfos: [], nodes: [] };
    S.fade = ctx.createGain(); S.fadeWet = ctx.createGain();
    for (const g of [S.fade, S.fadeWet]) { g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(1, t0 + XF); }
    S.fade.connect(N.musLp); S.fadeWet.connect(N.musLpW);
    S.nodes.push(S.fade, S.fadeWet);
    S.D = { dry: S.fade, wet: S.fadeWet, kind: "music" };
    S.chord = S.prog[0];
    if (st.init) st.init(S);
    return S;
  }

  function endSession(S) {
    const t0 = ctx.currentTime;
    S.ending = true; S.endAt = t0 + XF;
    for (const g of [S.fade, S.fadeWet]) {
      g.gain.cancelScheduledValues(t0);
      g.gain.setValueAtTime(g.gain.value, t0);
      g.gain.linearRampToValueAtTime(0, t0 + XF);
    }
    setTimeout(() => {
      S.dead = true;
      for (const l of S.lfos) { try { l.stop(); } catch (e) { continue; } }
      for (const n of S.lfos.concat(S.nodes)) { try { n.disconnect(); } catch (e) { continue; } }
    }, (XF + 6) * 1000);
  }

  function barStart(S, bar) {
    const st = S.st;
    S.chordStart = bar % st.chordBars === 0;
    if (S.chordStart && bar > 0 && ++S.ci >= S.prog.length) {
      S.ci = 0;
      if (Math.random() < 0.5) S.prog = pick(st.progs);
    }
    S.chord = S.prog[S.ci];
    if (bar % 4 === 0) for (const l in st.layers) {
      S.tgt[l] = Math.random() < st.layers[l] ? 1 : 0;
      if (bar === 0) S.lv[l] = st.layers[l] >= 1 ? 1 : 0;
    }
    for (const l in st.layers) S.lv[l] = clamp(S.lv[l] + clamp(S.tgt[l] - S.lv[l], -0.34, 0.34), 0, 1);
    if (bar % 8 === 0) {
      S.motif = motif(st.motifLen, st.density);
      S.mbase = pick(st.bases || [0]);
      S.pat = gate(st.sub * st.bpb, st.patD || 0.6);
    } else if (bar % 2 === 0) mutate(S.motif);
  }

  function emitBeat(beat, bar, key, t) {
    if (!beatFns.length) return;
    const ev = { beat, bar, key };
    setTimeout(() => {
      for (const fn of beatFns.slice()) { try { fn(ev); } catch (e) { if (window.console) console.error(e); } }
    }, Math.max(0, (t - ctx.currentTime) * 1000));
  }

  function runStep(S, s, t) {
    const st = S.st, per = st.sub * st.bpb, i = s % per, bar = Math.floor(s / per), b = Math.floor(i / st.sub), k = i % st.sub;
    if (i === 0) barStart(S, bar);
    if (k === 0 && S === cur) emitBeat(b, bar, S.key, t);
    try { st.step(S, i, t + rnd(0, 0.006), bar, b, k); } catch (e) { if (window.console) console.error(e); }
    if (S === cur && !S.ending && (mood.tenT > 0 || G.demo)) {
      try { layer(S, i, t, b, k); } catch (e) { if (window.console) console.error(e); }
    }
  }

  const reg = (m, lo) => { while (m < lo) m += 12; while (m >= lo + 12) m -= 12; return m; };

  function heart(t, m, v) {
    if (v < 0.002) return;
    pl(LD, 0.1, 0, (o) => {
      const f = mtof(m);
      part(o, { t, f, f2: f * 0.7, slide: 0.16, a: 0.004, v, d: 0.24 });
      part(o, { t, f: f * 2, a: 0.004, v: v * 0.25, d: 0.1 });
    });
  }

  function pedal(t, m, dur, v, beat) {
    if (v < 0.002) return;
    pl(LD, 0.6, 0, (o) => {
      const f = mtof(m), end = t + dur + 0.7, g = ctx.createGain(), tr = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(gv(v), t + 0.35);
      g.gain.setValueAtTime(gv(v), t + dur);
      g.gain.linearRampToValueAtTime(0, t + dur + 0.6);
      tr.gain.value = mood.rm ? 1 : 0.7;
      tr.connect(g); g.connect(o.sum); o.nodes.push(g, tr);
      if (!mood.rm) {
        const l = ctx.createOscillator(), lg = ctx.createGain();
        l.frequency.value = 2 / beat; lg.gain.value = 0.3;
        l.connect(lg); lg.connect(tr.gain); o.nodes.push(l, lg);
        l.start(t); l.stop(end);
      }
      for (const h of [[1, 0.8, -4], [1, 0.8, 4], [2, 0.18, 0]]) {
        const x = ctx.createOscillator(), xg = ctx.createGain();
        x.frequency.value = hz(f * h[0]); x.detune.value = h[2]; xg.gain.value = h[1];
        x.connect(xg); xg.connect(tr); o.nodes.push(x, xg);
        x.start(t); x.stop(end); mark(o, x, end);
      }
    });
  }

  // Overlay layer: Oracle halo during demos, heartbeat and dominant pedal on the last seed.
  function layer(S, i, t, b, k) {
    const st = S.st, beat = 60 / st.bpm;
    if (G.demo) {
      if (i === 0 && S.chordStart) pad(LD, t, chordM(S, 1), barDur(S) * st.chordBars, 0.022, { type: "sine", cut: 2600, atk: 1.6, rel: 2.2, det: 5, send: 0.9 });
      return;
    }
    const v = mood.tenT;
    if (i === 0) pedal(t, reg(dm(S, 4, 0), 74), barDur(S), 0.022 * v, beat);
    if (k === 0 && b % 2 === 0) {
      const m = reg(st.root, 38);
      heart(t, m, 0.16 * v);
      heart(t + beat * 0.32, m, 0.09 * v);
    }
    if (v >= 1 && k === 0) tick(LD, t + beat * 0.5, 0.012, 4600);
  }

  function loop() {
    timer = null;
    if (!ctx || document.hidden) return;
    const t0 = ctx.currentTime;
    moodTick(t0);
    for (const S of sessions) {
      if (S.dead) continue;
      if (S.next < t0 - 0.25) S.next = t0 + 0.02;
      const sd = stepDur(S) / mood.tempo;
      while (S.next < t0 + LOOK && !(S.ending && S.next > S.endAt)) {
        runStep(S, S.step, S.next);
        S.step++; S.next += sd;
      }
    }
    sessions = sessions.filter((S) => !S.dead);
    if (sessions.length) timer = setTimeout(loop, TICK);
  }

  function kick() {
    if (!timer && ctx && !document.hidden && sessions.length) timer = setTimeout(loop, 0);
  }

  function resync() {
    if (!ctx) return;
    const t0 = ctx.currentTime + 0.05;
    for (const S of sessions) if (S.next < t0) S.next = t0;
    kick();
  }

  function applyMusic() {
    if (!ctx || (cur && cur.key === want) || (!cur && want == null)) return;
    if (cur) endSession(cur);
    cur = null;
    if (want != null) { cur = startSession(want); sessions.push(cur); }
    kick();
  }

  function makeIR(sec, decay) {
    const rate = ctx.sampleRate, len = Math.floor(rate * sec), buf = ctx.createBuffer(2, len, rate), pre = rate * 0.012;
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const x = i / len;
        lp += (Math.random() * 2 - 1 - lp) * (0.2 + 0.7 * (1 - x));
        d[i] = lp * Math.pow(1 - x, decay) * (i < pre ? i / pre : 1);
      }
    }
    return buf;
  }

  // Transfer curve: linear up to 0.7, then smooth saturation toward 0.98.
  function softClip() {
    const n = 2048, c = new Float32Array(n), k = 0.7, h = 0.98 - k;
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1, a = Math.abs(x);
      c[i] = Math.sign(x) * (a <= k ? a : k + h * Math.tanh((a - k) / h));
    }
    return c;
  }

  function build() {
    const g = (v) => { const n = ctx.createGain(); n.gain.value = v; return n; };
    const rate = ctx.sampleRate;
    noiseBuf = ctx.createBuffer(1, rate * 2, rate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    crackBuf = ctx.createBuffer(1, rate, rate);
    const cd = crackBuf.getChannelData(0);
    for (let i = 0; i < cd.length; i++) {
      if (Math.random() < 0.0012) {
        const amp = rnd(0.3, 1) * (Math.random() < 0.5 ? -1 : 1), n = ri(20, 90);
        for (let j = 0; j < n && i + j < cd.length; j++) cd[i + j] += amp * (Math.random() * 2 - 1) * (1 - j / n);
      }
    }
    for (let i = 0; i < cd.length; i++) cd[i] = clamp(cd[i], -1, 1);

    N = {};
    N.master = g(vol.master);
    N.mute = g(muted ? 0 : 1);
    N.comp = ctx.createDynamicsCompressor();
    N.comp.threshold.value = -14; N.comp.knee.value = 12; N.comp.ratio.value = 3;
    N.comp.attack.value = 0.03; N.comp.release.value = 0.3;
    N.lim = ctx.createWaveShaper();
    N.lim.curve = softClip();
    N.master.connect(N.mute); N.mute.connect(N.comp); N.comp.connect(N.lim); N.lim.connect(ctx.destination);

    N.verbIn = g(1);
    N.verbHp = ctx.createBiquadFilter();
    N.verbHp.type = "highpass"; N.verbHp.frequency.value = 180;
    N.verb = ctx.createConvolver();
    N.verb.buffer = makeIR(2.8, 3);
    N.verbOut = g(0.55);
    N.verbIn.connect(N.verbHp); N.verbHp.connect(N.verb); N.verb.connect(N.verbOut); N.verbOut.connect(N.master);

    N.sfxDry = g(vol.sfx); N.sfxWet = g(vol.sfx);
    N.musDry = g(vol.music * 0.85); N.musWet = g(vol.music * 0.85);
    N.sfxMood = g(1); N.musMood = g(1); N.musMoodW = g(1);
    N.layDry = g(0); N.layWet = g(0);
    const lp = () => { const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.Q.value = 0.5; f.frequency.value = 18000; return f; };
    N.musLp = lp(); N.musLpW = lp();
    N.musLp.connect(N.musDry); N.musLpW.connect(N.musWet);
    N.layDry.connect(N.musDry); N.layWet.connect(N.musWet);
    N.sfxDry.connect(N.sfxMood); N.sfxMood.connect(N.master);
    N.musDry.connect(N.musMood); N.musMood.connect(N.master);
    N.sfxWet.connect(N.verbIn); N.musWet.connect(N.musMoodW); N.musMoodW.connect(N.verbIn);
    SX = { dry: N.sfxDry, wet: N.sfxWet, kind: "sfx" };
    LD = { dry: N.layDry, wet: N.layWet, kind: "music" };
  }

  function note(ev) {
    trace.push({ t: ctx ? Math.round(ctx.currentTime * 100) / 100 : 0, ev });
    if (trace.length > 64) trace.shift();
  }

  function reduced() {
    try {
      const O = window.Orchard, s = O && typeof O.getSettings === "function" ? O.getSettings() : null;
      if (s && s.reducedMotion) return true;
    } catch (e) { return !!(mqRM && mqRM.matches); }
    return !!(mqRM && mqRM.matches);
  }

  function applyMood(rel) {
    if (!N) return;
    const t0 = ctx.currentTime, k = mood.tenT, d = G.demo, up = k > 0 || d, tau = rel || 0.4;
    const set = (p, v, tc) => p.setTargetAtTime(v, t0, tc);
    const cut = Math.min(k >= 1 ? 1500 : k > 0 ? 2600 : 18000, d ? 2600 : 18000);
    set(N.musLp.frequency, cut, tau); set(N.musLpW.frequency, cut, tau);
    set(N.musMood.gain, (1 - 0.22 * k) * (d ? 0.6 : 1), tau);
    set(N.musMoodW.gain, d ? 0.85 : 1 - 0.15 * k, tau);
    set(N.sfxMood.gain, d ? 0.55 : 1, tau);
    set(N.layDry.gain, up ? 1 : 0, up ? 0.25 : tau * 0.6);
    set(N.layWet.gain, up ? 1 : 0, up ? 0.25 : tau * 0.6);
  }

  function moodTick(t0) {
    const thinT = clamp(1 - 0.55 * mood.tenT - (G.demo ? 0.4 : 0), 0.25, 1);
    mood.thin += (thinT - mood.thin) * 0.1;
    mood.tempo += (mood.tempoT - mood.tempo) * 0.12;
    if (Math.abs(mood.tempo - mood.tempoT) < 1e-3) mood.tempo = mood.tempoT;
    if ((mood.tenT > 0 || G.demo || G.fast) && t0 - mood.vAt > 0.8) { mood.vAt = t0; verify(); }
  }

  function setTension(v, rel) {
    if (v === mood.tenT) return;
    if (v > 0 && mood.tenT === 0) mood.rm = reduced();
    mood.tenT = v;
    note("tension " + v);
    applyMood(v > 0 ? 0.5 : rel);
  }

  function setDemo(on) {
    if (on === G.demo) return;
    G.demo = on;
    note(on ? "demo on" : "demo off");
    applyMood(on ? 0.5 : 0.6);
  }

  function setFast(on, flying) {
    if (on === G.fast) return;
    G.fast = on;
    mood.tempoT = on && !reduced() ? 1.12 : 1;
    note(on ? "fast on" : "fast off");
    if (on) api.sfx("ffon");
    else if (flying) api.sfx("ffoff");
  }

  function resetMood(rel) {
    setTension(0, rel);
    setDemo(false);
    setFast(false, false);
    probeStop();
  }

  function onHud(h) {
    const demo = !!h.demo, flying = !!h.flying, need = num(h.needTotal, 0), sown = num(h.sown, 0), left = h.seedsLeft;
    if (demo !== G.demo) setDemo(demo);
    if (typeof h.fast === "boolean") setFast(h.fast && !demo, flying);
    if (flying !== G.flying) {
      G.flying = flying;
      if (flying && !demo) probeStart(); else if (!flying) probeStop();
    }
    const done = need > 0 && sown >= need;
    if (done && G.need === need && G.sown < need) { note("bloom"); api.sfx("bloom"); }
    G.sown = sown; G.need = need;
    const lost = left === 0 && !flying && !done;
    const v = demo || done || !(need > 0) ? 0 : left === 1 ? 0.6 : left === 0 && flying ? 1 : 0;
    setTension(v, done ? 0.25 : lost ? 0.9 : 0.3);
  }

  function nearMiss() {
    PR.fired = true;
    fadeRise();
    note("near");
    api.sfx("near");
  }

  function onEvent(e) {
    if (e.type === "near") { pubNear = true; probeStop(); nearMiss(); return; }
    if (!TERM[e.type]) return;
    if (PR.arm >= 0 && !PR.fired && !(e.type === "plant" && e.i === PR.arm)) nearMiss();
    probeStop();
  }

  function onDemo(e) {
    if (e.phase === "start") { setDemo(true); api.sfx("oracle"); }
    else if (e.phase === "abort") setDemo(false);
  }

  function verify() {
    try {
      const O = window.Orchard, s = O && typeof O.getState === "function" ? O.getState() : null;
      if (!s || s.mode === "showcase" || s.mode === "idle" || !s.levelId) { resetMood(0.6); return; }
      if (s.paused) setFast(false, false);
      onHud(s);
    } catch (e) { resetMood(0.6); }
  }

  function dbgState() {
    const O = window.Orchard, d = O && O._debug, s = d && d.state;
    return s && typeof s === "object" ? s : null;
  }

  function segDist(ax, ay, bx, by, px, py) {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    const u = l2 > 0 ? clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1) : 0;
    return Math.hypot(ax + dx * u - px, ay + dy * u - py);
  }

  function probeStart() {
    if (PR.id || pubNear || !ctx || muted || !dbgState()) return;
    PR.has = false; PR.arm = -1; PR.fired = false; PR.rose = false; PR.lc = Infinity; PR.rise = null;
    PR.id = setInterval(probe, 50);
  }

  function probeStop() {
    if (PR.id) { clearInterval(PR.id); PR.id = 0; }
    fadeRise();
  }

  function probe() {
    try { probeStep(); } catch (e) { probeStop(); }
  }

  // Tracks seed clearance to unsown soil: arms when close, stings when it pulls away, rises toward the last soil.
  function probeStep() {
    const s = dbgState(), sd = s && s.seed;
    if (!sd || s.demo || !s.lv || !ctx) { probeStop(); return; }
    if (s.paused || document.hidden) return;
    const B = s.lv.bodies, PS = s.P, x = sd.x, y = sd.y;
    const seg = PR.has && Math.abs(x - PR.px) + Math.abs(y - PR.py) < 300;
    let rem = 0, li = -1, lc = Infinity;
    for (let i = 0; i < B.length; i++) {
      const b = B[i];
      if (!b || b.kind !== "fertile" || !(b.got < b.need)) continue;
      rem += b.need - b.got;
      const p = PS && PS[i], bx = p ? p[0] : b.x, by = p ? p[1] : b.y, rr = b.r + 6;
      const c = Math.hypot(x - bx, y - by) - rr, cs = seg ? segDist(PR.px, PR.py, x, y, bx, by) - rr : c;
      if (PR.arm < 0 && !PR.fired && cs < 22 + b.r * 0.3) { PR.arm = i; PR.th = 22 + b.r * 0.3; }
      else if (PR.arm === i && c > PR.th * 1.6 + 12) { PR.arm = -1; if (!PR.fired) nearMiss(); }
      li = i; lc = c;
    }
    if (rem === 1 && li >= 0) {
      if (!PR.rose && !PR.fired && lc < B[li].r * 2.5 + 40 && lc < PR.lc - 2) { PR.rose = true; PR.rise = rise(); note("rise"); }
      PR.lc = lc;
    }
    PR.px = x; PR.py = y; PR.has = true;
  }

  function rise() {
    let h = null;
    P(0.5, 0, (o) => {
      const t = now(), r = sroot(), d = 1.1;
      nz(o, { t, ft: "bandpass", q: 3, f: 300, f2: 1800, slide: d, a: d * 0.9, v: 0.035, d: 0.3 });
      part(o, { t, type: "triangle", f: mtof(md(4) - 12), f2: mtof(r), slide: d, a: d * 0.8, v: 0.03, d: 0.45 });
      h = o.sum;
    });
    return h;
  }

  function fadeRise() {
    const h = PR.rise;
    PR.rise = null;
    if (!h || !ctx) return;
    const t0 = ctx.currentTime;
    h.gain.cancelScheduledValues(t0);
    h.gain.setTargetAtTime(0, t0, 0.05);
  }

  function hook() {
    if (hooked) return;
    const O = window.Orchard;
    if (!O || typeof O.on !== "function") return;
    hooked = true;
    const sub = (n, fn) => O.on(n, (p) => { try { fn(p && typeof p === "object" ? p : {}); } catch (e) { if (window.console) console.error(e); } });
    sub("hud", onHud);
    sub("event", onEvent);
    sub("demo", onDemo);
    sub("win", () => resetMood(0.4));
    sub("lose", () => resetMood(0.9));
    sub("zenComplete", () => resetMood(0.4));
    verify();
  }

  function applyVolumes() {
    if (!N) return;
    const t0 = ctx.currentTime, set = (n, v) => n.gain.setTargetAtTime(v, t0, 0.03);
    set(N.master, vol.master);
    set(N.sfxDry, vol.sfx); set(N.sfxWet, vol.sfx);
    set(N.musDry, vol.music * 0.85); set(N.musWet, vol.music * 0.85);
  }

  const style = () => STYLES[scaleKey] || STYLES.menu;
  function sroot() {
    let r = style().root;
    while (r < 60) r += 12;
    while (r > 71) r -= 12;
    return r;
  }
  function pen(i, base) {
    const p = style().penta, n = p.length;
    return base + p[((i % n) + n) % n] + 12 * Math.floor(i / n);
  }
  const md = (d) => sroot() + style().mode[d % 7] + 12 * Math.floor(d / 7);
  const P = (send, pan, fn) => pl(SX, send, pan, fn);

  const SFX = {
    launch(q) {
      const p = clamp(num(q.power, 0.6), 0.05, 1);
      P(0.2, rnd(-0.1, 0.1), (o) => {
        const t = now();
        nz(o, { t, ft: "bandpass", q: 1.4, f: 350, f2: 900 + 2600 * p, a: 0.03 + 0.05 * p, v: 0.06 + 0.16 * p, d: 0.18 + 0.35 * p });
        nz(o, { t, ft: "highpass", q: 0.7, f: 3000, f2: 6000, a: 0.01, v: 0.03 + 0.05 * p, d: 0.12 + 0.2 * p });
        part(o, { t, f: 150 * pj(), f2: 90, a: 0.003, v: 0.12, d: 0.15 });
      });
    },
    plant(q) {
      const i = clamp(Math.floor(num(q.count, 1)) - 1, 0, 14), r = sroot();
      P(0.35, rnd(-0.15, 0.15), (o) => {
        const t = now(), f = mtof(pen(i, r)) * pj();
        fm(o, { t, f, v: 0.3, d: 1.1, r: 3, i: 1.3, md: 0.08 });
        bellP(o, t + 0.05, f * 2, 0.06, 1.4);
        fm(o, { t: t + 0.09, f: mtof(pen(i + 2, r)), v: 0.12, d: 0.9, r: 3, i: 0.8, md: 0.06 });
        part(o, { t, f: 180, f2: 120, a: 0.002, v: 0.08, d: 0.12 });
      });
    },
    pollen(q) {
      const i = clamp(Math.floor(num(q.k, 0)), 0, 14), r = sroot() + 12;
      P(0.45, rnd(-0.3, 0.3), (o) => {
        const t = now(), f = mtof(pen(i, r)) * pj();
        bellP(o, t, f, 0.15, 1.2);
        bellP(o, t + 0.04, f * 1.5, 0.05, 0.8);
        part(o, { t: t + 0.02, f: f * 4, a: 0.001, v: 0.03, d: 0.08 });
        part(o, { t: t + 0.06, f: f * 4.5, a: 0.001, v: 0.02, d: 0.08 });
      });
    },
    star(q) {
      const n = clamp(Math.floor(num(q.n, 1)), 1, 3);
      P(0.4, (n - 2) * 0.3, (o) => {
        const t = now(), f = mtof(md(2 * (n - 1)) + 12);
        fm(o, { t, f, v: 0.2, d: 0.55, r: 1, i: 2.2, md: 0.25, a: 0.008 });
        bellP(o, t, f * 2, 0.06, 0.9);
        if (n === 3) {
          fm(o, { t: t + 0.02, f: mtof(md(0) + 12), v: 0.09, d: 0.9, r: 1, i: 1.5, md: 0.3 });
          fm(o, { t: t + 0.03, f: mtof(md(4)), v: 0.08, d: 0.9, r: 1, i: 1.5, md: 0.3 });
          nz(o, { t, ft: "highpass", f: 5000, f2: 9000, a: 0.05, v: 0.04, d: 0.4 });
        }
      });
    },
    golden() {
      const r = sroot() + 12;
      P(0.55, 0, (o) => {
        const t = now();
        for (let i = 0; i < 10; i++) bellP(o, t + i * 0.045 + rnd(0, 0.006), mtof(pen(i, r)), 0.09 - i * 0.004, 1);
        const f = mtof(pen(10, r));
        part(o, { t, f, a: 0.3, v: 0.035, d: 1.4 });
        part(o, { t, f: f * 1.004, a: 0.3, v: 0.035, d: 1.4 });
        nz(o, { t, ft: "highpass", f: 6000, a: 0.2, v: 0.03, d: 0.8 });
      });
    },
    win(q) {
      const s = clamp(Math.floor(num(q.stars, 1)), 0, 3);
      P(0.45, 0, (o) => {
        const t = now(), seq = [0, 2, 4, 7];
        seq.forEach((d, j) => fm(o, { t: t + j * 0.09, f: mtof(md(d)), v: 0.16, d: 0.9, r: 5.4, i: 1, md: 0.08 }));
        const e = t + 0.4;
        for (const d of [0, 2, 4]) bellP(o, e, mtof(md(d) + 12), 0.05, 1.8);
        if (s >= 3) for (let j = 0; j < 4; j++) part(o, { t: e + 0.1 + j * 0.06, f: mtof(pen(j + 5, sroot() + 24)), a: 0.001, v: 0.03, d: 0.25 });
      });
    },
    lose() {
      P(0.45, 0, (o) => {
        const t = now(), r = sroot();
        [7, 3, 0].forEach((d, j) => fm(o, { t: t + j * 0.18, f: mtof(r + d - (j === 2 ? 12 : 0)), v: 0.12, d: j === 2 ? 1.1 : 0.5, r: 1, i: 0.6, md: 0.2, a: 0.02 }));
      });
    },
    bounce() {
      P(0.25, rnd(-0.2, 0.2), (o) => {
        const t = now(), f = 2200 * pj();
        part(o, { t, f, f2: f * 1.08, a: 0.001, v: 0.16, d: 0.12 });
        part(o, { t, type: "triangle", f: f * 1.5, a: 0.001, v: 0.05, d: 0.06 });
        nz(o, { t, ft: "highpass", f: 7000, a: 0.001, v: 0.05, d: 0.02 });
      });
    },
    warp() {
      P(0.5, 0, (o) => {
        const t = now();
        nz(o, { t, ft: "bandpass", q: 5, f: 300, f2: 2400, a: 0.12, v: 0.18, d: 0.4 });
        nz(o, { t, ft: "bandpass", q: 5, f: 2400, f2: 300, a: 0.12, v: 0.14, d: 0.4 });
        part(o, { t, f: 260, f2: 1040, a: 0.05, v: 0.07, d: 0.45 });
        part(o, { t, f: 263, f2: 1052, a: 0.05, v: 0.06, d: 0.45 });
      });
    },
    boost() {
      P(0.2, 0, (o) => {
        const t = now(), lp = flt(o, { ft: "lowpass", f: 400, f2: 4000, t, dur: 0.25, q: 6 });
        part(o, { t, type: "sawtooth", f: 150 * pj(), f2: 700, a: 0.005, v: 0.16, d: 0.25, to: lp });
        part(o, { t, f: 300, f2: 1200, a: 0.005, v: 0.1, d: 0.22 });
      });
    },
    shield() {
      P(0.3, rnd(-0.2, 0.2), (o) => {
        const t = now();
        part(o, { t, f: 150, f2: 70, a: 0.002, v: 0.22, d: 0.18 });
        nz(o, { t, ft: "lowpass", f: 500, a: 0.002, v: 0.15, d: 0.08 });
        nz(o, { t: t + 0.015, ft: "highpass", f: 5000, q: 0.7, a: 0.001, v: 0.1, d: 0.05 });
        for (const r of [1, 1.47, 2.13]) part(o, { t: t + 0.01, f: 2400 * r * pj(), a: 0.001, v: 0.05, d: 0.25 });
      });
    },
    swallow() {
      P(0.6, 0, (o) => {
        const t = now();
        part(o, { t, f: 110, f2: 26, slide: 1.4, a: 0.02, v: 0.3, d: 1.8 });
        part(o, { t, type: "triangle", f: 220, f2: 40, slide: 1.2, a: 0.02, v: 0.06, d: 1.2 });
        nz(o, { t, ft: "lowpass", f: 300, f2: 60, a: 0.1, v: 0.12, d: 1.6 });
      });
    },
    burn() {
      P(0.15, rnd(-0.2, 0.2), (o) => {
        const t = now();
        nz(o, { t, buf: crackBuf, ft: "bandpass", f: 2500 * pj(), q: 0.8, a: 0.005, v: 0.7, d: 0.7 });
        nz(o, { t, ft: "lowpass", f: 1200, f2: 300, a: 0.03, v: 0.12, d: 0.6 });
      });
    },
    crash() {
      P(0.15, rnd(-0.2, 0.2), (o) => {
        const t = now();
        part(o, { t, f: 120 * pj(), f2: 48, a: 0.002, v: 0.22, d: 0.3 });
        nz(o, { t, ft: "lowpass", f: 700, f2: 150, a: 0.002, v: 0.15, d: 0.2 });
      });
    },
    lost() {
      P(0.5, 0, (o) => {
        const t = now(), f = 520 * pj();
        part(o, { t, type: "triangle", f, f2: 190, slide: 0.8, a: 0.04, v: 0.1, d: 0.8 });
        part(o, { t, f: f * 1.006, f2: 195, slide: 0.8, a: 0.04, v: 0.05, d: 0.8 });
        nz(o, { t, ft: "bandpass", q: 1.5, f: 1200, f2: 500, a: 0.15, v: 0.04, d: 0.6 });
      });
    },
    aim() {
      P(0, 0, (o) => part(o, { t: now(), f: 3200 * pj(), a: 0.001, v: 0.02, d: 0.015 }));
    },
    click() {
      P(0.05, 0, (o) => {
        const t = now(), f = 1100 * pj();
        part(o, { t, f, f2: f * 0.64, slide: 0.03, a: 0.001, v: 0.09, d: 0.05 });
        part(o, { t, type: "triangle", f: f * 2, a: 0.001, v: 0.03, d: 0.02 });
      });
    },
    hover() {
      P(0, 0, (o) => part(o, { t: now(), f: 1600 * pj(), a: 0.002, v: 0.035, d: 0.04 }));
    },
    open() {
      P(0.25, 0, (o) => {
        const t = now(), m = sroot() + 12;
        fm(o, { t, f: mtof(m), v: 0.1, d: 0.25, r: 3, i: 0.8, md: 0.05 });
        fm(o, { t: t + 0.06, f: mtof(m + 7), v: 0.1, d: 0.3, r: 3, i: 0.8, md: 0.05 });
        nz(o, { t, ft: "bandpass", f: 800, f2: 2400, a: 0.03, v: 0.03, d: 0.15 });
      });
    },
    close() {
      P(0.25, 0, (o) => {
        const t = now(), m = sroot() + 12;
        fm(o, { t, f: mtof(m + 7), v: 0.09, d: 0.22, r: 3, i: 0.8, md: 0.05 });
        fm(o, { t: t + 0.06, f: mtof(m), v: 0.09, d: 0.28, r: 3, i: 0.8, md: 0.05 });
        nz(o, { t, ft: "bandpass", f: 2400, f2: 800, a: 0.03, v: 0.03, d: 0.15 });
      });
    },
    tick() {
      P(0, 0, (o) => {
        const t = now();
        part(o, { t, f: 2000 * pj(), a: 0.001, v: 0.05, d: 0.02 });
        nz(o, { t, ft: "bandpass", f: 4000, q: 4, a: 0.001, v: 0.03, d: 0.015 });
      });
    },
    unlock() {
      P(0.5, 0, (o) => {
        const t = now();
        [0, 2, 4].forEach((d, j) => bellP(o, t + j * 0.08, mtof(md(d) + 12), 0.1, 1.4));
        bellP(o, t + 0.26, mtof(md(7) + 12), 0.08, 2);
        nz(o, { t: t + 0.16, ft: "highpass", f: 6000, a: 0.1, v: 0.03, d: 0.5 });
      });
    },
    near() {
      P(0.55, rnd(-0.25, 0.25), (o) => {
        const t = now(), f = mtof(md(4) + 12), g = mtof(md(3) + 12);
        nz(o, { t, ft: "bandpass", q: 2.5, f: 900, f2: 2600, slide: 0.24, a: 0.22, v: 0.05, d: 0.08 });
        bellP(o, t + 0.2, f, 0.045, 0.9);
        part(o, { t: t + 0.24, f: g, f2: g * 0.985, slide: 0.5, a: 0.02, v: 0.05, d: 0.6 });
      });
    },
    bloom() {
      P(0.6, 0, (o) => {
        const t = now() + 0.1, r = sroot();
        nz(o, { t, ft: "bandpass", q: 2, f: 500, f2: 5000, slide: 0.9, a: 0.7, v: 0.04, d: 0.35 });
        let at = t;
        for (let j = 0; j < 8; j++) { bellP(o, at, mtof(pen(j, r)), 0.04 + j * 0.004, 1.1); at += 0.085 - j * 0.006; }
        fm(o, { t: at, f: mtof(r + 12), v: 0.07, d: 1.4, r: 2, i: 0.6, md: 0.3, a: 0.02 });
      });
    },
    oracle() {
      P(0.75, 0, (o) => {
        const t = now();
        [0, 4, 7].forEach((d, j) => bellP(o, t + j * 0.14, mtof(md(d) + 12), 0.05, 2.2));
        nz(o, { t, ft: "highpass", f: 5000, a: 0.4, v: 0.02, d: 0.9 });
      });
    },
    ffon() {
      P(0.15, 0, (o) => {
        const t = now(), r = sroot();
        part(o, { t, type: "triangle", f: mtof(r - 12), f2: mtof(r + 12), slide: 0.16, a: 0.01, v: 0.035, d: 0.16 });
        nz(o, { t, ft: "highpass", f: 3000, f2: 7000, slide: 0.12, a: 0.06, v: 0.012, d: 0.08 });
      });
    },
    ffoff() {
      P(0.15, 0, (o) => {
        const r = sroot();
        part(o, { t: now(), type: "triangle", f: mtof(r + 7), f2: mtof(r - 12), slide: 0.2, a: 0.01, v: 0.03, d: 0.2 });
      });
    },
    achievement() {
      P(0.55, 0, (o) => {
        const t = now();
        for (const d of [0, 2, 4]) fm(o, { t, f: mtof(md(d)), v: 0.08, d: 1.2, r: 1, i: 1.2, md: 0.3, a: 0.01 });
        for (let j = 0; j < 5; j++) bellP(o, t + 0.08 + j * 0.06, mtof(pen(j + 3, sroot() + 12)), 0.07, 1.2);
        bellP(o, t + 0.4, mtof(md(7) + 12), 0.07, 2);
      });
    },
  };

  function unlockCtx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      try { ctx = new AC({ latencyHint: "interactive" }); } catch (e) {
        try { ctx = new AC(); } catch (e2) { ctx = null; return false; }
      }
      build();
      applyMood(0.05);
      const s = ctx.createBufferSource();
      s.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      s.connect(ctx.destination); s.start(0);
    }
    if (ctx.state !== "running" && !document.hidden) {
      hidSusp = false;
      const p = ctx.resume();
      if (p && p.then) p.then(resync, () => {});
    }
    applyMusic();
    hook();
    return true;
  }

  document.addEventListener("visibilitychange", () => {
    if (!ctx) return;
    if (document.hidden) {
      if (timer) { clearTimeout(timer); timer = null; }
      if (ctx.state === "running") { hidSusp = true; ctx.suspend(); }
    } else if (hidSusp) {
      hidSusp = false;
      ctx.resume().then(resync, () => {});
    } else resync();
  });

  const api = window.OrchardAudio = {
    unlock: unlockCtx,
    sfx(name, opts) {
      if (!ctx || typeof name !== "string" || !Object.prototype.hasOwnProperty.call(SFX, name)) return;
      const t = ctx.currentTime, gap = GAP[name] || 0.025;
      if (lastHit[name] != null && t - lastHit[name] < gap) return;
      lastHit[name] = t;
      try { SFX[name](opts && typeof opts === "object" ? opts : {}); } catch (e) { if (window.console) console.error(e); }
    },
    music(key) {
      const k = normKey(key);
      if (k === undefined) return;
      want = k;
      if (k != null) scaleKey = k;
      hook();
      if (k == null || k === "menu") resetMood(0.6);
      applyMusic();
    },
    setVolumes(v) {
      if (!v || typeof v !== "object") return;
      for (const k of ["master", "music", "sfx"]) if (typeof v[k] === "number" && isFinite(v[k])) vol[k] = clamp(v[k], 0, 1);
      applyVolumes();
    },
    getVolumes() { return { master: vol.master, music: vol.music, sfx: vol.sfx }; },
    setMuted(b) {
      muted = !!b;
      if (N) {
        const t0 = ctx.currentTime;
        N.mute.gain.cancelScheduledValues(t0);
        N.mute.gain.setTargetAtTime(muted ? 0 : 1, t0, 0.04);
      }
    },
    isMuted() { return muted; },
    onBeat(fn) {
      if (typeof fn !== "function") return () => {};
      beatFns.push(fn);
      return () => { const i = beatFns.indexOf(fn); if (i >= 0) beatFns.splice(i, 1); };
    },
    isUnlocked() { return !!ctx && ctx.state === "running"; },
    currentMusic() { return want; },
    _mood() {
      const v = (n, p) => (n ? Math.round(n[p].value * 1000) / 1000 : null);
      return {
        hooked, tension: mood.tenT, demo: G.demo, fast: G.fast, tempo: mood.tempo, thin: mood.thin, probing: !!PR.id, armed: PR.arm,
        lp: v(N && N.musLp, "frequency"), musMood: v(N && N.musMood, "gain"), sfxMood: v(N && N.sfxMood, "gain"), layer: v(N && N.layDry, "gain"),
        active: { sfx: active.sfx, music: active.music }, trace: trace.slice(),
      };
    },
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", hook);
  else setTimeout(hook, 0);
})();
