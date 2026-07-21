import { describe, it, expect } from 'vitest'
import { extractClipboardFiles } from './pasteFiles'

// 构造最小 DataTransfer 桩:只需 files 属性(paste 事件里截图/复制文件都出现在
// clipboardData.files);items 兜底路径用另一个桩覆盖。
function dtWithFiles(files: File[]): DataTransfer {
  return { files, items: [] } as unknown as DataTransfer
}

const NOW = new Date(2026, 6, 21, 15, 30, 0) // 2026-07-21 15:30:00(月份从 0 起)

describe('extractClipboardFiles', () => {
  it('null DataTransfer 返回空数组', () => {
    expect(extractClipboardFiles(null, '粘贴图片', NOW)).toEqual([])
  })

  it('纯文本剪贴板(无文件)返回空数组', () => {
    expect(extractClipboardFiles(dtWithFiles([]), '粘贴图片', NOW)).toEqual([])
  })

  it('无名截图按 baseName+时间戳命名,扩展名取自 MIME', () => {
    const blob = new File([new Uint8Array([1])], '', { type: 'image/png' })
    const out = extractClipboardFiles(dtWithFiles([blob]), '粘贴图片', NOW)
    expect(out).toHaveLength(1)
    expect(out[0].relativePath).toBe('粘贴图片 2026-07-21 15-30-00.png')
    expect(out[0].file.name).toBe('粘贴图片 2026-07-21 15-30-00.png')
    expect(out[0].file.type).toBe('image/png')
  })

  it('浏览器占位名 image.png 也视为无名并改名', () => {
    const blob = new File([new Uint8Array([1])], 'image.png', { type: 'image/png' })
    const out = extractClipboardFiles(dtWithFiles([blob]), '粘贴图片', NOW)
    expect(out[0].relativePath).toBe('粘贴图片 2026-07-21 15-30-00.png')
  })

  it('jpeg MIME 得到 .jpg 扩展名', () => {
    const blob = new File([new Uint8Array([1])], '', { type: 'image/jpeg' })
    const out = extractClipboardFiles(dtWithFiles([blob]), '粘贴图片', NOW)
    expect(out[0].relativePath).toBe('粘贴图片 2026-07-21 15-30-00.jpg')
  })

  it('同批次多张无名图片追加序号,互不重名', () => {
    const a = new File([new Uint8Array([1])], '', { type: 'image/png' })
    const b = new File([new Uint8Array([2])], '', { type: 'image/png' })
    const out = extractClipboardFiles(dtWithFiles([a, b]), '粘贴图片', NOW)
    expect(out[0].relativePath).toBe('粘贴图片 2026-07-21 15-30-00.png')
    expect(out[1].relativePath).toBe('粘贴图片 2026-07-21 15-30-00 (2).png')
  })

  it('复制的真实文件保留原名', () => {
    const f = new File([new Uint8Array([1])], '报告.pdf', { type: 'application/pdf' })
    const out = extractClipboardFiles(dtWithFiles([f]), '粘贴图片', NOW)
    expect(out[0].relativePath).toBe('报告.pdf')
    expect(out[0].file).toBe(f) // 有名文件不重建 File 对象
  })

  it('files 为空时兜底走 items(kind=file)', () => {
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
