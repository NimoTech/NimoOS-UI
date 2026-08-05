# Task 7-B: Widget Color Tokenization Report

## Status
✅ **COMPLETE** — All targetted files processed, hardcoded colors replaced with theme tokens where possible.

## Files Touched
- `src/home/components/widgets/ClockWidget.vue`
- `src/home/components/widgets/NetChart.vue`
- `src/home/components/widgets/WidgetCard.vue`
- `src/home/components/widgets/AiWidget.vue`
- `src/home/components/widgets/NetworkWidget.vue`

## Replacements Summary

| File | Lines | Token Swaps | Details |
|---|---|---|---|
| ClockWidget.vue | 91, 135, 139 | 3 | `#fff` → `var(--fg)` (clock text, hour/minute hands, center pin) |
| NetChart.vue | 38, 39, 41, 42 | 4 | `rgb(0,143,251)` → `var(--accent)` (upload); `rgb(0,227,150)` → `var(--good)` (download) |
| WidgetCard.vue | — | 0 | No direct swaps; 2 theme-exception annotations added |
| AiWidget.vue | 37, 44 | 2 | `var(--fg)` for orb eye highlights; `var(--on-accent)` for prompt dot number |
| NetworkWidget.vue | 38, 39 | 2 | `rgb(0,143,251)` → `var(--accent)` (upload legend); `rgb(0,227,150)` → `var(--good)` (download legend) |

**Total replacements: 11**

## Needs-New-Token Leftovers

| File | Line(s) | Color Value | Current | Suggested Token | Reason |
|---|---|---|---|---|---|
| ClockWidget.vue | 132 | `rgba(255,255,255,.06)` | theme-exception | `var(--dial-face)` or similar | SVG dial face background; semi-transparent white doesn't fit text/border/bg families |
| ClockWidget.vue | 132 | `rgba(255,255,255,.38)` | theme-exception | (part of dial styling) | Dial border stroke; needs dial-specific vocabulary |
| ClockWidget.vue | 133 | `rgba(255,255,255,.62)` | theme-exception | (part of dial styling) | Clock tick marks; dial visual language requires dedicated tokens |
| WidgetCard.vue | 73 | `rgba(255,255,255,0.16)` in gradient | theme-exception | `var(--gloss)` or `var(--highlight)` | Top-edge glass shine effect; doesn't map to existing structural tokens |
| WidgetCard.vue | 119 | `rgba(8,12,28,0.45)` | theme-exception | `var(--text-shadow)` or `var(--card-title-shadow)` | Text shadow for readability on glass; should be paired with theme |
| AiWidget.vue | 37 | `rgba(255,255,255,.3)` in box-shadow | theme-exception | `var(--orb-inset-glow)` or similar | Inset lighting glow on AI orb; semantic to orb lighting, not general shadows |

**Summary:** 6 items flagged as needing new tokens — all noted with theme-exception comments per guide. Clock SVG elements (3 items) form a cohesive subsystem; glass/lighting effects (3 items) are design-intentional and would benefit from dedicated tokens.

## Validation

All files pass self-grep validation:
- No standalone `#hex`, `rgb()`, `rgba()`, `hsl()`, `hsla()` outside of:
  - var() fallbacks (`var(--token, #fallback)`) — acceptable
  - theme-exception annotations — logged above
  - Script/non-CSS blocks — excluded

---
**Prepared by:** Token Orchestrator  
**Date:** 2026-07-10  
**Next:** Centralized token addition by design system maintainer
