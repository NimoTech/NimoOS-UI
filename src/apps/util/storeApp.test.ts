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
    })
  })
  it('全缺字段不炸:title 退 id,其余空串', () => {
    expect(mapStoreApp('ghost', {} as never, 'zh_cn')).toEqual({
      id: 'ghost', title: 'ghost', tagline: '', icon: '', thumbnail: '', category: '',
    })
  })
})

describe('filterStoreApps', () => {
  const items: StoreApp[] = [
    { id: 'a', title: 'Jellyfin', tagline: '个人媒体系统', icon: '', thumbnail: '', category: 'Media' },
    { id: 'b', title: 'Nextcloud', tagline: 'File sync', icon: '', thumbnail: '', category: 'Cloud' },
  ]
  it('空格分词 OR 匹配 title+tagline,大小写不敏感(Vue2 同款)', () => {
    expect(filterStoreApps(items, 'jelly').map((x) => x.id)).toEqual(['a'])
    expect(filterStoreApps(items, '媒体').map((x) => x.id)).toEqual(['a'])
    expect(filterStoreApps(items, 'SYNC jelly').map((x) => x.id)).toEqual(['a', 'b']) // OR
    expect(filterStoreApps(items, '')).toBe(items)
    expect(filterStoreApps(items, '  ')).toBe(items)
  })
})
