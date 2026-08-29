import { describe, it, expect } from 'vitest'
import { eventInfo, i18nName } from './eventMap'
describe('eventMap', () => {
  it('i18nName parses i18n JSON or passes string', () => {
    expect(i18nName('{"zh_cn":"相册"}')).toBe('相册')
    expect(i18nName('Plain')).toBe('Plain')
  })
  it('maps disk added and app install events', () => {
    expect(eventInfo('local-storage:disk:added', { 'local-storage:model': 'WD' }).title).toBe('新磁盘接入：WD')
    expect(eventInfo('app:install-end', { 'app:title': '{"zh_cn":"Jellyfin"}' }).title).toBe('Jellyfin 安装完成')
    expect(eventInfo('app:install-error', { 'app:name': 'X' }).title).toBe('X 安装失败')
  })
})
