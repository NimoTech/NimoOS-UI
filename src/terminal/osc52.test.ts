import { describe, it, expect, vi, afterEach } from 'vitest'
import { decodeOsc52, writeClipboard } from './osc52'

const b64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s)))

describe('decodeOsc52', () => {
  it('decodes the base64 payload after the selection field, including UTF-8', () => {
    expect(decodeOsc52('c;' + b64('ls -la'))).toBe('ls -la')
    expect(decodeOsc52('c;' + b64('目录 /DATA'))).toBe('目录 /DATA')
    expect(decodeOsc52(';' + b64('x'))).toBe('x')
  })
  it('returns null for queries, empty and malformed payloads', () => {
    expect(decodeOsc52('c;?')).toBeNull()
    expect(decodeOsc52('c;')).toBeNull()
    expect(decodeOsc52('c')).toBeNull()
    expect(decodeOsc52('c;***')).toBeNull()
  })
})

describe('writeClipboard', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  it('prefers navigator.clipboard when present', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    await writeClipboard('hi', document)
    expect(writeText).toHaveBeenCalledWith('hi')
  })

  it('falls back to execCommand("copy") on a textarea inside the given document and cleans up', async () => {
    vi.stubGlobal('navigator', {})
    const exec = vi.fn(() => { expect(document.querySelector('textarea')?.value).toBe('echo hi'); return true })
    ;(document as Document & { execCommand: typeof exec }).execCommand = exec
    await writeClipboard('echo hi', document)
    expect(exec).toHaveBeenCalledWith('copy')
    expect(document.querySelector('textarea')).toBeNull()
  })

  it('throws when execCommand reports failure', async () => {
    vi.stubGlobal('navigator', {})
    ;(document as Document & { execCommand: () => boolean }).execCommand = () => false
    await expect(writeClipboard('x', document)).rejects.toThrow()
    expect(document.querySelector('textarea')).toBeNull()
  })
})
