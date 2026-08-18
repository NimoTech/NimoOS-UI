import { describe, it, expect } from 'vitest'
import { mediaKind } from './mediaKind'

describe('mediaKind', () => {
  it('Playable video → video', () => {
    for (const n of ['a.mp4', 'b.m4v', 'c.webm', 'd.mov', 'e.3gp']) expect(mediaKind(n)).toBe('video')
  })
  it('Audio → audio', () => {
    for (const n of ['a.mp3', 'b.flac', 'c.wav', 'd.m4a', 'e.ogg']) expect(mediaKind(n)).toBe('audio')
  })
  it('Unplayable container / unknown → null', () => {
    expect(mediaKind('a.mkv')).toBeNull()
    expect(mediaKind('a.txt')).toBeNull()
  })
})
