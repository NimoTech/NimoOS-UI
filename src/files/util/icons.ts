import { fileExt } from './ext'
import {
  IMAGE_X_GENERIC,
  VIDEO_X_GENERIC,
  AUDIO_X_GENERIC,
  TEXT_X_GENERIC,
  TEXT_MARKDOWN,
  TEXT_CSS,
  TEXT_HTML,
  APPLICATION_VND_MS_WORD,
  APPLICATION_VND_MS_EXCEL,
  APPLICATION_VND_MS_POWERPOINT,
  APPLICATION_PDF,
  APPLICATION_PHOTOSHOP,
  APPLICATION_ILLUSTRATOR,
  APPLICATION_X_WINE_EXTENSION_CPL,
  APPLICATION_APK,
  APPLICATION_X_ZIP,
  APPLICATION_X_CD_IMAGE,
  APPLICATION_X_APPLE,
  APPLICATION_X_PEM_KEY,
  TEXT_X_CMAKE,
  TEXT_DOCKERFILE,
} from './fileCategories'

// Extension → icon name (ported verbatim from Vue2 mixins/mixin.js typeMap; single source of truth for category arrays is ./fileCategories)
const TYPE_MAP: Record<string, string[]> = {
  'image-x-generic': IMAGE_X_GENERIC,
  'video-x-generic': VIDEO_X_GENERIC,
  'audio-x-generic': AUDIO_X_GENERIC,
  'text-x-generic': TEXT_X_GENERIC,
  'text-markdown': TEXT_MARKDOWN,
  'text-css': TEXT_CSS,
  'text-html': TEXT_HTML,
  'application-vnd.ms-word': APPLICATION_VND_MS_WORD,
  'application-vnd.ms-excel': APPLICATION_VND_MS_EXCEL,
  'application-vnd.ms-powerpoint': APPLICATION_VND_MS_POWERPOINT,
  'application-pdf': APPLICATION_PDF,
  'application-photoshop': APPLICATION_PHOTOSHOP,
  'application-illustrator': APPLICATION_ILLUSTRATOR,
  'application-x-wine-extension-cpl': APPLICATION_X_WINE_EXTENSION_CPL,
  'application-apk': APPLICATION_APK,
  'application-x-zip': APPLICATION_X_ZIP,
  'application-x-cd-image': APPLICATION_X_CD_IMAGE,
  'application-x-apple': APPLICATION_X_APPLE,
  'application-x-pem-key': APPLICATION_X_PEM_KEY,
  'text-x-cmake': TEXT_X_CMAKE,
  'text-dockerfile': TEXT_DOCKERFILE,
}

// Reverse index: ext → iconName (built once)
const EXT_TO_ICON: Record<string, string> = {}
for (const [icon, exts] of Object.entries(TYPE_MAP)) {
  for (const e of exts) EXT_TO_ICON[e] = icon
}

// Image extension set (for isImage reuse; source same as typeMap's image-x-generic)
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

// Vite: eager-glob all icons to URLs
const ICONS = import.meta.glob('../assets/icons/*.svg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
const URL_BY_NAME: Record<string, string> = {}
for (const [path, url] of Object.entries(ICONS)) {
  const m = path.match(/\/([^/]+)\.svg$/)
  if (m) URL_BY_NAME[m[1]] = url
}

export function iconUrl(iconName: string): string {
  return URL_BY_NAME[iconName] || URL_BY_NAME['unknown']
}
