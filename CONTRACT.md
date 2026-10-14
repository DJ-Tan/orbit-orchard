# Orbit Orchard v2 — build contract

Orbit Orchard is a browser game. The player slings seeds from a launcher through gravity wells, and must plant
a seed on every **fertile** planet in a level. v1 (a single file, 12 levels) is in `docs/v1-orbit-orchard.html`:
read it for the feel, the palette, and the drawing style. v2 has 5 themed worlds of 22 levels each (110 levels),
new mechanics, a full menu system with tabs, pages and pop-ups, per-world themes, user skins, generative music,
and much more "juice".

Several agents build v2 at the same time. **Only touch the files you own.** If you need something from another
owner's file, code against the API in this document and note what you assumed in your final report.

## Files and owners

| Path | Owner | What |
|---|---|---|
| `js/sim.js` | lead (done, read-only) | Deterministic physics shared by game and solver. `window.OrchardSim` in browser, `module.exports` in node. |
| `tools/solve.js` | lead (done, read-only) | Level validator + brute-force solver. |
| `js/levels/w1.js` … `w5.js` | level agents, one each | World definitions (theme + 22 levels). The file name, world `id` and level ids are stable keys, not the display position: `w3.js` (Fold Nebula, id 3, `w3-NN`) is shown as World 4 and `w4.js` (Clockwork Orrery, id 4, `w4-NN`) as World 3. |
| `js/audio.js` | audio agent | `window.OrchardAudio`: SFX + generative music, WebAudio only. |
| `js/game.js` | engine agent | `window.Orchard`: canvas renderer, input, gameplay loop, visual effects, Zen/Daily generator. |
| `orbit-orchard.html`, `js/ui.js` (plus optional `css/ui.css`) | UI agent | Page shell, all menus/tabs/pages/pop-ups, HUD, progression, saving, achievements, settings. |

Script load order in `orbit-orchard.html` (plain `<script src>`, no modules, no bundler):
`js/sim.js`, `js/levels/w1.js`, `w2.js`, `w4.js`, `w3.js`, `w5.js` (display order), `js/audio.js`, `js/game.js`, `js/ui.js`. `ui.js` boots
everything and sorts worlds by `order` itself, so load order is cosmetic.

## Platform rules (hard)

- The page is published as a claude.ai Artifact. `orbit-orchard.html` is an HTML **fragment**: no `<!doctype>`,
  `<html>`, `<head>`, `<body>` tags. Start with `<title>Orbit Orchard</title>`, then `<link>`/`<style>`, markup, scripts.
  It gets wrapped with a charset + viewport meta at publish time.
- Only external resources allowed: Google Fonts stylesheets/fonts, and scripts from cdnjs.cloudflare.com /
  cdn.jsdelivr.net/npm. No images/audio/fetch from other hosts. Generate art in canvas/SVG/CSS, sound in WebAudio.
  Prefer zero libraries.
- `alert/confirm/prompt` never show: build confirmations as in-page modals. Downloads and `window.print` are blocked.
  Clipboard write must be called inside a click handler and its rejection caught.
- `localStorage` may throw or be empty: wrap every access in try/catch; the game must work without it.
- Must work at phone width (≥ 360px) with touch, and at desktop with mouse + keyboard. No horizontal page scroll.
- Respect `prefers-reduced-motion` (and the in-game Reduced motion setting).
- Audio may only start after a user gesture (`OrchardAudio.unlock()` on first pointerdown/keydown).
- `js/sim.js` and `js/levels/*.js` must run in **node 10** (no `?.`, no `??`). Browser-only files may use modern JS
  (the browser target is current Chrome/Firefox/Safari).
- **Comment style** (user rule): minimal comments that say what code does, never why; no comment blocks, no banners,
  no multi-line explanations, no cross-references to files/lines. One-line docstrings at most.

Local preview: the fragment renders in quirks mode if opened raw. To look at it, wrap it:
`(echo '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>'; cat orbit-orchard.html; echo '</body></html>') > dev/preview.html`
Headless screenshot: `firefox --headless --screenshot dev/shot.png --window-size=1280,800 file://$PWD/dev/preview.html`
(Firefox is at /usr/bin/firefox. Use screenshots sparingly.) `dev/` is scratch and is not published.

## World coordinates and physics (`js/sim.js`)

World is 1600 × 1000 units, y down. Time in seconds. Fixed step `DT = 1/120`. Seed radius 6. Launch speed =
`power × 820` (power 0.05–1). A flight ends after 14 s or 400 units outside the world.

Gravity from every body: `a = massOf(b) / (d² + 400)` toward the body; `massOf = r² × dens`, with default dens
`fertile 1400, barren 1500, sun 3600, ice 1100, blackhole 40000, repulsor -2200` (negative pushes away). A body
may override `dens`.

API: `OrchardSim.{WORLD, DT, MAX_SPEED, SEED_R, PORTAL_R(26), BOOST_R(24), POLLEN_R(20), SHIELD_PAD(20), DENS,
TERMINAL, massOf, bodyPos(bodies,i,T), positions(bodies,T), shieldRadius(b), shieldOpen(b,ang,T),
shieldGapCenter(b,T), wrapAngle, newSeed(lv,ang,pow), stepSeed(lv,seed,T,dt,pollenGot), simulateShot(lv,ang,pow,T0,maxT,pollenGot)}`.

`stepSeed` advances one step and returns `null` or one event:

| event | terminal | meaning |
|---|---|---|
| `plant {i, ang, x, y}` | yes | hit fertile body `i`; `ang` = surface angle (radians) where the plant grows |
| `crash {i,…}` | yes | hit barren or repulsor |
| `burn {i,…}` | yes | hit a sun |
| `swallow {i,…}` | yes | fell into a black hole |
| `shield {i, ang, x, y}` | yes | hit the closed part of body `i`'s shield arc |
| `lost {x,y}` | yes | flew away / timed out |
| `bounce {i,x,y}` | no | glanced off ice |
| `warp {k, from, to}` | no | went through portal pair `k` |
| `boost {k,x,y}` | no | passed boost gate `k` |
| `pollen {k,x,y}` | no | touched pollen `k` (caller marks `pollenGot[k] = true`) |

Level time `T` runs continuously while a level is on screen (orbits and shields keep moving while the player
aims). The trajectory preview simulates from the current `T`.

## Level schema (`js/levels/wN.js`)

```js
window.ORCHARD_WORLDS = window.ORCHARD_WORLDS || [];
window.ORCHARD_WORLDS.push({
  id: 1, name: "Meadow Belt", blurb: "one or two sentences shown on the world card",
  order: 1,                   // display position (World N); defaults to id. Only w3.js (4) and w4.js (3) set it
  theme: { /* copy exactly from the World themes table below */ },
  levels: [
    {
      id: "w1-01",            // wN-NN, unique; N is the file/world id, not the display position
      name: "First Sprout",   // 1–3 words, evocative, unique across the game
      hint: "One or two plain sentences that teach or tease this level.",
      seeds: 6,               // seeds available = stars[1] + 1
      par: 1,                 // = sum of `need` over fertile bodies (minimum possible seeds)
      stars: [4, 5],          // most seeds used for 3 stars, for 2 stars
      preview: 1.6,           // seconds of trajectory preview (0.3 – 1.8)
      launch: [220, 560],
      bodies: [
        { kind: "fertile", x: 1150, y: 480, r: 80 },
        { kind: "fertile", x: 900, y: 300, r: 60, need: 2 },                      // wants 2 seeds
        { kind: "barren", x: 780, y: 500, r: 110 },
        { kind: "sun", x: 800, y: 450, r: 75, dens: 3000 },
        { kind: "ice", x: 650, y: 820, r: 90 },
        { kind: "blackhole", x: 700, y: 300, r: 22 },                             // tiny radius, huge pull
        { kind: "repulsor", x: 700, y: 800, r: 40 },                              // pushes seeds away
        { kind: "fertile", r: 38, orbit: { p: 0, R: 230, w: 0.6, ph: 0 } },       // orbits body 0 (p must be an EARLIER index)
        { kind: "sun", r: 45, orbit: { cx: 800, cy: 500, R: 110, w: 0.7, ph: 0 } }, // orbits a fixed point
        { kind: "fertile", x: 1300, y: 500, r: 60, shield: { gap: 1.2, w: 0.8, ph: 3.14 } }
          // shield: arc at r+20 that blocks seeds except a gap of `gap` radians centered at angle ph + w*T
      ],
      portals: [{ a: [420, 330], b: [1130, 330] }],       // two-way, keeps velocity
      winds:   [{ x: 500, y: 0, w: 200, h: 1000, ax: 0, ay: 60 }],  // rectangle adds constant acceleration
      boosts:  [{ x: 450, y: 500, mult: 1.4 }, { x: 900, y: 200, mult: 1.0, ang: 1.57 }], // speed × mult; optional ang re-aims (radians)
      pollen:  [[800, 500], [1300, 150]]                  // optional collectibles (0–3), each must be reachable
    }
  ]
});
```

