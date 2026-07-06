import { fileExt } from '../util/ext'

const VIDEO = ['mp4', 'm4v', 'webm', 'mov', '3gp'] // 播放白名单(Vue2 browserPlayableVideo)
const AUDIO = ['aac', 'aiff', 'alac', 'amr', 'ape', 'flac', 'm4a', 'mp3', 'ogg', 'opus', 'wma', 'wav']

export function mediaKind(name: string): 'video' | 'audio' | null {
  const e = fileExt(name)
  if (VIDEO.includes(e)) return 'video'
  if (AUDIO.includes(e)) return 'audio'
  return null
}
