import { describe, it, expect, beforeEach } from 'vitest'
import { useViewer } from './useViewer'
import type { FileEntry } from '../stores/files'

const img: FileEntry = { name: 'a.png', path: '/DATA/a.png', is_dir: false }
const zip: FileEntry = { name: 'a.zip', path: '/DATA/a.zip', is_dir: false }

describe('useViewer', () => {
  beforeEach(() => useViewer().close())
  it('Hit viewer → openItem returns true and opens', () => {
    const v = useViewer()
    expect(v.openItem(img, [img, zip])).toBe(true)
    expect(v.open.value).toBe(true)
    expect(v.panelType.value).toBe('image-viewer')
    expect(v.currentItem.value).toStrictEqual(img)
    expect(v.list.value).toEqual([img, zip])
  })
  it('Miss → openItem returns false and does not open', () => {
    const v = useViewer()
    expect(v.openItem(zip, [zip])).toBe(false)
    expect(v.open.value).toBe(false)
  })
  it('close resets', () => {
    const v = useViewer()
    v.openItem(img, [img])
    v.close()
    expect(v.open.value).toBe(false)
    expect(v.panelType.value).toBeNull()
    expect(v.currentItem.value).toBeNull()
  })
  it('Singleton: multiple calls share state', () => {
    useViewer().openItem(img, [img])
    expect(useViewer().open.value).toBe(true)
  })
})
