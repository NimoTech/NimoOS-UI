// Ctrl+V paste upload: extract File from ClipboardEvent.clipboardData. Screenshot blobs
// have no filename by default (or browsers assign unified placeholder names like image.png—
// keeping them causes collisions on every paste). Generate default names using baseName+
// second-level timestamp; keep original names for copied real files. Pure logic, no
// Vue/store dependencies (aligned with dropEntries.ts). Clipboard doesn't carry directory
// structure; relativePath is always the filename.

export interface PastedFile { file: File; relativePath: string }

// Unified placeholder names browsers assign to clipboard images (Chrome/Firefox: image.png, etc.)
const PLACEHOLDER_RE = /^image\.(png|jpe?g|gif|webp|bmp)$/i

const MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
}

function pad(n: number): string { return String(n).padStart(2, '0') }

function stampedName(baseName: string, now: Date, seq: number, ext: string): string {
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
    + ` ${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`
  const suffix = seq > 1 ? ` (${seq})` : ''
  return `${baseName} ${stamp}${suffix}.${ext}`
}

function collectFiles(dt: DataTransfer): File[] {
  const fromFiles = Array.from(dt.files || [])
  if (fromFiles.length) return fromFiles
  const out: File[] = []
  for (const item of Array.from(dt.items || [])) {
    if (item.kind !== 'file') continue
    const f = item.getAsFile()
    if (f) out.push(f)
  }
  return out
}

export function extractClipboardFiles(
  dt: DataTransfer | null,
  baseName: string,
  now: Date,
): PastedFile[] {
  if (!dt) return []
  let seq = 0
  return collectFiles(dt).map((f) => {
    if (f.name && !PLACEHOLDER_RE.test(f.name)) {
      return { file: f, relativePath: f.name }
    }
    seq += 1
    const name = stampedName(baseName, now, seq, MIME_EXT[f.type] || 'png')
    return { file: new File([f], name, { type: f.type }), relativePath: name }
  })
}
