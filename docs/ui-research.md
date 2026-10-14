# Orbit Orchard v2: UI research and design brief

## Sources

Agent skills (excerpts with attribution in `docs/skills-reference/`):

- ui-animation skill, mblode/agent-skills (MIT): https://github.com/mblode/agent-skills/blob/main/skills/ui-animation/SKILL.md
- ux-designer skill, szilu (MIT): https://github.com/szilu/ux-designer-skill
- team-ui skill, Claude Code Game Studios (MIT): https://github.com/Donchitos/Claude-Code-Game-Studios/blob/main/.claude/skills/team-ui/SKILL.md
- frontend-design plugin skill (loaded locally)
- Index of design skills: https://github.com/bergside/awesome-design-skills

Game UI references:

- Balatro juice breakdown: https://blakecrosley.com/guides/design/balatro and Game UI Database entry https://www.gameuidatabase.com/gameData.php?id=1935
- Game UI Database, world map level select: https://www.gameuidatabase.com/index.php?scrn=6, results screens: https://www.gameuidatabase.com/index.php?scrn=53
- Mini Metro / Mini Motorways minimalism: https://medium.com/gaming-is-good/mini-metro-and-mini-motorways-the-art-of-elegant-constraint-optimization-2571a32fdfe2
- Outer Wilds ship log UX critique: https://medium.com/super-jump/outer-wilds-a-ux-critique-part-2-146abcb9a5a1
- Monument Valley visual analysis: https://nabauer.com/monument-valley-design-analysis/
- "Juice it or lose it" (Jonasson & Purho) summaries: https://www.gameanalytics.com/blog/squeezing-more-juice-out-of-your-game-design, https://valdemird.com/blog/game-feel-on-the-web/
- Atkinson Hyperlegible Next and Mono (2025): https://fonts.google.com/specimen/Atkinson+Hyperlegible+Next, https://fonts.google.com/specimen/Atkinson+Hyperlegible+Mono

## Patterns adopted

| Pattern | From | Where in Orbit Orchard |
|---|---|---|
| Staggered, pitch-rising reveals; bouncy overshoot `cubic-bezier(.34,1.56,.64,1)` | Balatro | Result stars pop one by one with `sfx('star',{n})`; HUD counters bump |
| Map as the menu: a route of places, not a list | Mini Metro, world-map level selects | Journey tab: planets joined by a drawn route; world page is a 22-node constellation |
| Knowledge log that fills in as you discover | Outer Wilds ship log | Almanac: specimen plates stay silhouettes until seen |
| Palette carries mood per place; UI stays quiet | Monument Valley, Alto | World theme colours tint cards, planets and page accents; chrome stays neutral |
| Collection shelf as progress | cozy games (Cozy Grove, Dorfromantik) | Greenhouse pots grow with the number of plants of each flora |
| Squash on press, overshoot on arrival, restraint elsewhere | Juice it or lose it; ui-animation skill | Buttons press 0ms, hover lift 120ms, modals scale from .94 |
| Modal only when blocking; toasts for info, badges for background | ux-designer skill | Intro/pause/results/confirm are modals; engine flavour lines and trophies are toasts |
| UI never owns game state, emits events | team-ui skill | ui.js only calls the Orchard API and listens to its events |

## Design brief

**Idea.** A risograph star chart. Two misregistered inks (the logotype is printed twice, offset), hard offset
shadows instead of soft ones, paper grain over everything. The one bold element is the route: worlds and plots
are drawn as a hand-inked constellation you travel along. Everything else stays quiet.

**Type.** Unbounded 800 for display (logotype, page titles, big numbers), Atkinson Hyperlegible Next for body
(16px base), Atkinson Hyperlegible Mono for numerals and key caps only, replacing JetBrains Mono so the data face
belongs to the body family. Scale (px): 12, 14, 16, 18, 24, 36, 48, 72. Sentence case labels, no tracked caps.

**Skin tokens** (`[data-skin]` on `<html>`, the same selector scopes the settings previews):

| token | nocturne | daylight | synthwave | inkwell |
|---|---|---|---|---|
| bg | #10142a | #e9ecdf | #0a0418 | #000000 |
| surface | #1b2142 | #f7f8f1 | #170b30 | #000000 |
| line | #2f3764 | #c3c8b2 | #3d1f6b | #ffffff |
| text | #f4ead8 | #1d2748 | #fbeaff | #ffffff |
| dim | #b9b2c9 | #4f5874 | #b7a0d9 | #d0d0d0 |
| accent (primary) | #f29e7a | #2b50aa | #ff3fa4 | #ffffff |
| second ink | #ff79b0 | #ff4f8b | #29f0ff | #ffffff |
| gold | #f3d67a | #d99a00 | #ffe45e | #ffffff |
| shadow | 4px hard, deep ink | 4px hard, blue ink | neon glow | 4px hard grey, hatching fills |

**Motion.** Press 0ms; hover 120ms `cubic-bezier(.22,1,.36,1)`; modals 240ms in / 160ms out from scale .94; tab
panels slide 24px in the direction of travel over 280ms; tab indicator springs with overshoot. One orchestrated
moment per screen (title logotype, result stars, world unlock). Reduced motion (OS or setting) removes travel
and loops and keeps instant state changes.

**Components.** Title splash, hub header with streak and star chips, tab bar (top pill on desktop, bottom bar on
phones), world route, planet card, constellation level map with detail plate, daily card with week strip and
share box, Zen controls, specimen plate with live canvas, greenhouse shelf canvas and stat ledger, trophy
medallions with progress, skin swatches, switches and sliders, HUD (identity, seed pods, par, pollen, sown,
readout), modal (intro, pause, results, lose, unlock, confirm, quick settings), toasts, coach marks.
