import { describe, it, expect } from 'vitest'
import type { FileNameHit, SemanticHit } from '@nimotech/nimoos-service'
import { filenameReason, semanticReason, imageReason } from './reasons'

function fn(name: string, over: Partial<FileNameHit> = {}): FileNameHit {
  return { path: '/DATA/x/' + name, name, ext: '', size: 0, mtimeMs: 0, isDir: false, match: 1, ...over }
}
function sem(kind: string, text: string, over: Partial<SemanticHit> = {}): SemanticHit {
  return {
    score: 0.5, fileId: 'f', paths: [{ rootId: 'r', path: '/DATA/x/a.docx', mtimeMs: 0 }],
    mime: 'application/pdf', kind,
    cite: { page: null, offsetStart: null, offsetEnd: null, frameMsStart: null, frameMsEnd: null, chunkNo: 0 },
    preview: { text }, ...over,
  }
}

describe('filenameReason', () => {
  it('文件名精确相等(忽略大小写)→ 文件名命中 primary', () => {
    expect(filenameReason(fn('Receipt.pdf'), 'receipt.pdf')).toEqual({ key: 'searchReasonFilename', kind: 'primary' })
  })

  it('查询词是文件名子串(忽略大小写)→ 文件名命中 primary', () => {
    expect(filenameReason(fn("Nick's receipt.jpg"), 'RECEIPT')).toEqual({ key: 'searchReasonFilename', kind: 'primary' })
  })

  it('既非精确也非子串(后端模糊命中)→ 文件名相关 semantic', () => {
    // 实测:query="how to cook" 后端会返回 cookies.py(match=1.5)。补充规则 A1。
    expect(filenameReason(fn('cookies.py'), 'how to cook')).toEqual({ key: 'searchReasonFilenameFuzzy', kind: 'semantic' })
  })

  it('查询词首尾空白不影响判定', () => {
    expect(filenameReason(fn('Receipt.pdf'), '  receipt  ')).toEqual({ key: 'searchReasonFilename', kind: 'primary' })
  })
})

describe('semanticReason', () => {
  it('kind=body → 正文命中 normal', () => {
    expect(semanticReason(sem('body', 'the fish was fresh'), 'fish')).toEqual({ key: 'searchReasonBody', kind: 'normal' })
  })
  it('kind=transcript → 转写命中 normal', () => {
    expect(semanticReason(sem('transcript', 'today we caught fish'), 'fish')).toEqual({ key: 'searchReasonTranscript', kind: 'normal' })
  })
  it('kind=ocr → 图片文字命中 normal', () => {
    expect(semanticReason(sem('ocr', 'HOME DEPOT receipt'), 'receipt')).toEqual({ key: 'searchReasonOcr', kind: 'normal' })
  })
  it('kind=caption → 图片内容命中 semantic', () => {
    expect(semanticReason(sem('caption', 'a plate of food'), 'fish')).toEqual({ key: 'searchReasonCaption', kind: 'semantic' })
  })
  it('查询词不出现在 preview.text 里 → 语义相关 semantic(即使 kind=body)', () => {
    expect(semanticReason(sem('body', 'salmon and tuna, no literal match'), 'fish')).toEqual({ key: 'searchReasonSemantic', kind: 'semantic' })
  })
  it('未知 kind(summary 等)→ 语义相关 semantic', () => {
    expect(semanticReason(sem('summary', 'this document is about fish'), 'fish')).toEqual({ key: 'searchReasonSemantic', kind: 'semantic' })
  })
  it('preview.text 为空 → 语义相关(无从判断字面命中)', () => {
    expect(semanticReason(sem('body', ''), 'fish')).toEqual({ key: 'searchReasonSemantic', kind: 'semantic' })
  })
})

describe('imageReason', () => {
  it('images 源 = CLIP 图片内容命中,复用 caption 那个标签', () => {
    expect(imageReason()).toEqual({ key: 'searchReasonCaption', kind: 'semantic' })
  })
})
