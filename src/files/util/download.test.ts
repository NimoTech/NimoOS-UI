import { describe, it, expect } from 'vitest'
import { planDownload, shouldRefreshBeforeDownload } from './download'

describe('planDownload', () => {
  it('Single file (non-directory) → /v3/file plan, with real path', () => {
    expect(planDownload([{ path: '/DATA/a.txt', is_dir: false }]))
      .toEqual({ kind: 'file', path: '/DATA/a.txt' })
  })

  it('Single directory → /v1/batch plan, files=real path of that directory', () => {
    expect(planDownload([{ path: '/DATA/Docs', is_dir: true }]))
      .toEqual({ kind: 'batch', files: '/DATA/Docs' })
  })

  it('Multiple selection → /v1/batch plan, files=comma-separated real paths (preserve original order)', () => {
    expect(planDownload([
      { path: '/DATA/a.txt', is_dir: false },
      { path: '/DATA/Docs', is_dir: true },
    ])).toEqual({ kind: 'batch', files: '/DATA/a.txt,/DATA/Docs' })
  })
})

describe('shouldRefreshBeforeDownload', () => {
  const now = 1_000_000_000_000 // fixed now (ms)
  it('expires_at missing (null) → conservative refresh', () => {
    expect(shouldRefreshBeforeDownload(null, now)).toBe(true)
  })
  it('Already expired → refresh', () => {
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