World `id` and level ids are save keys (`levels`, `fails`, `announced`, `world-<id>` trophies, `badge:<id>`, `oracle:<levelId>`,
music and theme lookups), so they never change when worlds are reordered; only `order` and the player-facing "World N" labels do.

Angles: radians, 0 = +x (right), π/2 = down. Keep all bodies inside x∈[20,1580], y∈[20,980] at all times.
Keep the top-left 360×90 and the bottom 60 units reasonably free of targets (HUD sits there on small screens).

### Scoring
3 stars: used ≤ stars[0]. 2 stars: used ≤ stars[1]. 1 star: cleared. The leeway over par shrinks across each world:

| plots | 3 stars | 2 stars | seeds |
|---|---|---|---|
| 1–7 | par + 3 | par + 4 | par + 5 |
| 8–15 | par + 2 | par + 3 | par + 4 |
| 16–22 | par + 1 | par + 2 | par + 3 |

Generated skies use the same slack by difficulty: 1–2 like plots 1–7, 3 (the Daily Sky) like 8–15, 4–5 like 16–22. A sky of
difficulty d only uses mechanics from display worlds 1..d: ice and static shields from 2, orbits and turning shields from 3, folds,
winds and boost gates from 4, black holes and repulsors at 5.
Saves upgrade on load: a cleared plot's stars are recomputed from its best seed count and only ever go up. Collecting every pollen in a level is a separate
"golden" badge (pollen persists across seeds within one attempt).

### World themes (copy the `theme` object verbatim into your world file)

Keyed by world id. Display order is 1, 2, 4, 3, 5 (Clockwork Orrery is World 3, Fold Nebula World 4).

| id | name | theme object |
|---|---|---|
| 1 | Meadow Belt | `{ ambience: "fireflies", flora: "daisy", bg: ["#1f2350", "#2b1f4f", "#0e1128"], nebula: "#ff9ec4", accent: "#8fc79a", glow: "#ffd9a8" }` |
| 2 | Frost Reach | `{ ambience: "aurora", flora: "fern", bg: ["#0f2e40", "#0f2440", "#06121d"], nebula: "#7ef0d8", accent: "#bfe6f0", glow: "#d8fff6" }` |
| 3 | Fold Nebula | `{ ambience: "nebula", flora: "spiral", bg: ["#2c1046", "#3a1352", "#12071f"], nebula: "#c77dff", accent: "#a99be6", glow: "#f0c6ff" }` |
| 4 | Clockwork Orrery | `{ ambience: "clockwork", flora: "sunflower", bg: ["#221d33", "#2e2438", "#0d0b16"], nebula: "#f3c677", accent: "#f3d67a", glow: "#ffe7b0" }` |
| 5 | Event Horizon | `{ ambience: "horizon", flora: "ember", bg: ["#1c0d12", "#2a0f16", "#060305"], nebula: "#ff7a45", accent: "#ff9e6b", glow: "#ffd0a8" }` |

### Mechanics per world (introduce one idea at a time; later worlds may reuse earlier mechanics)

In display order:

1. **Meadow Belt** (`w1.js`) — fertile, barren, sun, multi-need soil. Pollen appears from w1-08. Gentle start.
2. **Frost Reach** (`w2.js`) — ice bank shots, bounce chains, static shields (`w: 0`), pollen.
3. **Clockwork Orrery** (`w4.js`) — orbits (moons, binaries, nested moons of moons), rotating shields, timing puzzles. Uses
   only World 1–2 mechanics plus moving parts: no portals, winds or boost gates.
4. **Fold Nebula** (`w3.js`) — portals, wind zones, boost gates (including re-aiming gates with `ang`). May reuse orbits; today
   it has none.
5. **Event Horizon** (`w5.js`) — black holes, repulsors, then everything combined. Hardest. w5-22 is the grand finale.

Level 22 of each world is a showpiece "boss" plot. Seeds and star targets follow the scoring table.
Preview: long (1.4–1.8) early, shorter (0.6–1.0) late; a few "short sight" levels at 0.3–0.5 are fun.

## Engine API (`js/game.js` → `window.Orchard`)

```js
Orchard.init(canvas)                        // attach to a full-window canvas; starts the render loop
Orchard.setViewInsets({ top, right, bottom, left })  // CSS px covered by DOM HUD; fit the world into the rest
Orchard.showcase(world | null)              // attract mode behind menus: world ambience + a self-playing demo (difficulty = world order), no input
Orchard.loadLevel(level, { world, mode })   // mode: "journey" | "zen" | "daily"; world = the ORCHARD_WORLDS entry (theme)
Orchard.restart()
Orchard.setPaused(bool); Orchard.isPaused()
Orchard.setInputEnabled(bool)               // UI disables gameplay input while any overlay is open
Orchard.setSettings(partial)                // { skin, grid, shake, reducedMotion, assist, colorblind, fastForward }
Orchard.generateLevel(seed, opts)           // procedural valid level for Zen/Daily; opts { difficulty: 1..5 }
Orchard.getState()                          // { mode, levelId, seedsLeft, seeds, used, par, pollenGot, pollenTotal, sown, needTotal, flying }
Orchard.on(name, fn); Orchard.off(name, fn)
```

Events emitted (`fn(payload)`):

- `hud` — whenever any HUD value changes: `{ seedsLeft, seeds, used, par, pollenGot, pollenTotal, sown, needTotal, aimDeg, power, fast, flying }` (`seeds` may be `Infinity` in Zen)
- `launch` — `{ used }`
- `event` — every sim event with its payload plus `{ type }` (plant, crash, burn, swallow, shield, lost, bounce, warp, boost, pollen)
- `toast` — `{ text, tone: "good" | "bad" | "info" }` short flavor lines (e.g. "Scorched", "Soil sated")
- `win` — `{ levelId, used, par, stars, pollenGot, pollenTotal, time, plants: [{ flora, color }] }` fired after the celebration (~1.5 s)
- `lose` — `{ levelId, sown, needTotal, used }`
- `zenComplete` — `{ seed, used }` (Zen/Daily do not fire `win`; Daily fires `win` with `levelId: "daily-YYYYMMDD"`)
- `settings` — `{ grid }` when the player toggles something from the keyboard

Keys the engine handles (only while input is enabled and a level is active): ←/→ aim, ↑/↓ power, Shift = fine,
Space/Enter sow, F hold = 3× speed, G gravity lattice, R restart. Pointer drag anywhere on the canvas = slingshot.
The UI handles Esc/P (pause), N (next after a win), M (mute), and all menu navigation.

