import { describe, it, expect } from 'vitest'
import { serverColor, transportLabel, SERVER_GLYPH } from './mcpServerVisual'
import { SKILL_COLOR_IDS } from '../components/settings/skills/SkillTile.vue'

const PALETTE = ['blue', 'purple', 'pink', 'orange', 'green', 'teal', 'slate']

describe('serverColor', () => {
  it('Palette is identical to SkillTile verbatim (reuses the same set of --grad-sk-* tokens)', () => {
    expect([...SKILL_COLOR_IDS]).toEqual(PALETTE)
  })

  it('Same name, same color (deterministic hash)', () => {
    expect(serverColor('context7')).toBe(serverColor('context7'))
  })

  it('Return value always falls within the palette', () => {
    for (const n of ['a', 'brave', 'notion', '中文名', 'x'.repeat(200), '@scope/pkg']) {
      expect(PALETTE).toContain(serverColor(n))
    }
  })

  // Discriminative power: if the implementation hardcodes return 'blue', this test will fail.
  it('Different names map to at least 3 different colors', () => {
    const names = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l']
    expect(new Set(names.map(serverColor)).size).toBeGreaterThanOrEqual(3)
  })

  it('Empty name / null / undefined falls back to blue (Vue2 String(name || "") behavior)', () => {
    expect(serverColor('')).toBe('blue')
    expect(serverColor(null)).toBe('blue')
    expect(serverColor(undefined)).toBe('blue')
  })

  // Pin down Vue2's exact hash (h = h*31 + charCode, >>> 0); changing the algorithm will fail this test.
  it('Exactly replicate Vue2\'s hash calculation', () => {
    expect(serverColor('brave')).toBe(PALETTE[hash('brave') % 7])
    expect(serverColor('notion')).toBe(PALETTE[hash('notion') % 7])
    function hash(s: string) {
      let h = 0
      for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
      return h
    }
  })
})

describe('transportLabel', () => {
  it('Uppercase conversion', () => {
    expect(transportLabel('http')).toBe('HTTP')
    expect(transportLabel('sse')).toBe('SSE')
    expect(transportLabel('stdio')).toBe('STDIO')
  })
  it('Empty / null / undefined → empty string (Vue2 String(t || "") behavior)', () => {
    expect(transportLabel('')).toBe('')
    expect(transportLabel(null)).toBe('')
    expect(transportLabel(undefined)).toBe('')
  })
})

describe('SERVER_GLYPH', () => {
  it('Is drive — this icon name must exist in AgentIcon', () => {
    expect(SERVER_GLYPH).toBe('drive')
  })
})
