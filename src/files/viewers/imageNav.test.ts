import { describe, it, expect } from 'vitest'
import { filterImages, imageIndex } from './imageNav'
import type { FileEntry } from '../stores/files'

const mk = (name: string, is_dir = false): FileEntry => ({ name, path: '/DATA/' + name, is_dir })
const list = [mk('a.png'), mk('sub', true), mk('b.txt'), mk('c.JPG'), mk('d.gif')]

describe('imageNav', () => {
  it('filterImages 仅保留图片、去目录', () => {
    expect(filterImages(list).map(i => i.name)).toEqual(['a.png', 'c.JPG', 'd.gif'])
  })
  it('imageIndex 定位当前项', () => {
    const imgs = filterImages(list)
    expect(imageIndex(imgs, imgs[1])).toBe(1)
  })
  it('imageIndex 找不到返回 0', () => {
    const imgs = filterImages(list)
    expect(imageIndex(imgs, mk('z.png'))).toBe(0)
  })
})
