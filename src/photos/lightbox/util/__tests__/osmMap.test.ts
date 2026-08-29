import { describe, it, expect } from 'vitest'
import { osmEmbedSrc } from '../osmMap'
it('Construct OSM embed URL, default bbox radius 0.02, with marker', () => {
  // Use same arithmetic for expected values to avoid JS floating-point (120-0.02 might not be
  // exact "119.98") false failures. Faithful to Vue2's raw arithmetic `${lon-d}` (no rounding).
  const d = 0.02
  const bbox = `${120 - d},${30 - d},${120 + d},${30 + d}`
  expect(osmEmbedSrc(30, 120)).toBe(
    `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=30,120`,
  )
})
it('Missing latitude/longitude returns empty string', () => {
  expect(osmEmbedSrc(null, 120)).toBe('')
  expect(osmEmbedSrc(30, undefined)).toBe('')
})
it('0 value treated as missing (Vue2 uses falsy check !photo.latitude)', () => {
  // Vue2 mapSrc uses !photo.latitude, so 0 → missing → ''
  expect(osmEmbedSrc(0, 120)).toBe('')
  expect(osmEmbedSrc(30, 0)).toBe('')
})
