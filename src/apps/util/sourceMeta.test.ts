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

  it('官方源:出厂默认主店(jsDelivr IceWhaleTech/CasaOS-AppStore)', () => {
    expect(isOfficialSource('https://cdn.jsdelivr.net/gh/IceWhaleTech/CasaOS-AppStore@gh-pages/store/main.zip')).toBe(true)
    // 同 org 其它仓 / 其它 org 的 jsDelivr 源不是官方
    expect(isOfficialSource('https://cdn.jsdelivr.net/gh/IceWhaleTech/OtherRepo@main/store.zip')).toBe(false)
    expect(isOfficialSource('https://cdn.jsdelivr.net/gh/bigbeartechworld/big-bear-casaos@master/store.zip')).toBe(false)
  })

  it('jsDelivr gh 镜像名称 = org(首段 gh 无辨识度)', () => {
    expect(sourceDisplayName('https://cdn.jsdelivr.net/gh/IceWhaleTech/CasaOS-AppStore@gh-pages/store/main.zip')).toBe('IceWhaleTech')
    expect(sourceDisplayName('https://cdn.jsdelivr.net/gh/bigbeartechworld/big-bear-casaos@master/store.zip')).toBe('bigbeartechworld')
  })
})
