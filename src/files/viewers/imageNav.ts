// 图片翻页/过滤纯逻辑,复刻 Vue2 filebrowser/viewers/ImageViewer.vue 的
// XIMAGES 常量 + filterImages/getCurrentImageIndex。
import { fileExt } from '../util/ext'
import type { FileEntry } from '../stores/files'

const XIMAGES = ['png', 'jpg', 'jpeg', 'bmp', 'gif', 'webp', 'svg', 'tiff']

export function filterImages(list: FileEntry[]): FileEntry[] {
  return list.filter(i => !i.is_dir && XIMAGES.includes(fileExt(i.name)))
}

export function imageIndex(items: FileEntry[], current: FileEntry): number {
  const i = items.findIndex(x => x.path === current.path)
  return i < 0 ? 0 : i
}
