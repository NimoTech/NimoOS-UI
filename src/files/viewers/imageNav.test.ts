import { describe, it, expect } from 'vitest'
import { filterImages, imageIndex } from './imageNav'
import type { FileEntry } from '../stores/files'

const mk = (name: string, is_dir = false): FileEntry => ({ name, path: '/DATA/' + name, is_dir })
const list = [mk('a.png'), mk('sub', true), mk('b.txt'), mk('c.JPG'), mk('d.gif')]

describe('imageNav', () => {
  it('filterImages keeps only images and removes directories', () => {
    expect(filterImages(list).map(i => i.name)).toEqual(['a.png', 'c.JPG', 'd.gif'])
  })
  it('imageIndex locates the current item', () => {
    const imgs = filterImages(list)
    expect(imageIndex(imgs, imgs[1])).toBe(1)
  })
  it('imageIndex returns 0 when not found', () => {
    const imgs = filterImages(list)
    expect(imageIndex(imgs, mk('z.png'))).toBe(0)
  })
})
