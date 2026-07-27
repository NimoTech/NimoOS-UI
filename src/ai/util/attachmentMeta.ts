// 1:1 移植自 Vue2 src/views/AI/Agent/shell/AgentComposer.vue:
//   TEXT_EXTS/DOCUMENT_EXTS/ACCEPT_TYPES        :160-171
//   docErrorLabel/docErrorShort (extract_error → label maps) :460-486
//   500 MB per-file limit                       :531
//
// docErrorKey/docErrorShortKey return i18n KEY NAMES, not translated text —
// the actual zh_cn/en_us strings are added by a later task (they don't exist
// yet in this repo's locale files).

// Mirrors agent/attachments/kind.py: text whitelist + native image/video/audio
// MIME majors + document extensions. Used as the <input accept=...> hint so
// the OS picker doesn't have to enumerate every plugin handler — and as the
// tooltip text shown to the user. Keep in sync with the backend or
// classify() will still call most things "binary".
export const TEXT_EXTS: string[] = [
  'txt', 'md', 'csv', 'json', 'log',
  'py', 'js', 'ts', 'go', 'rs', 'java', 'c', 'h', 'cpp',
  'yaml', 'yml', 'ini', 'toml', 'conf',
  'html', 'css', 'xml', 'sql', 'sh',
]

export const DOCUMENT_EXTS: string[] = ['pdf', 'docx', 'xlsx', 'xlsm', 'pptx']

export const ACCEPT_TYPES: string = [
  'image/*', 'video/*', 'audio/*',
  ...TEXT_EXTS.map((e) => '.' + e),
  ...DOCUMENT_EXTS.map((e) => '.' + e),
].join(',')

/** Single-attachment size limit: 500 MB (AgentComposer.vue:531). */
export const MAX_ATTACHMENT_BYTES: number = 500 * 1024 * 1024

export type PendingKind = 'image' | 'document' | 'binary' | 'text' | 'video' | 'audio' | string

// Maps backend extract_error codes (agent/attachments/extract.py) to i18n
// key names. Codes are authoritative from AgentComposer.vue:461-470/475-484.
const DOC_ERROR_KEYS: Record<string, string> = {
  empty_scanned: 'aiDocErrEmptyScanned',
  encrypted: 'aiDocErrEncrypted',
  zip_bomb: 'aiDocErrZipBomb',
  timeout: 'aiDocErrTimeout',
  parse_error: 'aiDocErrParseError',
  sidecar_write_failed: 'aiDocErrSidecarWriteFailed',
  not_installed: 'aiDocErrNotInstalled',
  vanished: 'aiDocErrVanished',
}

const DOC_ERROR_SHORT_KEYS: Record<string, string> = {
  empty_scanned: 'aiDocErrShortScannedDoc',
  encrypted: 'aiDocErrShortEncrypted',
  zip_bomb: 'aiDocErrShortTooLarge',
  timeout: 'aiDocErrShortTimedOut',
  parse_error: 'aiDocErrShortParseFailed',
  sidecar_write_failed: 'aiDocErrShortCacheFailed',
  not_installed: 'aiDocErrShortParserMissing',
  vanished: 'aiDocErrShortLost',
}

/** Full-sentence label key for an `extract_error` code (docErrorLabel,
 *  AgentComposer.vue:460-472). Unknown codes fall back to the generic
 *  "Document extraction failed: {code}" key, carrying `code` as an i18n param
 *  (mirrors the Vue2 `this.$t('Document extraction failed: {code}', { code })` fallback). */
export function docErrorKey(code: string): { key: string; params?: Record<string, unknown> } {
  const key = DOC_ERROR_KEYS[code]
  if (key) return { key }
  return { key: 'aiDocErrGeneric', params: { code } }
}

/** ≤6-char short label key for an `extract_error` code (docErrorShort,
 *  AgentComposer.vue:474-486). Unknown codes fall back to the generic
 *  "Parse failed" short key. */
export function docErrorShortKey(code: string): string {
  return DOC_ERROR_SHORT_KEYS[code] || 'aiDocErrShortParse'
}
