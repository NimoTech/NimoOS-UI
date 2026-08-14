import { describe, it, expect } from 'vitest'
import { formatSysLog, downloadLogsUrl, logPage, logPageCount, LOG_PAGE_SIZE } from './sysLog'

// 真机 fixture(2026-08-01 GET /v1/sys/logs 的 data 开头,逐字)
const RAW =
  '2026-04-13T15:38:19.417-0400\tinfo\tInitPathConfig: images path mismatch, self-healing\n' +
  '2026-04-13T15:38:19.417-0400\tinfo\tInitPathConfig: path config saved\n'

describe('formatSysLog', () => {
  it('去掉每行开头 8 个字符的日期前缀(Vue2 的既有显示形态,1:1 照留)', () => {
    const out = formatSysLog(RAW)
    expect(out.startsWith('13T15:38:19.417-0400\tinfo\t')).toBe(true)
    expect(out).toContain('\n13T15:38:19.417-0400\tinfo\tInitPathConfig: path config saved')
  })
  it('不吃掉最后一个字符(Vue2 的 substring(8, len-1) 是 off-by-one)', () => {
    expect(formatSysLog(RAW).endsWith('\n')).toBe(true)
  })
  it('短文本(< 10 字符)原样返回', () => {
    expect(formatSysLog('abc')).toBe('abc')
  })
  it('空输入返回空串', () => {
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
  it('带 token 查询参数(后端 route/v2.go:77 的 Skipper 认它)', () => {
    expect(downloadLogsUrl('abc.def')).toBe('/v2/nimoos/health/logs?token=abc.def')
  })
  it('token 里的特殊字符被编码', () => {
    expect(downloadLogsUrl('a+b/c')).toBe('/v2/nimoos/health/logs?token=a%2Bb%2Fc')
  })
  it('无 token 时不拼查询串', () => {
    expect(downloadLogsUrl(null)).toBe('/v2/nimoos/health/logs')
  })
})
