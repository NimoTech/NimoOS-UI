// 1:1 Port from Vue2 src/views/AI/Agent/shell/AgentComposer.vue:160-171 / 460-504 / 531
import { describe, it, expect } from 'vitest'
import { TEXT_EXTS, DOCUMENT_EXTS, ACCEPT_TYPES, MAX_ATTACHMENT_BYTES, docErrorKey, docErrorShortKey } from './attachmentMeta'

// Inline copy of the Vue2 accept-types build (AgentComposer.vue:167-171) to compare
// against verbatim, so a future edit to either side gets caught immediately.
const VUE2_TEXT_EXTS = [
  'txt', 'md', 'csv', 'json', 'log',
  'py', 'js', 'ts', 'go', 'rs', 'java', 'c', 'h', 'cpp',
  'yaml', 'yml', 'ini', 'toml', 'conf',
  'html', 'css', 'xml', 'sql', 'sh',
]
const VUE2_DOCUMENT_EXTS = ['pdf', 'docx', 'xlsx', 'xlsm', 'pptx']
const VUE2_ACCEPT_TYPES = [
  'image/*', 'video/*', 'audio/*',
  ...VUE2_TEXT_EXTS.map((e) => '.' + e),
  ...VUE2_DOCUMENT_EXTS.map((e) => '.' + e),
].join(',')

describe('attachmentMeta constants (AgentComposer.vue:160-171)', () => {
  it('TEXT_EXTS/DOCUMENT_EXTS match Vue2 exactly', () => {
    expect(TEXT_EXTS).toEqual(VUE2_TEXT_EXTS)
    expect(DOCUMENT_EXTS).toEqual(VUE2_DOCUMENT_EXTS)
  })
  it('ACCEPT_TYPES matches Vue2 original string exactly', () => {
    expect(ACCEPT_TYPES).toBe(VUE2_ACCEPT_TYPES)
  })
  it('MAX_ATTACHMENT_BYTES === 524288000 (500 MB, AgentComposer.vue:531)', () => {
    expect(MAX_ATTACHMENT_BYTES).toBe(524288000)
  })
})

describe('docErrorKey (AgentComposer.vue:460-471 docErrorLabel)', () => {
  it('8 extract_error codes each map to independent i18n keys', () => {
    expect(docErrorKey('empty_scanned')).toEqual({ key: 'aiDocErrEmptyScanned' })
    expect(docErrorKey('encrypted')).toEqual({ key: 'aiDocErrEncrypted' })
    expect(docErrorKey('zip_bomb')).toEqual({ key: 'aiDocErrZipBomb' })
    expect(docErrorKey('timeout')).toEqual({ key: 'aiDocErrTimeout' })
    expect(docErrorKey('parse_error')).toEqual({ key: 'aiDocErrParseError' })
    expect(docErrorKey('sidecar_write_failed')).toEqual({ key: 'aiDocErrSidecarWriteFailed' })
    expect(docErrorKey('not_installed')).toEqual({ key: 'aiDocErrNotInstalled' })
    expect(docErrorKey('vanished')).toEqual({ key: 'aiDocErrVanished' })
  })
  it('unknown code falls to aiDocErrGeneric with { code } param', () => {
    expect(docErrorKey('some_new_code')).toEqual({ key: 'aiDocErrGeneric', params: { code: 'some_new_code' } })
  })
})

describe('docErrorShortKey (AgentComposer.vue:474-486 docErrorShort)', () => {
  it('8 mappings', () => {
    expect(docErrorShortKey('empty_scanned')).toBe('aiDocErrShortScannedDoc')
    expect(docErrorShortKey('encrypted')).toBe('aiDocErrShortEncrypted')
    expect(docErrorShortKey('zip_bomb')).toBe('aiDocErrShortTooLarge')
    expect(docErrorShortKey('timeout')).toBe('aiDocErrShortTimedOut')
    expect(docErrorShortKey('parse_error')).toBe('aiDocErrShortParseFailed')
    expect(docErrorShortKey('sidecar_write_failed')).toBe('aiDocErrShortCacheFailed')
    expect(docErrorShortKey('not_installed')).toBe('aiDocErrShortParserMissing')
    expect(docErrorShortKey('vanished')).toBe('aiDocErrShortLost')
  })
  it('unknown code falls to aiDocErrShortParse', () => {
    expect(docErrorShortKey('some_new_code')).toBe('aiDocErrShortParse')
  })
})
