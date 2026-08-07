import { describe, it, expect } from 'vitest'
import { buildAuthUrl, driverIconUrl } from './cloudAuth'

describe('buildAuthUrl', () => {
  it('把 ${HOST} 替换成设备源(encodeURI,保留 :// )', () => {
    const out = buildAuthUrl('https://p?state=${HOST}%2Fv1%2Frecover%2FDropbox', 'http://192.168.1.10')
    expect(out).toBe('https://p?state=http://192.168.1.10%2Fv1%2Frecover%2FDropbox')
  })
  it('保留 Vue2 的 redirect_uri http%→https% 改写', () => {
    expect(buildAuthUrl('x?redirect_uri=http%3A%2F%2Fh', 'http://h')).toBe('x?redirect_uri=https%3A%2F%2Fh')
  })
})

describe('driverIconUrl', () => {
  const base = import.meta.env.BASE_URL // 构建/测试同一份 vite 配置 ⇒ '/app/'

  it('把后端的站点根路径改挂到本应用 base 下(不再依赖 Vue2 留在站点根的 img/)', () => {
    expect(driverIconUrl('./img/driver/Dropbox.svg', 'http://h')).toBe(`http://h${base}img/driver/Dropbox.svg`)
  })
  it('去掉源尾部斜杠、无前缀点也可', () => {
    expect(driverIconUrl('img/driver/X.svg', 'http://h/')).toBe(`http://h${base}img/driver/X.svg`)
  })
  it('只取文件名 —— 后端换成别的目录层级也照样落到本应用的 img/driver/', () => {
    expect(driverIconUrl('/static/icons/OneDrive.svg', 'http://h')).toBe(`http://h${base}img/driver/OneDrive.svg`)
  })
})
