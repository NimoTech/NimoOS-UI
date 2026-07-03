import { describe, it, expect } from 'vitest'
import { planDownload, shouldRefreshBeforeDownload } from './download'

describe('planDownload', () => {
  it('单个文件(非目录)→ /v3/file 计划,带真实路径', () => {
    expect(planDownload([{ path: '/DATA/a.txt', is_dir: false }]))
      .toEqual({ kind: 'file', path: '/DATA/a.txt' })
  })

  it('单个目录 → /v1/batch 计划,files=该目录真实路径', () => {
    expect(planDownload([{ path: '/DATA/Docs', is_dir: true }]))
      .toEqual({ kind: 'batch', files: '/DATA/Docs' })
  })

  it('多选 → /v1/batch 计划,files=逗号连接真实路径(保留原顺序)', () => {
    expect(planDownload([
      { path: '/DATA/a.txt', is_dir: false },
      { path: '/DATA/Docs', is_dir: true },
    ])).toEqual({ kind: 'batch', files: '/DATA/a.txt,/DATA/Docs' })
  })
})

describe('shouldRefreshBeforeDownload', () => {
  const now = 1_000_000_000_000 // 固定 now(ms)
  it('expires_at 缺失(null)→ 保守刷新', () => {
    expect(shouldRefreshBeforeDownload(null, now)).toBe(true)
  })
  it('已过期 → 刷新', () => {
    const expiredSec = Math.floor(now / 1000) - 10
    expect(shouldRefreshBeforeDownload(expiredSec, now)).toBe(true)
  })
  it('≤60s 内过期 → 刷新', () => {
    const soonSec = Math.floor(now / 1000) + 30 // 30s 后过期,进 60s 缓冲
    expect(shouldRefreshBeforeDownload(soonSec, now)).toBe(true)
  })
  it('充裕(>60s)→ 不刷新', () => {
    const farSec = Math.floor(now / 1000) + 3600 // 1h 后过期
    expect(shouldRefreshBeforeDownload(farSec, now)).toBe(false)
  })
  it('expires_at 非法(NaN)→ 保守刷新', () => {
    expect(shouldRefreshBeforeDownload(NaN, now)).toBe(true)
  })
})
