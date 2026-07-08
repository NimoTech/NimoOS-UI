import { describe, it, expect, afterEach, vi } from 'vitest'
import { copyText } from './clipboard'

describe('copyText', () => {
  const origClipboard = (navigator as unknown as { clipboard: unknown }).clipboard
  const origExec = document.execCommand

  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', { value: origClipboard, configurable: true, writable: true })
    document.execCommand = origExec
    vi.restoreAllMocks()
  })

  it('uses navigator.clipboard.writeText in a secure context', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    await copyText('/NimoOS-HD/a')
    expect(writeText).toHaveBeenCalledWith('/NimoOS-HD/a')
  })

  it('falls back to execCommand when navigator.clipboard is undefined (insecure HTTP context)', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    let copied = ''
    document.execCommand = vi.fn(() => {
      copied = document.querySelector('textarea')?.value ?? ''
      return true
    }) as typeof document.execCommand
    await copyText('/NimoOS-HD/Gallery/x.jpg')
    expect(document.execCommand).toHaveBeenCalledWith('copy')
    expect(copied).toBe('/NimoOS-HD/Gallery/x.jpg')
    // temporary textarea is cleaned up afterwards
    expect(document.querySelector('textarea')).toBeNull()
  })

  it('falls back to execCommand when writeText rejects', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'))
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    document.execCommand = vi.fn(() => true) as typeof document.execCommand
    await copyText('abc')
    expect(writeText).toHaveBeenCalled()
    expect(document.execCommand).toHaveBeenCalledWith('copy')
  })

  it('throws when both clipboard API and execCommand fail (so the caller can surface an error)', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    document.execCommand = vi.fn(() => false) as typeof document.execCommand
    await expect(copyText('x')).rejects.toThrow()
  })
})