Skins (`settings.skin`), applied by both engine (canvas) and UI (CSS via `data-skin` on `<html>`):
`nocturne` (default, v1 risograph night), `daylight` (light paper + ink), `synthwave` (neon on black, glow),
`inkwell` (monochrome high contrast, hatching). The world theme sets hue/ambience; the skin sets render style.

## Phone layout

Tall viewports render the world rotated, as a view transform only. Physics, level data, solutions, demos and guides stay in
world coordinates.

- **When**: the engine compares the fit scale of the 1600×1000 field with the rotated 1000×1600 field inside the area left
  by `setViewInsets` (the whole screen in showcase). It rotates when the rotated fit is at least 12% larger and switches
  back below 4% (hysteresis). This covers portrait phones and very tall desktop windows. It re-decides on every resize,
  inset change and level load. A switch mid-flight is safe, and it drops any drag in progress.
- **Direction**: 90° counter-clockwise (world left → screen bottom, seeds fly up), or clockwise when the launcher is in the
  right 40% of the world (`launch[0] > 960`), so a side launcher always sits at the bottom. Mid and top/bottom launchers use
  counter-clockwise.
- **Engine**: `S.view = { s, ox, oy, a, b, c, d, th }`, where screen = `(ox, oy) + s·[a c; b d]·world` and `th` is the
  view angle (0, -π/2 or π/2). Drawing goes through `worldXf()`, `toScreen`, `toWorld` and `scrOff` (offset a world point by
  screen-aligned amounts). Labels drawn in the world (guide numbers, countdowns, the fast-forward cue), end markers, body
  shading, the launcher body and confetti/ember "gravity" are screen-aligned. Shields, winds, boosts, portals, plants and
  the aim are world-aligned. Background, ambience and stars are screen-space, so they always fill the viewport.
- **Input**: a pointer drag maps the screen pull vector through the inverse rotation, so the seed flies the way the player
  dragged on screen. Cancel zone and tap-to-fast-forward are screen-space and unchanged. ←/→ still rotate the aim
  counter-clockwise/clockwise as seen on screen (rotation keeps handedness), which in portrait means ← swings the aim left.
- **API**: `getState().rotated` is `0`, `1` (counter-clockwise) or `-1`. The engine emits `view { rotated, rot }` when it
  changes. The `hud` payload's `aimDeg` is measured on screen (90° = straight up), so it matches what the player sees.
  `Orchard._debug.toScreen/toWorld` are there for harnesses.
- **UI**: at ≤ 720 px a compact aim/power pill shows at the bottom (centred in portrait, bottom-right in landscape), and
  `measureHud` reserves a 34 px bottom inset in portrait for it. At ≤ 480 px portrait the HUD is a fixed two-row grid:
  name and pods on the left, buttons on top right, stats beneath them.

## Fold Nebula walls

`prepLevel` groups static barren rocks (no orbit or shield, r ≤ 80) whose surfaces are at most `2·SEED_R + 3` apart. The
gap is too narrow for a seed, so the chain is solid. Groups of 3 or more become `lv.walls`, and each member gets
`b.wall`. A wall draws as one union of discs and bridges, with a faint per-rock seam and craters, an outline and shading
per skin, a cross-hatch in colorblind mode, and per-rock crash flashes. Behind it sits a soft halo that reaches
`sqrt(mean mass / 280)` units, about where one rock's pull drops to 280 u/s², so denser walls get wider halos. Detection
is geometric, not by level id, and today it matches only Fold Nebula (`w3.js`, World 4). Physics is unchanged.

## Audio API (`js/audio.js` → `window.OrchardAudio`)

```js
OrchardAudio.unlock()                       // create/resume AudioContext; safe to call repeatedly
OrchardAudio.sfx(name, opts)                // see names below; unknown names are ignored
OrchardAudio.music(key)                     // "menu" | 1..5 (world id) | "zen" | null (fade out); crossfades
OrchardAudio.setVolumes({ master, sfx, music }); OrchardAudio.getVolumes()   // 0..1
OrchardAudio.setMuted(bool); OrchardAudio.isMuted()
OrchardAudio.onBeat(fn)                     // optional: called on each music beat with { beat, bar } (for UI pulses)
```

SFX names: `launch {power}`, `plant {count}`, `crash`, `burn`, `swallow`, `shield`, `lost`, `bounce`, `warp`,
`boost`, `pollen {k}`, `win {stars}`, `lose`, `star {n}` (result stars popping 1..3), `click`, `hover`, `open`,
`close`, `unlock`, `achievement`, `tick`, `aim` (very soft, throttled by caller), `golden`.

The engine calls gameplay SFX (`launch`…`pollen`, `aim`); the UI calls menu SFX and `star`, `win`, `lose`,
`achievement`, `unlock`, `golden`.

## UI (`orbit-orchard.html`, `js/ui.js`)

The UI owns boot, every screen, progression and saving. Storage key `orbit-orchard-v2` (JSON). Screens/pages:
title splash, hub with tabs (Journey world map → per-world level page, Daily Sky, Zen Garden, Almanac, Greenhouse,
Trophies, Settings), in-game HUD (fast-forward toggle `#hFast` bound to the synced `fastForward` setting, Replant, Pause), and pop-ups (level intro card, pause, results with animated stars and pollen,
world unlocked, achievement toasts, in-page confirm dialogs, first-run coach marks). Settings includes skins,
volumes and accessibility (reduced motion, shake, colorblind-safe markers, trajectory assist). Players can't unlock every plot or
reset progress; `settings.unlockAll` is honoured only when the test harness sets `window.ORCHARD_DEV`. A world unlocks when 16 levels of the previous world (in display order) are cleared,
or when its id is in `announced`. `announced` (synced as a union) records every world the player ever really unlocked, so worlds
opened under an older order stay open. On the first boot of a save without `sync.wo` (device-local), the UI also marks every world
the old id-order rule (1, 2, 3, 4, 5) had opened, then sets `sync.wo`. Plots inside a world keep their usual gating.

## Cloud save (`js/cloud.js` → `window.OrchardCloud`)

Local-first sync of the save to the viewer's private artifact document `data/users/<id>/save` (capabilities
`db`, `user` with scope `profile`, `downloads`). The browser save stays the source of truth offline; every
local `save()` notifies the sync, which merges and writes once per real change.

