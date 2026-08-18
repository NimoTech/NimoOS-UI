// 1:1 ported from Vue2 src/views/AI/Agent/shell/MentionPopover.vue:87-107 / 273-299
import { describe, it, expect } from 'vitest'
import { DRIVE_PALETTE, driveColor, formatBytes, formatTime, escapeHtml, highlightMatch } from './mentionFormat'

describe('driveColor(MentionPopover.vue:89-93)', () => {
  it('same name, same color (deterministic)', () => {
    expect(driveColor('Drive1')).toBe(driveColor('Drive1'))
  })
  it('result always falls within the palette', () => {
    for (const label of ['Drive1', 'Movies', 'a', '云盘', '']) {
      expect(DRIVE_PALETTE).toContain(driveColor(label))
    }
  })
})

describe('formatBytes(MentionPopover.vue:95-101)', () => {
  it('four units: B/KB/MB/GB', () => {
    expect(formatBytes(500)).toBe('500 B')
    expect(formatBytes(2048)).toBe('2.0 KB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB')
    expect(formatBytes(3 * 1024 * 1024 * 1024)).toBe('3.00 GB')
  })
  it('null/NaN returns empty string', () => {
    expect(formatBytes(null as unknown as number)).toBe('')
    expect(formatBytes(NaN)).toBe('')
  })
})

describe('formatTime(MentionPopover.vue:287-299)', () => {
  it('unix seconds (≤1e12) require ×1000: renders same day as corresponding millisecond value (same year: includes month/day, excludes year)', () => {
    const currentYear = new Date().getFullYear()
    // fixed anchor point (current year January 15 at noon), does not depend on "today" drifting
    const anchorMs = new Date(currentYear, 0, 15, 12, 0, 0).getTime()
    const anchorSeconds = Math.floor(anchorMs / 1000)
    expect(formatTime(anchorSeconds)).toBe(formatTime(anchorMs))
    expect(formatTime(anchorSeconds)).not.toMatch(new RegExp(String(currentYear)))
    expect(formatTime(anchorSeconds)).toContain('15')
  })
  it('unix milliseconds used directly: renders consistently with manually ×1000 seconds (across years: includes year)', () => {
    const pastYear = new Date().getFullYear() - 3
    const anchorMs = new Date(pastYear, 5, 20, 12, 0, 0).getTime()
    const anchorSeconds = Math.floor(anchorMs / 1000)
    expect(formatTime(anchorMs)).toBe(formatTime(anchorSeconds))
    expect(formatTime(anchorMs)).toMatch(new RegExp(String(pastYear)))
  })
  it('ISO string shows month/day only in same year, shows year/month when crossing years', () => {
    const now = new Date()
    const sameYearIso = new Date(now.getFullYear(), 0, 15).toISOString()
    const out = formatTime(sameYearIso)
    expect(out).not.toMatch(new RegExp(String(now.getFullYear())))
    const lastYearIso = new Date(now.getFullYear() - 1, 0, 15).toISOString()
    const outLast = formatTime(lastYearIso)
    expect(outLast).toMatch(new RegExp(String(now.getFullYear() - 1)))
  })
  it('falsy input returns empty string', () => {
    expect(formatTime(0)).toBe('')
    expect(formatTime('')).toBe('')
  })
})

describe('escapeHtml(MentionPopover.vue:282-285)', () => {
  it('all five characters escaped', () => {
    expect(escapeHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;')
  })
})

describe('highlightMatch(MentionPopover.vue:273-280)', () => {
  it('first match case-insensitive', () => {
    expect(highlightMatch('MyDocs', 'doc')).toBe('My<mark>Doc</mark>s')
  })
  it('all three segments escaped, only <mark> is the real tag', () => {
    const out = highlightMatch('<b>abc', 'a')
    expect(out).toContain('&lt;b&gt;')
    // strip the one legitimate <mark>...</mark> pair and confirm nothing else looks like a tag
    const stripped = out.replace('<mark>', '').replace('</mark>', '')
    expect(stripped).not.toMatch(/<[^&]/)
  })
  it('when query is absent, only escape without highlighting', () => {
    expect(highlightMatch('<b>abc', '')).toBe('&lt;b&gt;abc')
  })
  it('when no match, only escape', () => {
    expect(highlightMatch('abc', 'zzz')).toBe('abc')
  })
})
