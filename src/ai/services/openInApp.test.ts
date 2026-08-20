// 1:1 port target: Vue2 src/views/AI/Agent/services/openInApp.js's
// __tests__/openInApp.spec.js. Assertions copied verbatim, adjusted per openInApp.ts top
// comments for two landing point differences (New-UI's actual behavior relative to Vue2,
// not file changes):
//   - Files: Vue2 lands at `/#/files?...` (root-mounted), New-UI lands at
//     `/app/#/files?...` (New-UI's own Files page, SP4 complete).
//   - Photos: both land at `/#/photos?...` — New-UI temporarily uses old Vue2 Photos page
//     (SP7 photo gallery not yet merged to this branch), unchanged.
//
// SP8-P5d Task 5 (governance §16): add openDirInNewTab / agentSessionUrl /
// openAgentSessionInNewTab test cases for three new exports. agentSessionUrl group **has
// no** landing point differences — decision A-8 requires pointing verbatim to old Vue2 app
// `/#/ai/agent?session=…` (no `/app` prefix), see corresponding note in openInApp.ts.
import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  fileDirAndName,
  photosAssetUrl,
  filesPathUrl,
  openPhotoInNewTab,
  openFileInNewTab,
  openDirInNewTab,
  photosSetUrl,
  openPhotoSetInNewTab,
  agentSessionUrl,
  openAgentSessionInNewTab,
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

// SP8-P5d Task 5: openDirInNewTab (governance §16 item 1) — verbatim copy from blueprint
// openInApp.js:52-55, reuses existing filesPathUrl from repo (/app/ mount point),
// highlight segment always passes empty string.
describe('openDirInNewTab', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('opens the directory url (no highlight) in a new tab, under New-UI /app/ mount', () => {
    const spy = vi.spyOn(window, 'open').mockImplementation(() => null)
    openDirInNewTab('/DATA/Notes')
    expect(spy).toHaveBeenCalledWith('/app/#/files?path=%2FDATA%2FNotes&highlight=', '_blank')
  })
  it('does nothing when the dir path is empty', () => {
    const spy = vi.spyOn(window, 'open').mockImplementation(() => null)
    openDirInNewTab('')
    expect(spy).not.toHaveBeenCalled()
  })
  it('does nothing when the dir path is null/undefined', () => {
    const spy = vi.spyOn(window, 'open').mockImplementation(() => null)
    openDirInNewTab(null)
    openDirInNewTab(undefined)
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

// SP8-P5d Task 5 / A-8 closed 2026-08-19: New-UI's /ai/agent now honours ?session=
// (see docs/superpowers/specs/2026-08-19-agent-session-deeplink-design.md), so these two
// functions land inside New-UI at /app.
// 🔴 Forward assertion: URL verbatim + reverse assertion "does not equal the root-mounted
// old Vue2 URL" — the reverse assertion is what discriminates: if someone reverts the landing
// point to /#/ai/agent, users leave New-UI on every "open source conversation" click, which
// the forward assertion alone could miss by string coincidence.
describe('agentSessionUrl / openAgentSessionInNewTab', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('builds a URL pointing at New-UI (mounted at /app)', () => {
    expect(agentSessionUrl('sess 1')).toBe('/app/#/ai/agent?session=sess%201')
  })
  it('does NOT point at the root-mounted old Vue2 app (reverse assertion, guards against a silent regression)', () => {
    expect(agentSessionUrl('sess 1')).not.toBe('/#/ai/agent?session=sess%201')
  })
  it('encodes special characters in the session id', () => {
    expect(agentSessionUrl('a&b c')).toBe('/app/#/ai/agent?session=a%26b%20c')
  })

  it('opens the agent session url in a new tab', () => {
    const spy = vi.spyOn(window, 'open').mockImplementation(() => null)
    openAgentSessionInNewTab('sess-1')
    expect(spy).toHaveBeenCalledWith('/app/#/ai/agent?session=sess-1', '_blank')
  })
  it('the opened url is NOT the root-mounted old Vue2 route (reverse assertion)', () => {
    const spy = vi.spyOn(window, 'open').mockImplementation(() => null)
    openAgentSessionInNewTab('sess-1')
    expect(spy.mock.calls[0][0]).not.toBe('/#/ai/agent?session=sess-1')
  })
  it('does nothing when the session id is empty', () => {
    const spy = vi.spyOn(window, 'open').mockImplementation(() => null)
    openAgentSessionInNewTab('')
    expect(spy).not.toHaveBeenCalled()
  })
  it('does nothing when the session id is null/undefined', () => {
    const spy = vi.spyOn(window, 'open').mockImplementation(() => null)
    openAgentSessionInNewTab(null)
    openAgentSessionInNewTab(undefined)
    expect(spy).not.toHaveBeenCalled()
  })
})
