import { describe, it, expect } from 'vitest'
import { formatSysLog, downloadLogsUrl } from './sysLog'

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
