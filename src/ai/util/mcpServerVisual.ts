// SP8-P4 Task 2 — 1:1 port from Vue2 src/views/AI/MCP/mcpServerVisual.js (15 lines).
// Hash algorithm, palette order, modulo operation preserved verbatim; palette is identical
// to SKILL_COLOR_IDS in SkillTile.vue (both map to the seven gradient tokens --grad-sk-*
// at tokens.scss:236-242), so no new palette or tokens are added.
// [M3 fix round] Previously incorrectly written as `:235-241` (verified that `--grad-sk-blue`
// is at :236 and `--grad-sk-slate` is at :242, corrected after grep verification).
//
// Type relaxed to unknown: Vue2 :7 is `String(name || '')`, which handles null/undefined/
// numbers with a fallback; we maintain the same permissiveness here (list data comes from
// backend where name is theoretically a string, but the fallback is existing Vue2 behavior
// and should not be tightened).
const PALETTE = ['blue', 'purple', 'pink', 'orange', 'green', 'teal', 'slate']

/** Vue2 mcpServerVisual.js:4 — Backend has no icon field; all MCP services use this glyph uniformly. */
export const SERVER_GLYPH = 'drive'

/** Vue2 mcpServerVisual.js:6-11 ported verbatim. */
export function serverColor(name: unknown): string {
  const s = String(name || '')
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}

/** Vue2 mcpServerVisual.js:13-15 ported verbatim. */
export function transportLabel(t: unknown): string {
  return String(t || '').toUpperCase()
}
