// 1:1 移植自 Vue2 src/views/AI/Agent/shell/MentionPopover.vue:87-107 / 273-299
import { describe, it, expect } from 'vitest'
import { DRIVE_PALETTE, driveColor, formatBytes, formatTime, escapeHtml, highlightMatch } from './mentionFormat'

describe('driveColor(MentionPopover.vue:89-93)', () => {
  it('同名同色(确定性)', () => {
    expect(driveColor('Drive1')).toBe(driveColor('Drive1'))
  })
  it('结果始终落在调色板内', () => {
    for (const label of ['Drive1', 'Movies', 'a', '云盘', '']) {
      expect(DRIVE_PALETTE).toContain(driveColor(label))
    }
  })
})

describe('formatBytes(MentionPopover.vue:95-101)', () => {
  it('四档:B/KB/MB/GB', () => {
    expect(formatBytes(500)).toBe('500 B')
    expect(formatBytes(2048)).toBe('2.0 KB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB')
    expect(formatBytes(3 * 1024 * 1024 * 1024)).toBe('3.00 GB')
  })
  it('null/NaN 返回空串', () => {
    expect(formatBytes(null as unknown as number)).toBe('')
    expect(formatBytes(NaN)).toBe('')
  })
})

describe('formatTime(MentionPopover.vue:287-299)', () => {
  it('unix 秒(≤1e12)要 ×1000:与对应毫秒值渲染同一天(同年:含月日、不含年份)', () => {
    const currentYear = new Date().getFullYear()
    // 固定锚点(当年 1 月 15 日正午),不依赖"今天"漂移
    const anchorMs = new Date(currentYear, 0, 15, 12, 0, 0).getTime()
    const anchorSeconds = Math.floor(anchorMs / 1000)
    expect(formatTime(anchorSeconds)).toBe(formatTime(anchorMs))
    expect(formatTime(anchorSeconds)).not.toMatch(new RegExp(String(currentYear)))
    expect(formatTime(anchorSeconds)).toContain('15')
  })
  it('unix 毫秒直接使用:与手动 ×1000 的秒值渲染一致(跨年:含年份)', () => {
    const pastYear = new Date().getFullYear() - 3
    const anchorMs = new Date(pastYear, 5, 20, 12, 0, 0).getTime()
    const anchorSeconds = Math.floor(anchorMs / 1000)
    expect(formatTime(anchorMs)).toBe(formatTime(anchorSeconds))
    expect(formatTime(anchorMs)).toMatch(new RegExp(String(pastYear)))
  })
  it('ISO 串同年只出月日,跨年出年月', () => {
    const now = new Date()
    const sameYearIso = new Date(now.getFullYear(), 0, 15).toISOString()
    const out = formatTime(sameYearIso)
    expect(out).not.toMatch(new RegExp(String(now.getFullYear())))
    const lastYearIso = new Date(now.getFullYear() - 1, 0, 15).toISOString()
    const outLast = formatTime(lastYearIso)
    expect(outLast).toMatch(new RegExp(String(now.getFullYear() - 1)))
  })
  it('falsy 输入返回空串', () => {
    expect(formatTime(0)).toBe('')
    expect(formatTime('')).toBe('')
  })
})

describe('escapeHtml(MentionPopover.vue:282-285)', () => {
  it('五字符全转义', () => {
    expect(escapeHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;')
  })
})

describe('highlightMatch(MentionPopover.vue:273-280)', () => {
  it('大小写不敏感首次匹配', () => {
    expect(highlightMatch('MyDocs', 'doc')).toBe('My<mark>Doc</mark>s')
  })
  it('三段都转义,且只有 <mark> 是真标签', () => {
    const out = highlightMatch('<b>abc', 'a')
    expect(out).toContain('&lt;b&gt;')
    // strip the one legitimate <mark>...</mark> pair and confirm nothing else looks like a tag
    const stripped = out.replace('<mark>', '').replace('</mark>', '')
    expect(stripped).not.toMatch(/<[^&]/)
  })
  it('无 query 时只转义不高亮', () => {
    expect(highlightMatch('<b>abc', '')).toBe('&lt;b&gt;abc')
  })
  it('无匹配时只转义', () => {
    expect(highlightMatch('abc', 'zzz')).toBe('abc')
  })
})