Merge rules: stars max, best/time min, golden or, trophies and unlocks union, daily days keep the official run
(earliest `at`; records without `at` lose to timed ones and fall back to the better result, then a canonical tie-break)
plus a `best` of every run on either side, stats and flora are per-device counters summed across devices, wallet ledgers are keyed unions,
synced settings (`skin grid shake reducedMotion colorblind assist unlockAll trail fastForward`) are last-write-wins by
`settingsAt`, volumes stay per device. A progress reset raises `gen`; a higher `gen` wins except the wallet,
which always merges. Tests: `node dev/cloud/test-merge.js`. Browser harness: `dev/cloud/build.sh`,
`dev/cloud/shot.sh name WxH query` with a mock `window.claude` (`remote=other|oldfold`, `local=progress|rich|old`,
`local=fold|foldbare` (pre-swap save midway through Fold Nebula, with or without `announced`), `local=early` (migrated save, `w2=N`
and `w4=N` cleared plots), `act=unlocks` (logs world and Fold plot locks), `adv=N` (engine frames to advance after `flow=demo` starts),
`fresh=1` (no local save), `assist=1`, `locked=1`, `fails=N`, `mock=none`, `fail=invalid`,
`flow=intro|stage|buymodal|demo|done|guides|guidedwin|unguided|gwin|win|lose`, `act=continue|toast|dailywin|replants|ff|world|level|zenwin|fert|import`,
`nolog=1`, `tscale=F` (scales timers), `probe=selector`, `skin=id`, `local=garden` (late-game Greenhouse with purchases; `bare=1` without
them), `local=daily` (today's assisted run with a better replay), `dailywin` with `miss=1` and `again=1|worse`, `zenwin` with `n=` and
`diff=`, `fert` with `plant=` and `buy=1`).

Daily Sky: the first completed run of a day is official. Its day record `{ stars, used, par, pollenGot, pollenTotal, at, assist? }`
sets the streak, the Daily nectar and the share text; replays never change it and only update `best: { stars, used, pollenGot,
assist? }` when they beat it. The share text is an emoji card: stars, one square per seed (par, 3★ slack, 2★ slack, over, unused
from `par + 4` seeds), pollen dots, the live streak and "(assist)" when the official run used the trajectory assist.

## Nectar and the Market (`js/ui.js`)

Balance = sum of `wallet.earn` minus sum of `wallet.spend`; every entry is keyed so it is earned once.
Earn: first clear 10, second star 5, third star 10, golden 10, Perfect 5 (`par:<id>`, cleared in exactly par
seeds without guides), Daily Sky 15/day, trophies by tier: bronze 20, silver 40, gold 80, platinum 150 (Sower pays none; `ach:<id>` holds the first 20 and
`tro:<id>` the rest, so saves from before tiers get topped up), daily visit 10 + 2 per consecutive day
(max 20), plus 50 on every 7th consecutive day (`week:<YYYYMMDD>`), Zen sky 2/3/4/5/6 by difficulty 1–5 for the first 3 completed Zen skies of a day (`zen:<YYYYMMDD>:<1..3>`; two
devices racing for the same slot merge to one, so the cap holds across devices). Rough totals: W1 at three stars about 550
(810 with every golden and Perfect); the whole game 2750 from clears and stars, 520 golden, 550 Perfect and 640 from trophies,
about 4460; after that a regular player makes about 25–55 a day from visits, the Daily Sky and Zen. Level rewards are derived from the level record (`stars`, `golden`, and `best <= par` for Perfect),
so the backfill on load grants anything missing; the Perfect mark on plot nodes and plates reads the wallet key.

Guided clears: an attempt is guided if Oracle guides were on at any point (`Orchard.getState().guides`). A guided
clear records at most 2 stars, never golden, and leaves `best`/`time` untouched, so neither `restar` nor the
backfill can lift it to 3 stars, golden or Perfect. Its win screen says "Guided clear. Sow it without guides for
three stars." and offers "Replant without guides" (also in the pause menu while guides are on). Wins with the
trajectory assist on show an "Assist" tag; a Daily Sky day record sown with assist carries `assist: true` and its
share text adds "(assist)". Assist never caps stars.

Onboarding: the "Your garden makes nectar" welcome only shows when the backfill paid something; a brand-new
player gets a short nectar note on their first rewarded win instead (`coach.nectarTip`). The Oracle row on a
plot's intro card appears once the plot has 2+ fails or replants (fails are saved, replants count per session),
has been cleared, or has an Oracle purchase; the pause menu and out-of-seeds screen always show it. The Journey
"Continue" button starts the next uncleared plot directly. The "Field naturalist" trophy counts only pages seen
in plots really unlocked (or Zen/Daily) or whose world is really unlocked, never via the test-only `unlockAll`. Spend (`worldIndex` is the 0-based display position): Oracle full clear `25 + 10 × worldIndex`, Glimpse (first shot)
`10 + 2 × worldIndex`, spare seed 8 (`Orchard.addSeeds`), frost charm 40 (hold 2, auto-used on a missed
Daily Sky day), seed trails 60–160 (430 in all). Greenhouse and flourish sinks, all drawn by the UI in DOM/SVG/CSS: decorations
`decor:<chime|lanterns|jar|orrery|chart>` 90/140/180/240/320 (970), glazed pots `pot:<bed>` 90 each (810 for 9 beds),
fertilizer `fert:<bed>:<1|2>` `50 + 30 × target stage` (110–200, at most 2 doses a bed, only on a planted bed), the Orchard
banner `banner:orchard` 300 (title screen), constellation badges `badge:<worldId>` `120 + 60 × worldIndex` (1200; each needs
every plot of its world really cleared; shown on the title, the hub header and the world card). Fixed sinks total 3710
with trails, plus fertilizer (at most 370 a bed, 3330 in theory, far less in practice since grown beds take none). Save-file import keeps only known earn amounts and spend prefixes
(`oracle glimpse trail charm seed pot decor banner badge fert`).

Greenhouse: nine beds, each with five stages (Seedling, Sprout, Budding, In bloom, Full bloom). A world bed (its flora) grows
at 1, 6, 12 and all plots cleared in that world, then every star. Milestone beds: Gilded orchid (golden badges 1/5/12/25/45),
Par bonsai (Perfect marks 1/5/15/35/70), Sky ivy (best Daily streak 1/3/7/14/30), Still lotus (Zen skies 1/5/15/40/100).
Stage = natural stage plus fertilizer doses, capped at 5; everything is derived from the save and wallet, nothing new is stored. Solutions come from `js/solutions.js` (`tools/solutions.js`,
`tools/verify-solutions.js`); the engine replays them with `playDemo` and draws them with `setGuides`.

## Friends and challenges (`js/friends.js` → `window.OrchardFriends`, `css/friends.css`)

Hub tab 9 "Friends". `ui.js` hooks: the tab entry and `friends` icon, `renderFriends` in the panel dispatch, `OrchardFriends.notify()`
in `save()`, `OrchardFriends.init(api)` at the end of boot, and `startChallenge({ seed, diff, label, onDone })` which loads
`Orchard.generateLevel(seed, { difficulty })` in mode `"challenge"` (finite seeds, stars, no spare-seed purchase, no Oracle) and
calls `onDone({ used, stars, pollen, pt, time, assist })` on the win. Quitting a challenge returns to the Friends tab.

Storage goes through a small backend object `B` inside friends.js (`connect refs subs loaded down pubIn pubDoc meta resubCards readCard
writeCard delCard ensureCode makeCode findCode readChals pushWire gap anon tx search signIn busy glogo`). `init` fills it with the
claude.ai paths below; when `window.OrchardWeb` and `window.OrchardFriendsWeb` exist (web build only), `js/friends-web.js` replaces
the storage parts with the Firestore layout in "Web build (Firebase)". Pure logic, crypto, pins, safety codes, merge rules and the
whole UI are shared. The friends doc may carry `nm: { on, at }` ("Show my Google name to friends", web only, merged by newest `at`);
it is absent on claude.ai, so claude.ai docs are unchanged.

Capabilities: `db` with the rules below, `downloads`, `user` with `scopes: ["profile"]`. The root rule lets only the owner write outside
the game's paths; `data/users/{self}` keeps each player's own subtree writable at Contributor. Every other `{self}` prefix rule sets read and write;
never add a rule at `data/users`, since it would open players' private subtrees.
The complete declaration:
`{"db":{"rules":[{"path":"","read":"view","write":"owner"},{"path":"data/users/{self}","write":"interact"},{"path":"cards","read":"interact","write":"owner"},{"path":"cards/{self}","write":"interact"},{"path":"codes","read":"interact","write":"owner"},{"path":"codes/{self}","write":"interact"},{"path":"chal","read":"interact","write":"owner"},{"path":"chal/{self}","write":"interact"},{"path":"keys","read":"interact","write":"owner"},{"path":"keys/{self}","write":"interact"}]},"downloads":true,"user":{"scopes":["profile"]}}`

| path | read | write | body |
|---|---|---|---|
| `data/users/<id>/friends` (private, default rule) | self | self | `{ v, f: { <id>: { at, del?, code? } }, share: { on, nectar, at }, code: { c, at } }` |
| `data/users/<id>/keys` (private, default rule) | self | self | `{ v: 1, jwk: { kty: "EC", crv: "P-256", x, y, d }, at }`, the ECDH private key |
| `data/users/<id>/pins` (private, default rule) | self | self | `{ v: 1, p: { <id>: { fp, at, ok? } } }`, pinned key fingerprints (`ok`: marked verified) |
| `keys/<id>` (`keys`: read interact, write owner; `keys/{self}`: write interact) | interact | self | `{ u, x, y, at }`, the public half (JWK `x`/`y`, base64url) |
| `cards/<id>` (same shape of rules) | interact | self | `{ v: 2, u, at, w: { <tag>: { iv, ct } } }`, no plaintext progress |
| `codes/<id>` (same shape of rules) | interact | self | `{ c, u }`, a random 6-char code from `23456789ABCDEFGHJKMNPQRSTUVWXYZ` |
| `data/users/<id>/chal` (private, default rule) | self | self | my challenge history in plain v1 shape: `{ v, to[], from[], out: { <cid>: { to, seed, diff, at, exp, rnd?, r? } }, res: { "<sender>~<cid>": { by, cid, seed, diff, at, r? \| no: 1 } } }` |
| `chal/<id>` (same shape of rules as `cards`) | interact | self | `{ v: 2, u, at, out: { <cid>: { t, iv, ct, k } }, res: { <rid>: { t, iv, ct, k } } }`, no plaintext ids, seeds or results |

Friend list merge: per-id last-write-wins on `at`, a tie keeps the tombstone; tombstones pruned after 120 days; sharing and code by newest `at`.
Following is one-way, at most 60. Everyone stores ids only; names come from `user.profiles` at render time (`name || "Someone"`).

Progress cards are readable only by the people the card's owner follows. Rules can't express that (they key on sharing level and
`{self}` only), so every Contributor can read every `cards/<id>` doc and the guarantee comes from encryption, not rules:
- Keys: each player with Friends (interact or above) and WebCrypto has an ECDH P-256 pair. `onKey` watches the private doc, loads and
  checks it (a throwaway ECDH round trip proves `d` matches `x`/`y`), and makes and saves a new pair when it is missing or invalid.
  `keys/<id>` is rewritten whenever it differs from the loaded key.
- Pair keys: ECDH bits between my private key and a followed player's public key feed HKDF-SHA-256 with salt `orchard-card-v2` and info
  `"key|<from>|<to>"` (AES-GCM-256) or `"tag|<from>|<to>"` (96 bits, base64url, 16 chars). Each direction gets its own key and tag, so
  two mutual cards share no tag. Pairs are cached per (peer, public key) and dropped when my key changes.
- Writing: the body is `buildCard(...)` (stars, plots, worlds, golden, streak, best, trophies, tiers, `ws`/`wc`, `day`, nectar only when
  switched on). `ws`/`wc` (stars and plots per world) are in world id order, not display order, so cards from older and newer
  clients line up; the world bars map them to display order. For each followed player with a valid published key (`cardRecips`, newest 60) it is sealed with a fresh 12-byte IV and
  additional data `orchard-card-v2|<sender>|<recipient>`, stored at `w[tag]`. A body change is written at most once a minute. A change of
  recipients or of any trusted key (mine or theirs, `recipSig`) skips that limit and is written 250 ms to 1 s later (`REWRAP`), at most
  once a second, so a follow, unfollow or accepted key shows up fast. A pending write is started at once on `pagehide` or when the tab
  is hidden, and a reloaded page re-checks its card, so a reload never leaves a follower without a wrap.
  On load an existing v2 card is checked (same tags, first wrap decrypts to the current body) instead of rewritten. The card is off
  until switched on; switching off deletes it.
- Reading: a follower of B fetches `cards/B` (`where("u", "in", ids)`, chunks of 30) and `keys/B` (same query on `keys`), derives the tag
  for (B, me), decrypts `w[tag]` and runs `cleanCard`. No wrap, a failed decrypt, a missing key or a key that changed since B wrote
  all mean "Hasn't added you back. Only people they follow see their progress." and no stats. A doc without `v: 2` (old plaintext v1)
  counts as not shared. B's page watches the keys of everyone B follows and re-wraps once B accepts a changed one.
- v1 cards: on load a player's own non-v2 card is deleted at once; with sharing on a v2 card replaces it.
- No WebCrypto (`crypto.subtle` missing or not a secure context): the share switch, New challenge and every Challenge button are
  disabled, the card status and both challenge sections say "This browser can't encrypt…", friend rows say "This browser can't open
  progress cards", no key is made, and a leftover v1 card or v1 challenge doc is deleted. Friend codes still work.
- Still visible to every Contributor: that a player has Friends (`keys/<id>`, `codes/<id>`), that they share, when they last wrote
  (`at`), how many people they wrap for and the card size. Not visible: who they follow, or any stat.
- Every player's own state (friend list, keys, challenge history) lives under the private `data/users/<id>/`, unreadable even by the owner.
- Key pinning: the artifact owner can overwrite `keys/<id>` (rule `write: owner`), so peer keys are trusted on first use. The
  fingerprint is base64url SHA-256 of the RFC 7638 JWK `{"crv","kty","x","y"}`. Every friend, every peer in my challenge history and
  every sender whose challenge I open is pinned silently in `data/users/<me>/pins` (merged per peer by newest `at`). If a pinned
  peer's published key changes (`pinState` "changed"), I stop encrypting cards and challenges to them and stop opening theirs. Their row
  says "Sharing with them is paused" and "Their key changed. Compare safety codes, then accept." (with "since you verified them" when
  `ok` was set), and the Challenge button is disabled. My own history stays, since it lives in my private doc. "Accept new key" re-pins
  and clears `ok`. Nothing is shared while a fingerprint is still being computed or the pins doc hasn't loaded.
- Safety code: SHA-256 of `orchard-safety-v1\n` plus the two sorted lines `<id>|<fp>`; the first 9 bytes give 12 digits in groups of 4
  (`safetyDigits`). It is the same on both screens. The lock button on a friend's row shows it with "Mark as verified", which sets `ok`
  and a "verified" badge.
- Own key: if `keys/<me>` stops matching my private key (checked against a fresh read of the private doc, so a key rotated on another
  device is adopted, not overwritten), it is republished. When a key I had published was replaced, the page says "Your shared key was
  replaced by someone else and has been restored."

Challenges are private to the two players: nobody else, the owner included, can tell who challenged whom or read seeds or results.
- History: my own challenges and answers live in plain v1 shape in the private `data/users/<id>/chal`, merged across devices with
  `mergeChal`/`finishChal` as before. That doc is the source of truth, so my history survives a peer's key rotation; there is no
  self-encrypted copy in the shared doc.
- Shared doc: `chal/<id>` is derived from it (`cx.sealChal`). Each `out` entry (keyed by its random `cid`) is sealed for its recipient,
  each answer for its challenger under `rid`, a 16-char value from HKDF info `chal-rid|<me>|<peer>|<sender>~<cid>` that outsiders can't
  link to the `cid`. `t` is a pair tag from HKDF info `chal-out-tag|<sender>|<recipient>` or `chal-res-tag|<answerer>|<challenger>`, the
  AES-GCM key comes from `chal-out-key`/`chal-res-key` with the same direction, and the additional data is
  `orchard-chal-v2|<out|res>|<from>|<to>|<cid|rid>`. Card and challenge labels differ, so no tag links to another. The plaintext is
  exactly the v1 entry. `k` is the plaintext prune time, `at + 21 days` rounded up to the hour, so the owner can prune without
  decrypting. Entries for peers without a published key are left out of the shared doc (kept privately). An entry that still decrypts
  to the same body keeps its IV and ciphertext, so the doc is rewritten only when something changed; an empty doc is deleted.
- Finding: one subscription to the whole `chal` collection and one to the whole `keys` collection (each `orderBy("at", "desc")
  .limit(1000)`). For each other player's doc I derive the pair (cached per peer and key), match `t` against my two incoming tags, and
  decrypt only matching entries (cached by ciphertext). Matches must pass `chalEntry` (`cleanOut`/`cleanRes`, addressed to me).
  `incomingOf`/`outgoingOf` then run unchanged on the decrypted docs. In all: 6 base subscriptions plus 2 per 30 friends for cards.
- Keys: a challenge needs the recipient's published key. Without one, the friend row says "Needs to open Friends once", its Challenge
  button is disabled, and the New challenge picker disables them with a line saying why. A peer key change re-seals my entries for them once I accept it (see key pinning).
- Migration: other players' v1 `chal` docs are ignored. On load my own v1 doc is merged into my private history and the shared doc is
  rewritten as v2 (or deleted when nothing can be sealed).
- Still visible: that a player has challenge activity, how many open entries and answers they hold, which entries in one doc go to the
  same peer (same `t`), when each was created (to the hour, via `k`) and when the doc last changed. Watching docs change live can hint
  at who answered whom by timing.

Challenge rules: the sender writes the challenge in its own doc (`out`), the recipient answers in its own doc (`res`), so neither side
can change the other's part. Friends' cards come from `where("u", "in", ids)` in chunks of 30. A card or answer only counts when it
belongs to the doc's owner and is addressed to me, and every field from another player is validated and clamped. Expiry 7 days (results after
expiry + 1 h don't count); at most 10 open outgoing; entries pruned after 21 days (30 out, 60 answers). Winner: fewer seeds, then more
pollen, then less time; an answer with a different seed or difficulty is void; after expiry a lone result wins by walkover. The first
recorded result per side stays. Nectar: 5 per recorded challenge result, first 3 a day (`chal:<YYYYMMDD>:<1..3>`, validated in `cleanWallet`).

Tests: `node dev/friends/test-friends.js`; browser harness `dev/friends/serve.py` (port 8765), `dev/friends/build.sh`,
`dev/friends/shot.sh NAME WxH "QUERY" [flow.html]` with a multi-user mock (`uid=`, `level=view|interact|owner`, `fx=rich|empty`,
`mock=none`, `signedout=1`, `none=db`, `noprofile=1`, `can=null`, `nocrypto=1`, `skin=`, `open=new|hist|play|search`, `scroll=`). The mock
applies `rules.js` (private `data/users/<id>/` per player, the owner included). `fx=rich` seeds keys and v2 cards: Bob follows Alice back,
Cara doesn't, Dev has a v1 card. `fx=rich` also seeds each player's private challenge history and the sealed `chal/<id>` docs, and Gil Guest is a friend without a key.
`flow.html` runs two players end to end; `cards.html` runs the card privacy checks (mutual, one-way, outsider decrypt attempts,
unfollow, key rotation, sharing off, v1 cards, no WebCrypto): `shot.sh cards 1600x900 "" cards.html`; `chal.html` runs the challenge
privacy checks (play and answer, nectar once, outsider reads, walkover and expiry, key rotation, keyless friends, v1 migration):
`shot.sh chal 1500x900 "" chal.html`; `trust.html` runs key pinning (owner swaps a key, warning, accept, verified badge, safety
codes on both screens, own-key restore, prompt re-wrap after a follow and after a quick reload). `fx=rich&pins=1` seeds Alice's pins (Bob
verified, Cara's key changed) and `safe=<id>` opens that row's safety code. `dev/friends/LIVE-CHECK.md` is the manual check for claude.ai.
Firefox 136's `--screenshot` sometimes snapshots before the hold image finishes and cuts a long
test short; `dev/friends/run.sh NAME WxH PAGE TAG` (e.g. `run.sh chal 1500x900 chal.html CHAL`) retries until the summary line appears,
with `FTIME` (default 300 s) as the Firefox timeout.

## Web build (Firebase)

A second target of the same game on Firebase Hosting, with Google sign-in (Firebase Auth) and cloud save in Cloud Firestore,
for players outside the artifact owner's organization, with Friends on its own Firestore layout. The claude.ai artifact is
unchanged: `orbit-orchard.html` and its script list stay as they are, and nothing below loads there.

Files: `js/backend-firebase.js` (adapter, `window.OrchardWeb`), `js/firebase-config.js` (web app config, the only file to edit
per project), `js/friends-web.js` (Friends storage on Firestore, `window.OrchardFriendsWeb`), `css/web.css`, and `firebase/`: `build.sh`, `sw.js` (service worker template), `firebase.json`, `firestore.rules`,
`firestore.indexes.json`, `.firebaserc`, `SETUP.md`. `sh firebase/build.sh` writes `firebase/public/` (generated, never edit):
a full `index.html` (doctype, head with charset, viewport, description, title, Google Fonts and `modulepreload` links for the
SDK) made from `orbit-orchard.html`, with `js/firebase-config.js` and `js/backend-firebase.js` inserted before `js/ui.js` and
`js/friends-web.js` after `js/friends.js` (the build fails if `ORCHARD_DEV` is assigned anywhere in the output); every other referenced file copied as is; and `sw.js`, which precaches the
app, the SDK and the fonts stylesheet (network first for the site, cache first for the pinned SDK and font files), so the game
loads and plays with no network after one visit. The Firebase JS SDK is the modular build pinned in `backend-firebase.js`
(`https://www.gstatic.com/firebasejs/12.19.0/`), loaded with dynamic `import()`. Deploy steps are in `firebase/SETUP.md`.

Adapter contract: `OrchardWeb.use(name)` stands in for `claude.use`. `use("db")` gives `doc(path)`, mapping
`data/users/<uid>/<name>` to Firestore `users/<uid>/data/<name>` (any other path throws `invalid_argument`); the handle has
`get()`, `set(data)` and `onSnapshot(next, error)`, and snapshots are plain `{ id, exists, data(), metadata: { fromCache,
hasPendingWrites } }`, never carrying `q`. The listener first claims an allowance block (`meter.ready()`), uses `includeMetadataChanges`,
drops pending-write events and the server echo of the page's own last write, and on a cached snapshot passes it on, then reports
`unavailable` (so cloud.js shows Offline and retries 15–30 s later) once it has had a server snapshot or the browser is offline;
the cached replay the SDK sends first when a listener is re-attached online waits up to 15 s for the server instead. When the
meter rests, the listener reports `resting` and detaches. `set` is refused with `unavailable` while offline instead of being queued.
Error codes map to cloud.js's: a denied or invalid write to `quota_exceeded` ("Cloud storage is full."), a denied listener to
`not_granted`, `resource-exhausted` to `resource_exhausted`, `resting` to `resting`, anything else to `unavailable`. `use("user")` waits for the first auth state, then `id()` is the Firebase
uid or null and `me()` is `{ id, name, email, avatarUrl }`. Other capabilities resolve to null, so Download save uses its Blob
fallback. Also: `on(fn)` with `fn(kind, err)` (`init` first auth state, `auth` sign-in or sign-out, `ui` busy change, `error` a
redirect error, `rest`/`wake`/`claim` from the meter), `account()`, `known()`, `available()` (SDK loaded and config set), `sdk()` (the loaded `{ fs, db }` for Friends), `busy()`, `signIn()` (popup; redirect when
the popup is blocked or unsupported, and always on mobile Safari), `signOut()`, `meter` (see "Daily allowance"), and `view(status)`, which
rewrites cloud.js's claude.ai wording for `local` and words `resting` with the reset time in local time. Persistent Firestore cache stays off: queued offline writes would land later without cloud.js's
merge against the fresh remote, and the browser save already covers offline. `?emu=1` uses the project `demo-orbit-orchard`
with the Auth emulator on `127.0.0.1:9099` and the Firestore emulator on `127.0.0.1:8080`, never the live project.

cloud.js hooks (no effect on claude.ai, which passes none of them): `start({ backend })` uses `backend` instead of
`window.claude`; `start({ minGap })` paces writes, at most one per `minGap` ms (a number, or a function read at each write; the web
build passes 120000, or 600000 while `meter.slow()`), including the push after a snapshot, while `flush()` (on `pagehide` and when
the tab is hidden) and `syncNow()` write at once; `restart()` drops the listener and reconnects as the current account; `flush()`
returns the write's promise. An error code `resting` from `set` or the listener stops sync in mode `resting` (the backend supplies
the wording); `syncNow()` reconnects, which ui.js calls on the meter's `wake`.

