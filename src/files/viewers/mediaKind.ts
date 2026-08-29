import { fileExt } from '../util/ext'
import { BROWSER_PLAYABLE_VIDEO } from '../util/fileCategories'

const AUDIO = ['aac', 'aiff', 'alac', 'amr', 'ape', 'flac', 'm4a', 'mp3', 'ogg', 'opus', 'wma', 'wav']

export function mediaKind(name: string): 'video' | 'audio' | null {
  const e = fileExt(name)
  if (BROWSER_PLAYABLE_VIDEO.includes(e)) return 'video'
  if (AUDIO.includes(e)) return 'audio'
  return null
}
