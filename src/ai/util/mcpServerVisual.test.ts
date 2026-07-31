import { describe, it, expect } from 'vitest'
import { serverColor, transportLabel, SERVER_GLYPH } from './mcpServerVisual'
import { SKILL_COLOR_IDS } from '../components/settings/skills/SkillTile.vue'

const PALETTE = ['blue', 'purple', 'pink', 'orange', 'green', 'teal', 'slate']

describe('serverColor', () => {
  it('与 SkillTile 的色板逐字相同(复用同一套 --grad-sk-* token)', () => {
    expect([...SKILL_COLOR_IDS]).toEqual(PALETTE)
  })

  it('同名同色(确定性哈希)', () => {
    expect(serverColor('context7')).toBe(serverColor('context7'))
  })

  it('返回值永远落在色板内', () => {
    for (const n of ['a', 'brave', 'notion', '中文名', 'x'.repeat(200), '@scope/pkg']) {
      expect(PALETTE).toContain(serverColor(n))
    }
  })

  // 判别力:如果实现写死返回 'blue',这条会红。
  it('不同名字能落到至少 3 种不同颜色', () => {
    const names = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l']
    expect(new Set(names.map(serverColor)).size).toBeGreaterThanOrEqual(3)
  })

  it('空名 / null / undefined 回落 blue(Vue2 String(name || "") 的行为)', () => {
    expect(serverColor('')).toBe('blue')
    expect(serverColor(null)).toBe('blue')
    expect(serverColor(undefined)).toBe('blue')
  })

  // 钉住 Vue2 的确切哈希(h = h*31 + charCode,>>> 0),换算法会红。
  it('逐字复刻 Vue2 的哈希取值', () => {
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
  it('大写化', () => {
    expect(transportLabel('http')).toBe('HTTP')
    expect(transportLabel('sse')).toBe('SSE')
    expect(transportLabel('stdio')).toBe('STDIO')
  })
  it('空 / null / undefined → 空串(Vue2 String(t || "") 的行为)', () => {
    expect(transportLabel('')).toBe('')
    expect(transportLabel(null)).toBe('')
    expect(transportLabel(undefined)).toBe('')
  })
})

describe('SERVER_GLYPH', () => {
  it('是 drive —— AgentIcon 里必须存在这个图标名', () => {
    expect(SERVER_GLYPH).toBe('drive')
  })
})
