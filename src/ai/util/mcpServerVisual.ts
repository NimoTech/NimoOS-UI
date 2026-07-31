// SP8-P4 Task 2 —— 1:1 移植自 Vue2 src/views/AI/MCP/mcpServerVisual.js(15 行)。
// 哈希算法、色板顺序、取模逐字保留;色板与 SkillTile.vue 的 SKILL_COLOR_IDS
// 完全相同(两边都映射到 tokens.scss:235-241 的 --grad-sk-* 七个渐变 token),
// 故不新建色板、不新增 token。
//
// 类型放宽到 unknown:Vue2 :7 是 `String(name || '')`,对 null/undefined/数字
// 都做了兜底,这里保持同样的宽容度(列表数据来自后端,name 理论上必为 string,
// 但兜底是 Vue2 既有行为,不收紧)。
const PALETTE = ['blue', 'purple', 'pink', 'orange', 'green', 'teal', 'slate']

/** Vue2 mcpServerVisual.js:4 —— 后端没有图标字段,全部 MCP 服务统一用这个字形。 */
export const SERVER_GLYPH = 'drive'

/** Vue2 mcpServerVisual.js:6-11 逐字移植。 */
export function serverColor(name: unknown): string {
  const s = String(name || '')
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}

/** Vue2 mcpServerVisual.js:13-15 逐字移植。 */
export function transportLabel(t: unknown): string {
  return String(t || '').toUpperCase()
}
