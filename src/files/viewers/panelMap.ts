import { fileExt } from '../util/ext'
import { IMAGE_X_GENERIC, AUDIO_X_GENERIC, TEXT_X_GENERIC, TEXT_MARKDOWN, TEXT_CSS, TEXT_HTML, TEXT_X_CMAKE, TEXT_DOCKERFILE, BROWSER_PLAYABLE_VIDEO, APPLICATION_PDF, APPLICATION_VND_MS_WORD, APPLICATION_VND_MS_EXCEL } from '../util/fileCategories'

export type PanelType = 'image-viewer' | 'code-editor' | 'video-player' | 'markdown' | 'pdf-viewer' | 'doc-viewer' | 'excel-viewer'

function union(...groups: string[][]): string[] {
  return Array.from(new Set(groups.flat()))
}

// Vue2 filePanelMap(mixin.js:43-51),markdown 键启用(spec D-MD);分类数组单一真源见 ../util/fileCategories
const filePanelMap: Record<PanelType, string[]> = {
  'code-editor': union(TEXT_X_GENERIC, TEXT_CSS, TEXT_HTML, TEXT_X_CMAKE, TEXT_DOCKERFILE),
  'video-player': union(BROWSER_PLAYABLE_VIDEO, AUDIO_X_GENERIC),
  'image-viewer': IMAGE_X_GENERIC,
  'markdown': TEXT_MARKDOWN,
  'pdf-viewer': APPLICATION_PDF,
  'doc-viewer': APPLICATION_VND_MS_WORD,
  'excel-viewer': APPLICATION_VND_MS_EXCEL,
}

export function getPanelType(name: string): PanelType | null {
  const ext = fileExt(name) // 已小写
  // 与 Vue2 getPanelType 一致:遍历映射,命中返回其键
  for (const key of Object.keys(filePanelMap) as PanelType[]) {
    if (filePanelMap[key].includes(ext)) return key
  }
  return null
}
