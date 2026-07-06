import { describe, it, expect } from 'vitest'
import { mediaKind } from './mediaKind'

describe('mediaKind', () => {
  it('可播放视频 → video', () => {
    for (const n of ['a.mp4', 'b.m4v', 'c.webm', 'd.mov', 'e.3gp']) expect(mediaKind(n)).toBe('video')
  })
  it('音频 → audio', () => {
    for (const n of ['a.mp3', 'b.flac', 'c.wav', 'd.m4a', 'e.ogg']) expect(mediaKind(n)).toBe('audio')
  })
  it('不可播放容器 / 未知 → null', () => {
    expect(mediaKind('a.mkv')).toBeNull()
    expect(mediaKind('a.txt')).toBeNull()
  })
})
