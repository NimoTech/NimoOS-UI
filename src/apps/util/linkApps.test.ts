import { describe, it, expect, vi, beforeEach } from 'vitest'

const getCustomStorage = vi.fn()
const setCustomStorage = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: { users: {
    getCustomStorage: (k: string) => getCustomStorage(k),
    setCustomStorage: (k: string, d: unknown) => setCustomStorage(k, d),
  } },
}))

import { parseLinkApps, listLinkApps, saveLinkApp, deleteLinkApp } from './linkApps'

describe('parseLinkApps', () => {
  it('empty-string data (curl-verified empty custom storage) → []', () => {
    expect(parseLinkApps('')).toEqual([])
  })
  it('null/undefined → []', () => {
    expect(parseLinkApps(null)).toEqual([])
    expect(parseLinkApps(undefined)).toEqual([])
  })
  it('non-array object → []', () => {
    expect(parseLinkApps({ foo: 'bar' })).toEqual([])
  })
  it('array of well-formed items passes through', () => {
    const raw = [{ name: 'MyNAS', hostname: 'http://nas.local', icon: 'http://x/i.png', app_type: 'LinkApp', status: 'running' }]
    expect(parseLinkApps(raw)).toEqual(raw)
  })
  it('JSON-string of an array is parsed (Vue2 setLinkAppList stores JSON.stringify)', () => {
    const raw = JSON.stringify([{ name: 'A', hostname: 'http://a', icon: '' }])
    expect(parseLinkApps(raw)).toEqual([{ name: 'A', hostname: 'http://a', icon: '', app_type: 'LinkApp', status: 'running' }])
  })
  it('malformed JSON string → []', () => {
    expect(parseLinkApps('not json{')).toEqual([])
  })
  it('legacy field migration: type→app_type, host→hostname, state→status', () => {
    const raw = [{ name: 'Old', host: 'http://old', type: 'LinkApp', state: 'running' }]
    expect(parseLinkApps(raw)).toEqual([{ name: 'Old', hostname: 'http://old', icon: '', app_type: 'LinkApp', status: 'running' }])
  })
  it('missing icon defaults to empty string', () => {
    expect(parseLinkApps([{ name: 'A', hostname: 'http://a' }])).toEqual([
      { name: 'A', hostname: 'http://a', icon: '', app_type: 'LinkApp', status: 'running' },
    ])
  })
  it('dedupe by name, first wins', () => {
    const raw = [
      { name: 'A', hostname: 'http://first' },
      { name: 'A', hostname: 'http://second' },
    ]
    expect(parseLinkApps(raw)).toEqual([{ name: 'A', hostname: 'http://first', icon: '', app_type: 'LinkApp', status: 'running' }])
  })
  it('drops entries missing name or hostname', () => {
    const raw = [
      { hostname: 'http://no-name' },
      { name: 'no-hostname' },
      { name: '', hostname: 'http://empty-name' },
      { name: 'ok', hostname: '' },
    ]
    expect(parseLinkApps(raw)).toEqual([])
  })
  it('non-object array entries are skipped', () => {
    expect(parseLinkApps(['x', 42, null, { name: 'ok', hostname: 'http://ok' }])).toEqual([
      { name: 'ok', hostname: 'http://ok', icon: '', app_type: 'LinkApp', status: 'running' },
    ])
  })
})

describe('listLinkApps', () => {
  beforeEach(() => { getCustomStorage.mockReset(); setCustomStorage.mockReset().mockResolvedValue(undefined) })

  it('get + parse: empty string → []', async () => {
    getCustomStorage.mockResolvedValue('')
    expect(await listLinkApps()).toEqual([])
    expect(getCustomStorage).toHaveBeenCalledWith('link')
  })

  it('get + parse: array passes through', async () => {
    getCustomStorage.mockResolvedValue([{ name: 'A', hostname: 'http://a' }])
    expect(await listLinkApps()).toEqual([{ name: 'A', hostname: 'http://a', icon: '', app_type: 'LinkApp', status: 'running' }])
  })

  it('any error degrades to []', async () => {
    getCustomStorage.mockRejectedValue(new Error('network'))
    expect(await listLinkApps()).toEqual([])
  })
})

describe('saveLinkApp', () => {
  beforeEach(() => { getCustomStorage.mockReset(); setCustomStorage.mockReset().mockResolvedValue(undefined) })

  it('appends a new entry when name not present', async () => {
    getCustomStorage.mockResolvedValue([{ name: 'A', hostname: 'http://a', icon: '' }])
    const result = await saveLinkApp({ name: 'B', hostname: 'http://b', icon: 'http://b/icon.png' })
    expect(result).toEqual([
      { name: 'A', hostname: 'http://a', icon: '', app_type: 'LinkApp', status: 'running' },
      { name: 'B', hostname: 'http://b', icon: 'http://b/icon.png', app_type: 'LinkApp', status: 'running' },
    ])
    expect(setCustomStorage).toHaveBeenCalledWith('link', result)
  })

  it('replaces hostname/icon in place for a same-name entry (Vue2 connect() semantics)', async () => {
    getCustomStorage.mockResolvedValue([{ name: 'A', hostname: 'http://old', icon: 'http://old/i.png' }])
    const result = await saveLinkApp({ name: 'A', hostname: 'http://new', icon: 'http://new/i.png' })
    expect(result).toEqual([{ name: 'A', hostname: 'http://new', icon: 'http://new/i.png', app_type: 'LinkApp', status: 'running' }])
  })
})

describe('deleteLinkApp', () => {
  beforeEach(() => { getCustomStorage.mockReset(); setCustomStorage.mockReset().mockResolvedValue(undefined) })

  it('filters the named entry out and persists', async () => {
    getCustomStorage.mockResolvedValue([{ name: 'A', hostname: 'http://a' }, { name: 'B', hostname: 'http://b' }])
    const result = await deleteLinkApp('A')
    expect(result).toEqual([{ name: 'B', hostname: 'http://b', icon: '', app_type: 'LinkApp', status: 'running' }])
    expect(setCustomStorage).toHaveBeenCalledWith('link', result)
  })
})
