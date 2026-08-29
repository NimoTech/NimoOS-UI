import { describe, it, expect, beforeEach } from 'vitest'
import { triggerIframeDownload } from './iframeDownload'

describe('triggerIframeDownload', () => {
  beforeEach(() => { document.body.innerHTML = '' })

  it('first call creates a hidden iframe and sets src', () => {
    triggerIframeDownload('/v3/file?token=t&path=%2FDATA%2Fa.txt')
    const frames = document.body.querySelectorAll('iframe')
    expect(frames).toHaveLength(1)
    const f = frames[0] as HTMLIFrameElement
    expect(f.style.display).toBe('none')
    expect(f.src).toContain('/v3/file?token=t&path=%2FDATA%2Fa.txt')
  })

  it('second call reuses the same iframe, only updates src (does not create a new one)', () => {
    triggerIframeDownload('/v3/file?token=t&path=%2FDATA%2Fa.txt')
    triggerIframeDownload('/v1/batch?token=t&files=%2FDATA%2FDocs')
    const frames = document.body.querySelectorAll('iframe')
    expect(frames).toHaveLength(1)
    expect((frames[0] as HTMLIFrameElement).src).toContain('/v1/batch?token=t&files=%2FDATA%2FDocs')
  })

  it('after iframe is removed from DOM and called again → creates a new iframe (does not reuse the detached reference)', () => {
    triggerIframeDownload('/v3/file?token=t&path=%2FDATA%2Fa.txt')
    document.body.innerHTML = ''
    triggerIframeDownload('/v1/batch?token=t&files=%2FDATA%2FDocs')
    const frames = document.body.querySelectorAll('iframe')
    expect(frames).toHaveLength(1)
    expect((frames[0] as HTMLIFrameElement).src).toContain('/v1/batch?token=t&files=%2FDATA%2FDocs')
  })
})
