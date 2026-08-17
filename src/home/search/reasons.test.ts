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
  it('Filename exactly equal (ignore case) → filename hit primary', () => {
    expect(filenameReason(fn('Receipt.pdf'), 'receipt.pdf')).toEqual({ key: 'searchReasonFilename', kind: 'primary' })
  })

  it('Query is substring of filename (ignore case) → filename hit primary', () => {
    expect(filenameReason(fn("Nick's receipt.jpg"), 'RECEIPT')).toEqual({ key: 'searchReasonFilename', kind: 'primary' })
  })

  it('Neither exact nor substring (backend fuzzy match) → filename-related semantic', () => {
    // Real test: query="how to cook" backend returns cookies.py (match=1.5). Supplementary rule A1.
    expect(filenameReason(fn('cookies.py'), 'how to cook')).toEqual({ key: 'searchReasonFilenameFuzzy', kind: 'semantic' })
  })

  it('Query leading/trailing whitespace does not affect judgment', () => {
    expect(filenameReason(fn('Receipt.pdf'), '  receipt  ')).toEqual({ key: 'searchReasonFilename', kind: 'primary' })
  })
})

describe('semanticReason', () => {
  it('kind=body → body hit normal', () => {
    expect(semanticReason(sem('body', 'the fish was fresh'), 'fish')).toEqual({ key: 'searchReasonBody', kind: 'normal' })
  })
  it('kind=transcript → transcript hit normal', () => {
    expect(semanticReason(sem('transcript', 'today we caught fish'), 'fish')).toEqual({ key: 'searchReasonTranscript', kind: 'normal' })
  })
  it('kind=ocr → image text hit normal', () => {
    expect(semanticReason(sem('ocr', 'HOME DEPOT receipt'), 'receipt')).toEqual({ key: 'searchReasonOcr', kind: 'normal' })
  })
  it('kind=caption → image content hit semantic', () => {
    expect(semanticReason(sem('caption', 'a plate of food'), 'fish')).toEqual({ key: 'searchReasonCaption', kind: 'semantic' })
  })
  it('Query does not appear in preview.text → semantic-related semantic (even if kind=body)', () => {
    expect(semanticReason(sem('body', 'salmon and tuna, no literal match'), 'fish')).toEqual({ key: 'searchReasonSemantic', kind: 'semantic' })
  })
  it('Unknown kind (summary etc.) → semantic-related semantic', () => {
    expect(semanticReason(sem('summary', 'this document is about fish'), 'fish')).toEqual({ key: 'searchReasonSemantic', kind: 'semantic' })
  })
  it('preview.text is empty → semantic-related (cannot judge literal hit)', () => {
    expect(semanticReason(sem('body', ''), 'fish')).toEqual({ key: 'searchReasonSemantic', kind: 'semantic' })
  })
})

describe('imageReason', () => {
  it('images source = CLIP image content hit, reuse caption label', () => {
    expect(imageReason()).toEqual({ key: 'searchReasonCaption', kind: 'semantic' })
  })
})
