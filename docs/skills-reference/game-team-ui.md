# team-ui, Claude Code Game Studios (excerpt)

Source: https://github.com/Donchitos/Claude-Code-Game-Studios/blob/main/.claude/skills/team-ui/SKILL.md
License: MIT (repository LICENSE). Excerpted 2026-09-28.

Implementation constraints from the skill's phase 3 and polish checklist that apply to a browser game:

- UI displays state and never owns game state; player actions are emitted as events to the game.
- Support keyboard/mouse and (where possible) other inputs; every screen reachable without a pointer.
- Animations skippable; respect motion-reduction preferences.
- Audio goes through an event/API layer, never ad-hoc calls.
- Test all supported resolutions and aspect ratios.
- HUD respects a visual budget (element count, opacity limits).
- Color contrast and non-color-only state indicators verified at visual review and accessibility audit.
