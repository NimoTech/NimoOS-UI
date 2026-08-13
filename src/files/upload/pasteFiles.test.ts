import { describe, it, expect } from 'vitest'
import { extractClipboardFiles } from './pasteFiles'

// Build a minimal DataTransfer stub: only the files property is needed (screenshots/copied files in a
// paste event both show up in clipboardData.files); the items fallback path is covered by a separate stub.
function dtWithFiles(files: File[]): DataTransfer {
  return { files, items: [] } as unknown as DataTransfer
}

const NOW = new Date(2026, 6, 21, 15, 30, 0) // 2026-07-21 15:30:00 (months are 0-based)

describe('extractClipboardFiles', () => {
  it('null DataTransfer returns empty array', () => {
    expect(extractClipboardFiles(null, '粘贴图片', NOW)).toEqual([])
  })

  it('plain text clipboard (no files) returns empty array', () => {
    expect(extractClipboardFiles(dtWithFiles([]), '粘贴图片', NOW)).toEqual([])
  })

  it('unnamed screenshot is named by baseName+timestamp, extension from MIME', () => {
    const blob = new File([new Uint8Array([1])], '', { type: 'image/png' })
    const out = extractClipboardFiles(dtWithFiles([blob]), '粘贴图片', NOW)
    expect(out).toHaveLength(1)
    expect(out[0].relativePath).toBe('粘贴图片 2026-07-21 15-30-00.png')
    expect(out[0].file.name).toBe('粘贴图片 2026-07-21 15-30-00.png')
    expect(out[0].file.type).toBe('image/png')
  })

  it('browser placeholder name image.png is also treated as unnamed and renamed', () => {
    const blob = new File([new Uint8Array([1])], 'image.png', { type: 'image/png' })
    const out = extractClipboardFiles(dtWithFiles([blob]), '粘贴图片', NOW)
    expect(out[0].relativePath).toBe('粘贴图片 2026-07-21 15-30-00.png')
  })

  it('jpeg MIME gets .jpg extension', () => {
    const blob = new File([new Uint8Array([1])], '', { type: 'image/jpeg' })
    const out = extractClipboardFiles(dtWithFiles([blob]), '粘贴图片', NOW)
    expect(out[0].relativePath).toBe('粘贴图片 2026-07-21 15-30-00.jpg')
  })

  it('multiple unnamed images in same batch get sequence numbers, do not collide', () => {
    const a = new File([new Uint8Array([1])], '', { type: 'image/png' })
    const b = new File([new Uint8Array([2])], '', { type: 'image/png' })
    const out = extractClipboardFiles(dtWithFiles([a, b]), '粘贴图片', NOW)
    expect(out[0].relativePath).toBe('粘贴图片 2026-07-21 15-30-00.png')
    expect(out[1].relativePath).toBe('粘贴图片 2026-07-21 15-30-00 (2).png')
  })

  it('copied real files keep original name', () => {
    const f = new File([new Uint8Array([1])], '报告.pdf', { type: 'application/pdf' })
    const out = extractClipboardFiles(dtWithFiles([f]), '粘贴图片', NOW)
    expect(out[0].relativePath).toBe('报告.pdf')
    expect(out[0].file).toBe(f) // named files don't get a rebuilt File object
  })

  it('when files is empty, fallback to items(kind=file)', () => {
    const f = new File([new Uint8Array([1])], '', { type: 'image/png' })
    const dt = {
      files: [],
      items: [
        { kind: 'string', getAsFile: () => null },
        { kind: 'file', getAsFile: () => f },
      ],
    } as unknown as DataTransfer
    const out = extractClipboardFiles(dt, '粘贴图片', NOW)
    expect(out).toHaveLength(1)
    expect(out[0].relativePath).toBe('粘贴图片 2026-07-21 15-30-00.png')
  })
})
