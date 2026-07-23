// 1:1 移植目标:Vue2 src/views/AI/Agent/services/openInApp.js 的
// __tests__/openInApp.spec.js。断言逐条照搬,仅按 openInApp.ts 顶部注释调整两处
// 落点差异(New-UI 相对 Vue2 的真实行为,不是本文件的改动):
//   - 文件类:Vue2 落 `/#/files?...`(root-mounted),New-UI 落
//     `/app/#/files?...`(New-UI 自己的 Files 页,SP4 已收官)。
//   - 照片类:两边都落 `/#/photos?...` —— New-UI 暂借道旧 Vue2 Photos 页
//     (SP7 相册区尚未合并到本分支),保持不变。
import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  fileDirAndName,
  photosAssetUrl,
  filesPathUrl,
  openPhotoInNewTab,
  openFileInNewTab,
  photosSetUrl,
  openPhotoSetInNewTab,
} from './openInApp'

describe('fileDirAndName', () => {
  it('splits a normal absolute file path', () => {
    expect(fileDirAndName('/DATA/a/b.txt')).toEqual({ dir: '/DATA/a', name: 'b.txt' })
  })
  it('handles a bare filename with no directory', () => {
    expect(fileDirAndName('foo.txt')).toEqual({ dir: 'foo.txt', name: 'foo.txt' })
  })
  it('strips a trailing slash (directory form)', () => {
    expect(fileDirAndName('/DATA/a/')).toEqual({ dir: '/DATA', name: 'a' })
  })
  it('handles a top-level entry', () => {
    expect(fileDirAndName('/DATA')).toEqual({ dir: '/', name: 'DATA' })
  })
  it('handles the root path', () => {
    expect(fileDirAndName('/')).toEqual({ dir: '/', name: '' })
  })
  it('handles multiple trailing slashes', () => {
    expect(fileDirAndName('/DATA//')).toEqual({ dir: '/', name: 'DATA' })
  })
  it('handles empty / null / undefined / non-string input', () => {
    expect(fileDirAndName('')).toEqual({ dir: '/', name: '' })
    expect(fileDirAndName(null)).toEqual({ dir: '/', name: '' })
    expect(fileDirAndName(undefined)).toEqual({ dir: '/', name: '' })
    // @ts-expect-error deliberately exercising the runtime typeof-guard with a non-string
    expect(fileDirAndName(123)).toEqual({ dir: '/', name: '' })
  })
  it('splits paths with spaces and unicode', () => {
    expect(fileDirAndName('/DATA/我的 文件/报告.pdf')).toEqual({ dir: '/DATA/我的 文件', name: '报告.pdf' })
  })
})

describe('photosAssetUrl / filesPathUrl', () => {
  it('builds a photos asset url with encoding (still root-mounted /#/photos)', () => {
    expect(photosAssetUrl('abc 123')).toBe('/#/photos?asset=abc%20123')
  })
  it('builds a files url encoding dir and name, under New-UI /app/ mount', () => {
    expect(filesPathUrl('/DATA/a b', 'c&d.txt')).toBe('/app/#/files?path=%2FDATA%2Fa%20b&highlight=c%26d.txt')
  })
})

