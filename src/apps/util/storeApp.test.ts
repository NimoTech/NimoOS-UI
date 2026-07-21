import { describe, it, expect } from 'vitest'
import { mapStoreApp, filterStoreApps, type StoreApp } from './storeApp'

// 真机形态(Jellyfin x-casaos 样本裁剪)
const RAW = {
  title: { en_us: 'Jellyfin' },
  tagline: { en_us: 'The personal Media System', zh_cn: '个人媒体系统' },
  icon: 'https://cdn/icon.png',
  thumbnail: 'https://cdn/thumbnail.png',
  category: 'Media',
} as never

describe('mapStoreApp', () => {
  it('按 lang 归一化,title 缺 zh_cn 落 en_us,icon/thumbnail/category 透传', () => {
    expect(mapStoreApp('jellyfin', RAW, 'zh_cn')).toEqual({
      id: 'jellyfin', title: 'Jellyfin', tagline: '个人媒体系统',
      icon: 'https://cdn/icon.png', thumbnail: 'https://cdn/thumbnail.png', category: 'Media',
      architectures: [], tips: undefined,
    })
  })
  it('全缺字段不炸:title 退 id,其余空串', () => {
    expect(mapStoreApp('ghost', {} as never, 'zh_cn')).toEqual({
      id: 'ghost', title: 'ghost', tagline: '', icon: '', thumbnail: '', category: '',
      architectures: [], tips: undefined,
    })
  })
  it('mapStoreApp 透传 architectures/tips,非法形态退化', () => {
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
  it('空格分词 OR 匹配 title+tagline,大小写不敏感(Vue2 同款)', () => {
    expect(filterStoreApps(items, 'jelly').map((x) => x.id)).toEqual(['a'])
    expect(filterStoreApps(items, '媒体').map((x) => x.id)).toEqual(['a'])
    expect(filterStoreApps(items, 'SYNC jelly').map((x) => x.id)).toEqual(['a', 'b']) // OR
    expect(filterStoreApps(items, '')).toBe(items)
    expect(filterStoreApps(items, '  ')).toBe(items)
  })
})
