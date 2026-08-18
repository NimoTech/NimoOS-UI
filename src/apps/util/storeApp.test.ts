import { describe, it, expect } from 'vitest'
import { mapStoreApp, filterStoreApps, type StoreApp } from './storeApp'

// Real-device shape (trimmed from a Jellyfin x-casaos sample)
const RAW = {
  title: { en_us: 'Jellyfin' },
  tagline: { en_us: 'The personal Media System', zh_cn: '个人媒体系统' },
  icon: 'https://cdn/icon.png',
  thumbnail: 'https://cdn/thumbnail.png',
  category: 'Media',
} as never

describe('mapStoreApp', () => {
  it('normalize by lang, title falls back to en_us if zh_cn is missing, icon/thumbnail/category pass-through', () => {
    expect(mapStoreApp('jellyfin', RAW, 'zh_cn')).toEqual({
      id: 'jellyfin', title: 'Jellyfin', tagline: '个人媒体系统',
      icon: 'https://cdn/icon.png', thumbnail: 'https://cdn/thumbnail.png', category: 'Media',
      architectures: [], tips: undefined,
    })
  })
  it('all missing fields do not crash: title falls back to id, rest default to empty string', () => {
    expect(mapStoreApp('ghost', {} as never, 'zh_cn')).toEqual({
      id: 'ghost', title: 'ghost', tagline: '', icon: '', thumbnail: '', category: '',
      architectures: [], tips: undefined,
    })
  })
  it('mapStoreApp passes through architectures/tips, illegal forms degrade', () => {
    const a = mapStoreApp('x', { title: { en_us: 'X' }, architectures: ['amd64'], tips: { before_install: { zh_cn: 'hi' } } } as never, 'zh_cn')
    expect(a.architectures).toEqual(['amd64'])
    expect(a.tips).toEqual({ before_install: { zh_cn: 'hi' } })
    const b = mapStoreApp('y', { title: { en_us: 'Y' }, architectures: 'nope' } as never, 'zh_cn')
    expect(b.architectures).toEqual([])
    expect(b.tips).toBeUndefined()
  })
})

describe('filterStoreApps', () => {
  const items: StoreApp[] = [
    { id: 'a', title: 'Jellyfin', tagline: '个人媒体系统', icon: '', thumbnail: '', category: 'Media', architectures: [], tips: undefined },
    { id: 'b', title: 'Nextcloud', tagline: 'File sync', icon: '', thumbnail: '', category: 'Cloud', architectures: [], tips: undefined },
  ]
  it('space-separated tokens with OR matching on title+tagline, case-insensitive (same as Vue2)', () => {
    expect(filterStoreApps(items, 'jelly').map((x) => x.id)).toEqual(['a'])
    expect(filterStoreApps(items, '媒体').map((x) => x.id)).toEqual(['a'])
    expect(filterStoreApps(items, 'SYNC jelly').map((x) => x.id)).toEqual(['a', 'b']) // OR
    expect(filterStoreApps(items, '')).toBe(items)
    expect(filterStoreApps(items, '  ')).toBe(items)
  })
})
