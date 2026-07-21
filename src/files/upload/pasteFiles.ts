// Ctrl+V 粘贴上传:从 ClipboardEvent.clipboardData 提取 File。截图 blob 天生无
// 文件名(或被浏览器给统一占位名 image.png——保留会导致每次粘贴互相撞名),按
// baseName+秒级时间戳生成默认名;复制的真实文件保留原名。纯逻辑,无 Vue/store
// 依赖(对齐 dropEntries.ts)。剪贴板不携带目录结构,relativePath 恒为文件名。

export interface PastedFile { file: File; relativePath: string }

// 各浏览器给剪贴板图片的统一占位名(Chrome/Firefox: image.png 等)
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
