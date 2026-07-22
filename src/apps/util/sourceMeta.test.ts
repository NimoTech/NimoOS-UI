import { describe, it, expect } from 'vitest'
import { sourceDisplayName, isOfficialSource } from './sourceMeta'

describe('sourceMeta', () => {
  it('http(s) URL 名称 = 第一段路径(Vue2 逐字规则)', () => {
    expect(sourceDisplayName('https://github.com/WisdomSky/CasaOS-Coolstore/archive/main.zip')).toBe('WisdomSky')
    expect(sourceDisplayName('https://github.com/NimoTech/NimoOS-AppStore/archive/refs/heads/main.zip')).toBe('NimoTech')
  })

  it('非 http URL 名称 = 最后一段去扩展名', () => {
    expect(sourceDisplayName('ftp://host/path/store.zip')).toBe('store')
  })

  it('解析不了的字符串回退自身(去扩展名规则)', () => {
    expect(sourceDisplayName('not a url')).toBe('not a url')
  })

  it('官方源:http(s) 第一段路径 === NimoTech', () => {
    expect(isOfficialSource('https://github.com/NimoTech/NimoOS-AppStore/archive/refs/heads/main.zip')).toBe(true)
    expect(isOfficialSource('https://github.com/WisdomSky/CasaOS-Coolstore/archive/main.zip')).toBe(false)
    expect(isOfficialSource('not a url')).toBe(false)
  })
})