describe('openPhotoInNewTab / openFileInNewTab', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('opens the photos url in a new tab', () => {
    const spy = vi.spyOn(window, 'open').mockImplementation(() => null)
    openPhotoInNewTab('a1')
    expect(spy).toHaveBeenCalledWith('/#/photos?asset=a1', '_blank')
  })
  it('does nothing when the asset id is empty', () => {
    const spy = vi.spyOn(window, 'open').mockImplementation(() => null)
    openPhotoInNewTab('')
    expect(spy).not.toHaveBeenCalled()
  })
  it('does nothing when the asset id is null/undefined', () => {
    const spy = vi.spyOn(window, 'open').mockImplementation(() => null)
    openPhotoInNewTab(null)
    openPhotoInNewTab(undefined)
    expect(spy).not.toHaveBeenCalled()
  })
  it('opens the files url in a new tab, under New-UI /app/ mount', () => {
    const spy = vi.spyOn(window, 'open').mockImplementation(() => null)
    openFileInNewTab('/DATA/docs/report.pdf')
    expect(spy).toHaveBeenCalledWith('/app/#/files?path=%2FDATA%2Fdocs&highlight=report.pdf', '_blank')
  })
  it('does nothing when the file path is empty', () => {
    const spy = vi.spyOn(window, 'open').mockImplementation(() => null)
    openFileInNewTab('')
    expect(spy).not.toHaveBeenCalled()
  })
  it('does nothing when the file path is null/undefined', () => {
    const spy = vi.spyOn(window, 'open').mockImplementation(() => null)
    openFileInNewTab(null)
    openFileInNewTab(undefined)
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('photosSetUrl', () => {
  it('builds a photoset url encoding token and active (still root-mounted /#/photos)', () => {
    expect(photosSetUrl('tok 1', 'a&b')).toBe('/#/photos?photoset=tok%201&active=a%26b')
  })
})

describe('openPhotoSetInNewTab', () => {
  afterEach(() => { vi.restoreAllMocks(); localStorage.clear() })

  it('stores the id set and opens a photoset url with the active id', () => {
    const spy = vi.spyOn(window, 'open').mockImplementation(() => null)
    openPhotoSetInNewTab(['a', 'b', 'c'], 'b')
    expect(spy).toHaveBeenCalledTimes(1)
    const [url, target] = spy.mock.calls[0]
    expect(target).toBe('_blank')
    expect(url).toMatch(/^\/#\/photos\?photoset=.+&active=b$/)
    // the stored entry holds the full ordered id list
    const m = (url as string).match(/photoset=([^&]+)&/)
    const token = decodeURIComponent(m![1])
    expect(JSON.parse(localStorage.getItem('nimo:photoset:' + token)!)).toEqual({ ids: ['a', 'b', 'c'] })
  })

  it('defaults active to the first id when activeId is missing or not in the set', () => {
    const spy = vi.spyOn(window, 'open').mockImplementation(() => null)
    openPhotoSetInNewTab(['x', 'y'], null)
    expect(spy.mock.calls[0][0]).toMatch(/&active=x$/)
    openPhotoSetInNewTab(['x', 'y'], 'zzz')
    expect(spy.mock.calls[1][0]).toMatch(/&active=x$/)
  })

  it('falls back to a single-asset open when the set is empty but an active id is given', () => {
    const spy = vi.spyOn(window, 'open').mockImplementation(() => null)
    openPhotoSetInNewTab([], 'solo')
    expect(spy).toHaveBeenCalledWith('/#/photos?asset=solo', '_blank')
  })

  it('does nothing when the set is empty and there is no active id', () => {
    const spy = vi.spyOn(window, 'open').mockImplementation(() => null)
    openPhotoSetInNewTab([], null)
    expect(spy).not.toHaveBeenCalled()
  })

  it('degrades to a single-asset open when localStorage.setItem throws', () => {
    const setSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    openPhotoSetInNewTab(['a', 'b'], 'a')
    expect(openSpy).toHaveBeenCalledWith('/#/photos?asset=a', '_blank')
    setSpy.mockRestore()
  })

  it('prunes stale photoset entries (older than 2 minutes) before writing a new one', () => {
    vi.spyOn(window, 'open').mockImplementation(() => null)
    const now = Date.now()
    localStorage.setItem('nimo:photoset:' + (now - 200000) + '_stale', JSON.stringify({ ids: ['old'] }))
    localStorage.setItem('nimo:photoset:notanumber', JSON.stringify({ ids: ['bad'] }))
    localStorage.setItem('nimo:photoset:' + (now - 1000) + '_fresh', JSON.stringify({ ids: ['fresh'] }))

    openPhotoSetInNewTab(['a'], 'a')

    expect(localStorage.getItem('nimo:photoset:' + (now - 200000) + '_stale')).toBeNull()
    expect(localStorage.getItem('nimo:photoset:notanumber')).toBeNull()
    expect(localStorage.getItem('nimo:photoset:' + (now - 1000) + '_fresh')).not.toBeNull()
  })
})
