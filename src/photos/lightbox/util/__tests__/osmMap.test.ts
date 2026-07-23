import { describe, it, expect } from 'vitest'
import { osmEmbedSrc } from '../osmMap'
it('构造 OSM embed URL,默认 bbox 半径 0.02、带 marker', () => {
  // 用同一算术构造期望值,避免 JS 浮点(120-0.02 可能不是精确 "119.98")导致假失败;
  // 忠于 Vue2 的裸算术 `${lon-d}`(不四舍五入),OSM 容忍长小数。
  const d = 0.02
  const bbox = `${120 - d},${30 - d},${120 + d},${30 + d}`
  expect(osmEmbedSrc(30, 120)).toBe(
    `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=30,120`,
  )
})
it('缺经纬度返空串', () => {
  expect(osmEmbedSrc(null, 120)).toBe('')
  expect(osmEmbedSrc(30, undefined)).toBe('')
})
