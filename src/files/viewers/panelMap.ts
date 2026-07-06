import { fileExt } from '../util/ext'
import { IMAGE_X_GENERIC, AUDIO_X_GENERIC, TEXT_X_GENERIC, TEXT_MARKDOWN, TEXT_CSS, TEXT_HTML, TEXT_X_CMAKE, TEXT_DOCKERFILE } from '../util/fileCategories'

export type PanelType = 'image-viewer' | 'code-editor' | 'video-player' | 'markdown'

// 播放白名单(Vue2 mixin.js:33-40)——视频图标覆盖更广,但播放器只认这 5 个
const browserPlayableVideo = ['mp4', 'm4v', 'webm', 'mov', '3gp']

function union(...groups: string[][]): string[] {
  return Array.from(new Set(groups.flat()))
}

// Vue2 filePanelMap(mixin.js:43-51),markdown 键启用(spec D-MD);分类数组单一真源见 ../util/fileCategories
const filePanelMap: Record<PanelType, string[]> = {
  'code-editor': union(TEXT_X_GENERIC, TEXT_CSS, TEXT_HTML, TEXT_X_CMAKE, TEXT_DOCKERFILE),
  'video-player': union(browserPlayableVideo, AUDIO_X_GENERIC),
  'image-viewer': IMAGE_X_GENERIC,
  'markdown': TEXT_MARKDOWN,
}

export function getPanelType(name: string): PanelType | null {
  const ext = fileExt(name) // 已小写
  // 与 Vue2 getPanelType 一致:遍历映射,命中返回其键
  for (const key of Object.keys(filePanelMap) as PanelType[]) {
    if (filePanelMap[key].includes(ext)) return key
  }
  return null
}
