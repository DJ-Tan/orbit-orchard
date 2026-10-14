# ui-animation (excerpt)

Source: https://github.com/mblode/agent-skills/blob/main/skills/ui-animation/SKILL.md
Author: Matthew Blode. License: MIT (repository license). Excerpted 2026-09-28.

## Durations

| Context | Duration |
|---|---|
| Button press feedback | 100-160ms |
| Tooltips, small popovers | 125-200ms |
| Dropdowns, selects | 150-250ms |
| Modals, drawers | 200-350ms |
| Move/slide on screen | 200-300ms |
| Page transitions | 250-400ms |
| Hover (colour/opacity) | 200ms |
| Hover (transform/scale) | 100-150ms |

"Keep routine UI under 300ms; scale duration with distance."

## Easing

| Purpose | Curve |
|---|---|
| Button press, dropdown, modal | `cubic-bezier(0.22, 1, 0.36, 1)` |
| Slide, drawer, panel | `cubic-bezier(0.25, 1, 0.5, 1)` |
| Dramatic reveals, card hovers | `cubic-bezier(0.19, 1, 0.22, 1)` |
| Press feedback | `cubic-bezier(0.25, 0.46, 0.45, 0.94)` |

"Avoid `ease-in` for UI: it starts slow, so the element lags the user's action and feels sluggish."

## Rules

- Animate `transform` and `opacity`; `color`/`background-color` for state feedback. Never `transition: all`.
- Occasional interactions enter slightly slower and exit fast; high-frequency UI enters instantly.
- Press on `:active` at 0ms, `touch-action: manipulation`; gate hover behind `(hover: hover) and (pointer: fine)`.
- Popovers and modals scale in from 0.9–0.96, never from 0.
- Reduced motion: replace travel with immediate state or restrained fades; keep user-triggered feedback.
- Priority: CSS transitions > WAAPI > CSS keyframes > rAF.
