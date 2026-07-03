import { describe, it, expect, beforeEach } from 'vitest'
import { triggerIframeDownload } from './iframeDownload'

describe('triggerIframeDownload', () => {
  beforeEach(() => { document.body.innerHTML = '' })

  it('首次调用创建一个隐藏 iframe 并设 src', () => {
    triggerIframeDownload('/v3/file?token=t&path=%2FDATA%2Fa.txt')
    const frames = document.body.querySelectorAll('iframe')
    expect(frames).toHaveLength(1)
    const f = frames[0] as HTMLIFrameElement
    expect(f.style.display).toBe('none')
    expect(f.src).toContain('/v3/file?token=t&path=%2FDATA%2Fa.txt')
  })

  it('二次调用复用同一 iframe,只更新 src(不新增)', () => {
    triggerIframeDownload('/v3/file?token=t&path=%2FDATA%2Fa.txt')
    triggerIframeDownload('/v1/batch?token=t&files=%2FDATA%2FDocs')
    const frames = document.body.querySelectorAll('iframe')
    expect(frames).toHaveLength(1)
    expect((frames[0] as HTMLIFrameElement).src).toContain('/v1/batch?token=t&files=%2FDATA%2FDocs')
  })

  it('iframe 被移出 DOM 后再次调用 → 重新创建一个新 iframe(不复用已脱离 DOM 的旧引用)', () => {
    triggerIframeDownload('/v3/file?token=t&path=%2FDATA%2Fa.txt')
    document.body.innerHTML = ''
    triggerIframeDownload('/v1/batch?token=t&files=%2FDATA%2FDocs')
    const frames = document.body.querySelectorAll('iframe')
    expect(frames).toHaveLength(1)
    expect((frames[0] as HTMLIFrameElement).src).toContain('/v1/batch?token=t&files=%2FDATA%2FDocs')
  })
})