UI differences, all keyed on `window.OrchardWeb`: the hub has all 9 tabs (keys `1`–`9`, Friends badge included); the Settings cloud card shows "Sign in with Google" when
signed out and the name, email, status, Sync now and Sign out when signed in; the title screen shows a small "Sign in with Google
to save to the cloud" button to signed-out players (Enter or Space on it doesn't start the game). Signing in merges this
device's save with the account's cloud save through cloud.js's merge; signing out first flushes pending progress, then stops
sync and keeps the local save. Notes confirm both. ui.js passes `web: { signIn, glogo }` to `OrchardFriends.init` (null on claude.ai).
While resting, the cloud chip is grey ("Resting"), Sync now is disabled, and the Settings status and a line under the title's start
prompt say "Today's cloud sync allowance is used up. Progress is saved on this device and syncs again after 3:00 PM." (or "Cloud
sync is full for today. …" when the day's 400 blocks are gone).

Friends on the web. Same UI, copy and game rules as claude.ai (one-way follows, at most 60; share and nectar switches; cards; 7-day
challenges, at most 10 open, first result stays, walkover and void, 5 nectar for the first 3 results a day; pins, "key changed"
pause and accept, safety codes, verified badge, own-key restore), with these differences:
- Friends needs a Google sign-in. Signed out, the tab shows "Sign in to use Friends / Sign in with Google to add friends and trade
  challenges." with the Google button. Signing in or out resets Friends' state and reconnects as the new account.
- No name search (Firebase has no directory): friends are added by code only, and the search field is not rendered. Copy that
  mentions searching or "access to this page" is replaced ("Make one so friends can add you.", "Anyone who enters it can follow you…").
- Names come from the friend's `pub` doc. "Show my Google name to friends" (default on) publishes the Google display name, trimmed to
  40 characters; off, or with no name, friends see "Gardener ABC-234" (the code they added you with) and a letter avatar.
- Cards refresh at most every 30 minutes (5 when the page hides) instead of every minute; new or re-keyed recipients still get
  theirs at once. The card status says "Updates at most every 30 minutes." A refresh that needs more writes than this device can
  still get today (`meter.left()`), or a card doc at its daily cap, waits until after the reset; first cards still go out.
- Resting: when the meter rests (or a write is refused with `resting`), Friends unsubscribes and shows "Friends are resting until
  3:00 PM / Today's cloud allowance is used up. Your garden keeps saving on this device." (no Try again), then reconnects on `wake`.
- Errors: a denied listener shows the `error` card (with Try again); unavailable or exhausted quota shows `offline` and reconnects
  after 20–40 s or on the `online` event; a write the server refuses for quota notes "The cloud is at today's limit."; `connecting`
  for 20 s counts as offline.

Layout (all encrypted values are AES-GCM with the same ECDH P-256 + HKDF pair keys as claude.ai; IVs and ciphertexts base64url):

| path | who reads | who writes | body |
|---|---|---|---|
| `users/<uid>/data/{save,friends,keys,pins,chal}` | owner | owner | as on claude.ai; `keys` holds the private JWK |
| `users/<uid>/data/sent` | owner | owner | `{ v: 1, s: { <itemId>: { t: <recipient>, k } } }`, the outbox ledger |
| `pub/<uid>` | any signed-in user, `get` only | owner | `{ x, y, at, n?, s? }`: public key, display name, `s: true` while sharing |
| `codes/<CODE>` | any signed-in user, `get` only | create by the uid it names; delete by that uid; no update | `{ u }` |
| `cards/<owner>/to/<reader>` | owner and reader | owner | `{ iv, ct, at }`: the card for one reader, additional data `orchard-card-v2\|<owner>\|<reader>` |
| `inbox/<uid>/items/<from>_<hid>` | inbox owner | create by `from`; delete by the inbox owner or `from`; no update | `{ from, kind: "chal"\|"res", iv, ct, at, k }` |
| `days/<day>` | any signed-in user, `get` only | +1 with the caller's seat, at most 400 | `{ n }`: allowance blocks claimed today |
| `days/<day>/u/<uid>` | that user, `get` only | that user, +1 with the counter, at most 4 | `{ k }`: blocks this user claimed today |

Every create or update of `users/<uid>/data/*`, `pub/<uid>` and `cards/<owner>/to/<reader>` also carries `q: { d, n }`, the doc's
daily write counter (see "Daily allowance").

- Cards: the reader listens to `cards/<friend>/to/<me>` and `pub/<friend>` for each friend (2 single-doc listeners each, added and
  removed one by one as the list changes). No doc for me while their `pub` says `s` reads as "Hasn't added you back…"; no doc and no
  `s` reads as "Not sharing their progress". The owner lists `cards/<me>/to` once per connection, then writes one doc per
  recipient in a batch: only docs whose body or keys changed, after checking that an existing doc still decrypts to the current
  body. Unfollowing, an unaccepted key change or switching sharing off deletes the docs (switching off lists the collection afresh,
  so docs written by another device go too).
- Codes: `makeCode` creates `codes/<random>` (a taken code fails the no-update rule, so it retries); finding a code is one `get`. When
  the merged friends doc changes the code, the old code doc is deleted.
- Challenges: my history stays in the private `chal` doc, merged as on claude.ai. Each out entry is sealed for its recipient (body:
  the v1 entry plus `cid`), each answer for its challenger, with the claude.ai `chal-out-`/`chal-res-` keys and additional data
  `orchard-chal-v2|<out|res>|<from>|<to>|<itemId>`. The item id is `<from>_<hid>`, `hid` from HKDF info `inbox-id|<from>|<to>|<kind>|<key>|<c|s|a>`
  (c = sent without the sender's result, s = with it, a = answer), so ids reveal nothing and each version is written once. The
  `sent` ledger records delivered ids; an id no longer wanted (the c version once the sender plays, an entry pruned after 21 days,
  a peer whose key changed) is deleted from the peer's inbox. A create the rules refuse counts as delivered, so it isn't retried.
  `k` is the plaintext prune time (`at + 21 days`, rounded up to the hour). One listener on my own inbox replaces claude.ai's scans:
  it decrypts items from trusted senders into the same `incomingOf`/`outgoingOf` inputs, keeps up to 70 per sender, and deletes
  items past `k`, malformed ones, and undecryptable ones written over an hour before the sender's key was last read. Senders I
  don't follow have their `pub` fetched once per connection. The 10-open cap is client-side, as on claude.ai.
- Visible to the Firebase project owner (console or Admin SDK): who follows whom (the private friends docs and the card and inbox
  paths), who shares, display names, codes, when cards and items were written, how many items each inbox holds and from whom.
  Not visible: any card stat, seed, difficulty, result, challenge id or which item answers which. The owner can swap a `pub` doc;
  pins and safety codes catch that exactly as on claude.ai.
- Spam: rules can't rate-limit. Anyone signed in who knows a uid (from a friend code) can drop up to 2 KB items into that player's
  inbox while the player has a `pub` doc; items must name the sender, carry a 16-char id under the sender's uid, be dated within a
  day of the server clock and expire within 22 days. The client ignores and deletes what doesn't decrypt, so the cost is reads
  and deletes for the victim plus project quota. Friend codes can also be guessed one `get` at a time (31^6 codes).

Rules (`firebase/firestore.rules`): `users/{uid}/data/{name}` is read and deleted by the signed-in owner and created or updated by
the owner only for the names `save friends keys pins chal sent`, each with `hasOnly` keys and entry caps (friends 500 entries, pins
500, chal 40 out and 70 answers, sent 300); `pub`, `codes`, `cards` and `inbox` follow the table above, with `pub` coordinates exactly
43 base64url chars, `n` 1–40 chars and `s` only `true`, codes 6 chars from the code alphabet, card `ct` up to 4096 chars and item
`ct` up to 2048, item `at` within a day of `request.time` and `k` after `at` by at most 22 days, and item creation needing the
recipient's `pub` doc (one `exists()` read). No query needs a composite index. `save` must have the wire keys (`v gen levels ach fails stats flora daily wallet settings settingsAt`,
optional `seen coach announced skins at`, nothing else), `v == 2`, numeric `gen` and `settingsAt`, map-typed sections, and entry
caps that keep it under about 900 KB (Firestore can't measure bytes in rules): levels and fails 400, trophies 200, devices 300,
daily days 70, wallet earn 15000, spend 3000, frost 400. Every `hasOnly` list allows `q`; the metered docs need a valid `q`
(below), and inbox and code creates need the caller's seat for today. `days` docs follow the table, with the day id equal to
`string(today())`. Everything else is denied.

Daily allowance (keeps the Spark quota of 20,000 writes and deletes, 50,000 reads a day, from running out however many play):
- Day: `floor((utcMillis - offset) / 86400000)`, offset 7 h in US daylight time and 8 h otherwise, so the day turns at Pacific
  midnight like the quota. Rules compute it in `today()` from a table of daylight-time instants (second Sunday of March 10:00 UTC to
  first Sunday of November 09:00 UTC) for 2026–2036; the client uses the same table (`DST` in `backend-firebase.js`). Both are written
  by `node dev/web/gen-dst.js` (`--check` compares). Extend `TO` there and rerun it before 2037. Rules integer `/` truncates and
  `math.floor` returns a float, so `today()` uses integer division.
- Blocks: one block lets one browser make 36 writes (deletes count) and 90 reads. The day has 400 blocks, each user at most 4. A
  claim is one transaction raising `days/<day>.n` and `days/<day>/u/<uid>.k` by 1 together; the rules enforce the lockstep with
  `get`/`getAfter`. Worst case 400 × (36 + 2) = 15,200 writes and 400 × (90 + 6) = 38,400 reads, about 20% under the quota for
  listener overrun. Constants: `ALLOW` and `CAPS` in `js/backend-firebase.js`, mirrored by `400`, `4` and the caps in the rules.
- Counting (`OrchardWeb.meter`, per account and browser): setDoc/deleteDoc 1 write, a batch its op count, a claim 2 writes and 6 reads;
  a get 1 read, a list `max(1, docs)`, a doc listener 1 per server snapshot whose data changed, a query listener `max(1, docs)` then
  its doc changes; plus 1 rule read for the first counter of a doc each day, 1 for a code create and 2 for an inbox create.
  Counts live in localStorage (`oo.meter.<uid>.<page>` per page load, summed for the day), so a reload or another tab of the same
  browser keeps using today's blocks. Before a write the meter takes the allowance, claiming a block if needed; with none to claim
  the write is refused with `resting` and nothing is sent. Listener reads can't be refused: when they pass the allowance and no block
  can be claimed, the meter announces `rest` and cloud save and Friends detach.
- Resting: a full day or a user at 4 blocks is stored as `oo.meter.<uid> = { d, rest: "full"|"self", n, k }`, so no more reads that
  day. The page wakes at the next Pacific midnight plus 0–10 min (`wake`), then reconnects like the offline revive.
- Per-doc counters: `q.d` must be `today()`; on the doc's first write of the day `q.n` is 1 and the caller's seat must exist (one
  `exists()`), afterwards `q.n` is the stored `n + 1`. Daily caps: save 100, friends 20, keys 10, pins 20, chal 40, sent 40, pub 20,
  each card doc 12. Clients without `q` are refused. The adapter strips `q` from every snapshot and get, tracks the last known `q` per
  path (a get first when unknown), and on a refusal re-reads once and retries; still refused within 15 minutes of Pacific midnight
  (clock skew) it retries once more 2–4 minutes later. A doc at its cap refuses locally with `resting`.
- Cadence: cloud save writes at most every 2 minutes, or every 10 when this browser's 4th block is 75% spent or the day has reached
  380 blocks (`meter.slow()`); cards at most every 30 minutes.
- Load: a page load costs a claim (2 writes, 6 reads), the save listener (1 read) and for Friends about 8 + 3N reads (N friends). A
  block covers about an hour of steady play with a few friends; a player with 60 friends needs a second block at each load.

Tests: `node dev/web/test-adapter.js` (adapter and cloud.js against an in-memory Firebase); `node dev/web/test-meter.js` (day
numbers against Intl across every DST change in the table, the generated tables, block accounting, `q` tracking and stripping, and
the resting and wake transitions with cloud.js, against a fake Firestore applying the allowance rules); rules with the emulator:
`cd firebase && npx firebase-tools@15.31.0 emulators:exec --only firestore --project demo-orbit-orchard "node ../dev/web/rules-test.js"`
(Node ≥ 20, Java 21, `@firebase/rules-unit-testing@5` and `firebase@12` on `NODE_PATH`). Browser: `sh dev/web/build.sh`
(builds `dev/web/site/` with `errors.js` and `drive.js` injected, and `site-nosdk/` with the SDK unreachable), emulators running,
`python3 dev/friends/serve.py 8771`, then `sh dev/web/run.sh flow|offline|rest|restshots|device2|shots|cards|friends|frshots|all`.
`rest.html` runs the allowance with `?emu=1&allow=4,400&rest=25` (dev-only overrides, read only with `?emu=1` or `window.ORCHARD_DEV`:
`allow=W,R` sets writes and reads per block, `rest=S` ends a rest after S seconds): a user with 3 blocks used rests on her 4th
(Settings, title and Friends wording), plays offline-style, then resumes on her own after a simulated new day; a second user meets a
full day. `restshots` seeds a user at 4 blocks (`rest.html?seed=1`) and takes `shot=title-rest|settings-rest|friends-rest`. `flow.html` runs two devices
on different origins (sign-in merge, live sync, Download and Load, sign out, Friends asks to sign in, no console errors); `offline.html` reloads
from the service worker with the server gone and plays without the SDK. `friends.html` runs Friends with three Google users on three
origins (`127.0.0.1:8771`, `localhost:8771`, `127.0.0.1:8773` from `killable.py`): codes, mutual cards, one-way, outsider reads denied,
challenge and answer, nectar once, walkover and expiry, admin key swap and own-key restore, lost key with pause, safety codes, accept
and verify, name setting, unfollow, sharing off, sign out, no console errors; it uses the emulator's `Bearer owner` REST access as the
project owner. `frshots` seeds two players with an open challenge (`friends.html?seed=1`) and takes the Friends screenshots
(`shot=friends-out|friends-in`, `who=alice|bob`, `safe=first`, `scroll=`). `FF_CA` adds root CAs to the throwaway Firefox profiles
when the network intercepts TLS. `dev/web/user.js` raises Firefox's per-host connection limit, because three Firestore clients'
long-polls to one emulator otherwise fill the default 6 and stall writes for 20–30 s.
