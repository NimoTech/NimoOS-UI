import { IMAGE_EXTS } from './icons'
import { fileExt } from './ext'

export function isImageEntry(entry: { name: string; is_dir: boolean }): boolean {
  return !entry.is_dir && IMAGE_EXTS.has(fileExt(entry.name))
}
