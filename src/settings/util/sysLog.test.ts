import { describe, it, expect } from 'vitest'
import { formatSysLog, downloadLogsUrl, logPage, logPageCount, LOG_PAGE_SIZE } from './sysLog'

// Real-device fixture (verbatim start of the data from GET /v1/sys/logs on 2026-08-01)
const RAW =
  '2026-04-13T15:38:19.417-0400\tinfo\tInitPathConfig: images path mismatch, self-healing\n' +
  '2026-04-13T15:38:19.417-0400\tinfo\tInitPathConfig: path config saved\n'

describe('formatSysLog', () => {
  it('strips the leading 8-character date prefix from each line (Vue2\'s existing display behavior, kept 1:1)', () => {
    const out = formatSysLog(RAW)
    expect(out.startsWith('13T15:38:19.417-0400\tinfo\t')).toBe(true)
    expect(out).toContain('\n13T15:38:19.417-0400\tinfo\tInitPathConfig: path config saved')
  })
  it('does not eat the last character (Vue2\'s substring(8, len-1) is an off-by-one)', () => {
    expect(formatSysLog(RAW).endsWith('\n')).toBe(true)
  })
  it('short text (< 10 characters) is returned unchanged', () => {
    expect(formatSysLog('abc')).toBe('abc')
  })
  it('empty input returns an empty string', () => {
    expect(formatSysLog('')).toBe('')
  })
})

// Paging fixture: N lines, each carrying its own index so a page's boundaries are
// checkable exactly. Shape copied from the real payload (tab-separated zap output).
const mkLines = (n: number) =>
  Array.from({ length: n }, (_, i) => `13T15:38:19.417-0400\tinfo\tline ${i}`).join('\n')

describe('logPageCount', () => {
  it('an empty log still counts as one page (never renders "page 1 of 0")', () => {
    expect(logPageCount('')).toBe(1)
  })
  it('under one page worth of lines is one page', () => {
    expect(logPageCount(mkLines(1))).toBe(1)
    expect(logPageCount(mkLines(LOG_PAGE_SIZE))).toBe(1)
  })
  it('one line over the size rolls into a second page', () => {
    expect(logPageCount(mkLines(LOG_PAGE_SIZE + 1))).toBe(2)
  })
  it('real-device scale: 19943 lines becomes 20 pages', () => {
    expect(logPageCount(mkLines(19943))).toBe(20)
  })
  it('a single trailing newline terminates the last line, it is not a line of its own', () => {
    // Counting the trailing '\n' as an empty line would make 1000 lines report as 1001,
    // i.e. a spurious second page.
    expect(logPageCount(mkLines(LOG_PAGE_SIZE) + '\n')).toBe(1)
  })
})

describe('logPage', () => {
  it('page 1 is the NEWEST 1000 lines (numbered from the tail, not from the start of the file)', () => {
    const lines = logPage(mkLines(2500), 1).split('\n')
    expect(lines.length).toBe(LOG_PAGE_SIZE)
    expect(lines[0]).toContain('\tline 1500')
    expect(lines[LOG_PAGE_SIZE - 1]).toContain('\tline 2499')
  })
  it('page 2 continues straight back from page 1, with no overlap and no gap', () => {
    const text = mkLines(2500)
    const p1 = logPage(text, 1)
    const p2 = logPage(text, 2)
    expect(p2.split('\n')[0]).toContain('\tline 500')
    expect(p2.split('\n')[LOG_PAGE_SIZE - 1]).toContain('\tline 1499')
    // Joined they must equal exactly the last 2000 lines -- this one assertion catches
    // both failure modes: overlapping pages and skipped lines.
    expect(p2 + '\n' + p1).toBe(mkLines(2500).split('\n').slice(500).join('\n'))
  })
  it('the last page is the oldest slice and may be short', () => {
    const lines = logPage(mkLines(2500), 3).split('\n')
    expect(lines.length).toBe(500)
    expect(lines[0]).toContain('\tline 0')
    expect(lines[499]).toContain('\tline 499')
  })
  it('out-of-range page numbers are clamped (zero, negative, beyond the last page)', () => {
    const text = mkLines(2500)
    expect(logPage(text, 0)).toBe(logPage(text, 1))
    expect(logPage(text, -5)).toBe(logPage(text, 1))
    expect(logPage(text, 99)).toBe(logPage(text, 3))
  })
  it('an empty log returns an empty string', () => {
    expect(logPage('', 1)).toBe('')
  })
  it('original line order is preserved (not reversed)', () => {
    const lines = logPage(mkLines(1200), 1).split('\n')
    expect(lines[0]).toContain('\tline 200')
    expect(lines[1]).toContain('\tline 201')
  })
})

describe('downloadLogsUrl', () => {
  it('carries the token query parameter (recognized by the backend Skipper at route/v2.go:77)', () => {
    expect(downloadLogsUrl('abc.def')).toBe('/v2/nimoos/health/logs?token=abc.def')
  })
  it('special characters in the token are encoded', () => {
    expect(downloadLogsUrl('a+b/c')).toBe('/v2/nimoos/health/logs?token=a%2Bb%2Fc')
  })
  it('does not append a query string when there is no token', () => {
    expect(downloadLogsUrl(null)).toBe('/v2/nimoos/health/logs')
  })
})
