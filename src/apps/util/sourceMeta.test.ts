import { describe, it, expect } from 'vitest'
import { sourceDisplayName, isOfficialSource } from './sourceMeta'

describe('sourceMeta', () => {
  it('http(s) URL name = first path segment (Vue2 exact rule)', () => {
    expect(sourceDisplayName('https://github.com/WisdomSky/CasaOS-Coolstore/archive/main.zip')).toBe('WisdomSky')
    expect(sourceDisplayName('https://github.com/NimoTech/NimoOS-AppStore/archive/refs/heads/main.zip')).toBe('NimoTech')
  })

  it('non-http URL name = last segment minus extension', () => {
    expect(sourceDisplayName('ftp://host/path/store.zip')).toBe('store')
  })

  it('unparseable string falls back to itself (minus extension rule)', () => {
    expect(sourceDisplayName('not a url')).toBe('not a url')
  })

  it('official source: http(s) first path segment === NimoTech', () => {
    expect(isOfficialSource('https://github.com/NimoTech/NimoOS-AppStore/archive/refs/heads/main.zip')).toBe(true)
    expect(isOfficialSource('https://github.com/WisdomSky/CasaOS-Coolstore/archive/main.zip')).toBe(false)
    expect(isOfficialSource('not a url')).toBe(false)
  })

  it('official source: factory default main store (jsDelivr IceWhaleTech/CasaOS-AppStore)', () => {
    expect(isOfficialSource('https://cdn.jsdelivr.net/gh/IceWhaleTech/CasaOS-AppStore@gh-pages/store/main.zip')).toBe(true)
    // jsDelivr sources for other repos in the same org / other orgs are not official
    expect(isOfficialSource('https://cdn.jsdelivr.net/gh/IceWhaleTech/OtherRepo@main/store.zip')).toBe(false)
    expect(isOfficialSource('https://cdn.jsdelivr.net/gh/bigbeartechworld/big-bear-casaos@master/store.zip')).toBe(false)
  })

  it('jsDelivr gh mirror name = org (first segment gh has no distinction)', () => {
    expect(sourceDisplayName('https://cdn.jsdelivr.net/gh/IceWhaleTech/CasaOS-AppStore@gh-pages/store/main.zip')).toBe('IceWhaleTech')
    expect(sourceDisplayName('https://cdn.jsdelivr.net/gh/bigbeartechworld/big-bear-casaos@master/store.zip')).toBe('bigbeartechworld')
  })
})
