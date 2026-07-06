import { fileExt } from '../util/ext'

export type PanelType = 'image-viewer' | 'code-editor' | 'video-player' | 'markdown'

// 逐字移植 Vue2 mixin.js typeMap(仅 P4a 相关组)
const typeMap: Record<string, string[]> = {
  'image-x-generic': ['png', 'jpg', 'jpeg', 'bmp', 'gif', 'webp', 'svg', 'tiff'],
  'audio-x-generic': ['aac', 'aiff', 'alac', 'amr', 'ape', 'flac', 'm4a', 'mp3', 'ogg', 'opus', 'wma', 'wav'],
  'text-x-generic': ['txt', 'log', 'pages', 'conf', 'config', 'list', 'ini', 'toml', 'cfg', 'rc', 'env', 'service', 'conf.d', 'htaccess', 'gitconfig', 'vim', 'curlrc', 'wgetrc', 'gitignore'],
  'text-markdown': ['md'],
  'text-css': ['php', 'css', 'less', 'scss', 'sass', 'aspx', 'lua', 'vue', 'js', 'go', 'asp', 'bat', 'c', 'cpp', 'cs', 'json', 'py', 'perl', 'sh', 'xml', 'yaml', 'vb', 'vbs', 'sql', 'swift', 'rust', 'rs', 'jsp', 'yml', 'r', 'pl', 'rb', 'src', 'h', 'tex', 'rtf', 'jsonld', 'ttl', 'n3', 'rss', 'atom', 'srt', 'ass', 'tsv', 'vcard', 'asc', 'url', 'diff', 'plaintext'],
  'text-html': ['html', 'htm', 'shtml', 'shtm'],
  'text-x-cmake': ['makefile', 'cmake', 'dockerfile'],
  'text-dockerfile': ['dockerfile'],
}

// 播放白名单(Vue2 mixin.js:33-40)——视频图标覆盖更广,但播放器只认这 5 个
const browserPlayableVideo = ['mp4', 'm4v', 'webm', 'mov', '3gp']

function union(...groups: string[][]): string[] {
  return Array.from(new Set(groups.flat()))
}

// Vue2 filePanelMap(mixin.js:43-51),markdown 键启用(spec D-MD)
const filePanelMap: Record<PanelType, string[]> = {
  'code-editor': union(typeMap['text-x-generic'], typeMap['text-css'], typeMap['text-html'], typeMap['text-x-cmake'], typeMap['text-dockerfile']),
  'video-player': union(browserPlayableVideo, typeMap['audio-x-generic']),
  'image-viewer': typeMap['image-x-generic'],
  'markdown': typeMap['text-markdown'],
}

export function getPanelType(name: string): PanelType | null {
  const ext = fileExt(name) // 已小写
  // 与 Vue2 getPanelType 一致:遍历映射,命中返回其键
  for (const key of Object.keys(filePanelMap) as PanelType[]) {
    if (filePanelMap[key].includes(ext)) return key
  }
  return null
}
