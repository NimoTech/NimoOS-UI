import { fileExt } from './ext'

// 扩展名 → 图标名(逐字移植自 Vue2 mixins/mixin.js typeMap)
const TYPE_MAP: Record<string, string[]> = {
  'image-x-generic': ['png', 'jpg', 'jpeg', 'bmp', 'gif', 'webp', 'svg', 'tiff'],
  'video-x-generic': ['mkv', 'mp4', '3gp', 'avi', 'm2ts', 'webm', 'flv', 'vob', 'ts', 'mts', 'mov', 'wmv', 'rm', 'rmvb', 'asf', 'mpg', 'm4v', 'mpeg', 'f4v'],
  'audio-x-generic': ['aac', 'aiff', 'alac', 'amr', 'ape', 'flac', 'm4a', 'mp3', 'ogg', 'opus', 'wma', 'wav'],
  'text-x-generic': ['txt', 'log', 'pages', 'conf', 'config', 'list', 'ini', 'toml', 'cfg', 'rc', 'env', 'service', 'conf.d', 'htaccess', 'gitconfig', 'vim', 'curlrc', 'wgetrc', 'gitignore'],
  'text-markdown': ['md'],
  'text-css': ['php', 'css', 'less', 'scss', 'sass', 'aspx', 'lua', 'vue', 'js', 'go', 'asp', 'bat', 'c', 'cpp', 'cs', 'json', 'py', 'perl', 'sh', 'xml', 'yaml', 'vb', 'vbs', 'sql', 'swift', 'rust', 'rs', 'jsp', 'yml', 'r', 'pl', 'rb', 'src', 'h', 'tex', 'rtf', 'jsonld', 'ttl', 'n3', 'rss', 'atom', 'srt', 'ass', 'tsv', 'vcard', 'asc', 'url', 'diff', 'plaintext'],
  'text-html': ['html', 'htm', 'shtml', 'shtm'],
  'application-vnd.ms-word': ['doc', 'docx', 'wps'],
  'application-vnd.ms-excel': ['xls', 'xlsx', 'csv'],
  'application-vnd.ms-powerpoint': ['ppt', 'pptx'],
  'application-pdf': ['pdf'],
  'application-photoshop': ['psd', 'psb'],
  'application-illustrator': ['ai', 'eps'],
  'application-x-wine-extension-cpl': ['exe'],
  'application-apk': ['apk'],
  'application-x-zip': ['zip', 'rar', '7z', 'gz', 'ace', 'xz'],
  'application-x-cd-image': ['iso', 'img', 'vmdk', 'raw', 'vhd'],
  'application-x-apple': ['dmg', 'ipa', 'pkg'],
  'application-x-pem-key': ['pem', 'crt', 'ca-bundle', 'p7b', 'p7s', 'der', 'cer', 'pfx', 'p12'],
  'text-x-cmake': ['makefile', 'cmake', 'dockerfile'],
  'text-dockerfile': ['dockerfile'],
}

// 反向索引:ext → iconName(一次构建)
const EXT_TO_ICON: Record<string, string> = {}
for (const [icon, exts] of Object.entries(TYPE_MAP)) {
  for (const e of exts) EXT_TO_ICON[e] = icon
}

// 图片扩展集(供 isImage 复用,来源同 typeMap 的 image-x-generic)
export const IMAGE_EXTS: ReadonlySet<string> = new Set(TYPE_MAP['image-x-generic'])

const FOLDER_BY_NAME: Record<string, string> = {
  AppData: 'folder-application',
  Media: 'folder-video',
  Downloads: 'folder-download',
  Documents: 'folder-documents',
  Gallery: 'folder-pictures',
}

export function iconNameFor(entry: { name: string; is_dir: boolean; type?: string }): string {
  if (entry.is_dir) {
    const t = entry.type
    if (t === 'application') return 'folder-application'
    if (t === 'usb') return 'folder-usb'
    if (t && ['sata', 'nvme', 'spi', 'sas'].includes(t)) return 'folder-hdd'
    if (t === 'home') return 'folder-root'
    if (FOLDER_BY_NAME[entry.name]) return FOLDER_BY_NAME[entry.name]
    return 'folder-default'
  }
  return EXT_TO_ICON[fileExt(entry.name)] || 'unknown'
}

// Vite: eager-glob 所有图标为 URL
const ICONS = import.meta.glob('../assets/icons/*.svg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
const URL_BY_NAME: Record<string, string> = {}
for (const [path, url] of Object.entries(ICONS)) {
  const m = path.match(/\/([^/]+)\.svg$/)
  if (m) URL_BY_NAME[m[1]] = url
}

export function iconUrl(iconName: string): string {
  return URL_BY_NAME[iconName] || URL_BY_NAME['unknown']
}
